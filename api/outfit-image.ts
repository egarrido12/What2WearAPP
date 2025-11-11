// api/outfit-image.ts
import path from 'node:path';
import { readFile, stat } from 'node:fs/promises';
import { GoogleGenAI, Modality } from '@google/genai';

// ⚠️ En TS: SIN ".js"
import { dataUrlToPart, approxBase64Bytes, handleImageResponse } from './_utils';

const MAX_BYTES = 4_500_000;
const MAX_GARMENTS = 5;

// Carpeta donde Vercel incluye tus assets empaquetados
const ASSETS_DIR = path.join(process.cwd(), 'public', 'wardrobe-assets');

// Determinar MIME según extensión
function guessMimeByExt(filename: string) {
  const ext = path.extname(filename).toLowerCase();
  if (ext === '.png') return 'image/png';
  if (ext === '.jpg' || ext === '.jpeg') return 'image/jpeg';
  if (ext === '.webp') return 'image/webp';
  return 'application/octet-stream';
}

/**
 * Convierte una URL (local o remota) a { inlineData: { mimeType, data(base64) } }
 * - Si la URL empieza con "/wardrobe-assets/": la lee del filesystem (NO fetch)
 * - Si es http(s): la descarga
 */
async function urlToPartServer(url: string) {
  if (!url) throw new Error('URL vacía');

  // ✅ CASO 1 — archivo local en /public/wardrobe-assets
  if (url.startsWith('/wardrobe-assets/')) {
    const base = path.basename(url)
      .replace(/\.\.+/g, '')
      .replace(/[^a-zA-Z0-9._-]/g, '');
    const abs = path.join(ASSETS_DIR, base);

    const st = await stat(abs).catch(() => null);
    if (!st?.isFile()) {
      throw new Error(`El archivo no existe: ${url}`);
    }
    if (st.size > MAX_BYTES) {
      throw new Error(`Archivo demasiado grande: ${url}`);
    }

    const buf = await readFile(abs);
    const b64 = Buffer.from(buf).toString('base64');
    const ct = guessMimeByExt(base);
    return { inlineData: { mimeType: ct, data: b64 } };
  }

  // ✅ CASO 2 — URL absoluta remota
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
    if (!apiKey) {
      return res.status(500).json({ error: 'Missing GEMINI_API_KEY' });
    }

    const { modelImageDataUrl, garmentUrls, garmentDataUrls } = req.body || {};
    if (!modelImageDataUrl) {
      return res.status(400).json({ error: 'modelImageDataUrl requerido' });
    }

    const modelBytes = approxBase64Bytes(modelImageDataUrl);
    if (modelBytes > MAX_BYTES) {
      return res.status(413).json({ error: 'Imagen de modelo demasiado grande.' });
    }

    const ai = new GoogleGenAI({ apiKey });
    const modelPart = dataUrlToPart(modelImageDataUrl);

    let garmentParts: any[] = [];

    // ✅ URLs → imágenes
    if (Array.isArray(garmentUrls) && garmentUrls.length) {
      const limited = garmentUrls.slice(0, MAX_GARMENTS);
      garmentParts = await Promise.all(limited.map(urlToPartServer));

    // ✅ DataURLs → imágenes
    } else if (Array.isArray(garmentDataUrls) && garmentDataUrls.length) {
      const limited = garmentDataUrls.slice(0, MAX_GARMENTS);
      for (const d of limited) {
        if (approxBase64Bytes(d) > MAX_BYTES) {
          return res.status(413).json({ error: 'Una prenda es demasiado grande.' });
        }
      }
      garmentParts = limited.map((d) => dataUrlToPart(d));
    } else {
      return res.status(400).json({ error: 'Debes enviar garmentUrls[] o garmentDataUrls[]' });
    }

    const prompt = `
      Eres experto en prueba de ropa virtual.
      Devuelve únicamente la imagen generada final, sin texto adicional.
    `;

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
