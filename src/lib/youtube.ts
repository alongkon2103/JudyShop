/**
 * YouTube URL → 11-char video id.
 *
 * Accepts every common shape an admin might paste:
 *   - https://www.youtube.com/watch?v=dQw4w9WgXcQ
 *   - https://youtu.be/dQw4w9WgXcQ
 *   - https://www.youtube.com/shorts/dQw4w9WgXcQ
 *   - https://www.youtube.com/embed/dQw4w9WgXcQ
 *   - https://m.youtube.com/watch?v=dQw4w9WgXcQ
 *
 * Returns null when nothing recognised — the caller is expected to
 * surface that as a friendly validation error.
 *
 * YouTube video ids are exactly 11 chars from [A-Za-z0-9_-], so we
 * post-validate against that pattern to reject garbage even when the
 * URL "looks" like a YouTube link.
 */
const VIDEO_ID = /^[A-Za-z0-9_-]{11}$/;

export function extractYouTubeId(input: string): string | null {
  const raw = (input ?? "").trim();
  if (!raw) return null;

  let u: URL;
  try {
    u = new URL(raw);
  } catch {
    // Bare id pasted on its own ("dQw4w9WgXcQ") — handle it.
    return VIDEO_ID.test(raw) ? raw : null;
  }

  const host = u.hostname.replace(/^www\./, "").replace(/^m\./, "");

  // youtu.be/<id>
  if (host === "youtu.be") {
    const id = u.pathname.replace(/^\//, "").split("/")[0];
    return id && VIDEO_ID.test(id) ? id : null;
  }

  // youtube.com/* + youtube-nocookie.com/*
  if (host === "youtube.com" || host === "youtube-nocookie.com") {
    // /watch?v=…
    const v = u.searchParams.get("v");
    if (v && VIDEO_ID.test(v)) return v;

    // /embed/<id>, /shorts/<id>, /v/<id>
    const parts = u.pathname.split("/").filter(Boolean);
    if (parts.length >= 2 && ["embed", "shorts", "v"].includes(parts[0]!)) {
      const id = parts[1]!;
      if (VIDEO_ID.test(id)) return id;
    }
  }

  return null;
}

/** Build the privacy-friendly embed URL we render in the iframe. */
export function youtubeEmbedUrl(videoId: string): string {
  // youtube-nocookie.com avoids the tracking cookie until playback,
  // matching the "Privacy-Enhanced Mode" YouTube docs recommend.
  return `https://www.youtube-nocookie.com/embed/${videoId}`;
}
