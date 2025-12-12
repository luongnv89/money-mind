import { Transaction, AIMode, TransactionCategory, AppSettings } from '../types';
import { useSettingsStore, getDecryptedApiKey } from '../stores/useSettingsStore';
import { GoogleGenAI } from "@google/genai";

interface CategorizationResult {
  id: string;
  category: TransactionCategory;
  confidence: number;
  reason: string;
}

// --- Connection Testing ---

export const testAiConnection = async (): Promise<boolean> => {
    const settings = useSettingsStore.getState();
    
    if (settings.aiMode === 'cloud') {
        const apiKey = getDecryptedApiKey(settings);
        if (!apiKey) throw new Error("Missing API Key");
        
        try {
            const ai = new GoogleGenAI({ apiKey });
            const response = await ai.models.generateContent({
                model: settings.geminiConfig.model,
                contents: "Hello, reply with 'OK'.",
            });
            return !!response.text;
        } catch (e: any) {
            throw new Error(`Gemini Error: ${e.message}`);
        }
    } else {
        const { baseUrl, port, model } = settings.ollamaConfig;
        const url = `${baseUrl}:${port}/api/generate`;
        
        try {
            const response = await fetch(url, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    model: model,
                    prompt: "Reply with OK",
                    stream: false
                })
            });
            if (!response.ok) throw new Error("Ollama connection refused");
            return true;
        } catch (e: any) {
            throw new Error(`Local AI Error: ${e.message}. Is Ollama running?`);
        }
    }
};

// --- Main Categorization Service ---

export const categorizeWithAI = async (
  transactions: Transaction[],
  mode: AIMode,
  onChunkProcessed?: (results: CategorizationResult[]) => void
): Promise<void> => {
  
  // Filter out already categorized/learned transactions to save tokens/time
  const toProcess = transactions.filter(t => t.category === TransactionCategory.Uncategorized);
  if (toProcess.length === 0) return;

  if (mode === 'cloud') {
    await categorizeWithGemini(toProcess, onChunkProcessed);
  } else {
    await categorizeWithOllama(toProcess, onChunkProcessed);
  }
};

const categorizeWithGemini = async (
    transactions: Transaction[],
    onChunkProcessed?: (results: CategorizationResult[]) => void
): Promise<void> => {
    const settings = useSettingsStore.getState();
    const apiKey = getDecryptedApiKey(settings);
    const model = settings.geminiConfig.model;

    if (!apiKey) {
        console.warn("No API key provided, using simulation.");
        await simulateCategorization(transactions, onChunkProcessed);
        return;
    }

    const ai = new GoogleGenAI({ apiKey });
    
    // Process in batches of 10 to allow UI updates while being rate-limit friendly
    const BATCH_SIZE = 10;
    
    for (let i = 0; i < transactions.length; i += BATCH_SIZE) {
        const batch = transactions.slice(i, i + BATCH_SIZE);
        
        const prompt = `
            Categorize these financial transactions into ONE of: Essential, Growth, Joy, Drift.
            Return JSON array: [{ "id": "...", "category": "...", "confidence": 0.0-1.0, "reason": "..." }]
            Transactions:
            ${JSON.stringify(batch.map(t => ({ id: t.id, desc: t.description, amt: t.amount })))}
        `;

        try {
            const response = await ai.models.generateContent({
                model: model,
                contents: prompt,
                config: { responseMimeType: "application/json" }
            });
            
            const text = response.text;
            if (text) {
                const results: CategorizationResult[] = JSON.parse(text);
                if (onChunkProcessed) onChunkProcessed(results);
            }
        } catch (e) {
            console.error("Gemini Batch Failed", e);
            // Continue to next batch instead of failing everything
        }
        
        // Small delay to be nice to rate limits
        await new Promise(r => setTimeout(r, 200));
    }
};

const categorizeWithOllama = async (
    transactions: Transaction[],
    onChunkProcessed?: (results: CategorizationResult[]) => void
): Promise<void> => {
    const settings = useSettingsStore.getState();
    const { baseUrl, port, model } = settings.ollamaConfig;
    const url = `${baseUrl}:${port}/api/generate`;

    const promptBase = `Categorize the following transaction description into one of [Essential, Growth, Joy, Drift]. Return ONLY JSON format: { "category": "...", "confidence": 0.9, "reason": "..." }. Transaction: `;
    
    // Process one by one or small batches for local AI
    // We'll do 1 by 1 for Ollama to prevent OOM/timeouts on local machines, 
    // but update UI immediately.
    
    for (const tx of transactions) {
        try {
            const response = await fetch(url, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    model: model,
                    prompt: promptBase + tx.description,
                    stream: false,
                    format: "json"
                })
            });
            
            if(!response.ok) throw new Error("Ollama connection failed");
            
            const data = await response.json();
            const result = JSON.parse(data.response);
            
            const processedResult: CategorizationResult = {
                id: tx.id,
                category: result.category || TransactionCategory.Uncategorized,
                confidence: result.confidence || 0.5,
                reason: result.reason || "Local AI"
            };

            if (onChunkProcessed) onChunkProcessed([processedResult]);

        } catch (e) {
            console.error(e);
            // Skip failing item
        }
    }
};

// Simulation for preview environments without backend/key
const simulateCategorization = async (
    transactions: Transaction[],
    onChunkProcessed?: (results: CategorizationResult[]) => void
): Promise<void> => {
    const BATCH_SIZE = 5;
    
    for (let i = 0; i < transactions.length; i += BATCH_SIZE) {
        const batch = transactions.slice(i, i + BATCH_SIZE);
        
        await new Promise(resolve => setTimeout(resolve, 800)); // Fake network delay

        const results = batch.map(t => {
            const desc = t.description.toLowerCase();
            let cat = TransactionCategory.Drift;
            let reason = "Unsure";
            
            if (desc.includes('rent') || desc.includes('market') || desc.includes('safeway') || desc.includes('leroy') || desc.includes('ikea')) {
                cat = TransactionCategory.Essential;
                reason = "Living expense";
            } else if (desc.includes('gym') || desc.includes('book') || desc.includes('course')) {
                cat = TransactionCategory.Growth;
                reason = "Self improvement";
            } else if (desc.includes('restaurant') || desc.includes('cinema') || desc.includes('netflix')) {
                cat = TransactionCategory.Joy;
                reason = "Entertainment";
            }

            return {
                id: t.id,
                category: cat,
                confidence: 0.85,
                reason
            };
        });

        if (onChunkProcessed) onChunkProcessed(results);
    }
};