import { create } from 'zustand';
import type { Granularity } from '../lib/finance';

/**
 * The shared period selection for the Overview and Transactions pages.
 * Deliberately NOT persisted: a session always opens on the latest data
 * (`anchor: null` → the most recent period).
 */
interface ViewState {
  granularity: Granularity;
  /** ISO `YYYY-MM-DD` the selection is anchored to; null = latest period. */
  anchor: string | null;
  setGranularity: (granularity: Granularity) => void;
  setAnchor: (anchor: string | null) => void;
}

export const useViewStore = create<ViewState>()((set) => ({
  granularity: 'month',
  anchor: null,
  setGranularity: (granularity) => set({ granularity }),
  setAnchor: (anchor) => set({ anchor }),
}));
