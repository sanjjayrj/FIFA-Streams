import { useMemo, useState } from "react";
import type { PitchEvent, SquadPlayer } from "../data/fifa";

const GOAL_GREEN = "#16c172";
const AWAY_PINK = "#ff5c7a";

export function EventMap({
  events,
  awayId,
  homeCode,
  awayCode,
  squad,
}: {
  events: PitchEvent[];
  awayId: string | null;
  homeCode: string | null;
  awayCode: string | null;
  squad: Map<string, SquadPlayer> | null;
}) {
  const [shotsOnly, setShotsOnly] = useState(true);

  const located = useMemo(
    () => events.filter((e) => e.x != null && e.y != null),
    [events]
  );
  const shown = useMemo(
    () => located.filter((e) => (shotsOnly ? e.isShot : true)),
    [located, shotsOnly]
  );

  if (!located.length) return null;

  const colorOf = (teamId: string | null) =>
    teamId && teamId === awayId ? AWAY_PINK : GOAL_GREEN;
  const nameOf = (id: string | null) =>
    (id && squad?.get(id)?.name) || "";

  return (
    <div className="mp-section">
      <h3 className="mp-h3">
        Event map
        <span className="em-toggle">
          <button
            className={shotsOnly ? "active" : ""}
            onClick={() => setShotsOnly(true)}
          >
            Shots
          </button>
          <button
            className={!shotsOnly ? "active" : ""}
            onClick={() => setShotsOnly(false)}
          >
            All
          </button>
        </span>
      </h3>

      <div className="event-pitch">
        <div className="ep-line halfway" />
        <div className="ep-circle" />
        <div className="ep-box left" />
        <div className="ep-box right" />
        {shown.map((e) => (
          <span
            key={e.id}
            className={`ep-dot ${e.isGoal ? "goal" : e.isShot ? "shot" : "other"}`}
            style={{
              left: `${e.x}%`,
              top: `${e.y}%`,
              background: colorOf(e.teamId),
            }}
            title={`${e.label} · ${e.minute}${
              nameOf(e.playerId) ? ` · ${nameOf(e.playerId)}` : ""
            }`}
          >
            {e.isGoal ? "⚽" : ""}
          </span>
        ))}
      </div>

      <div className="em-legend">
        <span>
          <i style={{ background: GOAL_GREEN }} /> {homeCode}
        </span>
        <span>
          <i style={{ background: AWAY_PINK }} /> {awayCode}
        </span>
        <span className="em-note">
          ⚽ goal · ● shot · positions from the official event feed
        </span>
      </div>
    </div>
  );
}
