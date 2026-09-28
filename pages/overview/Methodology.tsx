import React from 'react';
import { Disclosure } from '../../components/UI';
import { METRIC_DEFINITIONS, MetricDefinition } from '../../lib/finance';

const BULLETS = [
  'Refunds reduce the category they belong to; transfers between your own accounts are left out entirely.',
  'Uncategorized money out counts as spending until you categorize it; uncategorized money in never counts as income.',
  'Averages and the health score use complete periods only. A period still in progress is compared day-for-day with the same days of past periods.',
  "Weekly views compare day-to-day spending — everything except recurring bills and subscriptions, which land in whichever week they're due — and judge income and savings over months instead.",
  'All figures are computed on this device with fixed formulas — the same data always gives the same numbers.',
];

const DefinitionBlock: React.FC<{ def: MetricDefinition }> = ({ def }) => (
  <div>
    <p className="text-sm font-semibold text-ink">{def.name}</p>
    <p className="mt-0.5 text-sm text-ink-soft">{def.summary}</p>
    <p className="mt-1 text-xs text-muted">
      <span className="font-medium text-ink-soft">How:</span> {def.formula}
    </p>
    <p className="mt-0.5 text-xs text-muted">
      <span className="font-medium text-ink-soft">Why it matters:</span> {def.meaning}
    </p>
    {def.benchmark && (
      <p className="mt-0.5 text-xs text-muted">
        <span className="font-medium text-ink-soft">Benchmark:</span> {def.benchmark}
      </p>
    )}
  </div>
);

/** Methodology: fixed rules plus every metric definition from the engine. */
export const Methodology: React.FC = () => (
  <Disclosure summary="How MoneyMind calculates these numbers" className="bg-surface">
    <ul className="mb-4 list-disc space-y-1.5 pl-5 text-sm text-ink-soft">
      {BULLETS.map((bullet) => (
        <li key={bullet}>{bullet}</li>
      ))}
    </ul>
    <div className="grid grid-cols-1 gap-4 border-t border-line pt-4 sm:grid-cols-2">
      {Object.values(METRIC_DEFINITIONS).map((def) => (
        <DefinitionBlock key={def.id} def={def} />
      ))}
    </div>
  </Disclosure>
);
