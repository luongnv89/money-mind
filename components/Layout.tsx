import React from 'react';
import { useTransactionStore } from '../stores/useTransactionStore';
import { useSettingsStore } from '../stores/useSettingsStore';
import { Settings, Shield, LayoutDashboard, List, UploadCloud } from 'lucide-react';
import { cn } from '../lib/utils';
import { ToastContainer } from './Toast';
import { AssistantChat } from './AssistantChat';
import { View } from '../types';

interface LayoutProps {
  children: React.ReactNode;
  currentView: View;
  onViewChange: (view: View) => void;
}

const NAV_ITEMS: { view: View; label: string; Icon: typeof LayoutDashboard }[] = [
  { view: 'overview', label: 'Overview', Icon: LayoutDashboard },
  { view: 'transactions', label: 'Transactions', Icon: List },
  { view: 'upload', label: 'Import', Icon: UploadCloud },
];

export const Layout: React.FC<LayoutProps> = ({ children, currentView, onViewChange }) => {
  const { clearAll, transactions } = useTransactionStore();
  const { isDemoMode, setDemoMode } = useSettingsStore();

  const handleExitDemo = () => {
    clearAll();
    setDemoMode(false);
    onViewChange('upload');
  };

  return (
    <div className="min-h-screen flex flex-col font-sans bg-paper text-ink">
      <ToastContainer />
      <AssistantChat onNavigate={onViewChange} />

      {isDemoMode && (
        <div className="flex items-center justify-center gap-3 border-b border-line bg-surface-muted px-4 py-2 text-sm text-ink-soft">
          <p>You&apos;re exploring sample data. Import your own statement to replace it.</p>
          <button
            onClick={handleExitDemo}
            className="font-medium text-accent underline underline-offset-2 transition-colors hover:text-accent-hover"
          >
            Exit demo
          </button>
        </div>
      )}

      <header className="sticky top-0 z-50 w-full border-b border-line bg-surface/85 backdrop-blur-xs">
        <div className="container mx-auto max-w-7xl px-4 h-16 flex items-center justify-between">
          <div
            className="flex items-center gap-2.5 cursor-pointer"
            onClick={() => onViewChange(transactions.length > 0 ? 'overview' : 'upload')}
          >
            <div className="w-8 h-8 bg-ink rounded-md flex items-center justify-center font-display text-lg text-paper">
              M
            </div>
            <span className="font-display text-xl tracking-tight text-ink">MoneyMind</span>
          </div>

          <div className="flex items-center gap-1 md:gap-3">
            <nav className="flex items-center gap-1" aria-label="Primary">
              {NAV_ITEMS.filter(({ view }) => view === 'upload' || transactions.length > 0).map(
                ({ view, label, Icon }) => {
                  const active = currentView === view;
                  return (
                    <button
                      key={view}
                      onClick={() => onViewChange(view)}
                      aria-current={active ? 'page' : undefined}
                      className={cn(
                        'px-3 py-1.5 text-sm font-medium transition-colors flex items-center gap-2 border-b-2 -mb-px',
                        active
                          ? 'text-ink border-accent'
                          : 'text-ink-soft border-transparent hover:text-ink'
                      )}
                    >
                      <Icon className="w-4 h-4" />
                      <span className="hidden sm:inline">{label}</span>
                    </button>
                  );
                }
              )}
            </nav>

            <button
              onClick={() => onViewChange('settings')}
              aria-label="Settings"
              title="Settings"
              aria-current={currentView === 'settings' ? 'page' : undefined}
              className={cn(
                'p-2 rounded-lg transition-colors focus-visible:outline-hidden focus-visible:ring-2 focus-visible:ring-accent',
                currentView === 'settings'
                  ? 'text-accent bg-accent-light'
                  : 'text-ink-soft hover:bg-ink/5'
              )}
            >
              <Settings className="w-5 h-5" />
            </button>
          </div>
        </div>
      </header>

      <main className="flex-1 w-full max-w-7xl mx-auto px-4 py-8">{children}</main>

      <footer className="border-t border-line bg-surface-muted mt-auto">
        <div className="container mx-auto max-w-7xl px-4 py-8">
          <div className="flex flex-col md:flex-row justify-between items-center gap-6 text-sm text-muted">
            {/* Left Side: Copyright & Branding */}
            <div className="flex flex-col items-center md:items-start gap-2">
              <div className="flex items-center gap-2 text-ink font-medium">
                <Shield className="w-4 h-4 text-accent" />
                <span>Private by default. Open source.</span>
              </div>
              <p className="text-center md:text-left">
                &copy; {new Date().getFullYear()}{' '}
                <a
                  href="https://luongnv.com"
                  target="_blank"
                  rel="noopener noreferrer"
                  className="text-ink-soft hover:text-accent transition-colors font-medium"
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
              <div className="flex items-center gap-2 font-mono text-xs text-muted bg-surface border border-line px-2 py-1 rounded">
                {/* Injected from package.json at build time (F-UX-013). */}
                <span>v{__APP_VERSION__}</span>
                <span className="text-line-strong">|</span>
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
