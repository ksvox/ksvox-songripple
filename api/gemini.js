export default async function handler(req, res) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey) {
    return res.status(500).json({ 
      error: 'GEMINI_API_KEY がVercelの環境変数に設定されていません。Vercelの管理画面（Settings > Environment Variables）で GEMINI_API_KEY を登録し、Re-deploy してください。' 
    });
  }

  const { type, artist, song } = req.body || {};
  
  // 優先試行するGeminiモデルのリスト（2026年9月時点で提供中の正式モデルのみを使用）
  const candidateModels = ['gemini-3.5-flash', 'gemini-3.6-flassh'];

  try {
    let payload;

    if (type === 'trending') {
      const systemPrompt = "あなたは世界および日本の最新音楽トレンドに詳しいアナリストです。現在人気を博しているヒット曲を4曲選出し、純粋なJSON配列形式のみで出力してください。[{\"artist\":\"...\", \"song\":\"...\"}]";
      const userPrompt = "現在ヒットしている話題の楽曲を洋楽3曲、邦楽1曲の割合で4曲選出してJSON形式で返してください。";

      payload = {
        contents: [{ parts: [{ text: userPrompt }] }],
        systemInstruction: { parts: [{ text: systemPrompt }] },
        tools: [{ googleSearch: {} }]
      };
    } else {
      const systemPrompt = `プロの音楽アナリスト・ボイストレーナーとして動作してください。
指定されたアーティスト「${artist}」と楽曲「${song}」について、Google検索で最新の実在データを調査・分析し、必ず正確な事実のみに基づいて回答してください。

【動画情報の最優先検索指示】
1. 動画（video）については、まず第一優先として **Vimeo (vimeo.com)** から「${artist} ${song}」の公式MV、公式ライブ、または高品位パフォーマンス動画のID（英数字・数字ID）を検索して特定してください。
2. Vimeoで該当動画が見つかった場合は、platform を "vimeo" とし、videoId にVimeoのIDを設定してください。
3. Vimeoで見つからなかった場合のみ、第二優先として **YouTube** から公式MV/公式オーディオ（11桁のvideoId）を検索し、platform を "youtube", videoId に設定してください。
4. どちらも見つからない場合は platform: null, videoId: null としてください。

【厳格なその他の指示】
1. 必ず「${artist}」の実在する出身地・キャリア年数、楽曲「${song}」の実在するリリース年/発売日、キー(Key)、BPM(テンポ)を特定してください。
2. 代表曲(topSongs)には「${artist}」の実際に存在する有名ヒット曲タイトルを3曲挙げてください。
3. 必ず以下のJSON構造のみで返答してください。説明文やコードブロック前後の余計なテキストは一切含めないでください。

{
  "video": {
    "platform": "vimeo または youtube または null",
    "videoId": "VimeoのID または 11桁のYouTube ID または null",
    "type": "公式MV または 公式オーディオ または パフォーマンス"
  },
  "artist": {
    "origin": "実在する出身地・活動拠点",
    "age": "年齢またはデビュー年・キャリア",
    "bio": "アーティストの経歴や音楽的特徴の日本語解説 (150-200文字)",
    "topSongs": ["実在ヒット曲1", "実在ヒット曲2", "実在ヒット曲3"]
  },
  "song": {
    "release": "実在するリリース年・発売日",
    "key": "実在する楽曲の調/Key (例: E Major)",
    "bpm": "実在するBPM/テンポ (例: 118 BPM)",
    "features": "曲調・ジャンル・コード進行・アレンジの特徴 (120文字程度)",
    "vocalFeatures": "ヴォーカルの発声・ミックスボイス・歌唱テクニック・難易度のアドバイス (150文字程度)"
  },
  "similarSongs": [
    {
      "artist": "実在する類似アーティスト1",
      "song": "実在する類似楽曲1",
      "reason": "音楽的構造やボーカル表現の共通点 (80文字程度)"
    },
    {
      "artist": "実在する類似アーティスト2",
      "song": "実在する類似楽曲2",
      "reason": "音楽的構造やボーカル表現の共通点 (80文字程度)"
    },
    {
      "artist": "実在する類似アーティスト3",
      "song": "実在する類似楽曲3",
      "reason": "音楽的構造やボーカル表現の共通点 (80文字程度)"
    }
  ]
}`;

      const userPrompt = `アーティスト「${artist}」と楽曲「${song}」についてVimeo/YouTube等の実データを検索し、指定のJSONで返してください。`;

      payload = {
        contents: [{ parts: [{ text: userPrompt }] }],
        systemInstruction: { parts: [{ text: systemPrompt }] },
        tools: [{ googleSearch: {} }]
      };
    }

    let lastErrorText = '';
    for (const model of candidateModels) {
      const endpoint = `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${apiKey}`;
      
      const response = await fetch(endpoint, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload)
      });

      if (response.ok) {
        const data = await response.json();
        return res.status(200).json(data);
      } else {
        lastErrorText = await response.text();
        console.warn(`Model ${model} failed (${response.status}): ${lastErrorText}`);
      }
    }

    return res.status(500).json({ error: `Gemini API エラー: ${lastErrorText}` });
  } catch (error) {
    console.error('Serverless Handler Exception:', error);
    return res.status(500).json({ error: error.message });
  }
}
