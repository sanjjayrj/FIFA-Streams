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

/** Compact time-until string, e.g. "2d 4h", "3h 12m", "8m 5s", "42s". */
export function formatCountdown(ms: number): string {
  if (ms <= 0) return "now";
  const s = Math.floor(ms / 1000);
  const d = Math.floor(s / 86400);
  const h = Math.floor((s % 86400) / 3600);
  const m = Math.floor((s % 3600) / 60);
  const sec = s % 60;
  if (d > 0) return `${d}d ${h}h`;
  if (h > 0) return `${h}h ${m}m`;
  if (m > 0) return `${m}m ${sec}s`;
  return `${sec}s`;
}

/** Ticking clock, e.g. "4:23:11" (or "2d 4:23:11" past a day). For the hero. */
export function formatClock(ms: number): string {
  if (ms <= 0) return "0:00:00";
  const s = Math.floor(ms / 1000);
  const d = Math.floor(s / 86400);
  const h = Math.floor((s % 86400) / 3600);
  const m = Math.floor((s % 3600) / 60);
  const sec = s % 60;
  const hms = `${h}:${String(m).padStart(2, "0")}:${String(sec).padStart(2, "0")}`;
  return d > 0 ? `${d}d ${hms}` : hms;
}

/**
 * Decide how to play a source. Direct HLS playlists (or anything routed through
 * the local stream proxy) play natively in a <video>; everything else is an
 * embed page rendered in an iframe.
 */
export function classifySource(url: string): "hls" | "iframe" {
  if (/\.m3u8(\?|#|$)/i.test(url)) return "hls";
  if (/[?&]url=.+\.m3u8/i.test(url)) return "hls"; // proxied playlist
  if (url.startsWith("/api/stream-proxy")) return "hls";
  return "iframe";
}
