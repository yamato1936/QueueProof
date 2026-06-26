import Link from "next/link";
import { notFound } from "next/navigation";
import { StatusPill } from "@/components/StatusPill";
import { getQueueStore } from "@/lib/queueproof/store";

export const dynamic = "force-dynamic";

export default async function ProofPage({ params }: { params: { dropId: string } }) {
  const store = getQueueStore();
  const drop = await store.getDrop(params.dropId);
  if (!drop) notFound();
  const proof = await store.generateProof(params.dropId);
  const rows = [
    ["Capacity invariant", proof.checks.capacityInvariant],
    ["No oversell", proof.checks.noOversell],
    ["No duplicate confirmed user", proof.checks.noDuplicateConfirmedUser],
    ["Waitlist order", proof.checks.waitlistOrder],
    ["Promotion order", proof.checks.promotionOrder],
    ["Hash chain valid", proof.checks.hashChainValid]
  ] as const;

  return (
    <main className="mx-auto max-w-5xl px-5 py-10">
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <p className="text-sm font-semibold uppercase tracking-wide text-clay">Public proof</p>
          <h1 className="mt-2 text-4xl font-semibold tracking-tight">{drop.title}</h1>
          <p className="mt-2 text-sm text-ink/60">Generated {new Date(proof.generatedAt).toLocaleString()}</p>
        </div>
        <Link className="rounded border border-line bg-white px-4 py-3 text-sm font-medium hover:border-steel" href={`/drops/${drop.dropId}`}>
          Back to drop
        </Link>
      </div>

      <section className="mt-8 overflow-hidden rounded border border-line bg-white shadow-panel">
        {rows.map(([label, pass]) => (
          <div key={label} className="flex items-center justify-between gap-4 border-b border-line px-5 py-4 last:border-b-0">
            <span className="font-medium">{label}</span>
            <StatusPill pass={pass} />
          </div>
        ))}
      </section>

      <section className="mt-6 grid gap-4 md:grid-cols-4">
        {[
          ["Events", proof.eventCount],
          ["Confirmed", proof.confirmedCount],
          ["Waitlisted", proof.waitlistedCount],
          ["Final confirmed", proof.finalConfirmedCount]
        ].map(([label, value]) => (
          <div key={label} className="rounded border border-line bg-white p-4 shadow-panel">
            <div className="text-xs font-semibold uppercase tracking-wide text-ink/55">{label}</div>
            <div className="mt-2 text-3xl font-semibold">{value}</div>
          </div>
        ))}
      </section>

      <section className="mt-6 rounded border border-line bg-ink p-5 text-white shadow-panel">
        <div className="text-xs font-semibold uppercase tracking-wide text-white/60">Final proof hash</div>
        <div className="mt-3 break-all font-mono text-sm">{proof.finalProofHash}</div>
      </section>
    </main>
  );
}
