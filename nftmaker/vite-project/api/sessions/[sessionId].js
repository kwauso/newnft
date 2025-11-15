export default async function handler(req, res) {
  // CORS設定
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, DELETE, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

  if (req.method === 'OPTIONS') {
    return res.status(200).end();
  }

  // セッションIDを取得（Vercelの動的ルートから）
  const sessionId = req.query?.sessionId || 
                    (req.url && req.url.match(/\/sessions\/([^\/]+)/)?.[1]);
  
  if (!sessionId) {
    return res.status(400).json({ error: 'Session ID is required' });
  }

  // セッションデータは保持しないため、常に404を返す
  // アップロード時にIPFSハッシュを直接返すため、このエンドポイントは不要
  return res.status(404).json({ error: 'Session not found. Please use the upload endpoint to get IPFS hash.' });
}

