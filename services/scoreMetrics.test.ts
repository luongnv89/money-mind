import { describe, expect, it } from 'vitest';
import { Transaction, TransactionCategory } from '../types';
import {
  budgetAdherenceMetric,
  buildTimeframes,
  defaultTipForScore,
  filterScorableExpenses,
  gradeFromScore,
  lifestyleDriftMetric,
  savingsRateMetric,
  wasteControlMetric,
} from './scoreMetrics';

const tx = (overrides: Partial<Transaction> = {}): Transaction => ({
  id: Math.random().toString(36).slice(2),
  date: '2025-03-09',
  description: 'Test',
  amount: -20,
  category: TransactionCategory.MustHave,
  confidence: 1,
  ...overrides,
});

describe('filterScorableExpenses', () => {
  it('keeps negative non-transfer transactions', () => {
    const mixed = [
      tx({ amount: -10 }),
      tx({ amount: 500, category: TransactionCategory.Income }),
      tx({ amount: -30, category: TransactionCategory.InternalTransfer }),
    ];
    expect(filterScorableExpenses(mixed)).toHaveLength(1);
  });
});

describe('buildTimeframes', () => {
  it('splits the latest month from history', () => {
    const expenses = [
      tx({ date: '2025-01-10' }),
      tx({ date: '2025-02-01' }),
      tx({ date: '2025-02-15' }),
    ];
    const tf = buildTimeframes(expenses, new Date('2025-02-15T00:00:00Z'));
    expect(tf.currentMonthKey).toBe('2025-02');
    expect(tf.currentMonthTx).toHaveLength(2);
    expect(tf.historyTx).toHaveLength(1);
    expect(tf.isFirstMonth).toBe(false);
  });

  it('flags first month when there is no history', () => {
    const tf = buildTimeframes([tx({ date: '2025-03-01' })], new Date('2025-03-01T00:00:00Z'));
    expect(tf.isFirstMonth).toBe(true);
  });
});

describe('wasteControlMetric', () => {
  it('penalizes waste proportionally, capped at 20', () => {
    const spend = [tx({ amount: -10, category: TransactionCategory.Waste }), tx({ amount: -90 })];
    const result = wasteControlMetric(spend);
    expect(result.delta).toBe(-10);
    expect(result.breakdown[0].type).toBe('negative');
    expect(result.tips).toHaveLength(1);
  });

  it('rewards zero waste', () => {
    const result = wasteControlMetric([tx({ amount: -100 })]);
    expect(result.delta).toBe(0);
    expect(result.breakdown[0].label).toBe('Efficiency');
  });

  it('does nothing without spend', () => {
    expect(wasteControlMetric([])).toEqual({ delta: 0, breakdown: [], tips: [] });
  });
});

describe('budgetAdherenceMetric', () => {
  const history = Array.from({ length: 3 }, () => tx({ date: '2025-01-01', amount: -100 }));

  it('penalizes overspending vs the monthly average', () => {
    const result = budgetAdherenceMetric({
      currentMonthTx: Array.from({ length: 15 }, () => tx({ date: '2025-02-01', amount: -100 })),
      historyTx: history,
      uniqueHistoryMonths: 1,
      currentScore: 100,
    });
    expect(result.delta).toBe(-30); // 400% over average → capped at 30
  });

  it('rewards underspending, redeemable up to 100', () => {
    const result = budgetAdherenceMetric({
      currentMonthTx: [tx({ date: '2025-02-01', amount: -50 })],
      historyTx: history,
      uniqueHistoryMonths: 1,
      currentScore: 90,
    });
    expect(result.delta).toBeGreaterThan(0);
    expect(result.delta).toBeLessThanOrEqual(10);
    expect(result.breakdown[0].type).toBe('positive');
  });

  it('does nothing with no average history spend', () => {
    const result = budgetAdherenceMetric({
      currentMonthTx: [tx({ amount: -50 })],
      historyTx: [],
      uniqueHistoryMonths: 1,
      currentScore: 90,
    });
    expect(result).toEqual({ delta: 0, breakdown: [], tips: [] });
  });
});

describe('lifestyleDriftMetric', () => {
  it('penalizes nice-to-have drift above the 50 threshold', () => {
    const history = Array.from({ length: 4 }, () =>
      tx({ date: '2025-01-01', amount: -100, category: TransactionCategory.NiceToHave })
    );
    const current = Array.from({ length: 8 }, () =>
      tx({ date: '2025-02-01', amount: -100, category: TransactionCategory.NiceToHave })
    );
    const result = lifestyleDriftMetric({
      currentMonthTx: current,
      historyTx: history,
      uniqueHistoryMonths: 1,
    });
    expect(result.delta).toBe(-20);
    expect(result.breakdown[0].label).toBe('Lifestyle Inflation');
  });

  it('ignores drift when the average is negligible', () => {
    const result = lifestyleDriftMetric({
      currentMonthTx: [tx({ amount: -10, category: TransactionCategory.NiceToHave })],
      historyTx: [tx({ date: '2025-01-01', amount: -1, category: TransactionCategory.NiceToHave })],
      uniqueHistoryMonths: 1,
    });
    expect(result.delta).toBe(0);
  });
});

describe('savingsRateMetric', () => {
  const base = {
    currentMonthKey: '2025-02',
    normalizedExpenses: [
      tx({ date: '2025-02-01', amount: 1000, category: TransactionCategory.Income }),
    ],
  };

  it('rewards a super-saver rate above 20%', () => {
    const result = savingsRateMetric({
      ...base,
      currentMonthTx: [
        tx({ date: '2025-02-01', amount: -300, category: TransactionCategory.Save }),
      ],
      currentScore: 90,
    });
    expect(result.delta).toBe(5);
    expect(result.breakdown[0].label).toBe('Super Saver');
  });

  it('penalizes a low savings rate', () => {
    const result = savingsRateMetric({
      ...base,
      currentMonthTx: [tx({ date: '2025-02-01', amount: -10, category: TransactionCategory.Save })],
      currentScore: 90,
    });
    expect(result.delta).toBe(-5);
    expect(result.tips).toHaveLength(1);
  });

  it('is neutral without income', () => {
    const result = savingsRateMetric({
      ...base,
      normalizedExpenses: [tx({ date: '2025-02-01', amount: -10 })],
      currentMonthTx: [tx({ date: '2025-02-01', amount: -10, category: TransactionCategory.Save })],
      currentScore: 90,
    });
    expect(result.delta).toBe(0);
  });
});

describe('gradeFromScore', () => {
  it('maps score bands to grades', () => {
    expect(gradeFromScore(100)).toBe('A+');
    expect(gradeFromScore(93)).toBe('A');
    expect(gradeFromScore(80)).toBe('B-');
    expect(gradeFromScore(65)).toBe('D');
    expect(gradeFromScore(10)).toBe('F');
  });
});

describe('defaultTipForScore', () => {
  it('celebrates high scores and coasts otherwise', () => {
    expect(defaultTipForScore(95)).toContain('crushing it');
    expect(defaultTipForScore(50)).toContain('Maintain');
  });
});
