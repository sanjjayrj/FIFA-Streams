import { useEffect, useState } from "react";
import {
  fetchEvents,
  fetchMatchDetail,
  fetchSquad,
  flagUrl,
  hasLineup,
  matchStats,
  type Match,
  type MatchDetail as Detail,
  type PitchEvent,
  type SquadPlayer,
} from "../data/fifa";
import { EventMap } from "./EventMap";
import { MatchStats } from "./MatchStats";
import { matchColors } from "../data/teamColors";
import type { NationTeam } from "../data/fifa";
import { ArrowLeft, ArrowUpDown, Eye, Users } from "lucide-react";
import {
  fetchLiveFootball,
  fetchStreamOptions,
  matchStreamsFor,
  type StreamOption,
} from "../data/streams";
import { useAsync } from "../hooks";
import { Pitch } from "./Pitch";

// Icons + housekeeping filter for the full play-by-play.
const EVENT_ICON: Record<number, string> = {
  0: "⚽",
  1: "🅰",
  2: "🟨",
  3: "🟥",
  5: "🔁",
  12: "🎯",
  15: "🚩",
  16: "⛳",
  18: "✋",
  57: "🧤",
  71: "📺",
};
const HIDDEN_EVENT_TYPES = new Set([7, 8, 26, 78, 79, 83]);

/** Past half-time? Used to switch the teams' ends like a real match. */
function isSecondHalf(d: Detail): boolean {
  if (d.status === "finished") return true;
  if (d.status !== "live") return false;
  const m = parseInt(d.minute ?? "", 10);
  return !isNaN(m) && m >= 46;
}

function dateTime(iso: string): string {
  const d = new Date(iso);
  return (
    d.toLocaleDateString(undefined, {
      weekday: "long",
      month: "long",
      day: "numeric",
    }) +
    " · " +
    d.toLocaleTimeString(undefined, { hour: "2-digit", minute: "2-digit" })
  );
}

function StatusPill({ d }: { d: Detail }) {
  if (d.status === "live")
    return (
      <span className="mp-status live">
        <span className="live-dot" /> {d.minute || "LIVE"}
      </span>
    );
  if (d.status === "finished")
    return <span className="mp-status ft">Full time</span>;
  return <span className="mp-status up">{dateTime(d.iso)}</span>;
}

function StreamsSection({
  home,
  away,
  onLoad,
}: {
  home: string;
  away: string;
  onLoad: (url: string, title: string) => void;
}) {
  const [options, setOptions] = useState<StreamOption[] | null>(null);
  const [state, setState] = useState<"idle" | "loading" | "done" | "error">(
    "idle"
  );

  useEffect(() => {
    let cancelled = false;
    setState("loading");
    (async () => {
      try {
        const live = await fetchLiveFootball();
        const matched = matchStreamsFor(live, home, away);
        const refs = matched.flatMap((m) => m.sources);
        const lists = await Promise.all(
          refs.map((r) => fetchStreamOptions(r).catch(() => []))
        );
        if (cancelled) return;
        const flat = lists
          .flat()
          .sort((a, b) => Number(b.hd) - Number(a.hd) || b.viewers - a.viewers);
        setOptions(flat);
        setState("done");
      } catch {
        if (!cancelled) setState("error");
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [home, away]);

  return (
    <div className="mp-section">
      <h3 className="mp-h3">Watch this match</h3>
      {state === "loading" && (
        <div className="mp-muted">Searching live streams…</div>
      )}
      {state === "error" && (
        <div className="mp-muted">Couldn’t reach the stream directory.</div>
      )}
      {state === "done" && (!options || options.length === 0) && (
        <div className="mp-muted">
          No live streams found for this match right now. Streams usually appear
          near kickoff.
        </div>
      )}
      {options && options.length > 0 && (
        <div className="stream-list">
          {options.map((o, i) => (
            <button
              key={`${o.embedUrl}-${i}`}
              className="stream-opt"
              onClick={() =>
                onLoad(o.embedUrl, `${home} vs ${away} · ${o.language}`)
              }
            >
              <span className="stream-lang">{o.language || "Stream"}</span>
              {o.hd && <span className="stream-hd">HD</span>}
              <span className="stream-viewers">
                <Eye size={12} /> {o.viewers}
              </span>
              <span className="stream-go">Load</span>
            </button>
          ))}
        </div>
      )}
    </div>
  );
}

export function MatchDetail({
  match,
  onBack,
  onLoadStream,
  onOpenTeam,
}: {
  match: Match;
  onBack: () => void;
  onLoadStream: (url: string, title: string) => void;
  onOpenTeam?: (team: NationTeam) => void;
}) {
  const poll = match.status === "live" ? 30_000 : undefined;
  const { data, loading, error } = useAsync<Detail>(
    () => fetchMatchDetail(match.idStage, match.id),
    [match.id],
    poll
  );

  // Squads give the richer per-player stats (age/height/weight/photo) shown when
  // a player on the pitch is tapped. Keyed by FIFA player id across both teams.
  const { data: squadMap } = useAsync<Map<string, SquadPlayer>>(async () => {
    const [h, a] = await Promise.all([
      match.home.id ? fetchSquad(match.home.id) : Promise.resolve([]),
      match.away.id ? fetchSquad(match.away.id) : Promise.resolve([]),
    ]);
    const m = new Map<string, SquadPlayer>();
    [...h, ...a].forEach((p) => m.set(p.id, p));
    return m;
  }, [match.home.id, match.away.id]);

  // Timeline events drive both the shot map and the match-stat tallies.
  const { data: events } = useAsync<PitchEvent[]>(
    () => fetchEvents(match.idStage, match.id),
    [match.id],
    poll
  );
  const stats = events
    ? matchStats(events, match.home.id, match.away.id)
    : null;

  // Teams swap ends at half-time. Default the orientation to match the half,
  // but let the user flip it manually. `null` = follow the half automatically.
  const [flipOverride, setFlipOverride] = useState<boolean | null>(null);
  const autoFlip = data ? isSecondHalf(data) : false;
  const flip = flipOverride ?? autoFlip;

  // Each team rendered in its kit colour (clash-resolved) across the visuals.
  const kit = matchColors(match.home.code, match.away.code);

  const teamName = (t: Match["home"]) =>
    onOpenTeam && t.id && t.code ? (
      <button
        className="mp-team link"
        onClick={() => onOpenTeam({ id: t.id!, name: t.name, code: t.code! })}
        title={`View ${t.name} squad`}
      >
        {t.name || "TBD"}
      </button>
    ) : (
      <span className="mp-team">{t.name || "TBD"}</span>
    );

  // Full play-by-play (all event types) vs the key-events summary.
  const [fullTimeline, setFullTimeline] = useState(false);
  const codeOf = (teamId: string | null) =>
    teamId === match.home.id
      ? match.home.code
      : teamId === match.away.id
      ? match.away.code
      : null;
  const fullRows = (events ?? [])
    .filter((e) => !HIDDEN_EVENT_TYPES.has(e.type))
    .map((e) => ({
      label: e.minute,
      icon: EVENT_ICON[e.type] ?? "•",
      teamCode: codeOf(e.teamId),
      text: `${e.label}${
        e.playerId && squadMap?.get(e.playerId)
          ? ` — ${squadMap.get(e.playerId)!.name}`
          : ""
      }`,
      key: e.id,
      min: parseInt(e.minute, 10) || 0,
    }))
    .sort((a, b) => a.min - b.min);

  return (
    <div className="match-detail">
      <button className="back-btn" onClick={onBack}>
        <ArrowLeft size={14} /> Fixtures
      </button>

      <div className="mp-head">
        <div className="mp-side">
          {match.home.code && (
            <img className="mp-flag" src={flagUrl(match.home.code)!} alt="" />
          )}
          {teamName(match.home)}
        </div>
        <div className="mp-score">
          {data && data.home.score != null && data.away.score != null ? (
            <span className="mp-goals">
              {data.home.score}–{data.away.score}
            </span>
          ) : (
            <span className="mp-vs">vs</span>
          )}
          {data && <StatusPill d={data} />}
        </div>
        <div className="mp-side">
          {match.away.code && (
            <img className="mp-flag" src={flagUrl(match.away.code)!} alt="" />
          )}
          {teamName(match.away)}
        </div>
      </div>

      <div className="mp-meta">
        {match.group || match.stage}
        {data?.venue ? ` · ${data.venue}` : ""}
        {data?.city ? `, ${data.city}` : ""}
        {data?.referee ? ` · Ref: ${data.referee}` : ""}
        {data?.attendance ? (
          <>
            {" · "}
            <Users size={12} className="mp-meta-ico" />{" "}
            {Number(data.attendance).toLocaleString()}
          </>
        ) : (
          ""
        )}
      </div>

      {loading && <div className="panel-empty">Loading match…</div>}
      {error && <div className="panel-error">Couldn’t load match: {error}</div>}

      {data && (
        <>
          {hasLineup(data) ? (
            <>
              <div className="pitch-toolbar">
                <span className="pitch-half">
                  {flip ? "2nd-half ends" : "1st-half ends"}
                </span>
                <button
                  className="flip-btn"
                  onClick={() => setFlipOverride(!flip)}
                  title="Teams switch ends at half-time — flip the pitch"
                >
                  <ArrowUpDown size={13} /> Switch ends
                </button>
              </div>
              <Pitch
                home={data.homeLineup!}
                away={data.awayLineup!}
                squad={squadMap ?? null}
                flip={flip}
                homeColor={kit.home}
                awayColor={kit.away}
              />
            </>
          ) : (
            <div className="mp-muted pitch-empty">
              Lineups not announced yet — the field map appears once the starting
              XIs are confirmed (usually ~1 hour before kickoff).
            </div>
          )}

          {(data.status === "live" || data.status === "finished") && (
            <div className="mp-section">
              <h3 className="mp-h3">
                Timeline
                {data.status === "live" && (
                  <span className="tl-live">
                    <span className="live-dot" /> {data.minute || "LIVE"}
                  </span>
                )}
                <span className="em-toggle">
                  <button
                    className={!fullTimeline ? "active" : ""}
                    onClick={() => setFullTimeline(false)}
                  >
                    Key
                  </button>
                  <button
                    className={fullTimeline ? "active" : ""}
                    onClick={() => setFullTimeline(true)}
                  >
                    Full
                  </button>
                </span>
              </h3>
              {fullTimeline ? (
                fullRows.length > 0 ? (
                  <div className="timeline">
                    {fullRows.map((e) => (
                      <div className="tl-row" key={e.key}>
                        <span className="tl-min">{e.label}</span>
                        <span className="tl-icon">{e.icon}</span>
                        <span className="tl-team">{e.teamCode}</span>
                        <span className="tl-text">{e.text}</span>
                      </div>
                    ))}
                  </div>
                ) : (
                  <div className="mp-muted">No play-by-play yet.</div>
                )
              ) : data.events.length > 0 ? (
                <div className="timeline">
                  {data.events.map((e, i) => (
                    <div className="tl-row" key={i}>
                      <span className="tl-min">{e.label}</span>
                      <span className="tl-icon">{e.icon}</span>
                      <span className="tl-team">{e.teamCode}</span>
                      <span className="tl-text">{e.text}</span>
                    </div>
                  ))}
                </div>
              ) : (
                <div className="mp-muted">
                  No goals, cards or subs yet — events appear here live.
                </div>
              )}
            </div>
          )}

          {stats && (
            <MatchStats
              home={stats.home}
              away={stats.away}
              homeColor={kit.home}
              awayColor={kit.away}
            />
          )}

          {events && events.length > 0 && (
            <EventMap
              events={events}
              awayId={match.away.id}
              homeCode={match.home.code}
              awayCode={match.away.code}
              homeColor={kit.home}
              awayColor={kit.away}
              squad={squadMap ?? null}
            />
          )}

          <StreamsSection
            home={match.home.name}
            away={match.away.name}
            onLoad={onLoadStream}
          />
        </>
      )}
    </div>
  );
}
