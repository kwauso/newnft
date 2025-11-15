import lighthouse from '@lighthouse-web3/sdk';
import formidable from 'formidable';
import fs from 'fs';

// IPFSにアップロードする関数（サーバーサイドで処理）
async function uploadToIPFS(fileData) {
  try {
    // BufferをUint8Arrayに変換
    const uint8Array = new Uint8Array(fileData);

    const LIGHTHOUSE_API_KEY = process.env.LIGHTHOUSE_API_KEY || '22edd714.6da4dc96320f4909b73d0225b1fca1fe';

    // IPFSにアップロード
    const output = await lighthouse.uploadBuffer(uint8Array, LIGHTHOUSE_API_KEY);
    const hash = output.data.Hash;

    console.log(`IPFS upload successful: ${hash}`);
    return hash;
  } catch (error) {
    console.error('IPFS upload failed:', error);
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

  // セッションIDを取得（Vercelの動的ルートから）
  const sessionId = req.query?.sessionId || 
                    (req.url && req.url.match(/\/sessions\/([^\/]+)/)?.[1]);
  
  if (!sessionId) {
    return res.status(400).json({ error: 'Session ID is required' });
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

    // サーバーサイドでIPFSにアップロード（同期的に処理）
    const ipfsHash = await uploadToIPFS(fileData);

    return res.status(200).json({
      success: true,
      message: 'Image uploaded and IPFS hash generated',
      sessionId,
      ipfsHash,
      imageData: {
        name: file.originalFilename || 'image',
        type: file.mimetype || 'image/jpeg',
        size: file.size || fileData.length,
      }
    });
  } catch (error) {
    console.error('Upload error:', error);
    return res.status(500).json({ error: error.message || 'Upload failed' });
  }
}

