import { GoogleGenAI } from '@google/genai';

export async function POST(request: Request) {
  try {
    const { message, context } = await request.json();

    // 1. Security Check: Ensure server key exists
    if (!process.env.API_KEY) {
      return new Response(
        JSON.stringify({ error: 'Server configuration error: Demo key not found.' }),
        { status: 500 }
      );
    }

    const ai = new GoogleGenAI({ apiKey: process.env.API_KEY });

    // 2. Define System Prompt on Server (Prevent Prompt Injection/Misuse of key)
    const systemPrompt = `You are MonkeySmile 🐵, a sassy, fun, and brutally honest financial buddy.
        You have access to the user's current financial snapshot below.

        FINANCIAL DATA CONTEXT:
        ${context}

        INSTRUCTIONS:
        1. Be concise and conversational.
        2. Use emojis (especially 🐵, 🍌, 💸).
        3. Use the provided financial context to answer accurately.
        4. If the user asks "Can I afford X?", check their 'Net' or 'Nice-to-Have' spending.
        5. If 'Waste' spending is high, gently roast them.
        6. If they are doing well (high savings, positive net), cheer them on!
        7. Never make up numbers. If the data isn't in the context, say "I don't see that in your records."`;

    // 3. Call Gemini
    const response = await ai.models.generateContent({
      model: 'gemini-2.5-flash', // Use a cost-effective model for the free demo
      contents: [
        { role: 'user', parts: [{ text: systemPrompt + '\n\nUser Question: ' + message }] },
      ],
    });

    return new Response(JSON.stringify({ response: response.text }), {
      headers: { 'Content-Type': 'application/json' },
    });
  } catch (error: unknown) {
    console.error('Chat API Error:', error);
    return new Response(JSON.stringify({ error: 'Demo AI is currently unavailable.' }), {
      status: 500,
    });
  }
}
