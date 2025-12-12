import React, { useState } from 'react';
import { useSettingsStore, getDecryptedApiKey } from '../stores/useSettingsStore';
import { clearPatterns, getPatterns } from '../lib/localStorage';
import { Card, CardContent, CardHeader, CardTitle, Button, Input, Badge } from '../components/UI';
import { Trash2, CheckCircle, Circle, Cloud, Cpu, Terminal, Key, Server, PlayCircle, AlertCircle, Loader2 } from 'lucide-react';
import { testAiConnection } from '../services/aiService';

export const SettingsPage: React.FC<{ onBack: () => void }> = ({ onBack }) => {
    const { 
        aiMode, setAiMode, 
        applyPatterns, toggleApplyPatterns, 
        geminiConfig, setGeminiConfig,
        ollamaConfig, setOllamaConfig
    } = useSettingsStore();

    const [isTesting, setIsTesting] = useState(false);
    const [testResult, setTestResult] = useState<'success' | 'error' | null>(null);
    const [testMessage, setTestMessage] = useState('');

    const patternCount = getPatterns().length;

    const handleClearPatterns = () => {
        if (confirm('Delete all learned categorization patterns?')) {
            clearPatterns();
            // Force re-render not strictly needed as store subscription handles it usually, 
            // but for localStorage direct access we might need a state toggle in a real app.
            // For now, this is sufficient.
            alert('Patterns cleared.');
        }
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
                        {aiMode === 'cloud' ? <Cloud className="w-5 h-5 text-accent" /> : <Cpu className="w-5 h-5 text-accent" />}
                        AI Model Configuration
                    </CardTitle>
                </CardHeader>
                <CardContent className="p-0">
                    {/* Mode Selection Tabs */}
                    <div className="flex border-b border-gray-100">
                        <button 
                            className={`flex-1 p-4 flex items-center justify-center gap-2 font-medium transition-colors ${aiMode === 'cloud' ? 'bg-white text-accent border-b-2 border-accent' : 'bg-gray-50 text-gray-500 hover:bg-gray-100'}`}
                            onClick={() => { setAiMode('cloud'); setTestResult(null); }}
                        >
                            <Cloud className="w-4 h-4" />
                            Cloud (Gemini)
                        </button>
                        <button 
                            className={`flex-1 p-4 flex items-center justify-center gap-2 font-medium transition-colors ${aiMode === 'local' ? 'bg-white text-accent border-b-2 border-accent' : 'bg-gray-50 text-gray-500 hover:bg-gray-100'}`}
                            onClick={() => { setAiMode('local'); setTestResult(null); }}
                        >
                            <Cpu className="w-4 h-4" />
                            Local (Ollama)
                        </button>
                    </div>

                    <div className="p-6 space-y-6">
                        {aiMode === 'cloud' ? (
                            <div className="space-y-4 animate-in fade-in duration-300">
                                <div className="space-y-2">
                                    <label className="text-sm font-medium text-gray-700 flex items-center gap-2">
                                        <Key className="w-4 h-4" /> API Key
                                    </label>
                                    <Input 
                                        type="password" 
                                        placeholder="Enter your Gemini API Key" 
                                        value={getDecryptedApiKey(useSettingsStore.getState())} // Show actual value if editing, masking handled by input type
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
                        ) : (
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
                                        <div className="text-sm text-gray-600">
                                            <p className="font-medium text-gray-900 mb-1">How to find your model name:</p>
                                            <ol className="list-decimal list-inside space-y-1">
                                                <li>Open your terminal</li>
                                                <li>Run <code className="bg-gray-200 px-1 py-0.5 rounded text-gray-800 font-mono text-xs">ollama list</code></li>
                                                <li>Copy the name under the "NAME" column (e.g., <span className="font-mono">llama3.2:latest</span>)</li>
                                            </ol>
                                        </div>
                                    </div>
                                </div>
                            </div>
                        )}

                        <div className="pt-4 border-t border-gray-100 flex items-center justify-between">
                            <div className="flex items-center gap-2">
                                {testResult === 'success' && (
                                    <span className="text-sm text-green-600 flex items-center gap-1 font-medium animate-in fade-in">
                                        <CheckCircle className="w-4 h-4" /> {testMessage}
                                    </span>
                                )}
                                {testResult === 'error' && (
                                    <span className="text-sm text-red-600 flex items-center gap-1 font-medium animate-in fade-in">
                                        <AlertCircle className="w-4 h-4" /> {testMessage}
                                    </span>
                                )}
                            </div>
                            <Button 
                                onClick={handleTestConnection} 
                                isLoading={isTesting}
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
                        <div className="flex items-center justify-between">
                            <div>
                                <h4 className="font-medium text-gray-900">Stored Patterns: {patternCount}</h4>
                                <p className="text-sm text-gray-500">Patterns are stored in your browser's LocalStorage.</p>
                            </div>
                            <Button variant="danger" size="sm" onClick={handleClearPatterns} disabled={patternCount === 0}>
                                <Trash2 className="w-4 h-4 mr-2" /> Clear Patterns
                            </Button>
                        </div>
                    </div>
                </CardContent>
            </Card>
        </div>
    );
};