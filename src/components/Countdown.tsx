import { useNow } from "../hooks";
import { formatClock, formatCountdown } from "../utils";

/**
 * Live countdown to `to` (epoch ms). `clock` shows a ticking H:M:S (for the hub
 * hero); otherwise a compact "3h 12m". Isolated so only this leaf re-renders.
 */
export function Countdown({ to, clock = false }: { to: number; clock?: boolean }) {
  const now = useNow(1000);
  const diff = to - now;
  return <>{clock ? formatClock(diff) : formatCountdown(diff)}</>;
}
