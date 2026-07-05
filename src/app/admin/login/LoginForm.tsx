"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import { cn } from "@/lib/cn";
import { safeNextPath } from "@/lib/redirect";

export function LoginForm({ next }: { next?: string }) {
  const router = useRouter();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [pending, setPending] = useState(false);

  const onSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setPending(true);
    try {
      const res = await fetch("/api/admin/login", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email, password }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        setError(data.error ?? "Login failed");
        setPending(false);
        return;
      }
      // Partners always land in their own portal; the `next` param is
      // only honoured for admins (it may point at an /admin path a
      // partner isn't allowed to see anyway).
      const dest = data.role === "PARTNER" ? "/partner" : safeNextPath(next);
      router.push(dest);
      router.refresh();
    } catch {
      setError("Network error");
      setPending(false);
    }
  };

  return (
    <form onSubmit={onSubmit} className="space-y-s3">
      <Field label="Email">
        <input
          type="email"
          required
          value={email}
          autoComplete="email"
          onChange={(e) => setEmail(e.target.value)}
          className={inputClass}
        />
      </Field>

      <Field label="Password">
        <input
          type="password"
          required
          value={password}
          autoComplete="current-password"
          onChange={(e) => setPassword(e.target.value)}
          className={inputClass}
        />
      </Field>

      {error && (
        <p className="rounded-md border border-pink-500/40 bg-pink-500/10 px-3 py-2 text-[12px] font-bold text-pink-400">
          {error}
        </p>
      )}

      <button
        type="submit"
        disabled={pending}
        className={cn(
          "w-full rounded-full bg-pink-500 px-6 py-3 font-sans text-[14px] font-extrabold uppercase tracking-[0.12em] text-white",
          "transition-transform duration-fast ease-spring hover:-translate-y-0.5 active:translate-y-0.5",
          "shadow-[0_3px_0_var(--pink-600),0_10px_28px_-8px_hsl(330_80%_50%/0.45)]",
          "disabled:opacity-60",
        )}
      >
        {pending ? "Signing in…" : "Sign in"}
      </button>
    </form>
  );
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <label className="block">
      <span className="mb-1 block font-sans text-[11px] font-extrabold uppercase tracking-[0.16em] text-fg-light-soft">
        {label}
      </span>
      {children}
    </label>
  );
}

const inputClass = cn(
  "w-full rounded-md border-2 border-line-light bg-paper-2 px-4 py-2.5 text-fg-light",
  "transition-colors duration-fast focus:border-pink-400 focus:outline-none focus:ring-4 focus:ring-pink-400/20",
);
