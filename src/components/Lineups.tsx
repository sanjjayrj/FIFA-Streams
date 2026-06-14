import { type LineupEntry, type TeamLineup } from "../data/fifa";

function Row({ p, started }: { p: LineupEntry; started: boolean }) {
  const swap = started ? p.offMinute : p.onMinute;
  return (
    <div className="lu-row">
      <span className="lu-num">{p.shirt ?? "–"}</span>
      <span className="lu-name">
        {p.name}
        {p.captain && <span className="lu-cap">C</span>}
      </span>
      <span className="lu-badges">
        {p.goals > 0 && (
          <span className="lu-goal">⚽{p.goals > 1 ? p.goals : ""}</span>
        )}
        {p.red ? (
          <span className="lu-card red" />
        ) : p.yellow ? (
          <span className="lu-card yellow" />
        ) : null}
        {swap && (
          <span
            className={started ? "lu-off" : "lu-on"}
            title={p.partnerName ? `${started ? "for" : "for"} ${p.partnerName}` : ""}
          >
            {started ? "↓" : "↑"} {swap}
          </span>
        )}
      </span>
    </div>
  );
}

function TeamCol({ team }: { team: TeamLineup }) {
  return (
    <div className="lu-col">
      <div className="lu-head">
        {team.code} · {team.tactics ?? ""}
      </div>
      <div className="lu-sub-h">Starting XI</div>
      {team.starters.map((p) => (
        <Row key={p.id} p={p} started />
      ))}
      {team.subs.length > 0 && <div className="lu-sub-h">Substitutes</div>}
      {team.subs.map((p) => (
        <Row key={p.id} p={p} started={false} />
      ))}
    </div>
  );
}

export function Lineups({ home, away }: { home: TeamLineup; away: TeamLineup }) {
  return (
    <div className="mp-section">
      <h3 className="mp-h3">Lineups</h3>
      <div className="lineups">
        <TeamCol team={home} />
        <TeamCol team={away} />
      </div>
    </div>
  );
}
