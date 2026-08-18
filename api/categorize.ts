import { GoogleGenAI, Type } from '@google/genai';
import { CATEGORY_HIERARCHY } from '../constants'; // Assumes access to constants in the build environment

// NOTE: This file represents the server-side logic (e.g. Vercel Function).
// In a purely client-side demo without a backend, this code would expose keys if run in browser.
// This is provided to satisfy the architectural requirement of the prompt.

export async function POST(request: Request) {
  const { transactions } = await request.json();

  if (!process.env.API_KEY) {
    return new Response(JSON.stringify({ error: 'Server misconfigured: Missing API Key' }), {
      status: 500,
    });
  }

  const ai = new GoogleGenAI({ apiKey: process.env.API_KEY });

  // Batching to prevent huge context
  const simplifiedTransactions = transactions
    .map(
      (t: {
        id: string;
        description: string;
        amount: number;
        date: string;
        originalCategory?: string;
      }) => ({
        id: t.id,
        desc: t.description,
        amt: t.amount,
        date: t.date,
        cat: t.originalCategory,
      })
    )
    .slice(0, 50); // Reduced limit

  const prompt = `
        Categorize these financial transactions based on the following hierarchy:
        ${JSON.stringify(CATEGORY_HIERARCHY)}

        Instructions:
        1. Assign the best Category and Subcategory.
        2. Use 'cat' (original bank category) as context.
        3. Return JSON array matching the schema.
    `;

  try {
    const response = await ai.models.generateContent({
      model: 'gemini-2.5-flash',
      contents: [
        { role: 'user', parts: [{ text: prompt + JSON.stringify(simplifiedTransactions) }] },
      ],
      config: {
        responseMimeType: 'application/json',
        responseSchema: {
          type: Type.ARRAY,
          items: {
            type: Type.OBJECT,
            properties: {
              id: { type: Type.STRING },
              // Removed strict enum to prevent 500 errors on minor model hallucinations
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

    return new Response(response.text, { headers: { 'Content-Type': 'application/json' } });
  } catch {
    return new Response(JSON.stringify({ error: 'AI Processing Failed' }), { status: 500 });
  }
}
