import { useEffect, useState } from "react";
import { onToast, type Toast } from "../lib/toast";

export function Toaster() {
  const [toasts, setToasts] = useState<Toast[]>([]);

  useEffect(
    () =>
      onToast((t) => {
        setToasts((ts) => [...ts, t]);
        setTimeout(
          () => setToasts((ts) => ts.filter((x) => x.id !== t.id)),
          6500
        );
      }),
    []
  );

  if (!toasts.length) return null;
  return (
    <div className="toaster">
      {toasts.map((t) => (
        <button
          className={`toast tone-${t.tone}`}
          key={t.id}
          onClick={() => setToasts((ts) => ts.filter((x) => x.id !== t.id))}
        >
          <div className="toast-title">{t.title}</div>
          {t.body && <div className="toast-body">{t.body}</div>}
        </button>
      ))}
    </div>
  );
}
