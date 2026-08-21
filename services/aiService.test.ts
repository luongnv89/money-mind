import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

// Mock @google/genai so no network calls ever happen from the test suite.
const generateContentMock = vi.fn();

vi.mock('@google/genai', () => ({
  GoogleGenAI: class {
    models = { generateContent: generateContentMock };
  },
  Type: { ARRAY: 'ARRAY', OBJECT: 'OBJECT', STRING: 'STRING', NUMBER: 'NUMBER' },
}));

import { categorizeWithAI, chatWithFinancialAgent, testAiConnection } from './aiService';
import { useSettingsStore } from '../stores/useSettingsStore';
import { Transaction, TransactionCategory } from '../types';

const fetchMock = vi.fn();

const tx = (overrides: Partial<Transaction> = {}): Transaction =>
  ({
    id: 't1',
    date: '2024-01-01',
    description: 'Coffee',
    amount: -4.5,
    category: TransactionCategory.Uncategorized,
    confidence: 0,
    raw: {},
    ...overrides,
  }) as Transaction;

const resetSettings = (overrides: Record<string, unknown> = {}) => {
  useSettingsStore.setState({
    aiMode: 'cloud',
    isDemoMode: false,
    geminiConfig: { apiKey: '', model: 'models/gemini-flash-latest' },
    groqConfig: { apiKey: '', model: 'llama-3.1-8b-instant' },
    ollamaConfig: { baseUrl: 'http://localhost', port: '11434', model: 'llama3.2' },
    usage: { txAnalyzed: 0, chatMessages: 0, lastReset: '2024-01-01T00:00:00.000Z' },
    ...overrides,
  });
};

const jsonResponse = (body: unknown, ok = true, status = 200) => ({
  ok,
  status,
  json: async () => body,
});

beforeEach(() => {
  vi.stubGlobal('fetch', fetchMock);
  fetchMock.mockReset();
  generateContentMock.mockReset();
  resetSettings();
});

describe('testAiConnection — cloud', () => {
  it('throws when no Gemini API key is set', async () => {
    await expect(testAiConnection()).rejects.toThrow(/No API Key set/i);
  });

  it('returns true on a successful Gemini round-trip', async () => {
    resetSettings({ geminiConfig: { apiKey: btoa('k'), model: 'm' } });
    generateContentMock.mockResolvedValue({ text: 'OK' });
    await expect(testAiConnection()).resolves.toBe(true);
  });

  it('wraps Gemini failures in a "Gemini Error" message', async () => {
    resetSettings({ geminiConfig: { apiKey: btoa('k'), model: 'm' } });
    generateContentMock.mockRejectedValue(new Error('boom'));
    await expect(testAiConnection()).rejects.toThrow(/^Gemini Error: boom$/);
  });

  it('wraps non-Error Gemini rejections via String()', async () => {
    resetSettings({ geminiConfig: { apiKey: btoa('k'), model: 'm' } });
    generateContentMock.mockRejectedValue('nope');
    await expect(testAiConnection()).rejects.toThrow('Gemini Error: nope');
  });
});

describe('testAiConnection — groq', () => {
  it('throws when the Groq API key is missing', async () => {
    resetSettings({ aiMode: 'groq' });
    await expect(testAiConnection()).rejects.toThrow('Missing Groq API Key');
  });

  it('returns true when Groq responds OK', async () => {
    resetSettings({ aiMode: 'groq', groqConfig: { apiKey: btoa('k'), model: 'm' } });
    fetchMock.mockResolvedValue(jsonResponse({}));
    await expect(testAiConnection()).resolves.toBe(true);
  });

  it('surfaces the Groq error message on a failed response', async () => {
    resetSettings({ aiMode: 'groq', groqConfig: { apiKey: btoa('k'), model: 'm' } });
    fetchMock.mockResolvedValue(jsonResponse({ error: { message: 'invalid key' } }, false));
    await expect(testAiConnection()).rejects.toThrow('Groq Error: invalid key');
  });

  it('falls back to a generic message when Groq gives no error body', async () => {
    resetSettings({ aiMode: 'groq', groqConfig: { apiKey: btoa('k'), model: 'm' } });
    fetchMock.mockResolvedValue(jsonResponse({}, false));
    await expect(testAiConnection()).rejects.toThrow('Groq connection failed');
  });

  it('wraps network failures in a "Groq Error" message', async () => {
    resetSettings({ aiMode: 'groq', groqConfig: { apiKey: btoa('k'), model: 'm' } });
    fetchMock.mockRejectedValue(new Error('Failed to fetch'));
    await expect(testAiConnection()).rejects.toThrow('Groq Error: Failed to fetch');
  });
});

describe('testAiConnection — ollama', () => {
  const local = { baseUrl: 'localhost', port: '11434', model: 'llama3.2' };

  it('prepends http:// to a protocol-less base URL and returns true', async () => {
    resetSettings({ aiMode: 'local', ollamaConfig: local });
    fetchMock.mockResolvedValue(jsonResponse({}, true));
    await expect(testAiConnection()).resolves.toBe(true);
    expect(fetchMock.mock.calls[0][0]).toBe('http://localhost:11434/api/generate');
  });

  it('throws "Ollama connection refused" on a non-OK response', async () => {
    resetSettings({ aiMode: 'local', ollamaConfig: local });
    fetchMock.mockResolvedValue(jsonResponse({}, false));
    await expect(testAiConnection()).rejects.toThrow('Ollama connection refused');
  });

  it('prints CORS guidance for TypeError network failures', async () => {
    resetSettings({ aiMode: 'local', ollamaConfig: local });
    const err = new Error('Failed to fetch');
    err.name = 'TypeError';
    fetchMock.mockRejectedValue(err);
    await expect(testAiConnection()).rejects.toThrow(/OLLAMA_ORIGINS="\*"/);
  });

  it('wraps other local failures in a "Local AI Error" message', async () => {
    resetSettings({ aiMode: 'local', ollamaConfig: local });
    fetchMock.mockRejectedValue(new Error('ECONNREFUSED'));
    await expect(testAiConnection()).rejects.toThrow('Local AI Error: ECONNREFUSED');
  });
});

describe('chatWithFinancialAgent', () => {
  it('throws when the chat usage limit is exhausted', async () => {
    resetSettings({ usage: { txAnalyzed: 0, chatMessages: 10, lastReset: '' } });
    await expect(chatWithFinancialAgent('hi', 'ctx')).rejects.toThrow(/Budget Exceeded/);
  });

  it('throws when no Gemini key is configured in cloud mode', async () => {
    await expect(chatWithFinancialAgent('hi', 'ctx')).rejects.toThrow(/No API Key set/i);
  });

  it('returns the Gemini text and increments chat usage', async () => {
    resetSettings({ geminiConfig: { apiKey: btoa('k'), model: 'm' } });
    generateContentMock.mockResolvedValue({ text: 'banana wisdom' });
    await expect(chatWithFinancialAgent('hi', 'ctx')).resolves.toBe('banana wisdom');
    expect(useSettingsStore.getState().usage.chatMessages).toBe(1);
  });

  it('returns a fallback line when Gemini replies with empty text', async () => {
    resetSettings({ geminiConfig: { apiKey: btoa('k'), model: 'm' } });
    generateContentMock.mockResolvedValue({ text: '' });
    await expect(chatWithFinancialAgent('hi', 'ctx')).resolves.toMatch(/speechless/);
  });

  it('throws when the Groq key is missing', async () => {
    resetSettings({ aiMode: 'groq' });
    await expect(chatWithFinancialAgent('hi', 'ctx')).rejects.toThrow('Missing API Key');
  });

  it('returns Groq reply content and increments usage', async () => {
    resetSettings({ aiMode: 'groq', groqConfig: { apiKey: btoa('k'), model: 'm' } });
    fetchMock.mockResolvedValue(
      jsonResponse({ choices: [{ message: { content: 'groq says hi' } }] })
    );
    await expect(chatWithFinancialAgent('hi', 'ctx')).resolves.toBe('groq says hi');
    expect(useSettingsStore.getState().usage.chatMessages).toBe(1);
  });

  it('surfaces Groq API errors', async () => {
    resetSettings({ aiMode: 'groq', groqConfig: { apiKey: btoa('k'), model: 'm' } });
    fetchMock.mockResolvedValue(jsonResponse({ error: { message: 'model not found' } }, false));
    await expect(chatWithFinancialAgent('hi', 'ctx')).rejects.toThrow('model not found');
  });

  it('falls back to a generic Groq error without an error body', async () => {
    resetSettings({ aiMode: 'groq', groqConfig: { apiKey: btoa('k'), model: 'm' } });
    fetchMock.mockResolvedValue(jsonResponse({}, false));
    await expect(chatWithFinancialAgent('hi', 'ctx')).rejects.toThrow('Groq API Error');
  });

  it('has a fallback line when Groq returns empty content', async () => {
    resetSettings({ aiMode: 'groq', groqConfig: { apiKey: btoa('k'), model: 'm' } });
    fetchMock.mockResolvedValue(jsonResponse({ choices: [{ message: { content: '' } }] }));
    await expect(chatWithFinancialAgent('hi', 'ctx')).resolves.toBe('Groq is silent 🐵');
  });

  it('returns the Ollama response text', async () => {
    resetSettings({ aiMode: 'local' });
    fetchMock.mockResolvedValue(jsonResponse({ response: 'local wisdom' }));
    await expect(chatWithFinancialAgent('hi', 'ctx')).resolves.toBe('local wisdom');
  });

  it('throws when Ollama chat fails', async () => {
    resetSettings({ aiMode: 'local' });
    fetchMock.mockResolvedValue(jsonResponse({}, false));
    await expect(chatWithFinancialAgent('hi', 'ctx')).rejects.toThrow('Ollama connection failed');
  });

  it('falls back when Ollama chat returns an empty response', async () => {
    resetSettings({ aiMode: 'local' });
    fetchMock.mockResolvedValue(jsonResponse({ response: '' }));
    await expect(chatWithFinancialAgent('hi', 'ctx')).resolves.toBe('Thinking... 🐵');
  });
});

describe('categorizeWithAI — guards', () => {
  it('throws when the analysis budget would be exceeded', async () => {
    resetSettings({ usage: { txAnalyzed: 150, chatMessages: 0, lastReset: '' } });
    await expect(categorizeWithAI([tx()], 'cloud')).rejects.toThrow(/Budget Exceeded/);
  });

  it('resolves immediately for an empty transaction list', async () => {
    const onChunk = vi.fn();
    await categorizeWithAI([], 'cloud', onChunk);
    expect(onChunk).not.toHaveBeenCalled();
  });

  it('routes demo mode through the simulator without consuming budget', async () => {
    resetSettings({ isDemoMode: true });
    const onChunk = vi.fn();
    await categorizeWithAI([tx({ originalCategory: 'rent' })], 'cloud', onChunk);
    expect(onChunk).toHaveBeenCalledTimes(1);
    expect(onChunk.mock.calls[0][0][0].category).toBe(TransactionCategory.MustHave);
    expect(useSettingsStore.getState().usage.txAnalyzed).toBe(0);
  });
});

describe('categorizeWithAI — gemini', () => {
  it('simulates when no API key is set', async () => {
    const onChunk = vi.fn();
    await categorizeWithAI([tx({ originalCategory: 'groceries' })], 'cloud', onChunk);
    expect(generateContentMock).not.toHaveBeenCalled();
    expect(onChunk.mock.calls[0][0][0].subCategory).toBe('Food & Groceries');
  }, 10000);

  it('emits parsed results on success', async () => {
    resetSettings({ geminiConfig: { apiKey: btoa('k'), model: 'm' } });
    generateContentMock.mockResolvedValue({
      text: JSON.stringify([{ id: 't1', category: 'Waste', confidence: 0.9, reason: 'fee' }]),
    });
    const onChunk = vi.fn();
    await categorizeWithAI([tx()], 'cloud', onChunk);
    expect(onChunk).toHaveBeenCalledTimes(1);
    expect(onChunk.mock.calls[0][0][0]).toMatchObject({ id: 't1', category: 'Waste' });
    expect(useSettingsStore.getState().usage.txAnalyzed).toBe(1);
  }, 10000);

  it('skips the chunk callback when Gemini returns empty text', async () => {
    resetSettings({ geminiConfig: { apiKey: btoa('k'), model: 'm' } });
    generateContentMock.mockResolvedValue({ text: '' });
    const onChunk = vi.fn();
    await categorizeWithAI([tx()], 'cloud', onChunk);
    expect(onChunk).not.toHaveBeenCalled();
  }, 10000);

  it('propagates 429 rate limits as a hard error', async () => {
    resetSettings({ geminiConfig: { apiKey: btoa('k'), model: 'm' } });
    const err = Object.assign(new Error('RESOURCE_EXHAUSTED'), { status: 429 });
    generateContentMock.mockRejectedValue(err);
    await expect(categorizeWithAI([tx()], 'cloud')).rejects.toThrow(/Rate Limit/);
  }, 10000);

  it('emits Uncategorized fallback results on generic batch failure', async () => {
    resetSettings({ geminiConfig: { apiKey: btoa('k'), model: 'm' } });
    generateContentMock.mockRejectedValue(new Error('boom'));
    const onChunk = vi.fn();
    await categorizeWithAI([tx()], 'cloud', onChunk);
    expect(onChunk).toHaveBeenCalledTimes(1);
    expect(onChunk.mock.calls[0][0][0]).toMatchObject({
      category: TransactionCategory.Uncategorized,
      confidence: 0,
    });
  }, 10000);
});

describe('categorizeWithAI — groq', () => {
  const groqKey = { aiMode: 'groq', groqConfig: { apiKey: btoa('k'), model: 'm' } };

  it('normalizes wrapped {results: [...]} payloads', async () => {
    resetSettings(groqKey);
    fetchMock.mockResolvedValue(
      jsonResponse({
        choices: [
          {
            message: {
              content: JSON.stringify({
                results: [{ id: 't1', category: 'Waste', confidence: 0.7, reason: 'fee' }],
              }),
            },
          },
        ],
      })
    );
    const onChunk = vi.fn();
    await categorizeWithAI([tx()], 'groq', onChunk);
    expect(onChunk.mock.calls[0][0][0]).toMatchObject({ id: 't1', category: 'Waste' });
  }, 10000);

  it('accepts a bare JSON array payload and applies field defaults', async () => {
    resetSettings(groqKey);
    fetchMock.mockResolvedValue(
      jsonResponse({
        choices: [{ message: { content: JSON.stringify([{ id: 't1' }]) } }],
      })
    );
    const onChunk = vi.fn();
    await categorizeWithAI([tx()], 'groq', onChunk);
    expect(onChunk.mock.calls[0][0][0]).toMatchObject({
      category: TransactionCategory.Uncategorized,
      confidence: 0.8,
      reason: 'Groq AI',
    });
  }, 10000);

  it('unwraps the first array value of an oddly-shaped object', async () => {
    resetSettings(groqKey);
    fetchMock.mockResolvedValue(
      jsonResponse({
        choices: [{ message: { content: JSON.stringify({ data: [{ id: 't1' }] }) } }],
      })
    );
    const onChunk = vi.fn();
    await categorizeWithAI([tx()], 'groq', onChunk);
    expect(onChunk.mock.calls[0][0][0].id).toBe('t1');
  }, 10000);

  it('stays silent when Groq replies with invalid JSON', async () => {
    resetSettings(groqKey);
    fetchMock.mockResolvedValue(jsonResponse({ choices: [{ message: { content: 'not json' } }] }));
    const onChunk = vi.fn();
    await categorizeWithAI([tx()], 'groq', onChunk);
    expect(onChunk).not.toHaveBeenCalled();
  }, 10000);

  it('propagates 429 rate limits', async () => {
    resetSettings(groqKey);
    fetchMock.mockResolvedValue(jsonResponse({}, false, 429));
    await expect(categorizeWithAI([tx()], 'groq')).rejects.toThrow(/Groq Rate Limit/);
  }, 10000);

  it('propagates errors whose message mentions JSON', async () => {
    resetSettings(groqKey);
    fetchMock.mockResolvedValue(jsonResponse({ error: { message: 'Invalid JSON mode' } }, false));
    await expect(categorizeWithAI([tx()], 'groq')).rejects.toThrow('Invalid JSON mode');
  }, 10000);

  it('emits fallback results for other Groq failures', async () => {
    resetSettings(groqKey);
    fetchMock.mockResolvedValue(jsonResponse({ error: { message: 'server hiccup' } }, false));
    const onChunk = vi.fn();
    await categorizeWithAI([tx()], 'groq', onChunk);
    expect(onChunk.mock.calls[0][0][0]).toMatchObject({
      category: TransactionCategory.Uncategorized,
      reason: expect.stringContaining('AI Request Failed'),
    });
  }, 10000);

  it('emits fallback results when the Groq fetch itself rejects', async () => {
    resetSettings(groqKey);
    fetchMock.mockRejectedValue(new Error('Failed to fetch'));
    const onChunk = vi.fn();
    await categorizeWithAI([tx()], 'groq', onChunk);
    expect(onChunk.mock.calls[0][0][0]).toMatchObject({
      category: TransactionCategory.Uncategorized,
    });
  }, 10000);
});

describe('categorizeWithAI — ollama', () => {
  const local = {
    aiMode: 'local',
    ollamaConfig: { baseUrl: 'localhost', port: '11434', model: 'llama3.2' },
  };

  it('categorizes a transaction from a local model response', async () => {
    resetSettings(local);
    fetchMock.mockResolvedValue(
      jsonResponse({
        response: JSON.stringify({ category: 'Waste', subCategory: 'Fees', confidence: 0.6 }),
      })
    );
    const onChunk = vi.fn();
    await categorizeWithAI([tx()], 'local', onChunk);
    expect(onChunk.mock.calls[0][0][0]).toMatchObject({
      id: 't1',
      category: 'Waste',
      subCategory: 'Fees',
    });
  });

  it('marks a transaction failed when Ollama replies with non-JSON', async () => {
    resetSettings(local);
    fetchMock.mockResolvedValue(jsonResponse({ response: 'sure thing boss' }));
    const onChunk = vi.fn();
    await categorizeWithAI([tx()], 'local', onChunk);
    expect(onChunk.mock.calls[0][0][0]).toMatchObject({
      category: TransactionCategory.Uncategorized,
      reason: expect.stringContaining('Invalid JSON response'),
    });
  });

  it('throws CORS guidance when the local fetch fails outright', async () => {
    resetSettings(local);
    fetchMock.mockRejectedValue(new Error('Failed to fetch'));
    await expect(categorizeWithAI([tx()], 'local')).rejects.toThrow(/CORS Error/);
  });

  it('marks the transaction failed on a non-OK Ollama response', async () => {
    resetSettings(local);
    fetchMock.mockResolvedValue(jsonResponse({}, false));
    const onChunk = vi.fn();
    await categorizeWithAI([tx()], 'local', onChunk);
    expect(onChunk.mock.calls[0][0][0].reason).toContain('Ollama connection failed');
  });
});

describe('categorizeWithAI — rate-limit sleeps (F-PERF-002)', () => {
  const manyTx = (n: number): Transaction[] =>
    Array.from({ length: n }, (_, i) => tx({ id: `t${i}`, description: `Tx ${i}` }));

  afterEach(() => {
    // Restore the spy first, then the real timers: the spy captured the FAKE
    // setTimeout as its "original", so restoring it after useRealTimers would
    // re-install the stale fake over the real global.
    vi.restoreAllMocks();
    vi.useRealTimers();
  });

  it('sleeps exactly twice for a 3-batch Gemini run (25 per batch)', async () => {
    resetSettings({ geminiConfig: { apiKey: btoa('k'), model: 'm' } });
    generateContentMock.mockImplementation(async () => ({
      text: JSON.stringify([{ id: 'x', category: 'Waste', confidence: 0.9, reason: 'r' }]),
    }));

    vi.useFakeTimers();
    const sleepSpy = vi.spyOn(globalThis, 'setTimeout');
    const onChunk = vi.fn();
    const run = categorizeWithAI(manyTx(75), 'cloud', onChunk);

    await vi.advanceTimersByTimeAsync(3 * 4000);
    await run;

    const geminiSleeps = sleepSpy.mock.calls.filter(([, delay]) => delay === 4000).length;
    expect(onChunk).toHaveBeenCalledTimes(3);
    expect(geminiSleeps).toBe(2);
  }, 10000);

  it('sleeps exactly twice for a 3-batch Groq run (10 per batch)', async () => {
    resetSettings({ aiMode: 'groq', groqConfig: { apiKey: btoa('k'), model: 'm' } });
    fetchMock.mockImplementation(async () =>
      jsonResponse({
        choices: [
          { message: { content: JSON.stringify({ results: [{ id: 'x', category: 'Waste' }] }) } },
        ],
      })
    );

    vi.useFakeTimers();
    const sleepSpy = vi.spyOn(globalThis, 'setTimeout');
    const onChunk = vi.fn();
    const run = categorizeWithAI(manyTx(30), 'groq', onChunk);

    await vi.advanceTimersByTimeAsync(3 * 2000);
    await run;

    const groqSleeps = sleepSpy.mock.calls.filter(([, delay]) => delay === 2000).length;
    expect(onChunk).toHaveBeenCalledTimes(3);
    expect(groqSleeps).toBe(2);
  }, 10000);

  it('never sleeps for a single-batch run', async () => {
    resetSettings({ geminiConfig: { apiKey: btoa('k'), model: 'm' } });
    generateContentMock.mockResolvedValue({
      text: JSON.stringify([{ id: 't1', category: 'Waste', confidence: 0.9, reason: 'r' }]),
    });

    const sleepSpy = vi.spyOn(globalThis, 'setTimeout');
    const onChunk = vi.fn();
    await categorizeWithAI([tx()], 'cloud', onChunk);

    expect(onChunk).toHaveBeenCalledTimes(1);
    expect(sleepSpy).not.toHaveBeenCalled();
  }, 10000);
});

describe('categorizeWithAI — ollama concurrency pool (F-PERF-003)', () => {
  const local = {
    aiMode: 'local',
    ollamaConfig: { baseUrl: 'localhost', port: '11434', model: 'llama3.2' },
  };
  const LATENCY_MS = 25;
  const POOL_SIZE = 4;

  it('runs requests through a bounded pool and beats the sequential wall-clock', async () => {
    resetSettings(local);
    const txs = Array.from({ length: 8 }, (_, i) => tx({ id: `t${i}`, description: `Tx ${i}` }));

    let inFlight = 0;
    let maxInFlight = 0;
    fetchMock.mockImplementation(async () => {
      inFlight++;
      maxInFlight = Math.max(maxInFlight, inFlight);
      await new Promise((r) => setTimeout(r, LATENCY_MS));
      inFlight--;
      return jsonResponse({
        response: JSON.stringify({ category: 'Waste', subCategory: 'Fees', confidence: 0.9 }),
      });
    });

    const onChunk = vi.fn();
    const started = Date.now();
    await categorizeWithAI(txs, 'local', onChunk);
    const elapsed = Date.now() - started;

    // Every transaction is categorized exactly once.
    const ids = onChunk.mock.calls.map((call) => call[0][0].id).sort();
    expect(ids).toEqual(txs.map((t) => t.id).sort());

    // Requests genuinely overlap, but never exceed the pool bound.
    expect(maxInFlight).toBeGreaterThan(1);
    expect(maxInFlight).toBeLessThanOrEqual(POOL_SIZE);

    // Sequential wall-clock was 8 x 25ms = 200ms; 4 lanes finish in ~2 waves.
    expect(elapsed).toBeLessThan((txs.length * LATENCY_MS) / 2);
  }, 10000);
});

describe('simulateCategorization heuristics (via demo mode)', () => {
  const simulate = async (t: Transaction) => {
    resetSettings({ isDemoMode: true });
    const onChunk = vi.fn();
    await categorizeWithAI([t], 'cloud', onChunk);
    return onChunk.mock.calls[0][0][0];
  };

  it('maps known bank categories', async () => {
    expect(await simulate(tx({ originalCategory: 'bills' }))).toMatchObject({
      subCategory: 'Utilities',
    });
    expect(await simulate(tx({ originalCategory: 'dining' }))).toMatchObject({
      subCategory: 'Dining Out',
    });
  }, 20000);

  it('falls back to income for positive amounts and deposits', async () => {
    const salary = await simulate(tx({ amount: 100, description: 'monthly salary' }));
    expect(salary.subCategory).toBe('Salary');
    const generic = await simulate(tx({ amount: 100, description: 'odd deposit' }));
    expect(generic.subCategory).toBe('Other Income');
    const deposit = await simulate(
      tx({ description: 'wire deposit', originalCategory: 'misc income' })
    );
    expect(deposit.category).toBe(TransactionCategory.Income);
  }, 20000);

  it('detects transfers, coffee, subscriptions, fees and savings by keyword', async () => {
    expect((await simulate(tx({ description: 'CARD PAYMENT' }))).category).toBe(
      TransactionCategory.InternalTransfer
    );
    expect((await simulate(tx({ description: 'STARBUCKS' }))).subCategory).toBe('Dining Out');
    expect((await simulate(tx({ description: 'NETFLIX' }))).subCategory).toBe('Entertainment');
    expect((await simulate(tx({ description: 'late fee' }))).category).toBe(
      TransactionCategory.Waste
    );
    expect((await simulate(tx({ description: 'auto savings' }))).subCategory).toBe(
      'General Savings'
    );
    expect((await simulate(tx({ description: 'mystery shop' }))).subCategory).toBe('Shopping');
  }, 40000);

  it('treats a positive refund as non-income', async () => {
    const refund = await simulate(tx({ amount: 20, description: 'refund' }));
    expect(refund.category).not.toBe(TransactionCategory.Income);
  }, 10000);
});
