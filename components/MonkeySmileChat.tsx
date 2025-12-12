
import React, { useState, useRef, useEffect } from 'react';
import { useTransactionStore } from '../stores/useTransactionStore';
import { useSettingsStore, getDecryptedApiKey } from '../stores/useSettingsStore';
import { chatWithFinancialAgent } from '../services/aiService';
import { Transaction, TransactionCategory } from '../types';
import { MessageCircle, Send, X, Smile, Settings, Loader2 } from 'lucide-react';
import { Button, Input, Card, CardHeader, CardContent } from './UI';
import { cn, formatCurrency } from '../lib/utils';

interface Message {
    id: string;
    role: 'user' | 'assistant';
    content: string;
    timestamp: number;
}

interface MonkeySmileChatProps {
    onNavigate?: (view: 'settings' | 'dashboard' | 'upload') => void;
}

export const MonkeySmileChat: React.FC<MonkeySmileChatProps> = ({ onNavigate }) => {
    const { transactions } = useTransactionStore();
    // Subscribe to config objects so component re-renders when keys are updated
    const { isDemoMode, aiMode, geminiConfig, groqConfig } = useSettingsStore();
    const [isOpen, setIsOpen] = useState(false);
    const [messages, setMessages] = useState<Message[]>([
        { 
            id: 'intro', 
            role: 'assistant', 
            content: "Hey! I'm MonkeySmile 🐵. Ask me anything about your budget. Try 'Can I afford pizza?' or 'Roast my spending'.", 
            timestamp: Date.now() 
        }
    ]);
    const [inputValue, setInputValue] = useState('');
    const [isLoading, setIsLoading] = useState(false);
    const messagesEndRef = useRef<HTMLDivElement>(null);

    // Scroll to bottom
    useEffect(() => {
        if (messagesEndRef.current) {
            messagesEndRef.current.scrollIntoView({ behavior: 'smooth' });
        }
    }, [messages, isOpen]);

    const isAIReady = React.useMemo(() => {
        if (isDemoMode) return false;
        if (aiMode === 'local') return true;
        
        // Check availability based on current mode and existence of key string (encrypted or not)
        if (aiMode === 'groq') {
            return !!groqConfig.apiKey && groqConfig.apiKey.length > 0;
        }
        // Default Cloud (Gemini)
        return !!geminiConfig.apiKey && geminiConfig.apiKey.length > 0;
    }, [isDemoMode, aiMode, geminiConfig.apiKey, groqConfig.apiKey]);

    const buildFinancialContext = (txs: Transaction[]) => {
        const now = new Date();
        const currentMonthPrefix = now.toISOString().slice(0, 7); // YYYY-MM
        const monthlyTx = txs.filter(t => t.date.startsWith(currentMonthPrefix));

        const income = monthlyTx.filter(t => t.amount > 0).reduce((sum, t) => sum + t.amount, 0);
        const expenses = monthlyTx.filter(t => t.amount < 0).reduce((sum, t) => sum + Math.abs(t.amount), 0);
        const niceToHave = monthlyTx.filter(t => t.category === TransactionCategory.NiceToHave).reduce((sum, t) => sum + Math.abs(t.amount), 0);
        const waste = monthlyTx.filter(t => t.category === TransactionCategory.Waste).reduce((sum, t) => sum + Math.abs(t.amount), 0);
        
        // Group expenses by category
        const byCat: Record<string, number> = {};
        monthlyTx.filter(t => t.amount < 0).forEach(t => {
            byCat[t.category] = (byCat[t.category] || 0) + Math.abs(t.amount);
        });
        
        const topCategories = Object.entries(byCat)
            .sort(([,a], [,b]) => b - a)
            .slice(0, 3)
            .map(([cat, amt]) => `${cat}: ${formatCurrency(amt)}`)
            .join(', ');

        return `
        Month: ${currentMonthPrefix}
        Total Income: ${formatCurrency(income)}
        Total Expenses: ${formatCurrency(expenses)}
        Net Balance (Income - Expenses): ${formatCurrency(income - expenses)}
        Nice-to-Have Spend: ${formatCurrency(niceToHave)}
        Waste Spend: ${formatCurrency(waste)}
        Top Spending Categories: ${topCategories}
        Total Transactions: ${monthlyTx.length}
        Recent Transactions: ${monthlyTx.slice(0, 5).map(t => `${t.description} (${formatCurrency(t.amount)})`).join(', ')}
        `;
    };

    const handleSend = async (e?: React.FormEvent) => {
        e?.preventDefault();
        if (!inputValue.trim()) return;

        const userMsg: Message = {
            id: Date.now().toString(),
            role: 'user',
            content: inputValue.trim(),
            timestamp: Date.now()
        };

        setMessages(prev => [...prev, userMsg]);
        setInputValue('');
        setIsLoading(true);

        try {
            if (!isAIReady) {
                // Simulate delay then show error
                setTimeout(() => {
                    const errorMsg: Message = {
                        id: (Date.now() + 1).toString(),
                        role: 'assistant',
                        content: "I'd love to chat, but I need a brain! 🧠\n\nYou are currently in Demo Mode or missing an API Key. Please go to Settings to connect your own AI model for real-time chat.",
                        timestamp: Date.now()
                    };
                    setMessages(prev => [...prev, errorMsg]);
                    setIsLoading(false);
                }, 600);
                return;
            }

            const context = buildFinancialContext(transactions);
            const responseText = await chatWithFinancialAgent(userMsg.content, context);

            const botMsg: Message = {
                id: (Date.now() + 1).toString(),
                role: 'assistant',
                content: responseText,
                timestamp: Date.now()
            };
            setMessages(prev => [...prev, botMsg]);
        } catch (error: any) {
            const errorMsg: Message = {
                id: (Date.now() + 1).toString(),
                role: 'assistant',
                content: `Oops! Something went wrong: ${error.message}`,
                timestamp: Date.now()
            };
            setMessages(prev => [...prev, errorMsg]);
        } finally {
            setIsLoading(false);
        }
    };

    if (transactions.length === 0) return null;

    return (
        <>
            {/* Toggle Button */}
            <button
                onClick={() => setIsOpen(!isOpen)}
                className={cn(
                    "fixed bottom-6 right-6 z-40 p-4 rounded-full shadow-xl transition-all duration-300 hover:scale-105",
                    isOpen ? "bg-red-500 text-white rotate-90" : "bg-gradient-to-tr from-accent to-emerald-600 text-white"
                )}
                aria-label="Toggle MonkeySmile Chat"
            >
                {isOpen ? <X className="w-6 h-6" /> : <Smile className="w-6 h-6" />}
            </button>

            {/* Chat Window */}
            {isOpen && (
                <div className="fixed bottom-24 right-6 z-40 w-80 sm:w-96 flex flex-col animate-in slide-in-from-bottom-10 fade-in duration-300 origin-bottom-right">
                    <Card className="shadow-2xl border-0 overflow-hidden flex flex-col h-[500px]">
                        {/* Header */}
                        <div className="bg-gradient-to-r from-accent to-emerald-600 p-4 flex justify-between items-center text-white shrink-0">
                            <div className="flex items-center gap-2">
                                <div className="bg-white/20 p-1.5 rounded-full backdrop-blur-sm">
                                    <Smile className="w-5 h-5" />
                                </div>
                                <div>
                                    <h3 className="font-bold text-sm">MonkeySmile 🐵</h3>
                                    <p className="text-[10px] text-white/80 font-medium">Your Sassy Budget Buddy</p>
                                </div>
                            </div>
                            {!isAIReady && (
                                <div className="bg-white/20 px-2 py-0.5 rounded text-[10px] font-bold border border-white/10">
                                    DEMO
                                </div>
                            )}
                        </div>

                        {/* Messages */}
                        <div className="flex-1 overflow-y-auto p-4 space-y-4 bg-gray-50/50">
                            {messages.map((msg) => (
                                <div
                                    key={msg.id}
                                    className={cn(
                                        "flex w-full",
                                        msg.role === 'user' ? "justify-end" : "justify-start"
                                    )}
                                >
                                    <div
                                        className={cn(
                                            "max-w-[80%] rounded-2xl px-4 py-2.5 text-sm shadow-sm whitespace-pre-wrap",
                                            msg.role === 'user' 
                                                ? "bg-accent text-white rounded-br-none" 
                                                : "bg-white text-gray-800 border border-gray-100 rounded-bl-none"
                                        )}
                                    >
                                        {msg.content}
                                    </div>
                                </div>
                            ))}
                            {isLoading && (
                                <div className="flex justify-start w-full">
                                    <div className="bg-white border border-gray-100 px-4 py-3 rounded-2xl rounded-bl-none shadow-sm flex items-center gap-2">
                                        <div className="w-2 h-2 bg-gray-400 rounded-full animate-bounce [animation-delay:-0.3s]"></div>
                                        <div className="w-2 h-2 bg-gray-400 rounded-full animate-bounce [animation-delay:-0.15s]"></div>
                                        <div className="w-2 h-2 bg-gray-400 rounded-full animate-bounce"></div>
                                    </div>
                                </div>
                            )}
                            <div ref={messagesEndRef} />
                        </div>

                        {/* Footer / Input */}
                        <div className="p-3 bg-white border-t border-gray-100 shrink-0">
                            {!isAIReady ? (
                                <div className="text-center p-2 space-y-2">
                                    <p className="text-xs text-gray-500">
                                        Connect AI to chat with your data.
                                    </p>
                                    <Button size="sm" variant="outline" className="w-full text-xs" onClick={() => {
                                        if (onNavigate) {
                                            setIsOpen(false);
                                            onNavigate('settings');
                                        }
                                    }}>
                                        <Settings className="w-3 h-3 mr-1.5" />
                                        Configure in Settings
                                    </Button>
                                </div>
                            ) : null}
                            
                            <form 
                                onSubmit={handleSend}
                                className={cn("flex items-center gap-2", !isAIReady && "opacity-50 pointer-events-none")}
                            >
                                <Input
                                    value={inputValue}
                                    onChange={(e) => setInputValue(e.target.value)}
                                    placeholder="Type a message..."
                                    className="flex-1 text-sm bg-gray-50 border-0 focus-visible:ring-1 focus-visible:ring-accent focus-visible:bg-white transition-all"
                                />
                                <Button 
                                    type="submit" 
                                    size="sm" 
                                    className="px-3 bg-accent hover:bg-accent-hover text-white shadow-sm"
                                    disabled={!inputValue.trim() || isLoading}
                                >
                                    <Send className="w-4 h-4" />
                                </Button>
                            </form>
                        </div>
                    </Card>
                </div>
            )}
        </>
    );
};
