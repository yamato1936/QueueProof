import Link from "next/link";
import { getQueueStore } from "@/lib/queueproof/store";

export const dynamic = "force-dynamic";

export default async function DashboardPage() {
  const drops = await getQueueStore().listDrops("merchant_demo");

  return (
    <main className="mx-auto max-w-6xl px-5 py-10">
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <p className="text-sm font-semibold uppercase tracking-wide text-clay">Merchant</p>
          <h1 className="mt-2 text-4xl font-semibold tracking-tight">Drop dashboard</h1>
        </div>
        <Link className="rounded bg-ink px-4 py-3 text-sm font-medium text-white hover:bg-steel" href="/drops/new">
          Create drop
        </Link>
      </div>

      <section className="mt-8 grid gap-4">
        {drops.length === 0 ? (
          <div className="rounded border border-line bg-white p-6 shadow-panel">
            <p className="text-ink/70">No drops yet. Create one to start testing reservations.</p>
          </div>
        ) : (
          drops.map((drop) => (
            <article key={drop.dropId} className="rounded border border-line bg-white p-5 shadow-panel">
              <div className="flex flex-wrap items-center justify-between gap-4">
                <div>
                  <h2 className="text-xl font-semibold">{drop.title}</h2>
                  <p className="mt-1 text-sm text-ink/60">
                    {drop.sku} · capacity {drop.capacity} · {drop.shardCount} shards
                  </p>
                </div>
                <div className="flex gap-2">
                  <Link className="rounded border border-line px-3 py-2 text-sm hover:border-steel" href={`/drops/${drop.dropId}`}>
                    Public page
                  </Link>
                  <Link className="rounded bg-ink px-3 py-2 text-sm text-white hover:bg-steel" href={`/proof/${drop.dropId}`}>
                    Proof
                  </Link>
                </div>
              </div>
            </article>
          ))
        )}
      </section>
    </main>
  );
}
