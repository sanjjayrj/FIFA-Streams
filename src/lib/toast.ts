// Tiny pub/sub toast bus. Components call pushToast(); <Toaster/> renders them.
// If the user has granted notification permission, it also fires a native
// browser notification (so alerts surface when the tab is in the background).

export type ToastTone = "goal" | "live" | "info";

export interface ToastInput {
  tone?: ToastTone;
  title: string;
  body?: string;
}

export interface Toast extends ToastInput {
  id: number;
}

const listeners = new Set<(t: Toast) => void>();
let nextId = 1;

export function pushToast(input: ToastInput): void {
  const toast: Toast = { tone: "info", ...input, id: nextId++ };
  listeners.forEach((l) => l(toast));
  if (
    typeof Notification !== "undefined" &&
    Notification.permission === "granted"
  ) {
    try {
      new Notification(input.title, {
        body: input.body,
        icon: "/pwa-192x192.png",
      });
    } catch {
      /* ignore */
    }
  }
}

export function onToast(cb: (t: Toast) => void): () => void {
  listeners.add(cb);
  return () => listeners.delete(cb);
}
