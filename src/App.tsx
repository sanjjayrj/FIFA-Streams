import { useCallback, useEffect, useRef, useState } from "react";
import { Player } from "./components/Player";
import { SourceBar, type Source } from "./components/SourceBar";
import { DataPanel } from "./components/DataPanel";
import { BracketOverlay } from "./components/BracketOverlay";
import { ScoreTicker } from "./components/ScoreTicker";
import { usePersistentState } from "./hooks";
import { extractEmbedUrl, extractTitle } from "./utils";
import { fetchMatches, pickLatestMatch, type Match } from "./data/fifa";
import { bestStreamFor } from "./data/streams";

// The embed the user started with, pre-loaded on first run.
const DEFAULT_EMBED = `<iframe title="FIFA World Cup Opening Ceremony: Mexico Player" src="https://embed.st/embed/admin/ppv-fifa-world-cup-opening-ceremony-mexico/1" allowfullscreen="yes" allow="encrypted-media; picture-in-picture;" width="100%" height="100%" frameborder="0"></iframe>`;

function makeSource(raw: string): Source | null {
  const url = extractEmbedUrl(raw);
  if (!url) return null;
  return {
    url,
    title: extractTitle(raw) || "Untitled stream",
    addedAt: Date.now(),
  };
}

export default function App() {
  const [recents, setRecents] = usePersistentState<Source[]>(
    "fifa.recents",
    INITIAL_RECENTS
  );
  const [currentUrl, setCurrentUrl] = usePersistentState<string | null>(
    "fifa.current",
    null
  );
  const [currentTitle, setCurrentTitle] = usePersistentState<string>(
    "fifa.title",
    "FIFA Live"
  );
  const [live, setLive] = usePersistentState<boolean>("fifa.live", true);
  const [showTeams, setShowTeams] = usePersistentState<boolean>(
    "fifa.showTeams",
    true
  );
  const [showBracket, setShowBracket] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [reloadKey, setReloadKey] = useState(0);

  // On first run, seed from the default embed if nothing is stored.
  useEffect(() => {
    if (currentUrl === null && recents.length > 0) {
      setCurrentUrl(recents[0].url);
      setCurrentTitle(recents[0].title);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const loadSource = useCallback(
    (s: Source) => {
      setCurrentUrl(s.url);
      setCurrentTitle(s.title);
      setError(null);
      setRecents((prev) => {
        const without = prev.filter((p) => p.url !== s.url);
        return [s, ...without].slice(0, 8);
      });
    },
    [setCurrentUrl, setCurrentTitle, setRecents]
  );

  const onSubmit = useCallback(
    (raw: string) => {
      const s = makeSource(raw);
      if (!s) {
        setError(
          "Couldn't find a stream URL in that. Paste a full <iframe> embed code or a direct https:// link."
        );
        return;
      }
      loadSource(s);
    },
    [loadSource]
  );

  const loadStream = useCallback(
    (url: string, title: string) => {
      loadSource({ url, title, addedAt: Date.now() });
    },
    [loadSource]
  );

  // Resolve and load a specific match's live stream (from the ticker).
  const watchMatch = useCallback(
    async (m: Match) => {
      if (!m.home.name || !m.away.name) return;
      setAutoStatus(`Loading ${m.home.name} vs ${m.away.name}…`);
      try {
        const s = await bestStreamFor(m.home.name, m.away.name);
        if (s) {
          loadStream(s.url, `🔴 ${s.title}`);
          setAutoStatus(null);
        } else {
          setAutoStatus(
            `No live stream found for ${m.home.name} vs ${m.away.name} yet.`
          );
        }
      } catch {
        setAutoStatus("Couldn’t load that stream.");
      }
    },
    [loadStream]
  );

  // On startup, find the latest live/recent World Cup match and auto-load its
  // stream into the player, replacing the seed embed.
  const autoLoadedRef = useRef(false);
  const [autoStatus, setAutoStatus] = useState<string | null>(
    "Finding the latest match…"
  );
  useEffect(() => {
    if (autoLoadedRef.current) return;
    autoLoadedRef.current = true;
    (async () => {
      try {
        const matches = await fetchMatches();
        const latest = pickLatestMatch(matches);
        if (!latest?.home.name || !latest?.away.name) {
          setAutoStatus(null);
          return;
        }
        const dot = latest.status === "live" ? "🔴 " : "";
        const s = await bestStreamFor(latest.home.name, latest.away.name);
        if (s) {
          loadStream(s.url, `${dot}${s.title}`);
          setAutoStatus(null);
        } else {
          setAutoStatus(
            `No live stream for ${latest.home.name} vs ${latest.away.name} yet — showing default.`
          );
        }
      } catch {
        setAutoStatus(null);
      }
    })();
  }, [loadStream]);

  const removeRecent = useCallback(
    (url: string) => {
      setRecents((prev) => prev.filter((p) => p.url !== url));
    },
    [setRecents]
  );

  // Keyboard shortcuts: f = fullscreen-ish (delegated via reload focus), t = teams.
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      const target = e.target as HTMLElement;
      if (target.tagName === "INPUT" || target.tagName === "TEXTAREA") return;
      if (e.key === "t") setShowTeams((v) => !v);
      if (e.key === "r") setReloadKey((k) => k + 1);
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [setShowTeams]);

  return (
    <div className={`app ${showTeams ? "" : "no-teams"}`}>
      <header className="topbar">
        <div className="brand">
          <span className="brand-ball">⚽</span>
          <span className="brand-name">FIFA Live</span>
          <span className="brand-sub">Stream &amp; Teams</span>
        </div>
        <div className="topbar-actions">
          <button
            className="ghost-btn accent"
            onClick={() => setShowBracket(true)}
            title="Open the full-width bracket / group map"
          >
            Bracket
          </button>
          <button
            className="ghost-btn"
            onClick={() => setShowTeams((v) => !v)}
            title="Toggle data panel (t)"
          >
            {showTeams ? "Hide data" : "Show data"}
          </button>
        </div>
      </header>

      <BracketOverlay
        open={showBracket}
        onClose={() => setShowBracket(false)}
        onLoadStream={loadStream}
      />

      <ScoreTicker onWatch={watchMatch} />

      <main className="layout">
        <section className="main-col">
          {autoStatus && <div className="auto-banner">{autoStatus}</div>}
          <Player
            url={currentUrl}
            title={currentTitle}
            live={live}
            reloadKey={reloadKey}
            onReload={() => setReloadKey((k) => k + 1)}
          />
          <SourceBar
            current={currentUrl}
            recents={recents}
            live={live}
            error={error}
            onSubmit={onSubmit}
            onPick={loadSource}
            onRemove={removeRecent}
            onToggleLive={setLive}
          />
        </section>
        {showTeams && <DataPanel onLoadStream={loadStream} />}
      </main>

      <footer className="footer">
        <span>
          Shortcuts: <kbd>t</kbd> data panel · <kbd>r</kbd> reload · fullscreen
          button on the player · live scores refresh every 30s
        </span>
      </footer>
    </div>
  );
}

const INITIAL_RECENTS: Source[] = (() => {
  const s = makeSource(DEFAULT_EMBED);
  return s ? [s] : [];
})();
