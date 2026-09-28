import React from 'react';
import { createRoot } from 'react-dom/client';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { AddTransactionModal } from './AddTransactionModal';
import { Transaction } from '../types';

const setInputValue = (el: HTMLInputElement, value: string) => {
  Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, 'value')!.set!.call(el, value);
  el.dispatchEvent(new Event('input', { bubbles: true }));
};

const setSelectValue = (el: HTMLSelectElement, value: string) => {
  Object.getOwnPropertyDescriptor(HTMLSelectElement.prototype, 'value')!.set!.call(el, value);
  el.dispatchEvent(new Event('change', { bubbles: true }));
};

const findButton = (container: HTMLElement, text: string) =>
  Array.from(container.querySelectorAll('button')).find((b) =>
    b.textContent?.trim().startsWith(text)
  ) as HTMLButtonElement;

describe('AddTransactionModal — type toggle exposes selected state (review F14, WCAG 4.1.2)', () => {
  let container: HTMLDivElement;
  let root: ReturnType<typeof createRoot>;

  const render = async (onSave = vi.fn()) => {
    container = document.createElement('div');
    document.body.appendChild(container);
    root = createRoot(container);
    await React.act(async () => {
      root.render(<AddTransactionModal onClose={() => {}} onSave={onSave} />);
    });
    return onSave;
  };

  afterEach(() => {
    React.act(() => root?.unmount());
    container?.remove();
    vi.clearAllMocks();
  });

  it('marks Expense/Income with aria-pressed inside a labelled group', async () => {
    await render();

    const group = container.querySelector('[role="group"]');
    expect(group?.getAttribute('aria-label')).toBe('Transaction type');

    const expense = findButton(container, 'Expense');
    const income = findButton(container, 'Income');
    expect(expense.getAttribute('aria-pressed')).toBe('true');
    expect(income.getAttribute('aria-pressed')).toBe('false');

    await React.act(async () => {
      income.click();
    });
    expect(expense.getAttribute('aria-pressed')).toBe('false');
    expect(income.getAttribute('aria-pressed')).toBe('true');
  });

  it('applies the announced sign when saving (income positive, expense negative)', async () => {
    const onSave = await render();
    const desc = container.querySelector(
      'input[type="text"], input:not([type])'
    ) as HTMLInputElement;
    const amount = container.querySelector('input[type="number"]') as HTMLInputElement;

    // Income path
    await React.act(async () => {
      findButton(container, 'Income').click();
    });
    await React.act(async () => {
      setInputValue(desc, 'Salary');
      setInputValue(amount, '100');
    });
    await React.act(async () => {
      container
        .querySelector('form')!
        .dispatchEvent(new Event('submit', { bubbles: true, cancelable: true }));
    });
    expect(onSave).toHaveBeenCalledTimes(1);
    expect((onSave.mock.calls[0][0] as Transaction).amount).toBe(100);

    // Expense path — needs a category selected too.
    await React.act(async () => {
      findButton(container, 'Expense').click();
    });
    const category = container.querySelector('select') as HTMLSelectElement;
    await React.act(async () => {
      setInputValue(desc, 'Coffee');
      setInputValue(amount, '4.5');
      setSelectValue(category, 'Waste');
    });
    await React.act(async () => {
      container
        .querySelector('form')!
        .dispatchEvent(new Event('submit', { bubbles: true, cancelable: true }));
    });
    expect(onSave).toHaveBeenCalledTimes(2);
    expect((onSave.mock.calls[1][0] as Transaction).amount).toBe(-4.5);
  });
});
