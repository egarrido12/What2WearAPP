// ...imports arriba...
import { GoogleGenAI, Modality } from '@google/genai';
import { dataUrlToPart, approxBase64Bytes, handleImageResponse } from './_utils.ts';

async function urlToPartServer(url: string) {
  const r = await fetch(url);
  if (!r.ok) throw new Error(`No se pudo descargar: ${url} (${r.status})`);
  const ct = r.headers.get('content-type') || 'image/jpeg';
  const buf = await r.arrayBuffer();
  const b64 = Buffer.from(buf).toString('base64');
  return { inlineData: { mimeType: ct, data: b64 } };
}

// 👇 NUEVO: resuelve URL relativa → absoluta usando headers (funciona en local y Vercel)
function toAbsoluteUrl(u: string, req: any): string {
  if (!u) throw new Error('URL vacía');
  if (/^https?:\/\//i.test(u)) return u; // ya es absoluta
  const host = req?.headers?.host;
  const proto = (req?.headers?.['x-forwarded-proto'] as string) || 'http'; // en prod será 'https'
  if (!host) throw new Error(`No se pudo resolver host para URL relativa: ${u}`);
  // asegura que empiece por "/"
  const path = u.startsWith('/') ? u : `/${u}`;
  return `${proto}://${host}${path}`;
}

const MAX_BYTES = 4_500_000;
const MAX_GARMENTS = 5;

export default async function handler(req: any, res: any) {
  try {
    const apiKey = process.env.GEMINI_API_KEY;
    if (!apiKey) return res.status(500).json({ error: 'Missing GEMINI_API_KEY' });

    const { modelImageDataUrl, garmentUrls, garmentDataUrls } = req.body || {};
    if (!modelImageDataUrl) return res.status(400).json({ error: 'modelImageDataUrl requerido' });

    const modelBytes = approxBase64Bytes(modelImageDataUrl);
    if (modelBytes > MAX_BYTES) return res.status(413).json({ error: 'Imagen de modelo demasiado grande.' });

    const ai = new GoogleGenAI({ apiKey });
    const modelPart = dataUrlToPart(modelImageDataUrl);

    let garmentParts: any[] = [];
    if (Array.isArray(garmentUrls) && garmentUrls.length) {
      const limited = garmentUrls.slice(0, MAX_GARMENTS);
      // 👇 convierte cada URL (relativa o absoluta) a absoluta
      const abs = limited.map(u => toAbsoluteUrl(u, req));
      garmentParts = await Promise.all(abs.map(urlToPartServer));
    } else if (Array.isArray(garmentDataUrls) && garmentDataUrls.length) {
      const limited = garmentDataUrls.slice(0, MAX_GARMENTS);
      for (const d of limited) {
        if (approxBase64Bytes(d) > MAX_BYTES) return res.status(413).json({ error: 'Una prenda es demasiado grande.' });
      }
      garmentParts = limited.map((d) => dataUrlToPart(d));
    } else {
      return res.status(400).json({ error: 'Debes enviar garmentUrls[] o garmentDataUrls[]' });
    }

    const prompt = `Eres experto en prueba de ropa virtual... Devuelve SOLO la imagen final.`;

    const r = await ai.models.generateContent({
      model: 'gemini-2.5-flash-image',
      contents: { parts: [modelPart, ...garmentParts, { text: prompt }] },
      config: { responseModalities: [Modality.IMAGE] },
    });

    const image = handleImageResponse(r);
    res.setHeader('Cache-Control', 'no-store');
    return res.status(200).json({ image });
  } catch (e: any) {
    console.error('OUTFIT-IMAGE ERROR:', e?.stack || e);
    return res.status(500).json({ error: e?.message || 'Internal error' });
  }
}
