
import React, { useMemo } from 'react';
import { PieChart, Pie, Cell, ResponsiveContainer, Tooltip, Legend, BarChart, Bar, XAxis, YAxis, CartesianGrid } from 'recharts';
import { TransactionCategory, Transaction } from '../types';
import { Card, CardContent, CardHeader, CardTitle } from './UI';
import { formatCurrency, cn } from '../lib/utils';
import { AlertTriangle, TrendingUp, PiggyBank, Coffee, ArrowDownCircle, ArrowUpCircle, ShieldCheck, Zap } from 'lucide-react';

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
  transactions: Transaction[];
}

export const InsightsDashboard: React.FC<InsightsDashboardProps> = ({ transactions }) => {
  const stats = useMemo(() => {
    // Total processed (Net Flow)
    const total = transactions.reduce((acc, t) => acc + t.amount, 0);
    
    const byCategory = transactions.reduce((acc, t) => {
      acc[t.category] = (acc[t.category] || 0) + t.amount;
      return acc;
    }, {} as Record<string, number>);

    // Total spending (exclude income and transfers for percentage calculation base if needed, 
    // but for "Waste % of total spending" we generally sum up negative expenses)
    const totalExpenses = Math.abs(transactions
        .filter(t => t.amount < 0 && t.category !== TransactionCategory.InternalTransfer)
        .reduce((acc, t) => acc + t.amount, 0));

    const wasteTotal = Math.abs(byCategory[TransactionCategory.Waste] || 0);
    const wastePercentage = totalExpenses !== 0 ? (wasteTotal / totalExpenses) * 100 : 0;

    const data = Object.keys(byCategory).map(cat => ({
      name: cat,
      value: Math.abs(byCategory[cat]),
    })).filter(d => d.value > 0 && d.name !== TransactionCategory.InternalTransfer && d.name !== TransactionCategory.Income);

    // Cash Flow Stats
    const income = transactions.filter(t => t.amount > 0 && t.category !== TransactionCategory.InternalTransfer).reduce((acc, t) => acc + t.amount, 0);
    const expense = transactions.filter(t => t.amount < 0 && t.category !== TransactionCategory.InternalTransfer).reduce((acc, t) => acc + t.amount, 0);
    
    const cashFlowData = [
        { name: 'Income', value: income },
        { name: 'Expenses', value: Math.abs(expense) }
    ];

    return { total, byCategory, wasteTotal, wastePercentage, data, income, expense, cashFlowData };
  }, [transactions]);

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
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {/* Spending Breakdown Pie */}
        <Card className="border-gray-200">
            <CardHeader className="pb-0 pt-4 px-4">
                <CardTitle className="text-sm font-medium text-gray-700">Spending Breakdown (Expenses)</CardTitle>
            </CardHeader>
            <CardContent className="h-[180px] p-2">
            <ResponsiveContainer width="100%" height="100%">
                <PieChart>
                <Pie
                    data={stats.data}
                    innerRadius={50}
                    outerRadius={70}
                    paddingAngle={4}
                    dataKey="value"
                    cy="50%"
                >
                    {stats.data.map((entry, index) => (
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

        {/* Cash Flow Bar Chart */}
        <Card className="border-gray-200">
             <CardHeader className="pb-0 pt-4 px-4">
                <CardTitle className="text-sm font-medium text-gray-700">Cash Flow (Net)</CardTitle>
            </CardHeader>
            <CardContent className="h-[180px] p-2">
                <ResponsiveContainer width="100%" height="100%">
                    <BarChart data={stats.cashFlowData} layout="vertical" margin={{ top: 5, right: 30, left: 10, bottom: 5 }}>
                        <CartesianGrid strokeDasharray="3 3" horizontal={false} stroke="#f0f0f0" />
                        <XAxis type="number" hide />
                        <YAxis dataKey="name" type="category" axisLine={false} tickLine={false} width={70} tick={{fontSize: 12, fill: '#6B7280'}} />
                        <Tooltip 
                            formatter={(value: number) => formatCurrency(value)} 
                            cursor={{fill: '#F3F4F6'}}
                            contentStyle={{ borderRadius: '8px', border: 'none', boxShadow: '0 4px 6px -1px rgb(0 0 0 / 0.1)' }}
                        />
                        <Bar dataKey="value" radius={[0, 4, 4, 0]} barSize={32}>
                            {
                                stats.cashFlowData.map((entry, index) => (
                                    <Cell key={`cell-${index}`} fill={entry.name === 'Income' ? '#22c55e' : '#ef4444'} />
                                ))
                            }
                        </Bar>
                    </BarChart>
                </ResponsiveContainer>
            </CardContent>
        </Card>
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
