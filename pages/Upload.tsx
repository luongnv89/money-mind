import React from 'react';
import { CSVUploader } from '../components/CSVUploader';
import { ShieldCheck, EyeOff, PlayCircle } from 'lucide-react';
import { Button } from '../components/UI';
import { useTransactionStore } from '../stores/useTransactionStore';
import { useSettingsStore } from '../stores/useSettingsStore';
import { getDemoTransactions } from '../lib/demoData';

interface UploadPageProps {
  onUploadComplete: () => void;
}

export const UploadPage: React.FC<UploadPageProps> = ({ onUploadComplete }) => {
  const { addTransactions, clearAll } = useTransactionStore();
  const { setDemoMode } = useSettingsStore();

  const handleDemoMode = () => {
    // Clear existing data to ensure a clean demo state (optional, but cleaner)
    clearAll();
    setDemoMode(true);

    const demoData = getDemoTransactions();
    addTransactions(demoData);
    onUploadComplete();
  };

  return (
    <div className="flex flex-col items-center justify-center min-h-[60vh] text-center space-y-8 animate-in fade-in duration-500">
      <div className="space-y-4 max-w-3xl">
        <h1 className="text-4xl font-bold tracking-tight text-gray-900 sm:text-5xl">
          The <span className="text-accent">Free & Private</span> Way to Master Your Money
        </h1>
        <p className="text-lg text-gray-600 max-w-2xl mx-auto leading-relaxed">
          MoneyMind categorizes your transactions anonymously using AI.
          <span className="block mt-2 text-gray-500 text-base">
            <span className="font-medium text-gray-700">No signup. No server storage.</span> Your
            data never leaves your browser, and your API keys are{' '}
            <span className="font-medium text-gray-700">
              stored locally (obfuscated, not encrypted)
            </span>
            .
          </span>
        </p>
      </div>

      <div className="w-full max-w-2xl space-y-6">
        <CSVUploader onUploadComplete={onUploadComplete} />

        <div className="relative">
          <div className="absolute inset-0 flex items-center">
            <span className="w-full border-t border-gray-200" />
          </div>
          <div className="relative flex justify-center text-xs uppercase">
            <span className="bg-[#F9FAFB] px-2 text-gray-500">Or just looking around?</span>
          </div>
        </div>

        <Button
          variant="outline"
          onClick={handleDemoMode}
          className="w-full sm:w-auto border-dashed border-gray-400 text-gray-600 hover:text-accent hover:border-accent hover:bg-accent/5"
        >
          <PlayCircle className="w-4 h-4 mr-2" />
          Load Demo Data (3 Months)
        </Button>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-3 gap-8 mt-12 w-full max-w-4xl text-left">
        <div className="p-5 rounded-xl bg-white border border-gray-100 shadow-sm hover:shadow-md transition-shadow">
          <div className="w-10 h-10 bg-green-50 rounded-lg flex items-center justify-center mb-3">
            <ShieldCheck className="w-5 h-5 text-accent" />
          </div>
          <h3 className="font-semibold text-gray-900">100% Client-Side</h3>
          <p className="text-sm text-gray-500 mt-1">
            We don't have a backend database. Your bank statement is processed entirely within your
            browser.
          </p>
        </div>
        <div className="p-5 rounded-xl bg-white border border-gray-100 shadow-sm hover:shadow-md transition-shadow">
          <h3 className="font-semibold text-gray-900">Stored Locally</h3>
          <p className="text-sm text-gray-500 mt-1">
            Your API key stays in your browser's LocalStorage — obfuscated (base64), not encrypted.
            Use cloud AI or run completely local models.
          </p>
        </div>
        <div className="p-5 rounded-xl bg-white border border-gray-100 shadow-sm hover:shadow-md transition-shadow">
          <div className="w-10 h-10 bg-purple-50 rounded-lg flex items-center justify-center mb-3">
            <EyeOff className="w-5 h-5 text-purple-600" />
          </div>
          <h3 className="font-semibold text-gray-900">Anonymous</h3>
          <p className="text-sm text-gray-500 mt-1">
            We don't ask for your name, email, or account numbers. Just pure financial analysis.
          </p>
        </div>
      </div>
    </div>
  );
};
