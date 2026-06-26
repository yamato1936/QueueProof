import { createHash, randomBytes } from "crypto";

export function sha256(input: string) {
  return createHash("sha256").update(input).digest("hex");
}

export function userHash(userId: string) {
  return sha256(userId.trim().toLowerCase());
}

export function stableJson(value: unknown): string {
  if (value === null || typeof value !== "object") {
    return JSON.stringify(value);
  }
  if (Array.isArray(value)) {
    return `[${value.map(stableJson).join(",")}]`;
  }
  const obj = value as Record<string, unknown>;
  return `{${Object.keys(obj)
    .sort()
    .map((key) => `${JSON.stringify(key)}:${stableJson(obj[key])}`)
    .join(",")}}`;
}

export function hashEvent(prevHash: string, event: unknown) {
  return sha256(`${prevHash}\n${stableJson(event)}`);
}

export function newRequestId() {
  return randomBytes(16).toString("hex");
}

export function newDropId() {
  return `drop_${randomBytes(8).toString("hex")}`;
}

export function pseudoUlid(now = new Date()) {
  const time = now.getTime().toString(36).padStart(9, "0");
  return `${time}${randomBytes(8).toString("hex")}`;
}

export function bucketFor(value: string, buckets = 16) {
  const n = Number.parseInt(sha256(value).slice(0, 8), 16);
  return String(n % buckets).padStart(2, "0");
}

export function shardPermutation(dropId: string, requestId: string, userIdHash: string, shardCount: number) {
  const scores = Array.from({ length: shardCount }, (_, index) => {
    const shardId = String(index).padStart(2, "0");
    return { shardId, score: sha256(`${dropId}:${requestId}:${userIdHash}:${shardId}`) };
  });
  return scores.sort((a, b) => a.score.localeCompare(b.score)).map((item) => item.shardId);
}
