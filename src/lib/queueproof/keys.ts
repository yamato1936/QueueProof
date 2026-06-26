export function merchantPk(merchantId: string) {
  return `MERCHANT#${merchantId}`;
}

export function dropPk(dropId: string) {
  return `DROP#${dropId}`;
}

export function shardPk(dropId: string, shardId: string) {
  return `DROP#${dropId}#SHARD#${shardId}`;
}

export function reservationPk(dropId: string, userIdHash: string) {
  return `DROP#${dropId}#USER#${userIdHash}`;
}

export function waitlistPk(dropId: string, bucket: string) {
  return `DROP#${dropId}#WAITLIST#${bucket}`;
}

export function ledgerPk(dropId: string, bucket: string) {
  return `DROP#${dropId}#LEDGER#${bucket}`;
}

export function idempotencyPk(dropId: string, requestId: string) {
  return `IDEMPOTENCY#${dropId}#${requestId}`;
}

export function proofPk(dropId: string) {
  return `DROP#${dropId}`;
}

export const SK = {
  profile: "PROFILE",
  drop: (dropId: string) => `DROP#${dropId}`,
  meta: "META",
  counter: "COUNTER",
  reservation: "RESERVATION",
  result: "RESULT",
  proof: "PROOF",
  rank: (serverReceivedAt: string, ulid: string, userIdHash: string) =>
    `RANK#${serverReceivedAt}#${ulid}#${userIdHash}`,
  event: (serverReceivedAt: string, ulid: string, requestId: string) =>
    `EVENT#${serverReceivedAt}#${ulid}#${requestId}`
};
