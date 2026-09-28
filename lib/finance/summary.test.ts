import { describe, expect, it } from 'vitest';
import { Transaction, TransactionCategory as C } from '../../types';
import { bucketOf, buildLedger, entriesBetween, merchantKey, merchantLabel } from './ledger';
import { periodContaining } from './periods';
import { aggregate, summarizePeriod } from './summary';

let seq = 0;
const tx = (
  date: string,
  description: string,
  amount: number,
  category: string,
  subCategory?: string,
  extra: Partial<Transaction> = {}
): Transaction => ({
  id: `t${++seq}`,
  date,
  description,
  amount,
  category: category as C,
  subCategory,
  confidence: 0.9,
  isApproved: true,
  ...extra,
});

describe('ledger', () => {
  it('maps every category to a bucket, unknown strings to unclassified', () => {
    expect(bucketOf(C.Income)).toBe('income');
    expect(bucketOf(C.MustHave)).toBe('needs');
    expect(bucketOf(C.NiceToHave)).toBe('wants');
    expect(bucketOf(C.Waste)).toBe('waste');
    expect(bucketOf(C.Save)).toBe('saving');
    expect(bucketOf(C.Invest)).toBe('investing');
    expect(bucketOf(C.InternalTransfer)).toBe('transfer');
    expect(bucketOf(C.Uncategorized)).toBe('unclassified');
    expect(bucketOf('Food')).toBe('unclassified');
  });

  it('derives stable merchant keys from noisy descriptions', () => {
    expect(merchantKey('NETFLIX.COM')).toBe('NETFLIX');
    expect(merchantKey('STARBUCKS STORE 12342')).toBe('STARBUCKS STORE');
    expect(merchantKey('UBER TRIP 23424')).toBe('UBER TRIP');
    expect(merchantKey('UBER EATS')).toBe('UBER EATS');
    expect(merchantKey('POS DEBIT PURCHASE TRADER JOES #123')).toBe('TRADER JOES');
    expect(merchantKey('PAYPAL *SPOTIFY')).toBe('SPOTIFY');
    expect(merchantKey('ONLINE PAYMENT')).toBe('ONLINE PAYMENT');
    expect(merchantKey('12345')).toBe('12345');
    expect(merchantLabel('LANDLORD RENT')).toBe('Landlord Rent');
    expect(merchantLabel('CVS PHARMACY')).toBe('CVS Pharmacy');
  });

  it('sorts by date, sets bounds and sets aside undated rows', () => {
    const ledger = buildLedger([
      tx('2026-03-10', 'B', -1, C.NiceToHave),
      tx('03/27/2026', 'raw bank date', -1, C.NiceToHave),
      tx('2026-02-30', 'impossible', -1, C.NiceToHave),
      tx('2026-03-02', 'A', -12.34, C.NiceToHave),
    ]);
    expect(ledger.entries.map((e) => e.tx.description)).toEqual(['A', 'B']);
    expect(ledger.entries[0].cents).toBe(-1234);
    expect(ledger.undated).toHaveLength(2);
    expect(ledger.bounds).toEqual({ first: '2026-03-02', last: '2026-03-10' });
    expect(entriesBetween(ledger, '2026-03-02', '2026-03-02')).toHaveLength(1);
    expect(entriesBetween(ledger, '2026-03-03', '2026-03-09')).toHaveLength(0);
  });
});

describe('summarizePeriod — flows are net, transfers excluded', () => {
  const march = [
    tx('2026-03-01', 'ACME PAYROLL', 5000, C.Income, 'Salary'),
    tx('2026-03-03', 'STORE REFUND', 20, C.Income, 'Refunds & Reimbursements'),
    tx('2026-03-01', 'LANDLORD RENT', -1500, C.MustHave, 'Housing'),
    tx('2026-03-05', 'WHOLE FOODS', -400, C.MustHave, 'Food & Groceries'),
    tx('2026-03-06', 'AUTO LOAN', -300, C.MustHave, 'Debt Payments'),
    tx('2026-03-07', 'CHIPOTLE', -250, C.NiceToHave, 'Dining Out'),
    tx('2026-03-08', 'AMAZON', -200, C.NiceToHave, 'Shopping'),
    tx('2026-03-20', 'AMAZON', 50, C.NiceToHave, 'Shopping'), // refund
    tx('2026-03-09', 'LATE FEE', -35, C.Waste, 'Late Fees & Penalties'),
    tx('2026-03-10', 'SAVINGS TRANSFER', -500, C.Save, 'Emergency Fund'),
    tx('2026-03-25', 'SAVINGS TRANSFER', 100, C.Save, 'Emergency Fund'), // withdrawal
    tx('2026-03-11', 'VANGUARD', -300, C.Invest, 'Stock Market'),
    tx('2026-03-12', 'CARD PAYMENT', -1000, C.InternalTransfer, 'Credit Card Payment'),
    tx('2026-03-12', 'TRANSFER FROM CHECKING', 1000, C.InternalTransfer, 'Account to Account'),
    tx('2026-03-15', 'MYSTERY CHARGE', -60, C.Uncategorized, undefined, {
      isApproved: false,
      confidence: 0,
    }),
    tx('2026-03-31', 'MYSTERY CREDIT', 40, C.Uncategorized, undefined, {
      isApproved: false,
      confidence: 0,
    }),
    tx('2026-03-14', 'CORNER SHOP', -0.01, C.NiceToHave, 'Shopping', {
      isApproved: false,
      confidence: 0.3,
    }),
  ];
  const summary = summarizePeriod(buildLedger(march), periodContaining('month', '2026-03-01'));
  const t = summary.totals;

  it('computes income, spending, savings and cash flow', () => {
    expect(t.income).toBe(5020);
    expect(t.needs).toBe(2200);
    expect(t.housing).toBe(1500);
    expect(t.debtPayments).toBe(300);
    expect(t.wants).toBe(400.01); // 250 + 200 − 50 refund + 0.01
    expect(t.waste).toBe(35);
    expect(t.unclassified).toBe(60); // uncategorized money-in is not income
    expect(t.spending).toBe(2695.01);
    expect(t.saving).toBe(400); // 500 in − 100 withdrawn
    expect(t.investing).toBe(300);
    expect(t.setAside).toBe(700);
    expect(t.netCashFlow).toBe(2324.99);
    expect(t.unallocated).toBe(1624.99);
  });

  it('derives the standard ratios from those flows', () => {
    const r = summary.ratios;
    expect(r.savingsRate).toBeCloseTo(2324.99 / 5020, 10);
    expect(r.setAsideRate).toBeCloseTo(700 / 5020, 10);
    expect(r.needsRatio).toBeCloseTo(2200 / 5020, 10);
    expect(r.wantsRatio).toBeCloseTo(435.01 / 5020, 10);
    expect(r.housingRatio).toBeCloseTo(1500 / 5020, 10);
    expect(r.debtServiceRatio).toBeCloseTo(300 / 5020, 10);
    expect(r.avoidableShare).toBeCloseTo(35 / 2695.01, 10);
  });

  it('breaks spending down by category, subcategory and merchant', () => {
    expect(summary.categories.map((c) => [c.label, c.amount, c.count])).toEqual([
      [C.MustHave, 2200, 3],
      [C.NiceToHave, 400.01, 3],
      [C.Uncategorized, 60, 1],
      [C.Waste, 35, 1],
    ]);
    expect(summary.subCategories.map((s) => [s.key, s.amount])).toEqual([
      ['Must-have|Housing', 1500],
      ['Must-have|Food & Groceries', 400],
      ['Must-have|Debt Payments', 300],
      ['Nice-to-have|Dining Out', 250],
      ['Nice-to-have|Shopping', 150.01],
      ['Uncategorized|', 60],
      ['Waste|Late Fees & Penalties', 35],
    ]);
    expect(summary.merchants.map((m) => [m.label, m.amount, m.count])).toEqual([
      ['Landlord Rent', 1500, 1],
      ['Whole Foods', 400, 1],
      ['Auto Loan', 300, 1],
      ['Chipotle', 250, 1],
      ['Amazon', 150, 1],
      ['Mystery Charge', 60, 1],
      ['Late Fee', 35, 1],
      ['Corner Shop', 0.01, 1],
    ]);
  });

  it('reports data quality and coverage', () => {
    expect(summary.quality).toMatchObject({
      transactionCount: 17,
      uncategorizedCount: 2,
      uncategorizedOutflow: 60,
      needsReviewCount: 1,
      unverifiedCount: 3,
    });
    // Share of all money out except internal transfers (3,545.01).
    expect(summary.quality.uncategorizedShare).toBeCloseTo(60 / 3545.01, 12);
    expect(summary.coverage.isComplete).toBe(true);
    expect(summary.months).toBe(1);
    expect(summary.avgDailySpending).toBe(86.94); // 2695.01 / 31
  });

  it('returns null income ratios without income', () => {
    const agg = aggregate(buildLedger([tx('2026-03-01', 'X', -10, C.NiceToHave)]).entries);
    expect(agg.ratios.savingsRate).toBeNull();
    expect(agg.ratios.avoidableShare).toBe(0);
  });

  it('treats an unknown category string as uncategorized spending', () => {
    const agg = aggregate(buildLedger([tx('2026-03-01', 'X', -10, 'Food')]).entries);
    expect(agg.totals.unclassified).toBe(10);
    expect(agg.categories[0].category).toBe(C.Uncategorized);
  });
});
