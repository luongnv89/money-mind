import React, { useMemo } from 'react';
import {
  PieChart,
  Pie,
  Cell,
  ResponsiveContainer,
  Tooltip,
  Legend,
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
} from 'recharts';
import { TransactionCategory, Transaction } from '../types';
import { Card, CardContent, CardHeader, CardTitle } from './UI';
import { formatCurrency, cn, safeNewDate } from '../lib/utils';
import { Zap, TrendingUp, PiggyBank, ShieldCheck, Target } from 'lucide-react';

const COLORS = {
  [TransactionCategory.Income]: '#22c55e',
  [TransactionCategory.InternalTransfer]: '#6b7280',
  [TransactionCategory.MustHave]: '#ef4444',
  [TransactionCategory.NiceToHave]: '#3b82f6',
  [TransactionCategory.Waste]: '#f59e0b',
  [TransactionCategory.Save]: '#10b981',
  [TransactionCategory.Invest]: '#8b5cf6',
  [TransactionCategory.Uncategorized]: '#e5e7eb',
};

interface InsightsDashboardProps {
  transactions: Transaction[]; // The currently filtered transactions
  allTransactions: Transaction[]; // Full history
}

// Internal component for budget cards
const BudgetMetricCard = ({
  title,
  icon: Icon,
  current,
  average,
  type = 'expense',
  colorClass,
  barColorClass,
}: {
  title: string;
  icon: React.ElementType;
  current: number;
  average: number;
  type?: 'expense' | 'savings';
  colorClass: string;
  barColorClass: string;
}) => {
  const percent = average === 0 ? 0 : (current / average) * 100;
  const diff = current - average;
  const diffPercent = average === 0 ? 0 : Math.round((diff / average) * 100);

  // Status Logic
  let isGood = true;
  if (type === 'expense') {
    // For expenses, being under average is generally "good", significantly over is "bad"
    isGood = diffPercent <= 10;
  } else {
    // For savings, being over average is "good"
    isGood = diffPercent >= -10;
  }

  return (
    <Card className="flex flex-col relative overflow-hidden">
      <CardContent className="p-5 flex flex-col h-full justify-between">
        <div>
          <div className="flex justify-between items-start mb-2">
            <div className="flex items-center gap-2">
              <div
                className={cn(
                  'p-1.5 rounded-md',
                  colorClass.replace('text-', 'bg-').replace('600', '100').replace('700', '100')
                )}
              >
                <Icon className={cn('w-4 h-4', colorClass)} />
              </div>
              <span className="text-sm font-medium text-gray-600">{title}</span>
            </div>
            {average > 0 && (
              <div
                className={cn(
                  'flex items-center text-xs font-bold px-2 py-0.5 rounded-full',
                  isGood ? 'bg-green-100 text-green-700' : 'bg-red-100 text-red-700'
                )}
              >
                {Math.abs(diffPercent)}%{' '}
                {diffPercent > 0
                  ? type === 'expense'
                    ? 'Over'
                    : 'Up'
                  : type === 'expense'
                    ? 'Under'
                    : 'Down'}
              </div>
            )}
          </div>

          <div className="mt-3">
            <span className="text-2xl font-bold text-gray-900">{formatCurrency(current)}</span>
            <div className="flex items-center gap-1.5 text-xs text-gray-500 mt-1">
              <span>vs. {formatCurrency(average)} avg</span>
            </div>
          </div>
        </div>

        <div className="mt-4 space-y-2">
          <div className="h-2 w-full bg-gray-100 rounded-full overflow-hidden">
            <div
              className={cn('h-full rounded-full transition-all duration-500', barColorClass)}
              style={{ width: `${Math.min(percent, 100)}%` }}
            />
          </div>
          <div className="flex justify-between text-[10px] text-gray-400 font-medium">
            <span>0%</span>
            <span>{Math.round(percent)}% of Avg</span>
          </div>
        </div>
      </CardContent>
    </Card>
  );
};

export const MonthlyPerformance: React.FC<InsightsDashboardProps> = ({
  transactions: _transactions,
  allTransactions,
}) => {
  // 1. Calculate Core Budget Metrics (Current Month vs Historical Average)
  const budgetMetrics = useMemo(() => {
    if (allTransactions.length === 0) return null;

    // A. Setup Dates
    const validTxs = allTransactions.filter((t) => !!safeNewDate(t.date));
    if (validTxs.length === 0) return null;

    const sortedTx = [...validTxs].sort(
      (a, b) => new Date(a.date).getTime() - new Date(b.date).getTime()
    );
    const latestDateStr = sortedTx[sortedTx.length - 1].date;

    // If no transactions, fallback
    const currentMonthKey = latestDateStr
      ? latestDateStr.substring(0, 7)
      : new Date().toISOString().substring(0, 7);

    // B. Grouping Helper
    const calculateTotals = (txs: Transaction[]) => {
      return txs.reduce(
        (acc, t) => {
          const amt = Math.abs(t.amount);
          if (t.category === TransactionCategory.MustHave) acc.mustHave += amt;
          else if (t.category === TransactionCategory.NiceToHave) acc.niceToHave += amt;
          else if (
            t.category === TransactionCategory.Save ||
            t.category === TransactionCategory.Invest
          )
            acc.savings += amt;
          return acc;
        },
        { mustHave: 0, niceToHave: 0, savings: 0 }
      );
    };

    // C. Current Month Totals
    const currentMonthTx = allTransactions.filter((t) => t.date.startsWith(currentMonthKey));
    const currentTotals = calculateTotals(currentMonthTx);

    // D. Historical Averages
    const historyTx = allTransactions.filter((t) => !t.date.startsWith(currentMonthKey));
    const historyMonths = new Set(historyTx.map((t) => t.date.substring(0, 7))).size;

    let averages = { mustHave: 0, niceToHave: 0, savings: 0 };

    if (historyMonths > 0) {
      const historyTotals = calculateTotals(historyTx);
      averages.mustHave = historyTotals.mustHave / historyMonths;
      averages.niceToHave = historyTotals.niceToHave / historyMonths;
      averages.savings = historyTotals.savings / historyMonths;
    } else {
      averages = currentTotals;
    }

    return {
      current: currentTotals,
      average: averages,
      monthLabel: (() => {
        const d = safeNewDate(currentMonthKey + '-02');
        return d
          ? d.toLocaleString('default', { month: 'long', year: 'numeric' })
          : currentMonthKey;
      })(),
    };
  }, [allTransactions]);

  if (!budgetMetrics) return null;

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between px-1">
        <h3 className="text-sm font-semibold text-gray-900 flex items-center gap-2">
          <Target className="w-4 h-4 text-gray-500" />
          Monthly Performance{' '}
          <span className="text-gray-400 font-normal">({budgetMetrics.monthLabel})</span>
        </h3>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <BudgetMetricCard
          title="Must-Have"
          icon={ShieldCheck}
          current={budgetMetrics.current.mustHave}
          average={budgetMetrics.average.mustHave}
          colorClass="text-red-600"
          barColorClass="bg-red-500"
        />
        <BudgetMetricCard
          title="Nice-to-Have"
          icon={Zap}
          current={budgetMetrics.current.niceToHave}
          average={budgetMetrics.average.niceToHave}
          colorClass="text-blue-600"
          barColorClass="bg-blue-500"
        />
        <BudgetMetricCard
          title="Savings & Invest"
          icon={PiggyBank}
          current={budgetMetrics.current.savings}
          average={budgetMetrics.average.savings}
          type="savings"
          colorClass="text-green-600"
          barColorClass="bg-green-500"
        />
      </div>
    </div>
  );
};

export const InsightsDashboard: React.FC<InsightsDashboardProps> = ({
  transactions,
  allTransactions,
}) => {
  // 2. Spending Breakdown (Pie Chart) - Uses `transactions` (filtered view)
  const pieData = useMemo(() => {
    const byCategory = transactions.reduce(
      (acc, t) => {
        acc[t.category] = (acc[t.category] || 0) + t.amount;
        return acc;
      },
      {} as Record<string, number>
    );

    return Object.keys(byCategory)
      .map((cat) => ({
        name: cat,
        value: Math.abs(byCategory[cat]),
      }))
      .filter(
        (d) =>
          d.value > 0 &&
          d.name !== TransactionCategory.InternalTransfer &&
          d.name !== TransactionCategory.Income
      );
  }, [transactions]);

  // 3. Trend Data
  const trendData = useMemo(() => {
    const expenses = allTransactions.filter(
      (t) => t.amount < 0 && t.category !== TransactionCategory.InternalTransfer
    );
    const byMonth: Record<string, number> = {};

    expenses.forEach((t) => {
      const m = t.date.substring(0, 7);
      if (m.length === 7 && m.includes('-')) {
        byMonth[m] = (byMonth[m] || 0) + Math.abs(t.amount);
      }
    });

    return Object.keys(byMonth)
      .sort()
      .slice(-6)
      .map((m) => {
        const d = safeNewDate(m + '-02');
        return {
          month: m,
          label: d ? d.toLocaleString('default', { month: 'short' }) : m,
          amount: byMonth[m],
        };
      });
  }, [allTransactions]);

  return (
    <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
      {/* Pie Chart */}
      <Card className="border-gray-200 flex flex-col min-h-[300px]">
        <CardHeader className="pb-0 pt-4 px-4">
          <CardTitle className="text-sm font-medium text-gray-700">
            Spending Mix (Current View)
          </CardTitle>
        </CardHeader>
        <CardContent className="flex-1 p-2">
          {pieData.length > 0 ? (
            <ResponsiveContainer width="100%" height="100%">
              <PieChart>
                <Pie
                  data={pieData}
                  innerRadius={60}
                  outerRadius={80}
                  paddingAngle={4}
                  dataKey="value"
                >
                  {pieData.map((entry, index) => (
                    <Cell
                      key={`cell-${index}`}
                      fill={COLORS[entry.name as TransactionCategory] || COLORS.Uncategorized}
                    />
                  ))}
                </Pie>
                <Tooltip
                  formatter={(value: unknown) =>
                    typeof value === 'number' ? formatCurrency(value) : String(value)
                  }
                />
                <Legend
                  verticalAlign="middle"
                  align="right"
                  layout="vertical"
                  iconSize={8}
                  wrapperStyle={{ fontSize: '11px' }}
                />
              </PieChart>
            </ResponsiveContainer>
          ) : (
            <div className="h-full flex items-center justify-center text-gray-400 text-sm">
              No data in current view
            </div>
          )}
        </CardContent>
      </Card>

      {/* Trend Chart */}
      <Card className="border-gray-200 flex flex-col min-h-[300px]">
        <CardHeader className="pb-0 pt-4 px-4">
          <CardTitle className="text-sm font-medium text-gray-700 flex items-center gap-2">
            <TrendingUp className="w-4 h-4 text-gray-500" />
            6-Month Spending Trend
          </CardTitle>
        </CardHeader>
        <CardContent className="flex-1 p-2 pl-0">
          {trendData.length > 0 ? (
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={trendData} margin={{ top: 20, right: 30, left: 10, bottom: 5 }}>
                <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f3f4f6" />
                <XAxis dataKey="label" axisLine={false} tickLine={false} tick={{ fontSize: 10 }} />
                <YAxis
                  axisLine={false}
                  tickLine={false}
                  tick={{ fontSize: 10 }}
                  tickFormatter={(val) => `$${val}`}
                />
                <Tooltip
                  cursor={{ fill: '#f9fafb' }}
                  contentStyle={{
                    borderRadius: '8px',
                    border: 'none',
                    boxShadow: '0 4px 6px -1px rgb(0 0 0 / 0.1)',
                  }}
                  formatter={(value: unknown) => [
                    typeof value === 'number' ? formatCurrency(value) : String(value),
                    'Total',
                  ]}
                />
                <Bar dataKey="amount" fill="#3b82f6" radius={[4, 4, 0, 0]} maxBarSize={40} />
              </BarChart>
            </ResponsiveContainer>
          ) : (
            <div className="h-full flex items-center justify-center text-gray-400 text-sm">
              Not enough history
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
};
