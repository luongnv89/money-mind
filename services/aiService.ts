
import { Transaction, AIMode, TransactionCategory, AppSettings } from '../types';
import { useSettingsStore, getDecryptedApiKey } from '../stores/useSettingsStore';
import { GoogleGenAI } from "@google/genai";
import { CATEGORY_HIERARCHY } from '../constants';

interface CategorizationResult {
  id: string;
  category: TransactionCategory;
  subCategory?: string;
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
            Categorize these financial transactions into ONE of the following Categories and Subcategories.
            
            Hierarchy:
            ${JSON.stringify(CATEGORY_HIERARCHY, null, 2)}

            Definitions:
            - Income: Money in.
            - Internal Transfer: Transfers between own accounts, credit card payments.
            - Must-have: Essential living expenses (Rent, Groceries, Medical).
            - Nice-to-have: Quality of life (Dining, Entertainment, Shopping).
            - Waste: Unnecessary spending (Fees, Impulse buys).
            - Save: Money set aside.
            - Invest: Assets for growth.
            
            Instruction:
            Use 'cat' field (original bank category) as a strong hint if provided, but prioritize the description if it contradicts.

            Return JSON array: [{ "id": "...", "category": "...", "subCategory": "...", "confidence": 0.0-1.0, "reason": "..." }]
            Transactions:
            ${JSON.stringify(batch.map(t => ({ id: t.id, desc: t.description, amt: t.amount, cat: t.originalCategory })))}
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

    const hierarchyStr = JSON.stringify(CATEGORY_HIERARCHY);

    const promptBase = `Categorize the following transaction. Use this hierarchy: ${hierarchyStr}. 
    Use the provided 'Original Category' as a hint.
    Return ONLY JSON format: { "category": "...", "subCategory": "...", "confidence": 0.9, "reason": "..." }. 
    Transaction: `;
    
    // Process one by one or small batches for local AI
    for (const tx of transactions) {
        try {
            const response = await fetch(url, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    model: model,
                    prompt: `${promptBase} Description: ${tx.description}, Amount: ${tx.amount}, Original Category: ${tx.originalCategory || 'N/A'}`,
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
                subCategory: result.subCategory,
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
            const origCat = (t.originalCategory || '').toLowerCase();
            
            let cat = TransactionCategory.Uncategorized;
            let subCat = undefined;
            let reason = "Unsure";
            
            // Simple logic leveraging original category if useful
            if (origCat.includes('income') || origCat.includes('deposit')) {
                 cat = TransactionCategory.Income;
                 subCat = 'Other Income';
                 reason = "Based on bank category";
            }
            else if (t.amount > 0 && !desc.includes('refund')) {
                cat = TransactionCategory.Income;
                subCat = desc.includes('salary') ? 'Salary' : 'Other Income';
                reason = "Positive amount";
            } else if (desc.includes('payment') || desc.includes('transfer')) {
                cat = TransactionCategory.InternalTransfer;
                subCat = 'Credit Card Payment';
                reason = "Transfer detected";
            } else if (desc.includes('rent')) {
                cat = TransactionCategory.MustHave;
                subCat = 'Housing';
                reason = "Essential expense";
            } else if (desc.includes('safeway') || desc.includes('grocery')) {
                cat = TransactionCategory.MustHave;
                subCat = 'Food & Groceries';
                reason = "Groceries";
            } else if (desc.includes('starbucks')) {
                cat = TransactionCategory.NiceToHave;
                subCat = 'Dining Out';
                reason = "Coffee";
            } else if (desc.includes('netflix')) {
                cat = TransactionCategory.NiceToHave;
                subCat = 'Entertainment';
                reason = "Subscription";
            } else if (desc.includes('fee')) {
                cat = TransactionCategory.Waste;
                subCat = 'Late Fees & Penalties';
                reason = "Fee detected";
            } else if (desc.includes('savings')) {
                cat = TransactionCategory.Save;
                subCat = 'General Savings';
                reason = "Saving";
            } else {
                cat = TransactionCategory.NiceToHave;
                subCat = 'Shopping';
            }

            return {
                id: t.id,
                category: cat,
                subCategory: subCat,
                confidence: 0.85,
                reason
            };
        });

        if (onChunkProcessed) onChunkProcessed(results);
    }
};
