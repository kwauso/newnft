// セッション状態取得
if (!global.sessions) {
  global.sessions = new Map();
}

export default async function handler(req, res) {
  // CORS設定
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, DELETE, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

  if (req.method === 'OPTIONS') {
    return res.status(200).end();
  }

  const { sessionId } = req.query;
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

