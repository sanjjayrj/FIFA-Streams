import { useMemo, useState } from "react";
import { Bell, Play } from "lucide-react";
import { flagUrl, type Match } from "../data/fifa";
import { teamColor } from "../data/teamColors";
import { useFavourites, useNow } from "../hooks";
import { formatCountdown } from "../utils";
import { Countdown } from "./Countdown";

function dateTime(ms: number): string {
  return new Date(ms).toLocaleString(undefined, {
    weekday: "short",
    month: "short",
    day: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
}

function Side({ code, name }: { code: string | null; name: string }) {
  return (
    <span className="hub-side">
      {code && (
        <span className="kit-dot" style={{ background: teamColor(code) }} />
      )}
      {code ? (
        <img className="mini-flag" src={flagUrl(code)!} alt="" />
      ) : (
        <span className="mini-flag tbd">?</span>
      )}
      <span className="hub-name">{name}</span>
    </span>
  );
}

function Row({
  m,
  now,
  onSelect,
  onWatch,
}: {
  m: Match;
  now: number;
  onSelect: (m: Match) => void;
  onWatch?: (m: Match) => void;
}) {
  const label = (t: Match["home"]) => t.code || t.placeholder || "TBD";
  return (
    <div className="hub-row">
      <button className="hub-row-main" onClick={() => onSelect(m)}>
        <Side code={m.home.code} name={label(m.home)} />
        <span className="hub-mid">
          {m.status === "upcoming"
            ? "v"
            : `${m.home.score ?? "-"}–${m.away.score ?? "-"}`}
        </span>
        <Side code={m.away.code} name={label(m.away)} />
      </button>
      <span className="hub-meta">
        {m.status === "live" ? (
          <span className="hub-live">
            <span className="live-dot" /> {m.minute || "LIVE"}
          </span>
        ) : m.status === "finished" ? (
          <span className="hub-ft">FT</span>
        ) : (
          <span className="hub-cd">in {formatCountdown(m.kickoff - now)}</span>
        )}
        {m.status === "live" && onWatch && (
          <button
            className="hub-watch"
            onClick={() => onWatch(m)}
            title="Watch this match"
          >
            <Play size={13} /> Watch
          </button>
        )}
      </span>
    </div>
  );
}

function NotifyOptIn({ show }: { show: boolean }) {
  const [perm, setPerm] = useState<NotificationPermission | "unsupported">(
    typeof Notification === "undefined" ? "unsupported" : Notification.permission
  );
  if (!show || perm === "unsupported" || perm !== "default") return null;
  return (
    <button
      className="notify-optin"
      onClick={async () => setPerm(await Notification.requestPermission())}
    >
      <Bell size={13} /> Enable goal alerts for your teams
    </button>
  );
}

export function NowHub({
  matches,
  onSelect,
  onWatch,
}: {
  matches: Match[];
  onSelect: (m: Match) => void;
  onWatch: (m: Match) => void;
}) {
  const fav = useFavourites();
  const now = useNow(15_000);

  const live = useMemo(
    () =>
      matches
        .filter((m) => m.status === "live")
        .sort((a, b) => a.kickoff - b.kickoff),
    [matches]
  );

  const upcoming = useMemo(
    () =>
      matches
        .filter((m) => m.kickoff >= Date.now() && m.status === "upcoming")
        .sort((a, b) => a.kickoff - b.kickoff),
    [matches]
  );
  const nextUp = upcoming[0] ?? null;

  const following = useMemo(() => {
    const out: Match[] = [];
    const seen = new Set<string>();
    for (const code of fav.codes) {
      const next = upcoming.find(
        (m) => m.home.code === code || m.away.code === code
      );
      if (next && !seen.has(next.id)) {
        seen.add(next.id);
        out.push(next);
      }
    }
    return out.sort((a, b) => a.kickoff - b.kickoff);
  }, [upcoming, fav.codes]);

  const today = useMemo(() => {
    const d = new Date();
    return matches
      .filter((m) => {
        const k = new Date(m.kickoff);
        return (
          k.getFullYear() === d.getFullYear() &&
          k.getMonth() === d.getMonth() &&
          k.getDate() === d.getDate()
        );
      })
      .sort((a, b) => a.kickoff - b.kickoff);
  }, [matches]);

  return (
    <div className="now-hub">
      {live.length > 0 && (
        <section className="hub-section">
          <h3 className="hub-h">Live now</h3>
          {live.map((m) => (
            <Row key={m.id} m={m} now={now} onSelect={onSelect} onWatch={onWatch} />
          ))}
        </section>
      )}

      {nextUp && (
        <section className="hub-section">
          <h3 className="hub-h">Up next</h3>
          <button className="hub-hero" onClick={() => onSelect(nextUp)}>
            <div className="hero-teams">
              <Side code={nextUp.home.code} name={nextUp.home.name || "TBD"} />
              <span className="hero-vs">vs</span>
              <Side code={nextUp.away.code} name={nextUp.away.name || "TBD"} />
            </div>
            <div className="hero-cd">
              <span className="hero-cd-label">Kicks off in</span>
              <span className="hero-cd-time">
                <Countdown to={nextUp.kickoff} clock />
              </span>
            </div>
            <div className="hero-sub">
              {nextUp.group || nextUp.stage} · {dateTime(nextUp.kickoff)}
            </div>
          </button>
        </section>
      )}

      {fav.codes.length > 0 ? (
        following.length > 0 && (
          <section className="hub-section">
            <h3 className="hub-h">Your teams</h3>
            <NotifyOptIn show />
            {following.map((m) => (
              <Row key={m.id} m={m} now={now} onSelect={onSelect} />
            ))}
          </section>
        )
      ) : (
        <section className="hub-section">
          <div className="hub-empty">
            Follow teams in the <b>Teams</b> tab to track their games here and
            get goal alerts.
          </div>
        </section>
      )}

      {today.length > 0 && (
        <section className="hub-section">
          <h3 className="hub-h">Today</h3>
          {today.map((m) => (
            <Row key={m.id} m={m} now={now} onSelect={onSelect} onWatch={onWatch} />
          ))}
        </section>
      )}
    </div>
  );
}
