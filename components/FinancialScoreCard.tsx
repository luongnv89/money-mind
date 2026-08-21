import React, { useMemo, useEffect, useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from './UI';
import { Transaction } from '../types';
import { calculateFinancialScore } from '../services/scoreService';
import { TrendingUp, AlertCircle, CheckCircle2, Lightbulb, Target } from 'lucide-react';
import { cn } from '../lib/utils';

interface FinancialScoreCardProps {
  transactions: Transaction[];
}

export const FinancialScoreCard: React.FC<FinancialScoreCardProps> = ({ transactions }) => {
  const { score, grade, breakdown, tips, hasEnoughData } = useMemo(
    () => calculateFinancialScore(transactions),
    [transactions]
  );

  // Animation state
  const [displayScore, setDisplayScore] = useState(0);

  useEffect(() => {
    setDisplayScore(0);
    const duration = 1500;
    const startTime = performance.now();

    const animate = (currentTime: number) => {
      const elapsed = currentTime - startTime;
      const progress = Math.min(elapsed / duration, 1);
      // Ease out cubic
      const ease = 1 - Math.pow(1 - progress, 3);

      setDisplayScore(Math.round(score * ease));

      if (progress < 1) {
        requestAnimationFrame(animate);
      }
    };

    requestAnimationFrame(animate);
  }, [score]);

  if (!hasEnoughData) return null;

  const getScoreColor = (s: number) => {
    if (s >= 80) return 'text-emerald-600 bg-emerald-50 border-emerald-100';
    if (s >= 60) return 'text-amber-600 bg-amber-50 border-amber-100';
    return 'text-red-600 bg-red-50 border-red-100';
  };

  const scoreColorHex = score >= 80 ? '#059669' : score >= 60 ? '#d97706' : '#dc2626';

  // Gauge Config
  const radius = 50;
  const strokeWidth = 8;
  const normalizedRadius = radius - strokeWidth / 2;
  const circumference = normalizedRadius * 2 * Math.PI;
  const strokeDashoffset = circumference - (displayScore / 100) * circumference;

  return (
    <Card className="border-gray-200 overflow-hidden shadow-xs">
      <CardHeader className="pb-0 pt-5 px-6 border-b-0">
        <div className="flex justify-between items-center">
          <CardTitle className="text-base font-semibold text-gray-800 flex items-center gap-2">
            <Target className="w-5 h-5 text-gray-500" />
            Financial Health
          </CardTitle>
          <span className="text-xs font-medium text-gray-400 bg-gray-50 px-2 py-1 rounded-full border border-gray-100">
            Monthly Score
          </span>
        </div>
      </CardHeader>
      <CardContent className="p-6 pt-2">
        <div className="flex flex-col md:flex-row gap-8 items-center">
          {/* Left: Score Gauge */}
          <div className="flex flex-col items-center justify-center shrink-0">
            <div className="relative w-40 h-40 flex items-center justify-center">
              {/* SVG Gauge */}
              <svg
                height={radius * 2 + 20}
                width={radius * 2 + 20}
                className="transform -rotate-90 overflow-visible"
              >
                <circle
                  stroke="#f3f4f6"
                  strokeWidth={strokeWidth}
                  fill="transparent"
                  r={normalizedRadius}
                  cx="50%"
                  cy="50%"
                />
                <circle
                  stroke={scoreColorHex}
                  strokeWidth={strokeWidth}
                  strokeDasharray={circumference + ' ' + circumference}
                  style={{
                    strokeDashoffset,
                    transition: 'stroke-dashoffset 1.5s ease-out',
                  }}
                  strokeLinecap="round"
                  fill="transparent"
                  r={normalizedRadius}
                  cx="50%"
                  cy="50%"
                />
              </svg>
              <div className="absolute inset-0 flex flex-col items-center justify-center">
                <span
                  className={cn(
                    'text-4xl font-extrabold tracking-tight',
                    score >= 80
                      ? 'text-emerald-600'
                      : score >= 60
                        ? 'text-amber-600'
                        : 'text-red-600'
                  )}
                >
                  {displayScore}
                </span>
                <span className="text-xs font-semibold text-gray-400 uppercase tracking-wide mt-1">
                  / 100
                </span>
              </div>
            </div>

            <div
              className={cn(
                'mt-2 px-4 py-1.5 rounded-full text-sm font-bold border flex items-center gap-1.5 shadow-xs',
                getScoreColor(score)
              )}
            >
              Grade: {grade}
            </div>
          </div>

          {/* Middle: Breakdown */}
          <div className="flex-1 w-full space-y-4">
            <div>
              <h4 className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-3">
                Score Factors
              </h4>
              <div className="grid gap-2">
                {breakdown.length > 0 ? (
                  breakdown.map((item, idx) => (
                    <div
                      key={idx}
                      className="flex items-center justify-between p-2 rounded-lg hover:bg-gray-50 transition-colors border border-transparent hover:border-gray-100"
                    >
                      <div className="flex items-center gap-3">
                        <div
                          className={cn(
                            'p-1.5 rounded-md',
                            item.type === 'positive'
                              ? 'bg-green-100 text-green-600'
                              : item.type === 'negative'
                                ? 'bg-red-100 text-red-600'
                                : 'bg-gray-100 text-gray-500'
                          )}
                        >
                          {item.type === 'positive' ? (
                            <CheckCircle2 className="w-3.5 h-3.5" />
                          ) : item.type === 'negative' ? (
                            <AlertCircle className="w-3.5 h-3.5" />
                          ) : (
                            <TrendingUp className="w-3.5 h-3.5" />
                          )}
                        </div>
                        <div>
                          <div className="text-sm font-medium text-gray-700">{item.label}</div>
                          <div className="text-xs text-gray-500">{item.reason}</div>
                        </div>
                      </div>
                      <div
                        className={cn(
                          'font-mono font-bold text-sm',
                          item.points > 0
                            ? 'text-green-600'
                            : item.points < 0
                              ? 'text-red-600'
                              : 'text-gray-400'
                        )}
                      >
                        {item.points > 0 ? '+' : ''}
                        {item.points}
                      </div>
                    </div>
                  ))
                ) : (
                  <div className="text-sm text-gray-400 italic p-2">Neutral Factors</div>
                )}
              </div>
            </div>
          </div>

          {/* Right: Tip */}
          <div className="w-full md:w-64 shrink-0">
            <div className="bg-gradient-to-br from-indigo-50 to-blue-50 rounded-xl p-4 border border-indigo-100 h-full flex flex-col justify-center relative overflow-hidden group">
              <div className="absolute top-0 right-0 p-3 opacity-10 group-hover:opacity-20 transition-opacity">
                <Lightbulb className="w-16 h-16 text-indigo-600" />
              </div>
              <div className="relative z-10">
                <div className="flex items-center gap-2 mb-2">
                  <div className="bg-white p-1.5 rounded-full shadow-xs">
                    <Lightbulb className="w-4 h-4 text-indigo-600 fill-indigo-100" />
                  </div>
                  <span className="text-xs font-bold text-indigo-800 uppercase tracking-wide">
                    Top Tip
                  </span>
                </div>
                <p className="text-sm text-indigo-900 leading-relaxed font-medium">{tips[0]}</p>
              </div>
            </div>
          </div>
        </div>
      </CardContent>
    </Card>
  );
};
