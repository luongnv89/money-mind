import React, { useState, useRef, useEffect } from 'react';
import {
  useSettingsStore,
  getDeobfuscatedApiKey,
  getTypesafeApiKey,
  validatePersistedModel,
  selectAIReady,
} from '../stores/useSettingsStore';
import { clearPatterns, getPatterns, importPatterns } from '../lib/localStorage';
import { useDebouncedValue } from '../lib/useDebounce';
import { Button } from '../components/UI';
import { ConfirmDialog } from '../components/ConfirmDialog';
import { AlertCircle } from 'lucide-react';
import { testAiConnection } from '../services/aiService';
import { testTypesafeConnection } from '../services/typesafeService';
import { loadModelCatalog } from '../services/modelCatalog';
import { AI_PROVIDER_LABELS, FALLBACK_MODEL_CATALOG } from '../constants';
import { ModelCatalog } from '../types';
import { useToastStore } from '../stores/useToastStore';
import { useTransactionStore } from '../stores/useTransactionStore';
import { AIOverviewSection } from './settings/AIOverviewSection';
import { TypeSafeSection } from './settings/TypeSafeSection';
import { LanguageModelSection } from './settings/LanguageModelSection';
import { PreferencesSection } from './settings/PreferencesSection';
import { RulesSection } from './settings/RulesSection';
import { DangerZoneSection } from './settings/DangerZoneSection';

const PROVIDER_LABELS = AI_PROVIDER_LABELS;

export const SettingsPage: React.FC<{ onBack: () => void }> = ({ onBack }) => {
  const {
    aiMode,
    setAiMode,
    geminiConfig,
    setGeminiConfig,
    groqConfig,
    setGroqConfig,
    ollamaConfig,
    setOllamaConfig,
    customConfig,
    setCustomConfig,
    typesafeConfig,
    setTypesafeConfig,
    currency,
    setCurrency,
    applyPatterns,
    toggleApplyPatterns,
    enableSpendingAlerts,
    toggleSpendingAlerts,
    resetSettings,
    setDemoMode,
  } = useSettingsStore();

  const { addToast } = useToastStore();
  const transactions = useTransactionStore((s) => s.transactions);
  const clearAll = useTransactionStore((s) => s.clearAll);

  const [showClearPatternsConfirm, setShowClearPatternsConfirm] = useState(false);
  const [showDeleteTransactionsConfirm, setShowDeleteTransactionsConfirm] = useState(false);
  const [showResetSettingsConfirm, setShowResetSettingsConfirm] = useState(false);
  const [isTesting, setIsTesting] = useState(false);
  const [testResult, setTestResult] = useState<'success' | 'error' | null>(null);
  const [testMessage, setTestMessage] = useState('');
  const [isTestingTypesafe, setIsTestingTypesafe] = useState(false);
  const [typesafeTestResult, setTypesafeTestResult] = useState<'success' | 'error' | null>(null);
  const [typesafeTestMessage, setTypesafeTestMessage] = useState('');
  const [patternCount, setPatternCount] = useState(getPatterns().length);
  const [catalog, setCatalog] = useState<ModelCatalog | null>(null);
  const [isLoadingCatalog, setIsLoadingCatalog] = useState(true);
  // Mirrors the stale-model reset toast inside the catalog status live region
  // so screen readers also hear it (WCAG 4.1.3) — issue #79 review ui-1.
  const [modelResetNotice, setModelResetNotice] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  // Issue #79: the model lists are loaded live from each provider. Debounce
  // the inputs they depend on so typing a key or host doesn't fire a request
  // per keystroke.
  const currentApiKey =
    aiMode === 'cloud'
      ? geminiConfig.apiKey
      : aiMode === 'groq'
        ? groqConfig.apiKey
        : aiMode === 'custom'
          ? customConfig.apiKey
          : '';
  const debouncedApiKey = useDebouncedValue(currentApiKey, 500);
  const debouncedOllamaBaseUrl = useDebouncedValue(ollamaConfig.baseUrl, 500);
  const debouncedOllamaPort = useDebouncedValue(ollamaConfig.port, 500);
  const debouncedCustomBaseUrl = useDebouncedValue(customConfig.baseUrl, 500);

  useEffect(() => {
    let cancelled = false;
    setCatalog(null);
    setIsLoadingCatalog(true);
    setModelResetNotice(null);

    loadModelCatalog(aiMode).then((result) => {
      if (cancelled) return;
      setCatalog(result);
      setIsLoadingCatalog(false);

      // Stale-selection check (issue #79): only a live/cached catalog is
      // authoritative enough to reset a saved model — a degraded fallback
      // list never clobbers the user's choice.
      if (
        (aiMode === 'cloud' || aiMode === 'groq') &&
        (result.status === 'live' || result.status === 'cached')
      ) {
        const outcome = validatePersistedModel(
          aiMode,
          result.models.map((m) => m.id)
        );
        if (outcome.reset) {
          const message = `Saved model "${outcome.from}" is no longer available — switched to "${outcome.to}".`;
          // Echo the toast in the catalog status live region: the ToastContainer
          // is not an aria-live region, so without this screen readers stay
          // silent when the saved model is swapped (WCAG 4.1.3, issue #79).
          setModelResetNotice(message);
          addToast(message, 'warning', 6000);
        }
      }
    });

    return () => {
      cancelled = true;
    };
  }, [
    aiMode,
    debouncedApiKey,
    debouncedOllamaBaseUrl,
    debouncedOllamaPort,
    debouncedCustomBaseUrl,
    addToast,
  ]);

  const providerName = PROVIDER_LABELS[aiMode];
  const catalogModels = catalog?.models ?? FALLBACK_MODEL_CATALOG[aiMode];
  const selectedModel =
    aiMode === 'cloud'
      ? geminiConfig.model
      : aiMode === 'groq'
        ? groqConfig.model
        : aiMode === 'custom'
          ? customConfig.model
          : ollamaConfig.model;
  // Keep a saved-but-missing model selectable (labeled) so the control never
  // shows a blank value — e.g. when the list is degraded (issue #79, AC5).
  const selectedModelMissing =
    catalog !== null &&
    catalog.models.length > 0 &&
    selectedModel !== '' &&
    !catalog.models.some((m) => m.id === selectedModel);

  const catalogStatus = (
    <div role="status" aria-live="polite">
      {isLoadingCatalog ? (
        <p className="text-xs text-muted">Loading available models…</p>
      ) : catalog?.status === 'fallback' ? (
        <div className="flex items-start gap-2 bg-warning/10 border border-warning/20 rounded-lg p-3">
          <AlertCircle className="w-4 h-4 text-warning mt-0.5 shrink-0" />
          <p className="text-xs text-warning">{catalog.notice}</p>
        </div>
      ) : (
        <p className="text-xs text-muted">
          Showing {catalogModels.length} models from {providerName}
          {catalog?.status === 'cached' ? ' (cached list)' : ''}.
        </p>
      )}
      {modelResetNotice && <p className="text-xs text-warning mt-1">{modelResetNotice}</p>}
    </div>
  );

  const aiReady = selectAIReady(useSettingsStore.getState());
  const typesafeKeySet = !!getTypesafeApiKey({ typesafeConfig });

  const handleClearPatterns = () => {
    clearPatterns();
    setPatternCount(0);
    setShowClearPatternsConfirm(false);
    addToast('Patterns cleared successfully', 'success');
  };

  const handleDeleteTransactions = () => {
    clearAll();
    setDemoMode(false);
    setShowDeleteTransactionsConfirm(false);
    addToast('All transactions deleted', 'success');
  };

  const handleResetSettings = () => {
    resetSettings();
    setShowResetSettingsConfirm(false);
    addToast('Settings reset', 'success');
  };

  const handleExportPatterns = () => {
    const patterns = getPatterns();
    const dataStr =
      'data:text/json;charset=utf-8,' + encodeURIComponent(JSON.stringify(patterns, null, 2));
    const downloadAnchorNode = document.createElement('a');
    downloadAnchorNode.setAttribute('href', dataStr);
    downloadAnchorNode.setAttribute(
      'download',
      `moneymind_patterns_${new Date().toISOString().slice(0, 10)}.json`
    );
    document.body.appendChild(downloadAnchorNode);
    downloadAnchorNode.click();
    downloadAnchorNode.remove();
    addToast('Patterns exported', 'success');
  };

  const handleImportClick = () => {
    fileInputRef.current?.click();
  };

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = (event) => {
      const content = event.target?.result as string;
      if (content) {
        const result = importPatterns(content);
        if (result.success) {
          setPatternCount(getPatterns().length);
          addToast(
            `Successfully imported ${result.count} patterns` +
              (result.skipped > 0 ? ` (${result.skipped} invalid skipped)` : ''),
            'success'
          );
        } else {
          addToast(`Import failed: ${result.error}`, 'error');
        }
      }
    };
    reader.readAsText(file);
    // Reset input so same file can be selected again if needed
    e.target.value = '';
  };

  const handleTestConnection = async () => {
    setIsTesting(true);
    setTestResult(null);
    setTestMessage('');
    try {
      await testAiConnection();
      setTestResult('success');
      setTestMessage('Connection successful!');
    } catch (e: unknown) {
      setTestResult('error');
      setTestMessage(e instanceof Error ? e.message : String(e));
    } finally {
      setIsTesting(false);
    }
  };

  const handleTestTypesafe = async () => {
    setIsTestingTypesafe(true);
    setTypesafeTestResult(null);
    setTypesafeTestMessage('');
    try {
      await testTypesafeConnection();
      setTypesafeTestResult('success');
      setTypesafeTestMessage('TypeSafe connection successful!');
    } catch (e: unknown) {
      setTypesafeTestResult('error');
      setTypesafeTestMessage(e instanceof Error ? e.message : String(e));
    } finally {
      setIsTestingTypesafe(false);
    }
  };

  const handleSelectMode = (mode: typeof aiMode) => {
    setAiMode(mode);
    setTestResult(null);
  };

  // Roving-tabindex arrow-key navigation for the provider tabs (WCAG 4.1.2).
  const handleProviderTabKeyDown = (e: React.KeyboardEvent, index: number) => {
    if (e.key !== 'ArrowRight' && e.key !== 'ArrowLeft') return;
    e.preventDefault();
    const modes = ['cloud', 'groq', 'local', 'custom'] as const;
    const delta = e.key === 'ArrowRight' ? 1 : -1;
    const nextMode = modes[(index + delta + modes.length) % modes.length];
    setAiMode(nextMode);
    setTestResult(null);
    document.getElementById(`settings-tab-${nextMode}`)?.focus();
  };

  return (
    <div className="max-w-3xl mx-auto space-y-6 animate-rise">
      <div className="space-y-4">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="font-display text-3xl text-ink">Settings</h1>
            <p className="mt-1 text-sm text-muted">AI services, preferences and your data.</p>
          </div>
          <Button variant="outline" onClick={onBack}>
            Back
          </Button>
        </div>
      </div>

      <AIOverviewSection
        providerName={providerName}
        typesafeKeySet={typesafeKeySet}
        aiReady={aiReady}
        selectedModel={selectedModel}
      />

      <TypeSafeSection
        apiKey={getTypesafeApiKey({ typesafeConfig })}
        onApiKeyChange={(apiKey) => setTypesafeConfig({ apiKey })}
        onTest={handleTestTypesafe}
        isTesting={isTestingTypesafe}
        testResult={typesafeTestResult}
        testMessage={typesafeTestMessage}
      />

      <LanguageModelSection
        aiMode={aiMode}
        onSelectMode={handleSelectMode}
        onTabKeyDown={handleProviderTabKeyDown}
        geminiApiKey={getDeobfuscatedApiKey(useSettingsStore.getState())}
        onGeminiApiKey={(apiKey) => setGeminiConfig({ apiKey })}
        geminiModel={geminiConfig.model}
        onGeminiModel={(model) => setGeminiConfig({ model })}
        groqApiKey={getDeobfuscatedApiKey(useSettingsStore.getState())}
        onGroqApiKey={(apiKey) => setGroqConfig({ apiKey })}
        groqModel={groqConfig.model}
        onGroqModel={(model) => setGroqConfig({ model })}
        ollamaBaseUrl={ollamaConfig.baseUrl}
        onOllamaBaseUrl={(baseUrl) => setOllamaConfig({ baseUrl })}
        ollamaPort={ollamaConfig.port}
        onOllamaPort={(port) => setOllamaConfig({ port })}
        ollamaModel={ollamaConfig.model}
        onOllamaModel={(model) => setOllamaConfig({ model })}
        customBaseUrl={customConfig.baseUrl}
        onCustomBaseUrl={(baseUrl) => setCustomConfig({ baseUrl })}
        customApiKey={getDeobfuscatedApiKey(useSettingsStore.getState())}
        onCustomApiKey={(apiKey) => setCustomConfig({ apiKey })}
        customModel={customConfig.model}
        onCustomModel={(model) => setCustomConfig({ model })}
        catalogModels={catalogModels}
        selectedModel={selectedModel}
        selectedModelMissing={selectedModelMissing}
        isLoadingCatalog={isLoadingCatalog}
        catalogStatus={catalogStatus}
        testResult={testResult}
        testMessage={testMessage}
        isTesting={isTesting}
        onTest={handleTestConnection}
      />

      <PreferencesSection
        currency={currency}
        onCurrencyChange={setCurrency}
        applyPatterns={applyPatterns}
        onToggleApplyPatterns={toggleApplyPatterns}
        enableSpendingAlerts={enableSpendingAlerts}
        onToggleSpendingAlerts={toggleSpendingAlerts}
      />

      <RulesSection
        patternCount={patternCount}
        onExport={handleExportPatterns}
        onImportClick={handleImportClick}
        fileInputRef={fileInputRef}
        onFileChange={handleFileChange}
      />

      <DangerZoneSection
        patternCount={patternCount}
        onDeleteTransactions={() => setShowDeleteTransactionsConfirm(true)}
        onClearPatterns={() => setShowClearPatternsConfirm(true)}
        onResetSettings={() => setShowResetSettingsConfirm(true)}
      />

      <ConfirmDialog
        isOpen={showDeleteTransactionsConfirm}
        title="Delete all transactions?"
        message={`This removes all ${transactions.length} transactions stored in this browser. This can't be undone.`}
        confirmText="Delete"
        variant="danger"
        onConfirm={handleDeleteTransactions}
        onCancel={() => setShowDeleteTransactionsConfirm(false)}
      />
      <ConfirmDialog
        isOpen={showClearPatternsConfirm}
        title="Clear learned rules?"
        message={`This removes all ${patternCount} rules. Future imports won't be pre-categorized.`}
        confirmText="Clear rules"
        variant="danger"
        onConfirm={handleClearPatterns}
        onCancel={() => setShowClearPatternsConfirm(false)}
      />
      <ConfirmDialog
        isOpen={showResetSettingsConfirm}
        title="Reset settings?"
        message="This restores default settings and removes all saved API keys."
        confirmText="Reset"
        variant="danger"
        onConfirm={handleResetSettings}
        onCancel={() => setShowResetSettingsConfirm(false)}
      />
    </div>
  );
};
