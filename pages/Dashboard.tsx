import React from 'react';
import { useTransactionStore } from '../stores/useTransactionStore';
import { useSettingsStore } from '../stores/useSettingsStore';
import { TransactionTable } from '../components/TransactionTable';
import { InsightsDashboard } from '../components/InsightsDashboard';
import { categorizeWithAI } from '../services/aiService';
import { Button, Card, CardContent } from '../components/UI';
import { Zap, AlertOctagon, Loader2 } from 'lucide-react';
import { TransactionCategory } from '../types';

export const Dashboard: React.FC = () => {
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
    const { aiMode } = useSettingsStore();

    const handleCategorize = async () => {
        const toProcess = transactions.filter(t => t.category === TransactionCategory.Uncategorized);
        if (toProcess.length === 0) return;

        setCategorizing(true);
        // Initialize progress
        setProgressCounts(0, toProcess.length);
        
        try {
            // We pass a callback that updates the store as chunks arrive
            await categorizeWithAI(transactions, aiMode, (results) => {
                // 1. Create updated transaction objects
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

                // 2. Update store immediately (re-renders table/charts)
                updateTransactionBatch(updates);

                // 3. Update progress count
                // Note: We use a functional update on the store side usually, but here we can just read current state if needed
                // but simpler to track locally or just increment.
                // However, since `categorizeWithAI` is async and `processedCount` is in store,
                // we'll rely on the previous value in the store + batch size.
                // Actually, cleaner to read from store ref if available, but for now let's just use the store's previous value
                // accessed via getState() inside the store logic or just pass increment.
                // To keep it simple in this component:
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
            </div>
        );
    }

    return (
        <div className="space-y-8 animate-in slide-in-from-bottom-4 duration-500">
            <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 border-b border-gray-200 pb-6">
                <div>
                    <h2 className="text-2xl font-bold text-gray-900">Financial Snapshot</h2>
                    <p className="text-gray-500">{transactions.length} transactions loaded</p>
                </div>
                
                {/* Action Area: Either Button or Progress Bar */}
                {isCategorizing ? (
                    <Card className="w-full sm:w-80 shadow-md border-accent/20 bg-accent/5">
                        <CardContent className="p-4">
                            <div className="space-y-2">
                                <div className="flex justify-between text-xs font-semibold text-accent-hover">
                                    <span className="flex items-center gap-1">
                                        <Loader2 className="w-3 h-3 animate-spin" />
                                        Analyzing...
                                    </span>
                                    <span>{processedCount} / {totalToProcess} ({progressPercent}%)</span>
                                </div>
                                <div className="h-2 w-full bg-gray-200 rounded-full overflow-hidden">
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
                        <Button onClick={handleCategorize} size="lg" className="shadow-lg shadow-accent/20 animate-in fade-in">
                            <Zap className="w-4 h-4 mr-2 fill-current" />
                            Categorize {uncategorizedCount} Items
                        </Button>
                    )
                )}
            </div>

            <InsightsDashboard />

            <div className="space-y-4">
                <div className="flex items-center justify-between">
                    <h3 className="text-lg font-semibold text-gray-900">Transactions</h3>
                </div>
                <TransactionTable />
            </div>
        </div>
    );
};