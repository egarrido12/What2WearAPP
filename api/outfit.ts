import { GoogleGenAI, Type } from "@google/genai";

export default async function handler(req: any, res: any) {
  try {
    const apiKey = process.env.GEMINI_API_KEY;
    if (!apiKey) return res.status(500).json({ error: "Missing GEMINI_API_KEY" });

    const { wardrobe, chatHistory } = req.body || {};
    const ai = new GoogleGenAI({ apiKey });

    const availableItems = (wardrobe ?? [])
      .map((it: any) => `'${it.name}' (categoría: ${it.category})`)
      .join(", ");

    const historyForPrompt = (chatHistory ?? [])
      .map((msg: any) =>
        msg.role === "user"
          ? `Usuario: ${msg.content}`
          : typeof msg.content === "string"
          ? `Estilista: ${msg.content}`
          : "Estilista: [Se ha generado una imagen de atuendo]"
      )
      .join("\n");

    const systemInstruction = `Eres 'What2Wear', un experto estilista de moda IA... (mismas reglas que tenías)`;

    const contents = `Este es el historial de la conversación:\n${historyForPrompt}\n\nBasado en el último mensaje del usuario, sugiere un nuevo atuendo.`;

    const response = await ai.models.generateContent({
      model: "gemini-2.5-pro",
      contents,
      config: {
        systemInstruction,
        responseMimeType: "application/json",
        responseSchema: {
          type: Type.OBJECT,
          properties: {
            outfit: { type: Type.ARRAY, items: { type: Type.STRING } },
            reasoning: { type: Type.STRING },
          },
          required: ["outfit", "reasoning"],
        },
      },
    });

    const jsonStr = response.text?.trim?.();
    if (!jsonStr?.startsWith("{") || !jsonStr?.endsWith("}")) {
      return res.status(500).json({ error: "Respuesta JSON no válida del modelo" });
    }
    const result = JSON.parse(jsonStr);
    res.setHeader("Cache-Control", "no-store");
    return res.status(200).json(result);
  } catch (e: any) {
    return res.status(500).json({ error: e.message });
  }
}
