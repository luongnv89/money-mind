import React, { useState, useRef, useEffect } from 'react';
import {
  useSettingsStore,
  getDeobfuscatedApiKey,
  validatePersistedModel,
} from '../stores/useSettingsStore';
import { clearPatterns, getPatterns, importPatterns } from '../lib/localStorage';
import { useDebouncedValue } from '../lib/useDebounce';
import { Card, CardContent, CardHeader, CardTitle, Button, Input } from '../components/UI';
import { ConfirmDialog } from '../components/ConfirmDialog';
import {
  Trash2,
  CheckCircle,
  Cloud,
  Cpu,
  Terminal,
  Key,
  Server,
  PlayCircle,
  AlertCircle,
  Zap,
  Download,
  Upload,
  BarChart2,
} from 'lucide-react';
import { testAiConnection } from '../services/aiService';
import { loadModelCatalog } from '../services/modelCatalog';
import { FALLBACK_MODEL_CATALOG } from '../constants';
import { ModelCatalog } from '../types';
import { useToastStore } from '../stores/useToastStore';

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
  } = useSettingsStore();

  const { addToast } = useToastStore();

  const [showClearPatternsConfirm, setShowClearPatternsConfirm] = useState(false);
  const [isTesting, setIsTesting] = useState(false);
  const [testResult, setTestResult] = useState<'success' | 'error' | null>(null);
  const [testMessage, setTestMessage] = useState('');
  const [patternCount, setPatternCount] = useState(getPatterns().length);
  const [catalog, setCatalog] = useState<ModelCatalog | null>(null);
  const [isLoadingCatalog, setIsLoadingCatalog] = useState(true);
  const fileInputRef = useRef<HTMLInputElement>(null);

  // Issue #79: the model lists are loaded live from each provider. Debounce
  // the inputs they depend on so typing a key or host doesn't fire a request
  // per keystroke.
  const currentApiKey =
    aiMode === 'cloud' ? geminiConfig.apiKey : aiMode === 'groq' ? groqConfig.apiKey : '';
  const debouncedApiKey = useDebouncedValue(currentApiKey, 500);
  const debouncedOllamaBaseUrl = useDebouncedValue(ollamaConfig.baseUrl, 500);
  const debouncedOllamaPort = useDebouncedValue(ollamaConfig.port, 500);

  useEffect(() => {
    let cancelled = false;
    setCatalog(null);
    setIsLoadingCatalog(true);

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
          addToast(
            `Saved model "${outcome.from}" is no longer available — switched to "${outcome.to}".`,
            'warning',
            6000
          );
        }
      }
    });

    return () => {
      cancelled = true;
    };
  }, [aiMode, debouncedApiKey, debouncedOllamaBaseUrl, debouncedOllamaPort, addToast]);

  const providerName = aiMode === 'cloud' ? 'Gemini' : aiMode === 'groq' ? 'Groq' : 'Ollama';
  const catalogModels = catalog?.models ?? FALLBACK_MODEL_CATALOG[aiMode];
  const selectedModel =
    aiMode === 'cloud'
      ? geminiConfig.model
      : aiMode === 'groq'
        ? groqConfig.model
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
        <p className="text-xs text-gray-500">Loading available models…</p>
      ) : catalog?.status === 'fallback' ? (
        <div className="flex items-start gap-2 bg-amber-50 border border-amber-100 rounded-lg p-3">
          <AlertCircle className="w-4 h-4 text-amber-600 mt-0.5 shrink-0" />
          <p className="text-xs text-amber-700">{catalog.notice}</p>
        </div>
      ) : (
        <p className="text-xs text-gray-500">
          Showing {catalogModels.length} models from {providerName}
          {catalog?.status === 'cached' ? ' (cached list)' : ''}.
        </p>
      )}
    </div>
  );

  // Logic to detect key usage state
  const currentStoredKey = (() => {
    try {
      return atob(geminiConfig.apiKey);
    } catch {
      return geminiConfig.apiKey;
    }
  })();

  const isUsingCustomKey = !!currentStoredKey;

  const handleClearPatterns = () => {
    clearPatterns();
    setPatternCount(0);
    addToast('Patterns cleared successfully', 'success');
  };

  const handleConfirmClearPatterns = () => {
    handleClearPatterns();
    setShowClearPatternsConfirm(false);
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
          addToast(`Successfully imported ${result.count} patterns`, 'success');
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

  return (
    <div className="max-w-3xl mx-auto space-y-6 animate-in fade-in slide-in-from-bottom-4">
      <div className="flex items-center justify-between mb-6">
        <h1 className="text-3xl font-bold text-gray-900">Settings</h1>
        <Button variant="outline" onClick={onBack}>
          Back to Dashboard
        </Button>
      </div>

      <Card>
        <CardHeader className="bg-gray-50/50 border-b border-gray-100">
          <CardTitle className="flex items-center gap-2">
            <Download className="w-5 h-5 text-accent" />
            Data Management
          </CardTitle>
        </CardHeader>
        <CardContent className="p-6 space-y-6">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <div className="space-y-4">
              <h3 className="text-sm font-medium text-gray-900 flex items-center gap-2">
                <BarChart2 className="w-4 h-4 text-accent" />
                Categorization Patterns
              </h3>
              <p className="text-xs text-gray-500">
                You have <strong>{patternCount}</strong> custom categorization patterns stored
                locally. These help the AI learn from your manual corrections.
              </p>
              <div className="flex flex-wrap gap-2">
                <Button size="sm" variant="outline" onClick={handleExportPatterns}>
                  <Download className="w-3.5 h-3.5 mr-2" />
                  Export
                </Button>
                <Button size="sm" variant="outline" onClick={handleImportClick}>
                  <Upload className="w-3.5 h-3.5 mr-2" />
                  Import
                </Button>
                <Input
                  type="file"
                  ref={fileInputRef}
                  className="hidden"
                  accept=".json"
                  onChange={handleFileChange}
                />
              </div>
            </div>

            <div className="space-y-4">
              <h3 className="text-sm font-medium text-gray-900 flex items-center gap-2">
                <Trash2 className="w-4 h-4 text-red-500" />
                Reset & Clear
              </h3>
              <p className="text-xs text-gray-500">
                Permanently delete all learned patterns. This cannot be undone.
              </p>
              <Button
                size="sm"
                variant="outline"
                className="text-red-600 border-red-200 hover:bg-red-50"
                onClick={() => setShowClearPatternsConfirm(true)}
              >
                <Trash2 className="w-3.5 h-3.5 mr-2" />
                Clear All Patterns
              </Button>
              <ConfirmDialog
                isOpen={showClearPatternsConfirm}
                title="Clear All Patterns"
                message="Are you sure you want to delete all learned categorization patterns? This action cannot be undone."
                confirmText="Clear All"
                variant="danger"
                onConfirm={handleConfirmClearPatterns}
                onCancel={() => setShowClearPatternsConfirm(false)}
              />
            </div>
          </div>
        </CardContent>
      </Card>

      <Card className="overflow-hidden">
        <CardHeader className="bg-gray-50/50 border-b border-gray-100">
          <CardTitle className="flex items-center gap-2">
            {aiMode === 'local' ? (
              <Cpu className="w-5 h-5 text-accent" />
            ) : (
              <Cloud className="w-5 h-5 text-accent" />
            )}
            AI Model Configuration
          </CardTitle>
        </CardHeader>
        <CardContent className="p-0">
          {/* Mode Selection Tabs */}
          <div className="flex border-b border-gray-100 overflow-x-auto">
            <button
              className={`flex-1 p-4 flex items-center justify-center gap-2 font-medium transition-colors whitespace-nowrap ${aiMode === 'cloud' ? 'bg-white text-accent border-b-2 border-accent' : 'bg-gray-50 text-gray-500 hover:bg-gray-100'}`}
              onClick={() => {
                setAiMode('cloud');
                setTestResult(null);
              }}
            >
              <Cloud className="w-4 h-4" />
              Gemini (Google)
            </button>
            <button
              className={`flex-1 p-4 flex items-center justify-center gap-2 font-medium transition-colors whitespace-nowrap ${aiMode === 'groq' ? 'bg-white text-accent border-b-2 border-accent' : 'bg-gray-50 text-gray-500 hover:bg-gray-100'}`}
              onClick={() => {
                setAiMode('groq');
                setTestResult(null);
              }}
            >
              <Zap className="w-4 h-4" />
              Groq (Fast)
            </button>
            <button
              className={`flex-1 p-4 flex items-center justify-center gap-2 font-medium transition-colors whitespace-nowrap ${aiMode === 'local' ? 'bg-white text-accent border-b-2 border-accent' : 'bg-gray-50 text-gray-500 hover:bg-gray-100'}`}
              onClick={() => {
                setAiMode('local');
                setTestResult(null);
              }}
            >
              <Cpu className="w-4 h-4" />
              Ollama (Local)
            </button>
          </div>

          <div className="p-6 space-y-6">
            {aiMode === 'cloud' && (
              <div className="space-y-4 animate-in fade-in duration-300">
                {isUsingCustomKey && (
                  <div className="bg-green-50 border border-green-100 rounded-lg p-3 flex items-start gap-3">
                    <CheckCircle className="w-5 h-5 text-green-600 mt-0.5" />
                    <div>
                      <p className="text-sm font-medium text-green-900">Full Access</p>
                      <div className="text-xs text-green-700 mt-1 leading-relaxed">
                        Your key allows full access. Available models:
                      </div>
                    </div>
                  </div>
                )}

                <div className="space-y-2">
                  <label className="text-sm font-medium text-gray-700 flex items-center gap-2">
                    <Key className="w-4 h-4" /> API Key
                  </label>
                  <Input
                    type="password"
                    placeholder="Enter your Gemini API Key"
                    value={getDeobfuscatedApiKey(useSettingsStore.getState())}
                    onChange={(e) => setGeminiConfig({ apiKey: e.target.value })}
                    className="font-mono"
                  />
                  <p className="text-xs text-gray-500">
                    Your key is stored locally (obfuscated, not encrypted). Without a key, usage is
                    limited to 150 transaction analyses and 10 chat messages.
                  </p>
                </div>
                <div className="space-y-2">
                  <label
                    htmlFor="gemini-model"
                    className="text-sm font-medium text-gray-700 flex items-center gap-2"
                  >
                    <Server className="w-4 h-4" /> Model Selection
                  </label>
                  <select
                    id="gemini-model"
                    aria-busy={isLoadingCatalog}
                    className="flex h-10 w-full rounded-md border border-gray-300 bg-white px-3 py-2 text-sm focus-visible:outline-hidden focus-visible:ring-2 focus-visible:ring-accent"
                    value={geminiConfig.model}
                    onChange={(e) => setGeminiConfig({ model: e.target.value })}
                  >
                    {selectedModelMissing && (
                      <option value={selectedModel}>
                        {selectedModel} (saved — not in the current model list)
                      </option>
                    )}
                    {catalogModels.map((m) => (
                      <option key={m.id} value={m.id}>
                        {m.label}
                      </option>
                    ))}
                  </select>
                  {catalogStatus}
                </div>
              </div>
            )}

            {aiMode === 'groq' && (
              <div className="space-y-6 animate-in fade-in duration-300">
                <div className="space-y-2">
                  <label className="text-sm font-medium text-gray-700 flex items-center gap-2">
                    <Key className="w-4 h-4" /> API Key
                  </label>
                  <Input
                    type="password"
                    placeholder="Enter your Groq API Key (gsk_...)"
                    value={getDeobfuscatedApiKey(useSettingsStore.getState())}
                    onChange={(e) => setGroqConfig({ apiKey: e.target.value })}
                    className="font-mono"
                  />
                </div>

                <div className="space-y-2">
                  <label
                    htmlFor="groq-model"
                    className="text-sm font-medium text-gray-700 flex items-center gap-2"
                  >
                    <Server className="w-4 h-4" /> Model Selection
                  </label>
                  <select
                    id="groq-model"
                    aria-busy={isLoadingCatalog}
                    className="flex h-10 w-full rounded-md border border-gray-300 bg-white px-3 py-2 text-sm focus-visible:outline-hidden focus-visible:ring-2 focus-visible:ring-accent"
                    value={groqConfig.model}
                    onChange={(e) => setGroqConfig({ model: e.target.value })}
                  >
                    {selectedModelMissing && (
                      <option value={selectedModel}>
                        {selectedModel} (saved — not in the current model list)
                      </option>
                    )}
                    {catalogModels.map((m) => (
                      <option key={m.id} value={m.id}>
                        {m.label}
                      </option>
                    ))}
                  </select>
                  {catalogStatus}
                </div>

                <div className="bg-gray-50 rounded-lg p-4 border border-gray-200">
                  <div className="flex items-start gap-3">
                    <Zap className="w-5 h-5 text-orange-500 mt-0.5" />
                    <div className="text-sm text-gray-600 space-y-2">
                      <p className="font-medium text-gray-900">Groq Quickstart:</p>
                      <ul className="list-disc list-inside space-y-1 ml-1">
                        <li>
                          Sign up at{' '}
                          <a
                            href="https://console.groq.com"
                            target="_blank"
                            rel="noopener noreferrer"
                            className="text-accent hover:underline"
                          >
                            console.groq.com
                          </a>
                        </li>
                        <li>Create an API Key in the dashboard</li>
                        <li>
                          Paste the key above starting with <code>gsk_</code>
                        </li>
                      </ul>
                    </div>
                  </div>
                </div>
              </div>
            )}

            {aiMode === 'local' && (
              <div className="space-y-6 animate-in fade-in duration-300">
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <label className="text-sm font-medium text-gray-700">Base URL</label>
                    <Input
                      placeholder="http://localhost"
                      value={ollamaConfig.baseUrl}
                      onChange={(e) => setOllamaConfig({ baseUrl: e.target.value })}
                    />
                  </div>
                  <div className="space-y-2">
                    <label className="text-sm font-medium text-gray-700">Port</label>
                    <Input
                      placeholder="11434"
                      value={ollamaConfig.port}
                      onChange={(e) => setOllamaConfig({ port: e.target.value })}
                    />
                  </div>
                </div>

                <div className="space-y-2">
                  <label htmlFor="ollama-model" className="text-sm font-medium text-gray-700">
                    Specific Model Name
                  </label>
                  <Input
                    id="ollama-model"
                    placeholder="llama3.2"
                    value={ollamaConfig.model}
                    onChange={(e) => setOllamaConfig({ model: e.target.value })}
                    list="ollama-models"
                  />
                  <datalist id="ollama-models">
                    {catalogModels.map((m) => (
                      <option key={m.id} value={m.id} />
                    ))}
                  </datalist>
                  <p className="text-xs text-gray-500">
                    Free text — models you have pulled locally appear as suggestions, but any model
                    name works.
                  </p>
                  {catalogStatus}
                </div>

                <div className="bg-gray-50 rounded-lg p-4 border border-gray-200">
                  <div className="flex items-start gap-3">
                    <Terminal className="w-5 h-5 text-gray-400 mt-0.5" />
                    <div className="text-sm text-gray-600 space-y-2">
                      <p className="font-medium text-gray-900">Ollama Setup Commands:</p>
                      <p className="text-xs text-gray-500">Close Ollama from the taskbar first!</p>

                      <div className="bg-white border border-gray-200 rounded p-2 text-xs font-mono">
                        <div className="text-gray-400 mb-1 select-none"># Mac / Linux</div>
                        <div className="select-all">OLLAMA_ORIGINS="*" ollama serve</div>
                      </div>

                      <div className="bg-white border border-gray-200 rounded p-2 text-xs font-mono">
                        <div className="text-gray-400 mb-1 select-none"># Windows (PowerShell)</div>
                        <div className="select-all">$env:OLLAMA_ORIGINS="*"; ollama serve</div>
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            )}

            {/* Test Connection Section with Enhanced Error Display */}
            <div className="pt-4 border-t border-gray-100">
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                <div className="flex-1">
                  {testResult === 'success' && (
                    <div className="text-sm text-green-600 flex items-center gap-1 font-medium animate-in fade-in bg-green-50 p-3 rounded-lg border border-green-100">
                      <CheckCircle className="w-4 h-4 shrink-0" /> {testMessage}
                    </div>
                  )}
                  {testResult === 'error' && (
                    <div className="text-sm text-red-600 flex items-start gap-2 animate-in fade-in bg-red-50 p-3 rounded-lg border border-red-100">
                      <AlertCircle className="w-4 h-4 shrink-0 mt-0.5" />
                      <div className="whitespace-pre-wrap font-medium font-mono text-xs">
                        {testMessage}
                      </div>
                    </div>
                  )}
                </div>
                <Button
                  onClick={handleTestConnection}
                  isLoading={isTesting}
                  className="shrink-0"
                  variant={testResult === 'success' ? 'outline' : 'primary'}
                >
                  {isTesting ? (
                    'Testing...'
                  ) : (
                    <>
                      <PlayCircle className="w-4 h-4 mr-2" />
                      Test Connection
                    </>
                  )}
                </Button>
              </div>
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  );
};
