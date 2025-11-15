import express from 'express';
import cors from 'cors';
import multer from 'multer';
import { v4 as uuidv4 } from 'uuid';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const app = express();
const PORT = 3001;

// セッション管理（メモリ内）
const sessions = new Map(); // sessionId -> { imageData, timestamp, status }

// CORS設定
app.use(cors());
app.use(express.json());

// Multer設定（メモリストレージ）
const upload = multer({ 
  storage: multer.memoryStorage(),
  limits: { fileSize: 10 * 1024 * 1024 } // 10MB制限
});

// セッション作成
app.post('/api/sessions', (req, res) => {
  const sessionId = uuidv4();
  sessions.set(sessionId, {
    imageData: null,
    timestamp: Date.now(),
    status: 'waiting' // waiting, uploaded, processing, completed, error
  });
  res.json({ sessionId });
});

// セッション状態取得
app.get('/api/sessions/:sessionId', (req, res) => {
  const { sessionId } = req.params;
  const session = sessions.get(sessionId);
  
  if (!session) {
    return res.status(404).json({ error: 'Session not found' });
  }
  
  res.json({
    sessionId,
    status: session.status,
    imageData: session.imageData ? {
      name: session.imageData.name,
      type: session.imageData.type,
      size: session.imageData.size,
      data: session.imageData.data.toString('base64')
    } : null,
    timestamp: session.timestamp
  });
});

// 画像アップロード（スマホ側から）
app.post('/api/sessions/:sessionId/upload', upload.single('image'), (req, res) => {
  const { sessionId } = req.params;
  const session = sessions.get(sessionId);
  
  if (!session) {
    return res.status(404).json({ error: 'Session not found' });
  }
  
  if (!req.file) {
    return res.status(400).json({ error: 'No file uploaded' });
  }
  
  // 画像データを保存
  session.imageData = {
    name: req.file.originalname,
    type: req.file.mimetype,
    size: req.file.size,
    data: req.file.buffer
  };
  session.status = 'uploaded';
  session.timestamp = Date.now();
  
  res.json({ 
    success: true, 
    message: 'Image uploaded successfully',
    sessionId 
  });
});

// セッション削除
app.delete('/api/sessions/:sessionId', (req, res) => {
  const { sessionId } = req.params;
  sessions.delete(sessionId);
  res.json({ success: true });
});

// 古いセッションのクリーンアップ（1時間以上経過したセッションを削除）
setInterval(() => {
  const now = Date.now();
  for (const [sessionId, session] of sessions.entries()) {
    if (now - session.timestamp > 3600000) { // 1時間
      sessions.delete(sessionId);
    }
  }
}, 600000); // 10分ごとにチェック

app.listen(PORT, () => {
  console.log(`Server running on http://localhost:${PORT}`);
});

