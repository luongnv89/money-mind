import React, { useState } from 'react';
import { AlertOctagon, AlertTriangle, CheckCircle2, Info, TrendingUp } from 'lucide-react';
import { Button, Card, CardContent } from '../../components/UI';
import { Insight, InsightSeverity } from '../../lib/finance';
import { View } from '../../types';
import { MetricInfo } from './shared';

const SEVERITY_ICON: Record<InsightSeverity, { Icon: typeof Info; className: string }> = {
  critical: { Icon: AlertOctagon, className: 'text-negative' },
  warning: { Icon: AlertTriangle, className: 'text-warning' },
  opportunity: { Icon: TrendingUp, className: 'text-brass' },
  info: { Icon: Info, className: 'text-info' },
  positive: { Icon: CheckCircle2, className: 'text-positive' },
};

const scrollToRecurring = () =>
  document.getElementById('recurring')?.scrollIntoView({ behavior: 'smooth', block: 'start' });

const InsightRow: React.FC<{
  insight: Insight;
  onNavigate: (view: View) => void;
  periodInProgress: boolean;
  fmt: (n: number) => string;
}> = ({ insight, onNavigate, periodInProgress, fmt }) => {
  const { Icon, className } = SEVERITY_ICON[insight.severity];
  return (
    <div className="flex items-start gap-3 border-b border-line py-3 last:border-0">
      <Icon className={`mt-0.5 h-4 w-4 shrink-0 ${className}`} aria-hidden="true" />
      <div className="min-w-0 flex-1">
        <p className="flex items-center gap-1 text-sm font-medium text-ink">
          <span>{insight.title}</span>
          {insight.metric && <MetricInfo metric={insight.metric} />}
        </p>
        <p className="mt-0.5 text-sm text-ink-soft">{insight.detail}</p>
      </div>
      <div className="flex shrink-0 flex-col items-end gap-1.5">
        {insight.impact && insight.severity !== 'positive' && (
          <span className="num rounded-full bg-warning/10 px-2 py-0.5 text-xs font-medium text-warning">
            {insight.impact.per === 'month'
              ? `≈ ${fmt(insight.impact.amount)}/mo`
              : periodInProgress
                ? `${fmt(insight.impact.amount)} so far`
                : `${fmt(insight.impact.amount)} this period`}
          </span>
        )}
        {insight.action === 'categorize' && (
          <Button variant="outline" size="sm" onClick={() => onNavigate('transactions')}>
            Categorize
          </Button>
        )}
        {insight.action === 'review-transactions' && (
          <Button variant="ghost" size="sm" onClick={() => onNavigate('transactions')}>
            Review
          </Button>
        )}
        {insight.action === 'review-recurring' && (
          <Button variant="ghost" size="sm" onClick={scrollToRecurring}>
            View charges
          </Button>
        )}
      </div>
    </div>
  );
};

export interface InsightsListProps {
  insights: Insight[];
  onNavigate: (view: View) => void;
  /** From summary.coverage.isInProgress — picks "so far" vs "this period" copy. */
  periodInProgress: boolean;
  fmt: (n: number) => string;
}

export const InsightsList: React.FC<InsightsListProps> = ({
  insights,
  onNavigate,
  periodInProgress,
  fmt,
}) => {
  const [expanded, setExpanded] = useState(false);
  const shown = expanded ? insights : insights.slice(0, 5);

  if (insights.length === 0) {
    return (
      <Card>
        <CardContent className="p-5 text-sm text-muted">
          Nothing needs attention for this period.
        </CardContent>
      </Card>
    );
  }

  return (
    <Card>
      <CardContent className="px-5 py-2">
        {shown.map((insight) => (
          <InsightRow
            key={insight.id}
            insight={insight}
            onNavigate={onNavigate}
            periodInProgress={periodInProgress}
            fmt={fmt}
          />
        ))}
        {insights.length > 5 && (
          <div className="py-3 text-center">
            <Button variant="ghost" size="sm" onClick={() => setExpanded((v) => !v)}>
              {expanded ? 'Show less' : `Show all (${insights.length})`}
            </Button>
          </div>
        )}
      </CardContent>
    </Card>
  );
};
