
import React, { useMemo } from 'react';
import { PieChart, Pie, Cell, ResponsiveContainer, Tooltip, Legend, BarChart, Bar, XAxis, YAxis, CartesianGrid } from 'recharts';
import { TransactionCategory, Transaction } from '../types';
import { Card, CardContent, CardHeader, CardTitle } from './UI';
import { formatCurrency, cn } from '../lib/utils';
import { AlertTriangle, TrendingUp, PiggyBank, Coffee, ArrowDownCircle, ArrowUpCircle, ShieldCheck, Zap, BarChart3, TrendingDown } from 'lucide-react';

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
  transactions: Transaction[]; // The currently filtered transactions (e.g. "Last Week")
  allTransactions: Transaction[]; // Full history for calculating averages
}

export const InsightsDashboard: React.FC<InsightsDashboardProps> = ({ transactions, allTransactions }) => {
  const stats = useMemo(() => {
    // Total processed (Net Flow) for current view
    const total = transactions.reduce((acc, t) => acc + t.amount, 0);
    
    const byCategory = transactions.reduce((acc, t) => {
      acc[t.category] = (acc[t.category] || 0) + t.amount;
      return acc;
    }, {} as Record<string, number>);

    // Total spending (exclude income and transfers)
    const totalExpenses = Math.abs(transactions
        .filter(t => t.amount < 0 && t.category !== TransactionCategory.InternalTransfer)
        .reduce((acc, t) => acc + t.amount, 0));

    const wasteTotal = Math.abs(byCategory[TransactionCategory.Waste] || 0);
    const wastePercentage = totalExpenses !== 0 ? (wasteTotal / totalExpenses) * 100 : 0;

    const pieData = Object.keys(byCategory).map(cat => ({
      name: cat,
      value: Math.abs(byCategory[cat]),
    })).filter(d => d.value > 0 && d.name !== TransactionCategory.InternalTransfer && d.name !== TransactionCategory.Income);

    return { total, byCategory, wasteTotal, wastePercentage, pieData, totalExpenses };
  }, [transactions]);

  // --- Historical Analysis Logic ---
  const monthlyStats = useMemo(() => {
      if (allTransactions.length === 0) return null;

      // 1. Identify Month Keys (YYYY-MM) and Filter Expenses
      const expenseHistory = allTransactions.filter(t => t.amount < 0 && t.category !== TransactionCategory.InternalTransfer);
      
      const months = [...new Set(expenseHistory.map(t => t.date.substring(0, 7)))];
      const monthCount = Math.max(1, months.length);

      // 2. Calculate Global Averages
      const totalHistoryExpenses = expenseHistory.reduce((acc, t) => acc + Math.abs(t.amount), 0);
      const avgMonthlyExpense = totalHistoryExpenses / monthCount;

      const totalMustHave = expenseHistory.filter(t => t.category === TransactionCategory.MustHave).reduce((acc, t) => acc + Math.abs(t.amount), 0);
      const avgMustHave = totalMustHave / monthCount;

      const totalNiceToHave = expenseHistory.filter(t => t.category === TransactionCategory.NiceToHave).reduce((acc, t) => acc + Math.abs(t.amount), 0);
      const avgNiceToHave = totalNiceToHave / monthCount;

      // 3. Determine "Current" Month (Latest month in data)
      // We use the latest month available in data to ensure Demo Data works correctly even if generated for "past" dates relative to real today
      const sortedDates = allTransactions.map(t => t.date).sort();
      const latestDate = sortedDates[sortedDates.length - 1];
      const currentMonthKey = latestDate ? latestDate.substring(0, 7) : new Date().toISOString().substring(0, 7);

      const currentMonthTx = expenseHistory.filter(t => t.date.startsWith(currentMonthKey));
      
      const currentTotal = currentMonthTx.reduce((acc, t) => acc + Math.abs(t.amount), 0);
      const currentMustHave = currentMonthTx.filter(t => t.category === TransactionCategory.MustHave).reduce((acc, t) => acc + Math.abs(t.amount), 0);
      const currentNiceToHave = currentMonthTx.filter(t => t.category === TransactionCategory.NiceToHave).reduce((acc, t) => acc + Math.abs(t.amount), 0);

      // Helper to calculate bar stats
      const getBarData = (current: number, avg: number) => {
          const percent = avg === 0 ? 0 : (current / avg) * 100;
          let status: 'good' | 'warning' | 'danger' = 'good';
          if (percent > 110) status = 'danger';
          else if (percent > 90) status = 'warning';
          
          return { current, avg, percent, status };
      };

      return {
          monthLabel: new Date(currentMonthKey + '-02').toLocaleString('default', { month: 'long', year: 'numeric' }),
          total: getBarData(currentTotal, avgMonthlyExpense),
          mustHave: getBarData(currentMustHave, avgMustHave),
          niceToHave: getBarData(currentNiceToHave, avgNiceToHave)
      };

  }, [allTransactions]);

  if (transactions.length === 0) {
      return (
        <div className="p-8 text-center bg-white rounded-lg border border-gray-200 text-gray-500 text-sm mb-4">
            Not enough data in this time range to generate insights.
        </div>
      );
  }

  return (
    <div className="space-y-4 mb-4">
      {/* Top Row: Visualizations */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        {/* Spending Breakdown Pie */}
        <Card className="border-gray-200 flex flex-col">
            <CardHeader className="pb-0 pt-4 px-4">
                <CardTitle className="text-sm font-medium text-gray-700">Spending Breakdown</CardTitle>
            </CardHeader>
            <CardContent className="flex-1 min-h-[180px] p-2">
                <ResponsiveContainer width="100%" height="100%">
                    <PieChart>
                    <Pie
                        data={stats.pieData}
                        innerRadius={50}
                        outerRadius={70}
                        paddingAngle={4}
                        dataKey="value"
                        cy="50%"
                    >
                        {stats.pieData.map((entry, index) => (
                        <Cell key={`cell-${index}`} fill={COLORS[entry.name as TransactionCategory] || COLORS.Uncategorized} />
                        ))}
                    </Pie>
                    <Tooltip formatter={(value: number) => formatCurrency(value)} />
                    <Legend 
                        verticalAlign="middle" 
                        align="right" 
                        layout="vertical"
                        iconSize={8}
                        wrapperStyle={{ fontSize: '10px' }}
                    />
                    </PieChart>
                </ResponsiveContainer>
            </CardContent>
        </Card>

        {/* Monthly Budget Watch (Comparison Bars) */}
        {monthlyStats && (
            <Card className="border-gray-200 flex flex-col">
                <CardHeader className="pb-2 pt-4 px-4 flex flex-row items-center justify-between">
                    <CardTitle className="text-sm font-medium text-gray-700 flex items-center gap-2">
                        <BarChart3 className="w-4 h-4 text-gray-500" />
                        Monthly Watch <span className="text-gray-400 font-normal">({monthlyStats.monthLabel})</span>
                    </CardTitle>
                </CardHeader>
                <CardContent className="flex-1 p-4 space-y-5">
                    {/* Total Spending Bar */}
                    <div className="space-y-1.5">
                        <div className="flex justify-between text-xs">
                            <span className="font-medium text-gray-600">Total Spending</span>
                            <div className="flex gap-1.5">
                                <span className={cn(
                                    "font-bold", 
                                    monthlyStats.total.status === 'danger' ? "text-red-600" : 
                                    monthlyStats.total.status === 'warning' ? "text-amber-600" : "text-gray-900"
                                )}>
                                    {formatCurrency(monthlyStats.total.current)}
                                </span>
                                <span className="text-gray-400">/ {formatCurrency(monthlyStats.total.avg)} avg</span>
                            </div>
                        </div>
                        <div className="h-2.5 w-full bg-gray-100 rounded-full overflow-hidden relative">
                             {/* Average Marker Line (at 100%) if current is low, or relative */}
                             <div 
                                className={cn(
                                    "h-full rounded-full transition-all duration-500",
                                    monthlyStats.total.status === 'danger' ? "bg-red-500" :
                                    monthlyStats.total.status === 'warning' ? "bg-amber-400" : "bg-blue-500"
                                )}
                                style={{ width: `${Math.min(monthlyStats.total.percent, 100)}%` }}
                             />
                        </div>
                        {monthlyStats.total.status === 'danger' && (
                            <div className="flex items-center gap-1 text-[10px] text-red-600 font-medium animate-pulse">
                                <TrendingUp className="w-3 h-3" />
                                {Math.round(monthlyStats.total.percent - 100)}% over average
                            </div>
                        )}
                    </div>

                    <div className="grid grid-cols-2 gap-4">
                        {/* Must Have Bar */}
                        <div className="space-y-1.5">
                            <div className="flex justify-between text-xs">
                                <span className="font-medium text-gray-500">Must-Have</span>
                                <span className={cn("font-medium", monthlyStats.mustHave.status === 'danger' ? "text-red-600" : "text-gray-700")}>
                                    {Math.round(monthlyStats.mustHave.percent)}%
                                </span>
                            </div>
                            <div className="h-1.5 w-full bg-gray-100 rounded-full overflow-hidden">
                                <div 
                                    className={cn("h-full rounded-full transition-all duration-500", monthlyStats.mustHave.status === 'danger' ? "bg-red-400" : "bg-gray-400")}
                                    style={{ width: `${Math.min(monthlyStats.mustHave.percent, 100)}%` }}
                                />
                            </div>
                        </div>

                        {/* Nice To Have Bar */}
                        <div className="space-y-1.5">
                            <div className="flex justify-between text-xs">
                                <span className="font-medium text-gray-500">Nice-to-Have</span>
                                <span className={cn("font-medium", monthlyStats.niceToHave.status === 'danger' ? "text-red-600" : "text-gray-700")}>
                                    {Math.round(monthlyStats.niceToHave.percent)}%
                                </span>
                            </div>
                            <div className="h-1.5 w-full bg-gray-100 rounded-full overflow-hidden">
                                <div 
                                    className={cn("h-full rounded-full transition-all duration-500", monthlyStats.niceToHave.status === 'danger' ? "bg-red-400" : "bg-blue-400")}
                                    style={{ width: `${Math.min(monthlyStats.niceToHave.percent, 100)}%` }}
                                />
                            </div>
                        </div>
                    </div>
                </CardContent>
            </Card>
        )}
      </div>

      {/* Bottom Row: Key Metrics */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
        {/* Net Flow */}
        <Card className="flex flex-col justify-center">
            <CardContent className="p-4 flex flex-row items-center justify-between">
                <div>
                    <p className="text-xs font-medium text-gray-500 uppercase tracking-wide">Net Flow</p>
                    <div className={cn("text-2xl font-bold mt-1", stats.total > 0 ? "text-green-600" : "text-gray-900")}>
                        {formatCurrency(stats.total)}
                    </div>
                    <p className="text-[10px] text-gray-400 mt-0.5">Total processed</p>
                </div>
                <div className={cn("h-10 w-10 rounded-full flex items-center justify-center", stats.total > 0 ? "bg-green-50" : "bg-gray-50")}>
                    {stats.total > 0 ? <ArrowUpCircle className="w-5 h-5 text-green-500" /> : <ArrowDownCircle className="w-5 h-5 text-gray-400" />}
                </div>
            </CardContent>
        </Card>

        {/* Waste Alert (was Drift) */}
        <Card className={cn("flex flex-col justify-center", stats.wastePercentage > 10 ? "border-amber-200 bg-amber-50/50" : "")}>
            <CardContent className="p-4 flex flex-row items-center justify-between">
                <div>
                    <div className="flex items-center gap-2">
                        <p className="text-xs font-medium text-gray-500 uppercase tracking-wide">Waste / Fees</p>
                        {stats.wastePercentage > 10 && <AlertTriangle className="h-3 w-3 text-amber-500" />}
                    </div>
                    <div className={cn("text-2xl font-bold mt-1", stats.wastePercentage > 10 ? "text-amber-700" : "text-gray-900")}>
                        {formatCurrency(stats.wasteTotal)}
                    </div>
                    <p className="text-[10px] text-gray-400 mt-0.5">{stats.wastePercentage.toFixed(1)}% of expenses</p>
                </div>
                 <div className={cn("h-10 w-10 rounded-full flex items-center justify-center", stats.wastePercentage > 10 ? "bg-amber-100" : "bg-gray-50")}>
                    <TrendingUp className={cn("w-5 h-5", stats.wastePercentage > 10 ? "text-amber-500" : "text-gray-400")} />
                </div>
            </CardContent>
        </Card>

        {/* Must-have (was Essential) */}
        <Card className="flex flex-col justify-center">
            <CardContent className="p-4 flex flex-row items-center justify-between">
                <div>
                    <p className="text-xs font-medium text-gray-500 uppercase tracking-wide">Must-Have</p>
                    <div className="text-xl font-bold text-gray-700 mt-1">
                        {formatCurrency(Math.abs(stats.byCategory[TransactionCategory.MustHave] || 0))}
                    </div>
                    <p className="text-[10px] text-gray-400 mt-0.5">Living expenses</p>
                </div>
                <div className="h-8 w-8 bg-red-50 rounded-full flex items-center justify-center">
                     <ShieldCheck className="w-4 h-4 text-red-400" />
                </div>
            </CardContent>
        </Card>

        {/* Nice-to-have & Invest (was Joy & Growth) */}
        <Card className="flex flex-col justify-center">
            <CardContent className="p-4 flex flex-row items-center justify-between">
                <div>
                    <p className="text-xs font-medium text-gray-500 uppercase tracking-wide">Life & Future</p>
                    <div className="text-xl font-bold text-blue-700 mt-1">
                        {formatCurrency(Math.abs((stats.byCategory[TransactionCategory.NiceToHave] || 0) + (stats.byCategory[TransactionCategory.Invest] || 0) + (stats.byCategory[TransactionCategory.Save] || 0)))}
                    </div>
                    <p className="text-[10px] text-gray-400 mt-0.5">Nice-to-have + Invest</p>
                </div>
                <div className="h-8 w-8 bg-blue-50 rounded-full flex items-center justify-center">
                    <Zap className="w-4 h-4 text-blue-500" />
                </div>
            </CardContent>
        </Card>
      </div>
    </div>
  );
};
