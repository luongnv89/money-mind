/** Formats a money amount in the user's currency (injected by the caller). */
export type MoneyFormatter = (amount: number) => string;

export const round2 = (n: number): number => Math.round(n * 100) / 100;

/** `0.183` → `18%`; small shares keep one decimal (`0.034` → `3.4%`). */
export const formatPercent = (ratio: number): string => {
  const pct = ratio * 100;
  if (pct !== 0 && Math.abs(pct) < 10) return `${(Math.round(pct * 10) / 10).toFixed(1)}%`;
  return `${Math.round(pct)}%`;
};

/** `['a']` → `a`; `['a','b']` → `a and b`; `['a','b','c']` → `a, b and c`. */
export const joinList = (items: string[]): string => {
  if (items.length <= 1) return items.join('');
  return `${items.slice(0, -1).join(', ')} and ${items[items.length - 1]}`;
};

export const pluralize = (count: number, singular: string, plural = `${singular}s`): string =>
  `${count} ${count === 1 ? singular : plural}`;
