
import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import { AppSettings, AIMode, GeminiConfig, OllamaConfig, GroqConfig } from '../types';

interface SettingsState extends AppSettings {
  setAiMode: (mode: AIMode) => void;
  toggleApplyPatterns: () => void;
  setGeminiConfig: (config: Partial<GeminiConfig>) => void;
  setGroqConfig: (config: Partial<GroqConfig>) => void;
  setOllamaConfig: (config: Partial<OllamaConfig>) => void;
  resetSettings: () => void;
}

// Simple obfuscation to prevent plain-text read in local storage (not military grade encryption)
const encrypt = (text: string) => {
    try { return btoa(text); } catch(e) { return text; }
};
const decrypt = (text: string) => {
    try { return atob(text); } catch(e) { return text; }
};

export const useSettingsStore = create<SettingsState>()(
  persist(
    (set) => ({
      aiMode: 'cloud',
      applyPatterns: true,
      
      geminiConfig: {
        apiKey: '',
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

      setAiMode: (mode) => set({ aiMode: mode }),
      toggleApplyPatterns: () => set((state) => ({ applyPatterns: !state.applyPatterns })),
      
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
          applyPatterns: true,
          geminiConfig: { apiKey: '', model: 'models/gemini-flash-latest' },
          groqConfig: { apiKey: '', model: 'llama-3.1-8b-instant' },
          ollamaConfig: { baseUrl: 'http://localhost', port: '11434', model: 'llama3.2' }
      }),
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
