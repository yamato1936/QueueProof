"use client";

import { useState } from "react";
import { Button } from "./Button";
import type { SimulationResult } from "@/lib/queueproof/types";

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
      <div className="mx-auto grid max-w-6xl gap-6 px-5 py-10 md:grid-cols-[1fr_1.2fr]">
        <div>
          <p className="text-sm font-semibold uppercase tracking-wide text-clay">Concurrency simulation</p>
          <h2 className="mt-2 text-3xl font-semibold tracking-tight">1,000 requests, 100 seats, zero oversell</h2>
          <p className="mt-3 max-w-xl text-sm leading-6 text-ink/70">
            The simulation runs against the same service boundary as production logic and returns the invariant summary.
          </p>
          <Button className="mt-5" onClick={run} disabled={loading}>
            {loading ? "Running..." : "Run simulation"}
          </Button>
          {error ? <p className="mt-3 text-sm text-clay">{error}</p> : null}
        </div>
        <div className="grid gap-3 sm:grid-cols-2">
          {[
            ["confirmed", result?.confirmed ?? 100],
            ["waitlisted", result?.waitlisted ?? 900],
            ["oversell", result?.oversell ?? 0],
            ["duplicateAccepted", result?.duplicateAccepted ?? 0]
          ].map(([label, value]) => (
            <div key={label} className="rounded border border-line bg-paper p-4 shadow-panel">
              <div className="text-xs font-semibold uppercase tracking-wide text-ink/55">{label}</div>
              <div className="mt-2 text-3xl font-semibold">{value}</div>
            </div>
          ))}
          <div className="rounded border border-line bg-paper p-4 shadow-panel sm:col-span-2">
            <div className="text-xs font-semibold uppercase tracking-wide text-ink/55">Final proof hash</div>
            <div className="mt-2 break-all font-mono text-xs">{result?.finalProofHash ?? "Run the simulation to compute proof."}</div>
          </div>
        </div>
      </div>
    </section>
  );
}
