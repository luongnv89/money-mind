import { beforeEach, describe, expect, it } from 'vitest';
import { DEFAULT_MODELS } from '../constants';
import { selectAIReady, useSettingsStore, validatePersistedModel } from './useSettingsStore';

describe('useSettingsStore usage limits', () => {
  beforeEach(() => {
    window.localStorage.clear();
    useSettingsStore.getState().resetSettings();
  });

  it('enforces the analysis limit when no API key is set', () => {
    const store = useSettingsStore.getState();
    store.incrementUsage('analysis', 149);
    expect(useSettingsStore.getState().checkUsageLimit('analysis', 1)).toBe(true);
    expect(useSettingsStore.getState().checkUsageLimit('analysis', 2)).toBe(false);
  });

  it('enforces the chat message limit when no API key is set', () => {
    const store = useSettingsStore.getState();
    store.incrementUsage('chat', 10);
    expect(useSettingsStore.getState().checkUsageLimit('chat')).toBe(false);
  });

  it('is unlimited in cloud mode once a custom Gemini key is supplied', () => {
    useSettingsStore.getState().setGeminiConfig({ apiKey: 'my-own-key' });
    useSettingsStore.getState().incrementUsage('analysis', 500);
    expect(useSettingsStore.getState().checkUsageLimit('analysis', 10)).toBe(true);
    expect(useSettingsStore.getState().checkUsageLimit('chat', 100)).toBe(true);
  });

  it('is unlimited in groq mode once a Groq key is supplied', () => {
    useSettingsStore.getState().setAiMode('groq');
    useSettingsStore.getState().setGroqConfig({ apiKey: 'gsk_test' });
    useSettingsStore.getState().incrementUsage('chat', 50);
    expect(useSettingsStore.getState().checkUsageLimit('chat')).toBe(true);
  });

  it('is unlimited in local mode regardless of keys', () => {
    useSettingsStore.getState().setAiMode('local');
    useSettingsStore.getState().incrementUsage('chat', 999);
    expect(useSettingsStore.getState().checkUsageLimit('chat')).toBe(true);
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
