import { Transaction, TransactionCategory as C } from '../../types';

let seq = 0;

/** Test transaction factory (approved, full confidence unless overridden). */
export const makeTx = (
  date: string,
  description: string,
  amount: number,
  category: C,
  subCategory?: string,
  extra: Partial<Transaction> = {}
): Transaction => ({
  id: `f${++seq}`,
  date,
  description,
  amount,
  category,
  subCategory,
  confidence: 1,
  isApproved: true,
  ...extra,
});

/**
 * One month of a household: $4,000 pay, $2,400 essentials (rent 1,400, loan
 * 400, groceries 600 in two trips), $80 late fee, and a variable lifestyle
 * split between dining and shopping (shopping lands on the month's last day
 * so the data covers every month in full).
 */
export const householdMonth = (
  ym: string,
  lastDay: number,
  dining: number,
  shopping: number
): Transaction[] => [
  makeTx(`${ym}-01`, 'ACME PAYROLL', 4000, C.Income, 'Salary'),
  makeTx(`${ym}-01`, 'LANDLORD RENT', -1400, C.MustHave, 'Housing'),
  makeTx(`${ym}-05`, 'AUTO LOAN', -400, C.MustHave, 'Debt Payments'),
  makeTx(`${ym}-10`, 'WHOLE FOODS', -350, C.MustHave, 'Food & Groceries'),
  makeTx(`${ym}-24`, 'WHOLE FOODS', -250, C.MustHave, 'Food & Groceries'),
  makeTx(`${ym}-12`, 'LATE FEE', -80, C.Waste, 'Late Fees & Penalties'),
  makeTx(`${ym}-15`, 'RESTAURANTS', -dining, C.NiceToHave, 'Dining Out'),
  makeTx(`${ym}-${lastDay}`, 'DEPARTMENT STORE', -shopping, C.NiceToHave, 'Shopping'),
];

/** Feb overspends (−$300); Mar and Apr each keep $750. */
export const householdQuarter = (): Transaction[] => [
  ...householdMonth('2026-02', 28, 1200, 620),
  ...householdMonth('2026-03', 31, 500, 270),
  ...householdMonth('2026-04', 30, 500, 270),
];

export const usd = (amount: number): string => `$${amount.toFixed(2)}`;
