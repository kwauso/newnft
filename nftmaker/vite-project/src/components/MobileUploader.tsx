import React, { useState, useEffect } from 'react';
import { useParams } from 'react-router-dom';
import {
  Box,
  Card,
  CardContent,
  Typography,
  Button,
  CardHeader,
  LinearProgress,
} from '@mui/material';
import ImageIcon from '@mui/icons-material/Image';
import CheckCircleIcon from '@mui/icons-material/CheckCircle';

const API_BASE_URL = import.meta.env.VITE_API_BASE_URL || '/api';

export default function MobileUploader() {
  const { sessionId } = useParams<{ sessionId: string }>();
  const [file, setFile] = useState<File | null>(null);
  const [preview, setPreview] = useState<string | null>(null);
  const [uploading, setUploading] = useState(false);
  const [uploadProgress, setUploadProgress] = useState(0);
  const [uploaded, setUploaded] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const fileInputRef = React.useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (!sessionId) {
      setError('セッションIDが無効です。');
    }
  }, [sessionId]);

  const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files.length > 0) {
      const selectedFile = e.target.files[0];

      // ファイルタイプのチェック
      if (!selectedFile.type.startsWith('image/')) {
        setError('画像ファイルのみアップロード可能です。');
        return;
      }

      // ファイルサイズのチェック（10MB制限）
      if (selectedFile.size > 10 * 1024 * 1024) {
        setError('ファイルサイズが大きすぎます。10MB以下のファイルを選択してください。');
        return;
      }

      setFile(selectedFile);
      setError(null);

      // プレビュー画像を生成
      const reader = new FileReader();
      reader.onload = () => {
        setPreview(reader.result as string);
      };
      reader.readAsDataURL(selectedFile);
    }
  };

  const handleUpload = async () => {
    if (!file || !sessionId) {
      setError('ファイルを選択してください。');
      return;
    }

    setUploading(true);
    setUploadProgress(0);
    setError(null);

    try {
      const formData = new FormData();
      formData.append('image', file);

      // XMLHttpRequestを使用して進捗を追跡
      const xhr = new XMLHttpRequest();

      xhr.upload.addEventListener('progress', (e) => {
        if (e.lengthComputable) {
          const percentComplete = Math.round((e.loaded / e.total) * 100);
          setUploadProgress(percentComplete);
        }
      });

      xhr.addEventListener('load', () => {
        if (xhr.status === 200) {
          try {
            const response = JSON.parse(xhr.responseText);
            setUploaded(true);
            setUploadProgress(100);
            // アップロード成功時にIPFSハッシュをlocalStorageに保存
            if (response.ipfsHash) {
              const uploadData = {
                type: 'UPLOAD_SUCCESS',
                sessionId: response.sessionId,
                ipfsHash: response.ipfsHash,
                imageData: response.imageData,
                timestamp: Date.now()
              };
              localStorage.setItem(`upload_${response.sessionId}`, JSON.stringify(uploadData));
              // カスタムイベントを発火（同じウィンドウ内でも動作するように）
              window.dispatchEvent(new CustomEvent('upload-success', { detail: uploadData }));
            }
          } catch (e) {
            console.error('Failed to parse upload response:', e);
            setError('アップロードレスポンスの解析に失敗しました。');
          }
        } else {
          let errorMessage = 'アップロードに失敗しました。';
          try {
            const response = JSON.parse(xhr.responseText);
            errorMessage = response.error || errorMessage;
            console.error('Upload error response:', response);
          } catch (e) {
            console.error('Upload error status:', xhr.status);
            console.error('Upload error response:', xhr.responseText);
          }
          setError(errorMessage);
        }
        setUploading(false);
      });

      xhr.addEventListener('error', () => {
        setError('アップロード中にエラーが発生しました。');
        setUploading(false);
      });

      xhr.open('POST', `${API_BASE_URL}/sessions/${sessionId}/upload`);
      xhr.send(formData);
    } catch (err) {
      console.error('Upload error:', err);
      setError('アップロードに失敗しました: ' + (err as Error).message);
      setUploading(false);
    }
  };

  const handleButtonClick = () => {
    fileInputRef.current?.click();
  };

  return (
    <Box
      sx={{
        minHeight: '100vh',
        width: '100vw',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        bgcolor: 'grey.50',
        p: 2,
      }}
    >
      <Card sx={{ width: '100%', maxWidth: '400px', mx: 'auto' }}>
        <CardHeader
          title={
            <Typography variant="h5" align="center" sx={{ fontWeight: 500, color: 'text.primary' }}>
              画像をアップロード
            </Typography>
          }
        />
        <CardContent>
          {uploaded ? (
            <Box sx={{ textAlign: 'center', py: 3 }}>
              <CheckCircleIcon sx={{ fontSize: 64, color: 'success.main', mb: 2 }} />
              <Typography variant="h6" color="success.main" gutterBottom>
                アップロード完了！
              </Typography>
              <Typography variant="body2" color="text.secondary">
                パソコン側でNFTのミントが開始されます。
              </Typography>
            </Box>
          ) : (
            <>
              {/* プレビュー表示エリア */}
              <Box
                onClick={handleButtonClick}
                sx={{
                  border: '2px dashed',
                  borderColor: 'grey.300',
                  borderRadius: 2,
                  p: 3,
                  textAlign: 'center',
                  cursor: 'pointer',
                  mb: 2,
                  bgcolor: 'white',
                  '&:hover': {
                    borderColor: 'primary.main',
                    bgcolor: 'action.hover',
                  },
                }}
              >
                {preview ? (
                  <Box
                    component="img"
                    src={preview}
                    alt="プレビュー"
                    sx={{
                      maxWidth: '100%',
                      maxHeight: '200px',
                      borderRadius: 1,
                      mb: 2,
                    }}
                  />
                ) : (
                  <Box
                    sx={{
                      width: '80px',
                      height: '80px',
                      mx: 'auto',
                      mb: 2,
                      bgcolor: 'grey.100',
                      borderRadius: 1,
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                    }}
                  >
                    <ImageIcon sx={{ width: '40px', height: '40px', color: 'grey.400' }} />
                  </Box>
                )}
                <Typography variant="body2" color="text.secondary">
                  {file ? file.name : 'タップして画像を選択'}
                </Typography>
                {file && (
                  <Typography variant="caption" color="text.disabled">
                    {(file.size / 1024 / 1024).toFixed(2)} MB
                  </Typography>
                )}
              </Box>

              <input
                type="file"
                ref={fileInputRef}
                onChange={handleFileSelect}
                style={{ display: 'none' }}
                accept="image/*"
              />

              {/* アップロードボタン */}
              {file && !uploading && (
                <Button
                  variant="contained"
                  color="primary"
                  fullWidth
                  onClick={handleUpload}
                  sx={{ mb: 2 }}
                >
                  アップロード
                </Button>
              )}

              {/* 進捗バー */}
              {uploading && (
                <Box sx={{ mb: 2 }}>
                  <Typography variant="body2" color="text.secondary" sx={{ mb: 1 }}>
                    アップロード中: {uploadProgress}%
                  </Typography>
                  <LinearProgress variant="determinate" value={uploadProgress} />
                </Box>
              )}

              {/* エラーメッセージ */}
              {error && (
                <Typography
                  variant="caption"
                  color="error"
                  sx={{ mt: 1, display: 'block', textAlign: 'center' }}
                >
                  {error}
                </Typography>
              )}
            </>
          )}
        </CardContent>
      </Card>
    </Box>
  );
}

