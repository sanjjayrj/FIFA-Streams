import type { TeamStats } from "../data/fifa";

function StatRow({ label, h, a }: { label: string; h: number; a: number }) {
  const total = h + a || 1;
  return (
    <div className="stat-row">
      <span className="stat-val">{h}</span>
      <div className="stat-mid">
        <div className="stat-label">{label}</div>
        <div className="stat-track">
          <div className="stat-fill home" style={{ width: `${(h / total) * 100}%` }} />
          <div className="stat-fill away" style={{ width: `${(a / total) * 100}%` }} />
        </div>
      </div>
      <span className="stat-val">{a}</span>
    </div>
  );
}

export function MatchStats({
  home,
  away,
}: {
  home: TeamStats;
  away: TeamStats;
}) {
  const rows = (
    [
      ["Shots", home.attempts, away.attempts],
      ["Goals", home.goals, away.goals],
      ["Saves", home.saves, away.saves],
      ["Corners", home.corners, away.corners],
      ["Fouls", home.fouls, away.fouls],
      ["Offsides", home.offsides, away.offsides],
      ["Yellow cards", home.yellow, away.yellow],
      ["Red cards", home.red, away.red],
      ["Substitutions", home.subs, away.subs],
    ] as [string, number, number][]
  ).filter(([, h, a]) => h + a > 0);

  if (!rows.length) return null;

  return (
    <div className="mp-section">
      <h3 className="mp-h3">Match stats</h3>
      <div className="stats-list">
        {rows.map(([label, h, a]) => (
          <StatRow key={label} label={label} h={h} a={a} />
        ))}
      </div>
    </div>
  );
}
