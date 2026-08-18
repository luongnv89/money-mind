import React, { useState } from 'react';
import { useTransactionStore } from '../stores/useTransactionStore';
import { useSettingsStore } from '../stores/useSettingsStore';
import { Settings, LogOut, Shield, LayoutDashboard, UploadCloud, AlertCircle } from 'lucide-react';
import { Button } from './UI';
import { ConfirmDialog } from './ConfirmDialog';
import { cn } from '../lib/utils';
import { ToastContainer } from './Toast';
import { MonkeySmileChat } from './MonkeySmileChat';

type View = 'dashboard' | 'upload' | 'settings' | 'privacy';

interface LayoutProps {
  children: React.ReactNode;
  currentView: View;
  onViewChange: (view: View) => void;
}

export const Layout: React.FC<LayoutProps> = ({ children, currentView, onViewChange }) => {
  const { clearAll, transactions } = useTransactionStore();
  const { isDemoMode, setDemoMode, aiMode, geminiConfig, groqConfig } = useSettingsStore();

  const [showClearConfirm, setShowClearConfirm] = useState(false);

  const handleClear = () => {
    clearAll();
    setDemoMode(false);
  };

  const isAIReady = React.useMemo(() => {
    if (aiMode === 'local') return true;
    if (aiMode === 'groq') return !!groqConfig.apiKey && groqConfig.apiKey.length > 0;
    return !!geminiConfig.apiKey && geminiConfig.apiKey.length > 0;
  }, [aiMode, geminiConfig.apiKey, groqConfig.apiKey]);

  return (
    <div className="min-h-screen flex flex-col font-sans">
      <ToastContainer />
      <MonkeySmileChat onNavigate={onViewChange} />

      {isDemoMode && (
        <div
          className={cn(
            'text-white text-center py-2 text-sm font-medium flex items-center justify-center gap-2 animate-in slide-in-from-top',
            isAIReady ? 'bg-emerald-600' : 'bg-indigo-600'
          )}
        >
          <AlertCircle className="w-4 h-4" />
          {isAIReady
            ? 'Demo Data Active — Connected to custom AI.'
            : 'Demo Mode Active — AI analysis is simulated without API keys.'}
        </div>
      )}
      <header className="sticky top-0 z-50 w-full border-b border-gray-200 bg-white/80 backdrop-blur-sm">
        <div className="container mx-auto max-w-7xl px-4 h-16 flex items-center justify-between">
          <div
            className="flex items-center gap-2 cursor-pointer"
            onClick={() => onViewChange('dashboard')}
          >
            <div className="w-8 h-8 bg-accent rounded-lg flex items-center justify-center text-white font-bold text-xl">
              M
            </div>
            <span className="font-bold text-xl tracking-tight text-gray-900">
              Money<span className="text-accent">Mind</span>
            </span>
          </div>

          <div className="flex items-center gap-2 md:gap-4">
            <nav className="flex items-center bg-gray-100/50 p-1 rounded-lg border border-gray-200 mr-2">
              {transactions.length > 0 && (
                <button
                  onClick={() => onViewChange('dashboard')}
                  className={cn(
                    'px-3 py-1.5 text-sm font-medium rounded-md transition-all flex items-center gap-2',
                    currentView === 'dashboard'
                      ? 'bg-white shadow-sm text-gray-900'
                      : 'text-gray-500 hover:text-gray-900'
                  )}
                >
                  <LayoutDashboard className="w-4 h-4" />
                  <span className="hidden sm:inline">Dashboard</span>
                </button>
              )}
              <button
                onClick={() => onViewChange('upload')}
                className={cn(
                  'px-3 py-1.5 text-sm font-medium rounded-md transition-all flex items-center gap-2',
                  currentView === 'upload'
                    ? 'bg-white shadow-sm text-gray-900'
                    : 'text-gray-500 hover:text-gray-900'
                )}
              >
                <UploadCloud className="w-4 h-4" />
                <span className="hidden sm:inline">Upload</span>
              </button>
            </nav>

            {transactions.length > 0 && (
              <>
                <ConfirmDialog
                  isOpen={showClearConfirm}
                  title="Clear All Transactions"
                  message="Are you sure you want to delete all transactions? This action cannot be undone."
                  confirmText="Clear All"
                  variant="danger"
                  onConfirm={handleClear}
                  onCancel={() => setShowClearConfirm(false)}
                />
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => setShowClearConfirm(true)}
                  className="text-red-500 hover:text-red-600 hover:bg-red-50 hidden sm:flex"
                >
                  <LogOut className="w-4 h-4 mr-2" /> Clear
                </Button>
              </>
            )}
            <Button
              variant="ghost"
              size="sm"
              onClick={() => onViewChange('settings')}
              className={cn(currentView === 'settings' ? 'bg-gray-100' : '')}
            >
              <Settings className="w-5 h-5" />
            </Button>
          </div>
        </div>
      </header>

      <main className="flex-1 w-full max-w-7xl mx-auto px-4 py-8">{children}</main>

      <footer className="border-t border-gray-200 bg-gray-50 mt-auto">
        <div className="container mx-auto max-w-7xl px-4 py-8">
          <div className="flex flex-col md:flex-row justify-between items-center gap-6 text-sm text-gray-500">
            {/* Left Side: Copyright & Branding */}
            <div className="flex flex-col items-center md:items-start gap-2">
              <div className="flex items-center gap-2 text-gray-900 font-medium">
                <Shield className="w-4 h-4 text-accent" />
                <span>Private by default. Open source.</span>
              </div>
              <p className="text-center md:text-left">
                &copy; {new Date().getFullYear()}{' '}
                <a
                  href="https://luongnv.com"
                  target="_blank"
                  rel="noopener noreferrer"
                  className="text-gray-700 hover:text-accent transition-colors font-medium"
                >
                  luongnv89
                </a>
                .<span className="hidden sm:inline"> All rights reserved.</span>
              </p>
            </div>

            {/* Right Side: Version & Links */}
            <div className="flex flex-col items-center md:items-end gap-2">
              <div className="flex gap-6">
                <button
                  onClick={() => onViewChange('privacy')}
                  className="hover:text-accent transition-colors"
                >
                  Privacy Policy
                </button>
                <a
                  href="https://github.com/luongnv89/money-mind"
                  target="_blank"
                  rel="noopener noreferrer"
                  className="hover:text-accent transition-colors"
                >
                  GitHub
                </a>
                <a
                  href="mailto:luongnv89@gmail.com"
                  className="hover:text-accent transition-colors"
                >
                  Contact
                </a>
              </div>
              <div className="flex items-center gap-2 font-mono text-xs text-gray-400 bg-gray-100 px-2 py-1 rounded">
                <span>v1.0.0</span>
                <span className="text-gray-300">|</span>
                <span title="Commit Hash">
                  {(import.meta.env?.VITE_COMMIT_HASH as string) || 'dev-local'}
                </span>
              </div>
            </div>
          </div>
        </div>
      </footer>
    </div>
  );
};
