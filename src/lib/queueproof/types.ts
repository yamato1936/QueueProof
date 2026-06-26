export type ReservationStatus = "CONFIRMED" | "WAITLISTED" | "CANCELLED" | "PROMOTED";

export type LedgerEventType = "DROP_CREATED" | "CONFIRMED" | "WAITLISTED" | "CANCELLED" | "PROMOTED";

export type DropMeta = {
  merchantId: string;
  dropId: string;
  title: string;
  sku: string;
  capacity: number;
  shardCount: number;
  createdAt: string;
};

export type ReservationResult = {
  dropId: string;
  requestId: string;
  userIdHash: string;
  status: Extract<ReservationStatus, "CONFIRMED" | "WAITLISTED">;
  shardId?: string;
  waitlistRank?: string;
  serverReceivedAt: string;
  eventId: string;
  idempotent: boolean;
};

export type CancelResult = {
  dropId: string;
  requestId: string;
  userIdHash: string;
  status: "CANCELLED";
  promotedUserIdHash?: string;
  serverReceivedAt: string;
  eventId: string;
  idempotent: boolean;
};

export type LedgerEvent = {
  eventType: LedgerEventType;
  dropId: string;
  requestId: string;
  userIdHash?: string;
  targetUserIdHash?: string;
  shardId?: string;
  capacity?: number;
  waitlistRank?: string;
  promotedFromRank?: string;
  serverReceivedAt: string;
  ulid: string;
  eventId: string;
};

export type ProofResult = {
  dropId: string;
  capacity: number;
  confirmedCount: number;
  waitlistedCount: number;
  cancelledCount: number;
  promotedCount: number;
  finalConfirmedCount: number;
  checks: {
    capacityInvariant: boolean;
    noOversell: boolean;
    noDuplicateConfirmedUser: boolean;
    waitlistOrder: boolean;
    promotionOrder: boolean;
    hashChainValid: boolean;
  };
  finalProofHash: string;
  eventCount: number;
  generatedAt: string;
};

export type SimulationResult = {
  dropId: string;
  simulationRunId: string;
  attempts: number;
  capacity: number;
  confirmed: number;
  waitlisted: number;
  oversell: number;
  duplicateAccepted: number;
  totalDynamoDBItemsWritten: number;
  totalLedgerEvents: number;
  proofReplayStatus: "PASS" | "FAIL";
  finalProofHash: string;
};
