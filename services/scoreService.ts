import { Transaction } from '../types';
import { safeNewDate, normalizeDate } from '../lib/utils';
import {
  filterScorableExpenses,
  buildTimeframes,
  wasteControlMetric,
  budgetAdherenceMetric,
  lifestyleDriftMetric,
  savingsRateMetric,
  gradeFromScore,
  defaultTipForScore,
} from './scoreMetrics';

export interface ScoreBreakdown {
  label: string;
  points: number; // positive or negative
  reason: string;
  type: 'positive' | 'negative' | 'neutral';
}

export interface FinancialScore {
  score: number;
  grade: string; // "A+", "B", etc.
  breakdown: ScoreBreakdown[];
  tips: string[];
  hasEnoughData: boolean;
}

const insufficientData = (tip: string): FinancialScore => ({
  score: 0,
  grade: '-',
  breakdown: [],
  tips: [tip],
  hasEnoughData: false,
});

interface MetricContext {
  currentMonthKey: string;
  currentMonthTx: Transaction[];
  historyTx: Transaction[];
  isFirstMonth: boolean;
  normalizedExpenses: Transaction[];
}

/** Run the four metrics in order, threading the running score through them. */
const applyMetrics = (ctx: MetricContext) => {
  const { currentMonthKey, currentMonthTx, historyTx, isFirstMonth, normalizedExpenses } = ctx;
  let score = 100;
  const breakdown: ScoreBreakdown[] = [];
  const tips: string[] = [];

  const apply = (result: { delta: number; breakdown: ScoreBreakdown[]; tips: string[] }) => {
    score += result.delta;
    breakdown.push(...result.breakdown);
    tips.push(...result.tips);
  };

  // --- METRIC 1: Waste Control (Max Penalty: -20) ---
  apply(wasteControlMetric(currentMonthTx));

  // --- METRICS 2 & 3: Budget Adherence + Nice-to-Have Drift (need history) ---
  if (!isFirstMonth) {
    const uniqueHistoryMonths = new Set(historyTx.map((t) => t.date.substring(0, 7))).size || 1;
    apply(
      budgetAdherenceMetric({ currentMonthTx, historyTx, uniqueHistoryMonths, currentScore: score })
    );
    apply(lifestyleDriftMetric({ currentMonthTx, historyTx, uniqueHistoryMonths }));
  } else {
    // First month heuristics
    breakdown.push({ label: 'History', points: 0, reason: 'Building history...', type: 'neutral' });
  }

  // --- METRIC 4: Savings/Investments (Bonus) ---
  apply(
    savingsRateMetric({
      currentMonthTx,
      normalizedExpenses,
      currentMonthKey,
      currentScore: score,
    })
  );

  return { score, breakdown, tips };
};

export const calculateFinancialScore = (allTransactions: Transaction[]): FinancialScore => {
  // 1. Validation: Need at least some expense data
  const expenses = filterScorableExpenses(allTransactions);
  if (expenses.length < 5) {
    return insufficientData('Add more transactions to generate a score.');
  }

  // 2. Setup Timeframes (Current Month vs History)
  // Normalize dates first — consumers may pass raw bank strings
  const normalizedExpenses = expenses.map((t) => ({
    ...t,
    date: normalizeDate(t.date),
  }));

  const sortedTx = normalizedExpenses
    .filter((t) => !!safeNewDate(t.date))
    .sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime());

  if (sortedTx.length === 0) {
    return insufficientData('No valid transaction dates found.');
  }

  const latestDate = new Date(sortedTx[sortedTx.length - 1].date);
  const timeframes = buildTimeframes(normalizedExpenses, latestDate);

  const { score, breakdown, tips } = applyMetrics({ ...timeframes, normalizedExpenses });

  // Ensure range 0-100
  const finalScore = Math.max(0, Math.min(100, score));

  // Default tip if none
  if (tips.length === 0) {
    tips.push(defaultTipForScore(finalScore));
  }

  return {
    score: finalScore,
    grade: gradeFromScore(finalScore),
    breakdown,
    tips,
    hasEnoughData: true,
  };
};
