import React from 'react';
import { createRoot } from 'react-dom/client';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { useDashboardViewModel } from './useDashboardViewModel';
import { useTransactionStore } from '../../stores/useTransactionStore';
import { useSettingsStore } from '../../stores/useSettingsStore';
import { clearPatterns, learnPattern } from '../../lib/localStorage';
import { Transaction, TransactionCategory } from '../../types';

vi.mock('../../services/aiService', () => ({
  categorizeWithAI: vi.fn(),
  chatWithFinancialAgent: vi.fn(),
  checkServerAvailability: vi.fn(),
}));

const tx = (id: string, date = '2026-01-15'): Transaction => ({
  id,
  date,
  description: 'STARBUCKS #12345',
  amount: -5,
  category: TransactionCategory.Uncategorized,
  confidence: 0,
});

describe('useDashboardViewModel flags (issue #37)', () => {
  let container: HTMLDivElement;
  let root: ReturnType<typeof createRoot>;
  let vm: ReturnType<typeof useDashboardViewModel>;

  const render = () => {
    container = document.createElement('div');
    document.body.appendChild(container);
    root = createRoot(container);
    React.act(() => {
      root.render(
        <Harness
          capture={(value) => {
            vm = value;
          }}
        />
      );
    });
  };

  const Harness = ({
    capture,
  }: {
    capture: (vm: ReturnType<typeof useDashboardViewModel>) => void;
  }) => {
    capture(useDashboardViewModel(() => {}));
    return null;
  };

  beforeEach(() => {
    localStorage.clear();
    clearPatterns();
    useTransactionStore.setState({ transactions: [], error: null });
    useSettingsStore.setState({
      isDemoMode: false,
      aiMode: 'cloud',
      geminiConfig: { apiKey: '', model: 'models/gemini-flash-latest' },
      groqConfig: { apiKey: '', model: 'llama-3.1-8b-instant' },
    });
  });

  afterEach(() => {
    if (root) React.act(() => root.unmount());
    container?.remove();
    vi.clearAllMocks();
  });

  it('isAIConfigured flips to true as soon as a Gemini key is saved (F-BUG-014)', () => {
    render();
    expect(vm.isAIConfigured).toBe(false);

    React.act(() => {
      useSettingsStore.getState().setGeminiConfig({ apiKey: btoa('saved-key') });
    });

    expect(vm.isAIConfigured).toBe(true);
  });

  it('isAIConfigured flips to true as soon as a Groq key is saved', () => {
    useSettingsStore.setState({ aiMode: 'groq' });
    render();
    expect(vm.isAIConfigured).toBe(false);

    React.act(() => {
      useSettingsStore.getState().setGroqConfig({ apiKey: btoa('gsk-saved') });
    });

    expect(vm.isAIConfigured).toBe(true);
  });

  it('hasPatterns re-checks learned patterns when transactions change (F-BUG-013)', () => {
    render();
    expect(vm.hasPatterns).toBe(false);

    React.act(() => {
      // Learning happens alongside a transaction change (e.g. manual add).
      learnPattern(tx('tx-1'), TransactionCategory.NiceToHave, 'Coffee');
      useTransactionStore.getState().addTransactions([tx('tx-1')]);
    });

    expect(vm.hasPatterns).toBe(true);
  });
});
