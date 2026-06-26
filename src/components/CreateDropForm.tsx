"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import { Button } from "./Button";

export function CreateDropForm() {
  const router = useRouter();
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  async function submit(formData: FormData) {
    setLoading(true);
    setError(null);
    const response = await fetch("/api/drops", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify(Object.fromEntries(formData))
    });
    const json = await response.json();
    setLoading(false);
    if (!response.ok) {
      setError(json.error ?? "Could not create drop.");
      return;
    }
    router.push(`/drops/${json.dropId}`);
  }

  return (
    <form action={submit} className="grid gap-4 rounded border border-line bg-white p-6 shadow-panel">
      <div>
        <label className="text-sm font-medium" htmlFor="title">
          Drop title
        </label>
        <input id="title" name="title" required defaultValue="Founders Edition Console" className="mt-2 w-full rounded border border-line bg-paper px-3 py-2" />
      </div>
      <div className="grid gap-4 sm:grid-cols-3">
        <div>
          <label className="text-sm font-medium" htmlFor="sku">
            SKU
          </label>
          <input id="sku" name="sku" required defaultValue="FE-100" className="mt-2 w-full rounded border border-line bg-paper px-3 py-2" />
        </div>
        <div>
          <label className="text-sm font-medium" htmlFor="capacity">
            Capacity
          </label>
          <input id="capacity" name="capacity" type="number" min="1" required defaultValue="100" className="mt-2 w-full rounded border border-line bg-paper px-3 py-2" />
        </div>
        <div>
          <label className="text-sm font-medium" htmlFor="shardCount">
            Shards
          </label>
          <input id="shardCount" name="shardCount" type="number" min="1" max="32" defaultValue="10" className="mt-2 w-full rounded border border-line bg-paper px-3 py-2" />
        </div>
      </div>
      {error ? <p className="text-sm text-clay">{error}</p> : null}
      <Button disabled={loading}>{loading ? "Creating..." : "Create drop"}</Button>
    </form>
  );
}
