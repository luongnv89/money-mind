import { Transaction } from '../types';

/**
 * Identity key for "same transaction" deduplication: identical description
 * (whitespace-collapsed), direction and bank category label. Exact-text
 * matching only — digits and punctuation stay significant.
 */
export const categorizationKey = (tx: Transaction): string =>
  [
    tx.description.trim().replace(/\s+/g, ' ').toUpperCase(),
    tx.amount < 0 ? 'out' : tx.amount > 0 ? 'in' : 'zero',
    (tx.originalCategory ?? '').trim().toLowerCase(),
  ].join('|');

/**
 * Group transactions so each unique `categorizationKey` is sent to the AI
 * once. The first occurrence becomes the representative;
 * `membersByRepId[repId]` lists every transaction id sharing the key
 * (representative included), which callers use to fan results back out.
 */
export const groupForCategorization = (
  txs: Transaction[]
): { representatives: Transaction[]; membersByRepId: Map<string, string[]> } => {
  const repByKey = new Map<string, string>();
  const representatives: Transaction[] = [];
  const membersByRepId = new Map<string, string[]>();

  for (const tx of txs) {
    const key = categorizationKey(tx);
    const repId = repByKey.get(key);
    if (repId === undefined) {
      repByKey.set(key, tx.id);
      representatives.push(tx);
      membersByRepId.set(tx.id, [tx.id]);
    } else {
      membersByRepId.get(repId)!.push(tx.id);
    }
  }

  return { representatives, membersByRepId };
};
