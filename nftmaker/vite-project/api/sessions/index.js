import { v4 as uuidv4 } from 'uuid';

// セッション管理（グローバル変数として保持）
// 注意: Vercelのサーバーレス関数では、リクエスト間でメモリが共有されないため、
// 本番環境では外部ストレージ（Redis、Upstashなど）の使用を推奨
if (!global.sessions) {
  global.sessions = new Map();
}

export default async function handler(req, res) {
  // CORS設定
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

  if (req.method === 'OPTIONS') {
    return res.status(200).end();
  }

  if (req.method === 'POST') {
    // セッション作成
    const sessionId = uuidv4();
    global.sessions.set(sessionId, {
      imageData: null,
      timestamp: Date.now(),
      status: 'waiting',
      ipfsHash: null,
      error: null
    });
    
    return res.status(200).json({ sessionId });
  }

  return res.status(405).json({ error: 'Method not allowed' });
}

