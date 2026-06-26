export default async function handler(req, res) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: { message: 'Method not allowed' } });
  }

  const { prompt, system, maxTokens } = req.body || {};

  if (!prompt) {
    return res.status(400).json({ error: { message: '프롬프트가 비어 있습니다.' } });
  }
  if (!process.env.ANTHROPIC_API_KEY) {
    return res.status(401).json({ error: { message: 'API 키가 설정되지 않았습니다.' } });
  }

  try {
    const response = await fetch('https://api.anthropic.com/v1/messages', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-api-key': process.env.ANTHROPIC_API_KEY,
        'anthropic-version': '2023-06-01',
      },
      body: JSON.stringify({
        model: 'claude-sonnet-4-5',
        max_tokens: maxTokens || 6000,
        temperature: 0,
        system: system,
        messages: [{ role: 'user', content: prompt }],
      }),
    });

    if (!response.ok) {
      const error = await response.json().catch(() => ({}));
      if (response.status === 429) {
        return res.status(429).json({ error: { message: '요청이 너무 많습니다. 30초 후 다시 시도하세요.' } });
      }
      if (response.status === 401) {
        return res.status(401).json({ error: { message: 'API 키 오류입니다. Vercel 환경변수를 확인하세요.' } });
      }
      return res.status(response.status).json({ error: { message: error?.error?.message || ('API 오류(' + response.status + ')') } });
    }

    const data = await response.json();
    return res.status(200).json(data);

  } catch (error) {
    return res.status(500).json({ error: { message: error.message || '서버 오류가 발생했습니다.' } });
  }
}
