import { useState } from "react";
import { hostOf } from "../utils";

export interface Source {
  url: string;
  title: string;
  addedAt: number;
}

interface SourceBarProps {
  current: string | null;
  recents: Source[];
  live: boolean;
  onSubmit: (raw: string) => void;
  onPick: (s: Source) => void;
  onRemove: (url: string) => void;
  onToggleLive: (v: boolean) => void;
  error: string | null;
}

export function SourceBar({
  current,
  recents,
  live,
  onSubmit,
  onPick,
  onRemove,
  onToggleLive,
  error,
}: SourceBarProps) {
  const [draft, setDraft] = useState("");

  const submit = () => {
    if (!draft.trim()) return;
    onSubmit(draft);
    setDraft("");
  };

  return (
    <div className="source-bar">
      <div className="source-row">
        <input
          className="source-input"
          placeholder="Paste an <iframe …> embed code or a stream URL…"
          value={draft}
          onChange={(e) => setDraft(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === "Enter") submit();
          }}
          spellCheck={false}
        />
        <button className="load-btn" onClick={submit}>
          Load stream
        </button>
        <label className="live-toggle" title="Mark this stream as live">
          <input
            type="checkbox"
            checked={live}
            onChange={(e) => onToggleLive(e.target.checked)}
          />
          Live
        </label>
      </div>

      {error && <div className="source-error">{error}</div>}

      {recents.length > 0 && (
        <div className="recents">
          <span className="recents-label">Recent:</span>
          {recents.map((s) => (
            <span
              key={s.url}
              className={`recent-chip ${s.url === current ? "active" : ""}`}
            >
              <button className="recent-pick" onClick={() => onPick(s)} title={s.url}>
                {s.title || hostOf(s.url)}
              </button>
              <button
                className="recent-remove"
                onClick={() => onRemove(s.url)}
                title="Remove"
              >
                ×
              </button>
            </span>
          ))}
        </div>
      )}
    </div>
  );
}
