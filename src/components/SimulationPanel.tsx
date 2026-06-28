"use client";

import { useState } from "react";
import { Button } from "./Button";
import { StatusPill } from "./StatusPill";
import type { SimulationResult } from "@/lib/queueproof/types";

const PRIMARY_METRICS = [
  { label: "confirmed", fallback: 100, tone: "moss" as const },
  { label: "waitlisted", fallback: 900, tone: "steel" as const },
  { label: "oversell", fallback: 0, tone: "clay" as const },
  { label: "duplicateAccepted", fallback: 0, tone: "clay" as const },
];

function metricValue(result: SimulationResult | null, label: string, fallback: number) {
  if (!result) return fallback;
  return result[label as keyof SimulationResult] as number;
}

export function SimulationPanel() {
  const [result, setResult] = useState<SimulationResult | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function run() {
    setLoading(true);
    setError(null);
    try {
      const response = await fetch("/api/simulate", { method: "POST" });
      const json = await response.json();
      if (!response.ok) throw new Error(json.error ?? "Simulation failed.");
      setResult(json);
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "Simulation failed.");
    } finally {
      setLoading(false);
    }
  }

  return (
    <section className="border-y border-line bg-white/65">
      <div className="mx-auto grid max-w-6xl gap-8 px-5 py-14 md:grid-cols-[0.85fr_1.15fr]">
        <div>
          <p className="text-sm font-semibold uppercase tracking-wide text-clay">Concurrency simulation</p>
          <h2 className="mt-2 text-pretty text-3xl font-semibold tracking-tight">
            1,000 requests, 100 seats, zero oversell
          </h2>
          <p className="mt-3 max-w-xl text-sm leading-6 text-ink/70">
            The simulation runs against the same service boundary as production logic and returns the invariant
            summary alongside a replayable proof hash.
          </p>
          <Button className="mt-5" onClick={run} disabled={loading}>
            {loading ? "Running..." : "Run simulation"}
          </Button>
          {error ? <p className="mt-3 text-sm text-clay">{error}</p> : null}

          {result ? (
            <div className="mt-6 grid gap-3 rounded border border-line bg-paper p-4">
              <div className="flex items-center justify-between gap-3">
                <span className="text-xs font-semibold uppercase tracking-wide text-ink/55">Proof replay</span>
                <StatusPill pass={result.proofReplayStatus === "PASS"} />
              </div>
              <dl className="grid grid-cols-2 gap-3 text-sm">
                <div>
                  <dt className="text-xs font-medium uppercase tracking-wide text-ink/50">Ledger events</dt>
                  <dd className="mt-1 font-semibold">{result.totalLedgerEvents}</dd>
                </div>
                <div>
                  <dt className="text-xs font-medium uppercase tracking-wide text-ink/50">Items written</dt>
                  <dd className="mt-1 font-semibold">{result.totalDynamoDBItemsWritten}</dd>
                </div>
              </dl>
            </div>
          ) : null}
        </div>
        <div className="grid gap-3 sm:grid-cols-2">
          {PRIMARY_METRICS.map(({ label, fallback, tone }) => (
            <div key={label} className="rounded border border-line bg-paper p-4 shadow-panel">
              <div className="flex items-center gap-2">
                <span
                  aria-hidden
                  className={`inline-block h-1.5 w-1.5 rounded-full ${
                    tone === "moss" ? "bg-moss" : tone === "steel" ? "bg-steel" : "bg-clay"
                  }`}
                />
                <span className="text-xs font-semibold uppercase tracking-wide text-ink/55">{label}</span>
              </div>
              <div className="mt-2 text-3xl font-semibold">{metricValue(result, label, fallback)}</div>
            </div>
          ))}
          <div className="rounded border border-line bg-ink p-4 text-white shadow-panel sm:col-span-2">
            <div className="text-xs font-semibold uppercase tracking-wide text-white/60">Final proof hash</div>
            <div className="mt-2 break-all font-mono text-xs text-white/90">
              {result?.finalProofHash ?? "Run the simulation to compute proof."}
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}
