import { useState } from "react";
import {
  fetchPlayer,
  POSITION_LABEL,
  type LineupPlayer,
  type PlayerProfile,
  type SquadPlayer,
  type TeamLineup,
} from "../data/fifa";
import { useAsync } from "../hooks";
import { PlayerAvatar } from "./PlayerAvatar";

function PlayerDot({
  p,
  color,
  y,
  active,
  onClick,
}: {
  p: LineupPlayer;
  color: string;
  y: number;
  active: boolean;
  onClick: () => void;
}) {
  return (
    <button
      className={`pitch-player ${active ? "active" : ""}`}
      style={{ left: `${p.x}%`, top: `${y}%` }}
      title={`${p.name} — tap for stats`}
      onClick={(e) => {
        e.stopPropagation();
        onClick();
      }}
    >
      <span className="dot" style={{ background: color }}>
        <span className="dot-num">{p.shirt ?? ""}</span>
        {p.captain && <span className="badge cap">C</span>}
        <span className="badge-row">
          {p.goals > 0 && (
            <span className="badge goal">⚽{p.goals > 1 ? p.goals : ""}</span>
          )}
          {p.red ? (
            <span className="badge card red" />
          ) : p.yellow ? (
            <span className="badge card yellow" />
          ) : null}
          {p.subbedOn && <span className="badge sub">↑</span>}
        </span>
      </span>
      <span className="dot-name">{p.name}</span>
    </button>
  );
}

function Cloud({
  p,
  y,
  teamCode,
  color,
  squad,
}: {
  p: LineupPlayer;
  y: number;
  teamCode: string;
  color: string;
  squad: SquadPlayer | undefined;
}) {
  const above = y > 26;
  const left = Math.min(82, Math.max(18, p.x));
  const { data: profile } = useAsync<PlayerProfile>(
    () => fetchPlayer(p.id),
    [p.id]
  );
  const chips: { cls: string; text: string }[] = [];
  if (p.goals > 0) chips.push({ cls: "c-goal", text: `⚽ ${p.goals}` });
  if (p.yellow) chips.push({ cls: "c-yellow", text: "🟨 Yellow" });
  if (p.red) chips.push({ cls: "c-red", text: "🟥 Red" });
  if (p.captain) chips.push({ cls: "c-cap", text: "Ⓒ Captain" });
  if (p.subbedOn) chips.push({ cls: "c-sub", text: "↑ Subbed on" });
  if (squad?.age != null) chips.push({ cls: "", text: `${squad.age} yrs` });
  if (squad?.heightCm) chips.push({ cls: "", text: `${squad.heightCm} cm` });
  if (squad?.weightKg) chips.push({ cls: "", text: `${squad.weightKg} kg` });
  if (profile?.foot) chips.push({ cls: "", text: profile.foot });
  if (profile?.caps != null) chips.push({ cls: "", text: `${profile.caps} caps` });
  if (profile?.careerGoals != null)
    chips.push({ cls: "", text: `${profile.careerGoals} intl goals` });

  return (
    <div
      className={`pitch-cloud ${above ? "above" : "below"}`}
      style={{ left: `${left}%`, top: `${y}%` }}
      onClick={(e) => e.stopPropagation()}
    >
      <div className="cloud-top">
        {(p.photo || squad?.photo) && (
          <PlayerAvatar src={p.photo || squad?.photo || null} className="cloud-photo" />
        )}
        <div>
          <div className="cloud-name" style={{ color }}>
            {p.shirt != null ? `${p.shirt} · ` : ""}
            {p.name}
          </div>
          <div className="cloud-pos">
            {POSITION_LABEL[p.position] ?? "—"} · {teamCode}
          </div>
        </div>
      </div>
      {chips.length > 0 && (
        <div className="cloud-chips">
          {chips.map((c, i) => (
            <span className={`cloud-chip ${c.cls}`} key={i}>
              {c.text}
            </span>
          ))}
        </div>
      )}
      <span className="cloud-tail" />
    </div>
  );
}

export function Pitch({
  home,
  away,
  squad,
  flip,
  homeColor,
  awayColor,
}: {
  home: TeamLineup;
  away: TeamLineup;
  squad: Map<string, SquadPlayer> | null;
  flip: boolean;
  homeColor: string;
  awayColor: string;
}) {
  const [selected, setSelected] = useState<string | null>(null);
  const dispY = (p: LineupPlayer) => (flip ? 100 - p.y : p.y);

  const all = [
    ...home.onPitch.map((p) => ({ p, color: homeColor, code: home.code })),
    ...away.onPitch.map((p) => ({ p, color: awayColor, code: away.code })),
  ];
  const sel = all.find((x) => x.p.id === selected) ?? null;

  return (
    <div className="pitch-wrap">
      <div className="pitch" onClick={() => setSelected(null)}>
        <div className="pitch-line halfway" />
        <div className="pitch-circle" />
        <div className="pitch-spot center" />
        <div className="pitch-box top" />
        <div className="pitch-box bottom" />
        <div className="pitch-box6 top" />
        <div className="pitch-box6 bottom" />
        <div className="pitch-spot pen top" />
        <div className="pitch-spot pen bottom" />

        <div className={`pitch-team-label ${flip ? "bottom" : "top"}`}>
          <span className="pl-swatch" style={{ background: awayColor }} />
          {away.code} · {away.tactics ?? ""}
        </div>
        <div className={`pitch-team-label ${flip ? "top" : "bottom"}`}>
          <span className="pl-swatch" style={{ background: homeColor }} />
          {home.code} · {home.tactics ?? ""}
        </div>

        {all.map(({ p, color }) => (
          <PlayerDot
            key={p.id}
            p={p}
            color={color}
            y={dispY(p)}
            active={selected === p.id}
            onClick={(/* stop pitch from clearing */) => {
              setSelected((cur) => (cur === p.id ? null : p.id));
            }}
          />
        ))}

        {sel && (
          <Cloud
            p={sel.p}
            y={dispY(sel.p)}
            teamCode={sel.code}
            color={sel.color}
            squad={squad?.get(sel.p.id)}
          />
        )}
      </div>
      <p className="pitch-hint">Tap a player for their stats</p>
    </div>
  );
}
