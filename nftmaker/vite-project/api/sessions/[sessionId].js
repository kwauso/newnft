// セッション状態取得
if (!global.sessions) {
  global.sessions = new Map();
}

export default async function handler(req, res) {
  // デバッグ: リクエスト情報をログに出力
  console.log('=== Session Status Handler Called ===');
  console.log('req.method:', req.method);
  console.log('req.url:', req.url);
  console.log('req.query:', req.query);

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
  
  console.log('SessionId from query:', req.query?.sessionId);
  console.log('SessionId from URL:', req.url && req.url.match(/\/sessions\/([^\/]+)/)?.[1]);
  console.log('Final sessionId:', sessionId);
  
  if (!sessionId) {
    console.error('SessionId not found!');
    return res.status(400).json({ error: 'Session ID is required', query: req.query, url: req.url });
  }

  const session = global.sessions.get(sessionId);

  if (!session) {
    return res.status(404).json({ error: 'Session not found' });
  }

  if (req.method === 'GET') {
    return res.status(200).json({
      sessionId,
      status: session.status,
      imageData: session.imageData ? {
        name: session.imageData.name,
        type: session.imageData.type,
        size: session.imageData.size,
        data: session.imageData.data.toString('base64')
      } : null,
      ipfsHash: session.ipfsHash || null,
      error: session.error || null,
      timestamp: session.timestamp
    });
  }

  if (req.method === 'DELETE') {
    global.sessions.delete(sessionId);
    return res.status(200).json({ success: true });
  }

  return res.status(405).json({ error: 'Method not allowed' });
}

