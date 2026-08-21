import { describe, expect, it } from 'vitest';
import {
  autoDetectMapping,
  detectBankFormat,
  getCSVHeaders,
  getPreviewTransactions,
  parseAmount,
  parseCSVWithMapping,
} from './csvParser';
import { CsvMapping } from '../types';

const csvFile = (contents: string): File =>
  new File([contents], 'statement.csv', { type: 'text/csv' });

const mapping: CsvMapping = {
  dateCol: 'Date',
  descCol: 'Description',
  amountCol: 'Amount',
  categoryCol: '',
  hasHeader: true,
  delimiter: ',',
};

describe('parseAmount', () => {
  it('passes numbers through unchanged', () => {
    expect(parseAmount(1234.56)).toBe(1234.56);
    expect(parseAmount(-61.75)).toBe(-61.75);
    expect(parseAmount(0)).toBe(0);
  });

  it('returns 0 for empty, nullish and falsy input', () => {
    expect(parseAmount('')).toBe(0);
    expect(parseAmount(null)).toBe(0);
    expect(parseAmount(undefined)).toBe(0);
  });

  it('parses plain decimals', () => {
    expect(parseAmount('123.45')).toBe(123.45);
    expect(parseAmount('-61.75')).toBe(-61.75);
  });

  it('parses US-formatted amounts (1,234.56)', () => {
    expect(parseAmount('1,234.56')).toBe(1234.56);
    expect(parseAmount('12,345.67')).toBe(12345.67);
  });

  it('parses EU-formatted amounts (1.234,56)', () => {
    expect(parseAmount('1.234,56')).toBe(1234.56);
  });

  it('parses bare-comma decimal amounts (-61,75)', () => {
    expect(parseAmount('-61,75')).toBe(-61.75);
  });

  it('parses NBSP-separated EU amounts (1 131,98)', () => {
    expect(parseAmount('1\u00A0131,98')).toBe(1131.98);
  });

  it('parses space-separated EU amounts', () => {
    expect(parseAmount('1 131,98')).toBe(1131.98);
  });

  it('returns NaN for unparseable input', () => {
    expect(parseAmount('abc')).toBeNaN();
    expect(parseAmount('N/A')).toBeNaN();
  });
});

describe('autoDetectMapping', () => {
  it('maps exactly-named columns', () => {
    const mapping = autoDetectMapping(['Date', 'Description', 'Amount', 'Category'], ',');

    expect(mapping.dateCol).toBe('Date');
    expect(mapping.descCol).toBe('Description');
    expect(mapping.amountCol).toBe('Amount');
    expect(mapping.categoryCol).toBe('Category');
  });

  it('falls back to partial header matches', () => {
    const mapping = autoDetectMapping(['Transaction Date', 'Payee Name', 'Debit Amount'], ',');

    expect(mapping.dateCol).toBe('Transaction Date');
    expect(mapping.descCol).toBe('Payee Name');
    expect(mapping.amountCol).toBe('Debit Amount');
  });

  it('never reuses the date column as the description', () => {
    const mapping = autoDetectMapping(['Date', 'Amount'], ',');

    expect(mapping.dateCol).toBe('Date');
    expect(mapping.amountCol).toBe('Amount');
    expect(mapping.descCol).not.toBe('Date');
  });

  // Known defect: the `|| headers[1]` fallback in autoDetectMapping bypasses the
  // [dateCol, amountCol] exclusion it exists to enforce, so a header row with no
  // description-like column hands back the amount column as the description.
  // `it.fails` documents the bug and will itself start failing once it is fixed,
  // as a prompt to turn this into a plain assertion.
  it.fails('should not reuse the amount column as the description', () => {
    const mapping = autoDetectMapping(['Date', 'Amount', 'Note'], ',');

    expect(mapping.descCol).not.toBe('Amount');
  });

  it('recognises non-English description headers', () => {
    const mapping = autoDetectMapping(['Date', 'Libelle', 'Montant'], ';');
    expect(mapping.descCol).toBe('Libelle');
  });
});

describe('detectBankFormat', () => {
  it('detects a known bank layout', () => {
    const detected = detectBankFormat(['Transaction Date', 'Description', 'Amount', 'Category']);

    expect(detected).not.toBeNull();
    expect(detected?.dateCol).toBe('Transaction Date');
    expect(detected?.descCol).toBe('Description');
  });

  it('returns null for unrecognised headers', () => {
    expect(detectBankFormat(['foo', 'bar', 'baz'])).toBeNull();
  });
});

describe('getCSVHeaders', () => {
  it('rejects an empty CSV file with a descriptive error', async () => {
    await expect(getCSVHeaders(csvFile(''))).rejects.toThrow(/empty or unreadable/i);
  });

  it('resolves headers for a headers-only CSV file', async () => {
    await expect(getCSVHeaders(csvFile('Date,Description,Amount\n'))).resolves.toEqual({
      headers: ['Date', 'Description', 'Amount'],
      delimiter: ',',
    });
  });
});

describe('parseCSVWithMapping', () => {
  it('rejects a headers-only CSV file with no data rows', async () => {
    await expect(
      parseCSVWithMapping(csvFile('Date,Description,Amount\n'), mapping)
    ).rejects.toThrow(/No data found/i);
  });

  it('rejects rows with unparseable amounts with a reason', async () => {
    const { accepted, rejected } = await parseCSVWithMapping(
      csvFile('Date,Description,Amount\n2024-01-01,Coffee,abc\n2024-01-02,Lunch,def\n'),
      mapping
    );

    expect(accepted).toHaveLength(0);
    expect(rejected).toHaveLength(2);
    expect(rejected.map((r) => r.reason)).toEqual([
      'Unparseable amount: "abc"',
      'Unparseable amount: "def"',
    ]);
  });

  it('preserves a genuine zero-amount row', async () => {
    const { accepted, rejected } = await parseCSVWithMapping(
      csvFile('Date,Description,Amount\n2024-01-01,Refund,0\n'),
      mapping
    );

    expect(accepted).toHaveLength(1);
    expect(accepted[0].amount).toBe(0);
    expect(rejected).toHaveLength(0);
  });

  it('rejects a row with a blank amount cell as unparseable', async () => {
    const { accepted, rejected } = await parseCSVWithMapping(
      csvFile('Date,Description,Amount\n2024-01-01,Coffee,\n'),
      mapping
    );

    expect(accepted).toHaveLength(0);
    expect(rejected).toHaveLength(1);
    expect(rejected[0].reason).toBe('Unparseable amount: ""');
  });

  it('rejects a row missing the amount column as unparseable', async () => {
    const { accepted, rejected } = await parseCSVWithMapping(
      csvFile('Date,Description,Amount\n2024-01-01,Coffee\n'),
      mapping
    );

    expect(accepted).toHaveLength(0);
    expect(rejected).toHaveLength(1);
    expect(rejected[0].reason).toBe('Unparseable amount: ""');
  });

  it('rejects rows with an empty description', async () => {
    const { accepted, rejected } = await parseCSVWithMapping(
      csvFile('Date,Description,Amount\n2024-01-01,,5.00\n'),
      mapping
    );

    expect(accepted).toHaveLength(0);
    expect(rejected).toHaveLength(1);
    expect(rejected[0].reason).toBe('Empty description');
  });
});

describe('Citi split debit/credit columns', () => {
  const citiMapping: CsvMapping = {
    ...mapping,
    amountCol: '',
    debitCreditCols: true,
    debitCol: 'Debit',
    creditCol: 'Credit',
  };
  const citiCsv =
    'Date,Description,Debit,Credit\n' +
    '2024-01-01,Groceries,54.20,\n' +
    '2024-01-02,Salary Deposit,,2500.00\n' +
    '2024-01-03,Coffee Shop,5.75,\n' +
    '2024-01-04,Refund,,12.30\n';

  it('detects the Citi layout from its headers', () => {
    const detected = detectBankFormat(['Date', 'Description', 'Debit', 'Credit']);

    expect(detected).not.toBeNull();
    expect(detected?.debitCreditCols).toBe(true);
    expect(detected?.debitCol).toBe('Debit');
    expect(detected?.creditCol).toBe('Credit');
  });

  it('still detects single-column bank layouts', () => {
    const detected = detectBankFormat(['Transaction Date', 'Description', 'Amount', 'Category']);

    expect(detected).not.toBeNull();
    expect(detected?.debitCreditCols).toBeUndefined();
  });

  it('combines debit and credit into signed amounts with correct row count', async () => {
    const { accepted, rejected } = await parseCSVWithMapping(csvFile(citiCsv), citiMapping);

    expect(accepted).toHaveLength(4);
    expect(rejected).toHaveLength(0);
    expect(accepted.map((t) => t.amount)).toEqual([-54.2, 2500, -5.75, 12.3]);
  });

  it('rejects a row where both debit and credit are blank', async () => {
    const { accepted, rejected } = await parseCSVWithMapping(
      csvFile('Date,Description,Debit,Credit\n2024-01-01,Mystery,,\n'),
      citiMapping
    );

    expect(accepted).toHaveLength(0);
    expect(rejected).toHaveLength(1);
    expect(rejected[0].reason).toBe('Unparseable amount: ""');
  });

  it('rejects a row with an unparseable split value', async () => {
    const { accepted, rejected } = await parseCSVWithMapping(
      csvFile('Date,Description,Debit,Credit\n2024-01-01,Bad Row,abc,\n'),
      citiMapping
    );

    expect(accepted).toHaveLength(0);
    expect(rejected).toHaveLength(1);
    expect(rejected[0].reason).toBe('Unparseable amount: "abc"');
  });

  it('previews split-column rows with signed amounts', async () => {
    const preview = await getPreviewTransactions(csvFile(citiCsv), citiMapping);

    expect(preview).toHaveLength(4);
    expect(preview.map((t) => t.amount)).toEqual([-54.2, 2500, -5.75, 12.3]);
  });
});
