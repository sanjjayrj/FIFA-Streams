import { useMemo, useState } from "react";
import { Check, RotateCcw, X } from "lucide-react";
import {
  buildBracket,
  flagUrl,
  groupMatchups,
  type BracketNode,
  type Match,
  type MatchTeam,
} from "../data/fifa";
import { useElementSize, usePersistentState } from "../hooks";
import {
  actualWinner,
  predictionScore,
  prunePicks,
  resolveMatch,
  type PickTeam,
  type Picks,
} from "../lib/predictor";

const ROUND_LABEL = ["R32", "R16", "QF", "SF", "Final"];
const clamp = (v: number, lo: number, hi: number) =>
  Math.max(lo, Math.min(hi, v));

interface Dims {
  colW: number;
  gap: number;
  rowH: number;
  cardH: number;
}
const colX = (col: number, d: Dims) => col * (d.colW + d.gap);
const rowY = (row: number, d: Dims) => (row + 0.5) * d.rowH;

// ── View mode (actual results) ──────────────────────────────────────────────
function Slot({ team, won }: { team: MatchTeam; won: boolean }) {
  if (team.code)
    return (
      <div className={`bk-slot ${won ? "won" : ""}`}>
        <img className="bk-flag" src={flagUrl(team.code)!} alt="" />
        <span className="bk-abbr">{team.code}</span>
        <span className="bk-score">{team.score ?? ""}</span>
      </div>
    );
  return (
    <div className="bk-slot tbd">
      <span className="bk-tbd">{team.placeholder || "TBD"}</span>
    </div>
  );
}

function ViewCard({
  node,
  col,
  dims,
  onSelect,
}: {
  node: BracketNode;
  col: number;
  dims: Dims;
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
        left: colX(col, dims),
        top: rowY(node.row, dims) - dims.cardH / 2,
        width: dims.colW,
        height: dims.cardH,
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

// ── Predict mode ─────────────────────────────────────────────────────────────
function PSlot({
  team,
  placeholder,
  highlight,
  pickable,
  onClick,
}: {
  team: PickTeam | null;
  placeholder: string | null;
  highlight: boolean;
  pickable: boolean;
  onClick: () => void;
}) {
  if (!team)
    return (
      <div className="bk-slot tbd">
        <span className="bk-tbd">{placeholder || "TBD"}</span>
      </div>
    );
  const inner = (
    <>
      <img className="bk-flag" src={flagUrl(team.code)!} alt="" />
      <span className="bk-abbr">{team.code}</span>
    </>
  );
  const cls = `bk-slot ${highlight ? "won" : ""} ${pickable ? "pickable" : ""}`;
  return pickable ? (
    <button className={cls} onClick={onClick} title={`Pick ${team.name}`}>
      {inner}
    </button>
  ) : (
    <div className={cls}>{inner}</div>
  );
}

function PredictCard({
  node,
  col,
  dims,
  picks,
  byNo,
  onPick,
}: {
  node: BracketNode;
  col: number;
  dims: Dims;
  picks: Picks;
  byNo: Map<number, BracketNode>;
  onPick: (matchNo: number, team: PickTeam) => void;
}) {
  const r = resolveMatch(node, picks, byNo);
  const finished = node.match.status === "finished";
  const aw = actualWinner(node.match);
  const myPick = picks[node.matchNo];
  const pickable = !finished && !!r.home && !!r.away;
  const hiHome = finished
    ? !!aw && aw.code === r.home?.code
    : !!myPick && myPick.code === r.home?.code;
  const hiAway = finished
    ? !!aw && aw.code === r.away?.code
    : !!myPick && myPick.code === r.away?.code;
  const correct = finished && myPick ? myPick.code === aw?.code : null;
  return (
    <div
      className={`bk-card predict status-${node.match.status} ${
        finished ? "locked" : ""
      }`}
      style={{
        left: colX(col, dims),
        top: rowY(node.row, dims) - dims.cardH / 2,
        width: dims.colW,
        height: dims.cardH,
      }}
    >
      {correct != null && (
        <span className={`bk-mark ${correct ? "ok" : "no"}`}>
          {correct ? <Check size={11} /> : <X size={11} />}
        </span>
      )}
      <PSlot
        team={r.home}
        placeholder={node.match.home.placeholder}
        highlight={hiHome}
        pickable={pickable}
        onClick={() => r.home && onPick(node.matchNo, r.home)}
      />
      <PSlot
        team={r.away}
        placeholder={node.match.away.placeholder}
        highlight={hiAway}
        pickable={pickable}
        onClick={() => r.away && onPick(node.matchNo, r.away)}
      />
    </div>
  );
}

// ── Shared tree renderer ─────────────────────────────────────────────────────
function Knockout({
  rounds,
  byNo,
  thirdPlace,
  onSelect,
  predict,
}: {
  rounds: BracketNode[][];
  byNo: Map<number, BracketNode>;
  thirdPlace: Match | null;
  onSelect: (m: Match) => void;
  predict: { picks: Picks; onPick: (n: number, t: PickTeam) => void } | null;
}) {
  const { ref, width: availW, height: availH } = useElementSize();

  if (!rounds.some((r) => r.length))
    return <div className="panel-empty">Bracket not available yet.</div>;

  // Mirrored grid: rounds 0..maxRound run left→centre, then mirror back out.
  const maxRound = rounds.length - 1; // Final's round index
  const cols = 2 * maxRound + 1; // R32…SF | Final | SF…R32
  const colOf = (n: BracketNode) =>
    n.side === "right" ? cols - 1 - n.round : n.round;

  const r32 = rounds[0] ?? [];
  const leftLeaves = r32.filter((n) => n.side !== "right").length;
  const rightLeaves = r32.filter((n) => n.side === "right").length;
  const leaves = Math.max(leftLeaves, rightLeaves, 1);

  const colW = clamp((availW - 6) / (cols + 0.18 * (cols - 1)), 108, 200);
  const gap = colW * 0.18;
  const rowH = clamp(availH > 0 ? availH / leaves : 90, 58, 104);
  const dims: Dims = { colW, gap, rowH, cardH: Math.min(rowH - 12, 64) };
  const width = cols * colW + (cols - 1) * gap;
  const height = leaves * rowH;
  const nodes = rounds.flat();

  const headLabels = Array.from({ length: cols }, (_, c) =>
    c <= maxRound ? ROUND_LABEL[c] : ROUND_LABEL[cols - 1 - c]
  );

  return (
    <div className="bracket-scroll" ref={ref}>
      <div style={{ width, minWidth: width }}>
        <div className="bracket-headers" style={{ gap }}>
          {headLabels.map((l, c) => (
            <div
              key={c}
              className={`bracket-head ${c === maxRound ? "final" : ""}`}
              style={{ width: colW }}
            >
              {l}
            </div>
          ))}
        </div>

        <div className="bracket-canvas" style={{ width, height }}>
          <svg className="bracket-lines" width={width} height={height}>
            {nodes.map((node) =>
              node.children.map((childNo) => {
                const child = byNo.get(childNo);
                if (!child) return null;
                const pCol = colOf(node);
                const cCol = colOf(child);
                const childLeft = cCol < pCol; // child sits left of its parent
                const x1 = childLeft ? colX(cCol, dims) + colW : colX(cCol, dims);
                const x2 = childLeft ? colX(pCol, dims) : colX(pCol, dims) + colW;
                const y1 = rowY(child.row, dims);
                const y2 = rowY(node.row, dims);
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

          {nodes.map((node) =>
            predict ? (
              <PredictCard
                key={node.matchNo}
                node={node}
                col={colOf(node)}
                dims={dims}
                picks={predict.picks}
                byNo={byNo}
                onPick={predict.onPick}
              />
            ) : (
              <ViewCard
                key={node.matchNo}
                node={node}
                col={colOf(node)}
                dims={dims}
                onSelect={onSelect}
              />
            )
          )}
        </div>

        {thirdPlace && !predict && (
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

// ── Group matchups ───────────────────────────────────────────────────────────
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
  if (!groups.length)
    return <div className="panel-empty">No group matchups yet.</div>;
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

// ── Container ────────────────────────────────────────────────────────────────
export function BracketView({
  matches,
  onSelect,
}: {
  matches: Match[];
  onSelect: (m: Match) => void;
}) {
  const [mode, setMode] = useState<"bracket" | "predict" | "groups">("bracket");
  const [picks, setPicks] = usePersistentState<Picks>("fifa.picks", {});

  const { rounds, thirdPlace } = useMemo(
    () => buildBracket(matches),
    [matches]
  );
  const byNo = useMemo(() => {
    const m = new Map<number, BracketNode>();
    rounds.flat().forEach((n) => m.set(n.matchNo, n));
    return m;
  }, [rounds]);
  const nodes = useMemo(() => rounds.flat(), [rounds]);

  const onPick = (matchNo: number, team: PickTeam) =>
    setPicks((prev) => prunePicks({ ...prev, [matchNo]: team }, nodes, byNo));

  const score = useMemo(
    () => predictionScore(nodes, picks),
    [nodes, picks]
  );
  const pickCount = Object.keys(picks).length;

  return (
    <div className="bracket-view">
      <div className="bracket-modes">
        {(["bracket", "predict", "groups"] as const).map((id) => (
          <button
            key={id}
            className={`mode-btn ${mode === id ? "active" : ""}`}
            onClick={() => setMode(id)}
          >
            {id === "bracket"
              ? "Bracket"
              : id === "predict"
              ? "Predict"
              : "Groups"}
          </button>
        ))}
      </div>

      {mode === "predict" && (
        <div className="predict-bar">
          <span className="predict-info">
            Tap a team to send them through.
            {score.total > 0 && (
              <b className="predict-score">
                {" "}
                {score.correct}/{score.total} right
              </b>
            )}
          </span>
          {pickCount > 0 && (
            <button className="predict-reset" onClick={() => setPicks({})}>
              <RotateCcw size={13} /> Reset
            </button>
          )}
        </div>
      )}

      {mode === "groups" ? (
        <div className="bracket-groups-mode">
          <Groups matches={matches} onSelect={onSelect} />
        </div>
      ) : (
        <Knockout
          rounds={rounds}
          byNo={byNo}
          thirdPlace={thirdPlace}
          onSelect={onSelect}
          predict={mode === "predict" ? { picks, onPick } : null}
        />
      )}
    </div>
  );
}
