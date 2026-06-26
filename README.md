# QueueProof

QueueProof is verifiable drop infrastructure for limited inventory. It is a Next.js App Router TypeScript project that models high-demand drops on top of a single DynamoDB table.

## What is implemented

- Single-table DynamoDB design with `PK` and `SK` string keys.
- Write-sharded inventory counters.
- Idempotency records keyed by `IDEMPOTENCY#dropId#requestId / RESULT`.
- Reservation correctness via conditional writes and `TransactWriteItems`.
- Raw ledger events appended during reservation, cancellation, and promotion.
- Hash-chain proof generation outside the reservation critical path.
- Deterministic replay proof from ledger buckets.
- Public proof page with all required PASS/FAIL invariants.
- Simulation endpoint for 1,000 attempts against capacity 100.

## Run locally

```bash
npm install
npm run dev
```

QueueProof intentionally does not fall back to an in-process store. Set all required DynamoDB environment variables before running API routes:

```bash
AWS_REGION=us-east-1
DYNAMODB_TABLE=QueueProofTable
AWS_ACCESS_KEY_ID=...
AWS_SECRET_ACCESS_KEY=...
```

The DynamoDB table must have:

- Partition key: `PK` string
- Sort key: `SK` string

No secondary indexes are required for the demo.

## Key routes

- `/dashboard`
- `/drops/new`
- `/drops/[dropId]`
- `/proof/[dropId]`
- `/api/simulate`

The simulation is expected to return:

```json
{
  "attempts": 1000,
  "capacity": 100,
  "confirmed": 100,
  "waitlisted": 900,
  "oversell": 0,
  "duplicateAccepted": 0,
  "proofReplayStatus": "PASS"
}
```

After a successful simulation, the DynamoDB table contains the drop metadata, shard counters, reservations, waitlist ranks, ledger events, idempotency records, and proof record for the run.
