import { useEffect, useState } from "react";
import { Eye } from "lucide-react";

// Lightweight visit counter via the free Abacus service (CORS-open, no key).
// Counts once per browser: first visit increments (/hit), later visits read
// (/get). Fails silently if the service is unreachable.
const COUNTER = "https://abacus.jasoncameron.dev";
const NS = "fifalive26";
const KEY = "visits";

export function VisitorCounter() {
  const [count, setCount] = useState<number | null>(null);

  useEffect(() => {
    let cancelled = false;
    const counted = localStorage.getItem("fifa.counted");
    const url = `${COUNTER}/${counted ? "get" : "hit"}/${NS}/${KEY}`;
    fetch(url)
      .then((r) => r.json())
      .then((d) => {
        if (cancelled || typeof d?.value !== "number") return;
        setCount(d.value);
        if (!counted) localStorage.setItem("fifa.counted", "1");
      })
      .catch(() => {});
    return () => {
      cancelled = true;
    };
  }, []);

  if (count == null) return null;
  return (
    <span className="visit-counter" title="Total visitors">
      <Eye size={15} className="vc-eye" />
      <span className="vc-num">{count.toLocaleString()}</span> visits
    </span>
  );
}
