import { fetchScorers, flagUrl, type PlayerTally } from "../data/fifa";
import { teamColor } from "../data/teamColors";
import { useAsync } from "../hooks";

export function ScorersView() {
  const { data, loading, error } = useAsync<PlayerTally[]>(
    fetchScorers,
    [],
    60_000
  );
  const scorers = (data ?? []).filter((p) => p.goals > 0);

  if (loading && !data)
    return (
      <div className="panel-empty">
        <div className="spinner small" />
        Tallying scorers across every match…
      </div>
    );
  if (error)
    return <div className="panel-error">Couldn’t load scorers: {error}</div>;
  if (!scorers.length)
    return <div className="panel-empty">No goals scored yet.</div>;

  let rank = 0;
  let prevGoals = -1;
  return (
    <div className="scorers">
      <div className="scorers-head">
        <span>Golden Boot</span>
        <span className="scorers-sub">goals this World Cup</span>
      </div>
      {scorers.map((p, i) => {
        if (p.goals !== prevGoals) {
          rank = i + 1;
          prevGoals = p.goals;
        }
        return (
          <div className={`sc-row ${rank === 1 ? "lead" : ""}`} key={p.id}>
            <span className="sc-rank">{rank}</span>
            <span className="sc-goals">{p.goals}</span>
            {p.code && <img className="mini-flag" src={flagUrl(p.code)!} alt="" />}
            <span className="sc-name">{p.name}</span>
            <span className="sc-team" style={{ color: teamColor(p.code) }}>
              {p.code}
            </span>
          </div>
        );
      })}
    </div>
  );
}
