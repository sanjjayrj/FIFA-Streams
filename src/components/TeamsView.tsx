import { useState } from "react";
import { flagUrl, type Match, type NationTeam } from "../data/fifa";
import { Star } from "lucide-react";
import { useFavourites } from "../hooks";
import { TeamPage } from "./TeamPage";

export function TeamsView({
  teams,
  matches,
  onSelectMatch,
}: {
  teams: NationTeam[];
  matches: Match[];
  onSelectMatch?: (m: Match) => void;
}) {
  const [query, setQuery] = useState("");
  const [selected, setSelected] = useState<NationTeam | null>(null);
  const fav = useFavourites();

  if (selected) {
    return (
      <TeamPage
        team={selected}
        matches={matches}
        onBack={() => setSelected(null)}
        onSelectMatch={onSelectMatch}
      />
    );
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
              className={`star-btn ${fav.has(t.code) ? "on" : ""}`}
              onClick={() => fav.toggle(t.code)}
              title={fav.has(t.code) ? "Unfollow" : "Follow team"}
            >
              <Star size={15} className={fav.has(t.code) ? "fill-star" : ""} />
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
