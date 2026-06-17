/**
 * Stream files out of `public/uploads/` via an explicit Route Handler.
 *
 * Why this exists:
 *   Next.js 14's production server only enumerates `public/` once at boot
 *   (and again at build-time). Files written into nested `public/uploads/`
 *   subdirectories *after* the process is running — i.e. anything an
 *   admin uploads through the panel on a long-lived `pm2`/`next start`
 *   deployment — are not picked up by the static file middleware and
 *   come back as 404. The image bytes are sitting on disk; Next just
 *   refuses to serve them.
 *
 * Solution: claim `/uploads/[...path]` as a regular route and read from
 * disk per-request. Route handlers always win over static files, so this
 * cleanly takes over the prefix without conflicting with anything that
 * happens to exist in `public/uploads/` at build time.
 *
 * Security: every incoming path is sanitised then resolved against the
 * canonical `LOCAL_PUBLIC_ROOT`. Requests that would land outside that
 * root (e.g. `../../etc/passwd`) get a 403 instead of leaking data.
 *
 * Caching: files are content-addressed (filenames include a timestamp +
 * random suffix from the upload helper), so we can confidently send a
 * 1-year `immutable` cache header. Cloudflare and browsers cache the
 * bytes and we never hit disk again on hot paths.
 */
import { NextResponse } from "next/server";
import { readFile, stat } from "node:fs/promises";
import path from "node:path";
import { LOCAL_PUBLIC_ROOT } from "@/lib/storage";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const MIME_TYPES: Record<string, string> = {
  ".jpg":  "image/jpeg",
  ".jpeg": "image/jpeg",
  ".png":  "image/png",
  ".webp": "image/webp",
  ".gif":  "image/gif",
  ".svg":  "image/svg+xml",
  ".avif": "image/avif",
  ".pdf":  "application/pdf",
  ".zip":  "application/zip",
  ".json": "application/json",
};

function notFound() {
  return new NextResponse("Not found", { status: 404 });
}

export async function GET(
  _req: Request,
  { params }: { params: { path: string[] } },
) {
  // Defensive filter: drop empty segments and traversal tokens before
  // we touch the filesystem.
  const segments = (params.path ?? []).filter(
    (s) => s && s !== "." && s !== "..",
  );
  if (segments.length === 0) return notFound();

  const requested = path.join(LOCAL_PUBLIC_ROOT, ...segments);
  const resolvedRequested = path.resolve(requested);
  const resolvedRoot = path.resolve(LOCAL_PUBLIC_ROOT);

  // Reject any path that escapes the uploads root after resolution
  // (defends against symlink + encoded `..` tricks).
  if (
    resolvedRequested !== resolvedRoot &&
    !resolvedRequested.startsWith(resolvedRoot + path.sep)
  ) {
    return new NextResponse("Forbidden", { status: 403 });
  }

  try {
    const st = await stat(resolvedRequested);
    if (!st.isFile()) return notFound();

    const buf = await readFile(resolvedRequested);
    const ext = path.extname(resolvedRequested).toLowerCase();
    const contentType = MIME_TYPES[ext] ?? "application/octet-stream";

    return new NextResponse(buf, {
      headers: {
        "content-type": contentType,
        "content-length": String(st.size),
        // Upload filenames include a timestamp + random suffix, so the
        // bytes at this URL never change. Tell every cache it can keep
        // them forever (browsers cap at 1 year anyway).
        "cache-control": "public, max-age=31536000, immutable",
      },
    });
  } catch {
    return notFound();
  }
}
