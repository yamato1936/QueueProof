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
  const checks = [
    ["Capacity invariant", "Confirmed seats never exceed declared capacity.", proof.checks.capacityInvariant],
    ["No oversell", "No reservation was granted beyond available stock.", proof.checks.noOversell],
    ["No duplicate confirmed user", "Each user holds at most one confirmed seat.", proof.checks.noDuplicateConfirmedUser],
    ["Waitlist order", "Waitlist ranks are monotonic and gap-free.", proof.checks.waitlistOrder],
    ["Promotion order", "Cancellations promote the earliest eligible waitlister.", proof.checks.promotionOrder],
    ["Hash chain valid", "The replayed ledger reproduces the recorded hash head.", proof.checks.hashChainValid],
  ] as const;

  const allPass = checks.every(([, , pass]) => pass);

  return (
    <main className="mx-auto max-w-5xl px-5 py-12">
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <p className="text-sm font-semibold uppercase tracking-wide text-clay">Public proof</p>
          <h1 className="mt-2 text-pretty text-4xl font-semibold tracking-tight">{drop.title}</h1>
          <p className="mt-2 text-sm text-ink/60">Generated {new Date(proof.generatedAt).toLocaleString()}</p>
        </div>
        <div className="flex items-center gap-3">
          <span className="text-xs font-semibold uppercase tracking-wide text-ink/55">Overall</span>
          <StatusPill pass={allPass} />
          <Link
            className="rounded border border-line bg-white px-4 py-3 text-sm font-medium transition hover:border-steel"
            href={`/drops/${drop.dropId}`}
          >
            Back to drop
          </Link>
        </div>
      </div>

      <section className="mt-8 grid gap-4 sm:grid-cols-2">
        {checks.map(([label, description, pass]) => (
          <div key={label} className="flex flex-col justify-between rounded border border-line bg-white p-5 shadow-panel">
            <div className="flex items-start justify-between gap-3">
              <h2 className="font-semibold tracking-tight">{label}</h2>
              <StatusPill pass={pass} />
            </div>
            <p className="mt-3 text-sm leading-6 text-ink/65">{description}</p>
          </div>
        ))}
      </section>

      <section className="mt-6 grid gap-4 md:grid-cols-4">
        {[
          ["Events", proof.eventCount],
          ["Confirmed", proof.confirmedCount],
          ["Waitlisted", proof.waitlistedCount],
          ["Final confirmed", proof.finalConfirmedCount],
        ].map(([label, value]) => (
          <div key={label} className="rounded border border-line bg-white p-4 shadow-panel">
            <div className="text-xs font-semibold uppercase tracking-wide text-ink/55">{label}</div>
            <div className="mt-2 text-3xl font-semibold">{value}</div>
          </div>
        ))}
      </section>

      <section className="mt-6 rounded border border-line bg-ink p-6 text-white shadow-panel">
        <div className="flex items-center justify-between gap-3">
          <div className="text-xs font-semibold uppercase tracking-wide text-white/60">Final proof hash</div>
          <span className="font-mono text-xs text-white/45">SHA-256 hash chain</span>
        </div>
        <div className="mt-3 break-all font-mono text-sm text-white/90">{proof.finalProofHash}</div>
      </section>
    </main>
  );
}
