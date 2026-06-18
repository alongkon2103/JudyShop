/**
 * Single source of truth for "what images are we willing to accept"
 * across every admin upload form (announcements, news, product images,
 * gift overlays).
 *
 * Keeping the whitelist + size limit here means a tightening (say,
 * dropping GIF or bumping the size cap) edits one file instead of
 * every form + server action. Each form imports `IMAGE_TYPES` for the
 * `<input accept=…>` attribute and helper text; each server action
 * imports `validateImage` for the server-side guard.
 *
 * MIME whitelist (not `startsWith("image/")`) so users can't sneak in
 * HEIC / TIFF / SVG (the last has its own XSS surface). These four
 * cover what every modern browser can actually render natively.
 */

export const IMAGE_TYPES = {
  /** Value for `<input accept>`. Lists extensions AND MIMEs so older
   *  Windows file dialogs (which often go by extension) play nice. */
  accept: ".jpg,.jpeg,.png,.webp,.gif,image/jpeg,image/png,image/webp,image/gif",
  /** Server-side MIME whitelist. */
  mimes: ["image/jpeg", "image/png", "image/webp", "image/gif"] as const,
  /** Human-readable list for helper text. */
  label: "JPG, PNG, WebP, GIF",
} as const;

export const MAX_IMAGE_BYTES = 20 * 1024 * 1024; // 20 MB
export const MAX_IMAGE_LABEL = "20 MB";

/** One-line hint shown under every image picker. */
export const IMAGE_HELP_TEXT = `${IMAGE_TYPES.label} · สูงสุด ${MAX_IMAGE_LABEL}`;

export type ValidateResult = { ok: true } | { ok: false; error: string };

function fmtSizeMB(bytes: number): string {
  return `${(bytes / 1024 / 1024).toFixed(1)} MB`;
}

/** Run the same check on both client (pre-flight, fast feedback) and
 *  server (guard against curl / scripted uploads). */
export function validateImage(file: File): ValidateResult {
  if (!file || file.size === 0) {
    return { ok: false, error: "ไฟล์ว่าง — กรุณาเลือกไฟล์ใหม่" };
  }
  if (file.size > MAX_IMAGE_BYTES) {
    return {
      ok: false,
      error: `ไฟล์ใหญ่เกินไป (${fmtSizeMB(file.size)}) — สูงสุด ${MAX_IMAGE_LABEL}`,
    };
  }
  // `as readonly string[]` so the include check accepts arbitrary strings
  // (file.type is `string`, not the narrowed union).
  if (!(IMAGE_TYPES.mimes as readonly string[]).includes(file.type)) {
    return {
      ok: false,
      error: `ไฟล์ประเภท "${file.type || "unknown"}" ไม่รองรับ — ใช้ ${IMAGE_TYPES.label} เท่านั้น`,
    };
  }
  return { ok: true };
}

/**
 * Magic-byte sniff. The Content-Type a client claims on `file.type` is
 * cheap to spoof (any `curl -F file=@x.html;type=image/png` defeats
 * the basic MIME check). Real images have distinctive header bytes
 * that we verify server-side BEFORE the bytes hit disk.
 *
 * Returns the detected MIME on match, null when nothing recognised.
 * Pass the first 12 bytes (read with `buf.slice(0, 12)`).
 */
export function sniffImageMime(buf: Uint8Array): string | null {
  // JPEG: FF D8 FF
  if (buf.length >= 3 && buf[0] === 0xff && buf[1] === 0xd8 && buf[2] === 0xff) {
    return "image/jpeg";
  }
  // PNG: 89 50 4E 47 0D 0A 1A 0A
  if (
    buf.length >= 8 &&
    buf[0] === 0x89 && buf[1] === 0x50 && buf[2] === 0x4e && buf[3] === 0x47 &&
    buf[4] === 0x0d && buf[5] === 0x0a && buf[6] === 0x1a && buf[7] === 0x0a
  ) {
    return "image/png";
  }
  // GIF: 47 49 46 38 (37|39) 61
  if (
    buf.length >= 6 &&
    buf[0] === 0x47 && buf[1] === 0x49 && buf[2] === 0x46 && buf[3] === 0x38 &&
    (buf[4] === 0x37 || buf[4] === 0x39) && buf[5] === 0x61
  ) {
    return "image/gif";
  }
  // WebP: RIFF....WEBP
  if (
    buf.length >= 12 &&
    buf[0] === 0x52 && buf[1] === 0x49 && buf[2] === 0x46 && buf[3] === 0x46 &&
    buf[8] === 0x57 && buf[9] === 0x45 && buf[10] === 0x42 && buf[11] === 0x50
  ) {
    return "image/webp";
  }
  return null;
}

/** Returns true when this buffer's magic bytes match a whitelisted image MIME. */
export function isWhitelistedImageHeader(buf: Uint8Array): boolean {
  const detected = sniffImageMime(buf);
  return detected !== null && (IMAGE_TYPES.mimes as readonly string[]).includes(detected);
}
