import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { createThrottledStorage } from './throttledStorage';

const INTERVAL = 1000;

const memoryStorage = (): Pick<Storage, 'getItem' | 'setItem' | 'removeItem'> & {
  writes: { key: string; value: string }[];
} => {
  const store = new Map<string, string>();
  const writes: { key: string; value: string }[] = [];
  return {
    writes,
    getItem: (key: string) => (store.has(key) ? store.get(key)! : null),
    setItem: (key: string, value: string) => {
      store.set(key, String(value));
      writes.push({ key, value: String(value) });
    },
    removeItem: (key: string) => {
      store.delete(key);
    },
  };
};

describe('createThrottledStorage (F-PERF-001)', () => {
  let backing: ReturnType<typeof memoryStorage>;
  let storage: ReturnType<typeof createThrottledStorage>;

  beforeEach(() => {
    vi.useFakeTimers();
    backing = memoryStorage();
    storage = createThrottledStorage(INTERVAL, backing);
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it('writes the first value immediately and coalesces a 200-write burst into one trailing write', () => {
    for (let i = 0; i < 200; i++) {
      storage.setItem('k', `v${i}`);
    }

    // Leading edge: exactly one synchronous write for the whole burst.
    expect(backing.writes).toHaveLength(1);
    expect(backing.writes[0].value).toBe('v0');

    vi.advanceTimersByTime(INTERVAL);

    // Trailing edge: one more write carrying the newest value.
    expect(backing.writes).toHaveLength(2);
    expect(backing.writes[1].value).toBe('v199');
  });

  it('serves the pending value from getItem before the trailing write lands', () => {
    storage.setItem('k', 'first'); // leading write
    storage.setItem('k', 'pending');
    expect(backing.writes).toHaveLength(1);
    expect(storage.getItem('k')).toBe('pending');
  });

  it('flush() writes pending values synchronously and cancels the timer', () => {
    storage.setItem('k', 'first');
    storage.setItem('k', 'pending');
    storage.flush();
    expect(backing.writes).toHaveLength(2);
    expect(backing.writes[1].value).toBe('pending');

    // The cancelled timer must not produce a duplicate write.
    vi.advanceTimersByTime(INTERVAL * 2);
    expect(backing.writes).toHaveLength(2);
  });

  it('does not write again until the interval has elapsed', () => {
    storage.setItem('k', 'a'); // leading write
    vi.advanceTimersByTime(INTERVAL); // interval passes quietly
    storage.setItem('k', 'b'); // new leading write lands immediately
    expect(backing.writes).toHaveLength(2);
    expect(backing.writes[1].value).toBe('b');

    storage.setItem('k', 'c'); // inside the interval — must stay pending
    expect(backing.writes).toHaveLength(2);
    vi.advanceTimersByTime(INTERVAL);
    expect(backing.writes).toHaveLength(3);
    expect(backing.writes[2].value).toBe('c');
  });

  it('removeItem cancels the pending write and clears the backing store', () => {
    storage.setItem('k', 'first');
    storage.setItem('k', 'pending');
    storage.removeItem('k');
    vi.advanceTimersByTime(INTERVAL * 2);
    expect(backing.writes).toHaveLength(1); // only the leading write
    expect(storage.getItem('k')).toBeNull();
  });

  it('flushes pending writes on pagehide', () => {
    storage.setItem('k', 'first');
    storage.setItem('k', 'pending');
    window.dispatchEvent(new Event('pagehide'));
    expect(backing.writes).toHaveLength(2);
    expect(backing.writes[1].value).toBe('pending');
  });
});
