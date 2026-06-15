import { useEffect, useMemo, useRef, useState } from "react";
import { flagUrl, type Match } from "../data/fifa";
import { teamColor } from "../data/teamColors";
import { Star } from "lucide-react";
import { useFavourites } from "../hooks";

function dayLabel(ms: number): string {
  return new Date(ms).toLocaleDateString(undefined, {
    weekday: "short",
    month: "short",
    day: "numeric",
  });
}
function timeLabel(ms: number): string {
  return new Date(ms).toLocaleTimeString(undefined, {
    hour: "2-digit",
    minute: "2-digit",
  });
}

function TeamLine({
  name,
  code,
  placeholder,
  score,
  bold,
}: {
  name: string;
  code: string | null;
  placeholder: string | null;
  score: number | null;
  bold: boolean;
}) {
  return (
    <div className={`fx-team ${bold ? "winner" : ""}`}>
      {code && (
        <span className="kit-dot" style={{ background: teamColor(code) }} />
      )}
      {code ? (
        <img className="mini-flag" src={flagUrl(code)!} alt="" />
      ) : (
        <span className="mini-flag tbd">?</span>
      )}
      <span className="fx-name">{name || placeholder || "TBD"}</span>
      <span className="fx-score">{score ?? ""}</span>
    </div>
  );
}

export function FixturesView({
  matches,
  stages,
  onSelect,
}: {
  matches: Match[];
  stages: string[];
  onSelect: (m: Match) => void;
}) {
  const [stage, setStage] = useState<string>("All");
  const [liveOnly, setLiveOnly] = useState(false);
  const [favOnly, setFavOnly] = useState(false);
  const fav = useFavourites();
  const involvesFav = (m: Match) =>
    (m.home.code != null && fav.has(m.home.code)) ||
    (m.away.code != null && fav.has(m.away.code));

  const filtered = useMemo(
    () =>
      matches.filter(
        (m) =>
          (stage === "All" || m.stage === stage) &&
          (!liveOnly || m.status === "live") &&
          (!favOnly || involvesFav(m))
      ),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [matches, stage, liveOnly, favOnly, fav.codes]
  );

  const byDay = useMemo(() => {
    const groups: { day: string; items: Match[] }[] = [];
    for (const m of filtered) {
      const day = dayLabel(m.kickoff);
      const last = groups[groups.length - 1];
      if (last && last.day === day) last.items.push(m);
      else groups.push({ day, items: [m] });
    }
    return groups;
  }, [filtered]);

  // The match happening "now" (live, else the next upcoming) — to centre it.
  const targetId = useMemo(() => {
    const live = filtered.find((m) => m.status === "live");
    if (live) return live.id;
    const now = Date.now();
    const next = [...filtered]
      .sort((a, b) => a.kickoff - b.kickoff)
      .find((m) => m.kickoff >= now);
    return next?.id ?? null;
  }, [filtered]);

  // On open, scroll the current match into the centre of the list (once).
  const cardRefs = useRef(new Map<string, HTMLButtonElement>());
  const didScroll = useRef(false);
  useEffect(() => {
    if (didScroll.current || !targetId) return;
    const el = cardRefs.current.get(targetId);
    if (el) {
      el.scrollIntoView({ block: "center" });
      didScroll.current = true;
    }
  }, [targetId, byDay]);

  return (
    <div className="fixtures">
      <div className="fx-filter">
        <select
          className="fx-select"
          value={stage}
          onChange={(e) => setStage(e.target.value)}
        >
          <option value="All">All stages</option>
          {stages.map((s) => (
            <option key={s} value={s}>
              {s}
            </option>
          ))}
        </select>
        <label className="fx-live-toggle">
          <input
            type="checkbox"
            checked={liveOnly}
            onChange={(e) => setLiveOnly(e.target.checked)}
          />
          Live
        </label>
        <label className="fx-live-toggle" title="Only matches with a team you follow">
          <input
            type="checkbox"
            checked={favOnly}
            onChange={(e) => setFavOnly(e.target.checked)}
          />
          <Star size={12} className="fill-star" /> Following
        </label>
      </div>

      {byDay.length === 0 && (
        <div className="panel-empty">No matches match this filter.</div>
      )}

      {byDay.map((d) => (
        <div className="fx-day" key={d.day}>
          <div className="fx-day-label">{d.day}</div>
          {d.items.map((m) => (
            <button
              className={`fx-card status-${m.status} ${
                m.id === targetId ? "is-now" : ""
              }`}
              key={m.id}
              ref={(el) => {
                if (el) cardRefs.current.set(m.id, el);
              }}
              onClick={() => onSelect(m)}
              title="View match detail & field map"
            >
              <div className="fx-meta">
                {m.status === "live" ? (
                  <span className="fx-live">
                    <span className="live-dot" /> {m.minute || "LIVE"}
                  </span>
                ) : m.status === "finished" ? (
                  <span className="fx-ft">FT · {timeLabel(m.kickoff)}</span>
                ) : (
                  <span className="fx-time">⏱ {timeLabel(m.kickoff)}</span>
                )}
                <span className="fx-stage">
                  {involvesFav(m) && (
                    <Star size={11} className="fx-star fill-star" />
                  )}
                  {m.group || m.stage} ›
                </span>
              </div>
              <div className="fx-teams">
                <TeamLine
                  name={m.home.name}
                  code={m.home.code}
                  placeholder={m.home.placeholder}
                  score={m.home.score}
                  bold={
                    m.status !== "upcoming" &&
                    (m.home.score ?? -1) > (m.away.score ?? -1)
                  }
                />
                <TeamLine
                  name={m.away.name}
                  code={m.away.code}
                  placeholder={m.away.placeholder}
                  score={m.away.score}
                  bold={
                    m.status !== "upcoming" &&
                    (m.away.score ?? -1) > (m.home.score ?? -1)
                  }
                />
              </div>
              {(m.homePens != null || m.city) && (
                <div className="fx-foot">
                  {m.homePens != null &&
                    m.awayPens != null &&
                    `Pens ${m.homePens}–${m.awayPens} · `}
                  {m.city}
                  {m.stadium ? ` · ${m.stadium}` : ""}
                </div>
              )}
            </button>
          ))}
        </div>
      ))}
    </div>
  );
}
