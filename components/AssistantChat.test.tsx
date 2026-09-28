import React from 'react';
import { createRoot } from 'react-dom/client';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { householdQuarter } from '../lib/finance/fixtures.test-util';
import { useSettingsStore } from '../stores/useSettingsStore';
import { useTransactionStore } from '../stores/useTransactionStore';
import { useViewStore } from '../stores/useViewStore';
import { View } from '../types';

const chatMock = vi.fn<(query: string, context: string) => Promise<string>>();
vi.mock('../services/aiService', () => ({
  chatWithFinancialAgent: (q: string, c: string) => chatMock(q, c),
}));

import { AssistantChat } from './AssistantChat';

describe('AssistantChat', () => {
  let container: HTMLDivElement;
  let root: ReturnType<typeof createRoot>;
  const onNavigate = vi.fn<(view: View) => void>();

  const render = () => {
    container = document.createElement('div');
    document.body.appendChild(container);
    root = createRoot(container);
    React.act(() => {
      root.render(<AssistantChat onNavigate={onNavigate} />);
    });
  };

  const openPanel = () => {
    const fab = container.querySelector(
      'button[aria-label="Open MoneyMind Assistant"]'
    ) as HTMLButtonElement;
    React.act(() => fab.click());
  };

  beforeEach(() => {
    useTransactionStore.setState({ transactions: householdQuarter(), error: null });
    useViewStore.setState({ granularity: 'month', anchor: '2026-04-30' });
    useSettingsStore.setState({
      currency: 'USD',
      aiMode: 'cloud',
      isDemoMode: false,
      geminiConfig: { apiKey: '', model: 'm' },
      typesafeConfig: { apiKey: '' },
    });
    chatMock.mockReset();
    chatMock.mockResolvedValue('ok');
    onNavigate.mockClear();
  });

  afterEach(() => {
    React.act(() => root?.unmount());
    container?.remove();
    useTransactionStore.getState().clearAll();
    useViewStore.setState({ granularity: 'month', anchor: null });
  });

  it('shows a Settings call-to-action when no assistant is configured', () => {
    render();
    openPanel();

    expect(container.textContent).toContain(
      'The Assistant needs a language model to write answers'
    );
    const cta = Array.from(container.querySelectorAll('button')).find(
      (b) => b.textContent === 'Set up in Settings'
    ) as HTMLButtonElement;
    React.act(() => cta.click());
    expect(onNavigate).toHaveBeenCalledWith('settings');
  });

  it('moves focus into the dialog and restores it on Escape or close', () => {
    render();
    const launcher = container.querySelector(
      'button[aria-label="Open MoneyMind Assistant"]'
    ) as HTMLButtonElement;
    expect(document.activeElement).not.toBe(launcher);
    React.act(() => launcher.click());
    const dialog = container.querySelector('[role="dialog"]') as HTMLDivElement;
    expect(document.activeElement).toBe(
      container.querySelector('button[aria-label="Close assistant"]')
    );

    React.act(() =>
      dialog.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape', bubbles: true }))
    );
    expect(document.activeElement).toBe(
      container.querySelector('button[aria-label="Open MoneyMind Assistant"]')
    );

    openPanel();
    const close = container.querySelector(
      'button[aria-label="Close assistant"]'
    ) as HTMLButtonElement;
    React.act(() => close.click());
    expect(document.activeElement).toBe(
      container.querySelector('button[aria-label="Open MoneyMind Assistant"]')
    );
  });

  it('sends the engine-built context for the selected period', async () => {
    useSettingsStore.setState({ geminiConfig: { apiKey: btoa('k'), model: 'm' } });
    render();
    openPanel();

    const input = container.querySelector('input[aria-label="Ask the Assistant"]');
    expect(input).not.toBeNull();

    // Click a suggestion chip — it sends immediately.
    const chip = Array.from(container.querySelectorAll('button')).find(
      (b) => b.textContent === 'How can I reach a 20% savings rate?'
    ) as HTMLButtonElement;
    await React.act(async () => {
      chip.click();
    });

    expect(chatMock).toHaveBeenCalledTimes(1);
    const [query, context] = chatMock.mock.calls[0];
    expect(query).toBe('How can I reach a 20% savings rate?');
    expect(context).toContain('Selected period: April 2026');
  });
});
