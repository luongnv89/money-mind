import React, { useMemo, useState } from 'react';
import { useTransactionStore } from '../stores/useTransactionStore';
import { useSettingsStore, getDecryptedApiKey } from '../stores/useSettingsStore';
import { TransactionTable } from '../components/TransactionTable';
import { InsightsDashboard } from '../components/InsightsDashboard';
import { categorizeWithAI } from '../services/aiService';
import { Button, Card, CardContent } from '../components/UI';
import { Zap, AlertOctagon, Loader2, Settings, Calendar } from 'lucide-react';
import { TransactionCategory } from '../types';
import { cn } from '../lib/utils';

interface DashboardProps {
    onNavigate: (view: 'settings' | 'upload' | 'dashboard') => void;
}

type TimeRange = 'week' | 'month' | 'all';

export const Dashboard: React.FC<DashboardProps> = ({ onNavigate }) => {
    const { 
        transactions, 
        setCategorizing, 
        isCategorizing, 
        updateTransactionBatch, 
        setError,
        processedCount,
        totalToProcess,
        setProgressCounts
    } = useTransactionStore();
    
    const { aiMode, geminiConfig } = useSettingsStore();

    // Time Filter State
    const [timeRange, setTimeRange] = useState<TimeRange>('all');

    // Check if AI is configured
    const isAIConfigured = useMemo(() => {
        if (aiMode === 'local') return true; // Assume local is always "ready" to try
        const key = getDecryptedApiKey(useSettingsStore.getState());
        return !!key && key.length > 0;
    }, [aiMode, geminiConfig]);

    // Filter Logic
    const displayedTransactions = useMemo(() => {
        if (timeRange === 'all') return transactions;
        if (transactions.length === 0) return [];

        // Find the latest date in the dataset to act as "Now"
        // This handles historical data uploads better than using new Date()
        const getTimestamp = (d: string) => {
            const date = new Date(d);
            return isNaN(date.getTime()) ? 0 : date.getTime();
        };

        const timestamps = transactions.map(t => getTimestamp(t.date)).filter(t => t > 0);
        if (timestamps.length === 0) return transactions;
        
        const maxDate = Math.max(...timestamps);
        const msPerDay = 1000 * 60 * 60 * 24;
        
        let daysToSubtract = 0;
        if (timeRange === 'week') daysToSubtract = 7;
        if (timeRange === 'month') daysToSubtract = 30;
        
        const cutoff = maxDate - (daysToSubtract * msPerDay);
        
        return transactions.filter(t => getTimestamp(t.date) >= cutoff);
    }, [transactions, timeRange]);

    // Calculate Date Range String
    const dateRangeDisplay = useMemo(() => {
        if (displayedTransactions.length === 0) return '';
        
        const timestamps = displayedTransactions
            .map(t => new Date(t.date).getTime())
            .filter(t => !isNaN(t));
            
        if (timestamps.length === 0) return '';

        const min = Math.min(...timestamps);
        const max = Math.max(...timestamps);
        
        const format = (ts: number) => new Intl.DateTimeFormat('en-US', { 
            month: 'short', 
            day: 'numeric', 
            year: 'numeric' 
        }).format(new Date(ts));

        if (min === max) return format(min);
        return `${format(min)} - ${format(max)}`;
    }, [displayedTransactions]);

    const handleCategorize = async () => {
        if (!isAIConfigured) {
            onNavigate('settings');
            return;
        }

        const toProcess = transactions.filter(t => t.category === TransactionCategory.Uncategorized);
        if (toProcess.length === 0) return;

        setCategorizing(true);
        setProgressCounts(0, toProcess.length);
        
        try {
            await categorizeWithAI(transactions, aiMode, (results) => {
                const updates = results.map(res => {
                    const original = transactions.find(t => t.id === res.id);
                    if (!original) return null;
                    return { 
                        ...original, 
                        category: res.category, 
                        confidence: res.confidence, 
                        reason: res.reason 
                    };
                }).filter(Boolean) as any[];

                updateTransactionBatch(updates);
                const currentProcessed = useTransactionStore.getState().processedCount;
                setProgressCounts(currentProcessed + results.length, toProcess.length);
            });
            
        } catch (e: any) {
            setError(e.message);
        } finally {
            setCategorizing(false);
            setProgressCounts(0, 0);
        }
    };

    const uncategorizedCount = transactions.filter(t => t.category === TransactionCategory.Uncategorized).length;
    const progressPercent = totalToProcess > 0 ? Math.round((processedCount / totalToProcess) * 100) : 0;

    if (transactions.length === 0) {
        return (
            <div className="text-center py-20 animate-in fade-in duration-500">
                <div className="w-16 h-16 bg-gray-100 rounded-full flex items-center justify-center mx-auto mb-4">
                    <AlertOctagon className="w-8 h-8 text-gray-400" />
                </div>
                <h3 className="text-lg font-medium text-gray-900">No transactions yet</h3>
                <p className="text-gray-500 mt-2 max-w-sm mx-auto">
                    Upload a bank statement to get started with the analysis.
                </p>
                <Button className="mt-6" onClick={() => onNavigate('upload')}>
                    Upload File
                </Button>
            </div>
        );
    }

    return (
        <div className="space-y-6 animate-in slide-in-from-bottom-4 duration-500">
            <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 border-b border-gray-200 pb-4">
                <div>
                    <h2 className="text-2xl font-bold text-gray-900">Financial Intelligence</h2>
                    <p className="text-sm text-gray-500">{transactions.length} transactions loaded</p>
                </div>
                
                {/* Action Area */}
                {isCategorizing ? (
                    <Card className="w-full sm:w-80 shadow-md border-accent/20 bg-accent/5">
                        <CardContent className="p-3">
                            <div className="space-y-2">
                                <div className="flex justify-between text-xs font-semibold text-accent-hover">
                                    <span className="flex items-center gap-1">
                                        <Loader2 className="w-3 h-3 animate-spin" />
                                        Analyzing...
                                    </span>
                                    <span>{processedCount} / {totalToProcess} ({progressPercent}%)</span>
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
                ) : (
                    uncategorizedCount > 0 && (
                        <div className="flex flex-col items-end gap-2">
                            <Button 
                                onClick={handleCategorize} 
                                size="lg" 
                                className="shadow-lg shadow-accent/20 animate-in fade-in"
                                variant={isAIConfigured ? 'primary' : 'secondary'}
                            >
                                <Zap className="w-4 h-4 mr-2 fill-current" />
                                Analyze automatically with AI
                            </Button>
                            
                            {!isAIConfigured && (
                                <button 
                                    onClick={() => onNavigate('settings')}
                                    className="text-xs text-red-500 hover:text-red-600 flex items-center gap-1 font-medium transition-colors"
                                >
                                    <Settings className="w-3 h-3" />
                                    AI not configured. Click to setup.
                                </button>
                            )}
                        </div>
                    )
                )}
            </div>

            {/* Time Filter Controls */}
            <div className="flex flex-col sm:flex-row justify-between items-end sm:items-center gap-4">
                <div className="flex items-center gap-2 text-sm text-gray-600 font-medium">
                    <Calendar className="w-4 h-4 text-gray-400" />
                    <span>
                        Viewing: 
                        <span className="text-gray-900 ml-1">
                            {timeRange === 'week' ? 'Last 7 Days' : timeRange === 'month' ? 'Last 30 Days' : 'All History'}
                        </span>
                        {dateRangeDisplay && <span className="text-gray-500 font-normal text-xs ml-2">({dateRangeDisplay})</span>}
                    </span>
                </div>
                <div className="flex bg-gray-100 p-1 rounded-lg">
                    {['Week', 'Month', 'All Time'].map((label) => {
                        const value = label.toLowerCase().replace(' time', '') as TimeRange;
                        const isActive = timeRange === value;
                        return (
                            <button
                                key={label}
                                onClick={() => setTimeRange(value)}
                                className={cn(
                                    "px-4 py-1.5 text-xs font-medium rounded-md transition-all",
                                    isActive ? "bg-white text-gray-900 shadow-sm" : "text-gray-500 hover:text-gray-700"
                                )}
                            >
                                {label}
                            </button>
                        );
                    })}
                </div>
            </div>

            {/* Stats Dashboard */}
            <InsightsDashboard transactions={displayedTransactions} />

            <div className="space-y-3 pt-2">
                <div className="flex items-center justify-between">
                    <h3 className="text-lg font-semibold text-gray-900">
                        Transaction History 
                        <span className="text-gray-400 text-sm font-normal ml-2">({displayedTransactions.length} items)</span>
                    </h3>
                </div>
                <TransactionTable transactions={displayedTransactions} />
            </div>
        </div>
    );
};