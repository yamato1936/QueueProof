import Link from "next/link";
import { notFound } from "next/navigation";
import { JoinDropForm } from "@/components/JoinDropForm";
import { getQueueStore } from "@/lib/queueproof/store";

export const dynamic = "force-dynamic";

export default async function DropPage({ params }: { params: { dropId: string } }) {
  const drop = await getQueueStore().getDrop(params.dropId);
  if (!drop) notFound();

  return (
    <main className="mx-auto grid max-w-6xl gap-8 px-5 py-10 md:grid-cols-[1fr_380px]">
      <section>
        <p className="text-sm font-semibold uppercase tracking-wide text-clay">Public drop</p>
        <h1 className="mt-2 text-5xl font-semibold tracking-tight">{drop.title}</h1>
        <div className="mt-6 grid gap-3 sm:grid-cols-3">
          {[
            ["SKU", drop.sku],
            ["Capacity", drop.capacity],
            ["Counter shards", drop.shardCount]
          ].map(([label, value]) => (
            <div key={label} className="rounded border border-line bg-white p-4 shadow-panel">
              <div className="text-xs font-semibold uppercase tracking-wide text-ink/55">{label}</div>
              <div className="mt-2 text-2xl font-semibold">{value}</div>
            </div>
          ))}
        </div>
        <div className="mt-8 rounded border border-line bg-white p-5 shadow-panel">
          <h2 className="text-xl font-semibold">Correctness model</h2>
          <p className="mt-3 text-sm leading-6 text-ink/70">
            Reservations write an idempotency record, user reservation, shard counter update, and raw ledger event in one transaction.
            Proof generation is intentionally outside the reservation critical path.
          </p>
          <Link className="mt-5 inline-flex rounded bg-ink px-4 py-3 text-sm font-medium text-white hover:bg-steel" href={`/proof/${drop.dropId}`}>
            View proof page
          </Link>
        </div>
      </section>
      <aside>
        <JoinDropForm dropId={drop.dropId} />
      </aside>
    </main>
  );
}
