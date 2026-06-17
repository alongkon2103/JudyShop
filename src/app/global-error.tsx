"use client";

/**
 * Last-resort error boundary. Catches errors thrown in the root layout
 * itself (where the locale-scoped <NextIntlClientProvider> hasn't run
 * yet, so no `useTranslations`). Must include `<html>` + `<body>`.
 *
 * Kept ASCII-only on purpose so it can't fail because a font hasn't
 * loaded yet.
 */
export default function GlobalError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  return (
    <html lang="th">
      <body
        style={{
          margin: 0,
          minHeight: "100vh",
          display: "grid",
          placeItems: "center",
          background: "#0a0612",
          color: "#f3f0fa",
          fontFamily: "system-ui, sans-serif",
        }}
      >
        <main style={{ maxWidth: 480, padding: "2rem", textAlign: "center" }}>
          <h1 style={{ fontSize: 28, margin: 0 }}>Whoops!</h1>
          <p style={{ color: "#b3a9c8", marginTop: 8 }}>
            Something went wrong. Try again in a moment.
          </p>
          {error.digest && (
            <p style={{ marginTop: 12, fontFamily: "monospace", fontSize: 11, color: "#7a6e92" }}>
              Error ID: {error.digest}
            </p>
          )}
          <button
            onClick={() => reset()}
            style={{
              marginTop: 24,
              padding: "10px 24px",
              borderRadius: 999,
              border: "none",
              background: "#ec4899",
              color: "white",
              fontWeight: 800,
              cursor: "pointer",
            }}
          >
            Try again
          </button>
        </main>
      </body>
    </html>
  );
}
