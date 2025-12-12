import React, { useState } from 'react';
import { Layout } from './components/Layout';
import { Dashboard } from './pages/Dashboard';
import { UploadPage } from './pages/Upload';
import { SettingsPage } from './pages/Settings';
import { useTransactionStore } from './stores/useTransactionStore';

type View = 'dashboard' | 'upload' | 'settings';

function App() {
  const { transactions } = useTransactionStore();
  // If we have transactions, start on dashboard, otherwise start on upload
  const [view, setView] = useState<View>(() => transactions.length > 0 ? 'dashboard' : 'upload');

  return (
    <Layout currentView={view} onViewChange={setView}>
      {view === 'dashboard' && <Dashboard />}
      {view === 'upload' && <UploadPage onUploadComplete={() => setView('dashboard')} />}
      {view === 'settings' && <SettingsPage onBack={() => setView('dashboard')} />}
    </Layout>
  );
}

export default App;