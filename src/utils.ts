/**
 * Accepts either a full <iframe ...> snippet or a bare URL and returns the
 * playable src URL. Returns null if nothing usable is found.
 */
export function extractEmbedUrl(input: string): string | null {
  const text = input.trim();
  if (!text) return null;

  // Full iframe snippet: pull the src="..." attribute.
  const srcMatch = text.match(/src\s*=\s*["']([^"']+)["']/i);
  if (srcMatch) return normalizeUrl(srcMatch[1]);

  // Bare URL.
  if (/^https?:\/\//i.test(text)) return normalizeUrl(text);

  // Protocol-relative URL.
  if (/^\/\//.test(text)) return normalizeUrl("https:" + text);

  return null;
}

function normalizeUrl(url: string): string | null {
  try {
    const u = new URL(url);
    return u.toString();
  } catch {
    return null;
  }
}

/** Best-effort friendly title pulled from an iframe snippet, if present. */
export function extractTitle(input: string): string | null {
  const m = input.match(/title\s*=\s*["']([^"']+)["']/i);
  return m ? m[1] : null;
}

/** A short host label for display, e.g. "embed.st". */
export function hostOf(url: string): string {
  try {
    return new URL(url).host;
  } catch {
    return "unknown";
  }
}

/**
 * Decide how to play a source. Direct HLS playlists (or anything routed through
 * the local stream proxy) play natively in a <video>; everything else is an
 * embed page rendered in an iframe.
 */
export function classifySource(url: string): "hls" | "iframe" {
  if (/\.m3u8(\?|#|$)/i.test(url)) return "hls";
  if (/[?&]url=.+\.m3u8/i.test(url)) return "hls"; // proxied playlist
  if (url.startsWith("/stream-proxy")) return "hls";
  return "iframe";
}
