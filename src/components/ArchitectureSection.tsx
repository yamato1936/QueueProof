const PIPELINE = [
  {
    step: "01",
    title: "Reserve",
    body: "Each request hits the same service boundary as production. A single TransactWriteItems call conditionally increments a sharded counter and writes the reservation, so capacity can never be exceeded.",
  },
  {
    step: "02",
    title: "Append",
    body: "Every confirm, waitlist, cancel and promotion is appended as an immutable ledger event with a deterministic ULID. The hash head is never mutated in the critical path.",
  },
  {
    step: "03",
    title: "Replay",
    body: "After the drop, ledger buckets are read back, sorted deterministically and folded into a single hash chain. The replay recomputes every allocation from raw events.",
  },
  {
    step: "04",
    title: "Prove",
    body: "Six invariants are checked against the replayed state and published as a public proof. Anyone can verify the final hash matches the recorded ledger.",
  },
] as const;

const INVARIANTS = [
  "Capacity invariant",
  "No oversell",
  "No duplicate confirmed user",
  "Waitlist order",
  "Promotion order",
  "Hash chain valid",
] as const;

export function ArchitectureSection() {
  return (
    <section className="border-t border-line">
      <div className="mx-auto max-w-6xl px-5 py-16">
        <div className="max-w-2xl">
          <p className="text-sm font-semibold uppercase tracking-wide text-clay">How it works</p>
          <h2 className="mt-2 text-pretty text-3xl font-semibold tracking-tight md:text-4xl">
            A single-table ledger that proves itself
          </h2>
          <p className="mt-4 text-pretty text-base leading-7 text-ink/70">
            QueueProof stores merchants, drops, counters, waitlist, ledger, idempotency and proof records in one
            DynamoDB table. Correctness is enforced on the write path and verified again on replay.
          </p>
        </div>

        <ol className="mt-10 grid gap-4 md:grid-cols-2 lg:grid-cols-4">
          {PIPELINE.map((item) => (
            <li key={item.step} className="rounded border border-line bg-white p-5 shadow-panel">
              <span className="font-mono text-sm font-semibold text-steel">{item.step}</span>
              <h3 className="mt-3 text-lg font-semibold tracking-tight">{item.title}</h3>
              <p className="mt-2 text-sm leading-6 text-ink/68">{item.body}</p>
            </li>
          ))}
        </ol>

        <div className="mt-10 grid gap-4 md:grid-cols-[1fr_1fr]">
          <div className="rounded border border-line bg-paper p-6">
            <h3 className="text-lg font-semibold tracking-tight">Verified invariants</h3>
            <p className="mt-2 text-sm leading-6 text-ink/68">
              Every published proof asserts the following properties hold across the entire event ledger.
            </p>
            <ul className="mt-4 grid gap-2 sm:grid-cols-2">
              {INVARIANTS.map((invariant) => (
                <li key={invariant} className="flex items-center gap-2 text-sm text-ink/80">
                  <span aria-hidden className="inline-block h-1.5 w-1.5 rounded-full bg-moss" />
                  {invariant}
                </li>
              ))}
            </ul>
          </div>

          <div className="rounded border border-line bg-ink p-6 text-white shadow-panel">
            <h3 className="text-lg font-semibold tracking-tight">Critical-path guarantees</h3>
            <dl className="mt-4 grid gap-4">
              {[
                ["Atomic reservation", "Conditional counter + reservation write in one transaction."],
                ["Idempotent requests", "Replays of the same request id resolve to the same result."],
                ["Deterministic replay", "Ledger sort order is stable, so proofs reproduce byte-for-byte."],
              ].map(([term, def]) => (
                <div key={term}>
                  <dt className="text-sm font-semibold">{term}</dt>
                  <dd className="mt-1 text-sm leading-6 text-white/65">{def}</dd>
                </div>
              ))}
            </dl>
          </div>
        </div>
      </div>
    </section>
  );
}
