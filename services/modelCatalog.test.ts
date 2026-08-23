import { beforeEach, describe, expect, it, vi } from 'vitest';

import {
  MODEL_CATALOG_TTL_MS,
  clearModelCatalogCache,
  fetchGeminiModels,
  fetchGroqModels,
  fetchOllamaModels,
  fetchCustomModels,
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
    customConfig: { baseUrl: '', apiKey: '', model: 'gpt-3.5-turbo' },
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

describe('fetchCustomModels — OpenAI-compatible /models (issue #82)', () => {
  it('hits {baseUrl}/models with a normalized URL and bearer key', async () => {
    fetchMock.mockResolvedValue(
      jsonResponse({ data: [{ id: 'm2' }, { id: 'm1' }, { id: 'm1' }, { id: '' }] })
    );

    const models = await fetchCustomModels('https://api.example.com/v1/', 'sk-k');
    expect(fetchMock.mock.calls[0][0]).toBe('https://api.example.com/v1/models');
    expect(fetchMock.mock.calls[0][1].headers.Authorization).toBe('Bearer sk-k');
    expect(models).toEqual([
      { id: 'm1', label: 'm1' },
      { id: 'm2', label: 'm2' },
    ]);
  });

  it('omits the Authorization header when no key is saved', async () => {
    fetchMock.mockResolvedValue(jsonResponse({ data: [{ id: 'local-model' }] }));

    await fetchCustomModels('http://localhost:1234/v1', '');
    expect(fetchMock.mock.calls[0][1].headers.Authorization).toBeUndefined();
  });

  it('throws with the status on a non-OK response', async () => {
    fetchMock.mockResolvedValue(jsonResponse({}, false, 404));
    await expect(fetchCustomModels('http://localhost:1234/v1', '')).rejects.toThrow(
      'The endpoint returned 404'
    );
  });
});

describe('loadModelCatalog — custom endpoint (issue #82)', () => {
  const customKey = {
    customConfig: { baseUrl: 'https://api.example.com/v1', apiKey: btoa('sk-k'), model: 'm' },
  };

  it('loads the live list and caches per base URL', async () => {
    resetSettings(customKey);
    fetchMock.mockResolvedValue(jsonResponse({ data: [{ id: 'a' }, { id: 'b' }] }));

    const first = await loadModelCatalog('custom');
    expect(first.status).toBe('live');
    expect(first.models.map((m) => m.id)).toEqual(['a', 'b']);

    const second = await loadModelCatalog('custom');
    expect(second.status).toBe('cached');
    expect(fetchMock).toHaveBeenCalledTimes(1);

    // A different base URL is a different server — cache miss
    useSettingsStore.getState().setCustomConfig({ baseUrl: 'https://other.example.com/v1' });
    await loadModelCatalog('custom');
    expect(fetchMock).toHaveBeenCalledTimes(2);
    expect(fetchMock.mock.calls[1][0]).toBe('https://other.example.com/v1/models');
  });

  it('falls back when no Base URL is saved yet', async () => {
    const result = await loadModelCatalog('custom');
    expect(fetchMock).not.toHaveBeenCalled();
    expect(result.status).toBe('fallback');
    expect(result.models).toBe(FALLBACK_MODEL_CATALOG.custom);
    expect(result.notice).toMatch(/No Base URL saved yet/);
  });

  it('falls back with a notice when the endpoint is unreachable', async () => {
    resetSettings(customKey);
    fetchMock.mockRejectedValue(new Error('Failed to fetch'));

    const result = await loadModelCatalog('custom');
    expect(result.status).toBe('fallback');
    expect(result.models).toBe(FALLBACK_MODEL_CATALOG.custom);
    expect(result.notice).toMatch(/Could not load the live model list/);
  });

  it('falls back when the endpoint lists no usable models', async () => {
    resetSettings(customKey);
    fetchMock.mockResolvedValue(jsonResponse({ data: [] }));

    const result = await loadModelCatalog('custom');
    expect(result.status).toBe('fallback');
    expect(result.models).toBe(FALLBACK_MODEL_CATALOG.custom);
  });
});
