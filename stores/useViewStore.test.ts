import { beforeEach, describe, expect, it } from 'vitest';
import { useViewStore } from './useViewStore';

describe('useViewStore', () => {
  beforeEach(() => {
    useViewStore.setState({ granularity: 'month', anchor: null });
  });

  it('defaults to the latest month', () => {
    expect(useViewStore.getState().granularity).toBe('month');
    expect(useViewStore.getState().anchor).toBeNull();
  });

  it('switching granularity keeps the stored anchor (pages preserve the user place)', () => {
    useViewStore.getState().setAnchor('2026-04-30');
    useViewStore.getState().setGranularity('quarter');
    expect(useViewStore.getState().granularity).toBe('quarter');
    expect(useViewStore.getState().anchor).toBe('2026-04-30');
  });

  it('setAnchor accepts a reset to null (back to latest)', () => {
    useViewStore.getState().setAnchor('2026-04-30');
    useViewStore.getState().setAnchor(null);
    expect(useViewStore.getState().anchor).toBeNull();
  });
});
