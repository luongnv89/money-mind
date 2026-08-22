import { beforeEach, describe, expect, it, vi } from 'vitest';

import {
  MODEL_CATALOG_TTL_MS,
  clearModelCatalogCache,
  fetchGeminiModels,
  fetchGroqModels,
  fetchOllamaModels,
  loadModelCatalog,
} from './modelCatalog';
import { useSettingsStore } from '../stores/useSettingsStore';
import { FALLBACK_MODEL_CATALOG } from '../constants';

const fetchMock = vi.fn();

const jsonResponse = (body: unknown, ok = true, status = 200) => ({
  ok,
  status,
  json: async () => body,
});

const resetSettings = (overrides: Record<string, unknown> = {}) => {
  useSettingsStore.setState({
    aiMode: 'cloud',
    geminiConfig: { apiKey: '', model: 'models/gemini-flash-latest' },
    groqConfig: { apiKey: '', model: 'llama-3.1-8b-instant' },
    ollamaConfig: { baseUrl: 'http://localhost', port: '11434', model: 'llama3.2' },
    ...overrides,
  });
};

const geminiBody = (models: unknown[]) => ({ models });
const groqBody = (data: unknown[]) => ({ data });
const ollamaBody = (names: string[]) => ({ models: names.map((name) => ({ name })) });

beforeEach(() => {
  vi.stubGlobal('fetch', fetchMock);
  fetchMock.mockReset();
  window.localStorage.clear();
  clearModelCatalogCache();
  resetSettings();
});

describe('fetchGeminiModels — payload shape and filtering', () => {
  it('keeps only models that support generateContent', async () => {
    fetchMock.mockResolvedValue(
      jsonResponse(
        geminiBody([
          {
            name: 'models/gemini-flash-latest',
            displayName: 'Gemini Flash latest',
            supportedGenerationMethods: ['generateContent', 'countTokens'],
          },
          {
            name: 'models/text-embedding-004',
            displayName: 'Text Embedding',
            supportedGenerationMethods: ['embedContent'],
          },
          { name: 'models/no-methods-listed', displayName: 'Mystery Model' },
        ])
      )
    );

    const models = await fetchGeminiModels('k');
    expect(models).toEqual([{ id: 'models/gemini-flash-latest', label: 'Gemini Flash latest' }]);
  });

  it('falls back to the raw name as label and sorts/dedupes', async () => {
    fetchMock.mockResolvedValue(
      jsonResponse(
        geminiBody([
          { name: 'models/b-model', supportedGenerationMethods: ['generateContent'] },
          { name: 'models/a-model', supportedGenerationMethods: ['generateContent'] },
          { name: 'models/a-model', supportedGenerationMethods: ['generateContent'] },
        ])
      )
    );

    const models = await fetchGeminiModels('k');
    expect(models.map((m) => m.id)).toEqual(['models/a-model', 'models/b-model']);
  });

  it('throws with the status on a non-OK response', async () => {
    fetchMock.mockResolvedValue(jsonResponse({}, false, 403));
    await expect(fetchGeminiModels('bad-key')).rejects.toThrow('Gemini returned 403');
  });
});

describe('fetchGroqModels — payload shape and filtering', () => {
  it('authenticates with the bearer token and keeps only active models', async () => {
    fetchMock.mockResolvedValue(
      jsonResponse(
        groqBody([
          { id: 'llama-3.1-8b-instant', active: true },
          { id: 'retired-model', active: false },
          { id: 'no-active-flag' },
        ])
      )
    );

    const models = await fetchGroqModels('gsk_k');
    expect(models).toEqual([{ id: 'llama-3.1-8b-instant', label: 'llama-3.1-8b-instant' }]);
    expect(fetchMock.mock.calls[0][0]).toBe('https://api.groq.com/openai/v1/models');
    expect(fetchMock.mock.calls[0][1].headers.Authorization).toBe('Bearer gsk_k');
  });

  it('throws with the status on a non-OK response', async () => {
    fetchMock.mockResolvedValue(jsonResponse({}, false, 401));
    await expect(fetchGroqModels('bad')).rejects.toThrow('Groq returned 401');
  });
});

describe('fetchOllamaModels — payload shape and URL building', () => {
  it('hits /api/tags, prepending the protocol when missing', async () => {
    fetchMock.mockResolvedValue(jsonResponse(ollamaBody(['llama3.2:latest', 'mistral'])));

    const models = await fetchOllamaModels('localhost', '11434');
    expect(fetchMock.mock.calls[0][0]).toBe('http://localhost:11434/api/tags');
    expect(models.map((m) => m.id)).toEqual(['llama3.2:latest', 'mistral']);
  });

  it('throws with the status on a non-OK response', async () => {
    fetchMock.mockResolvedValue(jsonResponse({}, false, 500));
    await expect(fetchOllamaModels('localhost', '11434')).rejects.toThrow('Ollama returned 500');
  });
});

describe('loadModelCatalog — gemini', () => {
  const geminiKey = { geminiConfig: { apiKey: btoa('k'), model: 'models/gemini-flash-latest' } };
  const liveList = () =>
    jsonResponse(
      geminiBody([
        {
          name: 'models/gemini-flash-latest',
          displayName: 'Gemini Flash latest',
          supportedGenerationMethods: ['generateContent'],
        },
        {
          name: 'models/gemini-flash-lite-latest',
          displayName: 'Gemini Flash Lite latest',
          supportedGenerationMethods: ['generateContent'],
        },
      ])
    );

  it('returns the live list and caches it for the TTL window', async () => {
    resetSettings(geminiKey);
    fetchMock.mockResolvedValue(liveList());

    const first = await loadModelCatalog('cloud');
    expect(first.status).toBe('live');
    expect(first.models.map((m) => m.id)).toEqual([
      'models/gemini-flash-latest',
      'models/gemini-flash-lite-latest',
    ]);

    const second = await loadModelCatalog('cloud');
    expect(second.status).toBe('cached');
    expect(second.models).toEqual(first.models);
    expect(fetchMock).toHaveBeenCalledTimes(1);
  });

  it('re-fetches once the cached entry is older than the TTL', async () => {
    resetSettings(geminiKey);
    window.localStorage.setItem(
      'moneymind-model-catalog',
      JSON.stringify({
        cloud: {
          models: [{ id: 'models/stale', label: 'Stale' }],
          fetchedAt: Date.now() - MODEL_CATALOG_TTL_MS - 1000,
        },
      })
    );
    fetchMock.mockResolvedValue(liveList());

    const result = await loadModelCatalog('cloud');
    expect(result.status).toBe('live');
    expect(fetchMock).toHaveBeenCalledTimes(1);
  });

  it('degrades to the curated fallback when the fetch rejects', async () => {
    resetSettings(geminiKey);
    fetchMock.mockRejectedValue(new Error('Failed to fetch'));

    const result = await loadModelCatalog('cloud');
    expect(result.status).toBe('fallback');
    expect(result.models).toBe(FALLBACK_MODEL_CATALOG.cloud);
    expect(result.notice).toMatch(/Could not load the live model list/);
  });

  it('degrades when the provider lists no usable models', async () => {
    resetSettings(geminiKey);
    fetchMock.mockResolvedValue(
      jsonResponse(
        geminiBody([
          { name: 'models/text-embedding-004', supportedGenerationMethods: ['embedContent'] },
        ])
      )
    );

    const result = await loadModelCatalog('cloud');
    expect(result.status).toBe('fallback');
    expect(result.models).toBe(FALLBACK_MODEL_CATALOG.cloud);
  });

  it('skips the fetch entirely when no API key is saved', async () => {
    const result = await loadModelCatalog('cloud');
    expect(fetchMock).not.toHaveBeenCalled();
    expect(result.status).toBe('fallback');
    expect(result.notice).toMatch(/No API key saved yet/);
  });
});

describe('loadModelCatalog — groq', () => {
  it('loads the live list with the saved key', async () => {
    resetSettings({
      aiMode: 'groq',
      groqConfig: { apiKey: btoa('gsk_k'), model: 'llama-3.1-8b-instant' },
    });
    fetchMock.mockResolvedValue(
      jsonResponse(groqBody([{ id: 'llama-3.1-8b-instant', active: true }]))
    );

    const result = await loadModelCatalog('groq');
    expect(result.status).toBe('live');
    expect(result.models[0].id).toBe('llama-3.1-8b-instant');
  });

  it('falls back with a notice on an auth failure', async () => {
    resetSettings({
      aiMode: 'groq',
      groqConfig: { apiKey: btoa('bad'), model: 'llama-3.1-8b-instant' },
    });
    fetchMock.mockResolvedValue(jsonResponse({}, false, 401));

    const result = await loadModelCatalog('groq');
    expect(result.status).toBe('fallback');
    expect(result.models).toBe(FALLBACK_MODEL_CATALOG.groq);
    expect(result.notice).toMatch(/Groq returned 401/);
  });
});

describe('loadModelCatalog — ollama', () => {
  it('loads the local tag list without needing any API key', async () => {
    resetSettings({ aiMode: 'local' });
    fetchMock.mockResolvedValue(jsonResponse(ollamaBody(['llama3.2', 'mistral'])));

    const result = await loadModelCatalog('local');
    expect(result.status).toBe('live');
    expect(result.models.map((m) => m.id)).toEqual(['llama3.2', 'mistral']);
  });

  it('caches per host: a different baseUrl misses the cache', async () => {
    resetSettings({ aiMode: 'local' });
    fetchMock.mockResolvedValue(jsonResponse(ollamaBody(['llama3.2'])));

    await loadModelCatalog('local');
    useSettingsStore.getState().setOllamaConfig({ baseUrl: '127.0.0.1', port: '11434' });
    await loadModelCatalog('local');

    expect(fetchMock).toHaveBeenCalledTimes(2);
    expect(fetchMock.mock.calls[1][0]).toBe('http://127.0.0.1:11434/api/tags');
  });

  it('falls back when the local server is unreachable', async () => {
    resetSettings({ aiMode: 'local' });
    fetchMock.mockRejectedValue(new Error('Failed to fetch'));

    const result = await loadModelCatalog('local');
    expect(result.status).toBe('fallback');
    expect(result.models).toBe(FALLBACK_MODEL_CATALOG.local);
  });
});

describe('loadModelCatalog — cache resilience', () => {
  it('ignores corrupt cache JSON and refetches', async () => {
    window.localStorage.setItem('moneymind-model-catalog', '{not json');
    resetSettings({ geminiConfig: { apiKey: btoa('k'), model: 'models/gemini-flash-latest' } });
    fetchMock.mockResolvedValue(
      jsonResponse(
        geminiBody([
          { name: 'models/gemini-flash-latest', supportedGenerationMethods: ['generateContent'] },
        ])
      )
    );

    const result = await loadModelCatalog('cloud');
    expect(result.status).toBe('live');
    expect(result.models[0].id).toBe('models/gemini-flash-latest');
  });
});
