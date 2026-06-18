/**
 * Storage facade — picks between local filesystem and Supabase Storage.
 *
 * Driver selection (highest priority first):
 *   1. STORAGE_DRIVER env var ("local" | "supabase")
 *   2. Auto: prefer Supabase if configured, else local
 *
 * Local driver writes to `public/uploads/<path>` and serves files via
 * Next.js's public directory — great for dev and self-hosted deploys.
 * (Won't work on serverless/Vercel — the filesystem is read-only at runtime.)
 *
 * Supabase driver uploads via the JS client using the service-role key.
 * Requires NEXT_PUBLIC_SUPABASE_URL + SUPABASE_SERVICE_ROLE_KEY and a
 * Public bucket named `product-assets`.
 */
import { createClient, type SupabaseClient } from "@supabase/supabase-js";
import { mkdir, writeFile, unlink } from "node:fs/promises";
import path from "node:path";
import { isWhitelistedImageHeader, sniffImageMime } from "./upload-constraints";

export const STORAGE_BUCKET = "product-assets";
export const LOCAL_PUBLIC_ROOT = path.join(process.cwd(), "public", "uploads");

export type UploadOk = {
  ok: true;
  url: string;
  path: string;
  size: number;
  mimeType: string;
  driver: "local" | "supabase";
};
export type UploadErr = { ok: false; error: string };
export type UploadResult = UploadOk | UploadErr;

// ── Driver selection ─────────────────────────────────────────

export function isSupabaseConfigured(): boolean {
  return Boolean(
    process.env.NEXT_PUBLIC_SUPABASE_URL && process.env.SUPABASE_SERVICE_ROLE_KEY,
  );
}

export function getActiveDriver(): "local" | "supabase" {
  const envDriver = (process.env.STORAGE_DRIVER ?? "").toLowerCase();
  if (envDriver === "local") return "local";
  if (envDriver === "supabase") return "supabase";
  return isSupabaseConfigured() ? "supabase" : "local";
}

/** Always returns true now — local is the universal fallback. */
export function isStorageConfigured(): boolean {
  return true;
}

// ── Public API ───────────────────────────────────────────────

export async function uploadFile(opts: {
  path: string;
  file: File;
  upsert?: boolean;
  /**
   * When set, the file's first 12 bytes MUST match a real image
   * header (PNG/JPEG/GIF/WebP). The caller's claimed `file.type` is
   * untrusted — this stops `curl -F file=@evil.html;type=image/png`
   * from sneaking an XSS payload into our image folder.
   */
  requireImageMagicBytes?: boolean;
}): Promise<UploadResult> {
  if (opts.requireImageMagicBytes) {
    const head = new Uint8Array(await opts.file.slice(0, 12).arrayBuffer());
    if (!isWhitelistedImageHeader(head)) {
      const detected = sniffImageMime(head);
      return {
        ok: false,
        error: detected
          ? `File header says "${detected}" which isn't on our whitelist.`
          : "File doesn't look like an image (header bytes don't match JPEG/PNG/GIF/WebP).",
      };
    }
  }

  const driver = getActiveDriver();
  return driver === "supabase" ? uploadSupabase(opts) : uploadLocal(opts);
}

export async function deleteFileByPublicUrl(publicUrl: string): Promise<void> {
  if (publicUrl.startsWith("/uploads/")) {
    await deleteLocal(publicUrl);
    return;
  }
  await deleteSupabaseByPublicUrl(publicUrl);
}

// ── Local driver ─────────────────────────────────────────────

async function uploadLocal(opts: { path: string; file: File }): Promise<UploadResult> {
  try {
    const relPath = sanitisePath(opts.path);
    const fullPath = path.join(LOCAL_PUBLIC_ROOT, relPath);
    await mkdir(path.dirname(fullPath), { recursive: true });
    const buffer = Buffer.from(await opts.file.arrayBuffer());
    await writeFile(fullPath, buffer);
    return {
      ok: true,
      url: `/uploads/${relPath}`,
      path: relPath,
      size: opts.file.size,
      mimeType: opts.file.type || "application/octet-stream",
      driver: "local",
    };
  } catch (e) {
    return { ok: false, error: e instanceof Error ? e.message : "local write failed" };
  }
}

async function deleteLocal(publicUrl: string): Promise<void> {
  try {
    const relPath = sanitisePath(publicUrl.replace(/^\/uploads\//, ""));
    const fullPath = path.join(LOCAL_PUBLIC_ROOT, relPath);
    await unlink(fullPath);
  } catch {
    /* best-effort */
  }
}

/** Defensive: strip any `..` segments and leading slashes. */
function sanitisePath(p: string): string {
  return p
    .split("/")
    .filter((seg) => seg && seg !== "." && seg !== "..")
    .join("/");
}

// ── Supabase driver ──────────────────────────────────────────

let supabase: SupabaseClient | null = null;
function getSupabase(): SupabaseClient | null {
  if (supabase) return supabase;
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !key) return null;
  supabase = createClient(url, key, { auth: { persistSession: false } });
  return supabase;
}

async function uploadSupabase(opts: {
  path: string;
  file: File;
  upsert?: boolean;
}): Promise<UploadResult> {
  const client = getSupabase();
  if (!client) {
    return { ok: false, error: "Supabase Storage not configured." };
  }
  const { path: filePath, file, upsert = false } = opts;
  const { data, error } = await client.storage
    .from(STORAGE_BUCKET)
    .upload(filePath, file, {
      upsert,
      contentType: file.type || "application/octet-stream",
      cacheControl: "31536000",
    });
  if (error) return { ok: false, error: error.message };

  const { data: pub } = client.storage.from(STORAGE_BUCKET).getPublicUrl(data.path);
  return {
    ok: true,
    url: pub.publicUrl,
    path: data.path,
    size: file.size,
    mimeType: file.type || "application/octet-stream",
    driver: "supabase",
  };
}

async function deleteSupabaseByPublicUrl(publicUrl: string): Promise<void> {
  const client = getSupabase();
  if (!client) return;
  const marker = `/storage/v1/object/public/${STORAGE_BUCKET}/`;
  const idx = publicUrl.indexOf(marker);
  if (idx === -1) return;
  const filePath = publicUrl.slice(idx + marker.length);
  await client.storage.from(STORAGE_BUCKET).remove([filePath]).catch(() => {});
}
