import { useMemo, useState } from "react";
import {
  computeGroupTables,
  fetchMatches,
  fetchSeason,
  stagesFromMatches,
  teamsFromMatches,
  type Match,
} from "../data/fifa";
import { useAsync } from "../hooks";
import { GroupsView } from "./GroupsView";
import { FixturesView } from "./FixturesView";
import { TeamsView } from "./TeamsView";
import { TeamPage } from "./TeamPage";
import { MatchDetail } from "./MatchDetail";
import { NowHub } from "./NowHub";
import { ScorersView } from "./ScorersView";
import type { NationTeam } from "../data/fifa";
import { RotateCw } from "lucide-react";

type Tab = "now" | "groups" | "fixtures" | "teams" | "scorers";

const TABS: { id: Tab; label: string }[] = [
  { id: "now", label: "Now" },
  { id: "fixtures", label: "Fixtures" },
  { id: "groups", label: "Groups" },
  { id: "scorers", label: "Scorers" },
  { id: "teams", label: "Teams" },
];

export function DataPanel({
  onLoadStream,
  onWatchMatch,
}: {
  onLoadStream: (url: string, title: string) => void;
  onWatchMatch: (m: Match) => void;
}) {
  const [tab, setTab] = useState<Tab>("now");
  const [selected, setSelected] = useState<Match | null>(null);
  const [openTeam, setOpenTeam] = useState<NationTeam | null>(null);

  const season = useAsync(fetchSeason, []);
  // Poll matches every 30s so live scores/statuses refresh on their own.
  const matchesState = useAsync<Match[]>(fetchMatches, [], 30_000);
  const matches = matchesState.data ?? [];

  const tables = useMemo(() => computeGroupTables(matches), [matches]);
  const teams = useMemo(() => teamsFromMatches(matches), [matches]);
  const stages = useMemo(() => stagesFromMatches(matches), [matches]);
  const liveCount = matches.filter((m) => m.status === "live").length;

  const loading = matchesState.loading && matches.length === 0;

  return (
    <aside className="data-panel">
      <div className="data-header">
        <div className="data-title">
          <h2>{season.data?.name ?? "FIFA World Cup 2026"}</h2>
          <span className="data-sub">Official FIFA data</span>
        </div>
        <button
          className="refresh-btn"
          onClick={matchesState.refetch}
          title="Refresh"
        >
          <RotateCw size={15} />
        </button>
      </div>

      <div className="tabs">
        {TABS.map((t) => (
          <button
            key={t.id}
            className={`tab ${
              tab === t.id && !selected && !openTeam ? "active" : ""
            }`}
            onClick={() => {
              setSelected(null);
              setOpenTeam(null);
              setTab(t.id);
            }}
          >
            {t.label}
            {t.id === "fixtures" && liveCount > 0 && (
              <span className="tab-live">{liveCount}</span>
            )}
          </button>
        ))}
      </div>

      <div className="data-body">
        {matchesState.error && (
          <div className="panel-error">
            Couldn’t reach the FIFA API: {matchesState.error}
            <button className="retry-btn" onClick={matchesState.refetch}>
              Retry
            </button>
          </div>
        )}
        {loading && !matchesState.error && (
          <div className="panel-empty">
            <div className="spinner small" />
            Loading tournament data…
          </div>
        )}
        {!loading && !matchesState.error && openTeam && (
          <TeamPage
            team={openTeam}
            matches={matches}
            onBack={() => setOpenTeam(null)}
            onSelectMatch={(m) => {
              setOpenTeam(null);
              setSelected(m);
            }}
          />
        )}
        {!loading && !matchesState.error && !openTeam && selected && (
          <MatchDetail
            match={selected}
            onBack={() => setSelected(null)}
            onLoadStream={onLoadStream}
            onOpenTeam={setOpenTeam}
          />
        )}
        {!loading && !matchesState.error && !openTeam && !selected && (
          <>
            {tab === "now" && (
              <NowHub
                matches={matches}
                onSelect={setSelected}
                onWatch={onWatchMatch}
              />
            )}
            {tab === "groups" && <GroupsView tables={tables} />}
            {tab === "scorers" && <ScorersView />}
            {tab === "fixtures" && (
              <FixturesView
                matches={matches}
                stages={stages}
                onSelect={setSelected}
              />
            )}
            {tab === "teams" && (
              <TeamsView
                teams={teams}
                matches={matches}
                onSelectMatch={setSelected}
              />
            )}
          </>
        )}
      </div>
    </aside>
  );
}
