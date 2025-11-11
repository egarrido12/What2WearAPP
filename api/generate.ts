import { GoogleGenAI } from '@google/genai';

export default async function handler(req: any, res: any) {
  try {
    const apiKey = process.env.GEMINI_API_KEY;
    if (!apiKey) return res.status(500).json({ error: 'Missing GEMINI_API_KEY' });

    const { prompt = 'Di "pong" y nada más.' } = req.body || {};
    const ai = new GoogleGenAI({ apiKey });

    const r = await ai.models.generateContent({
      model: 'gemini-1.5-flash', // estable para texto
      contents: String(prompt),
    });

    res.setHeader('Cache-Control', 'no-store');
    return res.status(200).json({ text: r.text?.trim?.() || '' });
  } catch (e: any) {
    console.error('GENERATE ERROR:', e?.stack || e);
    return res.status(500).json({ error: e?.message || 'Internal error' });
  }
}
