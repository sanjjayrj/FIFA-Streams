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

// Filler words that carry no identity (FIFA and the directory differ on these:
// "Bosnia *and* Herzegovina" vs "Bosnia-Herzegovina", "Korea *Republic*", etc.).
const STOP = new Set([
  "and", "the", "of", "vs", "v", "fc", "sc", "afc", "cf", "de", "da", "do",
  "rep", "republic", "islamic", "dr", "ir", "pr", "national", "team", "st",
  "saint", "north", "south", "new", "united",
]);

// Known-variant names collapsed to one canonical token so totally different
// spellings across the two sources still match.
const PHRASE: [RegExp, string][] = [
  [/united states|u\.?s\.?a/, "usa"],
  [/korea republic|republic of korea|south korea/, "southkorea"],
  [/korea dpr|north korea/, "northkorea"],
  [/bosnia/, "bosnia"],
  [/cote d.?ivoire|ivory coast/, "ivory"],
  [/turkiye|turkey/, "turkey"],
  [/czech/, "czech"],
  [/cabo verde|cape verde/, "capeverde"],
  [/congo dr|dr congo|democratic republic.*congo/, "drcongo"],
  [/curacao/, "curacao"],
];

function strip(s: string): string {
  return s.toLowerCase().normalize("NFD").replace(/[̀-ͯ]/g, "");
}

/** Canonical identity tokens for a single team name. */
function teamTokens(name: string): Set<string> {
  const s = strip(name);
  for (const [re, canon] of PHRASE) if (re.test(s)) return new Set([canon]);
  return new Set(
    s.split(/[^a-z]+/).filter((t) => t.length >= 3 && !STOP.has(t))
  );
}

/** All identity tokens present in a directory match (teams + title). */
function matchTokens(m: LiveMatch): Set<string> {
  const out = new Set<string>();
  const add = (s: string) => {
    for (const t of teamTokens(s)) out.add(t);
  };
  if (m.home) add(m.home);
  if (m.away) add(m.away);
  const s = strip(m.title);
  for (const [re, canon] of PHRASE) if (re.test(s)) out.add(canon);
  for (const t of s.split(/[^a-z]+/))
    if (t.length >= 3 && !STOP.has(t)) out.add(t);
  return out;
}

function present(teamName: string, hay: Set<string>): boolean {
  for (const t of teamTokens(teamName)) if (hay.has(t)) return true;
  return false;
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
  return matches.filter((m) => {
    const hay = matchTokens(m);
    return present(homeName, hay) && present(awayName, hay);
  });
}
