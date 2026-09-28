import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import {
  AppSettings,
  AIMode,
  GeminiConfig,
  OllamaConfig,
  GroqConfig,
  CustomOpenAIConfig,
  TypeSafeConfig,
} from '../types';
import { DEFAULT_MODELS } from '../constants';

interface SettingsState extends AppSettings {
  setAiMode: (mode: AIMode) => void;
  setDemoMode: (isDemo: boolean) => void;
  toggleApplyPatterns: () => void;
  toggleSpendingAlerts: () => void;
  setCurrency: (currency: string) => void;
  setGeminiConfig: (config: Partial<GeminiConfig>) => void;
  setGroqConfig: (config: Partial<GroqConfig>) => void;
  setOllamaConfig: (config: Partial<OllamaConfig>) => void;
  setCustomConfig: (config: Partial<CustomOpenAIConfig>) => void;
  setTypesafeConfig: (config: Partial<TypeSafeConfig>) => void;
  resetSettings: () => void;
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

const defaultSettings = (): AppSettings => ({
  aiMode: 'cloud',
  isDemoMode: false,
  applyPatterns: true,
  enableSpendingAlerts: true,
  currency: 'USD',
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
  customConfig: {
    baseUrl: '',
    apiKey: '',
    model: DEFAULT_MODELS.custom,
  },
  typesafeConfig: {
    apiKey: '',
  },
});

/** Shape stored by version 0 of this persist entry (pre-rename/pre-currency). */
interface PersistedSettingsV0 {
  enableFunnyAlerts?: boolean;
  usage?: unknown;
  [key: string]: unknown;
}

export const useSettingsStore = create<SettingsState>()(
  persist(
    (set) => ({
      ...defaultSettings(),

      setAiMode: (mode) => set({ aiMode: mode }),
      setDemoMode: (isDemo) => set({ isDemoMode: isDemo }),
      toggleApplyPatterns: () => set((state) => ({ applyPatterns: !state.applyPatterns })),
      toggleSpendingAlerts: () =>
        set((state) => ({ enableSpendingAlerts: !state.enableSpendingAlerts })),
      setCurrency: (currency) => set({ currency }),

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

      setCustomConfig: (config) =>
        set((state) => {
          const newConfig = { ...state.customConfig, ...config };
          if (config.apiKey) {
            newConfig.apiKey = obfuscate(config.apiKey);
          }
          return { customConfig: newConfig };
        }),

      setTypesafeConfig: (config) =>
        set((state) => {
          const newConfig = { ...state.typesafeConfig, ...config };
          if (config.apiKey) {
            newConfig.apiKey = obfuscate(config.apiKey);
          }
          return { typesafeConfig: newConfig };
        }),

      resetSettings: () => set(defaultSettings()),
    }),
    {
      name: 'moneymind-settings',
      version: 1,
      migrate: (persisted, version) => {
        const state = persisted as PersistedSettingsV0 | undefined;
        if (!state || version !== 0) return state as Partial<SettingsState>;
        const { usage: _usage, enableFunnyAlerts, ...rest } = state;
        return {
          ...rest,
          enableSpendingAlerts: enableFunnyAlerts ?? true,
          currency: typeof state.currency === 'string' ? state.currency : 'USD',
        } as Partial<SettingsState>;
      },
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
  provider: 'cloud' | 'groq' | 'custom'
): string =>
  deobfuscate(
    provider === 'groq'
      ? storeState.groqConfig.apiKey
      : provider === 'custom'
        ? storeState.customConfig.apiKey
        : storeState.geminiConfig.apiKey
  );

// Helper to get usable key based on active mode
export const getDeobfuscatedApiKey = (storeState: SettingsState) => {
  if (storeState.aiMode === 'groq') {
    return getDeobfuscatedProviderKey(storeState, 'groq');
  }
  if (storeState.aiMode === 'custom') {
    return getDeobfuscatedProviderKey(storeState, 'custom');
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
 * Groq key. Every consumer — Layout, AssistantChat, the Overview — reads
 * this selector instead of re-deriving its own.
 */
export const selectAIReady = (state: SettingsState): boolean => {
  if (state.aiMode === 'local') return true;
  if (state.aiMode === 'groq') return !!deobfuscate(state.groqConfig.apiKey);
  if (state.aiMode === 'custom')
    // The API key is optional for custom endpoints — base URL + model suffice.
    return !!state.customConfig.baseUrl.trim() && !!state.customConfig.model.trim();
  return !!deobfuscate(state.geminiConfig.apiKey);
};

/** React binding for `selectAIReady`. */
export const useAIReady = (): boolean => useSettingsStore(selectAIReady);

export const getTypesafeApiKey = (state: Pick<AppSettings, 'typesafeConfig'>): string =>
  deobfuscate(state.typesafeConfig.apiKey);

export const selectCategorizationReady = (state: SettingsState): boolean =>
  !!getTypesafeApiKey(state) || selectAIReady(state);

/** React binding for `selectCategorizationReady`. */
export const useCategorizationReady = (): boolean => useSettingsStore(selectCategorizationReady);
