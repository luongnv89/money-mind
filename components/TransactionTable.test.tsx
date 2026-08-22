import React from 'react';
import { createRoot } from 'react-dom/client';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { TransactionTable } from './TransactionTable';
import { Transaction, TransactionCategory } from '../types';

const tx = (overrides: Partial<Transaction> = {}): Transaction => ({
  id: 'tx-1',
  date: '2026-01-15',
  description: 'STARBUCKS STORE',
  amount: -5.75,
  category: TransactionCategory.Uncategorized,
  confidence: 0.4,
  isApproved: false,
  ...overrides,
});

describe('TransactionTable (issues #40 and #41)', () => {
  let container: HTMLDivElement;
  let root: ReturnType<typeof createRoot>;

  const render = (transactions: Transaction[]) => {
    container = document.createElement('div');
    document.body.appendChild(container);
    root = createRoot(container);
    React.act(() => {
      root.render(<TransactionTable transactions={transactions} />);
    });
  };

  const rowTds = () => Array.from(container.querySelectorAll('tbody tr:first-child td'));
  const categoryButton = () =>
    container.querySelector('button[aria-label^="Change category for"]') as HTMLButtonElement;
  const verifyButton = () =>
    container.querySelector('button[aria-label^="Verify:"]') as HTMLButtonElement;
  const deleteButton = () =>
    container.querySelector('button[aria-label^="Delete transaction"]') as HTMLButtonElement;
  const dropdown = () =>
    document.body.querySelector('.z-\\[9999\\] > div:last-child') as HTMLElement;

  beforeEach(() => {
    vi.useRealTimers();
  });

  afterEach(() => {
    React.act(() => root?.unmount());
    container?.remove();
    vi.restoreAllMocks();
  });

  describe('touch targets and explanations (F-UX-006, F-UX-010)', () => {
    it('renders every interactive row at least 44px tall (h-11 / min-h-11)', () => {
      render([tx()]);

      expect(rowTds().length).toBeGreaterThan(0);
      rowTds().forEach((td) => expect(td.className).toContain('h-11'));
      expect(categoryButton().className).toContain('min-h-11');
      expect(verifyButton().className).toContain('min-h-11');
      expect(deleteButton().className).toContain('min-h-11');
      expect(deleteButton().className).toContain('min-w-11');
    });

    it('explains what Verify and the confidence bar mean', () => {
      render([tx()]);

      expect(verifyButton().getAttribute('aria-label')).toBe(
        'Verify: confirm the suggested category for STARBUCKS STORE'
      );
      expect(verifyButton().title).toMatch(/confirm the suggested category/i);
      const confidenceCell = verifyButton().closest('td')?.previousElementSibling as HTMLElement;
      expect(confidenceCell.querySelector('div')?.title).toMatch(/how confident/i);
    });

    it('labels the category and delete icon buttons', () => {
      render([tx()]);

      expect(categoryButton().getAttribute('aria-label')).toBe(
        'Change category for STARBUCKS STORE'
      );
      expect(deleteButton().getAttribute('aria-label')).toBe('Delete transaction STARBUCKS STORE');
    });
  });

  describe('search debounce (F-PERF-008)', () => {
    it('waits ~150ms before re-filtering so typing stays cheap', () => {
      vi.useFakeTimers();
      render([tx({ id: 'a' }), tx({ id: 'b', description: 'NETFLIX.COM' })]);

      const input = container.querySelector(
        'input[placeholder="Search transactions..."]'
      ) as HTMLInputElement;
      const setNative = Object.getOwnPropertyDescriptor(window.HTMLInputElement.prototype, 'value')
        ?.set as (v: string) => void;

      React.act(() => {
        setNative.call(input, 'netflix');
        input.dispatchEvent(new Event('input', { bubbles: true }));
      });

      // Keystroke landed, but the filter has not run yet.
      expect(container.querySelectorAll('tbody tr')).toHaveLength(2);

      React.act(() => {
        vi.advanceTimersByTime(150);
      });
      expect(container.querySelectorAll('tbody tr')).toHaveLength(1);
      expect(container.querySelector('tbody')?.textContent).toContain('NETFLIX.COM');
      vi.useRealTimers();
    });
  });

  describe('category dropdown follows the anchor (F-UX-009)', () => {
    const rect = (top: number, bottom: number): DOMRect =>
      ({
        top,
        bottom,
        left: 20,
        right: 200,
        width: 180,
        height: bottom - top,
        x: 20,
        y: top,
        toJSON: () => ({}),
      }) as unknown as DOMRect;

    it('repositions while the anchor is on screen and closes when it leaves', () => {
      render([tx()]);

      const anchor = categoryButton();
      anchor.getBoundingClientRect = () => rect(100, 130);

      React.act(() => {
        anchor.click();
      });
      const panel = dropdown();
      expect(panel).not.toBeNull();
      // Opened below the anchor: 130 + 8px padding.
      expect(panel.style.top).toBe('138px');

      // Page scrolls: the anchor moves down but stays visible -> follow it.
      anchor.getBoundingClientRect = () => rect(170, 200);
      React.act(() => {
        window.dispatchEvent(new Event('scroll'));
      });
      expect(dropdown().style.top).toBe('208px');

      // The anchor scrolls out of the viewport -> close instead of detaching.
      anchor.getBoundingClientRect = () => rect(800, 830);
      React.act(() => {
        window.dispatchEvent(new Event('scroll'));
      });
      expect(dropdown()).toBeNull();
    });
  });
});
