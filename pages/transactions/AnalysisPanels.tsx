import React from 'react';
import { Activity, AlertTriangle, ArrowRightLeft, CheckCircle2, Loader2, X } from 'lucide-react';
import { Button, Card, CardContent } from '../../components/UI';
import type { AnalysisStats } from './useAIAnalysis';

export interface AnalysisStatsPanelProps {
  stats: AnalysisStats;
  onDismiss: () => void;
}

type Tone = 'info' | 'positive' | 'warning' | 'negative';

/** Fully literal class strings so the Tailwind scanner sees them. */
const toneClasses: Record<Tone, Record<string, string>> = {
  info: {
    box: 'bg-info/10 rounded-lg p-3 border border-info/20',
    icon: 'text-info w-3.5 h-3.5',
    label: 'text-xs text-info font-medium uppercase tracking-wide',
    value: 'num text-2xl font-bold text-info',
    hint: 'text-[10px] text-info',
  },
  positive: {
    box: 'bg-positive/10 rounded-lg p-3 border border-positive/20',
    icon: 'text-positive w-3.5 h-3.5',
    label: 'text-xs text-positive font-medium uppercase tracking-wide',
    value: 'num text-2xl font-bold text-positive',
    hint: 'text-[10px] text-positive',
  },
  warning: {
    box: 'bg-warning/10 rounded-lg p-3 border border-warning/20',
    icon: 'text-warning w-3.5 h-3.5',
    label: 'text-xs text-warning font-medium uppercase tracking-wide',
    value: 'num text-2xl font-bold text-warning',
    hint: 'text-[10px] text-warning',
  },
  negative: {
    box: 'bg-negative/10 rounded-lg p-3 border border-negative/20',
    icon: 'text-negative w-3.5 h-3.5',
    label: 'text-xs text-negative font-medium uppercase tracking-wide',
    value: 'num text-2xl font-bold text-negative',
    hint: 'text-[10px] text-negative',
  },
};

interface StatCardSpec {
  icon: React.ReactNode;
  label: string;
  value: number;
  hint: string;
  tone: Tone;
}

const StatCard: React.FC<StatCardSpec> = ({ icon, label, value, hint, tone }) => {
  const c = toneClasses[tone];
  return (
    <div className={c.box}>
      <div className="flex items-center gap-1.5 mb-1">
        <div className={c.icon}>{icon}</div>
        <div className={c.label}>{label}</div>
      </div>
      <div className={c.value}>{value}</div>
      <div className={c.hint}>{hint}</div>
    </div>
  );
};

const StatGrid: React.FC<{ stats: AnalysisStats }> = ({ stats }) => (
  <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
    <StatCard
      icon={<ArrowRightLeft className="w-3.5 h-3.5" />}
      label="Updates Applied"
      value={stats.changed}
      hint="Categories changed"
      tone="info"
    />
    <StatCard
      icon={<CheckCircle2 className="w-3.5 h-3.5" />}
      label="High Confidence"
      value={stats.highConfidence}
      hint="Strong AI matches"
      tone="positive"
    />
    <StatCard
      icon={<Activity className="w-3.5 h-3.5" />}
      label="Medium Confidence"
      value={stats.mediumConfidence}
      hint="Likely correct"
      tone="warning"
    />
    <StatCard
      icon={<AlertTriangle className="w-3.5 h-3.5" />}
      label="Low Confidence"
      value={stats.lowConfidence}
      hint="Review needed"
      tone="negative"
    />
  </div>
);

/** Post-analysis summary: changed counts and confidence bands. */
export const AnalysisStatsPanel: React.FC<AnalysisStatsPanelProps> = ({ stats, onDismiss }) => (
  <Card className="relative border-positive/30 bg-positive/5 animate-rise">
    <button
      onClick={onDismiss}
      aria-label="Dismiss analysis summary"
      className="absolute top-4 right-4 text-muted hover:text-ink transition-colors"
    >
      <X className="w-4 h-4" />
    </button>

    <CardContent className="p-4">
      <div className="flex items-center gap-2 mb-4">
        <div className="p-2 bg-positive/15 rounded-full">
          <Activity className="w-4 h-4 text-positive" />
        </div>
        <div>
          <h3 className="font-semibold text-ink">Analysis Complete</h3>
          <p className="text-xs text-muted">
            Processed {stats.total} transactions in {stats.duration.toFixed(1)}s
          </p>
        </div>
      </div>

      <StatGrid stats={stats} />
    </CardContent>
  </Card>
);

export interface AnalysisProgressCardProps {
  processedCount: number;
  totalToProcess: number;
  progressPercent: number;
}

/** Inline progress card shown while AI analysis runs. */
export const AnalysisProgressCard: React.FC<AnalysisProgressCardProps> = ({
  processedCount,
  totalToProcess,
  progressPercent,
}) => (
  <Card className="w-full sm:w-80 border-accent/20 bg-accent-light/50">
    <CardContent className="p-3">
      <div className="space-y-2">
        <div className="flex justify-between text-xs font-semibold text-accent-hover">
          <span className="flex items-center gap-1">
            <Loader2 className="w-3 h-3 animate-spin" />
            Analyzing...
          </span>
          <span className="num">
            {processedCount} / {totalToProcess} ({progressPercent}%)
          </span>
        </div>
        <div
          className="h-1.5 w-full bg-line rounded-full overflow-hidden"
          role="progressbar"
          aria-label="Categorization progress"
          aria-valuemin={0}
          aria-valuemax={100}
          aria-valuenow={progressPercent}
        >
          <div
            className="h-full bg-accent transition-all duration-500 ease-out"
            style={{ width: `${progressPercent}%` }}
          />
        </div>
      </div>
    </CardContent>
  </Card>
);

export interface ErrorBannerProps {
  error: string;
  onDismiss: () => void;
  onOpenSettings: () => void;
}

/** Inline error banner for categorization failures. */
export const ErrorBanner: React.FC<ErrorBannerProps> = ({ error, onDismiss, onOpenSettings }) => {
  const suggestSettings = error.includes('Settings');
  return (
    <div
      role="alert"
      className="bg-negative/5 border border-negative/20 rounded-xl p-4 flex items-center justify-between gap-3 animate-rise"
    >
      <AlertTriangle className="w-5 h-5 text-negative mt-0.5 shrink-0" />
      <div className="flex-1">
        <p className="text-sm text-negative">{error}</p>
        {suggestSettings && (
          <Button
            variant="outline"
            size="sm"
            onClick={onOpenSettings}
            className="mt-2 border-negative/30 text-negative hover:bg-negative/10"
          >
            Open Settings
          </Button>
        )}
      </div>
      <button
        onClick={onDismiss}
        aria-label="Dismiss error"
        className="text-negative hover:text-negative/80 shrink-0"
      >
        <X className="w-4 h-4" />
      </button>
    </div>
  );
};
