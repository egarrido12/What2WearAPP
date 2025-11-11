// api/outfit.ts
import { GoogleGenAI } from '@google/genai';

type ChatMsg = { role: 'user' | 'assistant'; content: string | { image?: string } };

const PRIMARY_MODEL   = 'gemini-2.5-pro';
const FALLBACK_MODELS = ['gemini-2.5-flash', 'gemini-flash-latest', 'gemini-1.5-flash'];
const MAX_TRIES = 4;

function buildHistory(chatHistory: ChatMsg[] = []) {
  return (chatHistory || [])
    .map((msg) =>
      msg?.role === 'user'
        ? `Usuario: ${typeof msg.content === 'string' ? msg.content : '[imagen]'}`
        : `Estilista: ${typeof msg.content === 'string' ? msg.content : '[imagen generada]'}`
    )
    .join('\n');
}

function buildAvailable(wardrobe: any[] = []) {
  return (wardrobe || [])
    .map((it) => `'${it?.name}' (categoría: ${it?.category})`)
    .join(', ');
}

function extractJsonText(raw: string): any {
  const text = (raw || '').trim();
  const i = text.indexOf('{');
  const j = text.lastIndexOf('}');
  const slice = i !== -1 && j !== -1 && j > i ? text.slice(i, j + 1) : text;
  return JSON.parse(slice);
}

async function withRetry<T>(fn: () => Promise<T>, tries = MAX_TRIES): Promise<T> {
  let lastErr: any;
  for (let i = 0; i < tries; i++) {
    try {
      return await fn();
    } catch (e: any) {
      lastErr = e;
      const code = e?.status || e?.code;
      const msg  = String(e?.message || '');
      const retriable = code === 429 || code === 503 || /timeout|ETIMEDOUT/i.test(msg);
      if (!retriable || i === tries - 1) throw e;
      const backoff = 400 * 2 ** i + Math.floor(Math.random() * 200);
      await new Promise((r) => setTimeout(r, backoff));
    }
  }
  throw lastErr;
}

export default async function handler(req: any, res: any) {
  try {
    const apiKey = process.env.GEMINI_API_KEY;
    if (!apiKey) return res.status(500).json({ error: 'Missing GEMINI_API_KEY' });

    const { wardrobe = [], chatHistory = [] } = req.body || {};
    const ai = new GoogleGenAI({ apiKey });

    const systemInstruction = `
Eres 'What2Wear', un estilista IA.
Usa SOLO los nombres EXACTOS del armario para el outfit.
Responde ESTRICTAMENTE en JSON válido, sin texto extra, sin markdown:
{
  "outfit": ["<nombre exacto 1>", "<nombre exacto 2>"],
  "reasoning": "<explicación breve y amigable>"
}
`.trim();

    const historyForPrompt = buildHistory(chatHistory as ChatMsg[]);
    const availableItems   = buildAvailable(wardrobe);

    const userPrompt = `
Este es el historial de la conversación:
${historyForPrompt || '(sin historial)'}

Armario disponible: [${availableItems}]
Basado en el último mensaje del usuario, sugiere un nuevo atuendo usando ÚNICAMENTE nombres exactos del armario.
Recuerda: SOLO JSON válido y nada más.
`.trim();

    // Gemini espera contents estructurados; mandamos system + user en un solo turno de texto
    const contents = [
      {
        role: 'user',
        parts: [{ text: `${systemInstruction}\n\n${userPrompt}` }],
      },
    ];

    // Intento con modelo primario + reintentos
    async function callModel(model: string) {
      const r = await withRetry(() =>
        ai.models.generateContent({
          model,
          contents,
          // Opcional: ajusta si quieres respuestas más deterministas
          // generationConfig: { temperature: 0.4 },
        })
      );
      const text = r.text?.trim?.() || '';
      return extractJsonText(text);
    }

    let usedModel = PRIMARY_MODEL;
    let json;
    try {
      json = await callModel(PRIMARY_MODEL);
    } catch (ePrimary: any) {
      const code = ePrimary?.status || ePrimary?.code;
      // Si es saturación/limite, probamos fallbacks en orden
      if (code === 429 || code === 503) {
        let lastErr = ePrimary;
        for (const m of FALLBACK_MODELS) {
          try {
            usedModel = m;
            json = await callModel(m);
            lastErr = null;
            break;
          } catch (eFb) {
            lastErr = eFb;
          }
        }
        if (lastErr) throw lastErr;
      } else {
        throw ePrimary;
      }
    }

    if (!json || !Array.isArray(json.outfit) || typeof json.reasoning !== 'string') {
      return res.status(500).json({
        error: `JSON inválido (faltan campos). Modelo usado: ${usedModel}. JSON: ${JSON.stringify(json).slice(0, 400)}...`,
      });
    }

    // (Opcional) filtrar nombres que no estén en el armario
    const namesSet = new Set(wardrobe.map((w: any) => w?.name));
    const invalid  = (json.outfit || []).filter((n: any) => !namesSet.has(n));
    if (invalid.length) {
      return res.status(400).json({
        error: `El outfit contiene nombres que no existen en el armario: ${invalid.join(', ')}`,
      });
    }

    res.setHeader('Cache-Control', 'no-store');
    return res.status(200).json(json);
  } catch (e: any) {
    console.error('OUTFIT ERROR:', e?.stack || e);
    return res.status(500).json({ error: e?.message || 'Internal error' });
  }
}
