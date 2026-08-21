import { Transaction, TransactionCategory } from '../types';
import type { ScoreBreakdown } from './scoreService';

/** Result of a single scoring metric: a delta to apply plus display items. */
export interface MetricResult {
  delta: number;
  breakdown: ScoreBreakdown[];
  tips: string[];
}

/** Expenses relevant to scoring: negative amounts excluding internal transfers. */
export const filterScorableExpenses = (allTransactions: Transaction[]): Transaction[] =>
  allTransactions.filter(
    (t) => t.amount < 0 && t.category !== TransactionCategory.InternalTransfer
  );

export interface ScoreTimeframes {
  currentMonthKey: string;
  currentMonthTx: Transaction[];
  historyTx: Transaction[];
  isFirstMonth: boolean;
}

/** Split normalized expenses into the current (latest) month vs history. */
export const buildTimeframes = (
  normalizedExpenses: Transaction[],
  latestDate: Date
): ScoreTimeframes => {
  const yearMonth = latestDate.toISOString().substring(0, 7);
  const currentMonthTx = normalizedExpenses.filter((t) => t.date.startsWith(yearMonth));
  const historyTx = normalizedExpenses.filter((t) => !t.date.startsWith(yearMonth));

  return {
    currentMonthKey: yearMonth,
    currentMonthTx,
    historyTx,
    isFirstMonth: historyTx.length === 0,
  };
};

/** METRIC 1: Waste Control (Max Penalty: -20). 1% waste = 1 point penalty. */
export const wasteControlMetric = (currentMonthTx: Transaction[]): MetricResult => {
  const currentWaste = currentMonthTx
    .filter((t) => t.category === TransactionCategory.Waste)
    .reduce((sum, t) => sum + Math.abs(t.amount), 0);
  const totalCurrentSpend = currentMonthTx.reduce((sum, t) => sum + Math.abs(t.amount), 0);

  if (totalCurrentSpend <= 0 || currentWaste <= 0) {
    if (totalCurrentSpend <= 0) return { delta: 0, breakdown: [], tips: [] };
    return {
      delta: 0,
      breakdown: [
        { label: 'Efficiency', points: 0, reason: 'No waste detected', type: 'positive' },
      ],
      tips: [],
    };
  }

  const wasteRatio = currentWaste / totalCurrentSpend;
  const penalty = Math.min(20, Math.ceil(wasteRatio * 100));
  return {
    delta: -penalty,
    breakdown: [
      {
        label: 'Waste / Fees',
        points: -penalty,
        reason: `${(wasteRatio * 100).toFixed(1)}% of spending is waste`,
        type: 'negative',
      },
    ],
    tips: ["Review 'Waste' items. Cutting fees is the easiest way to boost your score."],
  };
};

export interface BudgetAdherenceInput {
  currentMonthTx: Transaction[];
  historyTx: Transaction[];
  uniqueHistoryMonths: number;
  currentScore: number;
}

/** METRIC 2: Budget Adherence — current spend vs average monthly history spend. */
export const budgetAdherenceMetric = ({
  currentMonthTx,
  historyTx,
  uniqueHistoryMonths,
  currentScore,
}: BudgetAdherenceInput): MetricResult => {
  const totalHistorySpend = historyTx.reduce((sum, t) => sum + Math.abs(t.amount), 0);
  const avgMonthlySpend = totalHistorySpend / uniqueHistoryMonths;
  if (avgMonthlySpend <= 0) return { delta: 0, breakdown: [], tips: [] };

  const totalCurrentSpend = currentMonthTx.reduce((sum, t) => sum + Math.abs(t.amount), 0);
  const drift = totalCurrentSpend - avgMonthlySpend;
  const driftPercent = (drift / avgMonthlySpend) * 100;

  if (driftPercent > 0) {
    // Penalty: 1 point for every 2% over, max 30
    const penalty = Math.min(30, Math.ceil(driftPercent / 2));
    return {
      delta: -penalty,
      breakdown: [
        {
          label: 'Overall Budget',
          points: -penalty,
          reason: `${Math.round(driftPercent)}% over average`,
          type: 'negative',
        },
      ],
      tips: ["You're spending more than usual this month. Check 'Nice-to-Have' categories."],
    };
  }

  // Under budget bonus (max 10) — can redeem points lost elsewhere, capped at 100.
  const bonus = Math.min(10, Math.ceil(Math.abs(driftPercent) / 5));
  const actualBonus = currentScore < 100 ? Math.min(bonus, 100 - currentScore) : 0;
  if (actualBonus <= 0) return { delta: 0, breakdown: [], tips: [] };
  return {
    delta: actualBonus,
    breakdown: [
      {
        label: 'Budget Control',
        points: actualBonus,
        reason: `${Math.round(Math.abs(driftPercent))}% under average`,
        type: 'positive',
      },
    ],
    tips: [],
  };
};

export interface LifestyleDriftInput {
  currentMonthTx: Transaction[];
  historyTx: Transaction[];
  uniqueHistoryMonths: number;
}

/** METRIC 3: Nice-to-Have drift vs historical average. 5% over = 1 point, max 20. */
export const lifestyleDriftMetric = ({
  currentMonthTx,
  historyTx,
  uniqueHistoryMonths,
}: LifestyleDriftInput): MetricResult => {
  const niceToHaveAvg =
    historyTx
      .filter((t) => t.category === TransactionCategory.NiceToHave)
      .reduce((sum, t) => sum + Math.abs(t.amount), 0) / uniqueHistoryMonths;
  const niceToHaveCurrent = currentMonthTx
    .filter((t) => t.category === TransactionCategory.NiceToHave)
    .reduce((sum, t) => sum + Math.abs(t.amount), 0);

  if (!(niceToHaveAvg > 50 && niceToHaveCurrent > niceToHaveAvg)) {
    return { delta: 0, breakdown: [], tips: [] };
  }

  const driftPct = ((niceToHaveCurrent - niceToHaveAvg) / niceToHaveAvg) * 100;
  const penalty = Math.min(20, Math.ceil(driftPct / 5));
  return {
    delta: -penalty,
    breakdown: [
      {
        label: 'Lifestyle Inflation',
        points: -penalty,
        reason: `Nice-to-haves up ${Math.round(driftPct)}%`,
        type: 'negative',
      },
    ],
    tips: [
      `Cut back on Nice-to-Haves by $${Math.round((niceToHaveCurrent - niceToHaveAvg) / 4)} per week to get back on track.`,
    ],
  };
};

export interface SavingsMetricInput {
  currentMonthTx: Transaction[];
  normalizedExpenses: Transaction[];
  currentMonthKey: string;
  currentScore: number;
}

/** METRIC 4: Savings/Investments bonus based on current-month savings rate. */
export const savingsRateMetric = ({
  currentMonthTx,
  normalizedExpenses,
  currentMonthKey,
  currentScore,
}: SavingsMetricInput): MetricResult => {
  const income = normalizedExpenses
    .filter((t) => t.category === TransactionCategory.Income && t.date.startsWith(currentMonthKey))
    .reduce((sum, t) => sum + t.amount, 0);
  if (income <= 0) return { delta: 0, breakdown: [], tips: [] };

  const savings = currentMonthTx
    .filter(
      (t) => t.category === TransactionCategory.Save || t.category === TransactionCategory.Invest
    )
    .reduce((sum, t) => sum + Math.abs(t.amount), 0);
  const saveRate = savings / income;

  if (saveRate > 0.2) {
    const delta = currentScore < 100 ? Math.min(100 - currentScore, 5) : 0;
    return {
      delta,
      breakdown: [
        { label: 'Super Saver', points: 0, reason: '20%+ savings rate!', type: 'positive' },
      ],
      tips: [],
    };
  }

  if (saveRate < 0.05) {
    return {
      delta: -5,
      breakdown: [{ label: 'Savings', points: -5, reason: 'Low savings rate', type: 'negative' }],
      tips: ['Try to stash away at least 5-10% of income into Savings.'],
    };
  }

  return { delta: 0, breakdown: [], tips: [] };
};

/** Map a 0-100 score to a letter grade band. */
export const gradeFromScore = (score: number): string => {
  if (score >= 97) return 'A+';
  if (score >= 93) return 'A';
  if (score >= 90) return 'A-';
  if (score >= 87) return 'B+';
  if (score >= 83) return 'B';
  if (score >= 80) return 'B-';
  if (score >= 77) return 'C+';
  if (score >= 73) return 'C';
  if (score >= 70) return 'C-';
  if (score >= 60) return 'D';
  return 'F';
};

/** Default tip when no metric produced one. */
export const defaultTipForScore = (score: number): string =>
  score > 90
    ? "You're crushing it! Consider increasing your investment contributions."
    : 'Maintain your current spending habits to improve your score.';
