// Vercel serverless function: the production HLS proxy (the dev version lives in
// vite.config.ts). Fetches a playlist/segment with the required Referer/Origin,
// adds CORS, and rewrites child playlist URLs to keep flowing through itself.
//
//   /api/stream-proxy?url=<ENCODED_M3U8>&referer=<ENCODED_REFERER>

const BROWSER_UA =
  "Mozilla/5.0 (X11; Linux x86_64; rv:149.0) Gecko/20100101 Firefox/149.0";

export default async function handler(req, res) {
  const u = new URL(req.url, `https://${req.headers.host || "localhost"}`);
  const target = u.searchParams.get("url");
  const referer = u.searchParams.get("referer") || "";

  res.setHeader("Access-Control-Allow-Origin", "*");
  if (!target) {
    res.statusCode = 400;
    res.end("missing url");
    return;
  }

  try {
    const upstream = await fetch(target, {
      headers: {
        "User-Agent": BROWSER_UA,
        ...(referer
          ? { Referer: referer, Origin: new URL(referer).origin }
          : {}),
      },
    });

    res.statusCode = upstream.status;
    const ctype = upstream.headers.get("content-type") || "";
    const looksPlaylist =
      ctype.includes("mpegurl") || /\.m3u8(\?|$)/i.test(target);

    if (!upstream.ok) {
      res.setHeader("Content-Type", ctype || "text/plain");
      res.end(Buffer.from(await upstream.arrayBuffer()));
      return;
    }

    if (looksPlaylist) {
      const text = await upstream.text();
      if (!text.trimStart().startsWith("#EXTM3U")) {
        res.setHeader("Content-Type", ctype || "text/plain");
        res.end(text);
        return;
      }
      const base = new URL(target);
      const rewrite = (ref) => {
        if (!ref || ref.startsWith("#")) return ref;
        const abs = new URL(ref, base).toString();
        return `/api/stream-proxy?url=${encodeURIComponent(
          abs
        )}&referer=${encodeURIComponent(referer)}`;
      };
      const out = text
        .split("\n")
        .map((line) => {
          const t = line.trim();
          if (!t || t.startsWith("#")) {
            return line.replace(
              /URI="([^"]+)"/g,
              (_m, p1) => `URI="${rewrite(p1)}"`
            );
          }
          return rewrite(t);
        })
        .join("\n");
      res.setHeader("Content-Type", "application/vnd.apple.mpegurl");
      res.end(out);
      return;
    }

    res.setHeader("Content-Type", ctype || "application/octet-stream");
    res.end(Buffer.from(await upstream.arrayBuffer()));
  } catch (e) {
    res.statusCode = 502;
    res.end("proxy error: " + e.message);
  }
}
