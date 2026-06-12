import { useMemo, useState } from "react";
import {
  buildBracket,
  flagUrl,
  groupMatchups,
  type BracketNode,
  type Match,
  type MatchTeam,
} from "../data/fifa";

const ROUND_LABEL = ["R32", "R16", "QF", "SF", "Final"];

// Fixed geometry so the SVG connector lines line up exactly with the cards.
const COL_W = 150;
const GAP = 30;
const ROW_H = 56;
const CARD_H = 46;
const colX = (round: number) => round * (COL_W + GAP);
const rowY = (row: number) => (row + 0.5) * ROW_H;

function Slot({ team, won }: { team: MatchTeam; won: boolean }) {
  if (team.code) {
    return (
      <div className={`bk-slot ${won ? "won" : ""}`}>
        <img className="bk-flag" src={flagUrl(team.code)!} alt="" />
        <span className="bk-abbr">{team.code}</span>
        <span className="bk-score">{team.score ?? ""}</span>
      </div>
    );
  }
  return (
    <div className="bk-slot tbd">
      <span className="bk-tbd">{team.placeholder || "TBD"}</span>
    </div>
  );
}

function Card({
  node,
  onSelect,
}: {
  node: BracketNode;
  onSelect: (m: Match) => void;
}) {
  const m = node.match;
  const decided = m.status === "finished";
  const homeWon = decided && (m.home.score ?? -1) > (m.away.score ?? -1);
  const awayWon = decided && (m.away.score ?? -1) > (m.home.score ?? -1);
  return (
    <button
      className={`bk-card status-${m.status}`}
      style={{
        left: colX(node.round),
        top: rowY(node.row) - CARD_H / 2,
        width: COL_W,
      }}
      onClick={() => onSelect(m)}
      title="Open match detail"
    >
      {m.status === "live" && <span className="bk-live live-dot" />}
      <Slot team={m.home} won={homeWon} />
      <Slot team={m.away} won={awayWon} />
    </button>
  );
}

function Knockout({
  matches,
  onSelect,
}: {
  matches: Match[];
  onSelect: (m: Match) => void;
}) {
  const { rounds, thirdPlace } = useMemo(() => buildBracket(matches), [matches]);
  const byNo = useMemo(() => {
    const map = new Map<number, BracketNode>();
    rounds.flat().forEach((n) => map.set(n.matchNo, n));
    return map;
  }, [rounds]);

  if (!rounds.some((r) => r.length)) {
    return <div className="panel-empty">Bracket not available yet.</div>;
  }

  const leaves = Math.max(rounds[0].length, 1);
  const width = rounds.length * COL_W + (rounds.length - 1) * GAP;
  const height = leaves * ROW_H;

  return (
    <div className="bracket-scroll">
      <div style={{ width }}>
        <div className="bracket-headers" style={{ gap: GAP }}>
          {ROUND_LABEL.map((l) => (
            <div key={l} className="bracket-head" style={{ width: COL_W }}>
              {l}
            </div>
          ))}
        </div>

        <div className="bracket-canvas" style={{ width, height }}>
          <svg className="bracket-lines" width={width} height={height}>
            {rounds.flat().map((node) =>
              node.children.map((childNo) => {
                const child = byNo.get(childNo);
                if (!child) return null;
                const x1 = colX(child.round) + COL_W;
                const y1 = rowY(child.row);
                const x2 = colX(node.round);
                const y2 = rowY(node.row);
                const midX = (x1 + x2) / 2;
                return (
                  <path
                    key={`${node.matchNo}-${childNo}`}
                    d={`M${x1} ${y1} H${midX} V${y2} H${x2}`}
                    fill="none"
                    stroke="var(--border)"
                    strokeWidth={2}
                  />
                );
              })
            )}
          </svg>

          {rounds.flat().map((node) => (
            <Card key={node.matchNo} node={node} onSelect={onSelect} />
          ))}
        </div>

        {thirdPlace && (
          <div className="bracket-third">
            <span className="bracket-third-label">3rd place play-off</span>
            <button
              className={`bk-card inline status-${thirdPlace.status}`}
              onClick={() => onSelect(thirdPlace)}
            >
              <Slot
                team={thirdPlace.home}
                won={
                  thirdPlace.status === "finished" &&
                  (thirdPlace.home.score ?? -1) > (thirdPlace.away.score ?? -1)
                }
              />
              <Slot
                team={thirdPlace.away}
                won={
                  thirdPlace.status === "finished" &&
                  (thirdPlace.away.score ?? -1) > (thirdPlace.home.score ?? -1)
                }
              />
            </button>
          </div>
        )}
      </div>
    </div>
  );
}

function MiniTeam({ team }: { team: MatchTeam }) {
  if (!team.code)
    return <span className="gm-tbd">{team.placeholder || "TBD"}</span>;
  return (
    <span className="gm-team">
      <img className="bk-flag" src={flagUrl(team.code)!} alt="" />
      {team.code}
    </span>
  );
}

function Groups({
  matches,
  onSelect,
}: {
  matches: Match[];
  onSelect: (m: Match) => void;
}) {
  const groups = useMemo(() => groupMatchups(matches), [matches]);
  if (!groups.length) {
    return <div className="panel-empty">No group matchups yet.</div>;
  }
  return (
    <div className="gm-grid">
      {groups.map((g) => (
        <div className="gm-card" key={g.idGroup}>
          <div className="gm-title">{g.group}</div>
          {g.matches.map((m) => (
            <button
              className="gm-row"
              key={m.id}
              onClick={() => onSelect(m)}
              title="Open match detail"
            >
              <MiniTeam team={m.home} />
              <span className="gm-vs">
                {m.status === "upcoming"
                  ? "v"
                  : `${m.home.score ?? "-"}–${m.away.score ?? "-"}`}
              </span>
              <MiniTeam team={m.away} />
              {m.status === "live" && <span className="gm-live live-dot" />}
            </button>
          ))}
        </div>
      ))}
    </div>
  );
}

export function BracketView({
  matches,
  onSelect,
}: {
  matches: Match[];
  onSelect: (m: Match) => void;
}) {
  const [mode, setMode] = useState<"bracket" | "groups">("bracket");
  return (
    <div className="bracket-view">
      <div className="bracket-modes">
        <button
          className={`mode-btn ${mode === "bracket" ? "active" : ""}`}
          onClick={() => setMode("bracket")}
        >
          Knockout bracket
        </button>
        <button
          className={`mode-btn ${mode === "groups" ? "active" : ""}`}
          onClick={() => setMode("groups")}
        >
          Group matchups
        </button>
      </div>
      {mode === "bracket" ? (
        <Knockout matches={matches} onSelect={onSelect} />
      ) : (
        <Groups matches={matches} onSelect={onSelect} />
      )}
    </div>
  );
}
