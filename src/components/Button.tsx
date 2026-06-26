import type { ButtonHTMLAttributes } from "react";

export function Button({ className = "", ...props }: ButtonHTMLAttributes<HTMLButtonElement>) {
  return (
    <button
      className={`inline-flex min-h-10 items-center justify-center rounded bg-ink px-4 py-2 text-sm font-medium text-white transition hover:bg-steel disabled:cursor-not-allowed disabled:opacity-50 ${className}`}
      {...props}
    />
  );
}
