// Client for the free, no-auth streamed.pk directory API. It lists live sports
// matches and resolves each to ready-to-use embed URLs (the `admin` source is
// embed.st itself). We use it to auto-discover streams for a FIFA fixture.
//
// CORS note: streamed.pk responds with permissive headers for the JSON API, so
// the browser can call it directly. (streamed.su is Cloudflare-walled.)

const BASE = "https://streamed.pk/api";

export interface StreamSourceRef {
  source: string;
  id: string;
}

export interface LiveMatch {
  id: string;
  title: string;
  category: string;
  date: number;
  home: string | null;
  away: string | null;
  sources: StreamSourceRef[];
}

export interface StreamOption {
  embedUrl: string;
  language: string;
  hd: boolean;
  streamNo: number;
  viewers: number;
  source: string;
}

interface RawMatch {
  id: string;
  title: string;
  category: string;
  date: number;
  teams?: { home?: { name?: string }; away?: { name?: string } };
  sources: StreamSourceRef[];
}

export async function fetchLiveFootball(): Promise<LiveMatch[]> {
  const res = await fetch(`${BASE}/matches/football`);
  if (!res.ok) throw new Error(`streamed API ${res.status}`);
  const raw = (await res.json()) as RawMatch[];
  return raw.map((m) => ({
    id: m.id,
    title: m.title,
    category: m.category,
    date: m.date,
    home: m.teams?.home?.name ?? null,
    away: m.teams?.away?.name ?? null,
    sources: m.sources ?? [],
  }));
}

export async function fetchStreamOptions(
  ref: StreamSourceRef
): Promise<StreamOption[]> {
  const res = await fetch(`${BASE}/stream/${ref.source}/${ref.id}`);
  if (!res.ok) return [];
  const raw = (await res.json()) as {
    embedUrl: string;
    language: string;
    hd: boolean;
    streamNo: number;
    viewers: number;
    source: string;
  }[];
  return raw.map((s) => ({
    embedUrl: s.embedUrl,
    language: s.language,
    hd: s.hd,
    streamNo: s.streamNo,
    viewers: s.viewers,
    source: s.source,
  }));
}

function normalize(s: string): string {
  return s
    .toLowerCase()
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .replace(/[^a-z]/g, "");
}

// Common name mismatches between FIFA and the stream directory.
const ALIAS: Record<string, string> = {
  unitedstates: "usa",
  usa: "usa",
  korearepublic: "southkorea",
  southkorea: "southkorea",
  iranislamicrepublic: "iran",
  czechia: "czech",
  czechrepublic: "czech",
  turkiye: "turkey",
  cotedivoire: "ivorycoast",
};
function alias(s: string): string {
  const n = normalize(s);
  return ALIAS[n] ?? n;
}

export interface ResolvedStream {
  url: string;
  title: string;
  language: string;
  hd: boolean;
}

/**
 * Best available stream (HD, most viewers) for a fixture, found by matching the
 * stream directory on team names. Returns null if nothing is live yet.
 */
export async function bestStreamFor(
  homeName: string,
  awayName: string
): Promise<ResolvedStream | null> {
  const live = await fetchLiveFootball();
  const matched = matchStreamsFor(live, homeName, awayName);
  if (!matched.length) return null;
  const refs = matched.flatMap((m) => m.sources);
  const lists = await Promise.all(
    refs.map((r) => fetchStreamOptions(r).catch(() => []))
  );
  const flat = lists
    .flat()
    .sort((a, b) => Number(b.hd) - Number(a.hd) || b.viewers - a.viewers);
  const best = flat[0];
  if (!best) return null;
  return {
    url: best.embedUrl,
    title: `${homeName} vs ${awayName} · ${best.language}`,
    language: best.language,
    hd: best.hd,
  };
}

/**
 * Find live-stream matches whose two team names match the given FIFA fixture,
 * regardless of word order or minor naming differences.
 */
export function matchStreamsFor(
  matches: LiveMatch[],
  homeName: string,
  awayName: string
): LiveMatch[] {
  if (!homeName || !awayName) return [];
  const a = alias(homeName);
  const b = alias(awayName);
  return matches.filter((m) => {
    const hay = alias(`${m.home ?? ""}${m.away ?? ""}${m.title}`);
    return hay.includes(a) && hay.includes(b);
  });
}
