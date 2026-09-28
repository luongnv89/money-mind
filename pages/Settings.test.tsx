import React from 'react';
import { createRoot } from 'react-dom/client';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { SettingsPage } from './Settings';
import { useSettingsStore } from '../stores/useSettingsStore';
import { useTransactionStore } from '../stores/useTransactionStore';
import { loadModelCatalog } from '../services/modelCatalog';
import { testTypesafeConnection } from '../services/typesafeService';
import { ModelInfo } from '../types';

vi.mock('../services/modelCatalog', async (importOriginal) => {
  const actual = await importOriginal<typeof import('../services/modelCatalog')>();
  return { ...actual, loadModelCatalog: vi.fn() };
});

vi.mock('../services/typesafeService', async (importOriginal) => {
  const actual = await importOriginal<typeof import('../services/typesafeService')>();
  return { ...actual, testTypesafeConnection: vi.fn() };
});

const liveModels: ModelInfo[] = [
  { id: 'models/gemini-flash-latest', label: 'gemini-flash-latest' },
  { id: 'models/gemini-flash-lite-latest', label: 'gemini-flash-lite-latest' },
];

describe('Settings stale-model reset announcements (issue #79, review ui-1)', () => {
  let container: HTMLDivElement;
  let root: ReturnType<typeof createRoot>;

  const render = async () => {
    container = document.createElement('div');
    document.body.appendChild(container);
    root = createRoot(container);
    await React.act(async () => {
      root.render(<SettingsPage onBack={() => {}} />);
    });
    // Let the mocked loadModelCatalog promise settle inside act.
    await React.act(async () => {});
  };

  beforeEach(() => {
    vi.mocked(loadModelCatalog).mockReset();
    vi.mocked(loadModelCatalog).mockResolvedValue({
      provider: 'cloud',
      status: 'live',
      models: liveModels,
    });
  });

  afterEach(() => {
    React.act(() => root?.unmount());
    container?.remove();
    vi.clearAllMocks();
  });

  it('announces the reset inside the role="status" catalog live region (WCAG 4.1.3)', async () => {
    useSettingsStore.setState({
      aiMode: 'cloud',
      geminiConfig: { apiKey: btoa('test-key'), model: 'models/gemini-1.5-pro-gone' },
    });

    await render();

    const liveRegion = container.querySelector(
      'div[role="status"][aria-label="Model catalog status"]'
    );
    expect(liveRegion).not.toBeNull();
    expect(liveRegion?.getAttribute('aria-live')).toBe('polite');
    // The toast container is not a live region, so the reset must be echoed
    // here for screen-reader users.
    expect(liveRegion?.textContent).toContain(
      'Saved model "models/gemini-1.5-pro-gone" is no longer available'
    );
    expect(liveRegion?.textContent).toContain('switched to "models/gemini-flash-latest"');
    expect(useSettingsStore.getState().geminiConfig.model).toBe('models/gemini-flash-latest');
  });

  it('stays silent when the saved model is still in the live list', async () => {
    useSettingsStore.setState({
      aiMode: 'cloud',
      geminiConfig: { apiKey: btoa('test-key'), model: 'models/gemini-flash-latest' },
    });

    await render();

    const liveRegion = container.querySelector(
      'div[role="status"][aria-label="Model catalog status"]'
    );
    expect(liveRegion?.textContent).not.toContain('no longer available');
  });
});

describe('Settings — custom OpenAI-compatible endpoint tab (issue #82)', () => {
  let container: HTMLDivElement;
  let root: ReturnType<typeof createRoot>;

  const render = async () => {
    container = document.createElement('div');
    document.body.appendChild(container);
    root = createRoot(container);
    await React.act(async () => {
      root.render(<SettingsPage onBack={() => {}} />);
    });
    await React.act(async () => {});
  };

  beforeEach(() => {
    window.localStorage.clear();
    useSettingsStore.getState().resetSettings();
    vi.mocked(loadModelCatalog).mockReset();
    vi.mocked(loadModelCatalog).mockResolvedValue({
      provider: 'custom',
      status: 'fallback',
      models: [{ id: 'gpt-3.5-turbo', label: 'gpt-3.5-turbo (Common alias)' }],
    });
  });

  afterEach(() => {
    React.act(() => root?.unmount());
    container?.remove();
    vi.clearAllMocks();
  });

  it('exposes the provider switcher with tablist/tab semantics (issue #82 review F2)', async () => {
    await render();

    const tabs = Array.from(container.querySelectorAll<HTMLButtonElement>('[role="tab"]'));
    expect(container.querySelector('[role="tablist"]')).not.toBeNull();
    expect(tabs.map((t) => t.id)).toEqual([
      'settings-tab-cloud',
      'settings-tab-groq',
      'settings-tab-local',
      'settings-tab-custom',
    ]);

    // Exactly one selected tab, wired to its panel via aria-controls.
    expect(tabs.filter((t) => t.getAttribute('aria-selected') === 'true')).toHaveLength(1);
    expect(tabs[0].getAttribute('aria-selected')).toBe('true');
    const panel = document.getElementById(tabs[0].getAttribute('aria-controls')!);
    expect(panel?.getAttribute('role')).toBe('tabpanel');
    expect(panel?.getAttribute('aria-labelledby')).toBe(tabs[0].id);

    // Roving tabindex follows selection.
    expect(tabs.map((t) => t.tabIndex)).toEqual([0, -1, -1, -1]);

    // Arrow keys move both selection and focus.
    await React.act(async () => {
      tabs[0].dispatchEvent(new KeyboardEvent('keydown', { key: 'ArrowRight', bubbles: true }));
    });
    await React.act(async () => {});
    expect(useSettingsStore.getState().aiMode).toBe('groq');
    expect(document.activeElement?.id).toBe('settings-tab-groq');
  });

  it('shows a scroll affordance and scrolls focused tabs into view (issue #82 review N4)', async () => {
    const scrollSpy = vi.fn();
    Object.defineProperty(window.HTMLElement.prototype, 'scrollIntoView', {
      value: scrollSpy,
      writable: true,
      configurable: true,
    });
    await render();

    // Edge fades mark that more provider tabs exist off-screen.
    expect(document.querySelector('[data-testid="provider-tabs-fade-left"]')).not.toBeNull();
    expect(
      document
        .querySelector('[data-testid="provider-tabs-fade-right"]')
        ?.getAttribute('aria-hidden')
    ).toBe('true');

    // Focusing a tab (keyboard or programmatic) scrolls it into view.
    const lastTab = document.getElementById('settings-tab-custom')!;
    await React.act(async () => {
      lastTab.dispatchEvent(new FocusEvent('focusin', { bubbles: true }));
    });
    expect(scrollSpy).toHaveBeenCalledWith({ block: 'nearest', inline: 'nearest' });
  });

  it('switches to the custom tab and renders Base URL, API key and model inputs', async () => {
    await render();

    const tab = Array.from(container.querySelectorAll('button')).find((b) =>
      b.textContent?.includes('Custom Endpoint')
    );
    expect(tab).toBeDefined();
    await React.act(async () => {
      tab!.click();
    });
    await React.act(async () => {});

    expect(useSettingsStore.getState().aiMode).toBe('custom');
    expect(container.querySelector('#custom-model')).not.toBeNull();
    expect(container.querySelector('input[type="password"]')).not.toBeNull();
    // Test Connection button is available in the shared footer
    expect(
      Array.from(container.querySelectorAll('button')).some((b) =>
        b.textContent?.includes('Test Connection')
      )
    ).toBe(true);
  });

  it('wires the Base URL input into the persisted store', async () => {
    useSettingsStore.setState({
      aiMode: 'custom',
      customConfig: { baseUrl: '', apiKey: btoa('sk-k'), model: 'm' },
    });
    await render();

    const baseUrlInput = Array.from(container.querySelectorAll('input')).find(
      (i) => i.placeholder === 'https://api.example.com/v1'
    );
    expect(baseUrlInput).toBeDefined();

    const setNative = Object.getOwnPropertyDescriptor(window.HTMLInputElement.prototype, 'value')
      ?.set as (v: string) => void;
    await React.act(async () => {
      setNative.call(baseUrlInput!, 'http://localhost:1234/v1');
      baseUrlInput!.dispatchEvent(new Event('input', { bubbles: true }));
    });

    expect(useSettingsStore.getState().customConfig.baseUrl).toBe('http://localhost:1234/v1');
  });

  it('wires free-text model entry into the persisted store', async () => {
    useSettingsStore.setState({
      aiMode: 'custom',
      customConfig: { baseUrl: 'http://localhost:1234/v1', apiKey: btoa('sk-k'), model: '' },
    });
    await render();

    const modelInput = container.querySelector<HTMLInputElement>('#custom-model');
    expect(modelInput).not.toBeNull();

    const setNative = Object.getOwnPropertyDescriptor(window.HTMLInputElement.prototype, 'value')
      ?.set as (v: string) => void;
    await React.act(async () => {
      setNative.call(modelInput!, 'my-finetune');
      modelInput!.dispatchEvent(new Event('input', { bubbles: true }));
    });

    expect(useSettingsStore.getState().customConfig.model).toBe('my-finetune');
  });
});

describe('Settings — TypeSafe card', () => {
  let container: HTMLDivElement;
  let root: ReturnType<typeof createRoot>;

  const render = async () => {
    container = document.createElement('div');
    document.body.appendChild(container);
    root = createRoot(container);
    await React.act(async () => {
      root.render(<SettingsPage onBack={() => {}} />);
    });
    await React.act(async () => {});
  };

  beforeEach(() => {
    window.localStorage.clear();
    useSettingsStore.getState().resetSettings();
    vi.mocked(loadModelCatalog).mockReset();
    vi.mocked(loadModelCatalog).mockResolvedValue({
      provider: 'cloud',
      status: 'live',
      models: liveModels,
    });
    vi.mocked(testTypesafeConnection).mockReset();
  });

  afterEach(() => {
    React.act(() => root?.unmount());
    container?.remove();
    vi.clearAllMocks();
  });

  it('stores the TypeSafe key obfuscated via the password input', async () => {
    await render();

    const input = container.querySelector<HTMLInputElement>('#typesafe-api-key');
    expect(input).not.toBeNull();

    const setNative = Object.getOwnPropertyDescriptor(window.HTMLInputElement.prototype, 'value')
      ?.set as (v: string) => void;
    await React.act(async () => {
      setNative.call(input!, 'ts-secret-key');
      input!.dispatchEvent(new Event('input', { bubbles: true }));
    });

    const stored = useSettingsStore.getState().typesafeConfig.apiKey;
    expect(stored).not.toBe('ts-secret-key');
    expect(atob(stored)).toBe('ts-secret-key');
  });

  it('runs the TypeSafe connection test and shows the success message', async () => {
    vi.mocked(testTypesafeConnection).mockResolvedValue(true);
    await render();

    const button = Array.from(container.querySelectorAll('button')).find((b) =>
      b.textContent?.includes('Test TypeSafe')
    );
    expect(button).toBeDefined();
    await React.act(async () => {
      button!.click();
    });
    await React.act(async () => {});

    expect(testTypesafeConnection).toHaveBeenCalled();
    expect(container.textContent).toContain('TypeSafe connection successful!');
  });
});

describe('Settings — danger zone & AI status rows (Phase A4)', () => {
  let container: HTMLDivElement;
  let root: ReturnType<typeof createRoot>;

  const render = async () => {
    container = document.createElement('div');
    document.body.appendChild(container);
    root = createRoot(container);
    await React.act(async () => {
      root.render(<SettingsPage onBack={() => {}} />);
    });
    await React.act(async () => {});
  };

  beforeEach(() => {
    window.localStorage.clear();
    useSettingsStore.getState().resetSettings();
    useTransactionStore.setState({ transactions: [], error: null });
    vi.mocked(loadModelCatalog).mockReset();
    vi.mocked(loadModelCatalog).mockResolvedValue({
      provider: 'cloud',
      status: 'live',
      models: liveModels,
    });
  });

  afterEach(() => {
    React.act(() => root?.unmount());
    container?.remove();
    vi.clearAllMocks();
  });

  it('renders the danger zone collapsed by default', async () => {
    await render();

    const details = Array.from(container.querySelectorAll('details')).find((d) =>
      d.textContent?.includes('Delete data')
    );
    expect(details).toBeDefined();
    expect(details!.hasAttribute('open')).toBe(false);
    expect(details!.textContent).toContain('Hidden to prevent accidents');

    await React.act(async () => {
      details!.querySelector('summary')!.click();
    });
    expect(details!.hasAttribute('open')).toBe(true);
    expect(details!.textContent).toContain('Delete all transactions');
  });

  it('deletes all transactions only after confirmation', async () => {
    useTransactionStore.setState({
      transactions: [
        {
          id: 't1',
          date: '2024-01-01',
          description: 'Coffee',
          amount: -4,
          category: 'Waste',
          confidence: 1,
        } as never,
      ],
      error: null,
    });
    await render();

    const details = Array.from(container.querySelectorAll('details')).find((d) =>
      d.textContent?.includes('Delete data')
    )!;
    await React.act(async () => {
      details.querySelector('summary')!.click();
    });

    const deleteBtn = Array.from(details.querySelectorAll('button')).find((b) =>
      b.textContent?.includes('Delete all transactions')
    )!;
    await React.act(async () => {
      deleteBtn.click();
    });
    // Nothing deleted until the dialog is confirmed.
    expect(useTransactionStore.getState().transactions).toHaveLength(1);
    expect(document.body.textContent).toContain('Delete all transactions?');

    const confirm = Array.from(document.querySelectorAll('button')).find(
      (b) => b.textContent?.trim() === 'Delete'
    )!;
    await React.act(async () => {
      confirm.click();
    });
    expect(useTransactionStore.getState().transactions).toHaveLength(0);
  });

  it('clears learned rules after confirmation and closes the dialog', async () => {
    window.localStorage.setItem(
      'financePatterns',
      JSON.stringify([
        {
          keyword: 'COFFEE',
          category: 'Waste',
          confidence: 0.8,
          learnedFrom: 'Coffee shop',
          correctedAt: '2026-01-01T00:00:00.000Z',
          timesApplied: 1,
        },
      ])
    );
    await render();

    const details = Array.from(container.querySelectorAll('details')).find((d) =>
      d.textContent?.includes('Delete data')
    )!;
    await React.act(async () => {
      details.querySelector('summary')!.click();
    });

    const clearButton = Array.from(details.querySelectorAll('button')).find(
      (button) => button.textContent?.trim() === 'Clear learned rules'
    )!;
    await React.act(async () => {
      clearButton.click();
    });
    expect(window.localStorage.getItem('financePatterns')).not.toBeNull();
    expect(document.body.textContent).toContain('Clear learned rules?');

    const confirm = Array.from(document.querySelectorAll('button')).find(
      (button) => button.textContent?.trim() === 'Clear rules'
    )!;
    await React.act(async () => {
      confirm.click();
    });

    expect(window.localStorage.getItem('financePatterns')).toBeNull();
    expect(document.body.textContent).not.toContain('Clear learned rules?');
  });

  it('shows TypeSafe Jev as the categorization engine when a key is set', async () => {
    useSettingsStore.getState().setTypesafeConfig({ apiKey: 'ts-k' });
    await render();
    expect(container.textContent).toContain('TypeSafe Jev');
  });

  it('shows the language-model fallback row when only an LLM is configured', async () => {
    useSettingsStore.getState().setGeminiConfig({ apiKey: 'g-key' });
    await render();
    expect(container.textContent).toContain('Language model fallback');
    expect(container.textContent).toContain('Gemini');
  });

  it('shows "Not set up" rows when nothing is configured', async () => {
    await render();
    expect(container.textContent).toContain('Not set up — you can still categorize manually.');
  });
});
