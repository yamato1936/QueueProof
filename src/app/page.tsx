import Link from "next/link";
import { SimulationPanel } from "@/components/SimulationPanel";

export default function HomePage() {
  return (
    <main>
      <section className="mx-auto grid max-w-6xl gap-8 px-5 py-16 md:grid-cols-[1.2fr_0.8fr] md:items-center">
        <div>
          <p className="text-sm font-semibold uppercase tracking-wide text-clay">Verifiable limited inventory</p>
          <h1 className="mt-3 max-w-3xl text-5xl font-semibold tracking-tight md:text-6xl">
            QueueProof
          </h1>
          <p className="mt-5 max-w-2xl text-lg leading-8 text-ink/72">
            Run high-demand drops with DynamoDB-backed reservation correctness, cancellation promotion, and a public proof replay that verifies every allocation from raw ledger events.
          </p>
          <div className="mt-8 flex flex-wrap gap-3">
            <Link className="rounded bg-ink px-4 py-3 text-sm font-medium text-white hover:bg-steel" href="/drops/new">
              Create a drop
            </Link>
            <Link className="rounded border border-line bg-white px-4 py-3 text-sm font-medium hover:border-steel" href="/dashboard">
              Merchant dashboard
            </Link>
          </div>
        </div>
        <div className="rounded border border-line bg-white p-5 shadow-panel">
          <div className="grid gap-3">
            {[
              ["Single-table DynamoDB", "PK/SK entities for merchants, drops, counters, waitlist, ledger, idempotency and proof."],
              ["Reservation critical path", "TransactWriteItems with conditional counter updates and no hash-head mutation."],
              ["Replay proof", "Ledger buckets are read after the drop, sorted deterministically and hashed into a final proof."]
            ].map(([title, body]) => (
              <div key={title} className="rounded border border-line bg-paper p-4">
                <h2 className="font-semibold">{title}</h2>
                <p className="mt-1 text-sm leading-6 text-ink/68">{body}</p>
              </div>
            ))}
          </div>
        </div>
      </section>
      <SimulationPanel />
    </main>
  );
}
