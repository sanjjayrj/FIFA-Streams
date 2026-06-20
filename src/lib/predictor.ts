// Knockout-bracket predictor logic. Picks (matchNo → predicted winner) propagate
// down the tree; finished matches advance their *actual* winner so reality always
// wins. Pure functions so they can be unit-checked.

import type { BracketNode, Match } from "../data/fifa";

export interface PickTeam {
  code: string;
  name: string;
}
export type Picks = Record<number, PickTeam>;

/** "W73" → 73; group-slot placeholders ("2A") → null. */
export function parseFeeder(placeholder: string | null): number | null {
  if (!placeholder) return null;
  const m = /^W(\d+)$/i.exec(placeholder.trim());
  return m ? parseInt(m[1], 10) : null;
}

/** The real winner of a finished match (incl. penalties), or null. */
export function actualWinner(m: Match): PickTeam | null {
  if (m.status !== "finished") return null;
  const { home: h, away: a } = m;
  if (h.score == null || a.score == null || !h.code || !a.code) return null;
  if (h.score > a.score) return { code: h.code, name: h.name };
  if (a.score > h.score) return { code: a.code, name: a.name };
  if (m.homePens != null && m.awayPens != null) {
    if (m.homePens > m.awayPens) return { code: h.code, name: h.name };
    if (m.awayPens > m.homePens) return { code: a.code, name: a.name };
  }
  return null;
}

/** Who advances out of a match: the actual winner if decided, else the pick. */
function advancer(node: BracketNode, picks: Picks): PickTeam | null {
  return actualWinner(node.match) ?? picks[node.matchNo] ?? null;
}

/** Resolve one slot of a match: a real team, a propagated winner, or null. */
export function resolveSlot(
  node: BracketNode,
  side: "home" | "away",
  picks: Picks,
  byNo: Map<number, BracketNode>
): PickTeam | null {
  const t = node.match[side];
  if (t.code) return { code: t.code, name: t.name };
  const feeder = parseFeeder(t.placeholder);
  if (feeder == null) return null;
  const fn = byNo.get(feeder);
  return fn ? advancer(fn, picks) : null;
}

export interface ResolvedMatch {
  home: PickTeam | null;
  away: PickTeam | null;
}

export function resolveMatch(
  node: BracketNode,
  picks: Picks,
  byNo: Map<number, BracketNode>
): ResolvedMatch {
  return {
    home: resolveSlot(node, "home", picks, byNo),
    away: resolveSlot(node, "away", picks, byNo),
  };
}

/** Drop picks that are no longer a valid participant (after an upstream change). */
export function prunePicks(
  picks: Picks,
  nodes: BracketNode[],
  byNo: Map<number, BracketNode>
): Picks {
  const cur: Picks = { ...picks };
  let changed = true;
  while (changed) {
    changed = false;
    for (const node of nodes) {
      const p = cur[node.matchNo];
      if (!p) continue;
      const { home, away } = resolveMatch(node, cur, byNo);
      const valid =
        (home && home.code === p.code) || (away && away.code === p.code);
      if (!valid) {
        delete cur[node.matchNo];
        changed = true;
      }
    }
  }
  return cur;
}

/** Of decided matches the user predicted, how many were right. */
export function predictionScore(
  nodes: BracketNode[],
  picks: Picks
): { correct: number; total: number } {
  let correct = 0;
  let total = 0;
  for (const node of nodes) {
    const w = actualWinner(node.match);
    const p = picks[node.matchNo];
    if (w && p) {
      total++;
      if (p.code === w.code) correct++;
    }
  }
  return { correct, total };
}
