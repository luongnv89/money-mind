
import React from 'react';
import { useTransactionStore } from '../stores/useTransactionStore';
import { useSettingsStore } from '../stores/useSettingsStore';
import { Settings, LogOut, Shield, LayoutDashboard, UploadCloud, AlertCircle } from 'lucide-react';
import { Button } from './UI';
import { cn } from '../lib/utils';
import { ToastContainer } from './Toast';

type View = 'dashboard' | 'upload' | 'settings';

interface LayoutProps {
    children: React.ReactNode;
    currentView: View;
    onViewChange: (view: View) => void;
}

export const Layout: React.FC<LayoutProps> = ({ children, currentView, onViewChange }) => {
    const { clearAll, transactions } = useTransactionStore();
    const { isDemoMode, setDemoMode } = useSettingsStore();

    const handleClear = () => {
        clearAll();
        setDemoMode(false);
    };

    return (
        <div className="min-h-screen flex flex-col font-sans">
            <ToastContainer />
            {isDemoMode && (
                <div className="bg-indigo-600 text-white text-center py-2 text-sm font-medium flex items-center justify-center gap-2 animate-in slide-in-from-top">
                    <AlertCircle className="w-4 h-4" />
                    Demo Mode Active — AI analysis is simulated without API keys.
                </div>
            )}
            <header className="sticky top-0 z-50 w-full border-b border-gray-200 bg-white/80 backdrop-blur-sm">
                <div className="container mx-auto max-w-7xl px-4 h-16 flex items-center justify-between">
                    <div className="flex items-center gap-2 cursor-pointer" onClick={() => onViewChange('dashboard')}>
                        <div className="w-8 h-8 bg-accent rounded-lg flex items-center justify-center text-white font-bold text-xl">M</div>
                        <span className="font-bold text-xl tracking-tight text-gray-900">Money<span className="text-accent">Mind</span></span>
                    </div>
                    
                    <div className="flex items-center gap-2 md:gap-4">
                         <nav className="flex items-center bg-gray-100/50 p-1 rounded-lg border border-gray-200 mr-2">
                            {transactions.length > 0 && (
                                <button 
                                    onClick={() => onViewChange('dashboard')}
                                    className={cn(
                                        "px-3 py-1.5 text-sm font-medium rounded-md transition-all flex items-center gap-2",
                                        currentView === 'dashboard' ? "bg-white shadow-sm text-gray-900" : "text-gray-500 hover:text-gray-900"
                                    )}
                                >
                                    <LayoutDashboard className="w-4 h-4" />
                                    <span className="hidden sm:inline">Dashboard</span>
                                </button>
                            )}
                             <button 
                                onClick={() => onViewChange('upload')}
                                className={cn(
                                    "px-3 py-1.5 text-sm font-medium rounded-md transition-all flex items-center gap-2",
                                    currentView === 'upload' ? "bg-white shadow-sm text-gray-900" : "text-gray-500 hover:text-gray-900"
                                )}
                            >
                                <UploadCloud className="w-4 h-4" />
                                <span className="hidden sm:inline">Upload</span>
                            </button>
                         </nav>

                        {transactions.length > 0 && (
                            <Button variant="ghost" size="sm" onClick={handleClear} className="text-red-500 hover:text-red-600 hover:bg-red-50 hidden sm:flex">
                                <LogOut className="w-4 h-4 mr-2" /> Clear
                            </Button>
                        )}
                        <Button 
                            variant="ghost" 
                            size="sm" 
                            onClick={() => onViewChange('settings')}
                            className={cn(currentView === 'settings' ? "bg-gray-100" : "")}
                        >
                            <Settings className="w-5 h-5" />
                        </Button>
                    </div>
                </div>
            </header>

            <main className="flex-1 w-full max-w-7xl mx-auto px-4 py-8">
                {children}
            </main>

            <footer className="border-t border-gray-200 bg-gray-50 mt-auto">
                <div className="container mx-auto max-w-7xl px-4 py-8 flex flex-col sm:flex-row justify-between items-center gap-4 text-sm text-gray-500">
                    <div className="flex items-center gap-2">
                        <Shield className="w-4 h-4" />
                        <span>Private by default. Open source.</span>
                    </div>
                    <div className="flex gap-6">
                        <a href="#" className="hover:text-accent">Privacy Policy</a>
                        <a href="#" className="hover:text-accent">GitHub</a>
                        <a href="#" className="hover:text-accent">Contact</a>
                    </div>
                </div>
            </footer>
        </div>
    );
};
