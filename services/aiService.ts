import { Transaction, AIMode, TransactionCategory } from '../types';
import { useSettingsStore, getDeobfuscatedApiKey } from '../stores/useSettingsStore';
import { GoogleGenAI, Type } from '@google/genai';
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
  const mode = settings.aiMode;

  if (mode === 'cloud') {
    const apiKey = getDeobfuscatedApiKey(settings);
    if (!apiKey)
      throw new Error(
        'No API Key set. Configure a Gemini API key in Settings to test the connection.'
      );

    try {
      const ai = new GoogleGenAI({ apiKey });
      const response = await ai.models.generateContent({
        model: settings.geminiConfig.model,
        contents: "Hello, reply with 'OK'.",
      });
      return !!response.text;
    } catch (e: unknown) {
      throw new Error(`Gemini Error: ${e instanceof Error ? e.message : String(e)}`);
    }
  } else if (mode === 'groq') {
    const apiKey = getDeobfuscatedApiKey(settings);
    if (!apiKey) throw new Error('Missing Groq API Key');

    try {
      const response = await fetch('https://api.groq.com/openai/v1/chat/completions', {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${apiKey}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          model: settings.groqConfig.model,
          messages: [{ role: 'user', content: 'Reply with JSON: { "status": "OK" }' }],
          response_format: { type: 'json_object' },
        }),
      });

      if (!response.ok) {
        const err = await response.json();
        throw new Error(err.error?.message || 'Groq connection failed');
      }
      return true;
    } catch (e: unknown) {
      throw new Error(`Groq Error: ${e instanceof Error ? e.message : String(e)}`);
    }
  } else {
    const { baseUrl, port, model } = settings.ollamaConfig;
    // Ensure protocol is present
    const safeBaseUrl = baseUrl.startsWith('http') ? baseUrl : `http://${baseUrl}`;
    const url = `${safeBaseUrl}:${port}/api/generate`;

    try {
      const response = await fetch(url, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          model: model,
          prompt: 'Reply with OK',
          stream: false,
        }),
      });
      if (!response.ok) throw new Error('Ollama connection refused');
      return true;
    } catch (e: unknown) {
      // Specific handling for CORS/Network errors typical with local LLMs in browser
      const errorMessage = e instanceof Error ? e.message : String(e);
      if (errorMessage === 'Failed to fetch' || (e instanceof Error && e.name === 'TypeError')) {
        throw new Error(
          'Connection Failed. \n\n' +
            '1. QUIT the Ollama app from your taskbar/menu bar.\n' +
            '2. Run this command in your terminal:\n\n' +
            '   Mac/Linux:\n   OLLAMA_ORIGINS="*" ollama serve\n\n' +
            '   Windows (PowerShell):\n   $env:OLLAMA_ORIGINS="*"; ollama serve'
        );
      }
      throw new Error(`Local AI Error: ${errorMessage}. Is Ollama running?`);
    }
  }
};

// --- Chat Service (MonkeySmile) ---

export const chatWithFinancialAgent = async (
  userQuery: string,
  financialContext: string
): Promise<string> => {
  const settings = useSettingsStore.getState();

  // Usage Check
  if (!settings.checkUsageLimit('chat')) {
    throw new Error(
      'Budget Exceeded: You have reached the limit of 10 messages. Add your own API key in Settings for unlimited usage.'
    );
  }

  const apiKey = getDeobfuscatedApiKey(settings);

  // System prompt defines the persona
  const systemPrompt = `You are MonkeySmile 🐵, a sassy, fun, and brutally honest financial buddy.
    You have access to the user's current financial snapshot below.

    FINANCIAL DATA CONTEXT:
    ${financialContext}

    INSTRUCTIONS:
    1. Be concise and conversational.
    2. Use emojis (especially 🐵, 🍌, 💸).
    3. Use the provided financial context to answer accurately.
    4. If the user asks "Can I afford X?", check their 'Net' or 'Nice-to-Have' spending.
    5. If 'Waste' spending is high, gently roast them.
    6. If they are doing well (high savings, positive net), cheer them on!
    7. Never make up numbers. If the data isn't in the context, say "I don't see that in your records."`;

  let resultText = '';

  if (settings.aiMode === 'cloud') {
    // Require a valid API key — no server fallback
    if (!apiKey)
      throw new Error(
        'No API Key set. Configure a Gemini API key in Settings to chat with MonkeySmile.'
      );
    const ai = new GoogleGenAI({ apiKey });
    const response = await ai.models.generateContent({
      model: settings.geminiConfig.model,
      contents: [
        { role: 'user', parts: [{ text: systemPrompt + '\n\nUser Question: ' + userQuery }] },
      ],
    });
    resultText = response.text || "I'm speechless 🐵 (No response from AI)";
  } else if (settings.aiMode === 'groq') {
    if (!apiKey) throw new Error('Missing API Key');
    const response = await fetch('https://api.groq.com/openai/v1/chat/completions', {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${apiKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        model: settings.groqConfig.model,
        messages: [
          { role: 'system', content: systemPrompt },
          { role: 'user', content: userQuery },
        ],
      }),
    });

    if (!response.ok) {
      const err = await response.json();
      throw new Error(err.error?.message || 'Groq API Error');
    }

    const data = await response.json();
    resultText = data.choices?.[0]?.message?.content || 'Groq is silent 🐵';
  } else {
    // Ollama
    const { baseUrl, port, model } = settings.ollamaConfig;
    const safeBaseUrl = baseUrl.startsWith('http') ? baseUrl : `http://${baseUrl}`;
    const url = `${safeBaseUrl}:${port}/api/generate`;

    const response = await fetch(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        model: model,
        prompt: `${systemPrompt}\n\nUser Question: ${userQuery}`,
        stream: false,
      }),
    });

    if (!response.ok) throw new Error('Ollama connection failed');

    const data = await response.json();
    resultText = data.response || 'Thinking... 🐵';
  }

  // Increment Usage if successful
  settings.incrementUsage('chat');
  return resultText;
};

// --- Main Categorization Service ---

export const categorizeWithAI = async (
  transactions: Transaction[],
  mode: AIMode,
  onChunkProcessed?: (results: CategorizationResult[]) => void
): Promise<void> => {
  const settings = useSettingsStore.getState();

  // Usage Check
  if (!settings.checkUsageLimit('analysis', transactions.length)) {
    throw new Error(
      `Budget Exceeded: Analyzing ${transactions.length} transactions would exceed your limit of 150. Add your own API key in Settings for unlimited usage.`
    );
  }

  // Demo Mode Interception
  if (settings.isDemoMode) {
    await simulateCategorization(transactions, onChunkProcessed);
    // Demo mode doesn't consume budget in this simulation implementation,
    // but conceptually you might want it to.
    // For now, we skip decrement for pure simulation to be friendly.
    return;
  }

  // We process whatever is passed in. The caller is responsible for filtering (e.g. only Uncategorized, or Unapproved).
  const toProcess = transactions;
  if (toProcess.length === 0) return;

  if (mode === 'cloud') {
    await categorizeWithGemini(toProcess, onChunkProcessed);
  } else if (mode === 'groq') {
    await categorizeWithGroq(toProcess, onChunkProcessed);
  } else {
    await categorizeWithOllama(toProcess, onChunkProcessed);
  }

  // Increment Usage after attempting processing
  // Note: In a robust system we'd count actual successes, but for budget control counting attempts is safer.
  settings.incrementUsage('analysis', transactions.length);
};

const categorizeWithGemini = async (
  transactions: Transaction[],
  onChunkProcessed?: (results: CategorizationResult[]) => void
): Promise<void> => {
  const settings = useSettingsStore.getState();
  const apiKey = getDeobfuscatedApiKey(settings);
  const model = settings.geminiConfig.model;

  if (!apiKey) {
    console.warn('No API key provided, using simulation.');
    await simulateCategorization(transactions, onChunkProcessed);
    return;
  }

  const ai = new GoogleGenAI({ apiKey });

  // OPTIMIZATION: High batch size, low frequency.
  const BATCH_SIZE = 25;

  for (let i = 0; i < transactions.length; i += BATCH_SIZE) {
    const batch = transactions.slice(i, i + BATCH_SIZE);

    const prompt = `
            You are a financial analyst. Categorize these transactions based on the provided hierarchy.

            Hierarchy:
            ${JSON.stringify(CATEGORY_HIERARCHY)}

            Transactions:
            ${JSON.stringify(batch.map((t) => ({ id: t.id, desc: t.description, amt: t.amount, cat: t.originalCategory })))}

            Instructions:
            1. Select the most appropriate Category and Subcategory.
            2. Use the 'cat' field (original bank category) as a hint if available.
            3. Return a valid JSON array matching the schema.
        `;

    try {
      const response = await ai.models.generateContent({
        model: model,
        contents: prompt,
        config: {
          responseMimeType: 'application/json',
          responseSchema: {
            type: Type.ARRAY,
            items: {
              type: Type.OBJECT,
              properties: {
                id: { type: Type.STRING },
                category: { type: Type.STRING },
                subCategory: { type: Type.STRING },
                confidence: { type: Type.NUMBER },
                reason: { type: Type.STRING },
              },
              required: ['id', 'category', 'confidence', 'reason'],
            },
          },
        },
      });

      const text = response.text;
      if (text) {
        const results: CategorizationResult[] = JSON.parse(text);
        if (onChunkProcessed) onChunkProcessed(results);
      }
    } catch (e: unknown) {
      console.error('Gemini Batch Failed', e);
      const errorMessage = e instanceof Error ? e.message : String(e);
      const status = (e as { status?: number }).status;
      if (status === 429 || errorMessage?.includes('429')) {
        throw new Error('Gemini Rate Limit Exceeded (429). Please try again in 1 minute.');
      }

      // Fallback for failed batch so the UI knows they failed
      const fallbackResults = batch.map((t) => ({
        id: t.id,
        category: TransactionCategory.Uncategorized,
        confidence: 0,
        reason: 'AI Request Failed: ' + errorMessage,
      }));
      if (onChunkProcessed) onChunkProcessed(fallbackResults);
    }

    await new Promise((r) => setTimeout(r, 4000));
  }
};

const categorizeWithGroq = async (
  transactions: Transaction[],
  onChunkProcessed?: (results: CategorizationResult[]) => void
): Promise<void> => {
  const settings = useSettingsStore.getState();
  const apiKey = getDeobfuscatedApiKey(settings);
  const model = settings.groqConfig.model;
  const hierarchyStr = JSON.stringify(CATEGORY_HIERARCHY);

  // Groq creates fast inference, but we still batch to reduce network round trips and stay within TPM/RPM.
  const BATCH_SIZE = 10;

  for (let i = 0; i < transactions.length; i += BATCH_SIZE) {
    const batch = transactions.slice(i, i + BATCH_SIZE);
    const batchStr = JSON.stringify(
      batch.map((t) => ({
        id: t.id,
        desc: t.description,
        amt: t.amount,
        original: t.originalCategory,
      }))
    );

    // Strictly enforce JSON structure in the prompt to avoid "Failed to generate JSON" errors from Groq
    const systemPrompt = `
        You are a strict JSON API for financial categorization.

        Hierarchy: ${hierarchyStr}

        Output **only** valid JSON.
        The JSON must be an object with a single key "results" containing an array.
        Each item in the array must match this schema:
        {
            "id": "string (original id)",
            "category": "string (from hierarchy keys)",
            "subCategory": "string (from hierarchy values)",
            "confidence": number (0.0 to 1.0),
            "reason": "string (short explanation)"
        }

        Do not add any markdown formatting (like \`\`\`json). Do not add explanations outside the JSON.
        `;

    try {
      const response = await fetch('https://api.groq.com/openai/v1/chat/completions', {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${apiKey}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          model: model,
          messages: [
            { role: 'system', content: systemPrompt },
            {
              role: 'user',
              content: `Categorize these transactions. Return valid JSON only. Transactions: ${batchStr}`,
            },
          ],
          response_format: { type: 'json_object' },
          temperature: 0, // Deterministic output helps with strict JSON
        }),
      });

      if (!response.ok) {
        if (response.status === 429) {
          throw new Error('Groq Rate Limit Exceeded. Please check your plan.');
        }
        const err = await response.json();
        throw new Error(err.error?.message || 'Groq API Error');
      }

      const data = await response.json();
      const content = data.choices[0]?.message?.content;

      if (content) {
        let parsed;
        try {
          parsed = JSON.parse(content);

          // Handle wrapping logic
          if (parsed.results && Array.isArray(parsed.results)) {
            parsed = parsed.results;
          } else if (!Array.isArray(parsed)) {
            // Attempt to find the first array value in the object
            const values = Object.values(parsed);
            const arrayValue = values.find((v) => Array.isArray(v));
            if (arrayValue) {
              parsed = arrayValue;
            }
          }
        } catch (_e) {
          console.error('Failed to parse Groq JSON', content);
        }

        if (Array.isArray(parsed)) {
          // Normalize fields
          const results: CategorizationResult[] = parsed.map(
            (item: {
              id: string;
              category?: TransactionCategory;
              subCategory?: string;
              confidence?: number;
              reason?: string;
            }) => ({
              id: item.id,
              category: item.category || TransactionCategory.Uncategorized,
              subCategory: item.subCategory,
              confidence: item.confidence || 0.8,
              reason: item.reason || 'Groq AI',
            })
          );
          if (onChunkProcessed) onChunkProcessed(results);
        }
      }
    } catch (e: unknown) {
      console.error('Groq Batch Failed', e);
      const errorMessage = e instanceof Error ? e.message : String(e);
      // Propagate rate limits or specific errors
      if (errorMessage.includes('Rate Limit') || errorMessage.includes('JSON')) {
        throw e;
      }

      // Fallback for failed batch
      const fallbackResults = batch.map((t) => ({
        id: t.id,
        category: TransactionCategory.Uncategorized,
        confidence: 0,
        reason: 'AI Request Failed: ' + errorMessage,
      }));
      if (onChunkProcessed) onChunkProcessed(fallbackResults);
    }

    // Rate limit buffer
    await new Promise((r) => setTimeout(r, 2000));
  }
};

const categorizeWithOllama = async (
  transactions: Transaction[],
  onChunkProcessed?: (results: CategorizationResult[]) => void
): Promise<void> => {
  const settings = useSettingsStore.getState();
  const { baseUrl, port, model } = settings.ollamaConfig;
  // Ensure protocol is present
  const safeBaseUrl = baseUrl.startsWith('http') ? baseUrl : `http://${baseUrl}`;
  const url = `${safeBaseUrl}:${port}/api/generate`;

  const hierarchyStr = JSON.stringify(CATEGORY_HIERARCHY);

  const promptBase = `You are a financial assistant. Categorize the transaction into a Category and a Subcategory from this hierarchy:
    ${hierarchyStr}.

    Instructions:
    1. Pick the best Main Category.
    2. Pick the best Subcategory from that Main Category.
    3. Return ONLY JSON: { "category": "...", "subCategory": "...", "confidence": 0.9, "reason": "..." }.

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
          format: 'json',
        }),
      });

      if (!response.ok) throw new Error('Ollama connection failed');

      const data = await response.json();
      let result;

      // Handle cases where Ollama doesn't enforce JSON mode perfectly
      try {
        result = JSON.parse(data.response);
      } catch (_parseError) {
        // Fallback simple parsing if model chats instead of JSON
        console.warn('Failed to parse JSON from Ollama', data.response);
        // Don't throw here, just treat as failed tx
        throw new Error('Invalid JSON response');
      }

      const processedResult: CategorizationResult = {
        id: tx.id,
        category: result.category || TransactionCategory.Uncategorized,
        subCategory: result.subCategory,
        confidence: result.confidence || 0.5,
        reason: result.reason || 'Local AI',
      };

      if (onChunkProcessed) onChunkProcessed([processedResult]);
    } catch (e: unknown) {
      const errorMessage = e instanceof Error ? e.message : String(e);
      if (errorMessage === 'Failed to fetch') {
        throw new Error(
          'CORS Error. Run: $env:OLLAMA_ORIGINS="*"; ollama serve (Windows) OR OLLAMA_ORIGINS="*" ollama serve (Mac/Linux)'
        );
      }

      // Mark individual failure
      const failedResult: CategorizationResult = {
        id: tx.id,
        category: TransactionCategory.Uncategorized,
        confidence: 0,
        reason: 'AI Error: ' + errorMessage,
      };
      if (onChunkProcessed) onChunkProcessed([failedResult]);
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

    await new Promise((resolve) => setTimeout(resolve, 800)); // Fake network delay

    const results = batch.map((t) => {
      const desc = t.description.toLowerCase();
      const origCat = (t.originalCategory || '').toLowerCase();

      let cat = TransactionCategory.Uncategorized;
      let subCat = undefined;
      let reason = 'Unsure';

      // Matching Demo Data Original Categories
      if (origCat === 'rent') {
        cat = TransactionCategory.MustHave;
        subCat = 'Housing';
        reason = 'Rent';
      } else if (origCat === 'bills') {
        cat = TransactionCategory.MustHave;
        subCat = 'Utilities';
        reason = 'Utility Bill';
      } else if (origCat === 'insurance') {
        cat = TransactionCategory.MustHave;
        subCat = 'Insurance';
        reason = 'Policy';
      } else if (origCat === 'utilities') {
        cat = TransactionCategory.MustHave;
        subCat = 'Utilities';
        reason = 'City/Power';
      } else if (origCat === 'subscription') {
        cat = TransactionCategory.NiceToHave;
        subCat = 'Entertainment';
        reason = 'Sub';
      } else if (origCat === 'shopping') {
        cat = TransactionCategory.NiceToHave;
        subCat = 'Shopping';
        reason = 'Retail';
      } else if (origCat === 'groceries') {
        cat = TransactionCategory.MustHave;
        subCat = 'Food & Groceries';
        reason = 'Grocery Store';
      } else if (origCat === 'gas') {
        cat = TransactionCategory.MustHave;
        subCat = 'Transportation';
        reason = 'Fuel';
      } else if (origCat === 'travel') {
        cat = TransactionCategory.NiceToHave;
        subCat = 'Travel & Leisure';
        reason = 'Trip';
      } else if (origCat === 'dining') {
        cat = TransactionCategory.NiceToHave;
        subCat = 'Dining Out';
        reason = 'Restaurant';
      } else if (origCat === 'income') {
        cat = TransactionCategory.Income;
        subCat = 'Salary';
        reason = 'Payroll';
      }
      // General fallbacks based on description keywords
      else if (origCat.includes('income') || origCat.includes('deposit')) {
        cat = TransactionCategory.Income;
        subCat = 'Other Income';
        reason = 'Based on bank category';
      } else if (t.amount > 0 && !desc.includes('refund')) {
        cat = TransactionCategory.Income;
        subCat = desc.includes('salary') ? 'Salary' : 'Other Income';
        reason = 'Positive amount';
      } else if (desc.includes('payment') || desc.includes('transfer')) {
        cat = TransactionCategory.InternalTransfer;
        subCat = 'Credit Card Payment';
        reason = 'Transfer detected';
      } else if (desc.includes('starbucks') || desc.includes('coffee')) {
        cat = TransactionCategory.NiceToHave;
        subCat = 'Dining Out';
        reason = 'Coffee';
      } else if (desc.includes('netflix') || desc.includes('spotify')) {
        cat = TransactionCategory.NiceToHave;
        subCat = 'Entertainment';
        reason = 'Subscription';
      } else if (desc.includes('fee')) {
        cat = TransactionCategory.Waste;
        subCat = 'Late Fees & Penalties';
        reason = 'Fee detected';
      } else if (desc.includes('savings')) {
        cat = TransactionCategory.Save;
        subCat = 'General Savings';
        reason = 'Saving';
      } else {
        cat = TransactionCategory.NiceToHave;
        subCat = 'Shopping';
      }

      return {
        id: t.id,
        category: cat,
        subCategory: subCat,
        confidence: 0.85,
        reason,
      };
    });

    if (onChunkProcessed) onChunkProcessed(results);
  }
};
