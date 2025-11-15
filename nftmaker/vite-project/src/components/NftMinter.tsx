import React, { useState, useEffect, useCallback } from 'react';
import { Box, Card, CardContent, Typography, Button, CardHeader, Link, LinearProgress, CircularProgress, TextField, IconButton, Snackbar, Alert } from '@mui/material';
import { QRCodeSVG } from 'qrcode.react';
import ContentCopyIcon from '@mui/icons-material/ContentCopy';
import { ethers } from 'ethers';
import Web3Mint from '../utils/Web3Mint.json';
import lighthouse from '@lighthouse-web3/sdk';

const API_BASE_URL = import.meta.env.VITE_API_BASE_URL || '/api';

declare global {
  interface Window {
    ethereum: any;
  }
}

type SessionStatus = 'waiting' | 'uploaded' | 'processing' | 'completed' | 'error';

interface SessionData {
  sessionId: string;
  status: SessionStatus;
  imageData: {
    name: string;
    type: string;
    size: number;
    data: string; // base64
  } | null;
  timestamp: number;
}

export default function NftMinter() {
  const [currentAccount, setCurrentAccount] = useState('');
  const [sessionId, setSessionId] = useState<string | null>(null);
  const [sessionStatus, setSessionStatus] = useState<SessionStatus>('waiting');
  const [uploadProgress, setUploadProgress] = useState(0);
  const [nftProgress, setNftProgress] = useState(0);
  const [error, setError] = useState<string | null>(null);
  const [mintInfo, setMintInfo] = useState<{ transactionHash: string } | null>(null);
  const [imagePreview, setImagePreview] = useState<string | null>(null);
  const [copySuccess, setCopySuccess] = useState(false);

  // ウォレット接続
  const connectWallet = async () => {
    try {
      const { ethereum } = window as any;
      if (!ethereum) {
        alert('MetaMaskをインストールしてください。');
        return;
      }
      const permissions = await ethereum.request({ method: 'eth_requestAccounts' });
      console.log('Connected', permissions[0]);
      setCurrentAccount(permissions[0]);
      createSession();
    } catch (err) {
      console.error(err);
      setError('ウォレット接続に失敗しました。');
    }
  };

  // セッション作成
  const createSession = async () => {
    try {
      const response = await fetch(`${API_BASE_URL}/sessions`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
      });
      const data = await response.json();
      setSessionId(data.sessionId);
      setSessionStatus('waiting');
      setError(null);
      setMintInfo(null);
      setImagePreview(null);
      setUploadProgress(0);
      setNftProgress(0);
    } catch (err) {
      console.error('Failed to create session:', err);
      setError('セッションの作成に失敗しました。');
    }
  };

  // セッション状態をポーリング
  const checkSessionStatus = useCallback(async () => {
    if (!sessionId) return;

    try {
      const response = await fetch(`${API_BASE_URL}/sessions/${sessionId}`);
      const data: SessionData = await response.json();

      setSessionStatus(data.status);

      if (data.status === 'uploaded' && data.imageData) {
        // 画像プレビューを設定
        const imageUrl = `data:${data.imageData.type};base64,${data.imageData.data}`;
        setImagePreview(imageUrl);
        setUploadProgress(100);
        
        // IPFSアップロードとNFTミントを開始
        processImageToNFT(data.imageData);
      }
    } catch (err) {
      console.error('Failed to check session status:', err);
    }
  }, [sessionId]);

  // ポーリング開始
  useEffect(() => {
    if (!sessionId || sessionStatus === 'completed' || sessionStatus === 'error') {
      return;
    }

    const interval = setInterval(checkSessionStatus, 2000); // 2秒ごとにチェック
    return () => clearInterval(interval);
  }, [sessionId, sessionStatus, checkSessionStatus]);

  // 画像をIPFSにアップロードしてNFTをミント
  const processImageToNFT = async (imageData: { name: string; type: string; data: string }) => {
    try {
      setSessionStatus('processing');
      setNftProgress(10);
      setError('IPFSにアップロード中...');

      const apiKey = '205a00ba.60e15b60d62343c585c55cc893e5d3c9';
      
      // Base64をArrayBufferに変換
      const base64Data = imageData.data;
      const binaryString = atob(base64Data);
      const bytes = new Uint8Array(binaryString.length);
      for (let i = 0; i < binaryString.length; i++) {
        bytes[i] = binaryString.charCodeAt(i);
      }

      setNftProgress(30);

      // IPFSにアップロード
      const output = await lighthouse.uploadBuffer(bytes, apiKey);
      console.log('File Status:', output);
      const hash = output.data.Hash;

      setNftProgress(60);
      setError('NFTをミント中...');

      // NFTをミント
      await askContractToMintNft(hash);

      setNftProgress(100);
      setSessionStatus('completed');
      setError('NFTのミントが完了しました！');
    } catch (error) {
      console.error('Error processing image:', error);
      setSessionStatus('error');
      setError('エラーが発生しました: ' + (error as Error).message);
    }
  };

  // スマートコントラクトでNFTをミント
  const askContractToMintNft = async (ipfs: string) => {
    const CONTRACT_ADDRESS = '0x5B1fb722a9C73799A04db1346988B1459C680dDA';

    try {
      const { ethereum } = window;
      if (ethereum) {
        const provider = new ethers.BrowserProvider(ethereum);
        const signer = await provider.getSigner();
        const connectedContract = new ethers.Contract(
          CONTRACT_ADDRESS,
          Web3Mint.abi,
          signer
        );

        console.log('Going to pop wallet now to pay gas...');

        const nftTxn = await connectedContract.mintIpfsNFT('sample', ipfs);
        console.log('Mining...please wait.');
        await nftTxn.wait();
        console.log(
          `Mined, see transaction: https://sepolia.etherscan.io/tx/${nftTxn.hash}`
        );

        setMintInfo({
          transactionHash: nftTxn.hash,
        });
      } else {
        console.log("Ethereum object doesn't exist!");
      }
    } catch (error) {
      console.log(error);
      throw error;
    }
  };

  // QRコードURLを生成
  const getQRCodeUrl = () => {
    if (!sessionId) return '';
    const baseUrl = window.location.origin;
    return `${baseUrl}/upload/${sessionId}`;
  };

  // URLをクリップボードにコピー
  const copyToClipboard = async () => {
    const url = getQRCodeUrl();
    try {
      await navigator.clipboard.writeText(url);
      setCopySuccess(true);
    } catch (err) {
      console.error('Failed to copy:', err);
      setError('コピーに失敗しました。');
    }
  };

  // ステータスメッセージを取得
  const getStatusMessage = () => {
    switch (sessionStatus) {
      case 'waiting':
        return 'スマホでQRコードをスキャンして画像をアップロードしてください';
      case 'uploaded':
        return '画像を受信しました';
      case 'processing':
        return 'NFTをミント中...';
      case 'completed':
        return 'NFTのミントが完了しました！';
      case 'error':
        return 'エラーが発生しました';
      default:
        return '';
    }
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
      <Card sx={{ width: '100%', maxWidth: '500px', mx: 'auto' }}>
        <CardHeader
          title={
            <Typography variant="h5" align="center" sx={{ fontWeight: 500, color: 'text.primary' }}>
              QRコードでNFTを作成
            </Typography>
          }
        />
        <CardContent>
          {currentAccount === '' ? (
            <Box sx={{ textAlign: 'center', py: 3 }}>
              <Button
                variant="contained"
                color="primary"
                onClick={connectWallet}
                sx={{ mb: 2 }}
              >
                Connect to Wallet
              </Button>
            </Box>
          ) : (
            <>
              {!sessionId ? (
                <Box sx={{ textAlign: 'center', py: 3 }}>
                  <Button variant="contained" color="primary" onClick={createSession}>
                    新しいセッションを開始
                  </Button>
                </Box>
              ) : (
                <>
                  {/* QRコード表示 */}
                  <Box sx={{ display: 'flex', flexDirection: 'column', alignItems: 'center', mb: 3 }}>
                    <Box
                      sx={{
                        p: 2,
                        bgcolor: 'white',
                        borderRadius: 2,
                        mb: 2,
                      }}
                    >
                      <QRCodeSVG value={getQRCodeUrl()} size={256} />
                    </Box>
                    <Typography variant="body2" color="text.secondary" align="center" sx={{ mb: 2 }}>
                      {getStatusMessage()}
                    </Typography>
                    
                    {/* URL表示とコピーボタン（スマホなしでも動作確認できるように） */}
                    <Box sx={{ width: '100%', maxWidth: '400px' }}>
                      <Typography variant="caption" color="text.secondary" sx={{ mb: 1, display: 'block' }}>
                        スマホがない場合: 以下のURLを別のブラウザタブで開いてください
                      </Typography>
                      <Box sx={{ display: 'flex', gap: 1, alignItems: 'center' }}>
                        <TextField
                          fullWidth
                          size="small"
                          value={getQRCodeUrl()}
                          InputProps={{
                            readOnly: true,
                          }}
                          sx={{
                            '& .MuiInputBase-input': {
                              fontSize: '0.75rem',
                            },
                          }}
                        />
                        <IconButton
                          onClick={copyToClipboard}
                          color="primary"
                          sx={{ flexShrink: 0 }}
                        >
                          <ContentCopyIcon />
                        </IconButton>
                      </Box>
                      <Button
                        variant="outlined"
                        size="small"
                        fullWidth
                        onClick={() => window.open(getQRCodeUrl(), '_blank')}
                        sx={{ mt: 1 }}
                      >
                        新しいタブで開く
                      </Button>
                    </Box>
                  </Box>

                  {/* 画像プレビュー */}
                  {imagePreview && (
                    <Box sx={{ mb: 2, textAlign: 'center' }}>
                      <Box
                        component="img"
                        src={imagePreview}
                        alt="アップロードされた画像"
                        sx={{
                          maxWidth: '100%',
                          maxHeight: '300px',
                          borderRadius: 1,
                          border: '1px solid',
                          borderColor: 'grey.300',
                        }}
                      />
                    </Box>
                  )}

                  {/* 進捗バー */}
                  {(sessionStatus === 'uploaded' || sessionStatus === 'processing') && (
                    <Box sx={{ mb: 2 }}>
                      <Typography variant="body2" color="text.secondary" sx={{ mb: 1 }}>
                        アップロード進捗: {uploadProgress}%
                      </Typography>
                      <LinearProgress variant="determinate" value={uploadProgress} sx={{ mb: 2 }} />
                      <Typography variant="body2" color="text.secondary" sx={{ mb: 1 }}>
                        NFTミント進捗: {nftProgress}%
                      </Typography>
                      <LinearProgress variant="determinate" value={nftProgress} />
                    </Box>
                  )}

                  {/* エラーメッセージ */}
                  {error && (
                    <Typography
                      variant="caption"
                      color={sessionStatus === 'error' ? 'error' : 'text.secondary'}
                      sx={{ mt: 1, display: 'block', textAlign: 'center' }}
                    >
                      {error}
                    </Typography>
                  )}

                  {/* ミント完了情報 */}
                  {mintInfo && (
                    <Box sx={{ mt: 2, p: 2, bgcolor: 'success.light', borderRadius: 1 }}>
                      <Typography variant="subtitle2" color="success.dark" gutterBottom>
                        NFTのミントが完了しました！
                      </Typography>
                      <Typography variant="body2" color="text.secondary">
                        トランザクションハッシュ:
                        <Link
                          href={`https://sepolia.etherscan.io/tx/${mintInfo.transactionHash}`}
                          target="_blank"
                          rel="noopener noreferrer"
                          sx={{ ml: 1 }}
                        >
                          Etherscanで確認
                        </Link>
                      </Typography>
                    </Box>
                  )}

                  {/* 新しいセッション開始ボタン */}
                  {(sessionStatus === 'completed' || sessionStatus === 'error') && (
                    <Box sx={{ mt: 2, textAlign: 'center' }}>
                      <Button variant="outlined" color="primary" onClick={createSession}>
                        新しいNFTを作成
                      </Button>
                    </Box>
                  )}
                </>
              )}
            </>
          )}
        </CardContent>
      </Card>
      
      {/* コピー成功通知 */}
      <Snackbar
        open={copySuccess}
        autoHideDuration={2000}
        onClose={() => setCopySuccess(false)}
        anchorOrigin={{ vertical: 'bottom', horizontal: 'center' }}
      >
        <Alert onClose={() => setCopySuccess(false)} severity="success" sx={{ width: '100%' }}>
          URLをクリップボードにコピーしました！
        </Alert>
      </Snackbar>
    </Box>
  );
}

