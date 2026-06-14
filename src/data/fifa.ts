// Client for the official FIFA Data API (api.fifa.com/api/v3).
// The API sends `Access-Control-Allow-Origin: *`, so the browser can call it
// directly — no proxy or API key required.
//
// Tournament: FIFA World Cup 2026 (men). Verified live values:
//   competition 17, season 285023.

export const COMPETITION = "17";
export const SEASON = "285023";
const BASE = "https://api.fifa.com/api/v3";
const LANG = "en";

/** A FIFA `[{ Locale, Description }]` array → plain string (first entry). */
type Localized = { Locale: string; Description: string }[] | null | undefined;
function loc(arr: Localized, fallback = ""): string {
  if (arr && arr.length) return arr[0].Description;
  return fallback;
}

/** Square flag PNG for a 3-letter FIFA/country code. */
export function flagUrl(code: string | null | undefined): string | null {
  if (!code) return null;
  return `${BASE}/picture/flags-sq-4/${code}`;
}

/**
 * FIFA player portraits (digitalhub) are full-res (~2300×3500, ~900KB each).
 * Request a small square thumbnail via the digitalhub transform query so a
 * 26-player squad isn't ~23MB of images.
 */
export function sizedPhoto(
  url: string | null | undefined,
  px = 160
): string | null {
  if (!url) return null;
  if (url.includes("digitalhub.fifa.com") && !url.includes("io=transform")) {
    return `${url}?io=transform:fill,width:${px},height:${px}`;
  }
  return url;
}

async function getJson<T>(path: string): Promise<T> {
  const res = await fetch(`${BASE}${path}`);
  if (!res.ok) throw new Error(`FIFA API ${res.status} for ${path}`);
  return (await res.json()) as T;
}

// ---------------------------------------------------------------------------
// Normalized types used by the UI
// ---------------------------------------------------------------------------

export type MatchStatus = "live" | "finished" | "upcoming";

export interface MatchTeam {
  id: string | null;
  name: string;
  code: string | null;
  score: number | null;
  placeholder: string | null; // e.g. "Winner Group A" before a team is known
}

export interface Match {
  id: string;
  matchNumber: number | null;
  kickoff: number; // epoch ms (UTC)
  iso: string;
  group: string | null;
  idGroup: string | null;
  stage: string;
  idStage: string;
  status: MatchStatus;
  minute: string | null;
  home: MatchTeam;
  away: MatchTeam;
  homePens: number | null;
  awayPens: number | null;
  stadium: string | null;
  city: string | null;
  attendance: string | null;
  referee: string | null;
}

export interface Season {
  id: string;
  name: string;
  associations: string[]; // 3-letter codes of qualified teams
}

export interface NationTeam {
  id: string;
  name: string;
  code: string;
}

export interface SquadPlayer {
  id: string;
  name: string;
  short: string;
  jersey: number | null;
  position: string;
  positionOrder: number;
  age: number | null;
  heightCm: number | null;
  weightKg: number | null;
  photo: string | null;
  goals: number | null;
  yellow: number | null;
  red: number | null;
}

export interface GroupRow {
  code: string | null;
  name: string;
  pld: number;
  w: number;
  d: number;
  l: number;
  gf: number;
  ga: number;
  gd: number;
  pts: number;
}

export interface GroupTable {
  group: string;
  idGroup: string;
  rows: GroupRow[];
}

// ---------------------------------------------------------------------------
// Raw shapes (only the fields we read)
// ---------------------------------------------------------------------------

interface RawTeam {
  IdTeam: string | null;
  IdCountry: string | null;
  Abbreviation: string | null;
  TeamName: Localized;
  Score: number | null;
  TeamType: number | null;
}
interface RawMatch {
  IdMatch: string;
  MatchNumber: number | null;
  IdStage: string;
  IdGroup: string | null;
  Date: string;
  StageName: Localized;
  GroupName: Localized;
  MatchStatus: number;
  MatchTime: string | null;
  Home: RawTeam | null;
  Away: RawTeam | null;
  PlaceHolderA: string | null;
  PlaceHolderB: string | null;
  HomeTeamScore: number | null;
  AwayTeamScore: number | null;
  HomeTeamPenaltyScore: number | null;
  AwayTeamPenaltyScore: number | null;
  Attendance: string | null;
  Stadium: { Name: Localized; CityName: Localized } | null;
  Officials: { OfficialType: number; Name: Localized }[] | null;
}

function mapStatus(s: number): MatchStatus {
  if (s === 0) return "finished";
  if (s === 3) return "live";
  return "upcoming";
}

function mapTeam(t: RawTeam | null, placeholder: string | null): MatchTeam {
  if (!t || (!t.IdCountry && !loc(t.TeamName))) {
    return { id: null, name: "", code: null, score: null, placeholder };
  }
  return {
    id: t.IdTeam,
    name: loc(t.TeamName),
    code: t.Abbreviation || t.IdCountry,
    score: t.Score,
    placeholder,
  };
}

function mapMatch(m: RawMatch): Match {
  const refs = m.Officials?.filter((o) => o.OfficialType === 1) ?? [];
  return {
    id: m.IdMatch,
    matchNumber: m.MatchNumber ?? null,
    kickoff: new Date(m.Date).getTime(),
    iso: m.Date,
    group: m.GroupName?.length ? loc(m.GroupName) : null,
    idGroup: m.IdGroup,
    stage: loc(m.StageName),
    idStage: m.IdStage,
    status: mapStatus(m.MatchStatus),
    minute: m.MatchTime,
    home: mapTeam(m.Home, m.PlaceHolderA),
    away: mapTeam(m.Away, m.PlaceHolderB),
    homePens: m.HomeTeamPenaltyScore,
    awayPens: m.AwayTeamPenaltyScore,
    stadium: m.Stadium ? loc(m.Stadium.Name) || null : null,
    city: m.Stadium ? loc(m.Stadium.CityName) || null : null,
    attendance: m.Attendance,
    referee: refs.length ? loc(refs[0].Name) : null,
  };
}

// ---------------------------------------------------------------------------
// Public fetchers
// ---------------------------------------------------------------------------

export async function fetchSeason(): Promise<Season> {
  const d = await getJson<{
    Results: {
      IdSeason: string;
      Name: Localized;
      IdMemberAssociation: string[];
    }[];
  }>(`/seasons?idCompetition=${COMPETITION}&language=${LANG}&count=10`);
  const s = d.Results.find((r) => r.IdSeason === SEASON) ?? d.Results[0];
  return {
    id: s.IdSeason,
    name: loc(s.Name),
    associations: s.IdMemberAssociation ?? [],
  };
}

export async function fetchMatches(): Promise<Match[]> {
  const d = await getJson<{ Results: RawMatch[] }>(
    `/calendar/matches?idCompetition=${COMPETITION}&idSeason=${SEASON}&count=200&language=${LANG}`
  );
  return d.Results.map(mapMatch).sort((a, b) => a.kickoff - b.kickoff);
}

interface RawPlayer {
  IdPlayer: string;
  PlayerName: Localized;
  ShortName: Localized;
  JerseyNum: number | null;
  Position: number | null;
  PositionLocalized: Localized;
  BirthDate: string | null;
  Height: number | null;
  Weight: number | null;
  Goals: number | null;
  YellowCards: number | null;
  RedCards: number | null;
  PlayerPicture: { PictureUrl: string | null } | null;
  PictureUrl: string | null;
}

function ageFrom(birth: string | null): number | null {
  if (!birth) return null;
  const b = new Date(birth);
  if (isNaN(b.getTime())) return null;
  const now = new Date();
  let a = now.getFullYear() - b.getFullYear();
  const m = now.getMonth() - b.getMonth();
  if (m < 0 || (m === 0 && now.getDate() < b.getDate())) a--;
  return a;
}

export async function fetchSquad(idTeam: string): Promise<SquadPlayer[]> {
  const d = await getJson<{ Players: RawPlayer[] }>(
    `/teams/${idTeam}/squad?idCompetition=${COMPETITION}&idSeason=${SEASON}&language=${LANG}`
  );
  return (d.Players ?? [])
    .map((p): SquadPlayer => ({
      id: p.IdPlayer,
      name: loc(p.PlayerName),
      short: loc(p.ShortName) || loc(p.PlayerName),
      jersey: p.JerseyNum,
      position: loc(p.PositionLocalized, "—"),
      positionOrder: p.Position ?? 9,
      age: ageFrom(p.BirthDate),
      heightCm: p.Height,
      weightKg: p.Weight,
      photo: sizedPhoto(p.PlayerPicture?.PictureUrl || p.PictureUrl),
      goals: p.Goals,
      yellow: p.YellowCards,
      red: p.RedCards,
    }))
    .sort(
      (a, b) =>
        a.positionOrder - b.positionOrder ||
        (a.jersey ?? 99) - (b.jersey ?? 99)
    );
}

// ---------------------------------------------------------------------------
// Derivations
// ---------------------------------------------------------------------------

/** Unique real nations appearing in the group stage, with their team ids. */
export function teamsFromMatches(matches: Match[]): NationTeam[] {
  const map = new Map<string, NationTeam>();
  for (const m of matches) {
    for (const t of [m.home, m.away]) {
      if (t.id && t.code && t.name && !map.has(t.id)) {
        map.set(t.id, { id: t.id, name: t.name, code: t.code });
      }
    }
  }
  return [...map.values()].sort((a, b) => a.name.localeCompare(b.name));
}

/** Group tables computed from finished group-stage matches. */
export function computeGroupTables(matches: Match[]): GroupTable[] {
  const groups = new Map<
    string,
    { group: string; idGroup: string; rows: Map<string, GroupRow> }
  >();

  const ensureRow = (
    g: { rows: Map<string, GroupRow> },
    t: MatchTeam
  ): GroupRow | null => {
    if (!t.code || !t.name) return null;
    let r = g.rows.get(t.code);
    if (!r) {
      r = {
        code: t.code,
        name: t.name,
        pld: 0,
        w: 0,
        d: 0,
        l: 0,
        gf: 0,
        ga: 0,
        gd: 0,
        pts: 0,
      };
      g.rows.set(t.code, r);
    }
    return r;
  };

  for (const m of matches) {
    if (!m.idGroup || !m.group) continue; // group stage only
    let g = groups.get(m.idGroup);
    if (!g) {
      g = { group: m.group, idGroup: m.idGroup, rows: new Map() };
      groups.set(m.idGroup, g);
    }
    // Seed both teams so the table shows all four even before kickoff.
    const hr = ensureRow(g, m.home);
    const ar = ensureRow(g, m.away);
    if (
      m.status !== "finished" ||
      m.home.score == null ||
      m.away.score == null ||
      !hr ||
      !ar
    )
      continue;

    hr.pld++;
    ar.pld++;
    hr.gf += m.home.score;
    hr.ga += m.away.score;
    ar.gf += m.away.score;
    ar.ga += m.home.score;
    if (m.home.score > m.away.score) {
      hr.w++;
      ar.l++;
      hr.pts += 3;
    } else if (m.home.score < m.away.score) {
      ar.w++;
      hr.l++;
      ar.pts += 3;
    } else {
      hr.d++;
      ar.d++;
      hr.pts++;
      ar.pts++;
    }
  }

  const tables: GroupTable[] = [...groups.values()].map((g) => {
    const rows = [...g.rows.values()];
    rows.forEach((r) => (r.gd = r.gf - r.ga));
    rows.sort(
      (a, b) =>
        b.pts - a.pts || b.gd - a.gd || b.gf - a.gf || a.name.localeCompare(b.name)
    );
    return { group: g.group, idGroup: g.idGroup, rows };
  });

  tables.sort((a, b) => a.group.localeCompare(b.group));
  return tables;
}

// ---------------------------------------------------------------------------
// Match detail: lineups (field map) + events
// ---------------------------------------------------------------------------

export interface LineupPlayer {
  id: string;
  name: string;
  shirt: number | null;
  position: number; // 0 GK, 1 DEF, 2 MID, 3 FWD
  captain: boolean;
  x: number; // 0..100 across the pitch
  y: number; // 0..100 along the pitch (per team half)
  goals: number;
  yellow: boolean;
  red: boolean;
  subbedOn: boolean;
  photo: string | null;
}

export const POSITION_LABEL = ["Goalkeeper", "Defender", "Midfielder", "Forward"];

export interface BenchPlayer {
  id: string;
  name: string;
  shirt: number | null;
  position: number;
}

/** A roster entry for the full lineup list (starters + substitutes). */
export interface LineupEntry {
  id: string;
  name: string;
  shirt: number | null;
  position: number;
  captain: boolean;
  goals: number;
  yellow: boolean;
  red: boolean;
  offMinute: string | null; // subbed off at (for a starter)
  onMinute: string | null; // subbed on at (for a substitute)
  partnerName: string | null; // who replaced them / whom they replaced
}

export interface TeamLineup {
  teamId: string;
  name: string;
  code: string;
  tactics: string | null;
  onPitch: LineupPlayer[];
  bench: BenchPlayer[];
  starters: LineupEntry[];
  subs: LineupEntry[];
}

export interface MatchEvent {
  minute: number;
  label: string; // "9'"
  icon: string; // ⚽ 🟨 🟥 🔁
  teamCode: string | null;
  text: string;
}

export interface MatchDetail {
  id: string;
  status: MatchStatus;
  minute: string | null;
  iso: string;
  venue: string | null;
  city: string | null;
  referee: string | null;
  attendance: string | null;
  home: { code: string | null; name: string; score: number | null };
  away: { code: string | null; name: string; score: number | null };
  homeLineup: TeamLineup | null;
  awayLineup: TeamLineup | null;
  events: MatchEvent[];
}

interface RawLivePlayer {
  IdPlayer: string;
  ShirtNumber: number | null;
  Status: number; // 1 = starting XI, 2 = bench
  Position: number;
  Captain: boolean;
  PlayerName: Localized;
  ShortName: Localized;
  PlayerPicture?: { PictureUrl: string | null } | null;
}
interface RawGoal {
  IdPlayer: string;
  Minute: string;
  Type: number;
}
interface RawBooking {
  IdPlayer: string;
  Card: number;
  Minute: string;
}
interface RawSub {
  IdPlayerOff: string;
  IdPlayerOn: string;
  PlayerOffName: Localized;
  PlayerOnName: Localized;
  Minute: string;
}
interface RawLiveTeam {
  IdTeam: string;
  IdCountry: string | null;
  Abbreviation: string | null;
  TeamName: Localized;
  Tactics: string | null;
  Score: number | null;
  Players: RawLivePlayer[];
  Goals: RawGoal[] | null;
  Bookings: RawBooking[] | null;
  Substitutions: RawSub[] | null;
}
interface RawLive {
  IdMatch: string;
  MatchStatus: number;
  MatchTime: string | null;
  Date: string;
  Attendance: string | null;
  Stadium: { Name: Localized; CityName: Localized } | null;
  Officials: { OfficialType: number; Name: Localized }[] | null;
  HomeTeam: RawLiveTeam | null;
  AwayTeam: RawLiveTeam | null;
}

function parseMinute(m: string | null | undefined): number {
  if (!m) return 0;
  // "45+2'" → 47, "66'" → 66
  const main = parseInt(m, 10) || 0;
  const extra = m.includes("+") ? parseInt(m.split("+")[1], 10) || 0 : 0;
  return main + extra;
}

/**
 * Lay out a team's current XI on its own half of the pitch using the formation
 * string (e.g. "4-1-2-3"). `top` mirrors the team to the opposite end.
 */
function layout(
  players: LineupPlayer[],
  tactics: string | null,
  top: boolean
): void {
  const gk = players.find((p) => p.position === 0);
  const outs = players
    .filter((p) => p.position !== 0)
    .sort((a, b) => a.position - b.position || (a.shirt ?? 99) - (b.shirt ?? 99));

  let lines = (tactics ?? "")
    .split("-")
    .map((n) => parseInt(n, 10))
    .filter((n) => n > 0);
  const total = lines.reduce((s, n) => s + n, 0);
  if (total !== outs.length) {
    // Fall back to grouping by position when the formation doesn't add up.
    const def = outs.filter((p) => p.position === 1).length;
    const mid = outs.filter((p) => p.position === 2).length;
    const fwd = outs.filter((p) => p.position === 3).length;
    lines = [def, mid, fwd].filter((n) => n > 0);
  }

  // Each team occupies its own half: lines run from the goal line out to ~40,
  // leaving a ~20% gap around the halfway line so the two front lines (and their
  // name labels) don't overlap in the middle.
  const L = lines.length;
  if (gk) {
    gk.x = 50;
    gk.y = top ? 6 : 94;
  }
  let idx = 0;
  lines.forEach((n, li) => {
    const t = L === 1 ? 0 : li / (L - 1);
    const yOwn = 15 + t * 25; // 15..40 from goal toward halfway
    const y = top ? yOwn : 100 - yOwn;
    for (let k = 0; k < n; k++) {
      const p = outs[idx++];
      if (!p) break;
      p.x = 12 + ((k + 0.5) / n) * 76;
      p.y = y;
    }
  });
}

function buildLineup(t: RawLiveTeam | null): TeamLineup | null {
  if (!t) return null;
  const nameOf = (id: string) => {
    const p = t.Players.find((x) => x.IdPlayer === id);
    return p ? loc(p.ShortName) || loc(p.PlayerName) : "";
  };
  const goalsBy = new Map<string, number>();
  for (const g of t.Goals ?? [])
    goalsBy.set(g.IdPlayer, (goalsBy.get(g.IdPlayer) ?? 0) + 1);
  const cardBy = new Map<string, { y: boolean; r: boolean }>();
  for (const b of t.Bookings ?? []) {
    const c = cardBy.get(b.IdPlayer) ?? { y: false, r: false };
    if (b.Card === 1) c.y = true;
    else c.r = true;
    cardBy.set(b.IdPlayer, c);
  }

  const starters = t.Players.filter((p) => p.Status === 1);
  // Map current player occupying each starter's slot after substitutions.
  const slotOf = new Map<string, string>(); // starterId -> currentId
  starters.forEach((s) => slotOf.set(s.IdPlayer, s.IdPlayer));
  const subbedOn = new Set<string>();
  const subs = [...(t.Substitutions ?? [])].sort(
    (a, b) => parseMinute(a.Minute) - parseMinute(b.Minute)
  );
  for (const sub of subs) {
    for (const [starter, current] of slotOf) {
      if (current === sub.IdPlayerOff) {
        slotOf.set(starter, sub.IdPlayerOn);
        subbedOn.add(sub.IdPlayerOn);
        break;
      }
    }
  }

  const onPitch: LineupPlayer[] = starters.map((s) => {
    const currentId = slotOf.get(s.IdPlayer)!;
    const cur = t.Players.find((p) => p.IdPlayer === currentId) ?? s;
    const card = cardBy.get(currentId) ?? { y: false, r: false };
    return {
      id: currentId,
      name: nameOf(currentId) || loc(cur.ShortName) || loc(cur.PlayerName),
      shirt: cur.ShirtNumber,
      position: s.Position, // keep the slot's position
      captain: cur.Captain,
      x: 50,
      y: 50,
      goals: goalsBy.get(currentId) ?? 0,
      yellow: card.y,
      red: card.r,
      subbedOn: subbedOn.has(currentId),
      photo: sizedPhoto(cur.PlayerPicture?.PictureUrl ?? null),
    };
  });

  const bench: BenchPlayer[] = t.Players.filter(
    (p) => p.Status !== 1 && !subbedOn.has(p.IdPlayer)
  ).map((p) => ({
    id: p.IdPlayer,
    name: loc(p.ShortName) || loc(p.PlayerName),
    shirt: p.ShirtNumber,
    position: p.Position,
  }));

  // Substitution lookups for the full lineup list.
  const offInfo = new Map<string, { minute: string; partner: string }>();
  const onInfo = new Map<string, { minute: string; partner: string }>();
  for (const s of subs) {
    offInfo.set(s.IdPlayerOff, { minute: s.Minute, partner: loc(s.PlayerOnName) });
    onInfo.set(s.IdPlayerOn, { minute: s.Minute, partner: loc(s.PlayerOffName) });
  }
  const entry = (p: RawLivePlayer): LineupEntry => {
    const card = cardBy.get(p.IdPlayer) ?? { y: false, r: false };
    const off = offInfo.get(p.IdPlayer);
    const on = onInfo.get(p.IdPlayer);
    return {
      id: p.IdPlayer,
      name: loc(p.ShortName) || loc(p.PlayerName),
      shirt: p.ShirtNumber,
      position: p.Position,
      captain: p.Captain,
      goals: goalsBy.get(p.IdPlayer) ?? 0,
      yellow: card.y,
      red: card.r,
      offMinute: off?.minute ?? null,
      onMinute: on?.minute ?? null,
      partnerName: off?.partner ?? on?.partner ?? null,
    };
  };
  const byPos = (a: LineupEntry, b: LineupEntry) =>
    a.position - b.position || (a.shirt ?? 99) - (b.shirt ?? 99);
  const startersList = starters.map(entry).sort(byPos);
  const subsList = t.Players.filter((p) => p.Status !== 1)
    .map(entry)
    .sort((a, b) => Number(!!b.onMinute) - Number(!!a.onMinute) || byPos(a, b));

  return {
    teamId: t.IdTeam,
    name: loc(t.TeamName),
    code: t.Abbreviation || t.IdCountry || "",
    tactics: t.Tactics,
    onPitch,
    bench,
    starters: startersList,
    subs: subsList,
  };
}

function buildEvents(live: RawLive): MatchEvent[] {
  const ev: MatchEvent[] = [];
  const add = (
    team: RawLiveTeam | null,
    minute: string,
    icon: string,
    text: string
  ) =>
    ev.push({
      minute: parseMinute(minute),
      label: minute,
      icon,
      teamCode: team ? team.Abbreviation || team.IdCountry : null,
      text,
    });

  for (const side of [live.HomeTeam, live.AwayTeam]) {
    if (!side) continue;
    const nameOf = (id: string) => {
      const p = side.Players.find((x) => x.IdPlayer === id);
      return p ? loc(p.ShortName) || loc(p.PlayerName) : "";
    };
    for (const g of side.Goals ?? [])
      add(side, g.Minute, "⚽", nameOf(g.IdPlayer));
    for (const b of side.Bookings ?? [])
      add(side, b.Minute, b.Card === 1 ? "🟨" : "🟥", nameOf(b.IdPlayer));
    for (const s of side.Substitutions ?? [])
      add(
        side,
        s.Minute,
        "🔁",
        `${loc(s.PlayerOnName)} ↑ · ${loc(s.PlayerOffName)} ↓`
      );
  }
  return ev.sort((a, b) => a.minute - b.minute);
}

export async function fetchMatchDetail(
  idStage: string,
  idMatch: string
): Promise<MatchDetail> {
  const d = await getJson<RawLive>(
    `/live/football/${COMPETITION}/${SEASON}/${idStage}/${idMatch}?language=${LANG}`
  );
  const homeLineup = buildLineup(d.HomeTeam);
  const awayLineup = buildLineup(d.AwayTeam);
  if (homeLineup) layout(homeLineup.onPitch, homeLineup.tactics, false);
  if (awayLineup) layout(awayLineup.onPitch, awayLineup.tactics, true);

  const ref =
    d.Officials?.find((o) => o.OfficialType === 1)?.Name ?? null;

  return {
    id: d.IdMatch,
    status: mapStatus(d.MatchStatus),
    minute: d.MatchTime,
    iso: d.Date,
    venue: d.Stadium ? loc(d.Stadium.Name) || null : null,
    city: d.Stadium ? loc(d.Stadium.CityName) || null : null,
    referee: ref ? loc(ref) : null,
    attendance: d.Attendance,
    home: {
      code: d.HomeTeam?.Abbreviation || d.HomeTeam?.IdCountry || null,
      name: d.HomeTeam ? loc(d.HomeTeam.TeamName) : "",
      score: d.HomeTeam?.Score ?? null,
    },
    away: {
      code: d.AwayTeam?.Abbreviation || d.AwayTeam?.IdCountry || null,
      name: d.AwayTeam ? loc(d.AwayTeam.TeamName) : "",
      score: d.AwayTeam?.Score ?? null,
    },
    homeLineup,
    awayLineup,
    events: buildEvents(d),
  };
}

// ---------------------------------------------------------------------------
// Event positions (shot/event map) + player profiles
// ---------------------------------------------------------------------------

export interface PitchEvent {
  id: string;
  type: number;
  label: string;
  minute: string;
  teamId: string | null;
  playerId: string | null;
  x: number | null; // 0..100 along the pitch length (null if not located)
  y: number | null; // 0..100 across the width
  isGoal: boolean;
  isShot: boolean;
}

// FIFA event Type ids.
const EV = {
  GOAL: 0,
  YELLOW: 2,
  RED: 3,
  SUB: 5,
  ATTEMPT: 12,
  OFFSIDE: 15,
  CORNER: 16,
  FOUL: 18,
  SAVE: 57, // "Goal Prevention"
} as const;
const SHOT_TYPES = new Set<number>([EV.GOAL, EV.ATTEMPT]);

interface RawEvent {
  EventId: string;
  Type: number;
  TypeLocalized: Localized;
  MatchMinute: string;
  IdTeam: string | null;
  IdPlayer: string | null;
  PositionX: number | null;
  PositionY: number | null;
}

/** All timeline events (located or not); the map uses the located subset. */
export async function fetchEvents(
  idStage: string,
  idMatch: string
): Promise<PitchEvent[]> {
  const d = await getJson<{ Event: RawEvent[] }>(
    `/timelines/${COMPETITION}/${SEASON}/${idStage}/${idMatch}?language=${LANG}`
  );
  return (d.Event ?? []).map((e) => ({
    id: e.EventId,
    type: e.Type,
    label: loc(e.TypeLocalized, "Event"),
    minute: e.MatchMinute,
    teamId: e.IdTeam,
    playerId: e.IdPlayer,
    x: e.PositionX,
    y: e.PositionY,
    isGoal: e.Type === EV.GOAL,
    isShot: SHOT_TYPES.has(e.Type),
  }));
}

export interface TeamStats {
  attempts: number;
  goals: number;
  saves: number;
  corners: number;
  fouls: number;
  offsides: number;
  yellow: number;
  red: number;
  subs: number;
}

const emptyStats = (): TeamStats => ({
  attempts: 0,
  goals: 0,
  saves: 0,
  corners: 0,
  fouls: 0,
  offsides: 0,
  yellow: 0,
  red: 0,
  subs: 0,
});

/** Match statistics tallied from the official event feed (no aggregate endpoint). */
export function matchStats(
  events: PitchEvent[],
  homeId: string | null,
  awayId: string | null
): { home: TeamStats; away: TeamStats } {
  const home = emptyStats();
  const away = emptyStats();
  for (const e of events) {
    const s = e.teamId === homeId ? home : e.teamId === awayId ? away : null;
    if (!s) continue;
    switch (e.type) {
      case EV.ATTEMPT:
        s.attempts++;
        break;
      case EV.GOAL:
        s.goals++;
        break;
      case EV.SAVE:
        s.saves++;
        break;
      case EV.CORNER:
        s.corners++;
        break;
      case EV.FOUL:
        s.fouls++;
        break;
      case EV.OFFSIDE:
        s.offsides++;
        break;
      case EV.YELLOW:
        s.yellow++;
        break;
      case EV.RED:
        s.red++;
        break;
      case EV.SUB:
        s.subs++;
        break;
    }
  }
  return { home, away };
}

export interface PlayerProfile {
  caps: number | null;
  careerGoals: number | null;
  foot: string | null;
}

function footLabel(v: number | null | undefined): string | null {
  if (v === 1) return "Right foot";
  if (v === 2) return "Left foot";
  if (v === 3) return "Both feet";
  return null;
}

/** Extra career profile for a player (international caps, goals, preferred foot). */
export async function fetchPlayer(id: string): Promise<PlayerProfile> {
  const d = await getJson<{
    InternationalCaps: number | null;
    Goals: number | null;
    PreferredFoot: number | null;
  }>(`/players/${id}?language=${LANG}`);
  return {
    caps: d.InternationalCaps ?? null,
    careerGoals: d.Goals ?? null,
    foot: footLabel(d.PreferredFoot),
  };
}

/** Whether a usable starting XI exists to draw a field map. */
export function hasLineup(d: MatchDetail): boolean {
  return (
    (d.homeLineup?.onPitch.length === 11 &&
      d.awayLineup?.onPitch.length === 11) ||
    false
  );
}

/** Distinct stage names in calendar order, for the fixtures filter. */
const STAGE_ORDER = [
  "First Stage",
  "Round of 32",
  "Round of 16",
  "Quarter-final",
  "Semi-final",
  "Play-off for third place",
  "Final",
];
export function stagesFromMatches(matches: Match[]): string[] {
  const present = new Set(matches.map((m) => m.stage));
  return STAGE_ORDER.filter((s) => present.has(s));
}

// ---------------------------------------------------------------------------
// Knockout bracket
// ---------------------------------------------------------------------------

const KNOCKOUT_ROUNDS = [
  "Round of 32",
  "Round of 16",
  "Quarter-final",
  "Semi-final",
  "Final",
];

export interface BracketNode {
  match: Match;
  matchNo: number;
  round: number; // 0 = Round of 32 … 4 = Final
  children: number[]; // feeding match numbers (winners), [] for Round of 32
  row: number; // vertical slot used to draw the tree
}

export interface Bracket {
  rounds: BracketNode[][]; // [R32, R16, QF, SF, Final]
  thirdPlace: Match | null;
}

/** "W73" → 73; group-slot placeholders like "2A" → null. */
function feederNumber(placeholder: string | null): number | null {
  if (!placeholder) return null;
  const m = /^W(\d+)$/i.exec(placeholder.trim());
  return m ? parseInt(m[1], 10) : null;
}

/**
 * Builds the single-elimination tree from the match feed. Each knockout match
 * carries its bracket position via `MatchNumber` and `W<n>` placeholders, so the
 * tree (and therefore the connecting lines) is exact.
 */
export function buildBracket(matches: Match[]): Bracket {
  const roundOf = new Map(KNOCKOUT_ROUNDS.map((s, i) => [s, i]));
  const byNo = new Map<number, Match>();
  for (const m of matches) {
    if (m.matchNumber != null && roundOf.has(m.stage)) byNo.set(m.matchNumber, m);
  }

  const childrenOf = (m: Match): number[] =>
    [feederNumber(m.home.placeholder), feederNumber(m.away.placeholder)].filter(
      (n): n is number => n != null && byNo.has(n)
    );

  // Assign each match a vertical row: leaves get sequential slots, internal
  // nodes sit at the midpoint of their two children (a real bracket layout).
  const rowOf = new Map<number, number>();
  let nextLeaf = 0;
  const assign = (no: number): number => {
    const m = byNo.get(no);
    if (!m) return nextLeaf++;
    const kids = childrenOf(m);
    if (kids.length < 2) {
      const r = nextLeaf++;
      rowOf.set(no, r);
      return r;
    }
    const center = (assign(kids[0]) + assign(kids[1])) / 2;
    rowOf.set(no, center);
    return center;
  };

  const finalMatch = matches.find((m) => m.stage === "Final");
  if (finalMatch?.matchNumber != null) assign(finalMatch.matchNumber);
  // Cover any matches not reachable from the final (defensive).
  for (const [no] of byNo) if (!rowOf.has(no)) assign(no);

  const rounds: BracketNode[][] = KNOCKOUT_ROUNDS.map(() => []);
  for (const [no, m] of byNo) {
    const round = roundOf.get(m.stage)!;
    rounds[round].push({
      match: m,
      matchNo: no,
      round,
      children: childrenOf(m),
      row: rowOf.get(no) ?? 0,
    });
  }
  rounds.forEach((r) => r.sort((a, b) => a.row - b.row));

  const thirdPlace =
    matches.find((m) => m.stage === "Play-off for third place") ?? null;

  return { rounds, thirdPlace };
}

/** Group-stage matches grouped by group letter, in kickoff order. */
export function groupMatchups(
  matches: Match[]
): { group: string; idGroup: string; matches: Match[] }[] {
  const map = new Map<string, { group: string; idGroup: string; matches: Match[] }>();
  for (const m of matches) {
    if (!m.idGroup || !m.group) continue;
    let g = map.get(m.idGroup);
    if (!g) {
      g = { group: m.group, idGroup: m.idGroup, matches: [] };
      map.set(m.idGroup, g);
    }
    g.matches.push(m);
  }
  const out = [...map.values()];
  out.forEach((g) => g.matches.sort((a, b) => a.kickoff - b.kickoff));
  out.sort((a, b) => a.group.localeCompare(b.group));
  return out;
}

/**
 * The "current" match to feature: a live one if any, otherwise the most recently
 * kicked-off match, otherwise the next upcoming one. Used to auto-load a stream.
 */
export function pickLatestMatch(matches: Match[]): Match | null {
  if (!matches.length) return null;
  const live = matches.filter((m) => m.status === "live");
  if (live.length) return live.sort((a, b) => b.kickoff - a.kickoff)[0];
  const now = Date.now();
  const started = matches
    .filter((m) => m.kickoff <= now)
    .sort((a, b) => b.kickoff - a.kickoff);
  if (started.length) return started[0];
  return matches.slice().sort((a, b) => a.kickoff - b.kickoff)[0];
}
