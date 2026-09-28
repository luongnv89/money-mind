import { describe, expect, it } from 'vitest';
import { Transaction, TransactionCategory as C } from '../../types';
import { householdMonth, householdQuarter, makeTx, usd } from './fixtures.test-util';
import { buildLedger } from './ledger';
import { buildFinanceModel } from './model';
import { periodContaining } from './periods';

const modelFor = (txs: Transaction[], iso: string, granularity: 'month' | 'week' = 'month') =>
  buildFinanceModel(buildLedger(txs), periodContaining(granularity, iso), usd);

const find = (model: ReturnType<typeof modelFor>, id: string) =>
  model.insights.find((i) => i.id === id);

describe('buildInsights — deterministic, prioritized advice', () => {
  const april = modelFor(householdQuarter(), '2026-04-01');

  it('orders findings by severity, then money at stake, then id', () => {
    expect(april.insights.map((i) => i.id)).toEqual([
      'housing-high',
      'needs-high',
      'savings-rate',
      'avoidable-costs',
      'emergency-fund',
      'recurring',
      'spending-down',
    ]);
  });

  it('quantifies ratio advice per month on the score window', () => {
    expect(find(april, 'savings-rate')).toMatchObject({
      severity: 'opportunity',
      title: 'Free up $400.00 a month to reach a 20% savings rate',
      impact: { amount: 400, per: 'month' },
      metric: 'savingsRate',
    });
    expect(find(april, 'savings-rate')!.detail).toContain(
      'Over Feb – Apr 2026 you kept 10% of your income.'
    );
    expect(find(april, 'needs-high')).toMatchObject({
      title: 'Essentials take 60% of income',
      impact: { amount: 400, per: 'month' },
    });
    expect(find(april, 'housing-high')).toMatchObject({
      severity: 'warning',
      title: 'Housing costs are 35% of income',
      impact: { amount: 200, per: 'month' },
    });
  });

  it('reports period-specific costs, trends, commitments and targets', () => {
    expect(find(april, 'avoidable-costs')).toMatchObject({
      title: '$80.00 went to avoidable costs',
      impact: { amount: 80, per: 'month' },
    });
    expect(find(april, 'avoidable-costs')!.detail).toContain('mostly Late Fees & Penalties');
    // April 3,250 vs the Feb–Mar average (4,300 + 3,250) / 2 = 3,775.
    expect(find(april, 'spending-down')).toMatchObject({
      title: 'Spending is 14% below your 2-month avg',
      detail:
        '$3250.00 vs $3775.00 (2-month avg). Moving the difference to savings locks the gain in.',
    });
    expect(find(april, 'recurring')).toMatchObject({
      title: '3 recurring charges cost $1880.00 a month',
    });
    expect(find(april, 'recurring')!.detail).toContain('One is discretionary');
    expect(find(april, 'emergency-fund')).toMatchObject({
      title: 'Emergency fund target: $7200.00–$14400.00',
    });
  });

  it('flags an overspent month once, without repeating it for the same window', () => {
    const feb = modelFor(householdQuarter(), '2026-02-01');
    expect(find(feb, 'cash-flow-negative')).toMatchObject({
      severity: 'critical',
      title: 'You spent $300.00 more than you earned',
      impact: { amount: 300, per: 'month' },
    });
    expect(find(feb, 'cash-flow-negative')!.detail).toContain(
      'Dining Out ($1200.00) and Shopping ($620.00)'
    );
    expect(find(feb, 'window-overspending')).toBeUndefined();
    expect(find(feb, 'wants-high')?.severity).toBe('warning');
  });

  it('softens a negative month that is still in progress', () => {
    const txs = [
      ...householdQuarter(),
      makeTx('2026-05-01', 'LANDLORD RENT', -1400, C.MustHave, 'Housing'),
      makeTx('2026-05-02', 'SIDE GIG', 500, C.Income, 'Side Hustle'),
      makeTx('2026-05-03', 'COFFEE', -5, C.NiceToHave, 'Dining Out'),
    ];
    const may = modelFor(txs, '2026-05-01');
    expect(find(may, 'cash-flow-negative')).toMatchObject({
      severity: 'warning',
      title: 'Spending is $905.00 ahead of income so far',
      // 3 days of data: reported as-is, never extrapolated to a month.
      impact: { amount: 905, per: 'period' },
    });
    expect(find(may, 'cash-flow-negative')!.detail).toContain('through May 3, 2026');
  });

  it('asks for categorization when uncategorized money out is material', () => {
    const txs = [
      ...householdQuarter(),
      makeTx('2026-04-18', 'UNKNOWN 0042', -3000, C.Uncategorized, undefined, {
        isApproved: false,
        confidence: 0,
      }),
    ];
    expect(find(modelFor(txs, '2026-04-01'), 'data-quality')).toMatchObject({
      severity: 'critical',
      title: 'Categorize 1 transaction',
      action: 'categorize',
    });
  });

  it('calls out a spending rise and names its drivers', () => {
    const base = (ym: string, dining: number) => [
      makeTx(`${ym}-01`, 'PAY', 5000, C.Income, 'Salary'),
      makeTx(`${ym}-01`, 'RENT', -1000, C.MustHave, 'Housing'),
      makeTx(`${ym}-10`, 'MARKET', -500, C.MustHave, 'Food & Groceries'),
      makeTx(`${ym}-28`, 'BISTRO', -dining, C.NiceToHave, 'Dining Out'),
    ];
    const history = [...base('2026-01', 100), ...base('2026-02', 100), ...base('2026-03', 100)];
    // Ensure April is complete (data through Apr 30).
    const up = modelFor(
      [...history, ...base('2026-04', 400), makeTx('2026-04-30', 'PAY', 1, C.Income)],
      '2026-04-01'
    );
    expect(find(up, 'spending-up')).toMatchObject({
      title: 'Spending is 19% above your 3-month avg',
      detail: '$1900.00 vs $1600.00 (3-month avg). The biggest increases: Dining Out (+$300.00).',
    });

    const spike = modelFor(
      [...history, ...base('2026-04', 200), makeTx('2026-04-30', 'PAY', 1, C.Income)],
      '2026-04-01'
    );
    expect(find(spike, 'spending-up')).toBeUndefined();
    expect(find(spike, 'spike:Nice-to-have|Dining Out')).toMatchObject({
      title: 'Dining Out is up 100%',
      detail: '$200.00 vs $100.00 (3-month avg).',
    });
  });

  it('names a material category that is new this period', () => {
    const base = (ym: string) => [
      makeTx(`${ym}-01`, 'PAY', 5000, C.Income, 'Salary'),
      makeTx(`${ym}-01`, 'RENT', -1000, C.MustHave, 'Housing'),
      makeTx(`${ym}-10`, 'MARKET', -500, C.MustHave, 'Food & Groceries'),
      makeTx(`${ym}-28`, 'BISTRO', -100, C.NiceToHave, 'Dining Out'),
    ];
    const history = [...base('2026-01'), ...base('2026-02'), ...base('2026-03')];
    const withGadget = (amount: number) =>
      modelFor(
        [
          ...history,
          ...base('2026-04'),
          makeTx('2026-04-12', 'GADGET STORE', -amount, C.NiceToHave, 'Technology'),
          makeTx('2026-04-30', 'PAY', 1, C.Income),
        ],
        '2026-04-01'
      );

    // 150 of 1,600 baseline spending: under the +15% total threshold, over 5%.
    expect(find(withGadget(150), 'new:Nice-to-have|Technology')).toMatchObject({
      severity: 'info',
      title: 'New spending: Technology',
      detail:
        '$150.00 in April 2026; nothing was spent on it in the comparison period (3-month avg).',
      impact: { amount: 150, per: 'month' },
    });
    // 300 pushes the total up 19%: it becomes a named driver instead.
    expect(find(withGadget(300), 'spending-up')?.detail).toBe(
      '$1900.00 vs $1600.00 (3-month avg). The biggest increases: Technology ($300.00, new).'
    );
  });

  it('compares weeks on day-to-day spending so a rent week is not a spike', () => {
    const sundays = ['03-08', '03-15', '03-22', '03-29', '04-05', '04-12', '04-19', '04-26'];
    const history = [
      ...['03-02', '04-01'].map((d) => makeTx(`2026-${d}`, 'RENT', -1000, C.MustHave, 'Housing')),
      ...sundays.map((d) => makeTx(`2026-${d}`, 'BISTRO', -50, C.NiceToHave, 'Dining Out')),
      makeTx('2026-05-01', 'RENT', -1000, C.MustHave, 'Housing'),
    ];
    const rentWeek = modelFor(
      [...history, makeTx('2026-05-03', 'BISTRO', -50, C.NiceToHave, 'Dining Out')],
      '2026-05-01',
      'week'
    );
    expect(rentWeek.summary.totals.spending).toBe(1050);
    expect(find(rentWeek, 'spending-up')).toBeUndefined();
    // No pay this week is normal, not a finding.
    expect(find(rentWeek, 'no-income')).toBeUndefined();
    expect(find(rentWeek, 'cash-flow-negative')).toBeUndefined();

    const busyWeek = modelFor(
      [...history, makeTx('2026-05-03', 'BISTRO', -150, C.NiceToHave, 'Dining Out')],
      '2026-05-01',
      'week'
    );
    // Rent is a recurring commitment, so only the bistro counts as day-to-day.
    expect(busyWeek.recurring.map((c) => c.merchant)).toEqual(['Rent']);
    expect(busyWeek.dayToDay?.current.totals.spending).toBe(150);
    expect(find(busyWeek, 'spending-up')).toMatchObject({
      title: 'Day-to-day spending is 200% above your 8-week avg',
      detail:
        '$150.00 vs $50.00 (8-week avg). Bills and subscriptions are left out because they land in whichever week they are due. The biggest increases: Dining Out (+$100.00).',
      impact: { amount: 100, per: 'period' },
      metric: 'dayToDay',
    });
  });

  it('recognizes a healthy budget', () => {
    const month = (ym: string, last: number, wants: number) => [
      makeTx(`${ym}-01`, 'PAY', 5000, C.Income, 'Salary'),
      makeTx(`${ym}-01`, 'RENT', -1500, C.MustHave, 'Housing'),
      makeTx(`${ym}-${last}`, 'MARKET', -500, C.MustHave, 'Food & Groceries'),
      makeTx(`${ym}-15`, 'BISTRO', -wants, C.NiceToHave, 'Dining Out'),
    ];
    const fit = modelFor(
      [...month('2026-02', 28, 1000), ...month('2026-03', 31, 1000), ...month('2026-04', 30, 1000)],
      '2026-04-01'
    );
    expect(find(fit, 'budget-fit')?.detail).toBe(
      'Over Feb – Apr 2026: needs 40%, wants 20% and savings 40% of income.'
    );

    const heavyNeeds = (ym: string, last: number) => [
      ...month(ym, last, 500),
      makeTx(`${ym}-05`, 'INSURER', -1000, C.MustHave, 'Insurance'),
    ];
    const strong = modelFor(
      [...heavyNeeds('2026-02', 28), ...heavyNeeds('2026-03', 31), ...heavyNeeds('2026-04', 30)],
      '2026-04-01'
    );
    expect(find(strong, 'savings-strong')).toMatchObject({
      title: "You're saving 30% of your income",
    });
    expect(find(strong, 'savings-strong')!.detail).toContain(
      'About $1500.00 a month of it stays in your everyday account'
    );
  });

  it('notes missing income rather than scoring it', () => {
    const noPay = householdMonth('2026-03', 31, 100, 100).filter((t) => t.category !== C.Income);
    const march = modelFor(noPay, '2026-03-01');
    expect(find(march, 'no-income')?.title).toBe('No income recorded in March 2026');
    expect(march.score.score).toBeNull();
  });
});
