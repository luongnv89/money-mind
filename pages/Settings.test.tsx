import React from 'react';
import { createRoot } from 'react-dom/client';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { SettingsPage } from './Settings';
import { useSettingsStore } from '../stores/useSettingsStore';
import { loadModelCatalog } from '../services/modelCatalog';
import { ModelInfo } from '../types';

vi.mock('../services/modelCatalog', () => ({
  loadModelCatalog: vi.fn(),
}));

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

    const liveRegion = container.querySelector('div[role="status"]');
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

    const liveRegion = container.querySelector('div[role="status"]');
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
