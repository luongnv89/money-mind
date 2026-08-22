import { AIMode, ModelCatalog, ModelInfo } from '../types';
import { FALLBACK_MODEL_CATALOG } from '../constants';
import { logger } from '../lib/logger';
import { getDeobfuscatedProviderKey, useSettingsStore } from '../stores/useSettingsStore';

/**
 * Issue #79: the Settings model pickers render each provider's real model
 * list instead of a hardcoded one. Live lists are fetched once per provider
 * (per Ollama host) and cached in localStorage for `MODEL_CATALOG_TTL_MS`;
 * any failure degrades to the curated fallback in `FALLBACK_MODEL_CATALOG`
 * with a visible notice instead of failing silently.
 */
export const MODEL_CATALOG_TTL_MS = 60 * 60 * 1000; // one hour

const CACHE_KEY = 'moneymind-model-catalog';

interface CachedCatalogEntry {
  models: ModelInfo[];
  fetchedAt: number;
}

type ModelCatalogCache = Record<string, CachedCatalogEntry>;

// --- raw provider payload shapes (only the fields we consume) ---

interface GeminiListModel {
  name: string;
  displayName?: string;
  supportedGenerationMethods?: string[];
}

interface GeminiListResponse {
  models?: GeminiListModel[];
}

interface GroqListModel {
  id: string;
  active?: boolean;
}

interface GroqListResponse {
  data?: GroqListModel[];
}

interface OllamaTagsResponse {
  models?: { name: string }[];
}

const sortModels = (models: ModelInfo[]): ModelInfo[] => {
  const seen = new Set<string>();
  return models
    .filter((m) => {
      if (!m.id || seen.has(m.id)) return false;
      seen.add(m.id);
      return true;
    })
    .sort((a, b) => a.label.localeCompare(b.label) || a.id.localeCompare(b.id));
};

// --- localStorage cache (follows lib/localStorage.ts conventions) ---

const readCache = (): ModelCatalogCache => {
  try {
    const stored = localStorage.getItem(CACHE_KEY);
    if (!stored) return {};
    const parsed = JSON.parse(stored);
    return parsed && typeof parsed === 'object' ? (parsed as ModelCatalogCache) : {};
  } catch {
    logger.warn('Corrupt model catalog cache, ignoring it.');
    return {};
  }
};

const writeCacheEntry = (key: string, models: ModelInfo[]): void => {
  try {
    const cache = readCache();
    cache[key] = { models, fetchedAt: Date.now() };
    localStorage.setItem(CACHE_KEY, JSON.stringify(cache));
  } catch (e: unknown) {
    logger.warn('Could not persist model catalog cache', e);
  }
};

/** Drop every cached model list (test/maintenance hook). */
export const clearModelCatalogCache = (): void => {
  try {
    localStorage.removeItem(CACHE_KEY);
  } catch {
    // best-effort: a storage that throws on remove is already unusable
  }
};

// --- per-provider list fetchers ---

/**
 * GET https://generativelanguage.googleapis.com/v1beta/models — keep only
 * entries whose `supportedGenerationMethods` includes `generateContent`
 * (drops embeddings, AQA and other non-chat models).
 */
export const fetchGeminiModels = async (apiKey: string): Promise<ModelInfo[]> => {
  const response = await fetch(
    `https://generativelanguage.googleapis.com/v1beta/models?pageSize=1000&key=${encodeURIComponent(apiKey)}`
  );
  if (!response.ok) throw new Error(`Gemini returned ${response.status}`);
  const data = (await response.json()) as GeminiListResponse;
  return sortModels(
    (data.models ?? [])
      .filter((m) => (m.supportedGenerationMethods ?? []).includes('generateContent'))
      .map((m) => ({ id: m.name, label: m.displayName || m.name }))
  );
};

/** GET https://api.groq.com/openai/v1/models — keep only models flagged active. */
export const fetchGroqModels = async (apiKey: string): Promise<ModelInfo[]> => {
  const response = await fetch('https://api.groq.com/openai/v1/models', {
    headers: { Authorization: `Bearer ${apiKey}` },
  });
  if (!response.ok) throw new Error(`Groq returned ${response.status}`);
  const data = (await response.json()) as GroqListResponse;
  return sortModels(
    (data.data ?? []).filter((m) => m.active === true).map((m) => ({ id: m.id, label: m.id }))
  );
};

/** GET {baseUrl}:{port}/api/tags — the models the user has pulled locally. */
export const fetchOllamaModels = async (baseUrl: string, port: string): Promise<ModelInfo[]> => {
  const safeBaseUrl = baseUrl.startsWith('http') ? baseUrl : `http://${baseUrl}`;
  const response = await fetch(`${safeBaseUrl}:${port}/api/tags`);
  if (!response.ok) throw new Error(`Ollama returned ${response.status}`);
  const data = (await response.json()) as OllamaTagsResponse;
  return sortModels((data.models ?? []).map((m) => ({ id: m.name, label: m.name })));
};

const fallbackCatalog = (provider: AIMode, reason: string): ModelCatalog => ({
  provider,
  status: 'fallback',
  models: FALLBACK_MODEL_CATALOG[provider],
  notice: `${reason} Showing the built-in model list instead.`,
});

/** Cache key: the provider — plus the host for Ollama, whose list is per-server. */
const cacheKeyFor = (provider: AIMode): string => {
  if (provider !== 'local') return provider;
  const { baseUrl, port } = useSettingsStore.getState().ollamaConfig;
  const safeBaseUrl = baseUrl.startsWith('http') ? baseUrl : `http://${baseUrl}`;
  return `local:${safeBaseUrl}:${port}`;
};

/**
 * Resolve the model catalog for one provider: live fetch cached for an hour,
 * or the curated fallback with a visible notice. Never throws — callers get a
 * usable catalog in every outcome (issue #79, AC4).
 */
export const loadModelCatalog = async (provider: AIMode): Promise<ModelCatalog> => {
  const settings = useSettingsStore.getState();

  if (provider !== 'local' && !getDeobfuscatedProviderKey(settings, provider)) {
    return fallbackCatalog(provider, 'No API key saved yet — the live model list needs one.');
  }

  const cacheKey = cacheKeyFor(provider);
  const cached = readCache()[cacheKey];
  if (cached && Date.now() - cached.fetchedAt < MODEL_CATALOG_TTL_MS) {
    return { provider, status: 'cached', models: cached.models };
  }

  try {
    let models: ModelInfo[];
    if (provider === 'cloud') {
      models = await fetchGeminiModels(getDeobfuscatedProviderKey(settings, provider));
    } else if (provider === 'groq') {
      models = await fetchGroqModels(getDeobfuscatedProviderKey(settings, provider));
    } else {
      const { baseUrl, port } = settings.ollamaConfig;
      models = await fetchOllamaModels(baseUrl, port);
    }
    if (models.length === 0) throw new Error('the provider listed no usable models');
    writeCacheEntry(cacheKey, models);
    return { provider, status: 'live', models };
  } catch (e: unknown) {
    const reason = e instanceof Error ? e.message : String(e);
    logger.warn(`Model catalog load failed for ${provider}`, reason);
    return fallbackCatalog(provider, `Could not load the live model list (${reason}).`);
  }
};
