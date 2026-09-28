import React from 'react';
import { AlertTriangle } from 'lucide-react';
import { Button, Card, CardContent } from '../components/UI';
import { AddTransactionModal } from '../components/AddTransactionModal';
import { useFinanceView, useSpendingAlerts } from '../lib/useFinance';
import { formatISODate, minISO } from '../lib/finance';
import { formatCurrency } from '../lib/utils';
import { useSettingsStore } from '../stores/useSettingsStore';
import { useTransactionStore } from '../stores/useTransactionStore';
import { useToastStore } from '../stores/useToastStore';
import { getDemoTransactions } from '../lib/demoData';
import { View } from '../types';
import { PeriodBar } from './shared/PeriodBar';
import { Section } from './overview/shared';
import { KpiRow } from './overview/KpiRow';
import { HealthScoreCard } from './overview/HealthScoreCard';
import { BudgetRuleCard } from './overview/BudgetRuleCard';
import { InsightsList } from './overview/InsightsList';
import { RatioGrid } from './overview/RatioGrid';
import { CashFlowChart } from './overview/CashFlowChart';
import { SpendingBreakdown } from './overview/SpendingBreakdown';
import { RecurringTable } from './overview/RecurringTable';
import { Methodology } from './overview/Methodology';
import { EmptyState } from './transactions/EmptyState';

interface OverviewProps {
  onNavigate: (view: View) => void;
}

const Overview: React.FC<OverviewProps> = ({ onNavigate }) => {
  const view = useFinanceView();
  const { model, ledger } = view;
  const currency = useSettingsStore((s) => s.currency);
  const { transactions, addTransactions, clearAll } = useTransactionStore();
  const setDemoMode = useSettingsStore((s) => s.setDemoMode);
  const addToast = useToastStore((s) => s.addToast);
  const [addModalOpen, setAddModalOpen] = React.useState(false);

  useSpendingAlerts(model);

  const fmt = (n: number) => formatCurrency(n, currency);

  const handleLoadDemo = () => {
    clearAll();
    setDemoMode(true);
    addTransactions(getDemoTransactions());
    addToast('Loaded demo data.', 'success');
  };

  if (transactions.length === 0 || !model) {
    return (
      <>
        <EmptyState
          onNavigate={onNavigate}
          onAddManually={() => setAddModalOpen(true)}
          onLoadDemo={handleLoadDemo}
          importedTransactions={transactions}
        />
        {addModalOpen && (
          <AddTransactionModal
            onClose={() => setAddModalOpen(false)}
            onSave={(tx) => {
              addTransactions([tx]);
              setAddModalOpen(false);
            }}
          />
        )}
      </>
    );
  }

  const { summary, baseline, score } = model;
  const quality = summary.quality;
  const showDataBanner = quality.uncategorizedCount > 0 && quality.uncategorizedShare >= 0.05;
  const dataQualityInsight = model.insights.find((i) => i.id === 'data-quality');
  const undatedCount = ledger.undated.length;

  return (
    <div className="space-y-10">
      <PeriodBar eyebrow="Overview" view={view} />

      {showDataBanner && (
        <Card className="border-warning/40 bg-warning/5">
          <CardContent className="flex flex-wrap items-center justify-between gap-3 p-4">
            <div className="flex min-w-0 items-start gap-3">
              <AlertTriangle className="mt-0.5 h-5 w-5 shrink-0 text-warning" />
              <div>
                <p className="text-sm font-semibold text-ink">
                  {dataQualityInsight?.title ??
                    `Categorize ${quality.uncategorizedCount} transactions`}
                </p>
                <p className="text-sm text-ink-soft">{dataQualityInsight?.detail}</p>
              </div>
            </div>
            <Button variant="outline" size="sm" onClick={() => onNavigate('transactions')}>
              Categorize now
            </Button>
          </CardContent>
        </Card>
      )}
      {undatedCount > 0 && (
        <p className="text-xs text-muted">
          {undatedCount} transactions have unreadable dates and are left out of these figures.
        </p>
      )}

      <Section index={0} title="This period at a glance">
        <KpiRow model={model} granularity={view.granularity} fmt={fmt} />
      </Section>

      <Section
        index={1}
        title="Financial health"
        caption={`Based on ${score.window.label} — recent complete months, so pay timing can't swing it.${
          score.window.provisional ? ' (partial month)' : ''
        }`}
      >
        <div className="flex flex-col gap-4 lg:flex-row">
          <HealthScoreCard score={score} onNavigate={onNavigate} />
          <BudgetRuleCard score={score} fmt={fmt} />
        </div>
      </Section>

      <Section
        index={2}
        title="What to focus on"
        caption="Most urgent first, then by money at stake."
      >
        <InsightsList
          insights={model.insights}
          onNavigate={onNavigate}
          periodInProgress={summary.coverage.isInProgress}
          fmt={fmt}
        />
      </Section>

      <Section
        index={3}
        title="Key ratios"
        caption={`Measured over ${score.window.label}. Benchmarks are common rules of thumb, not advice.`}
      >
        <RatioGrid model={model} fmt={fmt} />
      </Section>

      <Section index={4} title="Cash flow">
        <CashFlowChart model={model} fmt={fmt} onSelectPeriod={view.selectPeriod} />
      </Section>

      <Section
        index={5}
        title="Where the money went"
        caption={`${model.period.label} · ${
          baseline ? `compared with ${baseline.label}` : 'no comparison yet'
        }`}
      >
        <SpendingBreakdown model={model} fmt={fmt} />
      </Section>

      <Section
        id="recurring"
        index={6}
        title="Recurring commitments"
        caption={`Detected from regular charges with a steady amount · active as of ${formatISODate(
          minISO(model.period.end, model.bounds?.last ?? model.period.end)
        )}`}
      >
        <RecurringTable model={model} fmt={fmt} />
      </Section>

      <Section index={7} title="Methodology">
        <Methodology />
      </Section>
    </div>
  );
};

export default Overview;
