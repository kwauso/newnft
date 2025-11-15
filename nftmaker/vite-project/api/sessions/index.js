import { v4 as uuidv4 } from 'uuid';

export default async function handler(req, res) {
  // CORS設定
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

  if (req.method === 'OPTIONS') {
    return res.status(200).end();
  }

  if (req.method === 'POST') {
    // セッションIDのみを生成（サーバー側でセッションデータを保持しない）
    const sessionId = uuidv4();
    
    return res.status(200).json({ sessionId });
  }

  return res.status(405).json({ error: 'Method not allowed' });
}

