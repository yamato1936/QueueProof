export function StatusPill({ pass }: { pass: boolean }) {
  return (
    <span
      className={`inline-flex min-w-16 justify-center rounded px-2.5 py-1 text-xs font-semibold ${
        pass ? "bg-moss text-white" : "bg-clay text-white"
      }`}
    >
      {pass ? "PASS" : "FAIL"}
    </span>
  );
}
