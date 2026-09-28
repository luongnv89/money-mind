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
        <Layout currentView="overview" onViewChange={onViewChange}>
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

  it('keeps destructive actions out of the header (Phase A3)', () => {
    render();

    // Deletion moved to Settings → Danger zone; nothing destructive in chrome.
    expect(container.querySelector('button[aria-label="Clear all transactions"]')).toBeNull();
    const headerButtons = Array.from(container.querySelectorAll('header button'));
    expect(headerButtons.some((b) => b.textContent?.match(/clear|delete/i))).toBe(false);
  });

  it('offers an Exit demo button that clears sample data and goes to upload', () => {
    useSettingsStore.setState({ isDemoMode: true });
    render();

    const banner = Array.from(container.querySelectorAll('div')).find((d) =>
      d.textContent?.includes("You're exploring sample data")
    );
    expect(banner).toBeDefined();

    const exit = Array.from(container.querySelectorAll('button')).find((b) =>
      b.textContent?.includes('Exit demo')
    ) as HTMLButtonElement;
    expect(exit).toBeDefined();

    React.act(() => {
      exit.click();
    });

    expect(useTransactionStore.getState().transactions).toHaveLength(0);
    expect(useSettingsStore.getState().isDemoMode).toBe(false);
    expect(onViewChange).toHaveBeenCalledWith('upload');
  });

  it('labels the Settings icon button and navigates on click', () => {
    render();

    const settings = container.querySelector('button[aria-label="Settings"]') as HTMLButtonElement;
    expect(settings).not.toBeNull();
    expect(settings?.getAttribute('title')).toBe('Settings');

    React.act(() => {
      settings!.click();
    });
    expect(onViewChange).toHaveBeenCalledWith('settings');
  });

  it('keeps primary navigation buttons named when labels are hidden on mobile', () => {
    render();

    const navButtons = Array.from(container.querySelectorAll('nav[aria-label="Primary"] button'));
    expect(navButtons.map((button) => button.getAttribute('aria-label'))).toEqual([
      'Overview',
      'Transactions',
      'Import',
    ]);
  });

  it('injects the version string from package.json at build time', () => {
    render();

    const version = Array.from(container.querySelectorAll('footer span')).find((s) =>
      s.textContent?.startsWith('v')
    );
    expect(version?.textContent).toBe(`v${pkg.version}`);
  });

  it('announces the assistant FAB to assistive tech (F-UX-012)', () => {
    render();

    // Rendered by Layout via AssistantChat once transactions exist.
    const announcement = container.querySelector('p[role="status"]');
    expect(announcement?.textContent).toMatch(/MoneyMind Assistant chat is available/i);

    const fab = container.querySelector(
      'button[aria-label="Open MoneyMind Assistant"]'
    ) as HTMLButtonElement;
    expect(fab).not.toBeNull();
  });
});
