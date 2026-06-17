/**
 * Client-side image resize / re-encode helper, used by every admin
 * upload form before the file goes anywhere near the server action.
 *
 * Why we do this in the browser:
 *   - Cloudflare / Next.js / mobile uploads occasionally fail in
 *     opaque ways on big PNGs with weird metadata chunks (Apple
 *     Preview, AI image generators, EXIF rich files). Rendering the
 *     image to a fresh <canvas> and re-encoding strips ALL of those
 *     chunks and produces a "clean" file even if we keep the same
 *     pixels.
 *   - 4k+ images from a phone or AI tool are wasted bandwidth for a
 *     web logo / banner / overlay. Bringing them down to ~1600px
 *     loses no perceivable quality at the sizes we actually display.
 *   - Smaller bodies = faster admin workflow on mobile connections,
 *     and they stay well under the server action body limit.
 *
 * Behaviour:
 *   - Below the size threshold? Return the file unchanged — no point
 *     paying a decode/encode cost for a small file.
 *   - Above threshold OR oversized dimensions? Render to canvas at
 *     <= maxSide px on the longest edge, then export as JPEG (or PNG
 *     when `preferJpeg` is false, e.g. gift overlays that need
 *     transparency).
 *   - If the re-encoded output is somehow >= 95% of the original
 *     size, keep the original — better to upload the file the user
 *     picked than something almost identical with a new filename.
 *
 * Errors during decode (corrupt file, unsupported format) return the
 * original file untouched and let the server-side validation catch
 * it as "image required" or similar.
 */

"use client";

export type ResizeOptions = {
  /** Skip work for files smaller than this (default 1.5 MB). */
  thresholdBytes?: number;
  /** Cap on the longest edge in pixels (default 1600). */
  maxSide?: number;
  /** JPEG quality 0–1 (default 0.85 — visually lossless on photos). */
  quality?: number;
  /** Output as JPEG (smaller). Set false for gift overlays that
   *  need transparency. */
  preferJpeg?: boolean;
};

export type ResizeResult = {
  file: File;
  changed: boolean;
  originalBytes: number;
  finalBytes: number;
};

const DEFAULT_THRESHOLD = 1.5 * 1024 * 1024;
const DEFAULT_MAX_SIDE  = 1600;
const DEFAULT_QUALITY   = 0.85;

export async function maybeShrinkImage(
  file: File,
  opts: ResizeOptions = {},
): Promise<ResizeResult> {
  const thresholdBytes = opts.thresholdBytes ?? DEFAULT_THRESHOLD;
  const maxSide        = opts.maxSide        ?? DEFAULT_MAX_SIDE;
  const quality        = opts.quality        ?? DEFAULT_QUALITY;
  const preferJpeg     = opts.preferJpeg     ?? true;

  const originalBytes = file.size;
  const unchanged: ResizeResult = {
    file,
    changed: false,
    originalBytes,
    finalBytes: originalBytes,
  };

  // Quick exit — file already small enough.
  if (file.size <= thresholdBytes) return unchanged;

  // Decode. If decoding fails (corrupt / unsupported) we bail.
  let img: HTMLImageElement;
  try {
    img = await loadImage(file);
  } catch {
    return unchanged;
  }

  // Compute target dimensions.
  const maxDim = Math.max(img.width, img.height);
  const scale  = maxDim > maxSide ? maxSide / maxDim : 1;
  const w      = Math.max(1, Math.round(img.width  * scale));
  const h      = Math.max(1, Math.round(img.height * scale));

  // Render to canvas — this is where metadata gets stripped.
  const canvas = document.createElement("canvas");
  canvas.width  = w;
  canvas.height = h;
  const ctx = canvas.getContext("2d");
  if (!ctx) return unchanged;
  // White background for JPEG output so transparency doesn't render
  // as black on flat-bg surfaces (announcement banners etc.).
  if (preferJpeg) {
    ctx.fillStyle = "#ffffff";
    ctx.fillRect(0, 0, w, h);
  }
  ctx.drawImage(img, 0, 0, w, h);

  const outMime = preferJpeg ? "image/jpeg" : "image/png";
  const blob = await new Promise<Blob | null>((resolve) => {
    canvas.toBlob(resolve, outMime, quality);
  });
  if (!blob || blob.size === 0) return unchanged;

  // Re-encode didn't actually save bytes — return original to avoid
  // uploading something almost identical with a new filename.
  if (blob.size >= file.size * 0.95) return unchanged;

  const baseName = file.name.replace(/\.[^.]+$/, "");
  const ext      = preferJpeg ? "jpg" : "png";
  const newFile  = new File([blob], `${baseName}-web.${ext}`, {
    type:         outMime,
    lastModified: file.lastModified,
  });

  return {
    file: newFile,
    changed: true,
    originalBytes,
    finalBytes: blob.size,
  };
}

function loadImage(file: File): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const url = URL.createObjectURL(file);
    const img = new Image();
    img.onload  = () => { URL.revokeObjectURL(url); resolve(img); };
    img.onerror = (e) => { URL.revokeObjectURL(url); reject(e); };
    img.src     = url;
  });
}

export function formatMB(bytes: number): string {
  return `${(bytes / 1024 / 1024).toFixed(2)} MB`;
}
