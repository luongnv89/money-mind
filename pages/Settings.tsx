
import React, { useState, useRef } from 'react';
import { useSettingsStore, getDecryptedApiKey } from '../stores/useSettingsStore';
import { clearPatterns, getPatterns, importPatterns } from '../lib/localStorage';
import { Card, CardContent, CardHeader, CardTitle, Button, Input, Badge } from '../components/UI';
import { Trash2, CheckCircle, Circle, Cloud, Cpu, Terminal, Key, Server, PlayCircle, AlertCircle, Loader2, Zap, Download, Upload } from 'lucide-react';
import { testAiConnection } from '../services/aiService';

export const SettingsPage: React.FC<{ onBack: () => void }> = ({ onBack }) => {
    const { 
        aiMode, setAiMode, 
        applyPatterns, toggleApplyPatterns, 
        geminiConfig, setGeminiConfig,
        groqConfig, setGroqConfig,
        ollamaConfig, setOllamaConfig
    } = useSettingsStore();

    const [isTesting, setIsTesting] = useState(false);
    const [testResult, setTestResult] = useState<'success' | 'error' | null>(null);
    const [testMessage, setTestMessage] = useState('');
    const [patternCount, setPatternCount] = useState(getPatterns().length);
    const fileInputRef = useRef<HTMLInputElement>(null);

    const handleClearPatterns = () => {
        // Removed confirm()
        clearPatterns();
        setPatternCount(0);
    };

    const handleExportPatterns = () => {
        const patterns = getPatterns();
        const dataStr = "data:text/json;charset=utf-8," + encodeURIComponent(JSON.stringify(patterns, null, 2));
        const downloadAnchorNode = document.createElement('a');
        downloadAnchorNode.setAttribute("href", dataStr);
        downloadAnchorNode.setAttribute("download", `moneymind_patterns_${new Date().toISOString().slice(0, 10)}.json`);
        document.body.appendChild(downloadAnchorNode);
        downloadAnchorNode.click();
        downloadAnchorNode.remove();
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
                    alert(`Successfully imported ${result.count} patterns.`);
                } else {
                    alert(`Import failed: ${result.error}`);
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
        } catch (e: any) {
            setTestResult('error');
            setTestMessage(e.message);
        } finally {
            setIsTesting(false);
        }
    };

    return (
        <div className="max-w-3xl mx-auto space-y-6 animate-in fade-in slide-in-from-bottom-4">
            <div className="flex items-center justify-between mb-6">
                <h1 className="text-3xl font-bold text-gray-900">Settings</h1>
                <Button variant="outline" onClick={onBack}>Back to Dashboard</Button>
            </div>

            <Card className="overflow-hidden">
                <CardHeader className="bg-gray-50/50 border-b border-gray-100">
                    <CardTitle className="flex items-center gap-2">
                        {aiMode === 'local' ? <Cpu className="w-5 h-5 text-accent" /> : <Cloud className="w-5 h-5 text-accent" />}
                        AI Model Configuration
                    </CardTitle>
                </CardHeader>
                <CardContent className="p-0">
                    {/* Mode Selection Tabs */}
                    <div className="flex border-b border-gray-100 overflow-x-auto">
                        <button 
                            className={`flex-1 p-4 flex items-center justify-center gap-2 font-medium transition-colors whitespace-nowrap ${aiMode === 'cloud' ? 'bg-white text-accent border-b-2 border-accent' : 'bg-gray-50 text-gray-500 hover:bg-gray-100'}`}
                            onClick={() => { setAiMode('cloud'); setTestResult(null); }}
                        >
                            <Cloud className="w-4 h-4" />
                            Gemini (Google)
                        </button>
                        <button 
                            className={`flex-1 p-4 flex items-center justify-center gap-2 font-medium transition-colors whitespace-nowrap ${aiMode === 'groq' ? 'bg-white text-accent border-b-2 border-accent' : 'bg-gray-50 text-gray-500 hover:bg-gray-100'}`}
                            onClick={() => { setAiMode('groq'); setTestResult(null); }}
                        >
                            <Zap className="w-4 h-4" />
                            Groq (Fast)
                        </button>
                        <button 
                            className={`flex-1 p-4 flex items-center justify-center gap-2 font-medium transition-colors whitespace-nowrap ${aiMode === 'local' ? 'bg-white text-accent border-b-2 border-accent' : 'bg-gray-50 text-gray-500 hover:bg-gray-100'}`}
                            onClick={() => { setAiMode('local'); setTestResult(null); }}
                        >
                            <Cpu className="w-4 h-4" />
                            Ollama (Local)
                        </button>
                    </div>

                    <div className="p-6 space-y-6">
                        {aiMode === 'cloud' && (
                            <div className="space-y-4 animate-in fade-in duration-300">
                                <div className="space-y-2">
                                    <label className="text-sm font-medium text-gray-700 flex items-center gap-2">
                                        <Key className="w-4 h-4" /> API Key
                                    </label>
                                    <Input 
                                        type="password" 
                                        placeholder="Enter your Gemini API Key" 
                                        value={getDecryptedApiKey(useSettingsStore.getState())} 
                                        onChange={(e) => setGeminiConfig({ apiKey: e.target.value })}
                                        className="font-mono"
                                    />
                                    <p className="text-xs text-gray-500">
                                        Your key is encrypted and stored locally in your browser.
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
                                    >
                                        <option value="models/gemini-flash-latest">gemini-flash-latest (Recommended)</option>
                                        <option value="models/gemini-flash-lite-latest">gemini-flash-lite-latest (Fastest)</option>
                                        <option value="models/gemini-3-pro-preview">gemini-3-pro-preview (Most Capable)</option>
                                    </select>
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
                                        value={getDecryptedApiKey(useSettingsStore.getState())} 
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
                                                <li>Sign up at <a href="https://console.groq.com" target="_blank" rel="noopener noreferrer" className="text-accent hover:underline">console.groq.com</a></li>
                                                <li>Create an API Key in the dashboard</li>
                                                <li>Paste the key above starting with <code>gsk_</code></li>
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
                                            <div className="whitespace-pre-wrap font-medium font-mono text-xs">{testMessage}</div>
                                        </div>
                                    )}
                                </div>
                                <Button 
                                    onClick={handleTestConnection} 
                                    isLoading={isTesting}
                                    className="shrink-0"
                                    variant={testResult === 'success' ? 'outline' : 'primary'}
                                >
                                    {isTesting ? 'Testing...' : (
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

            <Card>
                <CardHeader>
                    <CardTitle>Learning & Privacy</CardTitle>
                </CardHeader>
                <CardContent className="space-y-6">
                    <div className="flex items-center justify-between">
                        <div>
                            <h4 className="font-medium text-gray-900">Apply Learned Patterns</h4>
                            <p className="text-sm text-gray-500">Auto-categorize transactions based on your previous corrections.</p>
                        </div>
                        <div 
                            className={`w-12 h-6 rounded-full p-1 cursor-pointer transition-colors ${applyPatterns ? 'bg-accent' : 'bg-gray-300'}`}
                            onClick={toggleApplyPatterns}
                        >
                            <div className={`w-4 h-4 rounded-full bg-white transition-transform ${applyPatterns ? 'translate-x-6' : 'translate-x-0'}`} />
                        </div>
                    </div>

                    <div className="border-t border-gray-100 pt-6">
                        <div className="flex flex-col sm:flex-row items-center justify-between gap-4">
                            <div className="flex-1">
                                <h4 className="font-medium text-gray-900">Stored Patterns: {patternCount}</h4>
                                <p className="text-sm text-gray-500">Patterns are stored in your browser's LocalStorage.</p>
                            </div>
                            
                            <div className="flex gap-2 w-full sm:w-auto">
                                {/* Import/Export Logic */}
                                <input 
                                    type="file" 
                                    accept=".json" 
                                    ref={fileInputRef} 
                                    className="hidden" 
                                    onChange={handleFileChange} 
                                />
                                
                                <Button variant="outline" size="sm" onClick={handleExportPatterns} className="flex-1 sm:flex-none">
                                    <Download className="w-4 h-4 mr-2" /> Export
                                </Button>
                                <Button variant="outline" size="sm" onClick={handleImportClick} className="flex-1 sm:flex-none">
                                    <Upload className="w-4 h-4 mr-2" /> Import
                                </Button>
                                <Button variant="danger" size="sm" onClick={handleClearPatterns} disabled={patternCount === 0} className="flex-1 sm:flex-none">
                                    <Trash2 className="w-4 h-4 mr-2" /> Clear
                                </Button>
                            </div>
                        </div>
                    </div>
                </CardContent>
            </Card>
        </div>
    );
};
