import { useMemo } from "react";
import { ArrowLeft } from "lucide-react";
import {
  computeGroupTables,
  fetchTeam,
  flagUrl,
  type Coach,
  type Match,
  type NationTeam,
  type SquadPlayer,
} from "../data/fifa";
import { teamColor } from "../data/teamColors";
import { useAsync, useNow } from "../hooks";
import { formatCountdown } from "../utils";
import { PlayerAvatar } from "./PlayerAvatar";

function dateShort(ms: number): string {
  return new Date(ms).toLocaleDateString(undefined, {
    month: "short",
    day: "numeric",
  });
}

/** Their group table (4 rows), with this team highlighted. */
function StandingTable({
  matches,
  code,
}: {
  matches: Match[];
  code: string;
}) {
  const table = useMemo(() => {
    const tables = computeGroupTables(matches);
    return tables.find((t) => t.rows.some((r) => r.code === code)) ?? null;
  }, [matches, code]);
  if (!table) return null;
  return (
    <div className="tp-section">
      <h3 className="tp-h">{table.group}</h3>
      <table className="group-table">
        <thead>
          <tr>
            <th className="c-pos">#</th>
            <th className="c-team">Team</th>
            <th>P</th>
            <th>W</th>
            <th>D</th>
            <th>L</th>
            <th>GD</th>
            <th className="c-pts">Pts</th>
          </tr>
        </thead>
        <tbody>
          {table.rows.map((r, i) => (
            <tr
              key={r.code}
              className={`${i < 2 ? "qualifies" : ""} ${
                r.code === code ? "tp-self" : ""
              }`}
            >
              <td className="c-pos">{i + 1}</td>
              <td className="c-team">
                {r.code && (
                  <img className="mini-flag" src={flagUrl(r.code)!} alt="" />
                )}
                <span className="mini-team">{r.name}</span>
              </td>
              <td>{r.pld}</td>
              <td>{r.w}</td>
              <td>{r.d}</td>
              <td>{r.l}</td>
              <td>{r.gd > 0 ? `+${r.gd}` : r.gd}</td>
              <td className="c-pts">{r.pts}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

function MatchRow({
  m,
  teamId,
  now,
  onSelect,
}: {
  m: Match;
  teamId: string;
  now: number;
  onSelect?: (m: Match) => void;
}) {
  const isHome = m.home.id === teamId;
  const us = isHome ? m.home : m.away;
  const opp = isHome ? m.away : m.home;
  const result =
    m.status === "finished" && us.score != null && opp.score != null
      ? us.score > opp.score
        ? "W"
        : us.score < opp.score
        ? "L"
        : "D"
      : null;
  return (
    <button className="tm-row" onClick={() => onSelect?.(m)}>
      <span className="tm-when">{dateShort(m.kickoff)}</span>
      <span className="tm-ha">{isHome ? "v" : "@"}</span>
      <span className="tm-opp">
        {opp.code ? (
          <img className="mini-flag" src={flagUrl(opp.code)!} alt="" />
        ) : (
          <span className="mini-flag tbd">?</span>
        )}
        <span className="tm-opp-name">
          {opp.code || opp.placeholder || "TBD"}
        </span>
      </span>
      <span className="tm-right">
        {m.status === "live" ? (
          <span className="tm-live">
            <span className="live-dot" /> {us.score ?? 0}–{opp.score ?? 0}
          </span>
        ) : m.status === "finished" ? (
          <span className="tm-score">
            {us.score ?? "-"}–{opp.score ?? "-"}
          </span>
        ) : (
          <span className="tm-cd">in {formatCountdown(m.kickoff - now)}</span>
        )}
        {result && <span className={`tm-res ${result}`}>{result}</span>}
      </span>
    </button>
  );
}

function CoachLine({ coach }: { coach: Coach }) {
  return (
    <div className="tp-coach">
      <PlayerAvatar src={coach.photo} className="tp-coach-photo" />
      <div>
        <div className="tp-coach-name">{coach.name}</div>
        <div className="tp-coach-role">Head coach</div>
      </div>
    </div>
  );
}

function Squad({ players }: { players: SquadPlayer[] }) {
  const groups = useMemo(() => {
    const labels = ["Goalkeepers", "Defenders", "Midfielders", "Forwards"];
    const buckets: { label: string; players: SquadPlayer[] }[] = [];
    for (const p of players) {
      const label = labels[p.positionOrder] ?? p.position ?? "Squad";
      let bucket = buckets.find((b) => b.label === label);
      if (!bucket) {
        bucket = { label, players: [] };
        buckets.push(bucket);
      }
      bucket.players.push(p);
    }
    return buckets;
  }, [players]);

  return (
    <div className="tp-section">
      <h3 className="tp-h">Squad · {players.length}</h3>
      {groups.map((b) => (
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

export function TeamPage({
  team,
  matches,
  onBack,
  onSelectMatch,
}: {
  team: NationTeam;
  matches: Match[];
  onBack: () => void;
  onSelectMatch?: (m: Match) => void;
}) {
  const { data, loading, error } = useAsync(() => fetchTeam(team.id), [team.id]);
  const now = useNow(30_000);

  const teamMatches = useMemo(
    () =>
      matches
        .filter((m) => m.home.id === team.id || m.away.id === team.id)
        .sort((a, b) => a.kickoff - b.kickoff),
    [matches, team.id]
  );

  const form = useMemo(() => {
    const out: string[] = [];
    for (const m of teamMatches) {
      if (m.status !== "finished") continue;
      const isHome = m.home.id === team.id;
      const us = isHome ? m.home.score : m.away.score;
      const them = isHome ? m.away.score : m.home.score;
      if (us == null || them == null) continue;
      out.push(us > them ? "W" : us < them ? "L" : "D");
    }
    return out;
  }, [teamMatches, team.id]);

  return (
    <div className="team-page">
      <button className="back-btn" onClick={onBack}>
        <ArrowLeft size={14} /> Back
      </button>

      <div className="tp-head">
        <span
          className="tp-accent"
          style={{ background: teamColor(team.code) }}
        />
        <img className="tp-flag" src={flagUrl(team.code)!} alt="" />
        <div className="tp-id">
          <div className="tp-name">{team.name}</div>
          <div className="tp-form">
            {form.length > 0
              ? form.slice(-5).map((r, i) => (
                  <span className={`form-dot ${r}`} key={i}>
                    {r}
                  </span>
                ))
              : <span className="tp-code">{team.code}</span>}
          </div>
        </div>
      </div>

      {data?.coach && <CoachLine coach={data.coach} />}

      <StandingTable matches={matches} code={team.code} />

      {teamMatches.length > 0 && (
        <div className="tp-section">
          <h3 className="tp-h">Fixtures &amp; results</h3>
          {teamMatches.map((m) => (
            <MatchRow
              key={m.id}
              m={m}
              teamId={team.id}
              now={now}
              onSelect={onSelectMatch}
            />
          ))}
        </div>
      )}

      {loading && <div className="panel-empty">Loading squad…</div>}
      {error && <div className="panel-error">Couldn’t load squad: {error}</div>}
      {data && <Squad players={data.players} />}
    </div>
  );
}
