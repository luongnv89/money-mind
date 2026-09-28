import React from 'react';
import { CSVUploader } from '../components/CSVUploader';
import { ShieldCheck, Calculator, Sparkles } from 'lucide-react';
import { Button, Card, CardContent, Eyebrow } from '../components/UI';
import { useTransactionStore } from '../stores/useTransactionStore';
import { useSettingsStore } from '../stores/useSettingsStore';
import { getDemoTransactions } from '../lib/demoData';

interface UploadPageProps {
  onUploadComplete: () => void;
}

const PRINCIPLES: { title: string; body: string; Icon: typeof ShieldCheck }[] = [
  {
    title: 'Stays on your device',
    body: "No account and no server database. Your transactions live in this browser's storage; clearing your browser data removes them.",
    Icon: ShieldCheck,
  },
  {
    title: 'Numbers you can check',
    body: 'Every metric uses a published formula and benchmark, so the same data always gives the same result.',
    Icon: Calculator,
  },
  {
    title: 'AI only where it helps',
    body: 'TypeSafe Jev (or a language model you choose) categorizes transactions and answers questions. Nothing is sent to an AI service until you set one up.',
    Icon: Sparkles,
  },
];

export const UploadPage: React.FC<UploadPageProps> = ({ onUploadComplete }) => {
  const { addTransactions, clearAll } = useTransactionStore();
  const { setDemoMode } = useSettingsStore();

  const handleDemoMode = () => {
    clearAll();
    setDemoMode(true);
    addTransactions(getDemoTransactions());
    onUploadComplete();
  };

  return (
    <div className="mx-auto flex max-w-3xl flex-col items-center py-8 text-center">
      <Eyebrow>Private financial health report</Eyebrow>
      <h1 className="mt-3 max-w-2xl font-display text-4xl tracking-tight text-ink sm:text-5xl">
        See where your money goes — and what to do about it.
      </h1>
      <p className="mt-4 max-w-2xl text-lg leading-relaxed text-ink-soft">
        Import a bank statement and MoneyMind turns it into a clear report: your savings rate, the
        50/30/20 split, recurring charges and a prioritized action plan. Every figure is calculated
        in your browser.
      </p>

      <div className="mt-10 w-full">
        <CSVUploader onUploadComplete={onUploadComplete} />
      </div>

      <div className="mt-8 w-full max-w-2xl">
        <div className="relative">
          <div className="absolute inset-0 flex items-center">
            <span className="w-full border-t border-line" />
          </div>
          <div className="relative flex justify-center">
            <span className="bg-paper px-3 text-xs uppercase tracking-wide text-muted">
              or start with sample data
            </span>
          </div>
        </div>

        <Button variant="outline" onClick={handleDemoMode} className="mt-5">
          Load demo data
        </Button>
        <p className="mt-2 text-xs text-muted">
          Three months of sample data from a fictional household.
        </p>
      </div>

      <div className="mt-14 grid w-full grid-cols-1 gap-4 text-left sm:grid-cols-3">
        {PRINCIPLES.map(({ title, body, Icon }) => (
          <Card key={title}>
            <CardContent className="p-5">
              <Icon className="h-5 w-5 text-brass" aria-hidden="true" />
              <h3 className="mt-3 font-display text-lg text-ink">{title}</h3>
              <p className="mt-1.5 text-sm leading-relaxed text-ink-soft">{body}</p>
            </CardContent>
          </Card>
        ))}
      </div>

      <p className="mt-10 text-xs text-muted">
        API keys are stored in this browser — obfuscated, not encrypted.
      </p>
    </div>
  );
};
