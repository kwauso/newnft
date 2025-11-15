import { useState, useEffect, useRef } from 'react';
import { Box, Card, CardContent, Typography, Button, CardHeader, Link, LinearProgress, TextField, IconButton, Snackbar, Alert, Dialog, DialogTitle, DialogContent, DialogActions } from '@mui/material';
import { QRCodeSVG } from 'qrcode.react';
import ContentCopyIcon from '@mui/icons-material/ContentCopy';
import QrCodeScannerIcon from '@mui/icons-material/QrCodeScanner';
import { Html5Qrcode } from 'html5-qrcode';
import { ethers } from 'ethers';
import Web3Mint from '../utils/Web3Mint.json';

const API_BASE_URL = import.meta.env.VITE_API_BASE_URL || '/api';

declare global {
  interface Window {
    ethereum: any;
  }
}

type SessionStatus = 'waiting' | 'uploaded' | 'processing' | 'completed' | 'error';

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
  const [isMinting, setIsMinting] = useState(false);
  const [ipfsHash, setIpfsHash] = useState<string | null>(null);
  const [scanning, setScanning] = useState(false);
  const qrCodeReaderRef = useRef<Html5Qrcode | null>(null);
  const qrReaderElementRef = useRef<HTMLDivElement | null>(null);

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

  // アップロード成功をリッスンする（localStorageからIPFSハッシュを受け取る）
  useEffect(() => {
    if (!sessionId) return;

    const checkUploadStatus = () => {
      const uploadDataStr = localStorage.getItem(`upload_${sessionId}`);
      if (uploadDataStr) {
        try {
          const uploadData = JSON.parse(uploadDataStr);
          if (uploadData.type === 'UPLOAD_SUCCESS' && uploadData.sessionId === sessionId) {
            const { ipfsHash: hash } = uploadData;
            if (hash) {
              setIpfsHash(hash);
              setUploadProgress(100);
              setError('画像がアップロードされました。ミントボタンを押してください。');
            }
          }
        } catch (e) {
          console.error('Failed to parse upload data:', e);
        }
      }
    };

    // 初回チェック
    checkUploadStatus();

    // storageイベントをリッスン（別タブ/ウィンドウからの変更も検知）
    const handleStorageChange = (e: StorageEvent) => {
      if (e.key === `upload_${sessionId}` && e.newValue) {
        checkUploadStatus();
      }
    };

    // カスタムイベントをリッスン（同じウィンドウ内の変更も検知）
    const handleCustomStorage = () => {
      checkUploadStatus();
    };

    window.addEventListener('storage', handleStorageChange);
    window.addEventListener('upload-success', handleCustomStorage);

    // 定期的にチェック（フォールバック）
    const interval = setInterval(checkUploadStatus, 1000);

    return () => {
      window.removeEventListener('storage', handleStorageChange);
      window.removeEventListener('upload-success', handleCustomStorage);
      clearInterval(interval);
    };
  }, [sessionId]);

  // QRコードスキャンの開始
  const startQRScan = () => {
    setScanning(true);
  };

  // ダイアログが開いた後にカメラを起動
  useEffect(() => {
    if (!scanning) {
      // スキャン停止時にクリーンアップ
      if (qrCodeReaderRef.current) {
        qrCodeReaderRef.current.stop().catch(() => {});
        qrCodeReaderRef.current = null;
      }
      // DOMをクリーンアップ
      if (qrReaderElementRef.current) {
        qrReaderElementRef.current.innerHTML = '';
      }
      return;
    }

    let isMounted = true;
    let html5QrCodeInstance: Html5Qrcode | null = null;

    const startCamera = async () => {
      // ダイアログが開いてDOMがマウントされるまで少し待つ
      await new Promise(resolve => setTimeout(resolve, 500));

      if (!isMounted) return;

      const element = qrReaderElementRef.current;
      if (!element) {
        console.error('QR reader element not found');
        if (isMounted) {
          setScanning(false);
          setError('QRリーダー要素が見つかりませんでした。');
        }
        return;
      }

      // 既存のインスタンスがあればクリーンアップ
      if (qrCodeReaderRef.current) {
        try {
          await qrCodeReaderRef.current.stop();
        } catch (e) {
          // 無視
        }
        qrCodeReaderRef.current = null;
      }

      // 要素をクリーンアップ
      element.innerHTML = '';

      try {
        // 一意のIDを生成
        const elementId = `qr-reader-${Date.now()}`;
        element.id = elementId;

        html5QrCodeInstance = new Html5Qrcode(elementId);
        qrCodeReaderRef.current = html5QrCodeInstance;

        await html5QrCodeInstance.start(
          { facingMode: 'environment' },
          {
            fps: 10,
            qrbox: { width: 250, height: 250 },
            aspectRatio: 1.0,
          },
          async (decodedText) => {
            // QRコードを検出
            if (!isMounted || !html5QrCodeInstance) return;
            
            console.log('QR Code detected:', decodedText);
            
            // 先にカメラを停止
            try {
              await html5QrCodeInstance.stop();
              html5QrCodeInstance = null;
              qrCodeReaderRef.current = null;
            } catch (stopErr) {
              console.error('Stop camera error:', stopErr);
            }
            
            // その後、状態を更新
            if (isMounted) {
              setIpfsHash(decodedText);
              setScanning(false);
              setError(null);
            }
          },
          (_errorMessage) => {
            // エラーは無視（継続的にスキャンするため）
          }
        );
      } catch (err) {
        console.error('QR scan error:', err);
        if (isMounted) {
          setError('QRコードスキャンの開始に失敗しました: ' + (err as Error).message);
          setScanning(false);
        }
        html5QrCodeInstance = null;
        qrCodeReaderRef.current = null;
      }
    };

    startCamera();

    return () => {
      isMounted = false;
      if (html5QrCodeInstance) {
        html5QrCodeInstance.stop().catch(() => {});
        html5QrCodeInstance = null;
      }
      if (qrCodeReaderRef.current) {
        qrCodeReaderRef.current.stop().catch(() => {});
        qrCodeReaderRef.current = null;
      }
      if (qrReaderElementRef.current) {
        qrReaderElementRef.current.innerHTML = '';
      }
    };
  }, [scanning]);

  // QRコードスキャンの停止
  const stopQRScan = async () => {
    if (qrCodeReaderRef.current) {
      try {
        await qrCodeReaderRef.current.stop();
      } catch (err) {
        console.error('Stop scan error:', err);
      }
      qrCodeReaderRef.current = null;
    }
    if (qrReaderElementRef.current) {
      qrReaderElementRef.current.innerHTML = '';
    }
    setScanning(false);
  };


  // ミントボタンのハンドラー
  const handleMint = async () => {
    if (!ipfsHash) {
      setError('IPFSハッシュが見つかりません。画像をアップロードしてください。');
      return;
    }

    if (isMinting) {
      return;
    }

    setIsMinting(true);
    setNftProgress(60);
    setError('NFTをミント中...');

    try {
      await askContractToMintNft(ipfsHash);
      setNftProgress(100);
      setError('NFTのミントが完了しました！');
      // 使用済みのデータを削除
      if (sessionId) {
        localStorage.removeItem(`upload_${sessionId}`);
      }
      setIpfsHash(null);
    } catch (error) {
      console.error('Mint error:', error);
      setError('NFTのミントに失敗しました: ' + (error as Error).message);
    } finally {
      setIsMinting(false);
    }
  };

  // ポーリングは不要（アップロード成功時にメッセージで通知される）


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
                  {uploadProgress > 0 && (
                    <Box sx={{ mb: 2 }}>
                      <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 1 }}>
                        <Typography variant="body2" color="text.secondary" sx={{ fontWeight: 500 }}>
                          アップロード進捗
                        </Typography>
                        <Typography variant="body2" color="primary.main" sx={{ fontWeight: 600 }}>
                          {uploadProgress}%
                        </Typography>
                      </Box>
                      <LinearProgress 
                        variant="determinate" 
                        value={uploadProgress}
                        sx={{
                          height: 8,
                          borderRadius: 4,
                          backgroundColor: 'grey.200',
                          '& .MuiLinearProgress-bar': {
                            borderRadius: 4,
                            background: 'linear-gradient(90deg, #1976d2 0%, #42a5f5 100%)',
                          },
                        }}
                      />
                    </Box>
                  )}

                  {/* QRコードスキャンボタン */}
                  <Box sx={{ mb: 2, textAlign: 'center' }}>
                    <Button
                      variant="outlined"
                      color="primary"
                      startIcon={<QrCodeScannerIcon />}
                      onClick={scanning ? stopQRScan : startQRScan}
                      sx={{ mb: 2 }}
                      fullWidth
                    >
                      {scanning ? 'スキャンを停止' : 'QRコードをスキャン'}
                    </Button>
                  </Box>

                  {/* QRコードスキャンダイアログ */}
                  <Dialog open={scanning} onClose={stopQRScan} maxWidth="sm" fullWidth>
                    <DialogTitle>QRコードをスキャン</DialogTitle>
                    <DialogContent>
                      <Box 
                        ref={qrReaderElementRef}
                        sx={{ 
                          width: '100%', 
                          minHeight: '300px',
                          display: 'flex',
                          justifyContent: 'center',
                          alignItems: 'center',
                          bgcolor: 'black'
                        }} 
                      />
                      <Typography variant="body2" color="text.secondary" sx={{ mt: 2, textAlign: 'center' }}>
                        モバイル側で表示されたQRコードをカメラに向けてください
                      </Typography>
                    </DialogContent>
                    <DialogActions>
                      <Button onClick={stopQRScan}>閉じる</Button>
                    </DialogActions>
                  </Dialog>

                  {/* ミントボタン（IPFSハッシュがある場合のみ表示） */}
                  {ipfsHash && (
                    <Box sx={{ mb: 2, textAlign: 'center' }}>
                      <Typography variant="body2" color="text.secondary" sx={{ mb: 1, wordBreak: 'break-all' }}>
                        IPFS Hash: {ipfsHash}
                      </Typography>
                      <Button
                        variant="contained"
                        color="primary"
                        onClick={handleMint}
                        disabled={isMinting || !!mintInfo}
                        sx={{ mb: 2 }}
                        fullWidth
                      >
                        {isMinting ? 'ミント中...' : mintInfo ? 'ミント完了' : 'NFTをミント'}
                      </Button>
                      {nftProgress > 0 && (
                        <Box sx={{ mt: 2 }}>
                          <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 1 }}>
                            <Typography variant="body2" color="text.secondary" sx={{ fontWeight: 500 }}>
                              NFTミント進捗
                            </Typography>
                            <Typography variant="body2" color="primary.main" sx={{ fontWeight: 600 }}>
                              {nftProgress}%
                            </Typography>
                          </Box>
                          <LinearProgress 
                            variant="determinate" 
                            value={nftProgress}
                            sx={{
                              height: 8,
                              borderRadius: 4,
                              backgroundColor: 'grey.200',
                              '& .MuiLinearProgress-bar': {
                                borderRadius: 4,
                                background: 'linear-gradient(90deg, #1976d2 0%, #42a5f5 100%)',
                              },
                            }}
                          />
                        </Box>
                      )}
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
                    <Box 
                      sx={{ 
                        mt: 2, 
                        p: 2, 
                        border: '1px solid',
                        borderColor: 'divider',
                        borderRadius: 2,
                        bgcolor: 'background.paper',
                      }}
                    >
                      <Typography variant="subtitle2" color="text.primary" gutterBottom sx={{ fontWeight: 600 }}>
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

