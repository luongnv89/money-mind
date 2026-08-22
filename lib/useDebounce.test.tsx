import React from 'react';
import { createRoot } from 'react-dom/client';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { SEARCH_DEBOUNCE_MS, useDebouncedValue } from './useDebounce';

describe('useDebouncedValue (issue #40, F-PERF-008)', () => {
  let container: HTMLDivElement;
  let root: ReturnType<typeof createRoot>;
  let captured: string | undefined;

  const Harness = ({ value, delay }: { value: string; delay?: number }) => {
    captured = useDebouncedValue(value, delay);
    return null;
  };

  const render = (value: string, delay?: number) => {
    React.act(() => {
      root.render(<Harness value={value} delay={delay} />);
    });
  };

  const advance = (ms: number) => {
    React.act(() => {
      vi.advanceTimersByTime(ms);
    });
  };

  beforeEach(() => {
    vi.useFakeTimers();
    captured = undefined;
    container = document.createElement('div');
    document.body.appendChild(container);
    root = createRoot(container);
  });

  afterEach(() => {
    React.act(() => root.unmount());
    container.remove();
    vi.useRealTimers();
  });

  it('returns the initial value without delay', () => {
    render('init');
    expect(captured).toBe('init');
  });

  it('holds the previous value until typing pauses for the debounce window', () => {
    render('a');
    expect(captured).toBe('a');

    render('ab');
    expect(captured).toBe('a');

    advance(SEARCH_DEBOUNCE_MS - 1);
    expect(captured).toBe('a');

    advance(1);
    expect(captured).toBe('ab');
  });

  it('coalesces rapid keystrokes into one update', () => {
    render('a');
    render('ab');
    advance(100);
    render('abc');
    advance(100);
    // Every keystroke restarts the timer, so nothing has been emitted yet.
    expect(captured).toBe('a');

    advance(SEARCH_DEBOUNCE_MS);
    expect(captured).toBe('abc');
  });

  it('honours a custom delay', () => {
    render('x', 10);
    render('xy', 10);
    advance(9);
    expect(captured).toBe('x');
    advance(1);
    expect(captured).toBe('xy');
  });

  it('cancels the pending update on unmount', () => {
    render('a');
    render('ab');
    React.act(() => root.unmount());
    expect(() => advance(SEARCH_DEBOUNCE_MS)).not.toThrow();
  });
});
