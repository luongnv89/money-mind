import { beforeEach, describe, expect, it, vi } from 'vitest';
import {
  CATEGORY_QUESTION,
  SUBCATEGORY_NOTES,
  UNCLEAR_OPTION,
  buildTransactionState,
  categorizeWithTypeSafe,
  interpretCategoryAnswer,
  testTypesafeConnection,
} from './typesafeService';
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
    ...overrides,
  }) as Transaction;

const jsonResponse = (
  body: unknown,
  init: { status?: number; headers?: Record<string, string> } = {}
): Response => {
  const status = init.status ?? 200;
  const headers = new Map(
    Object.entries({ 'content-type': 'application/json', ...(init.headers ?? {}) }).map(
      ([key, value]) => [key.toLowerCase(), value]
    )
  );
  return {
    ok: status >= 200 && status < 300,
    status,
    headers: { get: (name: string) => headers.get(name.toLowerCase()) ?? null },
    json: async () => body,
  } as unknown as Response;
};

const htmlResponse = (status = 200): Response =>
  ({
    ok: status >= 200 && status < 300,
    status,
    headers: {
      get: (name: string) => (name.toLowerCase() === 'content-type' ? 'text/html' : null),
    },
    json: async () => {
      throw new Error('not json');
    },
    text: async () => '<html></html>',
  }) as unknown as Response;

const textResponse = (status: number, headers: Record<string, string> = {}): Response =>
  ({
    ok: status >= 200 && status < 300,
    status,
    headers: {
      get: (name: string) => {
        const lower = name.toLowerCase();
        if (lower === 'content-type') return 'text/plain';
        return headers[lower] ?? null;
      },
    },
    json: async () => {
      throw new Error('not json');
    },
    text: async () => '',
  }) as unknown as Response;

const choiceResponse = (probabilities: Record<string, number>, model = 'jev-1.13.0'): Response =>
  jsonResponse({
    model,
    answers: {
      category: {
        type: 'choice',
        choice: Object.entries(probabilities).sort((a, b) => b[1] - a[1])[0]?.[0] ?? '',
        probabilities,
        confidence: 0.9,
      },
    },
    usage: { input_tokens: 10, output_tokens: 5 },
  });

const setKey = () => useSettingsStore.getState().setTypesafeConfig({ apiKey: 'ts-secret-key' });

beforeEach(() => {
  vi.stubGlobal('fetch', fetchMock);
  fetchMock.mockReset();
  window.localStorage.clear();
  useSettingsStore.getState().resetSettings();
});

describe('CATEGORY_QUESTION criteria', () => {
  it('covers every hierarchy leaf plus the Unclear option', () => {
    const keys = Object.keys(CATEGORY_QUESTION.criteria);
    expect(keys).toHaveLength(68);
    expect(Object.values(CATEGORY_QUESTION.criteria).filter((v) => v !== null)).toHaveLength(
      Object.keys(SUBCATEGORY_NOTES).length + 1
    );
    expect(CATEGORY_QUESTION.criteria[UNCLEAR_OPTION]).toBeTruthy();
  });
});

describe('buildTransactionState', () => {
  it('marks negative amounts as money out and formats the absolute amount', () => {
    expect(buildTransactionState(tx({ amount: -12.5 }))).toEqual({
      transaction: { description: 'Coffee', direction: 'money out', amount: '12.50' },
    });
  });

  it('marks positive amounts as money in and zero as zero amount', () => {
    const positive = buildTransactionState(tx({ amount: 42 })).transaction;
    expect(positive.direction).toBe('money in');
    expect(positive.amount).toBe('42.00');
    expect(buildTransactionState(tx({ amount: 0 })).transaction.direction).toBe('zero amount');
  });

  it('includes bank_category only when the bank category is non-empty', () => {
    expect(
      buildTransactionState(tx({ originalCategory: 'Dining' })).transaction.bank_category
    ).toBe('Dining');
    expect(buildTransactionState(tx({ originalCategory: '   ' })).transaction).not.toHaveProperty(
      'bank_category'
    );
    expect(buildTransactionState(tx()).transaction).not.toHaveProperty('bank_category');
  });
});

describe('interpretCategoryAnswer', () => {
  const answer = (probabilities: Record<string, number>) => ({
    type: 'choice' as const,
    choice: '',
    probabilities,
    confidence: 0.5,
  });

  it('maps the winning leaf to its category and subcategory', () => {
    const result = interpretCategoryAnswer(
      answer({ 'Nice-to-have: Dining Out': 0.8, 'Must-have: Food & Groceries': 0.2 }),
      'jev-1.13.0'
    );
    expect(result).toMatchObject({
      category: TransactionCategory.NiceToHave,
      subCategory: 'Dining Out',
      confidence: 0.8,
    });
    expect(result.reason).toBe('TypeSafe jev-1.13.0: Nice-to-have 80% · Dining Out 80%');
  });

  it('decides the main category by group total, not the global best leaf', () => {
    const result = interpretCategoryAnswer(
      answer({
        'Nice-to-have: Dining Out': 0.4,
        'Waste: Excessive Dining': 0.35,
        'Waste: Impulse Purchases': 0.25,
      }),
      'jev-x'
    );
    expect(result.category).toBe(TransactionCategory.Waste);
    expect(result.subCategory).toBe('Excessive Dining');
    expect(result.confidence).toBeCloseTo(0.6);
    expect(result.reason).toBe('TypeSafe jev-x: Waste 60% · Excessive Dining 35%');
  });

  it('returns Uncategorized with confidence 0 when Unclear wins', () => {
    const result = interpretCategoryAnswer(
      answer({ [UNCLEAR_OPTION]: 0.7, 'Nice-to-have: Dining Out': 0.3 }),
      'jev-x'
    );
    expect(result).toMatchObject({
      category: TransactionCategory.Uncategorized,
      confidence: 0,
    });
    expect(result.subCategory).toBeUndefined();
    expect(result.reason).toBe(
      'TypeSafe jev-x: not enough information to categorize (70% unclear)'
    );
    expect(result.reason).not.toMatch(/Failed|Error/);
  });

  it('ignores unknown option keys and throws when nothing is known', () => {
    const result = interpretCategoryAnswer(
      answer({ 'Bogus: Option': 0.5, 'Must-have: Housing': 0.5 }),
      'jev-x'
    );
    expect(result.category).toBe(TransactionCategory.MustHave);
    expect(result.subCategory).toBe('Housing');
    expect(() => interpretCategoryAnswer(answer({ 'Bogus: Option': 1 }), 'jev-x')).toThrowError();
  });
});

describe('categorizeWithTypeSafe', () => {
  it('posts one System One request per transaction with the bearer key', async () => {
    setKey();
    fetchMock.mockResolvedValue(choiceResponse({ 'Nice-to-have: Dining Out': 0.9 }));
    const onChunk = vi.fn();
    const t = tx({
      id: 'tx-1',
      description: 'STARBUCKS',
      amount: -5.5,
      originalCategory: 'Dining',
    });
    await categorizeWithTypeSafe([t], onChunk);

    expect(fetchMock).toHaveBeenCalledTimes(1);
    const [url, init] = fetchMock.mock.calls[0] as [string, RequestInit];
    expect(url).toBe('/typesafe-api/v1/systemone');
    expect(init.method).toBe('POST');
    const headers = init.headers as Record<string, string>;
    expect(headers.Authorization).toBe('Bearer ts-secret-key');
    expect(headers['Content-Type']).toBe('application/json');
    const body = JSON.parse(init.body as string);
    expect(body.model).toBe('jev-latest');
    expect(body.questions.category).toEqual(CATEGORY_QUESTION);
    expect(body.state).toEqual(buildTransactionState(t));

    expect(onChunk).toHaveBeenCalledTimes(1);
    expect(onChunk.mock.calls[0][0][0]).toMatchObject({
      id: 'tx-1',
      category: TransactionCategory.NiceToHave,
      subCategory: 'Dining Out',
      confidence: 0.9,
    });
  });

  it('retries a 429 honoring retry-after-ms and then delivers the answer', async () => {
    setKey();
    fetchMock
      .mockResolvedValueOnce(
        jsonResponse({ detail: 'slow down' }, { status: 429, headers: { 'retry-after-ms': '0' } })
      )
      .mockResolvedValueOnce(choiceResponse({ 'Waste: Gambling': 0.95 }));
    const onChunk = vi.fn();
    await categorizeWithTypeSafe([tx()], onChunk);
    expect(fetchMock).toHaveBeenCalledTimes(2);
    expect(onChunk.mock.calls[0][0][0]).toMatchObject({
      category: TransactionCategory.Waste,
      subCategory: 'Gambling',
    });
  });

  it('retries a 529 even when it arrives as text/plain', async () => {
    setKey();
    fetchMock
      .mockResolvedValueOnce(textResponse(529, { 'retry-after-ms': '0' }))
      .mockResolvedValueOnce(choiceResponse({ 'Must-have: Housing': 0.9 }));
    const onChunk = vi.fn();
    await categorizeWithTypeSafe([tx()], onChunk);
    expect(fetchMock).toHaveBeenCalledTimes(2);
    expect(onChunk.mock.calls[0][0][0]).toMatchObject({
      category: TransactionCategory.MustHave,
      subCategory: 'Housing',
    });
  });

  it('gives up after four attempts on a persistent 429', async () => {
    setKey();
    fetchMock.mockResolvedValue(
      jsonResponse({ detail: 'slow down' }, { status: 429, headers: { 'retry-after-ms': '0' } })
    );
    await expect(categorizeWithTypeSafe([tx()])).rejects.toThrow(/Rate Limit/);
    expect(fetchMock).toHaveBeenCalledTimes(4);
  });

  it('aborts the run on a 401 without pulling every transaction', async () => {
    setKey();
    fetchMock.mockResolvedValue(jsonResponse({ detail: 'bad key' }, { status: 401 }));
    const many = Array.from({ length: 6 }, (_, i) => tx({ id: `t${i}` }));
    await expect(categorizeWithTypeSafe(many)).rejects.toThrow(/authentication failed \(401\)/);
    expect(fetchMock.mock.calls.length).toBeLessThanOrEqual(4);
  });

  it('rejects with proxy guidance when the response is not JSON', async () => {
    setKey();
    fetchMock.mockResolvedValue(htmlResponse(200));
    await expect(categorizeWithTypeSafe([tx()])).rejects.toThrow(
      /TypeSafe is not reachable at \/typesafe-api/
    );
  });

  it.each([404, 405])(
    'rejects with proxy guidance on a non-JSON %i (host without the rewrite)',
    async (status) => {
      setKey();
      fetchMock.mockResolvedValue(htmlResponse(status));
      await expect(categorizeWithTypeSafe([tx()])).rejects.toThrow(
        /TypeSafe is not reachable at \/typesafe-api/
      );
    }
  );

  it('marks the transaction failed on a non-JSON 502 without rejecting the run', async () => {
    setKey();
    fetchMock.mockResolvedValue(htmlResponse(502));
    const onChunk = vi.fn();
    await categorizeWithTypeSafe([tx()], onChunk);
    expect(onChunk.mock.calls[0][0][0]).toMatchObject({
      category: TransactionCategory.Uncategorized,
      confidence: 0,
      reason: 'AI Request Failed: TypeSafe HTTP 502: HTTP 502',
    });
  });

  it('marks only the failing transaction on a non-fatal HTTP error', async () => {
    setKey();
    fetchMock.mockImplementation(async (_url: string, init: RequestInit) => {
      const body = JSON.parse(init.body as string);
      if (body.state.transaction.description === 'BAD') {
        return jsonResponse({ detail: 'exploded' }, { status: 500 });
      }
      return choiceResponse({ 'Nice-to-have: Shopping': 0.9 });
    });
    const onChunk = vi.fn();
    await categorizeWithTypeSafe(
      [tx({ id: 'good' }), tx({ id: 'bad', description: 'BAD' })],
      onChunk
    );

    const results = onChunk.mock.calls.map((call) => call[0][0]);
    const failed = results.find((r: { id: string }) => r.id === 'bad');
    const ok = results.find((r: { id: string }) => r.id === 'good');
    expect(failed).toMatchObject({
      category: TransactionCategory.Uncategorized,
      confidence: 0,
      reason: expect.stringContaining('AI Request Failed: TypeSafe HTTP 500: exploded'),
    });
    expect(ok).toMatchObject({ category: TransactionCategory.NiceToHave });
  });

  it('fails the run when fetch itself rejects', async () => {
    setKey();
    fetchMock.mockRejectedValue(new Error('Failed to fetch'));
    await expect(categorizeWithTypeSafe([tx()])).rejects.toThrow(/Could not reach TypeSafe/);
  });
});

describe('testTypesafeConnection', () => {
  it('throws when no TypeSafe key is set', async () => {
    await expect(testTypesafeConnection()).rejects.toThrow(/No TypeSafe API key set/);
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it('GETs /v1/models and resolves true on success', async () => {
    setKey();
    fetchMock.mockResolvedValue(jsonResponse({ models: [] }));
    await expect(testTypesafeConnection()).resolves.toBe(true);
    const [url, init] = fetchMock.mock.calls[0] as [string, RequestInit];
    expect(url).toBe('/typesafe-api/v1/models');
    expect(init.method).toBe('GET');
    expect((init.headers as Record<string, string>).Authorization).toBe('Bearer ts-secret-key');
  });

  it('surfaces the classified error on a 401', async () => {
    setKey();
    fetchMock.mockResolvedValue(jsonResponse({ detail: 'bad key' }, { status: 401 }));
    await expect(testTypesafeConnection()).rejects.toThrow(/authentication failed \(401\)/);
  });
});
