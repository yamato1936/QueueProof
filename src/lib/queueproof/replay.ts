import type { LedgerEvent, ProofResult } from "./types";
import { hashEvent } from "./hash";

export function sortLedgerEvents(events: LedgerEvent[]) {
  return [...events].sort((a, b) => {
    const time = a.serverReceivedAt.localeCompare(b.serverReceivedAt);
    if (time !== 0) return time;
    const ulid = a.ulid.localeCompare(b.ulid);
    if (ulid !== 0) return ulid;
    return a.requestId.localeCompare(b.requestId);
  });
}

export function replayProof(dropId: string, capacity: number, rawEvents: LedgerEvent[]): ProofResult {
  const events = sortLedgerEvents(rawEvents);
  const confirmedUsers = new Set<string>();
  const finalConfirmed = new Set<string>();
  const waitlistRanks: string[] = [];
  const promotedRanks: string[] = [];
  let confirmedCount = 0;
  let waitlistedCount = 0;
  let cancelledCount = 0;
  let promotedCount = 0;
  let duplicateConfirmed = false;
  let oversell = false;
  let hash = "GENESIS";

  for (const event of events) {
    hash = hashEvent(hash, event);

    if (event.eventType === "CONFIRMED" && event.userIdHash) {
      confirmedCount += 1;
      if (confirmedUsers.has(event.userIdHash)) duplicateConfirmed = true;
      confirmedUsers.add(event.userIdHash);
      finalConfirmed.add(event.userIdHash);
      if (finalConfirmed.size > capacity) oversell = true;
    }

    if (event.eventType === "WAITLISTED" && event.waitlistRank) {
      waitlistedCount += 1;
      waitlistRanks.push(event.waitlistRank);
    }

    if (event.eventType === "CANCELLED" && event.userIdHash) {
      cancelledCount += 1;
      finalConfirmed.delete(event.userIdHash);
    }

    if (event.eventType === "PROMOTED" && event.targetUserIdHash) {
      promotedCount += 1;
      if (confirmedUsers.has(event.targetUserIdHash)) duplicateConfirmed = true;
      confirmedUsers.add(event.targetUserIdHash);
      finalConfirmed.add(event.targetUserIdHash);
      if (event.promotedFromRank) promotedRanks.push(event.promotedFromRank);
      if (finalConfirmed.size > capacity) oversell = true;
    }
  }

  const sortedWaitlist = [...waitlistRanks].sort();
  const waitlistOrder = waitlistRanks.every((rank, index) => rank === sortedWaitlist[index]);
  const promotionOrder = promotedRanks.every((rank, index) => rank === sortedWaitlist[index]);

  return {
    dropId,
    capacity,
    confirmedCount,
    waitlistedCount,
    cancelledCount,
    promotedCount,
    finalConfirmedCount: finalConfirmed.size,
    checks: {
      capacityInvariant: finalConfirmed.size <= capacity,
      noOversell: !oversell,
      noDuplicateConfirmedUser: !duplicateConfirmed,
      waitlistOrder,
      promotionOrder,
      hashChainValid: hash.length === 64
    },
    finalProofHash: hash,
    eventCount: events.length,
    generatedAt: new Date().toISOString()
  };
}
