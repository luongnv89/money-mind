import React from 'react';
import { createRoot } from 'react-dom/client';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { SegmentedControl, InfoTip, Toggle } from './UI';

describe('UI primitives (Phase A2)', () => {
  let container: HTMLDivElement;
  let root: ReturnType<typeof createRoot>;

  const render = async (node: React.ReactNode) => {
    container = document.createElement('div');
    document.body.appendChild(container);
    root = createRoot(container);
    await React.act(async () => {
      root.render(node);
    });
    return container;
  };

  afterEach(() => {
    React.act(() => root?.unmount());
    container?.remove();
    vi.clearAllMocks();
  });

  describe('SegmentedControl', () => {
    const OPTIONS = [
      { value: 'week', label: 'Week' },
      { value: 'month', label: 'Month' },
      { value: 'year', label: 'Year' },
    ] as const;

    it('renders a radiogroup with roving tabindex', async () => {
      const c = await render(
        <SegmentedControl options={OPTIONS} value="week" onChange={() => {}} ariaLabel="Range" />
      );
      const group = c.querySelector('[role="radiogroup"]');
      expect(group).not.toBeNull();
      const radios = Array.from(c.querySelectorAll('[role="radio"]'));
      expect(radios.map((r) => r.getAttribute('aria-checked'))).toEqual(['true', 'false', 'false']);
      expect(radios.map((r) => (r as HTMLButtonElement).tabIndex)).toEqual([0, -1, -1]);
    });

    it('arrow keys move selection and focus', async () => {
      const onChange = vi.fn();
      const c = await render(
        <SegmentedControl options={OPTIONS} value="week" onChange={onChange} ariaLabel="Range" />
      );
      const first = c.querySelector('[role="radio"]') as HTMLButtonElement;
      await React.act(async () => {
        first.dispatchEvent(new KeyboardEvent('keydown', { key: 'ArrowRight', bubbles: true }));
      });
      expect(onChange).toHaveBeenCalledWith('month');
      const month = Array.from(c.querySelectorAll('[role="radio"]'))[1];
      expect(document.activeElement).toBe(month);
    });

    it('wraps ArrowLeft from the first option to the last', async () => {
      const onChange = vi.fn();
      const c = await render(
        <SegmentedControl options={OPTIONS} value="week" onChange={onChange} ariaLabel="Range" />
      );
      const first = c.querySelector('[role="radio"]') as HTMLButtonElement;
      await React.act(async () => {
        first.dispatchEvent(new KeyboardEvent('keydown', { key: 'ArrowLeft', bubbles: true }));
      });
      expect(onChange).toHaveBeenCalledWith('year');
    });
  });

  describe('InfoTip', () => {
    it('toggles an accessible popover and closes on Escape', async () => {
      const c = await render(
        <InfoTip title="Spending">
          <p>Sum of money out.</p>
        </InfoTip>
      );
      const trigger = c.querySelector('button[aria-label="About Spending"]') as HTMLButtonElement;
      expect(trigger).not.toBeNull();
      expect(trigger.getAttribute('aria-expanded')).toBe('false');
      expect(c.querySelector('[role="dialog"]')).toBeNull();

      await React.act(async () => {
        trigger.click();
      });
      expect(trigger.getAttribute('aria-expanded')).toBe('true');
      const dialog = c.querySelector('[role="dialog"]');
      expect(dialog?.textContent).toContain('Sum of money out.');
      expect(trigger.getAttribute('aria-controls')).toBe(dialog?.id);

      await React.act(async () => {
        document.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape' }));
      });
      expect(trigger.getAttribute('aria-expanded')).toBe('false');
      expect(c.querySelector('[role="dialog"]')).toBeNull();
    });

    it('closes on an outside click', async () => {
      const c = await render(<InfoTip title="Income">money in</InfoTip>);
      const trigger = c.querySelector('button') as HTMLButtonElement;
      await React.act(async () => {
        trigger.click();
      });
      expect(c.querySelector('[role="dialog"]')).not.toBeNull();

      await React.act(async () => {
        document.body.dispatchEvent(new MouseEvent('mousedown', { bubbles: true }));
      });
      expect(c.querySelector('[role="dialog"]')).toBeNull();
    });
  });

  describe('Toggle', () => {
    it('exposes role="switch" and flips aria-checked on click', async () => {
      const onChange = vi.fn();
      const c = await render(<Toggle checked={false} onChange={onChange} label="Alerts" />);
      const sw = c.querySelector('button[role="switch"]') as HTMLButtonElement;
      expect(sw.getAttribute('aria-checked')).toBe('false');

      await React.act(async () => {
        sw.click();
      });
      expect(onChange).toHaveBeenCalledWith(true);
    });

    it('renders checked state', async () => {
      const c = await render(<Toggle checked={true} onChange={() => {}} label="Alerts" />);
      expect(c.querySelector('[role="switch"]')?.getAttribute('aria-checked')).toBe('true');
    });
  });
});
