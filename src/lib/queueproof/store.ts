import { DynamoDBClient } from "@aws-sdk/client-dynamodb";
import { defaultProvider } from "@aws-sdk/credential-provider-node";
import {
  DynamoDBDocumentClient,
  GetCommand,
  PutCommand,
  QueryCommand,
  ScanCommand,
  TransactWriteCommand
} from "@aws-sdk/lib-dynamodb";
import {
  bucketFor,
  newDropId,
  newRequestId,
  pseudoUlid,
  shardPermutation,
  userHash
} from "./hash";
import {
  dropPk,
  idempotencyPk,
  ledgerPk,
  merchantPk,
  proofPk,
  reservationPk,
  shardPk,
  SK,
  waitlistPk
} from "./keys";
import { replayProof } from "./replay";
import type {
  CancelResult,
  DropMeta,
  LedgerEvent,
  ProofResult,
  ReservationResult,
  ReservationStatus
} from "./types";

function cleanEnv(value: string | undefined) {
  return value?.replace(/[^\t\x20-\x7e\x80-\xff]/g, "").replace(/[\u0000-\u001f\u007f]/g, "").trim();
}

const region = cleanEnv(process.env.AWS_REGION);
const tableName = cleanEnv(process.env.DYNAMODB_TABLE);
const accessKeyId = cleanEnv(process.env.AWS_ACCESS_KEY_ID);
const secretAccessKey = cleanEnv(process.env.AWS_SECRET_ACCESS_KEY);
const requiredDynamoEnv = ["AWS_REGION", "DYNAMODB_TABLE", "AWS_ACCESS_KEY_ID", "AWS_SECRET_ACCESS_KEY"] as const;

type AnyItem = Record<string, unknown> & { PK: string; SK: string };
type DocTransactWriteItem = {
  Put?: Record<string, unknown>;
  Update?: Record<string, unknown>;
  Delete?: Record<string, unknown>;
};

type QueueProofGlobal = typeof globalThis & {
  __queueProofMemoryItems?: Map<string, AnyItem>;
  __queueProofStore?: QueueStore;
};

function memoryItems() {
  const globalStore = globalThis as QueueProofGlobal;
  globalStore.__queueProofMemoryItems ??= new Map<string, AnyItem>();
  return globalStore.__queueProofMemoryItems;
}

export type CreateDropInput = {
  merchantId: string;
  title: string;
  sku: string;
  capacity: number;
  shardCount?: number;
  simulationRunId?: string;
};

export type WriteContext = {
  simulationRunId?: string;
};

export interface QueueStore {
  createDrop(input: CreateDropInput): Promise<DropMeta>;
  listDrops(merchantId: string): Promise<DropMeta[]>;
  getDrop(dropId: string): Promise<DropMeta | null>;
  reserve(dropId: string, userId: string, requestId?: string, context?: WriteContext): Promise<ReservationResult>;
  cancel(dropId: string, userId: string, requestId?: string, context?: WriteContext): Promise<CancelResult>;
  generateProof(dropId: string, context?: WriteContext): Promise<ProofResult>;
  countSimulationItems(simulationRunId: string): Promise<number>;
}

function nowIso() {
  return new Date().toISOString();
}

function eventFor(
  dropId: string,
  requestId: string,
  eventType: LedgerEvent["eventType"],
  fields: Partial<LedgerEvent>
): LedgerEvent {
  const serverReceivedAt = fields.serverReceivedAt ?? nowIso();
  const ulid = fields.ulid ?? pseudoUlid(new Date(serverReceivedAt));
  return {
    eventType,
    dropId,
    requestId,
    serverReceivedAt,
    ulid,
    eventId: `${serverReceivedAt}#${ulid}#${requestId}`,
    ...fields
  };
}

function toShardCount(input?: number) {
  return Math.max(1, Math.min(32, input ?? 10));
}

function isConditionalFailure(error: unknown) {
  return error instanceof Error && error.name === "TransactionCanceledException";
}

function missingDynamoEnv() {
  return requiredDynamoEnv.filter((key) => !cleanEnv(process.env[key]));
}

function runAttrs(context?: WriteContext) {
  return context?.simulationRunId ? { simulationRunId: context.simulationRunId } : {};
}

function hasPlausibleStaticCredentials() {
  return Boolean(accessKeyId && secretAccessKey && /^[A-Z0-9]{16,32}$/.test(accessKeyId) && secretAccessKey.length >= 30);
}

async function sharedCredentialChainWithoutLoadedEnv() {
  const savedAccessKeyId = process.env.AWS_ACCESS_KEY_ID;
  const savedSecretAccessKey = process.env.AWS_SECRET_ACCESS_KEY;
  const savedSessionToken = process.env.AWS_SESSION_TOKEN;
  delete process.env.AWS_ACCESS_KEY_ID;
  delete process.env.AWS_SECRET_ACCESS_KEY;
  delete process.env.AWS_SESSION_TOKEN;
  try {
    return await defaultProvider()();
  } finally {
    if (savedAccessKeyId === undefined) delete process.env.AWS_ACCESS_KEY_ID;
    else process.env.AWS_ACCESS_KEY_ID = savedAccessKeyId;
    if (savedSecretAccessKey === undefined) delete process.env.AWS_SECRET_ACCESS_KEY;
    else process.env.AWS_SECRET_ACCESS_KEY = savedSecretAccessKey;
    if (savedSessionToken === undefined) delete process.env.AWS_SESSION_TOKEN;
    else process.env.AWS_SESSION_TOKEN = savedSessionToken;
  }
}

export function getDynamoRuntimeInfo() {
  return {
    realDynamoDBMode: missingDynamoEnv().length === 0,
    tableName,
    region,
    missingEnv: missingDynamoEnv()
  };
}

export class DynamoQueueStore implements QueueStore {
  private readonly doc: DynamoDBDocumentClient;
  private readonly tableName: string;

  constructor() {
    const missing = missingDynamoEnv();
    if (missing.length > 0 || !tableName || !region) {
      throw new Error(`Real DynamoDB mode requires ${requiredDynamoEnv.join(", ")}. Missing: ${missing.join(", ")}`);
    }
    const client = new DynamoDBClient({
      region,
      credentials: hasPlausibleStaticCredentials()
        ? {
            accessKeyId: accessKeyId!,
            secretAccessKey: secretAccessKey!,
            sessionToken: cleanEnv(process.env.AWS_SESSION_TOKEN)
          }
        : sharedCredentialChainWithoutLoadedEnv,
      endpoint: process.env.DYNAMODB_ENDPOINT
    });
    this.doc = DynamoDBDocumentClient.from(client, {
      marshallOptions: { removeUndefinedValues: true }
    });
    this.tableName = tableName;
  }

  async createDrop(input: CreateDropInput): Promise<DropMeta> {
    const dropId = newDropId();
    const shardCount = toShardCount(input.shardCount);
    const meta: DropMeta = {
      merchantId: input.merchantId || "merchant_demo",
      dropId,
      title: input.title,
      sku: input.sku,
      capacity: input.capacity,
      shardCount,
      createdAt: nowIso()
    };
    const base = Math.floor(input.capacity / shardCount);
    const remainder = input.capacity % shardCount;
    const context = { simulationRunId: input.simulationRunId };
    const event = eventFor(dropId, `create-${dropId}`, "DROP_CREATED", {
      capacity: input.capacity
    });

    await this.doc.send(
      new TransactWriteCommand({
        TransactItems: [
          {
            Put: {
              TableName: this.tableName,
              Item: {
                PK: merchantPk(meta.merchantId),
                SK: SK.profile,
                entityType: "MERCHANT",
                merchantId: meta.merchantId,
                updatedAt: meta.createdAt,
                ...runAttrs(context)
              }
            }
          },
          {
            Put: {
              TableName: this.tableName,
              Item: {
                PK: merchantPk(meta.merchantId),
                SK: SK.drop(dropId),
                entityType: "MERCHANT_DROP",
                ...meta,
                ...runAttrs(context)
              }
            }
          },
          {
            Put: {
              TableName: this.tableName,
              Item: {
                PK: dropPk(dropId),
                SK: SK.meta,
                entityType: "DROP_META",
                ...meta,
                ...runAttrs(context)
              },
              ConditionExpression: "attribute_not_exists(PK)"
            }
          },
          ...Array.from({ length: shardCount }, (_, index) => ({
            Put: {
              TableName: this.tableName,
              Item: {
                PK: shardPk(dropId, String(index).padStart(2, "0")),
                SK: SK.counter,
                entityType: "COUNTER",
                dropId,
                shardId: String(index).padStart(2, "0"),
                remaining: base + (index < remainder ? 1 : 0),
                reserved: 0,
                ...runAttrs(context)
              }
            }
          })),
          this.ledgerPut(event, context)
        ] as never
      })
    );

    return meta;
  }

  async listDrops(merchantId: string): Promise<DropMeta[]> {
    const result = await this.doc.send(
      new QueryCommand({
        TableName: this.tableName,
        KeyConditionExpression: "PK = :pk AND begins_with(SK, :drop)",
        ExpressionAttributeValues: {
          ":pk": merchantPk(merchantId),
          ":drop": "DROP#"
        }
      })
    );
    return (result.Items ?? []) as DropMeta[];
  }

  async getDrop(dropId: string): Promise<DropMeta | null> {
    const result = await this.doc.send(
      new GetCommand({
        TableName: this.tableName,
        Key: { PK: dropPk(dropId), SK: SK.meta }
      })
    );
    return (result.Item as DropMeta | undefined) ?? null;
  }

  async reserve(dropId: string, userId: string, maybeRequestId?: string, context?: WriteContext): Promise<ReservationResult> {
    const requestId = maybeRequestId || newRequestId();
    const existing = await this.getIdempotency<ReservationResult>(dropId, requestId);
    if (existing) return { ...existing, idempotent: true };

    const drop = await this.requireDrop(dropId);
    const userIdHash = userHash(userId);
    const existingReservation = await this.getReservation(dropId, userIdHash);
    if (existingReservation) {
      return {
        dropId,
        requestId,
        userIdHash,
        status: existingReservation.status === "CONFIRMED" || existingReservation.status === "PROMOTED" ? "CONFIRMED" : "WAITLISTED",
        serverReceivedAt: String(existingReservation.updatedAt ?? existingReservation.createdAt ?? nowIso()),
        eventId: "existing-user",
        idempotent: true
      };
    }

    for (const shardId of shardPermutation(dropId, requestId, userIdHash, drop.shardCount)) {
      const serverReceivedAt = nowIso();
      const event = eventFor(dropId, requestId, "CONFIRMED", {
        userIdHash,
        shardId,
        serverReceivedAt
      });
      const result: ReservationResult = {
        dropId,
        requestId,
        userIdHash,
        status: "CONFIRMED",
        shardId,
        serverReceivedAt,
        eventId: event.eventId,
        idempotent: false
      };
      try {
        await this.doc.send(
          new TransactWriteCommand({
            TransactItems: [
              this.idempotencyPut(dropId, requestId, result, context),
              this.reservationPut(dropId, userIdHash, "CONFIRMED", requestId, serverReceivedAt, { shardId }, context),
              {
                Update: {
                  TableName: this.tableName,
                  Key: { PK: shardPk(dropId, shardId), SK: SK.counter },
                  UpdateExpression: "ADD remaining :minusOne, reserved :one",
                  ConditionExpression: "remaining > :zero",
                  ExpressionAttributeValues: {
                    ":minusOne": -1,
                    ":one": 1,
                    ":zero": 0
                  }
                }
              },
              this.ledgerPut(event, context)
            ] as never
          })
        );
        return result;
      } catch (error) {
        if (!isConditionalFailure(error)) throw error;
        const afterRace = await this.getIdempotency<ReservationResult>(dropId, requestId);
        if (afterRace) return { ...afterRace, idempotent: true };
      }
    }

    return this.waitlist(drop, userIdHash, requestId, context);
  }

  async cancel(dropId: string, userId: string, maybeRequestId?: string, context?: WriteContext): Promise<CancelResult> {
    const requestId = maybeRequestId || newRequestId();
    const existing = await this.getIdempotency<CancelResult>(dropId, requestId);
    if (existing) return { ...existing, idempotent: true };

    const drop = await this.requireDrop(dropId);
    const userIdHash = userHash(userId);
    const reservation = await this.getReservation(dropId, userIdHash);
    if (!reservation || (reservation.status !== "CONFIRMED" && reservation.status !== "PROMOTED")) {
      throw new Error("Only confirmed reservations can be cancelled.");
    }

    const promotion = await this.findEarliestWaitlist(dropId);
    const serverReceivedAt = nowIso();
    const cancelEvent = eventFor(dropId, requestId, "CANCELLED", { userIdHash, serverReceivedAt });
    const result: CancelResult = {
      dropId,
      requestId,
      userIdHash,
      status: "CANCELLED",
      promotedUserIdHash: promotion?.userIdHash,
      serverReceivedAt,
      eventId: cancelEvent.eventId,
      idempotent: false
    };
    const transactItems: DocTransactWriteItem[] = [
      this.idempotencyPut(dropId, requestId, result, context),
      {
        Update: {
          TableName: this.tableName,
          Key: { PK: reservationPk(dropId, userIdHash), SK: SK.reservation },
          UpdateExpression: "SET #status = :cancelled, updatedAt = :updatedAt",
          ConditionExpression: "#status IN (:confirmed, :promoted)",
          ExpressionAttributeNames: { "#status": "status" },
          ExpressionAttributeValues: {
            ":cancelled": "CANCELLED",
            ":confirmed": "CONFIRMED",
            ":promoted": "PROMOTED",
            ":updatedAt": serverReceivedAt
          }
        }
      },
      this.ledgerPut(cancelEvent, context)
    ];

    if (promotion) {
      const promoteEvent = eventFor(dropId, `${requestId}-promotion`, "PROMOTED", {
        targetUserIdHash: promotion.userIdHash,
        promotedFromRank: promotion.rank,
        serverReceivedAt
      });
      transactItems.push(
        {
          Update: {
            TableName: this.tableName,
            Key: { PK: reservationPk(dropId, promotion.userIdHash), SK: SK.reservation },
            UpdateExpression: "SET #status = :promoted, updatedAt = :updatedAt, promotedByRequestId = :requestId",
            ConditionExpression: "#status = :waitlisted",
            ExpressionAttributeNames: { "#status": "status" },
            ExpressionAttributeValues: {
              ":promoted": "PROMOTED",
              ":waitlisted": "WAITLISTED",
              ":updatedAt": serverReceivedAt,
              ":requestId": requestId
            }
          }
        },
        {
          Delete: {
            TableName: this.tableName,
            Key: { PK: promotion.PK, SK: promotion.SK },
            ConditionExpression: "attribute_exists(PK)"
          }
        },
        this.ledgerPut(promoteEvent, context)
      );
    } else {
      const shardId = String(Number.parseInt(userIdHash.slice(0, 8), 16) % drop.shardCount).padStart(2, "0");
      transactItems.push({
        Update: {
          TableName: this.tableName,
          Key: { PK: shardPk(dropId, shardId), SK: SK.counter },
          UpdateExpression: "ADD remaining :one, reserved :minusOne",
          ExpressionAttributeValues: {
            ":one": 1,
            ":minusOne": -1
          }
        }
      });
    }

    await this.doc.send(new TransactWriteCommand({ TransactItems: transactItems as never }));
    return result;
  }

  async generateProof(dropId: string, context?: WriteContext): Promise<ProofResult> {
    const drop = await this.requireDrop(dropId);
    const events: LedgerEvent[] = [];
    for (let i = 0; i < 16; i += 1) {
      const bucket = String(i).padStart(2, "0");
      const result = await this.doc.send(
        new QueryCommand({
          TableName: this.tableName,
          KeyConditionExpression: "PK = :pk AND begins_with(SK, :event)",
          ExpressionAttributeValues: {
            ":pk": ledgerPk(dropId, bucket),
            ":event": "EVENT#"
          }
        })
      );
      events.push(...((result.Items ?? []).map((item) => item.event) as LedgerEvent[]));
    }
    const proof = replayProof(dropId, drop.capacity, events);
    await this.doc.send(
      new PutCommand({
        TableName: this.tableName,
        Item: { PK: proofPk(dropId), SK: SK.proof, entityType: "PROOF", ...proof, ...runAttrs(context) }
      })
    );
    return proof;
  }

  async countSimulationItems(simulationRunId: string): Promise<number> {
    let count = 0;
    let ExclusiveStartKey: Record<string, unknown> | undefined;
    do {
      const result = await this.doc.send(
        new ScanCommand({
          TableName: this.tableName,
          Select: "COUNT",
          FilterExpression: "simulationRunId = :simulationRunId",
          ExpressionAttributeValues: {
            ":simulationRunId": simulationRunId
          },
          ExclusiveStartKey
        })
      );
      count += result.Count ?? 0;
      ExclusiveStartKey = result.LastEvaluatedKey;
    } while (ExclusiveStartKey);
    return count;
  }

  private async waitlist(drop: DropMeta, userIdHash: string, requestId: string, context?: WriteContext): Promise<ReservationResult> {
    const serverReceivedAt = nowIso();
    const ulid = pseudoUlid(new Date(serverReceivedAt));
    const waitlistBucket = bucketFor(userIdHash);
    const rank = SK.rank(serverReceivedAt, ulid, userIdHash);
    const event = eventFor(drop.dropId, requestId, "WAITLISTED", {
      userIdHash,
      waitlistRank: rank,
      serverReceivedAt,
      ulid
    });
    const result: ReservationResult = {
      dropId: drop.dropId,
      requestId,
      userIdHash,
      status: "WAITLISTED",
      waitlistRank: rank,
      serverReceivedAt,
      eventId: event.eventId,
      idempotent: false
    };

    await this.doc.send(
      new TransactWriteCommand({
        TransactItems: [
          this.idempotencyPut(drop.dropId, requestId, result, context),
          this.reservationPut(drop.dropId, userIdHash, "WAITLISTED", requestId, serverReceivedAt, {}, context),
          {
            Put: {
              TableName: this.tableName,
              Item: {
                PK: waitlistPk(drop.dropId, waitlistBucket),
                SK: rank,
                entityType: "WAITLIST",
                dropId: drop.dropId,
                userIdHash,
                requestId,
                rank,
                serverReceivedAt,
                ...runAttrs(context)
              },
              ConditionExpression: "attribute_not_exists(PK)"
            }
          },
          this.ledgerPut(event, context)
        ] as never
      })
    );
    return result;
  }

  private async requireDrop(dropId: string) {
    const drop = await this.getDrop(dropId);
    if (!drop) throw new Error(`Drop ${dropId} not found.`);
    return drop;
  }

  private async getIdempotency<T>(dropId: string, requestId: string): Promise<T | null> {
    const result = await this.doc.send(
      new GetCommand({
        TableName: this.tableName,
        Key: { PK: idempotencyPk(dropId, requestId), SK: SK.result }
      })
    );
    return (result.Item?.result as T | undefined) ?? null;
  }

  private async getReservation(dropId: string, userIdHash: string): Promise<(AnyItem & { status: ReservationStatus }) | null> {
    const result = await this.doc.send(
      new GetCommand({
        TableName: this.tableName,
        Key: { PK: reservationPk(dropId, userIdHash), SK: SK.reservation }
      })
    );
    return (result.Item as (AnyItem & { status: ReservationStatus }) | undefined) ?? null;
  }

  private async findEarliestWaitlist(dropId: string): Promise<(AnyItem & { userIdHash: string; rank: string }) | null> {
    const heads = await Promise.all(
      Array.from({ length: 16 }, async (_, index) => {
        const bucket = String(index).padStart(2, "0");
        const result = await this.doc.send(
          new QueryCommand({
            TableName: this.tableName,
            KeyConditionExpression: "PK = :pk AND begins_with(SK, :rank)",
            ExpressionAttributeValues: {
              ":pk": waitlistPk(dropId, bucket),
              ":rank": "RANK#"
            },
            Limit: 1,
            ScanIndexForward: true
          })
        );
        return result.Items?.[0] as (AnyItem & { userIdHash: string; rank: string }) | undefined;
      })
    );
    return heads.filter(Boolean).sort((a, b) => a!.SK.localeCompare(b!.SK))[0] ?? null;
  }

  private idempotencyPut(dropId: string, requestId: string, result: unknown, context?: WriteContext): DocTransactWriteItem {
    return {
      Put: {
        TableName: this.tableName,
        Item: {
          PK: idempotencyPk(dropId, requestId),
          SK: SK.result,
          entityType: "IDEMPOTENCY",
          dropId,
          requestId,
          result,
          createdAt: nowIso(),
          ...runAttrs(context)
        },
        ConditionExpression: "attribute_not_exists(PK)"
      }
    };
  }

  private reservationPut(
    dropId: string,
    userIdHash: string,
    status: ReservationStatus,
    requestId: string,
    serverReceivedAt: string,
    extra: Record<string, unknown> = {},
    context?: WriteContext
  ): DocTransactWriteItem {
    return {
      Put: {
        TableName: this.tableName,
        Item: {
          PK: reservationPk(dropId, userIdHash),
          SK: SK.reservation,
          entityType: "RESERVATION",
          dropId,
          userIdHash,
          status,
          requestId,
          createdAt: serverReceivedAt,
          updatedAt: serverReceivedAt,
          ...extra,
          ...runAttrs(context)
        },
        ConditionExpression: "attribute_not_exists(PK)"
      }
    };
  }

  private ledgerPut(event: LedgerEvent, context?: WriteContext): DocTransactWriteItem {
    return {
      Put: {
        TableName: this.tableName,
        Item: {
          PK: ledgerPk(event.dropId, bucketFor(event.requestId)),
          SK: SK.event(event.serverReceivedAt, event.ulid, event.requestId),
          entityType: "LEDGER",
          event,
          dropId: event.dropId,
          ...runAttrs(context)
        },
        ConditionExpression: "attribute_not_exists(PK)"
      }
    };
  }
}

export class MemoryQueueStore implements QueueStore {
  private readonly items = memoryItems();

  async createDrop(input: CreateDropInput): Promise<DropMeta> {
    const dropId = newDropId();
    const shardCount = toShardCount(input.shardCount);
    const meta: DropMeta = {
      merchantId: input.merchantId || "merchant_demo",
      dropId,
      title: input.title,
      sku: input.sku,
      capacity: input.capacity,
      shardCount,
      createdAt: nowIso()
    };
    const base = Math.floor(input.capacity / shardCount);
    const remainder = input.capacity % shardCount;
    this.put({ PK: merchantPk(meta.merchantId), SK: SK.profile, entityType: "MERCHANT", merchantId: meta.merchantId });
    this.put({ PK: merchantPk(meta.merchantId), SK: SK.drop(dropId), entityType: "MERCHANT_DROP", ...meta });
    this.put({ PK: dropPk(dropId), SK: SK.meta, entityType: "DROP_META", ...meta });
    for (let i = 0; i < shardCount; i += 1) {
      const shardId = String(i).padStart(2, "0");
      this.put({
        PK: shardPk(dropId, shardId),
        SK: SK.counter,
        entityType: "COUNTER",
        dropId,
        shardId,
        remaining: base + (i < remainder ? 1 : 0),
        reserved: 0
      });
    }
    this.appendLedger(eventFor(dropId, `create-${dropId}`, "DROP_CREATED", { capacity: input.capacity }));
    return meta;
  }

  async listDrops(merchantId: string): Promise<DropMeta[]> {
    return this.query(merchantPk(merchantId), "DROP#") as unknown as DropMeta[];
  }

  async getDrop(dropId: string): Promise<DropMeta | null> {
    return (this.get(dropPk(dropId), SK.meta) as DropMeta | undefined) ?? null;
  }

  async reserve(dropId: string, userId: string, maybeRequestId?: string): Promise<ReservationResult> {
    const requestId = maybeRequestId || newRequestId();
    const idem = this.get(idempotencyPk(dropId, requestId), SK.result) as { result: ReservationResult } | undefined;
    if (idem) return { ...idem.result, idempotent: true };
    const drop = await this.requireDrop(dropId);
    const userIdHash = userHash(userId);
    const existing = this.get(reservationPk(dropId, userIdHash), SK.reservation) as { status: ReservationStatus } | undefined;
    if (existing) {
      return {
        dropId,
        requestId,
        userIdHash,
        status: existing.status === "WAITLISTED" ? "WAITLISTED" : "CONFIRMED",
        serverReceivedAt: nowIso(),
        eventId: "existing-user",
        idempotent: true
      };
    }
    for (const shardId of shardPermutation(dropId, requestId, userIdHash, drop.shardCount)) {
      const counter = this.get(shardPk(dropId, shardId), SK.counter) as { remaining: number; reserved: number } | undefined;
      if (counter && counter.remaining > 0) {
        counter.remaining -= 1;
        counter.reserved += 1;
        const serverReceivedAt = nowIso();
        const event = eventFor(dropId, requestId, "CONFIRMED", { userIdHash, shardId, serverReceivedAt });
        const result: ReservationResult = {
          dropId,
          requestId,
          userIdHash,
          status: "CONFIRMED",
          shardId,
          serverReceivedAt,
          eventId: event.eventId,
          idempotent: false
        };
        this.put({ PK: idempotencyPk(dropId, requestId), SK: SK.result, entityType: "IDEMPOTENCY", result });
        this.put({
          PK: reservationPk(dropId, userIdHash),
          SK: SK.reservation,
          entityType: "RESERVATION",
          dropId,
          userIdHash,
          status: "CONFIRMED",
          requestId,
          shardId,
          createdAt: serverReceivedAt,
          updatedAt: serverReceivedAt
        });
        this.appendLedger(event);
        return result;
      }
    }
    return this.waitlist(drop, userIdHash, requestId);
  }

  async cancel(dropId: string, userId: string, maybeRequestId?: string): Promise<CancelResult> {
    const requestId = maybeRequestId || newRequestId();
    const idem = this.get(idempotencyPk(dropId, requestId), SK.result) as { result: CancelResult } | undefined;
    if (idem) return { ...idem.result, idempotent: true };
    const drop = await this.requireDrop(dropId);
    const userIdHash = userHash(userId);
    const reservation = this.get(reservationPk(dropId, userIdHash), SK.reservation) as
      | (AnyItem & { status: ReservationStatus; shardId?: string })
      | undefined;
    if (!reservation || (reservation.status !== "CONFIRMED" && reservation.status !== "PROMOTED")) {
      throw new Error("Only confirmed reservations can be cancelled.");
    }

    reservation.status = "CANCELLED";
    reservation.updatedAt = nowIso();
    const promotion = this.findEarliestWaitlist(dropId);
    const serverReceivedAt = nowIso();
    const cancelEvent = eventFor(dropId, requestId, "CANCELLED", { userIdHash, serverReceivedAt });
    const result: CancelResult = {
      dropId,
      requestId,
      userIdHash,
      status: "CANCELLED",
      promotedUserIdHash: promotion?.userIdHash,
      serverReceivedAt,
      eventId: cancelEvent.eventId,
      idempotent: false
    };
    this.put({ PK: idempotencyPk(dropId, requestId), SK: SK.result, entityType: "IDEMPOTENCY", result });
    this.appendLedger(cancelEvent);

    if (promotion) {
      const promoted = this.get(reservationPk(dropId, promotion.userIdHash), SK.reservation) as AnyItem & {
        status: ReservationStatus;
      };
      promoted.status = "PROMOTED";
      promoted.updatedAt = serverReceivedAt;
      this.delete(promotion.PK, promotion.SK);
      this.appendLedger(
        eventFor(dropId, `${requestId}-promotion`, "PROMOTED", {
          targetUserIdHash: promotion.userIdHash,
          promotedFromRank: promotion.rank,
          serverReceivedAt
        })
      );
    } else {
      const shardId = reservation.shardId ?? String(Number.parseInt(userIdHash.slice(0, 8), 16) % drop.shardCount).padStart(2, "0");
      const counter = this.get(shardPk(dropId, shardId), SK.counter) as unknown as { remaining: number; reserved: number };
      counter.remaining += 1;
      counter.reserved -= 1;
    }
    return result;
  }

  async generateProof(dropId: string): Promise<ProofResult> {
    const drop = await this.requireDrop(dropId);
    const events = Array.from(this.items.values())
      .filter((item) => item.entityType === "LEDGER" && item.PK.startsWith(`DROP#${dropId}#LEDGER#`))
      .map((item) => item.event as LedgerEvent);
    const proof = replayProof(dropId, drop.capacity, events);
    this.put({ PK: proofPk(dropId), SK: SK.proof, entityType: "PROOF", ...proof });
    return proof;
  }

  async countSimulationItems(simulationRunId: string): Promise<number> {
    return Array.from(this.items.values()).filter((item) => item.simulationRunId === simulationRunId).length;
  }

  private async waitlist(drop: DropMeta, userIdHash: string, requestId: string): Promise<ReservationResult> {
    const serverReceivedAt = nowIso();
    const ulid = pseudoUlid(new Date(serverReceivedAt));
    const rank = SK.rank(serverReceivedAt, ulid, userIdHash);
    const event = eventFor(drop.dropId, requestId, "WAITLISTED", { userIdHash, waitlistRank: rank, serverReceivedAt, ulid });
    const result: ReservationResult = {
      dropId: drop.dropId,
      requestId,
      userIdHash,
      status: "WAITLISTED",
      waitlistRank: rank,
      serverReceivedAt,
      eventId: event.eventId,
      idempotent: false
    };
    this.put({ PK: idempotencyPk(drop.dropId, requestId), SK: SK.result, entityType: "IDEMPOTENCY", result });
    this.put({
      PK: reservationPk(drop.dropId, userIdHash),
      SK: SK.reservation,
      entityType: "RESERVATION",
      dropId: drop.dropId,
      userIdHash,
      status: "WAITLISTED",
      requestId,
      createdAt: serverReceivedAt,
      updatedAt: serverReceivedAt
    });
    this.put({
      PK: waitlistPk(drop.dropId, bucketFor(userIdHash)),
      SK: rank,
      entityType: "WAITLIST",
      dropId: drop.dropId,
      userIdHash,
      requestId,
      rank,
      serverReceivedAt
    });
    this.appendLedger(event);
    return result;
  }

  private async requireDrop(dropId: string) {
    const drop = await this.getDrop(dropId);
    if (!drop) throw new Error(`Drop ${dropId} not found.`);
    return drop;
  }

  private findEarliestWaitlist(dropId: string): (AnyItem & { userIdHash: string; rank: string }) | null {
    return (
      Array.from(this.items.values())
        .filter((item) => item.entityType === "WAITLIST" && item.PK.startsWith(`DROP#${dropId}#WAITLIST#`))
        .sort((a, b) => a.SK.localeCompare(b.SK))[0] as (AnyItem & { userIdHash: string; rank: string }) | undefined
    ) ?? null;
  }

  private appendLedger(event: LedgerEvent) {
    this.put({
      PK: ledgerPk(event.dropId, bucketFor(event.requestId)),
      SK: SK.event(event.serverReceivedAt, event.ulid, event.requestId),
      entityType: "LEDGER",
      event
    });
  }

  private query(pk: string, skPrefix: string) {
    return Array.from(this.items.values())
      .filter((item) => item.PK === pk && item.SK.startsWith(skPrefix))
      .sort((a, b) => a.SK.localeCompare(b.SK));
  }

  private get(pk: string, sk: string) {
    return this.items.get(`${pk}|${sk}`);
  }

  private put(item: AnyItem) {
    this.items.set(`${item.PK}|${item.SK}`, item);
  }

  private delete(pk: string, sk: string) {
    this.items.delete(`${pk}|${sk}`);
  }
}

let singleton: QueueStore | null = null;

export function getQueueStore() {
  singleton ??= new DynamoQueueStore();
  return singleton;
}

export function createSimulationStore() {
  return new DynamoQueueStore();
}
