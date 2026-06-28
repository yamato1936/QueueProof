import Link from "next/link";
import { SimulationPanel } from "@/components/SimulationPanel";
import { ArchitectureSection } from "@/components/ArchitectureSection";

const HERO_HIGHLIGHTS = [
  ["Single-table DynamoDB", "PK/SK entities for merchants, drops, counters, waitlist, ledger, idempotency and proof."],
  ["Reservation critical path", "TransactWriteItems with conditional counter updates and no hash-head mutation."],
  ["Replay proof", "Ledger buckets are read after the drop, sorted deterministically and hashed into a final proof."],
] as const;

export default function HomePage() {
  return (
    <main>
      <section className="relative overflow-hidden border-b border-line">
        <div className="mx-auto grid max-w-6xl gap-10 px-5 py-20 md:grid-cols-[1.15fr_0.85fr] md:items-center">
          <div>
            <span className="inline-flex items-center gap-2 rounded-full border border-line bg-white px-3 py-1 text-xs font-semibold uppercase tracking-wide text-steel">
              <span aria-hidden className="inline-block h-1.5 w-1.5 rounded-full bg-moss" />
              Verifiable limited inventory
            </span>
            <h1 className="mt-5 text-balance text-5xl font-semibold tracking-tight md:text-7xl">QueueProof</h1>
            <p className="mt-5 max-w-2xl text-pretty text-lg leading-8 text-ink/72">
              Run high-demand drops with DynamoDB-backed reservation correctness, cancellation promotion, and a public
              proof replay that verifies every allocation from raw ledger events.
            </p>
            <div className="mt-8 flex flex-wrap gap-3">
              <Link
                className="rounded bg-ink px-5 py-3 text-sm font-medium text-white transition hover:bg-steel"
                href="/drops/new"
              >
                Create a drop
              </Link>
              <Link
                className="rounded border border-line bg-white px-5 py-3 text-sm font-medium transition hover:border-steel"
                href="/dashboard"
              >
                Merchant dashboard
              </Link>
            </div>
            <dl className="mt-10 flex flex-wrap gap-x-10 gap-y-4">
              {[
                ["1,000", "concurrent requests"],
                ["100", "seats, zero oversell"],
                ["6", "verified invariants"],
              ].map(([stat, label]) => (
                <div key={label}>
                  <dt className="text-3xl font-semibold tracking-tight">{stat}</dt>
                  <dd className="mt-1 text-xs font-medium uppercase tracking-wide text-ink/55">{label}</dd>
                </div>
              ))}
            </dl>
          </div>
          <div className="rounded border border-line bg-white p-5 shadow-panel">
            <div className="grid gap-3">
              {HERO_HIGHLIGHTS.map(([title, body]) => (
                <div key={title} className="rounded border border-line bg-paper p-4">
                  <h2 className="font-semibold">{title}</h2>
                  <p className="mt-1 text-sm leading-6 text-ink/68">{body}</p>
                </div>
              ))}
            </div>
          </div>
        </div>
      </section>
      <SimulationPanel />
      <ArchitectureSection />
    </main>
  );
}
