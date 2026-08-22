import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import { AppSettings, AIMode, GeminiConfig, OllamaConfig, GroqConfig } from '../types';

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
        model: 'models/gemini-flash-latest',
      },

      groqConfig: {
        apiKey: '',
        model: 'llama-3.1-8b-instant',
      },

      ollamaConfig: {
        baseUrl: 'http://localhost',
        port: '11434',
        model: 'llama3.2',
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
            model: 'models/gemini-flash-latest',
          },
          groqConfig: { apiKey: '', model: 'llama-3.1-8b-instant' },
          ollamaConfig: { baseUrl: 'http://localhost', port: '11434', model: 'llama3.2' },
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

// Helper to get usable key based on active mode
export const getDeobfuscatedApiKey = (storeState: SettingsState) => {
  if (storeState.aiMode === 'groq') {
    return deobfuscate(storeState.groqConfig.apiKey);
  }
  // Default to gemini for cloud mode
  return deobfuscate(storeState.geminiConfig.apiKey);
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
