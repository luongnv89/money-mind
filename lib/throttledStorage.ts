/**
 * Throttled localStorage wrapper for high-frequency state writes (F-PERF-001).
 *
 * Zustand's `persist` middleware serializes its (partialized) state on every
 * `set()`. During a batched AI analysis the store is updated once per batch —
 * ~200 full-array JSON serializations at 5,000 rows — all synchronous on the
 * main thread. Wrapping the storage limits persistence to at most one write
 * per `minIntervalMs` while keeping the latest value visible to readers:
 *
 * - Leading edge: the first write after a quiet interval lands immediately.
 * - Trailing edge: writes inside the interval are coalesced; the newest value
 *   for each key is flushed once the interval elapses.
 * - `flush()` forces pending writes synchronously and is bound to `pagehide`
 *   so a pending write cannot be lost when the tab closes.
 */

export interface ThrottledStorage {
  getItem: (key: string) => string | null;
  setItem: (key: string, value: string) => void;
  removeItem: (key: string) => void;
  /** Write any pending (throttled) values immediately. */
  flush: () => void;
}

export const createThrottledStorage = (
  minIntervalMs: number,
  target?: Pick<Storage, 'getItem' | 'setItem' | 'removeItem'>
): ThrottledStorage => {
  const backing = target ?? globalThis.localStorage;
  const pending = new Map<string, string>();
  let timer: ReturnType<typeof setTimeout> | null = null;
  let lastWrite = 0;

  const writeNow = (): void => {
    if (pending.size === 0) return;
    for (const [key, value] of pending) {
      backing.setItem(key, value);
    }
    pending.clear();
    lastWrite = Date.now();
  };

  const schedule = (): void => {
    if (timer) return;
    const delay = Math.max(0, lastWrite + minIntervalMs - Date.now());
    timer = setTimeout(() => {
      timer = null;
      writeNow();
    }, delay);
  };

  const flush = (): void => {
    if (timer) {
      clearTimeout(timer);
      timer = null;
    }
    writeNow();
  };

  const storage: ThrottledStorage = {
    // A pending value is newer than whatever is on disk, so serve it first.
    getItem: (key) => (pending.has(key) ? pending.get(key)! : backing.getItem(key)),
    setItem: (key, value) => {
      pending.set(key, String(value));
      if (Date.now() - lastWrite >= minIntervalMs) {
        flush();
      } else {
        schedule();
      }
    },
    removeItem: (key) => {
      pending.delete(key);
      backing.removeItem(key);
    },
    flush,
  };

  // Close the throttling data-loss window: flush before the tab goes away.
  if (typeof window !== 'undefined') {
    window.addEventListener('pagehide', storage.flush);
  }

  return storage;
};
