import React, { useMemo } from 'react';
import { useTransactionStore } from '../stores/useTransactionStore';
import { PieChart, Pie, Cell, ResponsiveContainer, Tooltip, Legend } from 'recharts';
import { TransactionCategory } from '../types';
import { Card, CardContent, CardHeader, CardTitle } from './UI';
import { formatCurrency, cn } from '../lib/utils';
import { AlertTriangle, TrendingUp, PiggyBank, Coffee } from 'lucide-react';

const COLORS = {
  [TransactionCategory.Essential]: '#4B5563', // Gray-600
  [TransactionCategory.Growth]: '#3B82F6', // Blue-500
  [TransactionCategory.Joy]: '#A855F7', // Purple-500
  [TransactionCategory.Drift]: '#F97316', // Orange-500
  [TransactionCategory.Uncategorized]: '#E5E7EB', // Gray-200
};

export const InsightsDashboard: React.FC = () => {
  const { transactions } = useTransactionStore();

  const stats = useMemo(() => {
    const total = transactions.reduce((acc, t) => acc + t.amount, 0);
    const byCategory = transactions.reduce((acc, t) => {
      acc[t.category] = (acc[t.category] || 0) + t.amount;
      return acc;
    }, {} as Record<string, number>);

    const driftTotal = byCategory[TransactionCategory.Drift] || 0;
    const driftPercentage = total > 0 ? (driftTotal / total) * 100 : 0;

    const data = Object.keys(byCategory).map(cat => ({
      name: cat,
      value: byCategory[cat],
    })).filter(d => d.value > 0);

    return { total, byCategory, driftTotal, driftPercentage, data };
  }, [transactions]);

  if (transactions.length === 0) return null;

  return (
    <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-8">
      {/* Chart Card */}
      <Card className="col-span-1 md:col-span-1">
        <CardHeader>
            <CardTitle>Spending Breakdown</CardTitle>
        </CardHeader>
        <CardContent className="h-[250px]">
          <ResponsiveContainer width="100%" height="100%">
            <PieChart>
              <Pie
                data={stats.data}
                innerRadius={60}
                outerRadius={80}
                paddingAngle={5}
                dataKey="value"
              >
                {stats.data.map((entry, index) => (
                  <Cell key={`cell-${index}`} fill={COLORS[entry.name as TransactionCategory] || COLORS.Uncategorized} />
                ))}
              </Pie>
              <Tooltip formatter={(value: number) => formatCurrency(value)} />
              <Legend verticalAlign="bottom" height={36}/>
            </PieChart>
          </ResponsiveContainer>
        </CardContent>
      </Card>

      {/* Stats Cards */}
      <div className="col-span-1 md:col-span-2 grid grid-cols-1 sm:grid-cols-2 gap-4">
        {/* Total Spend */}
        <Card>
            <CardHeader className="pb-2">
                <CardTitle className="text-sm font-medium text-gray-500">Total Analyzed</CardTitle>
            </CardHeader>
            <CardContent>
                <div className="text-3xl font-bold">{formatCurrency(stats.total)}</div>
                <p className="text-xs text-gray-400 mt-1">{transactions.length} transactions</p>
            </CardContent>
        </Card>

        {/* Drift Alert */}
        <Card className={cn(stats.driftPercentage > 15 ? "border-orange-200 bg-orange-50" : "")}>
            <CardHeader className="pb-2 flex flex-row items-center justify-between space-y-0">
                <CardTitle className="text-sm font-medium text-gray-500">Drift Spending</CardTitle>
                <AlertTriangle className={cn("h-4 w-4", stats.driftPercentage > 15 ? "text-orange-500" : "text-gray-400")} />
            </CardHeader>
            <CardContent>
                <div className={cn("text-3xl font-bold", stats.driftPercentage > 15 ? "text-orange-700" : "text-gray-900")}>
                    {formatCurrency(stats.driftTotal)}
                </div>
                <div className="text-xs text-gray-500 mt-1">
                    {stats.driftPercentage.toFixed(1)}% of total. 
                    {stats.driftPercentage > 15 && <span className="font-semibold text-orange-600"> High drift detected!</span>}
                </div>
            </CardContent>
        </Card>

        {/* Essential */}
        <Card>
            <CardHeader className="pb-2 flex flex-row items-center justify-between space-y-0">
                <CardTitle className="text-sm font-medium text-gray-500">Essential</CardTitle>
                <TrendingUp className="h-4 w-4 text-gray-400" />
            </CardHeader>
            <CardContent>
                <div className="text-2xl font-bold text-gray-700">
                    {formatCurrency(stats.byCategory[TransactionCategory.Essential] || 0)}
                </div>
                <p className="text-xs text-gray-400 mt-1">Living expenses</p>
            </CardContent>
        </Card>

        {/* Joy */}
        <Card>
            <CardHeader className="pb-2 flex flex-row items-center justify-between space-y-0">
                <CardTitle className="text-sm font-medium text-gray-500">Joy & Growth</CardTitle>
                <Coffee className="h-4 w-4 text-purple-400" />
            </CardHeader>
            <CardContent>
                <div className="text-2xl font-bold text-purple-700">
                    {formatCurrency((stats.byCategory[TransactionCategory.Joy] || 0) + (stats.byCategory[TransactionCategory.Growth] || 0))}
                </div>
                <p className="text-xs text-gray-400 mt-1">Investments in yourself</p>
            </CardContent>
        </Card>
      </div>
    </div>
  );
};
