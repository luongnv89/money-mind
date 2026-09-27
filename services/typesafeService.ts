import { CategorizationResult, Transaction, TransactionCategory } from '../types';
import { CATEGORY_HIERARCHY, TYPESAFE_API_BASE, TYPESAFE_MODEL } from '../constants';
import { getTypesafeApiKey, useSettingsStore } from '../stores/useSettingsStore';
import { logger } from '../lib/logger';

export const UNCLEAR_OPTION = 'Unclear';

const CATEGORY_MEANINGS: Record<
  Exclude<TransactionCategory, TransactionCategory.Uncategorized>,
  string
> = {
  [TransactionCategory.Income]:
    'Money the user received: pay, business or rental income, investment payouts, gifts, refunds and benefits.',
  [TransactionCategory.InternalTransfer]:
    "Money moved between the user's own accounts, cash withdrawals and deposits, and credit card bill payments. Neither spending nor income.",
  [TransactionCategory.MustHave]:
    'Essential spending the user cannot reasonably avoid: groceries, housing, utilities, medical care, insurance, taxes, loan repayments, commuting and childcare.',
  [TransactionCategory.NiceToHave]:
    'Discretionary spending on things the user enjoys but could live without.',
  [TransactionCategory.Waste]:
    'Spending that clearly gives little or no value, such as late fees, penalties, overdraft charges or gambling.',
  [TransactionCategory.Save]: 'Money set aside into a savings account or savings goal.',
  [TransactionCategory.Invest]:
    'Money put into assets or growth expected to pay off later, such as stocks, crypto, property or career training.',
};

export const SUBCATEGORY_NOTES: Record<string, string> = {
  'Income: Refunds & Reimbursements':
    'Money returned for an earlier purchase, or an expense repaid to the user',
  'Income: Investment Returns': 'Dividends, interest or proceeds received from investments',
  'Internal Transfer: Account to Account':
    "Moving money between the user's own current or checking accounts",
  'Internal Transfer: ATM Withdrawal/Deposit': 'Taking out or paying in cash at an ATM or branch',
  'Internal Transfer: Credit Card Payment': "Paying off the user's own credit card bill",
  'Internal Transfer: Investment Transfer':
    "Moving money between the user's own investment accounts, such as a rollover. A new contribution or purchase is Invest",
  'Internal Transfer: Loan/Line of Credit':
    "Drawing from, or moving money to, the user's own line of credit. A scheduled loan instalment is Debt Payments",
  'Must-have: Food & Groceries': 'Supermarkets, grocers and household food shopping',
  'Must-have: Housing':
    'Rent or mortgage, utilities, home internet and other running costs of the home',
  'Must-have: Transportation':
    'Fuel, public transport, parking, tolls, car maintenance and commuting',
  'Must-have: Debt Payments': 'Scheduled instalments on a student, car or personal loan',
  'Must-have: Health & Medical': 'Doctors, dentists, pharmacies and other medical care',
  'Must-have: Basic Clothing': 'Essential everyday clothing',
  'Nice-to-have: Dining Out': 'Restaurants, cafes, bars, takeaway and food delivery',
  'Nice-to-have: Entertainment': 'Streaming services, games, cinema, concerts, events and hobbies',
  'Nice-to-have: Shopping': 'General retail and online marketplace purchases beyond essentials',
  'Nice-to-have: Fitness & Sports': 'Gyms, sports clubs and fitness classes',
  'Nice-to-have: Education': 'Classes and learning taken for enjoyment',
  'Nice-to-have: Technology': 'Electronics, gadgets, software and app purchases',
  'Waste: Late Fees & Penalties': 'Late payment fees, overdraft charges, fines and penalties',
  'Waste: Gambling': 'Betting, casinos and lottery',
  'Save: Retirement Savings': 'Contributions to a pension or retirement savings account',
  'Invest: Stock Market': 'Buying stocks, ETFs or funds, or contributing to a brokerage account',
  'Invest: Cryptocurrency': 'Buying cryptocurrency or sending money to a crypto exchange',
  'Invest: Education Investment':
    'Degrees, certifications or training expected to raise future earnings',
};

const CATEGORY_INSTRUCTIONS = {
  question:
    'Which option best describes `transaction`? Each option is a budget category, a colon, and a subcategory. `category_meanings` explains each budget category.',
  category_meanings: CATEGORY_MEANINGS,
  rules: [
    '`transaction.direction` says whether money came in or went out of the account.',
    "`transaction.bank_category`, when present, is the bank's own label. Treat it as a hint, not as the answer.",
    "A transfer into savings is Save. Other transfers between the user's own accounts are Internal Transfer.",
    'Choose a Waste option only when the transaction itself shows waste, such as a fee, penalty or gambling. An ordinary discretionary purchase is Nice-to-have.',
    'Choose Unclear only when the description gives no usable clue about what the transaction was.',
  ],
};

const OPTION_LOOKUP = new Map<string, { category: TransactionCategory; subCategory: string }>();

const buildCriteria = (): Record<string, string | null> => {
  const criteria: Record<string, string | null> = {};
  for (const [category, subCategories] of Object.entries(CATEGORY_HIERARCHY)) {
    for (const subCategory of subCategories) {
      const option = `${category}: ${subCategory}`;
      criteria[option] = SUBCATEGORY_NOTES[option] ?? null;
      OPTION_LOOKUP.set(option, {
        category: category as TransactionCategory,
        subCategory,
      });
    }
  }
  criteria[UNCLEAR_OPTION] =
    'The description gives no usable clue about what the transaction was, such as only a reference number or an unknown code';
  return criteria;
};

export const CATEGORY_QUESTION = {
  type: 'choice',
  instructions: CATEGORY_INSTRUCTIONS,
  criteria: buildCriteria(),
};

interface ChoiceAnswer {
  type: 'choice';
  choice: string;
  probabilities: Record<string, number>;
  confidence: number;
}

interface SystemOneResponse {
  model?: string;
  answers?: Record<string, unknown>;
  usage?: { input_tokens?: number; output_tokens?: number };
}

export const buildTransactionState = (
  tx: Transaction
): {
  transaction: {
    description: string;
    direction: string;
    amount: string;
    bank_category?: string;
  };
} => {
  const direction = tx.amount < 0 ? 'money out' : tx.amount > 0 ? 'money in' : 'zero amount';
  const transaction: {
    description: string;
    direction: string;
    amount: string;
    bank_category?: string;
  } = {
    description: tx.description,
    direction,
    amount: Math.abs(tx.amount).toFixed(2),
  };
  if (tx.originalCategory?.trim()) {
    transaction.bank_category = tx.originalCategory;
  }
  return { transaction };
};

export const interpretCategoryAnswer = (
  answer: ChoiceAnswer,
  model: string
): Omit<CategorizationResult, 'id'> => {
  const pct = (p: number): string => `${Math.round(p * 100)}%`;

  const groupTotals = new Map<TransactionCategory | typeof UNCLEAR_OPTION, number>();
  const leafProbabilities = new Map<string, number>();

  for (const [option, probability] of Object.entries(answer.probabilities ?? {})) {
    if (option === UNCLEAR_OPTION) {
      groupTotals.set(UNCLEAR_OPTION, (groupTotals.get(UNCLEAR_OPTION) ?? 0) + probability);
      continue;
    }
    const decoded = OPTION_LOOKUP.get(option);
    if (!decoded) continue;
    groupTotals.set(decoded.category, (groupTotals.get(decoded.category) ?? 0) + probability);
    leafProbabilities.set(option, probability);
  }

  if (groupTotals.size === 0) {
    throw new Error('TypeSafe returned no recognizable category options');
  }

  let bestGroup: TransactionCategory | typeof UNCLEAR_OPTION = UNCLEAR_OPTION;
  let bestGroupProbability = -1;
  for (const [group, total] of groupTotals) {
    if (total > bestGroupProbability) {
      bestGroup = group;
      bestGroupProbability = total;
    }
  }

  if (bestGroup === UNCLEAR_OPTION) {
    return {
      category: TransactionCategory.Uncategorized,
      subCategory: undefined,
      confidence: 0,
      reason: `TypeSafe ${model}: not enough information to categorize (${pct(bestGroupProbability)} unclear)`,
    };
  }

  let bestOption = '';
  let bestLeafProbability = -1;
  for (const [option, probability] of leafProbabilities) {
    const decoded = OPTION_LOOKUP.get(option);
    if (decoded?.category === bestGroup && probability > bestLeafProbability) {
      bestOption = option;
      bestLeafProbability = probability;
    }
  }
  const subCategory = OPTION_LOOKUP.get(bestOption)?.subCategory;

  return {
    category: bestGroup,
    subCategory,
    confidence: Math.min(1, Math.max(0, bestGroupProbability)),
    reason: `TypeSafe ${model}: ${bestGroup} ${pct(bestGroupProbability)} · ${subCategory} ${pct(bestLeafProbability)}`,
  };
};

class TypeSafeFatalError extends Error {}

const MAX_ATTEMPTS = 4;
const MAX_RETRY_DELAY_MS = 8000;

const retryDelayMs = (response: Response, attempt: number): number => {
  const headerMs = response.headers.get('retry-after-ms');
  if (headerMs !== null) {
    const parsed = Number(headerMs);
    if (Number.isFinite(parsed)) return Math.min(parsed, MAX_RETRY_DELAY_MS);
  }
  const headerSeconds = response.headers.get('Retry-After');
  if (headerSeconds !== null) {
    const parsed = Number(headerSeconds);
    if (Number.isFinite(parsed)) return Math.min(parsed * 1000, MAX_RETRY_DELAY_MS);
  }
  return Math.min(500 * 2 ** attempt, MAX_RETRY_DELAY_MS);
};

const extractDetail = (payload: unknown, status: number): string => {
  const detail = (payload as { detail?: unknown } | null | undefined)?.detail;
  if (typeof detail === 'string' && detail.trim()) return detail;
  const message = (detail as { message?: unknown } | null | undefined)?.message;
  if (typeof message === 'string' && message.trim()) return message;
  if (Array.isArray(detail)) {
    const messages = detail
      .map((entry) => (entry as { msg?: unknown } | null | undefined)?.msg)
      .filter((msg): msg is string => typeof msg === 'string' && msg.length > 0);
    if (messages.length) return messages.join('; ');
  }
  return `HTTP ${status}`;
};

const sleep = (ms: number): Promise<void> => new Promise((resolve) => setTimeout(resolve, ms));

const typesafeRequest = async (
  path: string,
  init: { method?: string; body?: unknown } = {}
): Promise<Response> => {
  const apiKey = getTypesafeApiKey(useSettingsStore.getState());
  const headers: Record<string, string> = { Authorization: `Bearer ${apiKey}` };
  if (init.body !== undefined) headers['Content-Type'] = 'application/json';

  for (let attempt = 0; attempt < MAX_ATTEMPTS; attempt++) {
    let response: Response;
    try {
      response = await fetch(`${TYPESAFE_API_BASE}${path}`, {
        method: init.method ?? 'POST',
        headers,
        body: init.body !== undefined ? JSON.stringify(init.body) : undefined,
      });
    } catch {
      throw new TypeSafeFatalError(
        `Could not reach TypeSafe through ${TYPESAFE_API_BASE}. Check your connection.`
      );
    }

    const isJson = (response.headers.get('content-type') ?? '').includes('application/json');
    if (response.ok) {
      if (!isJson) {
        throw new TypeSafeFatalError(
          `TypeSafe is not reachable at ${TYPESAFE_API_BASE}. Serve the app with npm run dev, npm run preview, or on Vercel (vercel.json rewrites ${TYPESAFE_API_BASE} to api.typesafe.ai).`
        );
      }
      return response;
    }

    if (response.status === 429 || response.status === 529) {
      if (attempt < MAX_ATTEMPTS - 1) {
        await sleep(retryDelayMs(response, attempt));
        continue;
      }
      throw new TypeSafeFatalError(
        response.status === 429
          ? 'TypeSafe Rate Limit Exceeded (429). Please try again in a minute.'
          : 'TypeSafe is overloaded (529). Please try again in a minute.'
      );
    }

    if (!isJson && (response.status === 404 || response.status === 405)) {
      throw new TypeSafeFatalError(
        `TypeSafe is not reachable at ${TYPESAFE_API_BASE}. Serve the app with npm run dev, npm run preview, or on Vercel (vercel.json rewrites ${TYPESAFE_API_BASE} to api.typesafe.ai).`
      );
    }

    const payload = isJson ? await response.json().catch(() => null) : null;
    const detail = extractDetail(payload, response.status);

    if (response.status === 401 || response.status === 403) {
      throw new TypeSafeFatalError(
        `TypeSafe authentication failed (${response.status}). Check your TypeSafe key in Settings.`
      );
    }
    if (response.status === 422) {
      throw new TypeSafeFatalError(`TypeSafe rejected the request (422): ${detail}`);
    }
    throw new Error(`TypeSafe HTTP ${response.status}: ${detail}`);
  }

  throw new TypeSafeFatalError('TypeSafe request failed');
};

export const categorizeWithTypeSafe = async (
  transactions: Transaction[],
  onChunkProcessed?: (results: CategorizationResult[]) => void
): Promise<void> => {
  const CONCURRENCY = 4;
  let aborted = false;
  let nextIndex = 0;

  const categorizeOne = async (tx: Transaction): Promise<void> => {
    try {
      const response = await typesafeRequest('/v1/systemone', {
        body: {
          model: TYPESAFE_MODEL,
          state: buildTransactionState(tx),
          questions: { category: CATEGORY_QUESTION },
        },
      });
      const data = (await response.json()) as SystemOneResponse;
      const answer = data.answers?.category as ChoiceAnswer | undefined;
      if (!answer || answer.type !== 'choice') {
        throw new Error('TypeSafe returned no choice answer for the category question');
      }
      onChunkProcessed?.([
        {
          id: tx.id,
          ...interpretCategoryAnswer(answer, data.model ?? TYPESAFE_MODEL),
        },
      ]);
    } catch (e: unknown) {
      if (e instanceof TypeSafeFatalError) {
        aborted = true;
        throw e;
      }
      const message = e instanceof Error ? e.message : String(e);
      logger.warn('TypeSafe categorization failed for a transaction', e);
      onChunkProcessed?.([
        {
          id: tx.id,
          category: TransactionCategory.Uncategorized,
          confidence: 0,
          reason: 'AI Request Failed: ' + message,
        },
      ]);
    }
  };

  const lanes = Array.from({ length: Math.min(CONCURRENCY, transactions.length) }, async () => {
    while (!aborted && nextIndex < transactions.length) {
      const tx = transactions[nextIndex++];
      await categorizeOne(tx);
    }
  });
  await Promise.all(lanes);
};

export const testTypesafeConnection = async (): Promise<boolean> => {
  if (!getTypesafeApiKey(useSettingsStore.getState())) {
    throw new Error('No TypeSafe API key set. Add one above to test the connection.');
  }
  await typesafeRequest('/v1/models', { method: 'GET' });
  return true;
};
