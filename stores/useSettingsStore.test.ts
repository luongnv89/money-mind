import { beforeEach, describe, expect, it } from 'vitest';
import { selectAIReady, useSettingsStore } from './useSettingsStore';

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
