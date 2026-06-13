import { defineConfig, type Plugin } from "vite";
import react from "@vitejs/plugin-react";
import { VitePWA } from "vite-plugin-pwa";
import type { IncomingMessage, ServerResponse } from "node:http";

const BROWSER_UA =
  "Mozilla/5.0 (X11; Linux x86_64; rv:149.0) Gecko/20100101 Firefox/149.0";

/**
 * Dev-only HLS proxy. Many free stream playlists are locked to a specific
 * `Referer`/`Origin` and lack CORS, so a browser <video> can't fetch them
 * directly. This middleware fetches the playlist (and its segments) server-side
 * with the required headers, rewrites child URLs to keep flowing through the
 * proxy, and serves everything with `Access-Control-Allow-Origin: *`.
 *
 * Usage from the app: /stream-proxy?url=<ENCODED_M3U8>&referer=<ENCODED_REFERER>
 * Only runs under `npm run dev`.
 */
function streamProxy(): Plugin {
  return {
    name: "hls-stream-proxy",
    configureServer(server) {
      server.middlewares.use(
        "/api/stream-proxy",
        async (req: IncomingMessage, res: ServerResponse) => {
          try {
            const u = new URL(req.url ?? "", "http://localhost");
            const target = u.searchParams.get("url");
            const referer = u.searchParams.get("referer") ?? "";
            if (!target) {
              res.statusCode = 400;
              res.end("missing url");
              return;
            }
            const upstream = await fetch(target, {
              headers: {
                "User-Agent": BROWSER_UA,
                ...(referer
                  ? { Referer: referer, Origin: new URL(referer).origin }
                  : {}),
              },
            });

            res.setHeader("Access-Control-Allow-Origin", "*");
            res.statusCode = upstream.status;
            const ctype = upstream.headers.get("content-type") ?? "";
            const looksPlaylist =
              ctype.includes("mpegurl") || /\.m3u8(\?|$)/i.test(target);

            // Upstream error (e.g. 403 for an expired/single-use token): pass the
            // body through untouched so it isn't mistaken for a playlist.
            if (!upstream.ok) {
              res.setHeader("Content-Type", ctype || "text/plain");
              res.end(Buffer.from(await upstream.arrayBuffer()));
              return;
            }

            if (looksPlaylist) {
              const text = await upstream.text();
              // Guard against HTML error pages that slipped past the ext check.
              if (!text.trimStart().startsWith("#EXTM3U")) {
                res.setHeader("Content-Type", ctype || "text/plain");
                res.end(text);
                return;
              }
              const base = new URL(target);
              const rewrite = (ref: string) => {
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
                    // rewrite URI="..." inside tags (keys, maps, renditions)
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

            // Binary segment / key: stream bytes through.
            res.setHeader("Content-Type", ctype || "application/octet-stream");
            const buf = Buffer.from(await upstream.arrayBuffer());
            res.end(buf);
          } catch (e) {
            res.statusCode = 502;
            res.end(`proxy error: ${(e as Error).message}`);
          }
        }
      );

      // /resolve?embed=<embedUrl> — drives a headless Firefox session to sniff
      // the real .m3u8 behind an obfuscated embed. Playwright is imported lazily
      // so normal dev startup isn't affected.
      server.middlewares.use(
        "/resolve",
        async (req: IncomingMessage, res: ServerResponse) => {
          res.setHeader("Access-Control-Allow-Origin", "*");
          res.setHeader("Content-Type", "application/json");
          try {
            const u = new URL(req.url ?? "", "http://localhost");
            const embed = u.searchParams.get("embed");
            if (!embed) {
              res.statusCode = 400;
              res.end(JSON.stringify({ ok: false, error: "missing embed" }));
              return;
            }
            const mod = await import("./scripts/extract-stream.mjs");
            const result = await mod.resolveStream(embed);
            res.end(JSON.stringify(result));
          } catch (e) {
            res.statusCode = 500;
            res.end(
              JSON.stringify({ ok: false, error: (e as Error).message })
            );
          }
        }
      );
    },
  };
}

export default defineConfig({
  plugins: [
    react(),
    streamProxy(),
    VitePWA({
      registerType: "autoUpdate",
      includeAssets: [
        "fwc26-emblem.png",
        "apple-touch-icon.png",
        "favicon-32x32.png",
      ],
      manifest: {
        name: "FIFA Live — Stream & Teams",
        short_name: "FIFA Live",
        description:
          "Watch FIFA World Cup 2026 streams with live official data: groups, bracket, fixtures, squads, field maps and stats.",
        theme_color: "#0a0e1a",
        background_color: "#070b16",
        display: "standalone",
        orientation: "any",
        start_url: "/",
        icons: [
          { src: "pwa-192x192.png", sizes: "192x192", type: "image/png" },
          { src: "pwa-512x512.png", sizes: "512x512", type: "image/png" },
          {
            src: "maskable-icon-512x512.png",
            sizes: "512x512",
            type: "image/png",
            purpose: "maskable",
          },
        ],
      },
      workbox: {
        // Precache the static shell; keep live API data network-only, but cache
        // the immutable flag/photo images for speed and offline reuse.
        globPatterns: ["**/*.{js,css,html,svg,png,woff2}"],
        runtimeCaching: [
          {
            urlPattern: /^https:\/\/api\.fifa\.com\/api\/v3\/picture\/.*/i,
            handler: "CacheFirst",
            options: {
              cacheName: "fifa-flags",
              expiration: { maxEntries: 300, maxAgeSeconds: 60 * 60 * 24 * 30 },
            },
          },
          {
            urlPattern: /^https:\/\/digitalhub\.fifa\.com\/.*/i,
            handler: "CacheFirst",
            options: {
              cacheName: "fifa-photos",
              expiration: { maxEntries: 600, maxAgeSeconds: 60 * 60 * 24 * 30 },
            },
          },
        ],
      },
    }),
  ],
  server: {
    host: true,
    port: 5173,
  },
});
