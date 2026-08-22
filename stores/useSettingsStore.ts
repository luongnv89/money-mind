import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import { AppSettings, AIMode, GeminiConfig, OllamaConfig, GroqConfig } from '../types';
import { DEFAULT_MODELS } from '../constants';

interface SettingsState extends AppSettings {
  setAiMode: (mode: AIMode) => void;
  setDemoMode: (isDemo: boolean) => void;
  toggleApplyPatterns: () => void;
  toggleFunnyAlerts: () => void;
  setGeminiConfig: (config: Partial<GeminiConfig>) => void;
  setGroqConfig: (config: Partial<GroqConfig>) => void;
  setOllamaConfig: (config: Partial<OllamaConfig>) => void;
  resetSettings: () => void;

  // Usage Control
  checkUsageLimit: (type: 'analysis' | 'chat', amount?: number) => boolean;
  incrementUsage: (type: 'analysis' | 'chat', amount?: number) => void;
}

// Simple base64 obfuscation to prevent plain-text read in local storage (not encryption)
const obfuscate = (text: string) => {
  try {
    return btoa(text);
  } catch (_e) {
    return text;
  }
};
const deobfuscate = (text: string) => {
  try {
    return atob(text);
  } catch (_e) {
    return text;
  }
};

// Hard limits as per requirement
const MAX_TX_ANALYSIS = 150;
const MAX_CHAT_MESSAGES = 10;

export const useSettingsStore = create<SettingsState>()(
  persist(
    (set, get) => ({
      aiMode: 'cloud',
      isDemoMode: false,
      applyPatterns: true,
      enableFunnyAlerts: true, // Default to true

      geminiConfig: {
        apiKey: '',
        model: DEFAULT_MODELS.cloud,
      },

      groqConfig: {
        apiKey: '',
        model: DEFAULT_MODELS.groq,
      },

      ollamaConfig: {
        baseUrl: 'http://localhost',
        port: '11434',
        model: DEFAULT_MODELS.local,
      },

      usage: {
        txAnalyzed: 0,
        chatMessages: 0,
        lastReset: new Date().toISOString(),
      },

      setAiMode: (mode) => set({ aiMode: mode }),
      setDemoMode: (isDemo) => set({ isDemoMode: isDemo }),
      toggleApplyPatterns: () => set((state) => ({ applyPatterns: !state.applyPatterns })),
      toggleFunnyAlerts: () => set((state) => ({ enableFunnyAlerts: !state.enableFunnyAlerts })),

      setGeminiConfig: (config) =>
        set((state) => {
          const newConfig = { ...state.geminiConfig, ...config };
          if (config.apiKey) {
            newConfig.apiKey = obfuscate(config.apiKey);
          }
          return { geminiConfig: newConfig };
        }),

      setGroqConfig: (config) =>
        set((state) => {
          const newConfig = { ...state.groqConfig, ...config };
          if (config.apiKey) {
            newConfig.apiKey = obfuscate(config.apiKey);
          }
          return { groqConfig: newConfig };
        }),

      setOllamaConfig: (config) =>
        set((state) => ({
          ollamaConfig: { ...state.ollamaConfig, ...config },
        })),

      resetSettings: () =>
        set({
          aiMode: 'cloud',
          isDemoMode: false,
          applyPatterns: true,
          enableFunnyAlerts: true,
          geminiConfig: {
            apiKey: '',
            model: DEFAULT_MODELS.cloud,
          },
          groqConfig: { apiKey: '', model: DEFAULT_MODELS.groq },
          ollamaConfig: { baseUrl: 'http://localhost', port: '11434', model: DEFAULT_MODELS.local },
          usage: { txAnalyzed: 0, chatMessages: 0, lastReset: new Date().toISOString() },
        }),

      checkUsageLimit: (type, amount = 1) => {
        const { usage, aiMode, geminiConfig } = get();

        // Unlimited for Local
        if (aiMode === 'local') return true;

        // Check if Custom Key (Cloud) -> Unlimited
        if (aiMode === 'cloud') {
          const currentKey = deobfuscate(geminiConfig.apiKey);
          if (currentKey) {
            return true;
          }
        }

        // Check if Groq Key present -> Unlimited
        if (aiMode === 'groq') {
          const key = deobfuscate(get().groqConfig.apiKey);
          if (key) return true;
        }

        // Otherwise, enforce limits (no key supplied)
        if (type === 'analysis') {
          return usage.txAnalyzed + amount <= MAX_TX_ANALYSIS;
        }
        if (type === 'chat') {
          return usage.chatMessages + amount <= MAX_CHAT_MESSAGES;
        }
        return true;
      },

      incrementUsage: (type, amount = 1) =>
        set((state) => {
          const newUsage = { ...state.usage };
          if (type === 'analysis') {
            newUsage.txAnalyzed += amount;
          } else {
            newUsage.chatMessages += amount;
          }
          return { usage: newUsage };
        }),
    }),
    {
      name: 'moneymind-settings',
    }
  )
);

/**
 * The provider-specific counterpart of `getDeobfuscatedApiKey`: reads the key
 * for an explicit provider instead of the active mode (issue #79 — the model
 * catalog loads for the tab being viewed, not necessarily the active mode).
 */
export const getDeobfuscatedProviderKey = (
  storeState: SettingsState,
  provider: 'cloud' | 'groq'
): string =>
  deobfuscate(provider === 'groq' ? storeState.groqConfig.apiKey : storeState.geminiConfig.apiKey);

// Helper to get usable key based on active mode
export const getDeobfuscatedApiKey = (storeState: SettingsState) => {
  if (storeState.aiMode === 'groq') {
    return getDeobfuscatedProviderKey(storeState, 'groq');
  }
  // Default to gemini for cloud mode
  return getDeobfuscatedProviderKey(storeState, 'cloud');
};

/** Outcome of validating a persisted model against a provider catalog (#79). */
export interface ModelValidationOutcome {
  reset: boolean;
  from: string;
  to: string;
}

/**
 * Issue #79 (AC5): a persisted model can outlive its provider (renamed or
 * retired). When the *live* catalog says the saved model no longer exists,
 * switch to the provider default — or the first available model if even the
 * default is gone — so categorization keeps working. Ollama stays free-text
 * and is deliberately never validated or clobbered here.
 */
export const validatePersistedModel = (
  provider: 'cloud' | 'groq',
  availableModelIds: string[]
): ModelValidationOutcome => {
  const state = useSettingsStore.getState();
  const current = provider === 'cloud' ? state.geminiConfig.model : state.groqConfig.model;

  if (current === '' || availableModelIds.includes(current)) {
    return { reset: false, from: current, to: current };
  }

  const target = availableModelIds.includes(DEFAULT_MODELS[provider])
    ? DEFAULT_MODELS[provider]
    : availableModelIds[0];
  if (!target || target === current) {
    return { reset: false, from: current, to: current };
  }

  if (provider === 'cloud') {
    state.setGeminiConfig({ model: target });
  } else {
    state.setGroqConfig({ model: target });
  }
  return { reset: true, from: current, to: target };
};

/**
 * The single definition of "an AI backend is ready" (F-UX-007): local mode is
 * always ready; cloud needs the stored Gemini key and groq needs the stored
 * Groq key. Every consumer — Layout, MonkeySmileChat, the Dashboard — reads
 * this selector instead of re-deriving its own.
 */
export const selectAIReady = (state: SettingsState): boolean => {
  if (state.aiMode === 'local') return true;
  if (state.aiMode === 'groq') return !!deobfuscate(state.groqConfig.apiKey);
  return !!deobfuscate(state.geminiConfig.apiKey);
};

/** React binding for `selectAIReady`. */
export const useAIReady = (): boolean => useSettingsStore(selectAIReady);
