import { describe, expect, it } from 'vitest';
import { autoDetectMapping, detectBankFormat } from './csvParser';

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
