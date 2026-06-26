import { createSimulationStore } from "./store";
import type { SimulationResult } from "./types";
import { newRequestId } from "./hash";

export async function runSimulation(): Promise<SimulationResult> {
  const store = createSimulationStore();
  const simulationRunId = `sim_${newRequestId()}`;
  const drop = await store.createDrop({
    merchantId: "merchant_sim",
    title: "Simulation drop",
    sku: "SIM-100",
    capacity: 100,
    shardCount: 10,
    simulationRunId
  });

  const results = await Promise.all(
    Array.from({ length: 1000 }, (_, index) =>
      store.reserve(drop.dropId, `sim-user-${simulationRunId}-${index}`, `${simulationRunId}-request-${index}`, {
        simulationRunId
      })
    )
  );

  const confirmed = results.filter((result) => result.status === "CONFIRMED").length;
  const waitlisted = results.filter((result) => result.status === "WAITLISTED").length;
  const duplicateAccepted = results.length - new Set(results.map((result) => result.userIdHash)).size;
  const proof = await store.generateProof(drop.dropId, { simulationRunId });
  const totalDynamoDBItemsWritten = await store.countSimulationItems(simulationRunId);
  const proofReplayStatus = Object.values(proof.checks).every(Boolean) ? "PASS" : "FAIL";

  return {
    dropId: drop.dropId,
    simulationRunId,
    attempts: 1000,
    capacity: 100,
    confirmed,
    waitlisted,
    oversell: Math.max(0, confirmed - 100),
    duplicateAccepted,
    totalDynamoDBItemsWritten,
    totalLedgerEvents: proof.eventCount,
    proofReplayStatus,
    finalProofHash: proof.finalProofHash
  };
}
