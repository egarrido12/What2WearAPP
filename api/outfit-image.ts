// api/outfit-image.ts
import path from 'node:path';
import { readFile, stat } from 'node:fs/promises';
import { GoogleGenAI, Modality } from '@google/genai';
// ⚠️ ESM en Vercel → usa .js en el import
import { dataUrlToPart, approxBase64Bytes, handleImageResponse } from './_utils.js';

const MAX_BYTES = 4_500_000;
const MAX_GARMENTS = 5;
const ASSETS_DIR = path.join(process.cwd(), 'public', 'wardrobe-assets');

// === Mapa de slugs "bonitos" → archivos que SÍ existen en tu repo ===
const LEGACY_MAP: Record<string, string> = {
  // Tops
  'cream-silk-blouse.png': 'Gemini_Generated_Image_1dsf9x1dsf9x1dsf.png',
  // Outerwear
  'navy-blazer.png': 'Gemini_Generated_Image_j84kv5j84kv5j84k.png',
  // Bottoms
  'black-trousers.png': 'Pantanegros.jpeg',
  // Shoes
  'nude-heels.png': 'Gemini_Generated_Image_yb0fsxyb0fsxyb0f.png',
};

function guessMimeByExt(filename: string) {
  const ext = path.extname(filename).toLowerCase();
  if (ext === '.png') return 'image/png';
  if (ext === '.jpg' || ext === '.jpeg') return 'image/jpeg';
  if (ext === '.webp') return 'image/webp';
  return 'application/octet-stream';
}

// Lee del FS si es /wardrobe-assets; si es http(s) hace fetch
async function urlToPartServer(url: string) {
  if (!url) throw new Error('URL vacía');

  if (url.startsWith('/wardrobe-assets/')) {
    const baseRaw = path.basename(url);
    const base = baseRaw.replace(/\.\.+/g, '').replace(/[^a-zA-Z0-9._-]/g, '');
    let candidate = base;

    // Si el archivo "bonito" no existe, intenta con su mapeo real
    let abs = path.join(ASSETS_DIR, candidate);
    let st = await stat(abs).catch(() => null);

    if (!st?.isFile()) {
      const mapped = LEGACY_MAP[candidate];
      if (!mapped) throw new Error(`El archivo no existe: ${url}`); // sin mapeo conocido
      candidate = mapped;
      abs = path.join(ASSETS_DIR, candidate);
      st = await stat(abs).catch(() => null);
      if (!st?.isFile()) throw new Error(`El archivo mapeado tampoco existe: ${candidate}`);
    }

    if (st.size > MAX_BYTES) throw new Error(`Archivo demasiado grande: ${candidate}`);

    const buf = await readFile(abs);
    const b64 = Buffer.from(buf).toString('base64');
    const ct = guessMimeByExt(candidate);
    return { inlineData: { mimeType: ct, data: b64 } };
  }

  if (/^https?:\/\//i.test(url)) {
    const r = await fetch(url);
    if (!r.ok) throw new Error(`No se pudo descargar: ${url} (${r.status})`);
    const ct = r.headers.get('content-type') || 'image/jpeg';
    const buf = await r.arrayBuffer();
    const b64 = Buffer.from(buf).toString('base64');
    return { inlineData: { mimeType: ct, data: b64 } };
  }

  throw new Error(`Ruta de prenda inválida: ${url}`);
}

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
      garmentParts = await Promise.all(limited.map(urlToPartServer));
    } else if (Array.isArray(garmentDataUrls) && garmentDataUrls.length) {
      const limited = garmentDataUrls.slice(0, MAX_GARMENTS);
      for (const d of limited) {
        if (approxBase64Bytes(d) > MAX_BYTES) return res.status(413).json({ error: 'Una prenda es demasiado grande.' });
      }
      garmentParts = limited.map((d) => dataUrlToPart(d));
    } else {
      return res.status(400).json({ error: 'Debes enviar garmentUrls[] o garmentDataUrls[]' });
    }

    const prompt = `Eres experto en prueba de ropa virtual. Devuelve SOLO la imagen final.`;

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
