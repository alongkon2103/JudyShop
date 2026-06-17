"use client";

import { useEffect } from "react";
import { useTranslations } from "next-intl";
import { AlertTriangle, RotateCcw, Home } from "lucide-react";
import { Container } from "@/components/ui/Container";
import { Button } from "@/components/ui/Button";

/**
 * Catches uncaught render-time errors inside the `[locale]` segment.
 *
 * Next.js wires `error.tsx` automatically — it gets the thrown error and
 * a `reset()` to retry rendering. We log to console so it shows up in
 * the browser DevTools tab during a demo, and surface the digest to the
 * customer so they can quote it to support.
 */
export default function ErrorBoundary({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  const t = useTranslations("errorPage");

  useEffect(() => {
    // Surface to console in dev; in prod this is where Sentry/etc. hooks in.
    console.error("[error boundary]", error);
  }, [error]);

  return (
    <section className="py-s5">
      <Container className="max-w-xl">
        <div className="sticker rounded-xl p-s5 text-center sm:p-s6">
          <span className="mx-auto mb-s3 grid h-16 w-16 place-items-center rounded-full bg-pink-500/15 text-pink-500">
            <AlertTriangle size={32} strokeWidth={2} />
          </span>
          <h1 className="font-display text-[32px] uppercase tracking-wide text-fg-light sm:text-[40px]">
            {t("title")}
          </h1>
          <p className="mt-2 text-[14px] text-fg-light-soft sm:text-[15px]">
            {t("subtitle")}
          </p>

          {error.digest && (
            <p className="mt-s3 inline-flex items-center gap-2 rounded-full border border-line-light bg-paper-2 px-3 py-1 font-mono text-[11px] text-fg-light-mute">
              <span className="uppercase tracking-[0.1em]">{t("errorIdLabel")}</span>
              <span className="text-fg-light">{error.digest}</span>
            </p>
          )}

          <div className="mt-s5 flex flex-wrap items-center justify-center gap-2">
            <Button onClick={() => reset()}>
              <RotateCcw size={14} strokeWidth={2.5} />
              {t("retry")}
            </Button>
            <Button href="/" variant="ghost">
              <Home size={14} strokeWidth={2.5} />
              {t("home")}
            </Button>
          </div>
        </div>
      </Container>
    </section>
  );
}
