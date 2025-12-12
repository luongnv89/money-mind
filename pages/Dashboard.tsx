
import React, { useMemo, useState } from 'react';
import { useTransactionStore } from '../stores/useTransactionStore';
import { useSettingsStore, getDecryptedApiKey } from '../stores/useSettingsStore';
import { getPatterns } from '../lib/localStorage';
import { TransactionTable } from '../components/TransactionTable';
import { InsightsDashboard } from '../components/InsightsDashboard';
import { categorizeWithAI } from '../services/aiService';
import { Button, Card, CardContent } from '../components/UI';
import { Zap, AlertOctagon, Loader2, Settings, Calendar, RefreshCw, X, Activity, CheckCircle2, AlertTriangle, ArrowRightLeft, BookOpen, RotateCcw } from 'lucide-react';
import { TransactionCategory } from '../types';
import { cn } from '../lib/utils';

interface DashboardProps {
    onNavigate: (view: 'settings' | 'upload' | 'dashboard') => void;
}

interface AnalysisStats {
    total: number;
    changed: number;
    highConfidence: number;
    mediumConfidence: number;
    lowConfidence: number;
    duration: number;
}

type TimeRange = 'week' | 'month' | 'all';

export const Dashboard: React.FC<DashboardProps> = ({ onNavigate }) => {
    const { 
        transactions, 
        setCategorizing, 
        isCategorizing, 
        updateTransactionBatch, 
        applyLocalPatterns,
        setError,
        processedCount,
        totalToProcess,
        setProgressCounts
    } = useTransactionStore();
    
    const { aiMode, geminiConfig } = useSettingsStore();

    // Time Filter State
    const [timeRange, setTimeRange] = useState<TimeRange>('all');
    const [analysisStats, setAnalysisStats] = useState<AnalysisStats | null>(null);

    // Check if AI is configured
    const isAIConfigured = useMemo(() => {
        if (aiMode === 'local') return true; // Assume local is always "ready" to try
        const key = getDecryptedApiKey(useSettingsStore.getState());
        return !!key && key.length > 0;
    }, [aiMode, geminiConfig]);

    // Check if we have local patterns
    const hasPatterns = useMemo(() => {
        return getPatterns().length > 0;
    }, [transactions]); // Re-check when transactions change (implies potential learning)

    // Filter Logic
    const displayedTransactions = useMemo(() => {
        if (timeRange === 'all') return transactions;
        if (transactions.length === 0) return [];

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

    const performAIAnalysis = async (transactionsToProcess: any[]) => {
         setCategorizing(true);
         setAnalysisStats(null);
         setProgressCounts(0, transactionsToProcess.length);
         const startTime = Date.now();
         let changesDetected = 0;
         
         try {
             await categorizeWithAI(transactionsToProcess, aiMode, (results) => {
                 // 1. Calculate changes before updating
                 const currentStore = useTransactionStore.getState().transactions;
                 
                 results.forEach(res => {
                     const original = currentStore.find(t => t.id === res.id);
                     if (original) {
                         // Check if category or subcategory actually changed
                         if (original.category !== res.category || original.subCategory !== res.subCategory) {
                             changesDetected++;
                         }
                     }
                 });

                 // 2. Prepare updates
                 const updates = results.map(res => {
                     const original = transactions.find(t => t.id === res.id);
                     if (!original) return null;
                     return { 
                         ...original, 
                         category: res.category,
                         subCategory: res.subCategory, // Ensure subCategory is passed
                         confidence: res.confidence, 
                         reason: res.reason 
                     };
                 }).filter(Boolean) as any[];
 
                 // 3. Commit updates
                 updateTransactionBatch(updates);
                 const currentProcessed = useTransactionStore.getState().processedCount;
                 setProgressCounts(currentProcessed + results.length, transactionsToProcess.length);
             });

             // Calculate final stats after completion
             const duration = (Date.now() - startTime) / 1000;
             const currentTransactions = useTransactionStore.getState().transactions;
             const processedIds = new Set(transactionsToProcess.map(t => t.id));
             
             // Get the updated versions of the processed transactions
             const processed = currentTransactions.filter(t => processedIds.has(t.id));
             
             if (processed.length > 0) {
                 setAnalysisStats({
                     total: processed.length,
                     changed: changesDetected,
                     highConfidence: processed.filter(t => t.confidence >= 0.8).length,
                     mediumConfidence: processed.filter(t => t.confidence >= 0.5 && t.confidence < 0.8).length,
                     lowConfidence: processed.filter(t => t.confidence < 0.5).length,
                     duration
                 });
             }
             
         } catch (e: any) {
             setError(e.message);
         } finally {
             setCategorizing(false);
             setProgressCounts(0, 0);
         }
    };

    const handleInitialCategorize = async () => {
        if (!isAIConfigured) {
            onNavigate('settings');
            return;
        }

        const toProcess = transactions.filter(t => t.category === TransactionCategory.Uncategorized);
        if (toProcess.length === 0) return;
        
        await performAIAnalysis(toProcess);
    };

    const handleReanalyzeAll = async () => {
        if (!isAIConfigured) {
            onNavigate('settings');
            return;
        }
        
        // Re-analyze everything that is NOT explicitly approved
        const toProcess = transactions.filter(t => !t.isApproved);
        if (toProcess.length === 0) {
            return;
        }

        await performAIAnalysis(toProcess);
    };

    const handleRetryFailed = async () => {
        if (!isAIConfigured) {
            onNavigate('settings');
            return;
        }

        // Retry transactions that have an explicit error or are uncategorized with an error reason
        const toProcess = transactions.filter(t => t.reason?.includes('Failed') || t.reason?.includes('Error'));
        if (toProcess.length === 0) return;
        
        await performAIAnalysis(toProcess);
    }

    const handleApplyRules = () => {
        const count = applyLocalPatterns();
        setAnalysisStats({
            total: transactions.length, // Context: scanned all transactions
            changed: count,
            highConfidence: count, // Patterns represent high confidence
            mediumConfidence: 0,
            lowConfidence: 0,
            duration: 0.1
        });
    };

    const uncategorizedCount = transactions.filter(t => t.category === TransactionCategory.Uncategorized).length;
    const failedCount = transactions.filter(t => t.reason?.includes('Failed') || t.reason?.includes('Error')).length;
    const progressPercent = totalToProcess > 0 ? Math.round((processedCount / totalToProcess) * 100) : 0;
    const unapprovedCount = transactions.filter(t => !t.isApproved).length;

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
                    <div className="flex flex-col items-end gap-1.5">
                        <div className="flex flex-col sm:flex-row items-end sm:items-center gap-2">
                            {/* Retry Failed Button */}
                            {failedCount > 0 && (
                                <Button 
                                    onClick={handleRetryFailed} 
                                    size="lg" 
                                    variant="outline"
                                    className="border-red-200 text-red-700 bg-red-50 hover:bg-red-100"
                                >
                                    <RotateCcw className="w-4 h-4 mr-2" />
                                    Retry {failedCount} Failed
                                </Button>
                            )}

                            {/* Apply Rules Button */}
                            {hasPatterns && unapprovedCount > 0 && (
                                <Button
                                    onClick={handleApplyRules}
                                    size="lg"
                                    variant="outline"
                                    className="border-indigo-200 text-indigo-700 bg-indigo-50 hover:bg-indigo-100"
                                    title="Apply learned rules to unverified transactions"
                                >
                                    <BookOpen className="w-4 h-4 mr-2" />
                                    Apply Rules
                                </Button>
                            )}

                            {/* Main Analyze Buttons */}
                            {uncategorizedCount > 0 ? (
                                <Button 
                                    onClick={handleInitialCategorize} 
                                    size="lg" 
                                    className="shadow-lg shadow-accent/20"
                                    variant={isAIConfigured ? 'primary' : 'secondary'}
                                >
                                    <Zap className="w-4 h-4 mr-2 fill-current" />
                                    Analyze {uncategorizedCount} Pending
                                </Button>
                            ) : transactions.some(t => !t.isApproved) ? (
                                <Button
                                    onClick={handleReanalyzeAll}
                                    size="lg"
                                    variant="outline"
                                    className="border-gray-300 text-gray-700 hover:bg-gray-50"
                                    title="Re-analyze all unapproved transactions"
                                >
                                    <RefreshCw className="w-4 h-4 mr-2" />
                                    Re-analyze
                                </Button>
                            ) : null}
                            
                            {!isAIConfigured && (
                                <Button 
                                    onClick={() => onNavigate('settings')}
                                    variant="ghost"
                                    size="sm"
                                    className="text-red-500 hover:text-red-600 hover:bg-red-50 border border-red-100"
                                >
                                    <Settings className="w-4 h-4 mr-2" />
                                    Config AI
                                </Button>
                            )}
                        </div>
                        
                        {!isAIConfigured && (
                            <span className="text-[10px] text-gray-400 font-medium bg-gray-50 px-2 py-1 rounded border border-gray-100">
                                Configure AI to enable automatic categorization & analysis
                            </span>
                        )}
                    </div>
                )}
            </div>

            {/* Analysis Stats Summary */}
            {analysisStats && (
                <div className="bg-white border border-green-200 rounded-xl p-4 shadow-sm relative animate-in fade-in slide-in-from-top-4">
                    <button 
                        onClick={() => setAnalysisStats(null)}
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
                                Processed {analysisStats.total} transactions in {analysisStats.duration.toFixed(1)}s
                            </p>
                        </div>
                    </div>

                    <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
                        {/* New Changed Stat */}
                        <div className="bg-indigo-50 rounded-lg p-3 border border-indigo-100">
                             <div className="flex items-center gap-1.5 mb-1">
                                <ArrowRightLeft className="w-3.5 h-3.5 text-indigo-600" />
                                <div className="text-xs text-indigo-700 font-medium uppercase tracking-wide">Updates Applied</div>
                            </div>
                            <div className="text-2xl font-bold text-indigo-700">{analysisStats.changed}</div>
                            <div className="text-[10px] text-indigo-600/70">Categories changed</div>
                        </div>

                        <div className="bg-green-50 rounded-lg p-3 border border-green-100">
                            <div className="flex items-center gap-1.5 mb-1">
                                <CheckCircle2 className="w-3.5 h-3.5 text-green-600" />
                                <div className="text-xs text-green-700 font-medium uppercase tracking-wide">High Confidence</div>
                            </div>
                            <div className="text-2xl font-bold text-green-700">{analysisStats.highConfidence}</div>
                            <div className="text-[10px] text-green-600/70">Strong AI matches</div>
                        </div>
                        
                        <div className="bg-yellow-50 rounded-lg p-3 border border-yellow-100">
                            <div className="flex items-center gap-1.5 mb-1">
                                <Activity className="w-3.5 h-3.5 text-yellow-600" />
                                <div className="text-xs text-yellow-700 font-medium uppercase tracking-wide">Medium Confidence</div>
                            </div>
                            <div className="text-2xl font-bold text-yellow-700">{analysisStats.mediumConfidence}</div>
                            <div className="text-[10px] text-yellow-600/70">Likely correct</div>
                        </div>

                        <div className="bg-red-50 rounded-lg p-3 border border-red-100">
                            <div className="flex items-center gap-1.5 mb-1">
                                <AlertTriangle className="w-3.5 h-3.5 text-red-600" />
                                <div className="text-xs text-red-700 font-medium uppercase tracking-wide">Low Confidence</div>
                            </div>
                            <div className="text-2xl font-bold text-red-700">{analysisStats.lowConfidence}</div>
                            <div className="text-[10px] text-red-600/70">Review needed</div>
                        </div>
                    </div>
                </div>
            )}

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
