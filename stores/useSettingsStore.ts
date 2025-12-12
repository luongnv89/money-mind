import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import { AppSettings, AIMode, GeminiConfig, OllamaConfig } from '../types';

interface SettingsState extends AppSettings {
  setAiMode: (mode: AIMode) => void;
  toggleApplyPatterns: () => void;
  setGeminiConfig: (config: Partial<GeminiConfig>) => void;
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
      
      ollamaConfig: {
        baseUrl: 'http://localhost',
        port: '11434',
        model: 'llama3.2'
      },

      setAiMode: (mode) => set({ aiMode: mode }),
      toggleApplyPatterns: () => set((state) => ({ applyPatterns: !state.applyPatterns })),
      
      setGeminiConfig: (config) => set((state) => {
          const newConfig = { ...state.geminiConfig, ...config };
          // If a new key is provided, encrypt it. If it's the same (or coming from UI as masked), handle carefully.
          // For simplicity in this demo store, we assume the UI passes the raw key and we save it encrypted.
          if (config.apiKey) {
              newConfig.apiKey = encrypt(config.apiKey);
          }
          return { geminiConfig: newConfig };
      }),

      setOllamaConfig: (config) => set((state) => ({ 
          ollamaConfig: { ...state.ollamaConfig, ...config } 
      })),

      resetSettings: () => set({ 
          aiMode: 'cloud', 
          applyPatterns: true,
          geminiConfig: { apiKey: '', model: 'models/gemini-flash-latest' },
          ollamaConfig: { baseUrl: 'http://localhost', port: '11434', model: 'llama3.2' }
      }),
    }),
    {
      name: 'moneymind-settings',
    }
  )
);

// Helper to get usable key
export const getDecryptedApiKey = (storeState: SettingsState) => {
    return decrypt(storeState.geminiConfig.apiKey);
};