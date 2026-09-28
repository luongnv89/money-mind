import { Transaction, AIMode, TransactionCategory, CategorizationResult } from '../types';
import {
  useSettingsStore,
  getDeobfuscatedApiKey,
  getDeobfuscatedProviderKey,
  getTypesafeApiKey,
  selectAIReady,
} from '../stores/useSettingsStore';
import { GoogleGenAI, Type } from '@google/genai';
import { CATEGORY_HIERARCHY } from '../constants';
import { logger } from '../lib/logger';
import { normalizeCustomBaseUrl } from './modelCatalog';
import { categorizeWithTypeSafe } from './typesafeService';
import { groupForCategorization } from './categorizationPlan';
import { normalizeCategorization } from './normalizeCategorization';
import { demoCategoryFor } from '../lib/demoData';

// --- Model availability errors (issue #79) ---

/** Provider error shapes that mean "this model id no longer exists". */
const MODEL_UNAVAILABLE_PATTERN =
  /not found|not_found|does not exist|decommissioned|no longer available|unsupported/i;

const isModelUnavailable = (status: number | undefined, message: string): boolean =>
  status === 404 || MODEL_UNAVAILABLE_PATTERN.test(message);

const modelUnavailableMessage = (provider: string, model: string, detail: string): string =>
  `Model "${model}" is not available on ${provider} (${detail}). ` +
  'It may have been renamed or retired — pick a current model in Settings.';

/**
 * OpenAI-compatible servers return API errors in two shapes: the canonical
 * `{ "error": { "message": "..." } }` and the flat `{ "error": "..." }`.
 * Resolve both so users see the server's actual message, falling back to the
 * caller's generic string only when neither shape is present.
 */
const extractApiDetail = (payload: unknown, fallback: string): string => {
  const error = (payload as { error?: unknown } | null | undefined)?.error;
  if (typeof error === 'string' && error.trim()) return error;
  const message = (error as { message?: unknown } | null | undefined)?.message;
  if (typeof message === 'string' && message.trim()) return message;
  return fallback;
};

const ollamaModelMissingMessage = (model: string): string =>
  `Model "${model}" was not found on the Ollama server. Run \`ollama pull ${model}\` ` +
  'or pick another model in Settings.';

// --- Custom OpenAI-compatible endpoint (issue #82) ---
// normalizeCustomBaseUrl is shared with modelCatalog.ts (single definition).

const customChatUrl = (baseUrl: string): string =>
  `${normalizeCustomBaseUrl(baseUrl)}/chat/completions`;

/**
 * Shared OpenAI chat-completions round-trip for the custom endpoint: same wire
 * shape as the Groq branch, pointed at the user's own server.
 */
const fetchCustomChatCompletion = async (
  settings: ReturnType<typeof useSettingsStore.getState>,
  body: Record<string, unknown>
): Promise<Response> => {
  const apiKey = getDeobfuscatedProviderKey(settings, 'custom');
  // Keyless servers (no-auth LM Studio / vLLM) get no Authorization header,
  // mirroring fetchCustomModels in modelCatalog.ts (issue #82).
  const headers: Record<string, string> = { 'Content-Type': 'application/json' };
  if (apiKey) headers.Authorization = `Bearer ${apiKey}`;
  return fetch(customChatUrl(settings.customConfig.baseUrl), {
    method: 'POST',
    headers,
    body: JSON.stringify(body),
  });
};

// --- Connection Testing ---

export const testAiConnection = async (): Promise<boolean> => {
  const settings = useSettingsStore.getState();
  const mode = settings.aiMode;

  if (mode === 'cloud') {
    const apiKey = getDeobfuscatedApiKey(settings);
    if (!apiKey)
      throw new Error(
        'No API Key set. Configure a Gemini API key in Settings to test the connection.'
      );

    try {
      const ai = new GoogleGenAI({ apiKey });
      const response = await ai.models.generateContent({
        model: settings.geminiConfig.model,
        contents: "Hello, reply with 'OK'.",
      });
      return !!response.text;
    } catch (e: unknown) {
      const errorMessage = e instanceof Error ? e.message : String(e);
      const status = (e as { status?: number }).status;
      if (isModelUnavailable(status, errorMessage)) {
        throw new Error(
          modelUnavailableMessage('Gemini', settings.geminiConfig.model, errorMessage)
        );
      }
      throw new Error(`Gemini Error: ${errorMessage}`);
    }
  } else if (mode === 'groq') {
    const apiKey = getDeobfuscatedApiKey(settings);
    if (!apiKey) throw new Error('Missing Groq API Key');

    try {
      const response = await fetch('https://api.groq.com/openai/v1/chat/completions', {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${apiKey}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          model: settings.groqConfig.model,
          messages: [{ role: 'user', content: 'Reply with JSON: { "status": "OK" }' }],
          response_format: { type: 'json_object' },
        }),
      });

      if (!response.ok) {
        const err = await response.json();
        const detail = extractApiDetail(err, 'Groq connection failed');
        if (isModelUnavailable(response.status, detail)) {
          throw new Error(modelUnavailableMessage('Groq', settings.groqConfig.model, detail));
        }
        throw new Error(detail);
      }
      return true;
    } catch (e: unknown) {
      throw new Error(`Groq Error: ${e instanceof Error ? e.message : String(e)}`);
    }
  } else if (mode === 'custom') {
    const { baseUrl, model } = settings.customConfig;
    // The API key is optional for custom endpoints — servers without auth work keyless.
    if (!baseUrl.trim() || !model.trim()) {
      throw new Error(
        'Missing Custom Endpoint configuration. Set the Base URL and model in Settings.'
      );
    }

    try {
      const response = await fetchCustomChatCompletion(settings, {
        model,
        messages: [{ role: 'user', content: 'Reply with JSON: { "status": "OK" }' }],
        response_format: { type: 'json_object' },
      });

      if (!response.ok) {
        const err = await response.json();
        const detail = extractApiDetail(err, 'Custom endpoint connection failed');
        if (isModelUnavailable(response.status, detail)) {
          throw new Error(modelUnavailableMessage('the custom endpoint', model, detail));
        }
        throw new Error(detail);
      }
      return true;
    } catch (e: unknown) {
      const errorMessage = e instanceof Error ? e.message : String(e);
      if (errorMessage === 'Failed to fetch' || (e instanceof Error && e.name === 'TypeError')) {
        throw new Error(
          'Connection Failed. Check that:\n\n' +
            '1. The Base URL is correct and reachable from your browser.\n' +
            '2. The server allows cross-origin requests (CORS) from this app.'
        );
      }
      throw new Error(`Custom Endpoint Error: ${errorMessage}`);
    }
  } else {
    const { baseUrl, port, model } = settings.ollamaConfig;
    // Ensure protocol is present
    const safeBaseUrl = baseUrl.startsWith('http') ? baseUrl : `http://${baseUrl}`;
    const url = `${safeBaseUrl}:${port}/api/generate`;

    try {
      const response = await fetch(url, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          model: model,
          prompt: 'Reply with OK',
          stream: false,
        }),
      });
      if (!response.ok) {
        if (response.status === 404) throw new Error(ollamaModelMissingMessage(model));
        throw new Error('Ollama connection refused');
      }
      return true;
    } catch (e: unknown) {
      // Specific handling for CORS/Network errors typical with local LLMs in browser
      const errorMessage = e instanceof Error ? e.message : String(e);
      if (errorMessage === 'Failed to fetch' || (e instanceof Error && e.name === 'TypeError')) {
        throw new Error(
          'Connection Failed. \n\n' +
            '1. QUIT the Ollama app from your taskbar/menu bar.\n' +
            '2. Run this command in your terminal:\n\n' +
            '   Mac/Linux:\n   OLLAMA_ORIGINS="*" ollama serve\n\n' +
            '   Windows (PowerShell):\n   $env:OLLAMA_ORIGINS="*"; ollama serve'
        );
      }
      throw new Error(`Local AI Error: ${errorMessage}. Is Ollama running?`);
    }
  }
};

// --- Assistant chat service ---

const buildAssistantSystemPrompt = (
  context: string
): string => `You are MoneyMind's financial assistant: a calm, precise personal-finance analyst.

Answer using only the figures in FINANCIAL CONTEXT below. The app calculated them from the user's categorized transactions with fixed formulas. Quote amounts exactly as written, together with the period they belong to. Never estimate, recompute or invent a figure. If the context doesn't contain what the question needs, say so briefly and suggest where in MoneyMind to look (Overview, Transactions or Settings).

How to answer:
- Start with the direct answer in one or two sentences.
- Then add at most three short bullet points with the supporting figures or concrete next steps tied to the user's own categories, merchants and recurring charges.
- Prefer specific, practical actions over generic tips.
- Plain text only: no headings, tables, bold text or emojis. Start bullets with "- ".
- You are not a licensed financial adviser. For tax, legal or investment-product decisions, add one short sentence recommending a qualified professional.

FINANCIAL CONTEXT
${context}`;

const EMPTY_ANSWER = 'The model returned an empty answer. Try rephrasing your question.';

export const chatWithFinancialAgent = async (
  userQuery: string,
  financialContext: string
): Promise<string> => {
  const settings = useSettingsStore.getState();

  const apiKey = getDeobfuscatedApiKey(settings);
  const systemPrompt = buildAssistantSystemPrompt(financialContext);

  if (settings.aiMode === 'cloud') {
    // Require a valid API key — no server fallback
    if (!apiKey)
      throw new Error(
        'No API Key set. Configure a Gemini API key in Settings to use the Assistant.'
      );
    const ai = new GoogleGenAI({ apiKey });
    const response = await ai.models.generateContent({
      model: settings.geminiConfig.model,
      contents: userQuery,
      config: { systemInstruction: systemPrompt, temperature: 0.2 },
    });
    return response.text || EMPTY_ANSWER;
  }

  if (settings.aiMode === 'groq') {
    if (!apiKey) throw new Error('Missing API Key');
    const response = await fetch('https://api.groq.com/openai/v1/chat/completions', {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${apiKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        model: settings.groqConfig.model,
        messages: [
          { role: 'system', content: systemPrompt },
          { role: 'user', content: userQuery },
        ],
        temperature: 0.2,
      }),
    });

    if (!response.ok) {
      const err = await response.json();
      throw new Error(extractApiDetail(err, 'Groq API Error'));
    }

    const data = await response.json();
    return data.choices?.[0]?.message?.content || EMPTY_ANSWER;
  }

  if (settings.aiMode === 'custom') {
    const { baseUrl, model } = settings.customConfig;
    if (!baseUrl.trim() || !model.trim()) throw new Error('Missing Custom Endpoint configuration');

    const response = await fetchCustomChatCompletion(settings, {
      model,
      messages: [
        { role: 'system', content: systemPrompt },
        { role: 'user', content: userQuery },
      ],
      temperature: 0.2,
    });

    if (!response.ok) {
      const err = await response.json();
      throw new Error(extractApiDetail(err, 'Custom endpoint API Error'));
    }

    const data = await response.json();
    return data.choices?.[0]?.message?.content || EMPTY_ANSWER;
  }

  // Ollama
  const { baseUrl, port, model } = settings.ollamaConfig;
  const safeBaseUrl = baseUrl.startsWith('http') ? baseUrl : `http://${baseUrl}`;
  const url = `${safeBaseUrl}:${port}/api/generate`;

  const response = await fetch(url, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      model: model,
      system: systemPrompt,
      prompt: userQuery,
      stream: false,
      options: { temperature: 0.2 },
    }),
  });

  if (!response.ok) {
    if (response.status === 404) throw new Error(ollamaModelMissingMessage(model));
    throw new Error('Ollama connection failed');
  }

  const data = await response.json();
  return data.response || EMPTY_ANSWER;
};

// --- Main Categorization Service ---

export const categorizeWithAI = async (
  transactions: Transaction[],
  mode: AIMode,
  onChunkProcessed?: (results: CategorizationResult[]) => void
): Promise<void> => {
  const settings = useSettingsStore.getState();

  // We process whatever is passed in. The caller is responsible for filtering (e.g. only Uncategorized, or Unapproved).
  const toProcess = transactions;
  if (toProcess.length === 0) return;

  // Identical transactions are categorized once; each result is fanned out to
  // every member id so progress and updates count real transactions.
  const { representatives, membersByRepId } = groupForCategorization(toProcess);
  const fanOut = (results: CategorizationResult[]) => {
    if (!onChunkProcessed) return;
    const expanded: CategorizationResult[] = [];
    for (const res of results) {
      const members = membersByRepId.get(res.id);
      if (!members) continue; // id we never asked for — ignore
      for (const id of members) expanded.push({ ...res, id });
    }
    if (expanded.length > 0) onChunkProcessed(expanded);
  };

  // Jev first, then the configured language model; demo mode only simulates
  // when no real categorization is set up.
  if (getTypesafeApiKey(settings)) {
    await categorizeWithTypeSafe(representatives, fanOut);
  } else if (selectAIReady(settings)) {
    if (mode === 'cloud') {
      await categorizeWithGemini(representatives, fanOut);
    } else if (mode === 'groq') {
      await categorizeWithGroq(representatives, fanOut);
    } else if (mode === 'custom') {
      await categorizeWithCustom(representatives, fanOut);
    } else {
      await categorizeWithOllama(representatives, fanOut);
    }
  } else if (settings.isDemoMode) {
    await simulateCategorization(representatives, fanOut);
  } else {
    throw new Error(
      'No categorization service is set up. Add a TypeSafe key or a language model in Settings.'
    );
  }
};

const categorizeWithGemini = async (
  transactions: Transaction[],
  onChunkProcessed?: (results: CategorizationResult[]) => void
): Promise<void> => {
  const settings = useSettingsStore.getState();
  const apiKey = getDeobfuscatedApiKey(settings);
  const model = settings.geminiConfig.model;

  if (!apiKey) {
    throw new Error('No API Key set. Configure a Gemini API key in Settings.');
  }

  const ai = new GoogleGenAI({ apiKey });

  // OPTIMIZATION: High batch size, low frequency.
  const BATCH_SIZE = 25;
  const RATE_LIMIT_DELAY_MS = 4000;

  for (let i = 0; i < transactions.length; i += BATCH_SIZE) {
    // F-PERF-002: the rate-limit buffer sits between requests — guarded on
    // `i > 0` so it never fires before the first batch or after the last
    // (a 3-batch run sleeps exactly twice, not three times).
    if (i > 0) {
      await new Promise((r) => setTimeout(r, RATE_LIMIT_DELAY_MS));
    }

    const batch = transactions.slice(i, i + BATCH_SIZE);

    const prompt = `
            You are a financial analyst. Categorize these transactions based on the provided hierarchy.

            Hierarchy:
            ${JSON.stringify(CATEGORY_HIERARCHY)}

            Transactions:
            ${JSON.stringify(batch.map((t) => ({ id: t.id, desc: t.description, amt: t.amount, cat: t.originalCategory })))}

            Instructions:
            1. Select the most appropriate Category and Subcategory.
            2. Use the 'cat' field (original bank category) as a hint if available.
            3. Return a valid JSON array matching the schema.
        `;

    try {
      const response = await ai.models.generateContent({
        model: model,
        contents: prompt,
        config: {
          temperature: 0,
          responseMimeType: 'application/json',
          responseSchema: {
            type: Type.ARRAY,
            items: {
              type: Type.OBJECT,
              properties: {
                id: { type: Type.STRING },
                category: { type: Type.STRING },
                subCategory: { type: Type.STRING },
                confidence: { type: Type.NUMBER },
                reason: { type: Type.STRING },
              },
              required: ['id', 'category', 'confidence', 'reason'],
            },
          },
        },
      });

      const text = response.text;
      if (text) {
        const parsed = JSON.parse(text);
        if (Array.isArray(parsed)) {
          const requestedIds = new Set(batch.map((t) => t.id));
          const results = parsed
            .filter((item) => requestedIds.has((item as { id?: unknown })?.id as string))
            .map((item) => normalizeCategorization(item, 'Gemini AI'));
          if (results.length > 0 && onChunkProcessed) onChunkProcessed(results);
        }
      }
    } catch (e: unknown) {
      logger.error('Gemini Batch Failed', e);
      const errorMessage = e instanceof Error ? e.message : String(e);
      const status = (e as { status?: number }).status;
      if (status === 429 || errorMessage?.includes('429')) {
        throw new Error('Gemini Rate Limit Exceeded (429). Please try again in 1 minute.');
      }
      if (isModelUnavailable(status, errorMessage)) {
        throw new Error(modelUnavailableMessage('Gemini', model, errorMessage));
      }

      // Fallback for failed batch so the UI knows they failed
      const fallbackResults = batch.map((t) => ({
        id: t.id,
        category: TransactionCategory.Uncategorized,
        confidence: 0,
        reason: 'AI Request Failed: ' + errorMessage,
      }));
      if (onChunkProcessed) onChunkProcessed(fallbackResults);
    }
  }
};

/**
 * Shared OpenAI-compatible categorization pipeline used by the Groq branch and
 * the custom-endpoint branch (#82): identical batching, strict-JSON contract,
 * payload wrapping/normalization and per-batch fallbacks. Only the request
 * transport, provider label and user-facing strings differ.
 */
interface OpenAICompatibleCategorizer {
  model: string;
  /** Provider label used in "model not available" messages. */
  label: string;
  post: (body: Record<string, unknown>) => Promise<Response>;
  rateLimitMessage: string;
  apiErrorMessage: string;
  defaultReason: string;
  parseLogLabel: string;
  batchLogLabel: string;
  /** Custom endpoints get CORS guidance for outright network failures. */
  mapNetworkErrorsToCors?: boolean;
}

const categorizeWithOpenAICompatible = async (
  transactions: Transaction[],
  config: OpenAICompatibleCategorizer,
  onChunkProcessed?: (results: CategorizationResult[]) => void
): Promise<void> => {
  const hierarchyStr = JSON.stringify(CATEGORY_HIERARCHY);

  // Batch to reduce network round trips and stay within TPM/RPM.
  const BATCH_SIZE = 10;
  const RATE_LIMIT_DELAY_MS = 2000;

  for (let i = 0; i < transactions.length; i += BATCH_SIZE) {
    // F-PERF-002: rate-limit buffer between requests only — guarded on
    // `i > 0` so it never fires before the first batch or after the last.
    if (i > 0) {
      await new Promise((r) => setTimeout(r, RATE_LIMIT_DELAY_MS));
    }

    const batch = transactions.slice(i, i + BATCH_SIZE);
    const batchStr = JSON.stringify(
      batch.map((t) => ({
        id: t.id,
        desc: t.description,
        amt: t.amount,
        original: t.originalCategory,
      }))
    );

    // Strictly enforce JSON structure in the prompt to avoid "Failed to generate JSON" errors
    const systemPrompt = `
        You are a strict JSON API for financial categorization.

        Hierarchy: ${hierarchyStr}

        Output **only** valid JSON.
        The JSON must be an object with a single key "results" containing an array.
        Each item in the array must match this schema:
        {
            "id": "string (original id)",
            "category": "string (from hierarchy keys)",
            "subCategory": "string (from hierarchy values)",
            "confidence": number (0.0 to 1.0),
            "reason": "string (short explanation)"
        }

        Do not add any markdown formatting (like \`\`\`json). Do not add explanations outside the JSON.
        `;

    try {
      const response = await config.post({
        model: config.model,
        messages: [
          { role: 'system', content: systemPrompt },
          {
            role: 'user',
            content: `Categorize these transactions. Return valid JSON only. Transactions: ${batchStr}`,
          },
        ],
        response_format: { type: 'json_object' },
        temperature: 0, // Deterministic output helps with strict JSON
      });

      if (!response.ok) {
        if (response.status === 429) {
          throw new Error(config.rateLimitMessage);
        }
        const err = await response.json();
        const detail = extractApiDetail(err, config.apiErrorMessage);
        if (isModelUnavailable(response.status, detail)) {
          throw new Error(modelUnavailableMessage(config.label, config.model, detail));
        }
        throw new Error(detail);
      }

      const data = await response.json();
      const content = data.choices?.[0]?.message?.content;

      if (content) {
        let parsed;
        try {
          parsed = JSON.parse(content);

          // Handle wrapping logic
          if (parsed.results && Array.isArray(parsed.results)) {
            parsed = parsed.results;
          } else if (!Array.isArray(parsed)) {
            // Attempt to find the first array value in the object
            const values = Object.values(parsed);
            const arrayValue = values.find((v) => Array.isArray(v));
            if (arrayValue) {
              parsed = arrayValue;
            }
          }
        } catch (_e) {
          logger.error(config.parseLogLabel, content);
        }

        if (Array.isArray(parsed)) {
          // Normalize fields — never trust the model's own confidence/category.
          const requestedIds = new Set(batch.map((t) => t.id));
          const results: CategorizationResult[] = parsed
            .filter((item) => requestedIds.has((item as { id?: unknown })?.id as string))
            .map((item) => normalizeCategorization(item, config.defaultReason));
          if (results.length > 0 && onChunkProcessed) onChunkProcessed(results);
        }
      }
    } catch (e: unknown) {
      logger.error(config.batchLogLabel, e);
      const errorMessage = e instanceof Error ? e.message : String(e);
      if (
        config.mapNetworkErrorsToCors &&
        (errorMessage === 'Failed to fetch' || (e instanceof Error && e.name === 'TypeError'))
      ) {
        throw new Error(
          'Connection Failed. Check that the Base URL is correct and that the server ' +
            'allows cross-origin requests (CORS) from this app.'
        );
      }
      // Propagate rate limits, JSON-contract breaks, and retired-model errors
      if (
        errorMessage.includes('Rate Limit') ||
        errorMessage.includes('JSON') ||
        MODEL_UNAVAILABLE_PATTERN.test(errorMessage)
      ) {
        throw e;
      }

      // Fallback for failed batch
      const fallbackResults = batch.map((t) => ({
        id: t.id,
        category: TransactionCategory.Uncategorized,
        confidence: 0,
        reason: 'AI Request Failed: ' + errorMessage,
      }));
      if (onChunkProcessed) onChunkProcessed(fallbackResults);
    }
  }
};

const categorizeWithGroq = async (
  transactions: Transaction[],
  onChunkProcessed?: (results: CategorizationResult[]) => void
): Promise<void> => {
  const settings = useSettingsStore.getState();
  const apiKey = getDeobfuscatedApiKey(settings);

  await categorizeWithOpenAICompatible(
    transactions,
    {
      model: settings.groqConfig.model,
      label: 'Groq',
      post: (body) =>
        fetch('https://api.groq.com/openai/v1/chat/completions', {
          method: 'POST',
          headers: {
            Authorization: `Bearer ${apiKey}`,
            'Content-Type': 'application/json',
          },
          body: JSON.stringify(body),
        }),
      rateLimitMessage: 'Groq Rate Limit Exceeded. Please check your plan.',
      apiErrorMessage: 'Groq API Error',
      defaultReason: 'Groq AI',
      parseLogLabel: 'Failed to parse Groq JSON',
      batchLogLabel: 'Groq Batch Failed',
    },
    onChunkProcessed
  );
};

const categorizeWithCustom = async (
  transactions: Transaction[],
  onChunkProcessed?: (results: CategorizationResult[]) => void
): Promise<void> => {
  const settings = useSettingsStore.getState();
  const { baseUrl, model } = settings.customConfig;
  if (!baseUrl.trim() || !model.trim()) {
    throw new Error(
      'Missing Custom Endpoint configuration. Set the Base URL and model in Settings.'
    );
  }

  await categorizeWithOpenAICompatible(
    transactions,
    {
      model,
      label: 'the custom endpoint',
      post: (body) => fetchCustomChatCompletion(settings, body),
      rateLimitMessage: 'Custom endpoint Rate Limit Exceeded. Please check your plan.',
      apiErrorMessage: 'Custom endpoint API Error',
      defaultReason: 'Custom endpoint AI',
      parseLogLabel: 'Failed to parse custom endpoint JSON',
      batchLogLabel: 'Custom Endpoint Batch Failed',
      mapNetworkErrorsToCors: true,
    },
    onChunkProcessed
  );
};

const categorizeWithOllama = async (
  transactions: Transaction[],
  onChunkProcessed?: (results: CategorizationResult[]) => void
): Promise<void> => {
  const settings = useSettingsStore.getState();
  const { baseUrl, port, model } = settings.ollamaConfig;
  // Ensure protocol is present
  const safeBaseUrl = baseUrl.startsWith('http') ? baseUrl : `http://${baseUrl}`;
  const url = `${safeBaseUrl}:${port}/api/generate`;

  const hierarchyStr = JSON.stringify(CATEGORY_HIERARCHY);

  const promptBase = `You are a financial assistant. Categorize the transaction into a Category and a Subcategory from this hierarchy:
    ${hierarchyStr}.

    Instructions:
    1. Pick the best Main Category.
    2. Pick the best Subcategory from that Main Category.
    3. Return ONLY JSON: { "category": "...", "subCategory": "...", "confidence": 0.9, "reason": "..." }.

    Transaction: `;

  // F-PERF-003: this used to be one sequential round-trip per transaction
  // (~7 min for 500 rows). A small worker pool keeps the local server busy
  // without exceeding its default parallelism (OLLAMA_NUM_PARALLEL defaults
  // to 4), cutting wall-clock roughly by the lane count.
  const CONCURRENCY = 4;

  const categorizeOne = async (tx: Transaction): Promise<void> => {
    try {
      const response = await fetch(url, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          model: model,
          prompt: `${promptBase} Description: ${tx.description}, Amount: ${tx.amount}, Original Category: ${tx.originalCategory || 'N/A'}`,
          stream: false,
          format: 'json',
        }),
      });

      if (!response.ok) {
        if (response.status === 404) throw new Error(ollamaModelMissingMessage(model));
        throw new Error('Ollama connection failed');
      }

      const data = await response.json();
      let result;

      // Handle cases where Ollama doesn't enforce JSON mode perfectly
      try {
        result = JSON.parse(data.response);
      } catch (_parseError) {
        // Fallback simple parsing if model chats instead of JSON
        logger.warn('Failed to parse JSON from Ollama', data.response);
        // Don't throw here, just treat as failed tx
        throw new Error('Invalid JSON response');
      }

      const processedResult = normalizeCategorization({ ...result, id: tx.id }, 'Local AI');

      if (onChunkProcessed) onChunkProcessed([processedResult]);
    } catch (e: unknown) {
      const errorMessage = e instanceof Error ? e.message : String(e);
      if (errorMessage === 'Failed to fetch') {
        throw new Error(
          'CORS Error. Run: $env:OLLAMA_ORIGINS="*"; ollama serve (Windows) OR OLLAMA_ORIGINS="*" ollama serve (Mac/Linux)'
        );
      }

      // Mark individual failure
      const failedResult: CategorizationResult = {
        id: tx.id,
        category: TransactionCategory.Uncategorized,
        confidence: 0,
        reason: 'AI Error: ' + errorMessage,
      };
      if (onChunkProcessed) onChunkProcessed([failedResult]);
    }
  };

  let nextIndex = 0;
  const lanes = Array.from({ length: Math.min(CONCURRENCY, transactions.length) }, async () => {
    while (nextIndex < transactions.length) {
      const tx = transactions[nextIndex++];
      await categorizeOne(tx);
    }
  });
  await Promise.all(lanes);
};

// Simulation for preview environments without backend/key. Uses the same
// originalCategory → hierarchy map as the demo dataset (lib/demoData.ts) so
// demo and simulated results agree; unmapped rows degrade to zero-confidence
// Uncategorized instead of a guessed category.
const simulateCategorization = async (
  transactions: Transaction[],
  onChunkProcessed?: (results: CategorizationResult[]) => void
): Promise<void> => {
  const BATCH_SIZE = 5;

  for (let i = 0; i < transactions.length; i += BATCH_SIZE) {
    const batch = transactions.slice(i, i + BATCH_SIZE);

    await new Promise((resolve) => setTimeout(resolve, 800)); // Fake network delay

    const results: CategorizationResult[] = batch.map((t) => {
      const mapped = demoCategoryFor(t.originalCategory);
      if (!mapped) {
        return {
          id: t.id,
          category: TransactionCategory.Uncategorized,
          confidence: 0,
          reason: 'Demo: no matching rule',
        };
      }
      return normalizeCategorization(
        {
          id: t.id,
          category: mapped[0],
          subCategory: mapped[1],
          confidence: 0.85,
          reason: 'Demo data',
        },
        'Demo data'
      );
    });

    if (onChunkProcessed) onChunkProcessed(results);
  }
};
