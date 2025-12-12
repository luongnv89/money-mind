
import { GoogleGenAI, Type } from "@google/genai";

// NOTE: This file represents the server-side logic (e.g. Vercel Function).
// In a purely client-side demo without a backend, this code would expose keys if run in browser.
// This is provided to satisfy the architectural requirement of the prompt.

export async function POST(request: Request) {
    const { transactions } = await request.json();

    if (!process.env.API_KEY) {
        return new Response(JSON.stringify({ error: "Server misconfigured: Missing API Key" }), { status: 500 });
    }

    const ai = new GoogleGenAI({ apiKey: process.env.API_KEY });
    
    // Batching to prevent huge context
    const simplifiedTransactions = transactions.map((t: any) => ({
        id: t.id,
        desc: t.description,
        amt: t.amount,
        date: t.date,
        cat: t.originalCategory
    })).slice(0, 100); // Limit for demo

    const prompt = `
        Categorize these financial transactions.
        Main Categories: Income, Internal Transfer, Must-have, Nice-to-have, Waste, Save, Invest.
        Subcategories provided via schema.
        Use 'cat' (original bank category) as context.
        
        Return JSON array: [{ id, category, subCategory, confidence, reason }]
    `;

    try {
        const response = await ai.models.generateContent({
            model: "gemini-2.5-flash",
            contents: [
                { role: "user", parts: [{ text: prompt + JSON.stringify(simplifiedTransactions) }] }
            ],
            config: {
                responseMimeType: "application/json",
                responseSchema: {
                    type: Type.ARRAY,
                    items: {
                        type: Type.OBJECT,
                        properties: {
                            id: { type: Type.STRING },
                            category: { type: Type.STRING, enum: ["Income", "Internal Transfer", "Must-have", "Nice-to-have", "Waste", "Save", "Invest"] },
                            subCategory: { type: Type.STRING },
                            confidence: { type: Type.NUMBER },
                            reason: { type: Type.STRING }
                        }
                    }
                }
            }
        });

        return new Response(response.text, { headers: { 'Content-Type': 'application/json' } });
    } catch (error) {
        return new Response(JSON.stringify({ error: "AI Processing Failed" }), { status: 500 });
    }
}
