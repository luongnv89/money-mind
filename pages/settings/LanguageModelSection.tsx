import React from 'react';
import { Cloud, Cpu, Globe, Key, PlayCircle, Server, Terminal, Zap } from 'lucide-react';
import {
  Badge,
  Button,
  Card,
  CardContent,
  CardHeader,
  CardTitle,
  Input,
} from '../../components/UI';
import { describeModel } from '../../services/modelCatalog';
import { ConnectionTestResult } from './shared';

/** Provider switcher tabs — order defines arrow-key traversal. */
const PROVIDER_TABS = [
  { mode: 'cloud', label: 'Gemini (Google)', Icon: Cloud },
  { mode: 'groq', label: 'Groq (Fast)', Icon: Zap },
  { mode: 'local', label: 'Ollama (Local)', Icon: Cpu },
  { mode: 'custom', label: 'Custom Endpoint', Icon: Globe },
] as const;

type ProviderMode = (typeof PROVIDER_TABS)[number]['mode'];

export interface LanguageModelSectionProps {
  aiMode: ProviderMode;
  onSelectMode: (mode: ProviderMode) => void;
  onTabKeyDown: (e: React.KeyboardEvent, index: number) => void;
  geminiApiKey: string;
  onGeminiApiKey: (key: string) => void;
  geminiModel: string;
  onGeminiModel: (model: string) => void;
  groqApiKey: string;
  onGroqApiKey: (key: string) => void;
  groqModel: string;
  onGroqModel: (model: string) => void;
  ollamaBaseUrl: string;
  onOllamaBaseUrl: (url: string) => void;
  ollamaPort: string;
  onOllamaPort: (port: string) => void;
  ollamaModel: string;
  onOllamaModel: (model: string) => void;
  customBaseUrl: string;
  onCustomBaseUrl: (url: string) => void;
  customApiKey: string;
  onCustomApiKey: (key: string) => void;
  customModel: string;
  onCustomModel: (model: string) => void;
  catalogModels: { id: string; label: string }[];
  selectedModel: string;
  selectedModelMissing: boolean;
  isLoadingCatalog: boolean;
  catalogStatus: React.ReactNode;
  testResult: 'success' | 'error' | null;
  testMessage: string;
  isTesting: boolean;
  onTest: () => void;
}

const MODEL_SELECT_CLASS =
  'flex h-10 w-full rounded-lg border border-line-strong bg-surface px-3 py-2 text-sm text-ink focus-visible:outline-hidden focus-visible:ring-2 focus-visible:ring-accent';

/** The "Language model" card: provider tabs, per-provider panels, model guide, test. */
export const LanguageModelSection: React.FC<LanguageModelSectionProps> = (p) => {
  const modelDescription = describeModel(p.selectedModel);

  return (
    <Card className="overflow-hidden">
      <CardHeader>
        <div className="flex flex-wrap items-center gap-3">
          <CardTitle>Language model</CardTitle>
          <Badge variant="neutral">Assistant · fallback categorization</Badge>
        </div>
      </CardHeader>
      <CardContent className="p-0">
        <p className="px-6 pt-1 text-sm leading-relaxed text-ink-soft">
          Writes the Assistant&apos;s answers from the figures MoneyMind computes. If no TypeSafe
          key is set, it also categorizes transactions; its answers are checked against your
          category list, but results are less consistent than Jev.
        </p>

        {/* Mode Selection Tabs — the strip scrolls horizontally on narrow
            viewports; the edge fades make off-screen tabs discoverable and
            focusing a tab always scrolls it into view (review N4). */}
        <div className="relative mt-4">
          <div
            role="tablist"
            aria-label="AI provider"
            className="flex border-b border-line overflow-x-auto"
          >
            {PROVIDER_TABS.map(({ mode, label, Icon }, index) => (
              <button
                key={mode}
                id={`settings-tab-${mode}`}
                role="tab"
                aria-selected={p.aiMode === mode}
                aria-controls={`settings-panel-${mode}`}
                tabIndex={p.aiMode === mode ? 0 : -1}
                onKeyDown={(e) => p.onTabKeyDown(e, index)}
                onFocus={(e) =>
                  e.currentTarget.scrollIntoView?.({ block: 'nearest', inline: 'nearest' })
                }
                onClick={() => p.onSelectMode(mode)}
                className={`min-h-11 flex-1 p-4 flex items-center justify-center gap-2 font-medium transition-colors whitespace-nowrap ${p.aiMode === mode ? 'bg-surface text-accent border-b-2 border-accent' : 'bg-surface-muted text-ink-soft hover:bg-line/50'}`}
              >
                <Icon className="w-4 h-4" />
                {label}
              </button>
            ))}
          </div>
          <div
            aria-hidden="true"
            data-testid="provider-tabs-fade-left"
            className="pointer-events-none absolute inset-y-0 left-0 w-8 bg-linear-to-r from-line/70 to-transparent"
          />
          <div
            aria-hidden="true"
            data-testid="provider-tabs-fade-right"
            className="pointer-events-none absolute inset-y-0 right-0 w-8 bg-linear-to-l from-line/70 to-transparent"
          />
        </div>

        <div className="p-6 space-y-6">
          {p.aiMode === 'cloud' && (
            <div
              id="settings-panel-cloud"
              role="tabpanel"
              aria-labelledby="settings-tab-cloud"
              className="space-y-4 animate-rise"
            >
              <p className="text-sm leading-relaxed text-ink-soft">
                Google&apos;s cloud models. Free API keys with rate limits are available from Google
                AI Studio (aistudio.google.com/apikey). Your question and a summary of your finances
                are sent to Google; on the free tier Google may use them to improve its products.
              </p>

              <div className="space-y-2">
                <label
                  htmlFor="gemini-api-key"
                  className="text-sm font-medium text-ink flex items-center gap-2"
                >
                  <Key className="w-4 h-4" /> API Key
                </label>
                <Input
                  id="gemini-api-key"
                  type="password"
                  placeholder="Enter your Gemini API Key"
                  value={p.geminiApiKey}
                  onChange={(e) => p.onGeminiApiKey(e.target.value)}
                  className="font-mono"
                />
                <p className="text-xs text-muted">
                  Your key is stored locally (obfuscated, not encrypted).
                </p>
              </div>
              <div className="space-y-2">
                <label
                  htmlFor="gemini-model"
                  className="text-sm font-medium text-ink flex items-center gap-2"
                >
                  <Server className="w-4 h-4" /> Model Selection
                </label>
                <select
                  id="gemini-model"
                  aria-busy={p.isLoadingCatalog}
                  className={MODEL_SELECT_CLASS}
                  value={p.geminiModel}
                  onChange={(e) => p.onGeminiModel(e.target.value)}
                >
                  {p.selectedModelMissing && (
                    <option value={p.selectedModel}>
                      {p.selectedModel} (saved — not in the current model list)
                    </option>
                  )}
                  {p.catalogModels.map((m) => (
                    <option key={m.id} value={m.id}>
                      {m.label}
                    </option>
                  ))}
                </select>
                {p.catalogStatus}
              </div>
            </div>
          )}

          {p.aiMode === 'groq' && (
            <div
              id="settings-panel-groq"
              role="tabpanel"
              aria-labelledby="settings-tab-groq"
              className="space-y-6 animate-rise"
            >
              <p className="text-sm leading-relaxed text-ink-soft">
                Very fast cloud inference for open models such as Llama and GPT-OSS. Free tier with
                rate limits (console.groq.com/keys). Your question and a summary of your finances
                are sent to Groq.
              </p>
              <div className="space-y-2">
                <label
                  htmlFor="groq-api-key"
                  className="text-sm font-medium text-ink flex items-center gap-2"
                >
                  <Key className="w-4 h-4" /> API Key
                </label>
                <Input
                  id="groq-api-key"
                  type="password"
                  placeholder="Enter your Groq API Key (gsk_...)"
                  value={p.groqApiKey}
                  onChange={(e) => p.onGroqApiKey(e.target.value)}
                  className="font-mono"
                />
              </div>

              <div className="space-y-2">
                <label
                  htmlFor="groq-model"
                  className="text-sm font-medium text-ink flex items-center gap-2"
                >
                  <Server className="w-4 h-4" /> Model Selection
                </label>
                <select
                  id="groq-model"
                  aria-busy={p.isLoadingCatalog}
                  className={MODEL_SELECT_CLASS}
                  value={p.groqModel}
                  onChange={(e) => p.onGroqModel(e.target.value)}
                >
                  {p.selectedModelMissing && (
                    <option value={p.selectedModel}>
                      {p.selectedModel} (saved — not in the current model list)
                    </option>
                  )}
                  {p.catalogModels.map((m) => (
                    <option key={m.id} value={m.id}>
                      {m.label}
                    </option>
                  ))}
                </select>
                {p.catalogStatus}
              </div>
            </div>
          )}

          {p.aiMode === 'local' && (
            <div
              id="settings-panel-local"
              role="tabpanel"
              aria-labelledby="settings-tab-local"
              className="space-y-6 animate-rise"
            >
              <p className="text-sm leading-relaxed text-ink-soft">
                Runs open models on your own computer — nothing leaves your machine. Install Ollama,
                pull a model (for example{' '}
                <code className="rounded bg-surface-muted px-1 py-0.5 text-xs">
                  ollama pull llama3.2
                </code>
                ), and start it with browser access allowed (commands below).
              </p>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="space-y-2">
                  <label htmlFor="ollama-base-url" className="text-sm font-medium text-ink">
                    Base URL
                  </label>
                  <Input
                    id="ollama-base-url"
                    placeholder="http://localhost"
                    value={p.ollamaBaseUrl}
                    onChange={(e) => p.onOllamaBaseUrl(e.target.value)}
                  />
                </div>
                <div className="space-y-2">
                  <label htmlFor="ollama-port" className="text-sm font-medium text-ink">
                    Port
                  </label>
                  <Input
                    id="ollama-port"
                    placeholder="11434"
                    value={p.ollamaPort}
                    onChange={(e) => p.onOllamaPort(e.target.value)}
                  />
                </div>
              </div>

              <div className="space-y-2">
                <label htmlFor="ollama-model" className="text-sm font-medium text-ink">
                  Specific Model Name
                </label>
                <Input
                  id="ollama-model"
                  placeholder="llama3.2"
                  value={p.ollamaModel}
                  onChange={(e) => p.onOllamaModel(e.target.value)}
                  list="ollama-models"
                />
                <datalist id="ollama-models">
                  {p.catalogModels.map((m) => (
                    <option key={m.id} value={m.id} />
                  ))}
                </datalist>
                <p className="text-xs text-muted">
                  Free text — models you have pulled locally appear as suggestions, but any model
                  name works.
                </p>
                {p.catalogStatus}
              </div>

              <div className="bg-surface-muted rounded-lg p-4 border border-line">
                <div className="flex items-start gap-3">
                  <Terminal className="w-5 h-5 text-muted mt-0.5" />
                  <div className="text-sm text-ink-soft space-y-2">
                    <p className="font-medium text-ink">Ollama Setup Commands:</p>
                    <p className="text-xs text-muted">Close Ollama from the taskbar first!</p>

                    <div className="bg-surface border border-line rounded p-2 text-xs font-mono">
                      <div className="text-muted mb-1 select-none"># Mac / Linux</div>
                      <div className="select-all">OLLAMA_ORIGINS=&quot;*&quot; ollama serve</div>
                    </div>

                    <div className="bg-surface border border-line rounded p-2 text-xs font-mono">
                      <div className="text-muted mb-1 select-none"># Windows (PowerShell)</div>
                      <div className="select-all">
                        $env:OLLAMA_ORIGINS=&quot;*&quot;; ollama serve
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          )}

          {p.aiMode === 'custom' && (
            <div
              id="settings-panel-custom"
              role="tabpanel"
              aria-labelledby="settings-tab-custom"
              className="space-y-6 animate-rise"
            >
              <p className="text-sm leading-relaxed text-ink-soft">
                Any server that speaks the OpenAI chat-completions API — LM Studio, vLLM, LocalAI,
                OpenRouter or your own proxy. The key is optional for servers without
                authentication; the server must allow browser (CORS) requests.
              </p>
              <div className="space-y-2">
                <label
                  htmlFor="custom-base-url"
                  className="text-sm font-medium text-ink flex items-center gap-2"
                >
                  <Globe className="w-4 h-4" /> Base URL
                </label>
                <Input
                  id="custom-base-url"
                  placeholder="https://api.example.com/v1"
                  value={p.customBaseUrl}
                  onChange={(e) => p.onCustomBaseUrl(e.target.value)}
                />
                <p className="text-xs text-muted">
                  Requests go to <code>{`{Base URL}/chat/completions`}</code>. Include the version
                  path if your server needs one (e.g. <code>/v1</code>).
                </p>
              </div>

              <div className="space-y-2">
                <label
                  htmlFor="custom-api-key"
                  className="text-sm font-medium text-ink flex items-center gap-2"
                >
                  <Key className="w-4 h-4" /> API Key
                </label>
                <Input
                  id="custom-api-key"
                  type="password"
                  placeholder="Enter your endpoint's API key"
                  value={p.customApiKey}
                  onChange={(e) => p.onCustomApiKey(e.target.value)}
                  className="font-mono"
                />
                <p className="text-xs text-muted">
                  Stored locally (obfuscated, not encrypted). Leave empty only if your server skips
                  authentication.
                </p>
              </div>

              <div className="space-y-2">
                <label htmlFor="custom-model" className="text-sm font-medium text-ink">
                  Model Name
                </label>
                <Input
                  id="custom-model"
                  placeholder="e.g. gpt-4o-mini, llama3.1, my-finetune"
                  value={p.customModel}
                  onChange={(e) => p.onCustomModel(e.target.value)}
                  list="custom-models"
                />
                <datalist id="custom-models">
                  {p.catalogModels.map((m) => (
                    <option key={m.id} value={m.id} />
                  ))}
                </datalist>
                <p className="text-xs text-muted">
                  Free text — models reported by your endpoint appear as suggestions, but any model
                  id works.
                </p>
                {p.catalogStatus}
              </div>
            </div>
          )}

          {/* Model guide */}
          <div className="rounded-xl border border-line bg-surface-muted p-4 space-y-3">
            <p className="text-[11px] font-medium uppercase tracking-[0.08em] text-muted">
              Choosing a model
            </p>
            <ul className="space-y-1.5 text-xs leading-relaxed text-ink-soft">
              <li>
                <strong className="text-ink">Fast &amp; low-cost</strong> (Flash-Lite, mini, 8B
                &quot;instant&quot;): quickest and cheapest; fine for categorization and short
                answers.
              </li>
              <li>
                <strong className="text-ink">Balanced</strong> (Flash, ~20–30B open models): good
                quality with low latency — a sensible default.
              </li>
              <li>
                <strong className="text-ink">Most capable</strong> (Pro, 70B+): strongest reasoning
                for detailed Assistant answers; slower and more expensive.
              </li>
              <li>
                <strong className="text-ink">Local models</strong>: prefer 8B parameters or more —
                very small models (1–3B) make more categorization mistakes.
              </li>
            </ul>
            {p.selectedModel !== '' && (
              <p className="border-t border-line pt-3 text-xs text-ink-soft">
                <span className="font-mono">{p.selectedModel}</span>
                {' · '}
                {modelDescription ? (
                  <>
                    <strong>{modelDescription.label}</strong> — {modelDescription.summary}{' '}
                    <span className="text-muted">(estimated from the model name)</span>
                  </>
                ) : (
                  <span>Tier unknown — check the provider&apos;s documentation.</span>
                )}
              </p>
            )}
          </div>

          {/* Test Connection Section with Enhanced Error Display */}
          <div className="pt-4 border-t border-line">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
              <ConnectionTestResult result={p.testResult} message={p.testMessage} />
              <Button
                onClick={p.onTest}
                isLoading={p.isTesting}
                className="shrink-0"
                variant={p.testResult === 'success' ? 'outline' : 'primary'}
              >
                {p.isTesting ? (
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
  );
};
