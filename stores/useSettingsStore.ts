
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

// Simple obfuscation to prevent plain-text read in local storage (not military grade encryption)
const encrypt = (text: string) => {
    try { return btoa(text); } catch(_e) { return text; }
};
const decrypt = (text: string) => {
    try { return atob(text); } catch(_e) { return text; }
};

// Detect Environment Keys for Gemini
export const getEnvGeminiApiKey = () => {
    try {
        // Safe check for browser environments where process might not be defined
        const env = (typeof process !== 'undefined' ? process.env : {}) as Record<string, string | undefined>;
        return env.GOOGLE_API_KEY || env.GEMINI_API_KEY || env.API_KEY || '';
    } catch {
        return '';
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
        apiKey: encrypt(getEnvGeminiApiKey()),
        model: 'models/gemini-flash-latest'
      },

      groqConfig: {
        apiKey: '',
        model: 'llama-3.1-8b-instant'
      },
      
      ollamaConfig: {
        baseUrl: 'http://localhost',
        port: '11434',
        model: 'llama3.2'
      },

      usage: {
          txAnalyzed: 0,
          chatMessages: 0,
          lastReset: new Date().toISOString()
      },

      setAiMode: (mode) => set({ aiMode: mode }),
      setDemoMode: (isDemo) => set({ isDemoMode: isDemo }),
      toggleApplyPatterns: () => set((state) => ({ applyPatterns: !state.applyPatterns })),
      toggleFunnyAlerts: () => set((state) => ({ enableFunnyAlerts: !state.enableFunnyAlerts })),
      
      setGeminiConfig: (config) => set((state) => {
          const newConfig = { ...state.geminiConfig, ...config };
          if (config.apiKey) {
              newConfig.apiKey = encrypt(config.apiKey);
          }
          return { geminiConfig: newConfig };
      }),

      setGroqConfig: (config) => set((state) => {
        const newConfig = { ...state.groqConfig, ...config };
        if (config.apiKey) {
            newConfig.apiKey = encrypt(config.apiKey);
        }
        return { groqConfig: newConfig };
      }),

      setOllamaConfig: (config) => set((state) => ({ 
          ollamaConfig: { ...state.ollamaConfig, ...config } 
      })),

      resetSettings: () => set({ 
          aiMode: 'cloud', 
          isDemoMode: false,
          applyPatterns: true,
          enableFunnyAlerts: true,
          geminiConfig: { apiKey: encrypt(getEnvGeminiApiKey()), model: 'models/gemini-flash-latest' },
          groqConfig: { apiKey: '', model: 'llama-3.1-8b-instant' },
          ollamaConfig: { baseUrl: 'http://localhost', port: '11434', model: 'llama3.2' },
          usage: { txAnalyzed: 0, chatMessages: 0, lastReset: new Date().toISOString() }
      }),

      checkUsageLimit: (type, amount = 1) => {
          const { usage, aiMode, geminiConfig } = get();
          
          // Unlimited for Local
          if (aiMode === 'local') return true; 

          // Check if Custom Key (Cloud) -> Unlimited
          if (aiMode === 'cloud') {
              const envKey = getEnvGeminiApiKey();
              const currentKey = decrypt(geminiConfig.apiKey);
              // If user has a key, and it's NOT the environment key, they are unlimited
              if (currentKey && currentKey !== envKey) {
                  return true;
              }
          }
          
          // Check if Groq Key present -> Unlimited
          if (aiMode === 'groq') {
               const key = decrypt(get().groqConfig.apiKey);
               if (key) return true;
          }

          // Otherwise, enforce limits (Demo/Env Key)
          if (type === 'analysis') {
              return (usage.txAnalyzed + amount) <= MAX_TX_ANALYSIS;
          }
          if (type === 'chat') {
              return (usage.chatMessages + amount) <= MAX_CHAT_MESSAGES;
          }
          return true;
      },

      incrementUsage: (type, amount = 1) => set((state) => {
          const newUsage = { ...state.usage };
          if (type === 'analysis') {
              newUsage.txAnalyzed += amount;
          } else {
              newUsage.chatMessages += amount;
          }
          return { usage: newUsage };
      })
    }),
    {
      name: 'moneymind-settings',
    }
  )
);

// Helper to get usable key based on active mode
export const getDecryptedApiKey = (storeState: SettingsState) => {
    if (storeState.aiMode === 'groq') {
        return decrypt(storeState.groqConfig.apiKey);
    }
    // Default to gemini for cloud mode
    return decrypt(storeState.geminiConfig.apiKey);
};
