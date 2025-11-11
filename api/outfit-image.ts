// api/outfit-image.ts
import path from 'node:path';
import { readFile, stat } from 'node:fs/promises';
import { GoogleGenAI, Modality } from '@google/genai';
// ESM en Vercel → importa con .js
import { dataUrlToPart, approxBase64Bytes, handleImageResponse } from './_utils.js';

const MAX_BYTES = 4_500_000;
const MAX_GARMENTS = 5;
const ASSETS_DIR = path.join(process.cwd(), 'public', 'wardrobe-assets');

// ---------- MAPEO COMPLETO: slug bonito → archivo REAL existente ----------
const LEGACY_MAP: Record<string, string> = {
  // TOPS
  'abstract-graphic-tee.png': 'Gemini_Generated_Image_183jpq183jpq183j.png',
  'cream-silk-blouse.png': 'Gemini_Generated_Image_1dsf9x1dsf9x1dsf.png',
  'blue-striped-shirt.png': 'camisa-azul-sobre-fondo-blanco-aislado_267651-1565.jpg',
  'grey-cashmere-sweater.png': 'Gemini_Generated_Image_1ta6yy1ta6yy1ta6.png',
  'white-linen-shirt.png': 'descarga.jpeg',
  'black-turtleneck.png': 'Gemini_Generated_Image_2gk6iy2gk6iy2gk6.png',

  // BOTTOMS
  'classic-blue-jeans.png': 'Gemini_Generated_Image_2xsee92xsee92xse.png',
  'taupe-pleated-skirt.png': 'Gemini_Generated_Image_996iq4996iq4996i.png',
  'black-trousers.png': 'Pantanegros.jpeg',
  'khaki-chinos.png': 'Gemini_Generated_Image_c9xzk8c9xzk8c9xz.png',
  'denim-shorts.png': 'Gemini_Generated_Image_dtrxmmdtrxmmdtrx.png',
  'white-jeans.png': 'Gemini_Generated_Image_fwz7o5fwz7o5fwz7.png',

  // OUTERWEAR
  'leather-jacket.png': 'Gemini_Generated_Image_g2pk2yg2pk2yg2pk.png',
  'beige-trench-coat.png': 'Gemini_Generated_Image_h5rqxhh5rqxhh5rq.png',
  'blue-denim-jacket.png': 'Gemini_Generated_Image_hnwr33hnwr33hnwr.png',
  'navy-blazer.png': 'Gemini_Generated_Image_j84kv5j84kv5j84k.png',
  'black-puffer-vest.png': 'Gemini_Generated_Image_nyawnynyawnynyaw.png',

  // DRESSES
  'summer-floral-dress.png': 'Gemini_Generated_Image_o8lhppo8lhppo8lh.png',
  'little-black-dress.png': 'Gemini_Generated_Image_otuqflotuqflotuq.png',
  'boho-maxi-dress.png': 'png_Mujer_vestir.png',
  'striped-shirt-dress.png': 'Gemini_Generated_Image_qrkehoqrkehoqrke.png',

  // SHOES
  'white-sneakers.png': 'Gemini_Generated_Image_r9e4xcr9e4xcr9e4.png',
  'black-combat-boots.png': 'Gemini_Generated_Image_v4qdp0v4qdp0v4qd.png',
  'brown-leather-loafers.png': 'Gemini_Generated_Image_vbr8sovbr8sovbr8.png',
  'strappy-sandals.png': 'Gemini_Generated_Image_wvnqy1wvnqy1wvnq.png',
  'nude-heels.png': 'Gemini_Generated_Image_yb0fsxyb0fsxyb0f.png',

  // ACCESSORIES
  'leather-tote-bag.png': 'Gemini_Generated_Image_yz8p7gyz8p7gyz8p.png',
  'aviator-sunglasses.png': 'una prenda de vestir.png',
  'patterned-silk-scarf.png': 'Gemini_Generated_Image_996iq4996iq4996i.png',
  'wool-fedora-hat.png': 'Gemini_Generated_Image_183jpq183jpq183j.png',
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
    const sanitized = baseRaw.replace(/\.\.+/g, '').replace(/[^a-zA-Z0-9._-]/g, '');

    // 1) intenta abrir el archivo tal cual
    let candidate = sanitized;
    let abs = path.join(ASSETS_DIR, candidate);
    let st = await stat(abs).catch(() => null);

    // 2) si no existe, intenta con el mapeo
    if (!st?.isFile()) {
      const mapped = LEGACY_MAP[sanitized];
      if (!mapped) throw new Error(`El archivo no existe: ${url}`);
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
