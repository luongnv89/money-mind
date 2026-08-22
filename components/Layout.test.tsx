import React from 'react';
import { createRoot } from 'react-dom/client';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { Layout } from './Layout';
import { useTransactionStore } from '../stores/useTransactionStore';
import { useSettingsStore } from '../stores/useSettingsStore';
import { Transaction, TransactionCategory } from '../types';
import pkg from '../package.json';

const tx: Transaction = {
  id: 'tx-1',
  date: '2026-01-15',
  description: 'STARBUCKS STORE',
  amount: -5.75,
  category: TransactionCategory.Uncategorized,
  confidence: 0.4,
};

describe('Layout chrome (issue #41, F-UX-008/011/012/013)', () => {
  let container: HTMLDivElement;
  let root: ReturnType<typeof createRoot>;
  const onViewChange = vi.fn();

  const render = () => {
    container = document.createElement('div');
    document.body.appendChild(container);
    root = createRoot(container);
    React.act(() => {
      root.render(
        <Layout currentView="dashboard" onViewChange={onViewChange}>
          <p>content</p>
        </Layout>
      );
    });
  };

  beforeEach(() => {
    useSettingsStore.setState({ isDemoMode: false });
    useTransactionStore.setState({ transactions: [tx], error: null });
    onViewChange.mockClear();
  });

  afterEach(() => {
    React.act(() => root?.unmount());
    container?.remove();
    vi.clearAllMocks();
  });

  it('keeps Clear reachable at every breakpoint (label collapses, button stays)', () => {
    render();

    const clear = container.querySelector('button[aria-label="Clear all transactions"]');
    expect(clear).not.toBeNull();
    // The button itself must not be display:none on mobile — only its label
    // collapses (token check: 'focus-visible:outline-hidden' also contains
    // the substring 'hidden').
    expect(clear?.classList.contains('hidden')).toBe(false);
    const label = clear?.querySelector('span');
    expect(label?.className).toContain('hidden');
    expect(label?.className).toContain('sm:inline');
  });

  it('labels the Settings icon button and navigates on click', () => {
    render();

    const settings = container.querySelector('button[aria-label="Settings"]') as HTMLButtonElement;
    expect(settings).not.toBeNull();
    expect(settings?.getAttribute('title')).toBe('Settings');
    expect(settings?.textContent).toContain('Settings');

    React.act(() => {
      settings!.click();
    });
    expect(onViewChange).toHaveBeenCalledWith('settings');
  });

  it('injects the version string from package.json at build time', () => {
    render();

    const version = Array.from(container.querySelectorAll('footer span')).find((s) =>
      s.textContent?.startsWith('v')
    );
    expect(version?.textContent).toBe(`v${pkg.version}`);
  });

  it('announces the chat FAB to assistive tech (F-UX-012)', () => {
    render();

    // Rendered by Layout via MonkeySmileChat once transactions exist.
    const announcement = container.querySelector('p[role="status"]');
    expect(announcement?.textContent).toMatch(/MonkeySmile budget chat is available/i);

    const fab = container.querySelector(
      'button[aria-label="Toggle MonkeySmile Chat"]'
    ) as HTMLButtonElement;
    expect(fab).not.toBeNull();
    expect(fab.getAttribute('aria-expanded')).toBe('false');
  });
});
