import lighthouse from '@lighthouse-web3/sdk';
import formidable from 'formidable';
import fs from 'fs';

// セッション管理
if (!global.sessions) {
  global.sessions = new Map();
}

// Vercel Functions形式
// export const config は不要（Next.js専用）

// IPFSにアップロードする関数
async function uploadToIPFS(sessionId) {
  const session = global.sessions.get(sessionId);
  if (!session || !session.imageData) {
    throw new Error('Session or image data not found');
  }

  try {
    session.status = 'processing';
    session.error = null;

    // BufferをUint8Arrayに変換
    const buffer = session.imageData.data;
    const uint8Array = new Uint8Array(buffer);

    const LIGHTHOUSE_API_KEY = '22edd714.6da4dc96320f4909b73d0225b1fca1fe';

    // IPFSにアップロード
    const output = await lighthouse.uploadBuffer(uint8Array, LIGHTHOUSE_API_KEY);
    const hash = output.data.Hash;

    // セッションにIPFSハッシュを保存
    session.ipfsHash = hash;
    session.status = 'completed';
    session.timestamp = Date.now();

    console.log(`IPFS upload successful for session ${sessionId}: ${hash}`);
    return hash;
  } catch (error) {
    console.error('IPFS upload failed:', error);
    session.status = 'error';
    session.error = error.message || 'IPFS upload failed';
    throw error;
  }
}

export default async function handler(req, res) {
  // CORS設定
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

  // OPTIONS（プリフライト）
  if (req.method === 'OPTIONS') {
    return res.status(200).end();
  }

  // POST 以外は全部 405
  if (req.method !== 'POST') {
    return res.status(405).json({ error: `Method ${req.method} not allowed` });
  }

  // セッションIDを取得
  const { sessionId } = req.query;
  const session = global.sessions.get(sessionId);

  if (!session) {
    return res.status(404).json({ error: 'Session not found' });
  }

  try {
    // formidableでファイルをパース（Promiseでラップ）
    const form = formidable({
      multiples: false,
      maxFileSize: 10 * 1024 * 1024, // 10MB制限
      keepExtensions: true,
    });

    // form.parseをPromiseでラップ
    const { fields, files } = await new Promise((resolve, reject) => {
      form.parse(req, (err, fields, files) => {
        if (err) {
          reject(err);
        } else {
          resolve({ fields, files });
        }
      });
    });

    const file = Array.isArray(files.image) ? files.image[0] : files.image;

    if (!file) {
      return res.status(400).json({ error: 'No file uploaded' });
    }

    // ファイルを読み込む（formidableは一時ファイルパスを返す）
    let fileData;
    if (file.filepath) {
      // 一時ファイルから読み込む
      fileData = fs.readFileSync(file.filepath);
      // 一時ファイルを削除
      fs.unlinkSync(file.filepath);
    } else if (Buffer.isBuffer(file)) {
      // 既にBufferの場合
      fileData = file;
    } else {
      return res.status(400).json({ error: 'Invalid file data' });
    }

    // 画像データを保存
    session.imageData = {
      name: file.originalFilename || 'image',
      type: file.mimetype || 'image/jpeg',
      size: file.size || fileData.length,
      data: fileData,
    };
    session.status = 'uploaded';
    session.timestamp = Date.now();

    // バックグラウンドでIPFSにアップロード
    uploadToIPFS(sessionId).catch((err) => {
      console.error('IPFS upload error:', err);
      session.status = 'error';
      session.error = err.message;
    });

    return res.status(200).json({
      success: true,
      message: 'Image uploaded successfully',
      sessionId,
    });
  } catch (error) {
    console.error('Upload error:', error);
    return res.status(500).json({ error: error.message || 'Upload failed' });
  }
}

