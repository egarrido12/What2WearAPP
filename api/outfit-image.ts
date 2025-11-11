import { GoogleGenAI, Modality } from "@google/genai";
import { dataUrlToPart, handleImageResponse } from "./_utils";

export default async function handler(req: any, res: any) {
  try {
    const apiKey = process.env.GEMINI_API_KEY;
    if (!apiKey) return res.status(500).json({ error: "Missing GEMINI_API_KEY" });

    const { modelImageDataUrl, garmentDataUrls } = req.body || {};
    if (!modelImageDataUrl || !Array.isArray(garmentDataUrls))
      return res.status(400).json({ error: "Se requieren modelImageDataUrl y garmentDataUrls[]" });

    const ai = new GoogleGenAI({ apiKey });

    const modelPart = dataUrlToPart(modelImageDataUrl);
    const garmentParts = garmentDataUrls.map(dataUrlToPart);

    const prompt = `Eres un experto en prueba de ropa virtual con IA... (mismas reglas)`;

    const response = await ai.models.generateContent({
      model: "gemini-2.5-flash-image",
      contents: { parts: [modelPart, ...garmentParts, { text: prompt }] },
      config: { responseModalities: [Modality.IMAGE] },
    });

    const image = handleImageResponse(response);
    res.setHeader("Cache-Control", "no-store");
    return res.status(200).json({ image });
  } catch (e: any) {
    return res.status(500).json({ error: e.message });
  }
}
