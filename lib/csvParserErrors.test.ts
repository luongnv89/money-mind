import { beforeEach, describe, expect, it, vi } from 'vitest';

// Mock Papa.parse so its `error` callback — the parser's I/O error path — can be
// exercised deterministically. A separate file because the mock is file-wide.
const parseMock = vi.fn();

vi.mock('papaparse', () => ({
  default: { parse: (...args: unknown[]) => parseMock(...args) },
}));

import { getCSVHeaders, getPreviewTransactions, parseCSVWithMapping } from './csvParser';
import { CsvMapping } from '../types';

const mapping: CsvMapping = {
  dateCol: 'Date',
  descCol: 'Description',
  amountCol: 'Amount',
  categoryCol: '',
  hasHeader: true,
  delimiter: ',',
};

const file = (contents = 'Date,Description,Amount\n2024-01-01,Coffee,-4.50\n') =>
  new File([contents], 'statement.csv', { type: 'text/csv' });

beforeEach(() => {
  parseMock.mockReset();
});

describe('CSV reader error callbacks', () => {
  it('getCSVHeaders rejects when Papa.parse errors', async () => {
    parseMock.mockImplementation((_f, config) => config.error(new Error('unreadable blob')));
    await expect(getCSVHeaders(file())).rejects.toThrow('unreadable blob');
  });

  it('getPreviewTransactions resolves to [] when Papa.parse errors', async () => {
    parseMock.mockImplementation((_f, config) => config.error(new Error('disk vanished')));
    await expect(getPreviewTransactions(file(), mapping)).resolves.toEqual([]);
  });

  it('parseCSVWithMapping rejects when Papa.parse errors', async () => {
    parseMock.mockImplementation((_f, config) => config.error(new Error('disk vanished')));
    await expect(parseCSVWithMapping(file(), mapping)).rejects.toThrow('disk vanished');
  });

  it('getPreviewTransactions resolves to [] when a row mapping throws', async () => {
    // A row whose values blow up the mapping lambda hits the defensive catch.
    parseMock.mockImplementation((_f, config) => {
      const row: Record<string, unknown> = {};
      Object.defineProperty(row, 'Date', {
        get() {
          throw new Error('poisoned cell');
        },
      });
      config.complete({ data: [row] });
    });
    await expect(getPreviewTransactions(file(), mapping)).resolves.toEqual([]);
  });
});
