import { beforeEach, describe, expect, it } from 'vitest';
import { DEFAULT_MODELS } from '../constants';
import {
  getDeobfuscatedProviderKey,
  getTypesafeApiKey,
  selectAIReady,
  selectCategorizationReady,
  useSettingsStore,
  validatePersistedModel,
} from './useSettingsStore';

describe('useSettingsStore — currency and spending alerts (Phase A6)', () => {
  beforeEach(() => {
    window.localStorage.clear();
    useSettingsStore.getState().resetSettings();
  });

  it('defaults to USD with spending alerts enabled', () => {
    const state = useSettingsStore.getState();
    expect(state.currency).toBe('USD');
    expect(state.enableSpendingAlerts).toBe(true);
  });

  it('setCurrency stores the new display currency', () => {
    useSettingsStore.getState().setCurrency('EUR');
    expect(useSettingsStore.getState().currency).toBe('EUR');
  });

  it('toggleSpendingAlerts flips the flag', () => {
    useSettingsStore.getState().toggleSpendingAlerts();
    expect(useSettingsStore.getState().enableSpendingAlerts).toBe(false);
    useSettingsStore.getState().toggleSpendingAlerts();
    expect(useSettingsStore.getState().enableSpendingAlerts).toBe(true);
  });

  it('resetSettings restores the currency and alert defaults', () => {
    useSettingsStore.getState().setCurrency('JPY');
    useSettingsStore.getState().toggleSpendingAlerts();
    useSettingsStore.getState().resetSettings();

    const state = useSettingsStore.getState();
    expect(state.currency).toBe('USD');
    expect(state.enableSpendingAlerts).toBe(true);
  });
});

describe('persist migration v0 → v1 (Phase A6)', () => {
  beforeEach(() => {
    window.localStorage.clear();
    useSettingsStore.getState().resetSettings();
  });

  it('drops usage, maps enableFunnyAlerts and defaults currency', async () => {
    window.localStorage.setItem(
      'moneymind-settings',
      JSON.stringify({
        version: 0,
        state: {
          aiMode: 'cloud',
          enableFunnyAlerts: false,
          usage: { txAnalyzed: 140, chatMessages: 9, lastReset: '' },
        },
      })
    );

    await useSettingsStore.persist.rehydrate();
    const state = useSettingsStore.getState() as unknown as Record<string, unknown>;

    expect(state.usage).toBeUndefined();
    expect(state.enableFunnyAlerts).toBeUndefined();
    expect(state.enableSpendingAlerts).toBe(false);
    expect(state.currency).toBe('USD');
  });

  it('defaults spending alerts on when the old flag is absent', async () => {
    window.localStorage.setItem(
      'moneymind-settings',
      JSON.stringify({
        version: 0,
        state: { aiMode: 'cloud' },
      })
    );

    await useSettingsStore.persist.rehydrate();
    const state = useSettingsStore.getState();

    expect(state.enableSpendingAlerts).toBe(true);
    expect(state.currency).toBe('USD');
  });
});

describe('selectAIReady — the single AI readiness definition (issue #41, F-UX-007)', () => {
  beforeEach(() => {
    window.localStorage.clear();
    useSettingsStore.getState().resetSettings();
  });

  it('is always ready in local (Ollama) mode', () => {
    useSettingsStore.getState().setAiMode('local');
    expect(selectAIReady(useSettingsStore.getState())).toBe(true);
  });

  it('needs a stored Gemini key in cloud mode', () => {
    useSettingsStore.getState().setAiMode('cloud');
    expect(selectAIReady(useSettingsStore.getState())).toBe(false);

    useSettingsStore.getState().setGeminiConfig({ apiKey: btoa('gemini-key') });
    expect(selectAIReady(useSettingsStore.getState())).toBe(true);
  });

  it('needs a stored Groq key in groq mode', () => {
    useSettingsStore.getState().setAiMode('groq');
    expect(selectAIReady(useSettingsStore.getState())).toBe(false);

    useSettingsStore.getState().setGroqConfig({ apiKey: btoa('gsk-key') });
    expect(selectAIReady(useSettingsStore.getState())).toBe(true);
  });
});

describe('default models — single source of truth (issue #79)', () => {
  beforeEach(() => {
    window.localStorage.clear();
    useSettingsStore.getState().resetSettings();
  });

  it('uses the catalog defaults for initial state', () => {
    const state = useSettingsStore.getState();
    expect(state.geminiConfig.model).toBe(DEFAULT_MODELS.cloud);
    expect(state.groqConfig.model).toBe(DEFAULT_MODELS.groq);
    expect(state.ollamaConfig.model).toBe(DEFAULT_MODELS.local);
  });

  it('restores the catalog defaults after resetSettings', () => {
    useSettingsStore.getState().setGeminiConfig({ model: 'models/retired' });
    useSettingsStore.getState().setGroqConfig({ model: 'retired-groq' });
    useSettingsStore.getState().resetSettings();

    const state = useSettingsStore.getState();
    expect(state.geminiConfig.model).toBe(DEFAULT_MODELS.cloud);
    expect(state.groqConfig.model).toBe(DEFAULT_MODELS.groq);
  });
});

describe('validatePersistedModel — stale-selection reset (issue #79, AC5)', () => {
  beforeEach(() => {
    window.localStorage.clear();
    useSettingsStore.getState().resetSettings();
  });

  it('is a no-op when the saved model is still listed', () => {
    useSettingsStore.getState().setGeminiConfig({ model: 'models/gemini-flash-lite-latest' });
    const outcome = validatePersistedModel('cloud', [
      'models/gemini-flash-latest',
      'models/gemini-flash-lite-latest',
    ]);

    expect(outcome.reset).toBe(false);
    expect(useSettingsStore.getState().geminiConfig.model).toBe('models/gemini-flash-lite-latest');
  });

  it('resets a retired cloud model to the provider default', () => {
    useSettingsStore.getState().setGeminiConfig({ model: 'models/gemini-1.0-ultra' });
    const outcome = validatePersistedModel('cloud', [
      'models/gemini-flash-latest',
      'models/gemini-flash-lite-latest',
    ]);

    expect(outcome).toEqual({
      reset: true,
      from: 'models/gemini-1.0-ultra',
      to: DEFAULT_MODELS.cloud,
    });
    expect(useSettingsStore.getState().geminiConfig.model).toBe(DEFAULT_MODELS.cloud);
  });

  it('picks the first available model when even the default is gone', () => {
    useSettingsStore.getState().setGeminiConfig({ model: 'models/gemini-1.0-ultra' });
    const outcome = validatePersistedModel('cloud', ['models/brand-new-a', 'models/brand-new-b']);

    expect(outcome.to).toBe('models/brand-new-a');
    expect(useSettingsStore.getState().geminiConfig.model).toBe('models/brand-new-a');
  });

  it('resets a retired groq model to the groq default', () => {
    useSettingsStore.getState().setGroqConfig({ model: 'retired-groq-model' });
    const outcome = validatePersistedModel('groq', ['llama-3.1-8b-instant', 'openai/gpt-oss-20b']);

    expect(outcome).toEqual({
      reset: true,
      from: 'retired-groq-model',
      to: DEFAULT_MODELS.groq,
    });
    expect(useSettingsStore.getState().groqConfig.model).toBe(DEFAULT_MODELS.groq);
  });

  it('never resets when the catalog is empty or unverifiable', () => {
    useSettingsStore.getState().setGroqConfig({ model: 'custom-choice' });
    const outcome = validatePersistedModel('groq', []);

    expect(outcome.reset).toBe(false);
    expect(useSettingsStore.getState().groqConfig.model).toBe('custom-choice');
  });

  it('never touches the ollama config (free-text model names)', () => {
    useSettingsStore.getState().setOllamaConfig({ model: 'my-own-finetune' });
    validatePersistedModel('cloud', ['models/gemini-flash-latest']);

    expect(useSettingsStore.getState().ollamaConfig.model).toBe('my-own-finetune');
  });
});

describe('custom OpenAI-compatible endpoint config (issue #82)', () => {
  beforeEach(() => {
    window.localStorage.clear();
    useSettingsStore.getState().resetSettings();
  });

  it('round-trips the API key through obfuscation, never plaintext', () => {
    useSettingsStore.getState().setCustomConfig({
      baseUrl: 'http://localhost:1234/v1',
      apiKey: 'sk-custom-secret',
      model: 'my-model',
    });

    const state = useSettingsStore.getState();
    expect(state.customConfig.baseUrl).toBe('http://localhost:1234/v1');
    expect(state.customConfig.model).toBe('my-model');
    expect(state.customConfig.apiKey).not.toBe('sk-custom-secret');
    expect(atob(state.customConfig.apiKey)).toBe('sk-custom-secret');
    expect(getDeobfuscatedProviderKey(state, 'custom')).toBe('sk-custom-secret');
  });

  it('merges partial updates without clobbering other fields', () => {
    useSettingsStore.getState().setCustomConfig({ baseUrl: 'https://api.x.dev/v1' });
    expect(useSettingsStore.getState().customConfig.model).toBe(DEFAULT_MODELS.custom);
  });

  it('persists across a simulated reload', () => {
    useSettingsStore.getState().setAiMode('custom');
    useSettingsStore.getState().setCustomConfig({
      baseUrl: 'https://api.x.dev/v1',
      apiKey: 'sk-persisted',
      model: 'm1',
    });

    const persisted = JSON.parse(window.localStorage.getItem('moneymind-settings')!);
    expect(persisted.state.aiMode).toBe('custom');
    expect(persisted.state.customConfig.baseUrl).toBe('https://api.x.dev/v1');
    expect(persisted.state.customConfig.model).toBe('m1');
    // The key is stored obfuscated in localStorage
    expect(atob(persisted.state.customConfig.apiKey)).toBe('sk-persisted');
  });

  it('restores defaults on resetSettings', () => {
    useSettingsStore.getState().setCustomConfig({
      baseUrl: 'https://api.x.dev/v1',
      apiKey: 'sk-x',
      model: 'gone',
    });
    useSettingsStore.getState().resetSettings();

    const state = useSettingsStore.getState();
    expect(state.customConfig).toEqual({
      baseUrl: '',
      apiKey: '',
      model: DEFAULT_MODELS.custom,
    });
  });

  it('accepts a custom endpoint key without a usage cap', () => {
    useSettingsStore.getState().setAiMode('custom');
    useSettingsStore.getState().setCustomConfig({ apiKey: 'sk-any' });

    const state = useSettingsStore.getState() as unknown as Record<string, unknown>;
    expect(state.usage).toBeUndefined();
    expect(getDeobfuscatedProviderKey(useSettingsStore.getState(), 'custom')).toBe('sk-any');
  });
});

describe('selectAIReady — custom endpoint gating (issue #82)', () => {
  beforeEach(() => {
    window.localStorage.clear();
    useSettingsStore.getState().resetSettings();
  });

  const configure = (overrides = {}) =>
    useSettingsStore.getState().setCustomConfig({
      baseUrl: 'https://api.x.dev/v1',
      apiKey: btoa('sk-k'),
      model: 'm',
      ...overrides,
    });

  it('is not ready with an unconfigured endpoint', () => {
    useSettingsStore.getState().setAiMode('custom');
    expect(selectAIReady(useSettingsStore.getState())).toBe(false);
  });

  it('requires base URL and model together — the API key is optional (issue #82 review F1)', () => {
    useSettingsStore.getState().setAiMode('custom');

    configure({ model: '' });
    expect(selectAIReady(useSettingsStore.getState())).toBe(false);

    configure({ baseUrl: '   ' });
    expect(selectAIReady(useSettingsStore.getState())).toBe(false);

    configure();
    expect(selectAIReady(useSettingsStore.getState())).toBe(true);
  });

  it('is ready without an API key when base URL and model are set', () => {
    useSettingsStore.getState().setAiMode('custom');
    configure({ apiKey: '' });
    expect(selectAIReady(useSettingsStore.getState())).toBe(true);
  });

  it('leaves built-in provider readiness untouched', () => {
    useSettingsStore.getState().setAiMode('cloud');
    expect(selectAIReady(useSettingsStore.getState())).toBe(false);
    useSettingsStore.getState().setGeminiConfig({ apiKey: btoa('g') });
    expect(selectAIReady(useSettingsStore.getState())).toBe(true);
  });
});

describe('TypeSafe config', () => {
  beforeEach(() => {
    window.localStorage.clear();
    useSettingsStore.getState().resetSettings();
  });

  it('round-trips the key through obfuscation and clears it on reset', () => {
    useSettingsStore.getState().setTypesafeConfig({ apiKey: 'ts-secret' });

    const state = useSettingsStore.getState();
    expect(state.typesafeConfig.apiKey).not.toBe('ts-secret');
    expect(atob(state.typesafeConfig.apiKey)).toBe('ts-secret');
    expect(getTypesafeApiKey(state)).toBe('ts-secret');

    useSettingsStore.getState().resetSettings();
    expect(getTypesafeApiKey(useSettingsStore.getState())).toBe('');
  });

  it('makes categorization ready without touching assistant readiness', () => {
    useSettingsStore.getState().setAiMode('cloud');
    useSettingsStore.getState().setTypesafeConfig({ apiKey: 'ts-secret' });

    expect(selectCategorizationReady(useSettingsStore.getState())).toBe(true);
    expect(selectAIReady(useSettingsStore.getState())).toBe(false);
  });

  it('is categorization-ready but not chat-ready with only a TypeSafe key', () => {
    useSettingsStore.getState().setAiMode('cloud');
    expect(selectCategorizationReady(useSettingsStore.getState())).toBe(false);

    useSettingsStore.getState().setTypesafeConfig({ apiKey: 'ts-secret' });
    expect(selectCategorizationReady(useSettingsStore.getState())).toBe(true);
    expect(selectAIReady(useSettingsStore.getState())).toBe(false);
  });
});
