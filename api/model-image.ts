import { GoogleGenAI, Modality } from "@google/genai";
import { dataUrlToPart, handleImageResponse } from "./_utils.ts";

export default async function handler(req: any, res: any) {
  try {
    const apiKey = process.env.GEMINI_API_KEY;
    if (!apiKey) return res.status(500).json({ error: "Missing GEMINI_API_KEY" });

    const { userImageDataUrl } = req.body || {};
    if (!userImageDataUrl) return res.status(400).json({ error: "userImageDataUrl requerido" });

    const ai = new GoogleGenAI({ apiKey });

    const prompt =
      "Eres un IA experta en fotografía de moda. Transforma a la persona en esta imagen en una foto de modelo de moda de cuerpo entero... Devuelve ÚNICAMENTE la imagen final.";

    const userImagePart = dataUrlToPart(userImageDataUrl);

    const response = await ai.models.generateContent({
      model: "gemini-2.5-flash-image",
      contents: { parts: [userImagePart, { text: prompt }] },
      config: { responseModalities: [Modality.IMAGE] },
    });

    const image = handleImageResponse(response);
    res.setHeader("Cache-Control", "no-store");
    return res.status(200).json({ image });
  } catch (e: any) {
    return res.status(500).json({ error: e.message });
  }
}

