import { useMemo, useState } from "react";
import type { PitchEvent, SquadPlayer } from "../data/fifa";

export function EventMap({
  events,
  awayId,
  homeCode,
  awayCode,
  homeColor,
  awayColor,
  squad,
}: {
  events: PitchEvent[];
  awayId: string | null;
  homeCode: string | null;
  awayCode: string | null;
  homeColor: string;
  awayColor: string;
  squad: Map<string, SquadPlayer> | null;
}) {
  const [shotsOnly, setShotsOnly] = useState(true);
  const [sel, setSel] = useState<string | null>(null);

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
    teamId && teamId === awayId ? awayColor : homeColor;
  const nameOf = (id: string | null) =>
    (id && squad?.get(id)?.name) || "";
  const codeOf = (teamId: string | null) =>
    teamId && teamId === awayId ? awayCode : homeCode;

  const selected = shown.find((e) => e.id === sel) ?? null;

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

      <div className="event-pitch" onClick={() => setSel(null)}>
        <div className="ep-line halfway" />
        <div className="ep-circle" />
        <div className="ep-box left" />
        <div className="ep-box right" />
        {shown.map((e) => (
          <button
            key={e.id}
            className={`ep-dot ${
              e.isGoal ? "goal" : e.isShot ? "shot" : "other"
            } ${sel === e.id ? "active" : ""}`}
            style={{
              left: `${e.x}%`,
              top: `${e.y}%`,
              background: colorOf(e.teamId),
            }}
            onClick={(ev) => {
              ev.stopPropagation();
              setSel((cur) => (cur === e.id ? null : e.id));
            }}
          >
            {e.isGoal ? "⚽" : ""}
          </button>
        ))}

        {selected && (
          <div
            className={`ep-bubble ${(selected.y ?? 0) > 30 ? "above" : "below"}`}
            style={{
              left: `${Math.min(80, Math.max(20, selected.x ?? 50))}%`,
              top: `${selected.y}%`,
            }}
            onClick={(ev) => ev.stopPropagation()}
          >
            <div className="ep-bubble-player">
              {nameOf(selected.playerId) || "Unknown player"}
            </div>
            <div className="ep-bubble-meta">
              {selected.isGoal ? "⚽ " : ""}
              {selected.label} · {selected.minute} · {codeOf(selected.teamId)}
            </div>
            <span className="ep-bubble-tail" />
          </div>
        )}
      </div>

      <div className="em-legend">
        <span>
          <i style={{ background: homeColor }} /> {homeCode}
        </span>
        <span>
          <i style={{ background: awayColor }} /> {awayCode}
        </span>
        <span className="em-note">
          tap a marker to see who took it · positions from the official feed
        </span>
      </div>
    </div>
  );
}
