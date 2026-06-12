// Resolve the real HLS (.m3u8) URL behind an obfuscated embed page by driving a
// headless Firefox session and sniffing its network traffic — the workaround for
// "you need a real browser session to get the stream".
//
// Usage:
//   node scripts/extract-stream.mjs "https://embed.st/embed/admin/<id>/1"
//
// Prints JSON: { ok, m3u8, referer, headers, candidates }
// The shared resolveStream() is also imported by the dev server's /resolve route.

import { firefox } from "playwright";

const BROWSER_UA =
  "Mozilla/5.0 (X11; Linux x86_64; rv:149.0) Gecko/20100101 Firefox/149.0";

/**
 * @param {string} embedUrl
 * @param {{ timeoutMs?: number, headless?: boolean }} [opts]
 */
export async function resolveStream(embedUrl, opts = {}) {
  const timeoutMs = opts.timeoutMs ?? 25000;
  const browser = await firefox.launch({ headless: opts.headless ?? true });
  const candidates = [];
  const seen = new Set();

  try {
    const context = await browser.newContext({
      userAgent: BROWSER_UA,
      viewport: { width: 1280, height: 720 },
    });

    const page = await context.newPage();

    // Close ad pop-ups/new tabs, but never the main page we're driving.
    context.on("page", (p) => {
      if (p !== page) p.close().catch(() => {});
    });

    const record = (url, headers) => {
      if (!url || seen.has(url)) return;
      if (/\.m3u8(\?|#|$)/i.test(url) || /\.mpd(\?|#|$)/i.test(url)) {
        seen.add(url);
        candidates.push({
          url,
          referer: headers?.referer || headers?.Referer || embedUrl,
          headers: headers || {},
          isMaster: /master|index|playlist|chunklist|\.m3u8/i.test(url),
        });
      }
    };

    page.on("request", (req) => record(req.url(), req.headers()));
    page.on("response", (res) => record(res.url()));

    await page
      .goto(embedUrl, { waitUntil: "domcontentloaded", timeout: timeoutMs })
      .catch(() => {});

    // Nudge the player to start: try clicking the center a couple of times.
    const deadline = Date.now() + timeoutMs;
    while (Date.now() < deadline && candidates.length === 0) {
      await page.mouse.click(640, 360).catch(() => {});
      await page.waitForTimeout(1500);
    }
    // Give late requests a moment to surface.
    await page.waitForTimeout(2000);

    // Prefer a master/index playlist; fall back to the first candidate.
    const best =
      candidates.find((c) => /master|index|playlist/i.test(c.url)) ??
      candidates.find((c) => /\.m3u8/i.test(c.url)) ??
      candidates[0];

    // Capture the session cookies so the secure (token-bound) playlist and its
    // segments can be replayed outside the browser by the proxy.
    const cookieObjs = await context.cookies();
    const cookieHeader = cookieObjs
      .map((c) => `${c.name}=${c.value}`)
      .join("; ");

    // Confirm the playlist is fetchable *within this session* and grab a preview.
    // Replay the exact captured request headers (Origin + sec-fetch matter).
    let preview = null;
    let previewStatus = null;
    if (best) {
      const h = { ...best.headers };
      delete h.host;
      delete h.connection;
      delete h["content-length"];
      try {
        const r = await context.request.get(best.url, { headers: h });
        previewStatus = r.status();
        if (r.ok()) preview = (await r.text()).slice(0, 200);
      } catch {
        /* ignore */
      }
    }

    return {
      ok: Boolean(best),
      m3u8: best?.url ?? null,
      referer: best?.referer ?? embedUrl,
      cookie: cookieHeader,
      headers: best?.headers ?? {},
      previewStatus,
      playablePreview: preview,
      candidates: candidates.map((c) => c.url),
    };
  } finally {
    await browser.close().catch(() => {});
  }
}

// CLI entry point.
if (import.meta.url === `file://${process.argv[1]}`) {
  const embed = process.argv[2];
  if (!embed) {
    console.error("usage: node scripts/extract-stream.mjs <embedUrl>");
    process.exit(1);
  }
  resolveStream(embed)
    .then((r) => console.log(JSON.stringify(r, null, 2)))
    .catch((e) => {
      console.error(JSON.stringify({ ok: false, error: String(e) }));
      process.exit(1);
    });
}
