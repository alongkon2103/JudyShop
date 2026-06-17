"use client";

import { useEffect, useRef, useState } from "react";
import { useTranslations } from "next-intl";
import { CheckCircle2, AlertTriangle, Loader2 } from "lucide-react";
import { lookupUsername, type LookupErrorCode } from "@/lib/actions/roblox";
import { isPlausibleUsername } from "@/lib/roblox";
import { cn } from "@/lib/cn";

type State =
  | { kind: "idle" }
  | { kind: "loading" }
  | { kind: "found"; canonical: string; displayName: string; avatarUrl: string | null }
  | { kind: "missing"; code: LookupErrorCode | "invalid_format"; retryAfterSec?: number };

type Props = {
  username: string;
  /** Called whenever the lookup completes — parent may use this to gate
   *  the Pay button when we know the username is definitely wrong. */
  onResolved?: (state: { found: boolean; canonical?: string }) => void;
};

/**
 * Inline preview under the username input — calls Roblox's public API
 * (via a server action) to confirm the account exists and show the
 * avatar so the customer can verify they typed it right BEFORE paying.
 *
 * Debounced 450ms so we don't hammer Roblox while someone is still typing.
 */
export function RobloxPreview({ username, onResolved }: Props) {
  const t = useTranslations("product");
  const [state, setState] = useState<State>({ kind: "idle" });
  const reqId = useRef(0);

  useEffect(() => {
    const trimmed = username.trim();
    if (!trimmed) {
      setState({ kind: "idle" });
      onResolved?.({ found: false });
      return;
    }
    if (!isPlausibleUsername(trimmed)) {
      setState({ kind: "missing", code: "invalid_format" });
      onResolved?.({ found: false });
      return;
    }

    setState({ kind: "loading" });
    const myId = ++reqId.current;
    const timer = window.setTimeout(async () => {
      try {
        const res = await lookupUsername({ username: trimmed });
        // Discard if a newer keystroke has already overtaken us.
        if (myId !== reqId.current) return;
        if (res.ok) {
          setState({
            kind: "found",
            canonical: res.user.username,
            displayName: res.user.displayName,
            avatarUrl: res.user.avatarUrl,
          });
          onResolved?.({ found: true, canonical: res.user.username });
        } else {
          setState({ kind: "missing", code: res.code, retryAfterSec: res.retryAfterSec });
          onResolved?.({ found: false });
        }
      } catch {
        if (myId !== reqId.current) return;
        setState({ kind: "missing", code: "network" });
        onResolved?.({ found: false });
      }
    }, 450);

    return () => window.clearTimeout(timer);
  }, [username, onResolved]);

  if (state.kind === "idle") return null;

  if (state.kind === "loading") {
    return (
      <div className="flex items-center gap-2 rounded-lg border border-line-light bg-paper-2 px-3 py-2 text-[12px] text-fg-light-soft">
        <Loader2 size={14} className="animate-spin text-pink-500" />
        <span>{t("rbxChecking")}</span>
      </div>
    );
  }

  if (state.kind === "missing") {
    const message =
      state.code === "invalid_format" || state.code === "invalid"
        ? t("rbxInvalidFormat")
      : state.code === "not_found"
        ? t("rbxNotFound")
      : state.code === "ip_rate_limited"
        ? t("trialErrIpRateLimited", { seconds: state.retryAfterSec ?? 30 })
        : t("rbxNetwork");
    return (
      <div className="flex items-start gap-2 rounded-lg border border-pink-500/40 bg-pink-500/5 px-3 py-2 text-[12px] text-pink-500">
        <AlertTriangle size={14} className="mt-0.5 shrink-0" strokeWidth={2.5} />
        <div className="space-y-0.5">
          <p className="font-bold">{message}</p>
          <p className="text-pink-500/80">{t("rbxConfirmHint")}</p>
        </div>
      </div>
    );
  }

  // found
  return (
    <div className="flex items-center gap-3 rounded-lg border border-[hsl(150_55%_45%/0.4)] bg-[hsl(150_55%_45%/0.08)] px-3 py-2">
      {state.avatarUrl ? (
        // eslint-disable-next-line @next/next/no-img-element
        <img
          src={state.avatarUrl}
          alt=""
          width={40}
          height={40}
          loading="lazy"
          decoding="async"
          className="h-10 w-10 rounded-full border border-line-light bg-paper-2 object-cover"
        />
      ) : (
        <div className="grid h-10 w-10 place-items-center rounded-full border border-line-light bg-paper-2 text-fg-light-mute">
          <CheckCircle2 size={18} />
        </div>
      )}
      <div className="min-w-0 flex-1">
        <p className="truncate text-[13px] font-bold text-fg-light">
          {state.displayName}
        </p>
        <p className="truncate font-mono text-[11px] text-fg-light-soft">
          @{state.canonical}
        </p>
      </div>
      <CheckCircle2
        size={18}
        strokeWidth={2.5}
        className={cn("shrink-0 text-[hsl(150_55%_38%)]")}
      />
    </div>
  );
}
