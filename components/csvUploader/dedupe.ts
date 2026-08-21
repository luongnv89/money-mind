import { Transaction } from '../../types';

/** Extended type for internal use in the uploader flow. */
export type DuplicateTransaction = Transaction & {
  duplicateReason: 'Already Imported' | 'Duplicate in File';
};

/** Stable identity used for duplicate detection. */
export const getTxSignature = (t: Transaction) => `${t.date}|${t.description}|${t.amount}`;

export interface DedupeResult {
  newItems: Transaction[];
  duplicates: DuplicateTransaction[];
}

/** Partition parsed rows into genuinely-new items and duplicates (existing or in-file). */
export const partitionDuplicates = (
  parsed: Transaction[],
  existingTransactions: Transaction[]
): DedupeResult => {
  const existingSignatures = new Set(existingTransactions.map(getTxSignature));
  const newItems: Transaction[] = [];
  const duplicates: DuplicateTransaction[] = [];
  const currentBatchSignatures = new Set<string>();

  parsed.forEach((t) => {
    const sig = getTxSignature(t);

    if (existingSignatures.has(sig)) {
      duplicates.push({ ...t, duplicateReason: 'Already Imported' });
    } else if (currentBatchSignatures.has(sig)) {
      duplicates.push({ ...t, duplicateReason: 'Duplicate in File' });
    } else {
      newItems.push(t);
      currentBatchSignatures.add(sig);
    }
  });

  return { newItems, duplicates };
};
