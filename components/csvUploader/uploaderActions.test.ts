import { describe, expect, it, vi } from 'vitest';
import { resetWith, resolveMapping, selectFileWith } from './uploaderActions';
import type { UploaderStateBundle } from './useCSVUploader';

vi.mock('../../lib/csvParser', () => ({
  getCSVHeaders: vi
    .fn()
    .mockResolvedValue({ headers: ['Date', 'Description', 'Amount'], delimiter: ',' }),
  detectBankFormat: vi.fn().mockReturnValue(null),
  parseCSVWithMapping: vi.fn(),
  autoDetectMapping: vi.fn().mockReturnValue({
    dateCol: 'Date',
    descCol: 'Description',
    amountCol: 'Amount',
    categoryCol: '',
    hasHeader: true,
    delimiter: ',',
  }),
}));

const makeBundle = () => {
  const bundle = {
    setState: vi.fn(),
    setError: vi.fn(),
    setFile: vi.fn(),
    setHeaders: vi.fn(),
    setMapping: vi.fn(),
    setMappingAutoDetected: vi.fn(),
    setMappingPreview: vi.fn(),
    setStagedTransactions: vi.fn(),
    setDuplicateTransactions: vi.fn(),
    setCurrentPage: vi.fn(),
    setActiveTab: vi.fn(),
    setSelectedDuplicate: vi.fn(),
    setDragActive: vi.fn(),
    setRejectedCount: vi.fn(),
  };
  return { bundle, cast: bundle as unknown as UploaderStateBundle };
};

describe('selectFileWith file-type guard (issue #37, F-BUG-011)', () => {
  it('rejects an .xlsx workbook with a clear error before any parsing', async () => {
    const { bundle, cast } = makeBundle();
    const processFile = vi.fn();
    const xlsx = new File(['binary'], 'statement.xlsx', {
      type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
    });

    await selectFileWith(cast, processFile)(xlsx);

    expect(bundle.setError).toHaveBeenCalledWith(
      'Only .csv files are supported. Please export your statement as CSV.'
    );
    expect(bundle.setFile).not.toHaveBeenCalled();
    expect(processFile).not.toHaveBeenCalled();
  });

  it('lets a .csv file through to the normal size check', async () => {
    const { bundle, cast } = makeBundle();
    const processFile = vi.fn();
    const csv = new File(['Date,Description,Amount'], 'statement.csv', { type: 'text/csv' });

    await selectFileWith(cast, processFile)(csv);

    expect(bundle.setError).not.toHaveBeenCalledWith(
      'Only .csv files are supported. Please export your statement as CSV.'
    );
    expect(bundle.setFile).toHaveBeenCalledWith(csv);
    expect(bundle.setMappingAutoDetected).toHaveBeenCalledWith(true);
  });
});

describe('resolveMapping detection outcome (issue #41, F-UX-005)', () => {
  it('flags a strict bank-format detection as auto-detected', () => {
    const { autoDetected, mapping } = resolveMapping(
      { dateCol: 'Posting Date', descCol: 'Description', amountCol: 'Amount' },
      ['Posting Date', 'Description', 'Amount'],
      ','
    );

    expect(autoDetected).toBe(true);
    expect(mapping.dateCol).toBe('Posting Date');
    expect(mapping.hasHeader).toBe(true);
  });

  it('flags smart header detection as auto-detected', () => {
    const { autoDetected, mapping } = resolveMapping(null, ['Date', 'Description', 'Amount'], ',');

    expect(autoDetected).toBe(true);
    expect(mapping).toEqual({
      dateCol: 'Date',
      descCol: 'Description',
      amountCol: 'Amount',
      categoryCol: '',
      hasHeader: true,
      delimiter: ',',
    });
  });

  it('flags the positional fallback as NOT auto-detected', async () => {
    const { autoDetectMapping } = await import('../../lib/csvParser');
    vi.mocked(autoDetectMapping).mockReturnValueOnce({
      dateCol: '',
      descCol: '',
      amountCol: '',
      categoryCol: '',
      hasHeader: true,
      delimiter: ',',
    });

    const { autoDetected, mapping } = resolveMapping(null, ['A', 'B', 'C'], ';');

    expect(autoDetected).toBe(false);
    expect(mapping.dateCol).toBe('A');
    expect(mapping.descCol).toBe('B');
    expect(mapping.amountCol).toBe('C');
    expect(mapping.delimiter).toBe(';');
  });
});

describe('resetWith clears detection state', () => {
  it('resets the auto-detected flag alongside the mapping', () => {
    const { bundle, cast } = makeBundle();

    resetWith(cast)();

    expect(bundle.setMappingAutoDetected).toHaveBeenCalledWith(false);
    expect(bundle.setMappingPreview).toHaveBeenCalledWith([]);
  });
});
