"use client";

import { useState } from "react";
import { Button } from "./Button";

export function JoinDropForm({ dropId }: { dropId: string }) {
  const [userId, setUserId] = useState("");
  const [result, setResult] = useState<Record<string, unknown> | null>(null);
  const [loading, setLoading] = useState(false);

  async function submit(action: "reserve" | "cancel") {
    setLoading(true);
    const response = await fetch(`/api/drops/${dropId}/${action}`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ userId })
    });
    const json = await response.json();
    setResult(json);
    setLoading(false);
  }

  return (
    <div className="rounded border border-line bg-white p-5 shadow-panel">
      <label className="text-sm font-medium" htmlFor="userId">
        Customer identifier
      </label>
      <input
        id="userId"
        value={userId}
        onChange={(event) => setUserId(event.target.value)}
        placeholder="customer@example.com"
        className="mt-2 w-full rounded border border-line bg-paper px-3 py-2 outline-none focus:border-steel"
      />
      <div className="mt-4 flex flex-wrap gap-2">
        <Button disabled={!userId || loading} onClick={() => submit("reserve")}>
          Join drop
        </Button>
        <Button className="bg-clay hover:bg-clay/80" disabled={!userId || loading} onClick={() => submit("cancel")}>
          Cancel
        </Button>
      </div>
      {result ? (
        <pre className="mt-4 max-h-72 overflow-auto rounded bg-ink p-3 text-xs text-white">
          {JSON.stringify(result, null, 2)}
        </pre>
      ) : null}
    </div>
  );
}
