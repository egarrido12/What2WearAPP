export default async function handler(req: any, res: any) {
  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey) return res.status(500).json({ error: 'Missing GEMINI_API_KEY' });

  const prompt =
    (req.method === 'POST' ? req.body?.prompt : req.query?.prompt) || '';

  try {
    const r = await fetch(
      `https://generativelanguage.googleapis.com/v1beta/models/gemini-pro:generateContent?key=${apiKey}`,
      {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          contents: [{ parts: [{ text: prompt || 'Hola' }] }]
        })
      }
    );

    const data = await r.json();
    return res.status(r.ok ? 200 : r.status).json(data);
  } catch (e: any) {
    return res.status(500).json({ error: e.message });
  }
}
