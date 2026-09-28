import { describe, expect, it } from 'vitest';
import { Transaction, TransactionCategory as C } from '../../types';
import { buildLedger } from './ledger';
import { detectRecurring, totalRecurring } from './recurring';

let seq = 0;
const tx = (
  date: string,
  description: string,
  amount: number,
  category: C = C.NiceToHave,
  subCategory?: string
): Transaction => ({
  id: `r${++seq}`,
  date,
  description,
  amount,
  category,
  subCategory,
  confidence: 1,
});

const detect = (txs: Transaction[], asOf = '2026-04-20') => detectRecurring(buildLedger(txs), asOf);

describe('detectRecurring', () => {
  it('finds a monthly subscription and prices it at the latest charge', () => {
    const [netflix] = detect([
      tx('2026-01-05', 'NETFLIX.COM', -15.99, C.NiceToHave, 'Entertainment'),
      tx('2026-02-05', 'NETFLIX.COM', -15.99, C.NiceToHave, 'Entertainment'),
      tx('2026-03-05', 'NETFLIX.COM', -15.99, C.NiceToHave, 'Entertainment'),
      tx('2026-04-05', 'NETFLIX.COM', -17.99, C.NiceToHave, 'Entertainment'),
    ]);
    expect(netflix).toMatchObject({
      merchant: 'Netflix',
      cadence: 'monthly',
      occurrences: 4,
      lastAmount: 17.99,
      averageAmount: 16.49,
      monthlyEquivalent: 17.99,
      annualCost: 215.88,
      firstDate: '2026-01-05',
      lastDate: '2026-04-05',
      nextExpected: '2026-05-06', // median gap 31 days
      category: C.NiceToHave,
      subCategory: 'Entertainment',
    });
  });

  it('finds yearly charges from two identical payments', () => {
    const [annual] = detect(
      [tx('2025-03-10', 'DOMAIN RENEWAL', -99), tx('2026-03-12', 'DOMAIN RENEWAL', -99)],
      '2026-05-20'
    );
    expect(annual).toMatchObject({ cadence: 'yearly', monthlyEquivalent: 8.25, annualCost: 99 });
  });

  it('merges same-day charges into one billing event', () => {
    const [bill] = detect(
      ['01', '02', '03'].flatMap((m) => [
        tx(`2026-${m}-10`, 'STREAMING CO', -10),
        tx(`2026-${m}-10`, 'STREAMING CO', -10),
      ])
    );
    expect(bill).toMatchObject({ occurrences: 3, lastAmount: 20 });
  });

  it('ignores irregular amounts, lapsed charges, short histories, income and transfers', () => {
    const weeklyGroceries = [40, 120, 65, 95, 30].map((amount, i) =>
      tx(`2026-03-${String(2 + i * 7).padStart(2, '0')}`, 'TRADER JOES', -amount, C.MustHave)
    );
    const lapsed = ['01', '02', '03'].map((m) => tx(`2025-${m}-05`, 'OLD GYM', -40));
    const tooFew = ['02', '03'].map((m) => tx(`2026-${m}-07`, 'NEW APP', -5));
    const payroll = ['01-02', '01-16', '01-30', '02-13', '02-27'].map((d) =>
      tx(`2026-${d}`, 'GUSTO PAYROLL', 2850, C.Income)
    );
    const transfers = ['01', '02', '03'].map((m) =>
      tx(`2026-${m}-20`, 'CARD PAYMENT', -500, C.InternalTransfer)
    );
    expect(detect([...weeklyGroceries, ...lapsed, ...tooFew, ...payroll, ...transfers])).toEqual(
      []
    );
  });

  it('does not treat regular grocery or restaurant visits as commitments', () => {
    const sameShopMonthly = ['01', '02', '03', '04'].map((m) =>
      tx(`2026-${m}-06`, 'TRADER JOES', -95, C.MustHave, 'Food & Groceries')
    );
    const sameCafeWeekly = ['03-02', '03-09', '03-16', '03-23', '03-30'].map((d) =>
      tx(`2026-${d}`, 'BLUE BOTTLE', -6, C.NiceToHave, 'Dining Out')
    );
    expect(detect([...sameShopMonthly, ...sameCafeWeekly])).toEqual([]);
  });

  it('sorts by monthly cost and totals the commitments', () => {
    const charges = detect([
      ...['01', '02', '03', '04'].map((m) =>
        tx(`2026-${m}-01`, 'LANDLORD RENT', -1400, C.MustHave)
      ),
      ...['01', '02', '03', '04'].map((m) => tx(`2026-${m}-07`, 'SPOTIFY USA', -11.99)),
    ]);
    expect(charges.map((c) => c.merchant)).toEqual(['Landlord Rent', 'Spotify']);
    expect(totalRecurring(charges)).toEqual({ count: 2, monthly: 1411.99, annual: 16943.88 });
  });
});
