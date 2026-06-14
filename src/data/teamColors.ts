// Primary (and where useful, alternate) kit colours for national teams, keyed by
// FIFA 3-letter code. Used so each team shows in its recognizable jersey colour
// instead of a generic home=green / away=red. The FIFA API doesn't expose kit
// colours, so this is a curated set for the 48 World Cup 2026 nations.
//
// `s` is a contrasting alternate used only when the two teams in a match clash.

interface Kit {
  p: string; // primary
  s?: string; // alternate (for clashes)
}

const TEAM_COLORS: Record<string, Kit> = {
  USA: { p: "#2C3E92", s: "#ffffff" },
  CAN: { p: "#D52B1E", s: "#ffffff" },
  MEX: { p: "#157A3C", s: "#ffffff" },
  JPN: { p: "#0033A0", s: "#ffffff" },
  NZL: { p: "#e9e9e9", s: "#111111" },
  IRN: { p: "#C8102E", s: "#ffffff" },
  ARG: { p: "#75AADB", s: "#1a1a6e" },
  UZB: { p: "#0099B5", s: "#ffffff" },
  JOR: { p: "#CE1126", s: "#ffffff" },
  KOR: { p: "#CD2E3A", s: "#1b3aa0" },
  AUS: { p: "#FFCD00", s: "#0a5c36" },
  BRA: { p: "#FFDF00", s: "#0033A0" },
  ECU: { p: "#FFD100", s: "#0033A0" },
  COL: { p: "#FCD116", s: "#003087" },
  PAR: { p: "#D52B1E", s: "#1a3a8f" },
  URU: { p: "#5AB1E6", s: "#0a2a6e" },
  MAR: { p: "#C1272D", s: "#0a6b3a" },
  TUN: { p: "#E70013", s: "#ffffff" },
  EGY: { p: "#CE1126", s: "#ffffff" },
  ALG: { p: "#0a7d3b", s: "#ffffff" },
  GHA: { p: "#CE1126", s: "#111111" },
  CPV: { p: "#003893", s: "#ffffff" },
  RSA: { p: "#007749", s: "#FFB81C" },
  QAT: { p: "#8A1538", s: "#ffffff" },
  ENG: { p: "#e9e9e9", s: "#CE1126" },
  KSA: { p: "#006C35", s: "#ffffff" },
  CIV: { p: "#FF7F00", s: "#0a6b3a" },
  SEN: { p: "#00853F", s: "#ffffff" },
  FRA: { p: "#002395", s: "#ffffff" },
  CRO: { p: "#E40521", s: "#1a3a8f" },
  POR: { p: "#DA291C", s: "#0a6b3a" },
  NOR: { p: "#BA0C2F", s: "#0a2a6e" },
  GER: { p: "#e9e9e9", s: "#111111" },
  NED: { p: "#FF6900", s: "#0a2a6e" },
  BEL: { p: "#C8102E", s: "#FFCD00" },
  ESP: { p: "#C60B1E", s: "#0a2a6e" },
  SUI: { p: "#D52B1E", s: "#ffffff" },
  AUT: { p: "#EF3340", s: "#ffffff" },
  SCO: { p: "#0a4d8c", s: "#e9e9e9" },
  PAN: { p: "#D21034", s: "#1a3a8f" },
  CUW: { p: "#002B7F", s: "#ffffff" },
  HAI: { p: "#00209F", s: "#D21034" },
  BIH: { p: "#002F6C", s: "#FFCD00" },
  COD: { p: "#1a9bff", s: "#0a2a6e" },
  CZE: { p: "#D7141A", s: "#11457e" },
  IRQ: { p: "#0a7d3b", s: "#ffffff" },
  SWE: { p: "#FECC00", s: "#0a2a6e" },
  TUR: { p: "#E30A17", s: "#ffffff" },
};

const DEFAULT_HOME = "#3b82f6";
const DEFAULT_AWAY = "#ef4444";

function hexToRgb(h: string): [number, number, number] {
  const v = h.replace("#", "");
  return [
    parseInt(v.slice(0, 2), 16),
    parseInt(v.slice(2, 4), 16),
    parseInt(v.slice(4, 6), 16),
  ];
}

/** Eye-weighted colour distance (0 = identical, ~765 = max). */
function distance(a: string, b: string): number {
  const [r1, g1, b1] = hexToRgb(a);
  const [r2, g2, b2] = hexToRgb(b);
  return Math.sqrt(
    2 * (r1 - r2) ** 2 + 4 * (g1 - g2) ** 2 + 3 * (b1 - b2) ** 2
  );
}

const CLASH = 130;

/** Primary kit colour for a single team (for fixture chips etc.). */
export function teamColor(code: string | null | undefined): string {
  if (!code) return DEFAULT_HOME;
  return TEAM_COLORS[code]?.p ?? DEFAULT_HOME;
}

/**
 * Distinguishable kit colours for the two teams in a match. Home keeps its
 * primary; away switches to an alternate when the two would clash.
 */
export function matchColors(
  homeCode: string | null | undefined,
  awayCode: string | null | undefined
): { home: string; away: string } {
  const home = homeCode ? TEAM_COLORS[homeCode]?.p ?? DEFAULT_HOME : DEFAULT_HOME;
  const awayKit = awayCode ? TEAM_COLORS[awayCode] : undefined;
  let away = awayKit?.p ?? DEFAULT_AWAY;

  if (distance(home, away) >= CLASH) return { home, away };

  // Clash: try the away alternate, then the home alternate, then a hard fallback.
  if (awayKit?.s && distance(home, awayKit.s) >= CLASH) {
    return { home, away: awayKit.s };
  }
  const homeKit = homeCode ? TEAM_COLORS[homeCode] : undefined;
  if (homeKit?.s && distance(homeKit.s, away) >= CLASH) {
    return { home: homeKit.s, away };
  }
  const [r, g, b] = hexToRgb(home);
  const lum = (r * 299 + g * 587 + b * 114) / 1000;
  away = lum > 140 ? "#1a1a1a" : "#f1f1f1";
  return { home, away };
}
