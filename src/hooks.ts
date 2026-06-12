import { useCallback, useEffect, useRef, useState } from "react";

export interface AsyncState<T> {
  data: T | null;
  loading: boolean;
  error: string | null;
  refetch: () => void;
}

/**
 * Runs `fn` on mount (and whenever `deps` change). If `pollMs` is set, it
 * re-runs on that interval so live data (scores, statuses) stays fresh.
 */
export function useAsync<T>(
  fn: () => Promise<T>,
  deps: unknown[],
  pollMs?: number
): AsyncState<T> {
  const [data, setData] = useState<T | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const fnRef = useRef(fn);
  fnRef.current = fn;

  const run = useCallback(async () => {
    try {
      const result = await fnRef.current();
      setData(result);
      setError(null);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Request failed");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    setLoading(true);
    run();
    if (!pollMs) return;
    const id = setInterval(run, pollMs);
    return () => clearInterval(id);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, deps);

  return { data, loading, error, refetch: run };
}

/** State that persists to localStorage under the given key. */
export function usePersistentState<T>(
  key: string,
  initial: T
): [T, (v: T | ((prev: T) => T)) => void] {
  const [value, setValue] = useState<T>(() => {
    try {
      const raw = localStorage.getItem(key);
      return raw !== null ? (JSON.parse(raw) as T) : initial;
    } catch {
      return initial;
    }
  });

  useEffect(() => {
    try {
      localStorage.setItem(key, JSON.stringify(value));
    } catch {
      /* storage may be unavailable; ignore */
    }
  }, [key, value]);

  return [value, setValue];
}

/** Tracks whether `element` is currently the fullscreen element. */
export function useFullscreen(element: HTMLElement | null) {
  const [isFullscreen, setIsFullscreen] = useState(false);

  useEffect(() => {
    const onChange = () =>
      setIsFullscreen(document.fullscreenElement === element);
    document.addEventListener("fullscreenchange", onChange);
    return () => document.removeEventListener("fullscreenchange", onChange);
  }, [element]);

  const toggle = useCallback(() => {
    if (!element) return;
    if (document.fullscreenElement === element) {
      document.exitFullscreen().catch(() => {});
    } else {
      element.requestFullscreen().catch(() => {});
    }
  }, [element]);

  return { isFullscreen, toggle };
}
