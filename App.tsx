import { Suspense, lazy, useState } from 'react';
import { Layout } from './components/Layout';
import { UploadPage } from './pages/Upload';
import { SettingsPage } from './pages/Settings';
import { PrivacyPolicy } from './pages/PrivacyPolicy';
import { useTransactionStore } from './stores/useTransactionStore';

// F-PERF-005: the dashboard is the app's only recharts consumer (~350–450 KB
// with d3). Lazy-loading it keeps the chart library out of the entry chunk so
// first-time users landing on Upload never download it.
const Dashboard = lazy(() =>
  import('./pages/Dashboard').then((module) => ({ default: module.Dashboard }))
);

type View = 'dashboard' | 'upload' | 'settings' | 'privacy';

function App() {
  const { transactions } = useTransactionStore();
  // If we have transactions, start on dashboard, otherwise start on upload
  const [view, setView] = useState<View>(() => (transactions.length > 0 ? 'dashboard' : 'upload'));

  return (
    <Layout currentView={view} onViewChange={setView}>
      {view === 'dashboard' && (
        <Suspense
          fallback={
            <div className="flex min-h-[60vh] items-center justify-center text-sm">
              Loading dashboard...
            </div>
          }
        >
          <Dashboard onNavigate={setView} />
        </Suspense>
      )}
      {view === 'upload' && <UploadPage onUploadComplete={() => setView('dashboard')} />}
      {view === 'settings' && <SettingsPage onBack={() => setView('dashboard')} />}
      {view === 'privacy' && <PrivacyPolicy onBack={() => setView('dashboard')} />}
    </Layout>
  );
}

export default App;
