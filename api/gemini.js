export default async function handler(req, res) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey) {
    return res.status(500).json({ error: 'GEMINI_API_KEY is not configured in Vercel Environment Variables.' });
  }

  const { type, artist, song } = req.body || {};
  
  const endpoint = `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent?key=${apiKey}`;

  try {
    let payload;

    if (type === 'trending') {
      const systemPrompt = "あなたは音楽トレンドのアナリストです。現在世界的および日本でヒットしている人気曲を4曲選出し、JSON形式で返答してください。";
      const userPrompt = "話題のヒット曲を洋楽3曲、邦楽1曲の割合で出力してください。";

      payload = {
        contents: [{ parts: [{ text: userPrompt }] }],
        systemInstruction: { parts: [{ text: systemPrompt }] },
        tools: [{ googleSearch: {} }]
      };
    } else {
      const systemPrompt = `あなたはプロの音楽評論家・ボイストレーナー・音楽データアナリストです。
Google検索ツールを使用して、指定されたアーティスト「${artist}」と楽曲「${song}」について最新かつ正確な実在データを必ず検索・収集してください。

【出力要件】
以下のフォーマットの純粋なJSONオブジェクトのみを出力してください（エクスプレッションやバックトック装飾は不要です）。
{
  "youtube": {
    "videoId": "該当楽曲の公式MVまたは公式オーディオのYouTube 11桁ID（不明な場合はnull）",
    "type": "公式MV", "公式リリックMV", または "公式オーディオ"
  },
  "artist": {
    "origin": "出身地・活動拠点",
    "age": "生年月日・キャリア",
    "bio": "経歴・音楽的特徴の日本語解説 (200文字程度)",
    "topSongs": ["代表曲1", "代表曲2", "代表曲3"]
  },
  "song": {
    "release": "リリース時期",
    "key": "楽曲のKey/調 (例: A Major)",
    "bpm": "テンポ/BPM (例: 120)",
    "features": "ジャンルやコード構成の特徴解説 (120文字程度)",
    "vocalFeatures": "歌唱発声のアドバイスや声質特徴 (150文字程度)"
  },
  "similarSongs": [
    {
      "artist": "類似曲のアーティスト",
      "song": "類似曲名",
      "reason": "類似点とおすすめ理由 (100文字程度)"
    }
  ]
}`;

      const userPrompt = `以下のアーティストと楽曲についてGoogle検索を行い、詳細を調べて結果をJSONで返してください。\nアーティスト: "${artist}"\n曲名: "${song}"`;

      payload = {
        contents: [{ parts: [{ text: userPrompt }] }],
        systemInstruction: { parts: [{ text: systemPrompt }] },
        tools: [{ googleSearch: {} }]
      };
    }

    const response = await fetch(endpoint, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload)
    });

    if (!response.ok) {
      const errText = await response.text();
      console.error('Gemini API Error Response:', errText);
      return res.status(response.status).json({ error: `Gemini API Error: ${errText}` });
    }

    const data = await response.json();
    return res.status(200).json(data);
  } catch (error) {
    console.error('Serverless Handler Exception:', error);
    return res.status(500).json({ error: error.message });
  }
}
