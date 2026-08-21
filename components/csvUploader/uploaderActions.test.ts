import { describe, expect, it, vi } from 'vitest';
import { selectFileWith } from './uploaderActions';
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
  });
});
