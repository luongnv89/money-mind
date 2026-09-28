import React from 'react';
import { Badge, InfoTip, SectionTitle } from '../../components/UI';
import { ComponentStatus, METRIC_DEFINITIONS, MetricId } from '../../lib/finance';
import { statusLabel, statusVariant } from './statusUtils';

export const StatusBadge: React.FC<{ status: ComponentStatus | null }> = ({ status }) =>
  status ? <Badge variant={statusVariant(status)}>{statusLabel(status)}</Badge> : null;

/**
 * Metric explainer: an InfoTip fed by the engine's METRIC_DEFINITIONS so the
 * wording of every "How/Why/Benchmark" stays in lib/finance.
 */
export const MetricInfo: React.FC<{ metric: MetricId; align?: 'start' | 'center' | 'end' }> = ({
  metric,
  align,
}) => {
  const def = METRIC_DEFINITIONS[metric];
  return (
    <InfoTip ariaLabel={`About ${def.name}`} title={def.name} align={align}>
      <p>{def.summary}</p>
      <p>
        <span className="font-semibold text-ink">How:</span> {def.formula}
      </p>
      <p>
        <span className="font-semibold text-ink">Why it matters:</span> {def.meaning}
      </p>
      {def.benchmark && (
        <p>
          <span className="font-semibold text-ink">Benchmark:</span> {def.benchmark}
        </p>
      )}
    </InfoTip>
  );
};

/** Section shell: entrance animation on first mount only (no keying by period). */
export const Rise: React.FC<{ index?: number; children: React.ReactNode }> = ({
  index = 0,
  children,
}) => (
  <div className="animate-rise" style={{ animationDelay: `${Math.min(index, 8) * 45}ms` }}>
    {children}
  </div>
);

export const Section: React.FC<{
  id?: string;
  index?: number;
  title: React.ReactNode;
  caption?: string;
  children: React.ReactNode;
}> = ({ id, index = 0, title, caption, children }) => (
  <Rise index={index}>
    <section id={id} aria-label={typeof title === 'string' ? title : undefined}>
      <div className="mb-4">
        <SectionTitle>{title}</SectionTitle>
        {caption && <p className="mt-1 text-sm text-muted">{caption}</p>}
      </div>
      {children}
    </section>
  </Rise>
);
