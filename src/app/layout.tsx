import type { Metadata } from "next";
import Link from "next/link";
import "./globals.css";

export const metadata: Metadata = {
  title: "QueueProof",
  description: "Verifiable drop infrastructure for limited inventory."
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body>
        <header className="border-b border-line bg-paper/85 backdrop-blur">
          <div className="mx-auto flex max-w-6xl items-center justify-between px-5 py-4">
            <Link href="/" className="text-lg font-semibold tracking-tight">
              QueueProof
            </Link>
            <nav className="flex items-center gap-2 text-sm">
              <Link className="rounded px-3 py-2 hover:bg-white" href="/dashboard">
                Dashboard
              </Link>
              <Link className="rounded bg-ink px-3 py-2 text-white hover:bg-steel" href="/drops/new">
                Create drop
              </Link>
            </nav>
          </div>
        </header>
        {children}
      </body>
    </html>
  );
}
