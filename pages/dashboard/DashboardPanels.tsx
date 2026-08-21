import React from 'react';
import { Activity, AlertTriangle, ArrowRightLeft, CheckCircle2, Loader2, X } from 'lucide-react';
import { Button, Card, CardContent } from '../../components/UI';
import type { AnalysisStats } from './useAIAnalysis';

export interface AnalysisStatsPanelProps {
  stats: AnalysisStats;
  onDismiss: () => void;
}

type Tone = 'indigo' | 'green' | 'yellow' | 'red';

/** Fully literal class strings so Tailwind's CDN JIT scanner sees them. */
const toneClasses: Record<Tone, Record<string, string>> = {
  indigo: {
    box: 'bg-indigo-50 rounded-lg p-3 border border-indigo-100',
    icon: 'text-indigo-600 w-3.5 h-3.5',
    label: 'text-xs text-indigo-700 font-medium uppercase tracking-wide',
    value: 'text-2xl font-bold text-indigo-700',
    hint: 'text-[10px] text-indigo-600/70',
  },
  green: {
    box: 'bg-green-50 rounded-lg p-3 border border-green-100',
    icon: 'text-green-600 w-3.5 h-3.5',
    label: 'text-xs text-green-700 font-medium uppercase tracking-wide',
    value: 'text-2xl font-bold text-green-700',
    hint: 'text-[10px] text-green-600/70',
  },
  yellow: {
    box: 'bg-yellow-50 rounded-lg p-3 border border-yellow-100',
    icon: 'text-yellow-600 w-3.5 h-3.5',
    label: 'text-xs text-yellow-700 font-medium uppercase tracking-wide',
    value: 'text-2xl font-bold text-yellow-700',
    hint: 'text-[10px] text-yellow-600/70',
  },
  red: {
    box: 'bg-red-50 rounded-lg p-3 border border-red-100',
    icon: 'text-red-600 w-3.5 h-3.5',
    label: 'text-xs text-red-700 font-medium uppercase tracking-wide',
    value: 'text-2xl font-bold text-red-700',
    hint: 'text-[10px] text-red-600/70',
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
      tone="indigo"
    />
    <StatCard
      icon={<CheckCircle2 className="w-3.5 h-3.5" />}
      label="High Confidence"
      value={stats.highConfidence}
      hint="Strong AI matches"
      tone="green"
    />
    <StatCard
      icon={<Activity className="w-3.5 h-3.5" />}
      label="Medium Confidence"
      value={stats.mediumConfidence}
      hint="Likely correct"
      tone="yellow"
    />
    <StatCard
      icon={<AlertTriangle className="w-3.5 h-3.5" />}
      label="Low Confidence"
      value={stats.lowConfidence}
      hint="Review needed"
      tone="red"
    />
  </div>
);

/** Post-analysis summary: changed counts and confidence bands. */
export const AnalysisStatsPanel: React.FC<AnalysisStatsPanelProps> = ({ stats, onDismiss }) => (
  <div className="bg-white border border-green-200 rounded-xl p-4 shadow-xs relative animate-in fade-in slide-in-from-top-4">
    <button
      onClick={onDismiss}
      className="absolute top-4 right-4 text-gray-400 hover:text-gray-600 transition-colors"
    >
      <X className="w-4 h-4" />
    </button>

    <div className="flex items-center gap-2 mb-4">
      <div className="p-2 bg-green-100 rounded-full">
        <Activity className="w-4 h-4 text-green-600" />
      </div>
      <div>
        <h3 className="font-semibold text-gray-900">Analysis Complete</h3>
        <p className="text-xs text-gray-500">
          Processed {stats.total} transactions in {stats.duration.toFixed(1)}s
        </p>
      </div>
    </div>

    <StatGrid stats={stats} />
  </div>
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
  <Card className="w-full sm:w-80 shadow-md border-accent/20 bg-accent/5">
    <CardContent className="p-3">
      <div className="space-y-2">
        <div className="flex justify-between text-xs font-semibold text-accent-hover">
          <span className="flex items-center gap-1">
            <Loader2 className="w-3 h-3 animate-spin" />
            Analyzing...
          </span>
          <span>
            {processedCount} / {totalToProcess} ({progressPercent}%)
          </span>
        </div>
        <div className="h-1.5 w-full bg-gray-200 rounded-full overflow-hidden">
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

/** Error banner; budget-exceeded errors get an extra settings call-to-action. */
export const ErrorBanner: React.FC<ErrorBannerProps> = ({ error, onDismiss, onOpenSettings }) => {
  const isBudget = error.includes('Budget Exceeded');
  return (
    <div
      className={`bg-red-50 border border-red-200 rounded-lg p-4 ${
        isBudget
          ? 'flex items-start gap-3 animate-in fade-in slide-in-from-top-2'
          : 'flex items-center justify-between gap-3 animate-in fade-in'
      }`}
    >
      <AlertTriangle className="w-5 h-5 text-red-600 mt-0.5" />
      {isBudget ? (
        <div className="flex-1">
          <h3 className="text-sm font-semibold text-red-900">Usage Limit Reached</h3>
          <p className="text-sm text-red-700 mt-1">{error}</p>
          <Button
            variant="outline"
            size="sm"
            onClick={onOpenSettings}
            className="mt-3 border-red-200 hover:bg-red-100 text-red-700"
          >
            Add Your API Key in Settings
          </Button>
        </div>
      ) : (
        <span className="text-sm text-red-700">{error}</span>
      )}
      <button onClick={onDismiss} className="text-red-400 hover:text-red-600">
        <X className="w-4 h-4" />
      </button>
    </div>
  );
};
