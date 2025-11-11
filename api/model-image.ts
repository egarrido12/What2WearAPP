import { GoogleGenAI, Modality } from '@google/genai';
import { dataUrlToPart, approxBase64Bytes, handleImageResponse } from './_utils.js';


const MAX_BYTES = 4_500_000; // baja si aún supera límite

export default async function handler(req: any, res: any) {
  try {
    const apiKey = process.env.GEMINI_API_KEY;
    if (!apiKey) return res.status(500).json({ error: 'Missing GEMINI_API_KEY' });

    const { userImageDataUrl } = req.body || {};
    if (!userImageDataUrl) return res.status(400).json({ error: 'userImageDataUrl requerido' });

    const size = approxBase64Bytes(userImageDataUrl);
    if (size > MAX_BYTES) {
      return res.status(413).json({
        error: `Imagen demasiado grande (${(size/1e6).toFixed(2)} MB). Comprime a <= ${(MAX_BYTES/1e6).toFixed(1)} MB.`,
      });
    }

    const ai = new GoogleGenAI({ apiKey });

    const prompt =
      'Eres un IA experta en fotografía de moda... (mismo prompt que tenías). Devuelve ÚNICAMENTE la imagen final.';

    const userImagePart = dataUrlToPart(userImageDataUrl);

    // Si tu cuenta tiene acceso a imagen-salida:
    const r = await ai.models.generateContent({
      model: 'gemini-2.5-flash-image',
      contents: { parts: [userImagePart, { text: prompt }] },
      config: { responseModalities: [Modality.IMAGE] },
    });

    const image = handleImageResponse(r);
    res.setHeader('Cache-Control', 'no-store');
    return res.status(200).json({ image });
  } catch (e: any) {
    console.error('MODEL-IMAGE ERROR:', e?.stack || e);
    return res.status(500).json({ error: e?.message || 'Internal error' });
  }
}
