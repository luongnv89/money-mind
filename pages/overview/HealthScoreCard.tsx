import React, { useEffect, useRef, useState } from 'react';
import { Button, Card, CardContent } from '../../components/UI';
import { ComponentId, ComponentStatus, HealthScore, MetricId } from '../../lib/finance';
import { View } from '../../types';
import { MetricInfo } from './shared';
import { statusBarClass } from './statusUtils';

/** Score component → METRIC_DEFINITIONS key ('debtService' is named differently). */
const componentMetric = (id: ComponentId): MetricId | null =>
  id === 'debtService' ? 'debtServiceRatio' : id;

const RADIUS = 54;
const CIRCUMFERENCE = 2 * Math.PI * RADIUS;

const gradeColor = (grade: HealthScore['grade']): string => {
  if (grade === 'A' || grade === 'B') return '#0E7A5A';
  if (grade === 'C') return '#B45309';
  return '#A23B3B';
};

const Ring: React.FC<{ score: number; grade: HealthScore['grade'] }> = ({ score, grade }) => {
  // Animate the sweep once on mount; later score changes apply instantly.
  const [progress, setProgress] = useState(0);
  const animate = useRef(true);
  useEffect(() => {
    const start = setTimeout(() => setProgress(score / 100), 30);
    const stop = setTimeout(() => {
      animate.current = false;
    }, 800);
    return () => {
      clearTimeout(start);
      clearTimeout(stop);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps -- intentionally mount-only
  }, []);
  const shown = animate.current ? progress : score / 100;
  return (
    <svg
      viewBox="0 0 132 132"
      className="h-32 w-32 shrink-0"
      role="img"
      aria-label={`Score ${score} of 100`}
    >
      <circle cx="66" cy="66" r={RADIUS} fill="none" stroke="#E7E1D6" strokeWidth="10" />
      <circle
        cx="66"
        cy="66"
        r={RADIUS}
        fill="none"
        stroke={gradeColor(grade)}
        strokeWidth="10"
        strokeLinecap="round"
        strokeDasharray={CIRCUMFERENCE}
        strokeDashoffset={CIRCUMFERENCE * (1 - shown)}
        transform="rotate(-90 66 66)"
        style={{
          transition: animate.current ? 'stroke-dashoffset 700ms var(--ease-out)' : 'none',
        }}
      />
      <text
        x="66"
        y="62"
        textAnchor="middle"
        className="num fill-ink"
        style={{ fontSize: '2rem', fontFamily: 'var(--font-display)' }}
      >
        {score}
      </text>
      <text x="66" y="82" textAnchor="middle" className="fill-muted" style={{ fontSize: '0.7rem' }}>
        /100
      </text>
    </svg>
  );
};

const ComponentRow: React.FC<{
  id: ComponentId;
  label: string;
  display: string;
  target: string;
  points: number;
  maxPoints: number;
  status: ComponentStatus;
}> = ({ id, label, display, target, points, maxPoints, status }) => {
  const metric = componentMetric(id);
  const width = maxPoints > 0 ? Math.min(100, (points / maxPoints) * 100) : 0;
  return (
    <div>
      <div className="flex items-baseline justify-between gap-2">
        <span className="flex min-w-0 items-center gap-1 text-sm text-ink">
          <span className="truncate">{label}</span>
          {metric && <MetricInfo metric={metric} />}
        </span>
        <span className="num shrink-0 text-sm font-medium text-ink">
          {display}
          <span className="num ml-2 text-xs text-muted">
            {points}/{maxPoints}
          </span>
        </span>
      </div>
      <div className="mt-1 h-1.5 w-full overflow-hidden rounded-full bg-line">
        <div
          className={`h-full rounded-full ${statusBarClass(status)}`}
          style={{ width: `${width}%` }}
        />
      </div>
      <p className="mt-0.5 text-[11px] text-muted">target {target}</p>
    </div>
  );
};

export interface HealthScoreCardProps {
  score: HealthScore;
  onNavigate: (view: View) => void;
}

export const HealthScoreCard: React.FC<HealthScoreCardProps> = ({ score, onNavigate }) => {
  if (score.score === null) {
    return (
      <Card className="flex-1">
        <CardContent className="flex h-full flex-col items-start justify-center gap-4 p-6">
          <p className="font-display text-2xl text-ink">Financial health score</p>
          <p className="text-sm text-ink-soft">{score.reason}</p>
          <Button variant="outline" onClick={() => onNavigate('transactions')}>
            Review transactions
          </Button>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card className="flex-1">
      <CardContent className="p-6">
        <div className="flex flex-wrap items-center gap-6">
          <Ring score={score.score} grade={score.grade} />
          <div className="min-w-40">
            <p className="font-display text-lg text-ink">
              Grade {score.grade} · {score.rating}
            </p>
            <p className="mt-1 text-sm text-muted">Based on {score.window.label}</p>
            {score.caveat && <p className="mt-2 text-xs text-warning">{score.caveat}</p>}
          </div>
        </div>
        <div className="mt-5 space-y-3">
          {score.components.map((c) => (
            <ComponentRow
              key={c.id}
              id={c.id}
              label={c.label}
              display={c.display}
              target={c.target}
              points={c.points}
              maxPoints={c.maxPoints}
              status={c.status}
            />
          ))}
        </div>
      </CardContent>
    </Card>
  );
};
