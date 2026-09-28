/**
 * Plain-language definitions for every metric MoneyMind shows — what it is,
 * how it's calculated, what it tells you and what "healthy" looks like.
 * Benchmarks are widely used personal-finance rules of thumb, not advice.
 */
export type MetricId =
  | 'income'
  | 'spending'
  | 'netCashFlow'
  | 'savingsRate'
  | 'setAside'
  | 'budgetRule'
  | 'needsRatio'
  | 'wantsRatio'
  | 'housingRatio'
  | 'debtServiceRatio'
  | 'avoidableCosts'
  | 'recurring'
  | 'dayToDay'
  | 'emergencyFund'
  | 'burnRate'
  | 'dailySpending'
  | 'consistency'
  | 'healthScore';

export interface MetricDefinition {
  id: MetricId;
  name: string;
  /** One line: what it is. */
  summary: string;
  /** How it's calculated from your categorized transactions. */
  formula: string;
  /** What the number tells you. */
  meaning: string;
  /** What healthy looks like (empty when there is no standard benchmark). */
  benchmark: string;
}

const define = (d: MetricDefinition): MetricDefinition => d;

export const METRIC_DEFINITIONS: Record<MetricId, MetricDefinition> = {
  income: define({
    id: 'income',
    name: 'Income',
    summary: 'Money you received that counts as earnings.',
    formula:
      'Sum of transactions categorized as Income: pay, business and rental income, benefits, investment payouts and refunds you chose to count as income. Transfers between your own accounts are excluded.',
    meaning:
      'The base every ratio is measured against. Statements show take-home pay (after tax), so ratios here run higher than gross-income versions.',
    benchmark: '',
  }),
  spending: define({
    id: 'spending',
    name: 'Spending',
    summary: 'What your lifestyle cost: essentials, lifestyle and avoidable costs, net of refunds.',
    formula:
      'Must-have + Nice-to-have + Waste, with refunds subtracted, plus any uncategorized money out. Savings, investments and transfers between your accounts are not spending.',
    meaning:
      'Your cost of living for the period. Uncategorized money out is included until you categorize it.',
    benchmark: '',
  }),
  netCashFlow: define({
    id: 'netCashFlow',
    name: 'Net cash flow',
    summary: 'Income minus spending: what is left after living costs.',
    formula: 'Income − Spending.',
    meaning:
      'Positive means you live below your means and can save or invest the difference; negative means savings or credit covered the gap.',
    benchmark: 'Positive every month.',
  }),
  savingsRate: define({
    id: 'savingsRate',
    name: 'Savings rate',
    summary: 'The share of your income you keep.',
    formula: 'Net cash flow ÷ Income.',
    meaning:
      'The single strongest predictor of long-term financial security: it sets how fast you build a cushion and wealth, whatever you earn.',
    benchmark:
      '20% or more is strong (the "20" in 50/30/20); 10–20% is fair; under 10% leaves little margin.',
  }),
  setAside: define({
    id: 'setAside',
    name: 'Set aside',
    summary: 'Money you actively moved to savings or investments.',
    formula: 'Save + Invest transfers, net of withdrawals.',
    meaning:
      'The part of your surplus you put to work. Surplus that stays in your everyday account tends to get spent.',
    benchmark: 'Automate a transfer of 10–20% of income on payday.',
  }),
  budgetRule: define({
    id: 'budgetRule',
    name: '50/30/20 rule',
    summary: 'A simple budget split: 50% needs, 30% wants, 20% savings.',
    formula:
      'Needs = Must-have ÷ Income; Wants = (Nice-to-have + Waste) ÷ Income; Savings = Net cash flow ÷ Income. With uncategorized spending shown separately, the parts add up to 100% of income.',
    meaning:
      'Popularized by Elizabeth Warren, it shows at a glance whether essentials, lifestyle or saving is out of balance.',
    benchmark: 'Needs ≤ 50%, wants ≤ 30%, savings ≥ 20% of take-home pay.',
  }),
  needsRatio: define({
    id: 'needsRatio',
    name: 'Essentials ratio',
    summary: 'The share of income that goes to must-have costs.',
    formula:
      'Must-have ÷ Income (housing, groceries, utilities, insurance, transport, health, childcare, taxes and scheduled loan payments).',
    meaning:
      'High essentials leave little room to save and make you vulnerable to a drop in income; they are also the hardest costs to cut quickly.',
    benchmark: '≤ 50% of take-home pay.',
  }),
  wantsRatio: define({
    id: 'wantsRatio',
    name: 'Lifestyle ratio',
    summary: 'The share of income spent on things you could live without.',
    formula: '(Nice-to-have + Waste) ÷ Income.',
    meaning:
      'The most flexible part of your budget — the first place to look when you want to save more.',
    benchmark: '≤ 30% of take-home pay.',
  }),
  housingRatio: define({
    id: 'housingRatio',
    name: 'Housing cost ratio',
    summary: 'The share of income that goes to keeping a roof over your head.',
    formula: 'Must-have › Housing (rent or mortgage, utilities and home running costs) ÷ Income.',
    meaning:
      'Usually the largest fixed cost. The U.S. housing agency (HUD) calls households paying more than 30% of income "cost-burdened"; it uses gross income, so this take-home version reads higher.',
    benchmark: '≤ 30% of income.',
  }),
  debtServiceRatio: define({
    id: 'debtServiceRatio',
    name: 'Loan payment ratio',
    summary: 'The share of income committed to consumer-loan repayments.',
    formula:
      'Must-have › Debt Payments (scheduled student, car and personal loan instalments) ÷ Income. Credit-card bill payments are transfers: the card purchases already count as spending.',
    meaning:
      'Money committed before you can choose how to use it. High ratios limit flexibility and borrowing capacity.',
    benchmark: '≤ 10% of take-home pay (the 20/10 rule); above 20% is high.',
  }),
  avoidableCosts: define({
    id: 'avoidableCosts',
    name: 'Avoidable costs',
    summary: 'Spending that bought little or nothing: fees, penalties, gambling.',
    formula: 'Waste ÷ Spending.',
    meaning:
      'Pure leakage. Most of it disappears with autopay, balance alerts and a quick subscription review.',
    benchmark: '≤ 1% of spending — ideally zero.',
  }),
  recurring: define({
    id: 'recurring',
    name: 'Recurring commitments',
    summary: 'Subscriptions, bills and memberships that charge you on a schedule.',
    formula:
      'Merchants charged at a steady interval (weekly to yearly) with a steady amount, still active at the end of your data, converted to a monthly equivalent at the latest price.',
    meaning:
      'Fixed costs you signed up for once and keep paying automatically. Small ones add up and are easy to forget.',
    benchmark: 'Review them every few months and cancel what you no longer use.',
  }),
  dayToDay: define({
    id: 'dayToDay',
    name: 'Day-to-day spending',
    summary: 'Spending on everything except recurring bills and subscriptions.',
    formula:
      'Spending minus the merchants detected as recurring commitments (rent, utilities, loan instalments, insurance, subscriptions).',
    meaning:
      'The part of your spending you steer week by week: groceries, dining, shopping, fuel and one-off purchases. Weekly comparisons use it because bills land in whichever week they are due.',
    benchmark: '',
  }),
  emergencyFund: define({
    id: 'emergencyFund',
    name: 'Emergency fund target',
    summary: 'The cash cushion to cover essentials if income stops.',
    formula: 'Average monthly Must-have spending × 3 to × 6.',
    meaning:
      'Keeps a job loss, repair or medical bill from turning into debt. Hold it in an easy-access savings account.',
    benchmark: '3–6 months of essentials; 6+ if your income is irregular or you support others.',
  }),
  burnRate: define({
    id: 'burnRate',
    name: 'Monthly burn rate',
    summary: 'What your lifestyle costs per month.',
    formula: 'Average monthly Spending over the health-score months.',
    meaning:
      'The number to plan around: runway, emergency fund and retirement targets all start here.',
    benchmark: '',
  }),
  dailySpending: define({
    id: 'dailySpending',
    name: 'Average daily spending',
    summary: 'Spending spread over each day of the period.',
    formula: 'Spending ÷ days of the period covered by your data.',
    meaning: 'A pace gauge: easy to compare across weeks and months of different lengths.',
    benchmark: '',
  }),
  consistency: define({
    id: 'consistency',
    name: 'Months in surplus',
    summary: 'How often income covered spending.',
    formula: 'Months in which Income exceeded Spending ÷ months considered.',
    meaning:
      'Consistency matters as much as the average: one expensive month can undo two good ones.',
    benchmark: 'Every month.',
  }),
  healthScore: define({
    id: 'healthScore',
    name: 'Financial health score',
    summary: 'A 0–100 summary of six standard ratios.',
    formula:
      'Savings rate (30 pts, full at ≥ 20%), essentials ratio (20, full at ≤ 50%), lifestyle ratio (15, full at ≤ 30%), avoidable costs (10, full at ≤ 1%), loan payments (10, full at ≤ 10%) and months in surplus (15). Points scale linearly between the benchmark and its limit. Computed on your last three complete months — or every complete month of a selected quarter or year — so pay timing within a month cannot swing it.',
    meaning:
      'A quick read on balance and resilience, not a credit score. Use the breakdown to see which lever moves it most.',
    benchmark:
      '90+ excellent · 80–89 good · 70–79 fair · 60–69 needs attention · under 60 at risk.',
  }),
};
