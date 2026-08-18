import React, { useState, useRef, useEffect } from 'react';
import {
  useSettingsStore,
  getDeobfuscatedApiKey,
  getEnvGeminiApiKey,
} from '../stores/useSettingsStore';
import { clearPatterns, getPatterns, importPatterns } from '../lib/localStorage';
import { Card, CardContent, CardHeader, CardTitle, Button, Input } from '../components/UI';
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
  Info,
  BarChart2,
} from 'lucide-react';
import { testAiConnection } from '../services/aiService';
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
    usage,
  } = useSettingsStore();

  const { addToast } = useToastStore();

  const [isTesting, setIsTesting] = useState(false);
  const [testResult, setTestResult] = useState<'success' | 'error' | null>(null);
  const [testMessage, setTestMessage] = useState('');
  const [patternCount, setPatternCount] = useState(getPatterns().length);
  const fileInputRef = useRef<HTMLInputElement>(null);

  // Logic to detect key usage state
  const envKey = getEnvGeminiApiKey();
  // Deobfuscate locally for comparison
  const currentStoredKey = (() => {
    try {
      return atob(geminiConfig.apiKey);
    } catch {
      return geminiConfig.apiKey;
    }
  })();

  const isUsingEnvKey = !!envKey && currentStoredKey === envKey;
  const isUsingCustomKey = currentStoredKey && (!envKey || currentStoredKey !== envKey);

  // Force model to gemini-flash-lite-latest if using Env Key
  useEffect(() => {
    if (
      aiMode === 'cloud' &&
      isUsingEnvKey &&
      geminiConfig.model !== 'models/gemini-flash-lite-latest'
    ) {
      setGeminiConfig({ model: 'models/gemini-flash-lite-latest' });
    }
  }, [aiMode, isUsingEnvKey, geminiConfig.model, setGeminiConfig]);

  const handleClearPatterns = () => {
    // Removed confirm()
    clearPatterns();
    setPatternCount(0);
    addToast('Patterns cleared successfully', 'success');
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

  // Usage Calculations
  const txPercent = Math.min((usage.txAnalyzed / 150) * 100, 100);
  const chatPercent = Math.min((usage.chatMessages / 10) * 100, 100);

  return (
    <div className="max-w-3xl mx-auto space-y-6 animate-in fade-in slide-in-from-bottom-4">
      <div className="flex items-center justify-between mb-6">
        <h1 className="text-3xl font-bold text-gray-900">Settings</h1>
        <Button variant="outline" onClick={onBack}>
          Back to Dashboard
        </Button>
      </div>

      {/* Usage Budget Card - Only show if using Environment/Demo Key (Limited) */}
      {aiMode === 'cloud' && isUsingEnvKey && (
        <Card>
          <CardHeader className="bg-gray-50/50 border-b border-gray-100">
            <CardTitle className="flex items-center gap-2">
              <BarChart2 className="w-5 h-5 text-accent" />
              Usage Budget
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-6 pt-6">
            <div className="flex items-center justify-between">
              <p className="text-sm text-gray-500">
                To ensure fair usage, AI analysis is limited per user.
                <br />
                <span className="text-xs text-gray-400">
                  Limits are hard-coded and cannot be reset manually.
                </span>
              </p>
            </div>

            <div className="space-y-4">
              {/* TX Analysis */}
              <div className="space-y-2">
                <div className="flex justify-between text-sm font-medium">
                  <span>Transaction Analysis</span>
                  <span className={txPercent >= 100 ? 'text-red-600' : 'text-gray-700'}>
                    {usage.txAnalyzed} / 150
                  </span>
                </div>
                <div className="h-2 w-full bg-gray-100 rounded-full overflow-hidden">
                  <div
                    className={`h-full transition-all duration-500 ${txPercent >= 100 ? 'bg-red-500' : 'bg-accent'}`}
                    style={{ width: `${txPercent}%` }}
                  />
                </div>
              </div>

              {/* Chat Messages */}
              <div className="space-y-2">
                <div className="flex justify-between text-sm font-medium">
                  <span>MonkeySmile Messages</span>
                  <span className={chatPercent >= 100 ? 'text-red-600' : 'text-gray-700'}>
                    {usage.chatMessages} / 10
                  </span>
                </div>
                <div className="h-2 w-full bg-gray-100 rounded-full overflow-hidden">
                  <div
                    className={`h-full transition-all duration-500 ${chatPercent >= 100 ? 'bg-red-500' : 'bg-blue-500'}`}
                    style={{ width: `${chatPercent}%` }}
                  />
                </div>
              </div>
            </div>
          </CardContent>
        </Card>
      )}

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
                onClick={handleClearPatterns}
              >
                <Trash2 className="w-3.5 h-3.5 mr-2" />
                Clear All Patterns
              </Button>
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
                {isUsingEnvKey && (
                  <div className="bg-blue-50 border border-blue-100 rounded-lg p-3 flex items-start gap-3">
                    <Info className="w-5 h-5 text-blue-600 mt-0.5" />
                    <div>
                      <p className="text-sm font-medium text-blue-900">Testing Mode</p>
                      <p className="text-xs text-blue-700 mt-1 leading-relaxed">
                        You are using our api key for testing. You can use the Gemini service, but
                        usage is limited to the <code>gemini‑flash‑lite‑latest</code> model. To use
                        without limit, please use your own key
                      </p>
                    </div>
                  </div>
                )}

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
                    placeholder="Enter your Gemini API Key (or leave empty for demo)"
                    value={getDeobfuscatedApiKey(useSettingsStore.getState())}
                    onChange={(e) => setGeminiConfig({ apiKey: e.target.value })}
                    className="font-mono"
                  />
                  <p className="text-xs text-gray-500">
                    Your key is stored locally (obfuscated, not encrypted). Leave empty to use the
                    shared demo key (chat only).
                  </p>
                </div>
                <div className="space-y-2">
                  <label className="text-sm font-medium text-gray-700 flex items-center gap-2">
                    <Server className="w-4 h-4" /> Model Selection
                  </label>
                  <select
                    className="flex h-10 w-full rounded-md border border-gray-300 bg-white px-3 py-2 text-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent"
                    value={geminiConfig.model}
                    onChange={(e) => setGeminiConfig({ model: e.target.value })}
                    disabled={isUsingEnvKey} // Disable selection if forced to Lite
                  >
                    {isUsingEnvKey ? (
                      <option value="models/gemini-flash-lite-latest">
                        gemini-flash-lite-latest (Fastest)
                      </option>
                    ) : (
                      <>
                        <option value="models/gemini-flash-latest">
                          gemini-flash-latest (Recommended)
                        </option>
                        <option value="models/gemini-flash-lite-latest">
                          gemini-flash-lite-latest (Fastest)
                        </option>
                        <option value="models/gemini-3-pro-preview">
                          gemini-3-pro-preview (Most Capable)
                        </option>
                      </>
                    )}
                  </select>
                  {isUsingEnvKey && (
                    <p className="text-xs text-gray-400">Model selection locked in testing mode.</p>
                  )}
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
                  <label className="text-sm font-medium text-gray-700 flex items-center gap-2">
                    <Server className="w-4 h-4" /> Model Selection
                  </label>
                  <select
                    className="flex h-10 w-full rounded-md border border-gray-300 bg-white px-3 py-2 text-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent"
                    value={groqConfig.model}
                    onChange={(e) => setGroqConfig({ model: e.target.value })}
                  >
                    <option value="llama-3.1-8b-instant">llama-3.1-8b-instant</option>
                    <option value="openai/gpt-oss-20b">openai/gpt-oss-20b</option>
                  </select>
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
                  <label className="text-sm font-medium text-gray-700">Specific Model Name</label>
                  <Input
                    placeholder="llama3.2"
                    value={ollamaConfig.model}
                    onChange={(e) => setOllamaConfig({ model: e.target.value })}
                  />
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
