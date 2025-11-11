import { GoogleGenAI } from '@google/genai';

export default async function handler(req: any, res: any) {
  try {
    const apiKey = process.env.GEMINI_API_KEY;
    if (!apiKey) return res.status(500).json({ error: 'Missing GEMINI_API_KEY' });

    const { wardrobe = [], chatHistory = [] } = req.body || {};
    const ai = new GoogleGenAI({ apiKey });

    // Usa un modelo DISPONIBLE en tu cuenta (según /api/models)
    const MODEL = 'gemini-2.5-pro'; // si te falla, prueba: 'gemini-flash-latest' o 'gemini-2.5-flash'

    const availableItems = wardrobe
      .map((it: any) => `'${it?.name}' (categoría: ${it?.category})`)
      .join(', ');

    const historyForPrompt = chatHistory
      .map((msg: any) =>
        msg?.role === 'user'
          ? `Usuario: ${msg?.content}`
          : typeof msg?.content === 'string'
          ? `Estilista: ${msg?.content}`
          : 'Estilista: [Se ha generado una imagen de atuendo]'
      )
      .join('\n');

    const systemInstruction =
`Eres 'What2Wear', un estilista IA.
Usa SOLO los nombres EXACTOS del armario para el outfit.
Responde ESTRICTAMENTE en JSON sin texto extra, sin markdown, sin comentarios:
{
  "outfit": ["<nombre exacto 1>", "<nombre exacto 2>"],
  "reasoning": "<explicación breve y amigable>"
}`;

    const contents =
`Este es el historial de la conversación:
${historyForPrompt}

Armario disponible: [${availableItems}]
Basado en el último mensaje del usuario, sugiere un nuevo atuendo usando ÚNICAMENTE nombres exactos del armario.
Recuerda: SOLO JSON válido y nada más.`;

    const r = await ai.models.generateContent({
      model: MODEL,
      contents: `${systemInstruction}\n\n${contents}`,
    });

    let text = r.text?.trim?.() || '';
    const start = text.indexOf('{');
    const end = text.lastIndexOf('}');
    if (start !== -1 && end !== -1 && end > start) {
      text = text.slice(start, end + 1);
    }

    let json: any;
    try {
      json = JSON.parse(text);
    } catch {
      return res.status(500).json({
        error: `Respuesta no es JSON válido. Modelo: ${MODEL}. Texto: ${text.slice(0, 400)}...`
      });
    }

    if (!Array.isArray(json.outfit) || typeof json.reasoning !== 'string') {
      return res.status(500).json({
        error: `JSON inválido (faltan campos). Modelo: ${MODEL}. JSON: ${text.slice(0, 400)}...`
      });
    }

    res.setHeader('Cache-Control', 'no-store');
    return res.status(200).json(json);
  } catch (e: any) {
    console.error('OUTFIT ERROR:', e?.stack || e);
    return res.status(500).json({ error: e?.message || 'Internal error' });
  }
}
