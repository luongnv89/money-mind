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
