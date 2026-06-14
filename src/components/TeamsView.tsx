import { useMemo, useState } from "react";
import {
  fetchSquad,
  flagUrl,
  type NationTeam,
  type SquadPlayer,
} from "../data/fifa";
import { useAsync, useFavourites } from "../hooks";
import { PlayerAvatar } from "./PlayerAvatar";

export function SquadDetail({
  team,
  onBack,
}: {
  team: NationTeam;
  onBack: () => void;
}) {
  const { data, loading, error } = useAsync<SquadPlayer[]>(
    () => fetchSquad(team.id),
    [team.id]
  );

  const grouped = useMemo(() => {
    const labels = ["Goalkeepers", "Defenders", "Midfielders", "Forwards"];
    const buckets: { label: string; players: SquadPlayer[] }[] = [];
    for (const p of data ?? []) {
      const label = labels[p.positionOrder] ?? p.position ?? "Squad";
      let b = buckets.find((x) => x.label === label);
      if (!b) {
        b = { label, players: [] };
        buckets.push(b);
      }
      b.players.push(p);
    }
    return buckets;
  }, [data]);

  return (
    <div className="squad">
      <button className="back-btn" onClick={onBack}>
        ← All teams
      </button>
      <div className="squad-head">
        <img className="squad-flag" src={flagUrl(team.code)!} alt="" />
        <div>
          <div className="squad-name">{team.name}</div>
          <div className="squad-sub">
            {data ? `${data.length} players` : "Squad"}
          </div>
        </div>
      </div>

      {loading && <div className="panel-empty">Loading squad…</div>}
      {error && <div className="panel-error">Couldn’t load squad: {error}</div>}

      {grouped.map((b) => (
        <div className="squad-group" key={b.label}>
          <div className="squad-group-label">{b.label}</div>
          {b.players.map((p) => (
            <div className="player-row" key={p.id}>
              <span className="player-num">{p.jersey ?? "–"}</span>
              <PlayerAvatar src={p.photo} className="player-photo" />
              <div className="player-info">
                <span className="player-name">{p.name}</span>
                <span className="player-meta">
                  {p.position}
                  {p.age != null ? ` · ${p.age}y` : ""}
                  {p.heightCm ? ` · ${p.heightCm}cm` : ""}
                </span>
              </div>
              <div className="player-stats">
                {p.goals ? <span className="stat-goal">⚽{p.goals}</span> : null}
                {p.yellow ? <span className="stat-yc">{p.yellow}</span> : null}
                {p.red ? <span className="stat-rc">{p.red}</span> : null}
              </div>
            </div>
          ))}
        </div>
      ))}
    </div>
  );
}

export function TeamsView({ teams }: { teams: NationTeam[] }) {
  const [query, setQuery] = useState("");
  const [selected, setSelected] = useState<NationTeam | null>(null);
  const fav = useFavourites();

  if (selected) {
    return <SquadDetail team={selected} onBack={() => setSelected(null)} />;
  }

  const q = query.trim().toLowerCase();
  const filtered = teams
    .filter(
      (t) =>
        !q || t.name.toLowerCase().includes(q) || t.code.toLowerCase().includes(q)
    )
    .sort(
      (a, b) => Number(fav.has(b.code)) - Number(fav.has(a.code))
    );

  return (
    <div className="teams-view">
      <input
        className="teams-search"
        placeholder="Search team…"
        value={query}
        onChange={(e) => setQuery(e.target.value)}
      />
      <div className="teams-list">
        {filtered.map((t) => (
          <div className="team-row tappable" key={t.id}>
            <button
              className="star-btn"
              onClick={() => fav.toggle(t.code)}
              title={fav.has(t.code) ? "Unfollow" : "Follow team"}
            >
              {fav.has(t.code) ? "★" : "☆"}
            </button>
            <button className="team-open" onClick={() => setSelected(t)}>
              <img className="mini-flag" src={flagUrl(t.code)!} alt="" />
              <span className="team-name">{t.name}</span>
              <span className="team-fifa">{t.code}</span>
              <span className="team-chevron">›</span>
            </button>
          </div>
        ))}
        {filtered.length === 0 && (
          <div className="teams-empty">No teams match “{query}”.</div>
        )}
      </div>
    </div>
  );
}
