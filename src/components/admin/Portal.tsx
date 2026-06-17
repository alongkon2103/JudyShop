"use client";

import { useEffect, useState } from "react";
import { createPortal } from "react-dom";

/**
 * Render children into `document.body` so that `position: fixed`
 * descendants are anchored to the viewport, not whatever ancestor
 * happens to create a containing block above them.
 *
 * Why we need this:
 *   Per CSS spec §11.1, any element with `transform`, `filter`,
 *   `perspective`, or `will-change: transform` becomes a containing
 *   block for any `position: fixed` descendants. AdminShell's
 *   `<main className="anim-fade-up">` keeps a `transform` after the
 *   page-load animation finishes (CSS `forwards` fill mode), so a
 *   `fixed inset-0` modal rendered inside the page tree gets pinned
 *   to <main> instead of the viewport — visible as the modal
 *   "sticking" to wherever the user scrolled when they opened it.
 *
 * Using a portal teleports the modal DOM out to <body>, escaping the
 * containing block entirely. React still owns the modal's state and
 * events — only the DOM placement changes.
 *
 * SSR-safe: renders nothing on the server (and on the first client
 * paint pre-hydration) so the markup matches between server and
 * client. `document.body` is only referenced after mount.
 */
export function Portal({ children }: { children: React.ReactNode }) {
  const [mounted, setMounted] = useState(false);
  useEffect(() => {
    setMounted(true);
  }, []);
  if (!mounted) return null;
  return createPortal(children, document.body);
}
