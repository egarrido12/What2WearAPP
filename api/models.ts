import { GoogleGenAI } from "@google/genai";

export default async function handler(req: any, res: any) {
  try {
    const apiKey = process.env.GEMINI_API_KEY;
    if (!apiKey)
      return res.status(500).json({ error: "Missing GEMINI_API_KEY" });

    const ai = new GoogleGenAI({ apiKey });

    const list = await ai.models.list();

    return res.status(200).json(list);
  } catch (e: any) {
    console.error("MODELS ERROR:", e?.stack || e);
    return res.status(500).json({ error: e?.message || "models failed" });
  }
}
