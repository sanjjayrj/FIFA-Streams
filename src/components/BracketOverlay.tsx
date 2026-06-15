import { useState } from "react";
import { X } from "lucide-react";
import { fetchMatches, type Match } from "../data/fifa";
import { useAsync } from "../hooks";
import { BracketView } from "./BracketView";
import { MatchDetail } from "./MatchDetail";

/**
 * Full-screen overlay for the bracket / group-matchups map. It needs the whole
 * window width (the right data panel is too narrow), so it floats above the app.
 * Self-contained: fetches its own matches and can drill into a match detail.
 */
export function BracketOverlay({
  open,
  onClose,
  onLoadStream,
}: {
  open: boolean;
  onClose: () => void;
  onLoadStream: (url: string, title: string) => void;
}) {
  const { data, loading, error } = useAsync<Match[]>(
    fetchMatches,
    [open],
    open ? 30_000 : undefined
  );
  const [selected, setSelected] = useState<Match | null>(null);

  if (!open) return null;

  return (
    <div className="bracket-overlay">
      <header className="bracket-overlay-bar">
        <span className="bracket-overlay-title">Tournament map</span>
        <button className="bracket-overlay-close" onClick={onClose}>
          <X size={15} /> Close
        </button>
      </header>
      <div className="bracket-overlay-body">
        {loading && <div className="panel-empty">Loading tournament…</div>}
        {error && <div className="panel-error">Couldn’t load: {error}</div>}
        {data && selected && (
          <div className="bracket-detail-wrap">
            <MatchDetail
              match={selected}
              onBack={() => setSelected(null)}
              onLoadStream={(url, title) => {
                onLoadStream(url, title);
                onClose();
              }}
            />
          </div>
        )}
        {data && !selected && (
          <BracketView matches={data} onSelect={setSelected} />
        )}
      </div>
    </div>
  );
}
