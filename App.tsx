import { Suspense, lazy, useState } from 'react';
import { Layout } from './components/Layout';
import { UploadPage } from './pages/Upload';
import { SettingsPage } from './pages/Settings';
import { PrivacyPolicy } from './pages/PrivacyPolicy';
import TransactionsPage from './pages/Transactions';
import { useTransactionStore } from './stores/useTransactionStore';
import { View } from './types';

// F-PERF-005: the Overview is the app's only recharts consumer (~350–450 KB
// with d3). Lazy-loading it keeps the chart library out of the entry chunk so
// first-time users landing on Upload never download it.
const Overview = lazy(() => import('./pages/Overview'));

function App() {
  const { transactions } = useTransactionStore();
  // With data we land on the Overview; without any, on the importer.
  const [view, setView] = useState<View>(() => (transactions.length > 0 ? 'overview' : 'upload'));

  const backTarget = transactions.length > 0 ? 'overview' : 'upload';

  return (
    <Layout currentView={view} onViewChange={setView}>
      {view === 'overview' && (
        <Suspense
          fallback={
            <div className="flex min-h-[60vh] items-center justify-center text-sm text-muted">
              Loading overview...
            </div>
          }
        >
          <Overview onNavigate={setView} />
        </Suspense>
      )}
      {view === 'transactions' && <TransactionsPage onNavigate={setView} />}
      {view === 'upload' && <UploadPage onUploadComplete={() => setView('overview')} />}
      {view === 'settings' && <SettingsPage onBack={() => setView(backTarget)} />}
      {view === 'privacy' && <PrivacyPolicy onBack={() => setView(backTarget)} />}
    </Layout>
  );
}

export default App;
