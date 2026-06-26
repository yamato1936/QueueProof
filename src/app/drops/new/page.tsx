import { CreateDropForm } from "@/components/CreateDropForm";

export default function NewDropPage() {
  return (
    <main className="mx-auto max-w-3xl px-5 py-10">
      <p className="text-sm font-semibold uppercase tracking-wide text-clay">Create</p>
      <h1 className="mt-2 text-4xl font-semibold tracking-tight">New inventory drop</h1>
      <p className="mt-3 max-w-2xl text-sm leading-6 text-ink/70">
        Each drop creates metadata, write-sharded counters, and a creation ledger event in the single DynamoDB table.
      </p>
      <div className="mt-8">
        <CreateDropForm />
      </div>
    </main>
  );
}
