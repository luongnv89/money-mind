import { useEffect, useState } from 'react';

/** Search keystrokes are coalesced at ~150 ms so each keypress does not
 * re-filter and re-sort the whole table (F-PERF-008). */
export const SEARCH_DEBOUNCE_MS = 150;

/**
 * Return `value` delayed by `delayMs`, so fast-changing input (typing) does not
 * drive per-keystroke recomputation. The returned value only updates after the
 * input has been quiet for `delayMs`; clearing to '' follows the same delay,
 * keeping behavior uniform for show/hide of the clear button.
 */
export const useDebouncedValue = <T>(value: T, delayMs: number = SEARCH_DEBOUNCE_MS): T => {
  const [debounced, setDebounced] = useState(value);

  useEffect(() => {
    const timer = setTimeout(() => setDebounced(value), delayMs);
    return () => clearTimeout(timer);
  }, [value, delayMs]);

  return debounced;
};
