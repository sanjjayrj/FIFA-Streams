import { useMemo } from "react";
import { Star } from "lucide-react";
import { fetchMatches, flagUrl, type Match } from "../data/fifa";
import { useAsync, useFavourites, useNow } from "../hooks";
import { formatCountdown } from "../utils";

function Side({ code, score }: { code: string | null; score: number | null }) {
  return (
    <span className="tk-side">
      {code && <img className="tk-flag" src={flagUrl(code)!} alt="" />}
      <span className="tk-code">{code ?? "TBD"}</span>
      {score != null && <span className="tk-score">{score}</span>}
    </span>
  );
}

export function ScoreTicker({
  onWatch,
}: {
  onWatch: (m: Match) => void;
}) {
  const { data } = useAsync<Match[]>(fetchMatches, [], 30_000);
  const { has } = useFavourites();
  const now = useNow(30_000);

  const items = useMemo(() => {
    const all = data ?? [];
    const live = all.filter((m) => m.status === "live");
    if (live.length) return { live: true, list: live };
    const now = Date.now();
    const upcoming = all
      .filter((m) => m.kickoff >= now)
      .sort((a, b) => a.kickoff - b.kickoff)
      .slice(0, 8);
    return { live: false, list: upcoming };
  }, [data]);

  if (!items.list.length) return null;

  // Followed teams first.
  const sorted = [...items.list].sort((a, b) => {
    const fa = (a.home.code && has(a.home.code)) || (a.away.code && has(a.away.code));
    const fb = (b.home.code && has(b.home.code)) || (b.away.code && has(b.away.code));
    return Number(fb) - Number(fa);
  });

  return (
    <div className="score-ticker">
      <span className="tk-label">{items.live ? "● LIVE" : "NEXT UP"}</span>
      <div className="tk-track">
        {sorted.map((m) => {
          const fav =
            (m.home.code && has(m.home.code)) || (m.away.code && has(m.away.code));
          return (
            <button
              key={m.id}
              className={`tk-item ${m.status === "live" ? "live" : ""} ${
                fav ? "fav" : ""
              }`}
              onClick={() => m.status === "live" && onWatch(m)}
              title={
                m.status === "live"
                  ? "Watch this live match"
                  : `${m.home.name} vs ${m.away.name}`
              }
            >
              {fav && <Star size={11} className="tk-star fill-star" />}
              <Side code={m.home.code} score={m.home.score} />
              <span className="tk-meta">
                {m.status === "live"
                  ? m.minute || "LIVE"
                  : `in ${formatCountdown(m.kickoff - now)}`}
              </span>
              <Side code={m.away.code} score={m.away.score} />
            </button>
          );
        })}
      </div>
    </div>
  );
}
