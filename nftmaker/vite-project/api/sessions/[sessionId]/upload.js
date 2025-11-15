import lighthouse from '@lighthouse-web3/sdk';

// セッション管理
if (!global.sessions) {
  global.sessions = new Map();
}

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

    const LIGHTHOUSE_API_KEY = process.env.LIGHTHOUSE_API_KEY || '22edd714.6da4dc96320f4909b73d0225b1fca1fe';

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
  // デバッグ: リクエスト情報をログに出力
  console.log('Request method:', req.method);
  console.log('Request URL:', req.url);
  console.log('Request headers:', req.headers);

  // CORS設定
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

  // OPTIONSリクエスト（CORSプリフライト）の処理
  if (req.method === 'OPTIONS' || req.method === 'options') {
    return res.status(200).end();
  }

  // POSTメソッドのチェック（大文字小文字を考慮）
  const method = req.method?.toUpperCase();
  if (method !== 'POST') {
    console.log('Method not allowed:', method);
    return res.status(405).json({ error: `Method not allowed: ${method}. Expected POST.` });
  }

  // セッションIDを取得（Vercelではreq.queryから取得）
  const sessionId = req.query?.sessionId || req.query?.['sessionId'];
  const session = global.sessions.get(sessionId);

  if (!session) {
    return res.status(404).json({ error: 'Session not found' });
  }

  try {
    // リクエストボディをバッファとして読み込む
    // Vercelのサーバーレス関数では、reqはReadableStreamまたはBuffer
    let buffer;
    if (Buffer.isBuffer(req.body)) {
      buffer = req.body;
    } else if (req.body) {
      buffer = Buffer.from(req.body);
    } else {
      // ストリームから読み込む
      const chunks = [];
      for await (const chunk of req) {
        chunks.push(chunk);
      }
      buffer = Buffer.concat(chunks);
    }

    // multipart/form-dataをパース（簡易版）
    // 実際のプロダクションでは、busboyやformidableなどのライブラリを使用
    const boundary = req.headers['content-type']?.split('boundary=')[1];
    if (!boundary) {
      return res.status(400).json({ error: 'Invalid content type' });
    }

    // 簡易的なmultipartパーサー
    const parts = buffer.toString('binary').split(`--${boundary}`);
    let fileData = null;
    let fileName = 'image';
    let fileType = 'image/jpeg';

    for (const part of parts) {
      if (part.includes('Content-Disposition: form-data')) {
        const headerEnd = part.indexOf('\r\n\r\n');
        const headers = part.substring(0, headerEnd);
        const body = part.substring(headerEnd + 4);
        
        if (headers.includes('name="image"')) {
          // ファイル名を抽出
          const nameMatch = headers.match(/filename="([^"]+)"/);
          if (nameMatch) {
            fileName = nameMatch[1];
          }
          
          // Content-Typeを抽出
          const typeMatch = headers.match(/Content-Type: ([^\r\n]+)/);
          if (typeMatch) {
            fileType = typeMatch[1].trim();
          }
          
          // ファイルデータを抽出（末尾の改行を削除）
          const dataEnd = body.lastIndexOf('\r\n');
          fileData = Buffer.from(body.substring(0, dataEnd), 'binary');
          break;
        }
      }
    }

    if (!fileData) {
      return res.status(400).json({ error: 'No file uploaded' });
    }

    // ファイルサイズチェック
    if (fileData.length > 10 * 1024 * 1024) {
      return res.status(400).json({ error: 'File too large (max 10MB)' });
    }

    // 画像データを保存
    session.imageData = {
      name: fileName,
      type: fileType,
      size: fileData.length,
      data: fileData
    };
    session.status = 'uploaded';
    session.timestamp = Date.now();

    // バックグラウンドでIPFSにアップロード
    uploadToIPFS(sessionId).catch(err => {
      console.error('IPFS upload error:', err);
      session.status = 'error';
      session.error = err.message;
    });

    return res.status(200).json({
      success: true,
      message: 'Image uploaded successfully',
      sessionId
    });
  } catch (error) {
    console.error('Upload error:', error);
    return res.status(500).json({ error: error.message || 'Upload failed' });
  }
}

