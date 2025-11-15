"use client"
import type React from "react"
import { useState, useRef, useEffect } from "react"
import { Box, Card, CardContent, Typography, Button, CardHeader, Link } from "@mui/material"
import { styled } from "@mui/material/styles"
import ImageIcon from "@mui/icons-material/Image"
import { ethers } from "ethers"
import Web3Mint from "../utils/Web3Mint.json"
import lighthouse from "@lighthouse-web3/sdk";


/**
 * This function allows you to upload a buffer or a stream directly to Lighthouse.
 * 
 * @param {string} buffer - Your data in the form of a buffer or stream.
 * @param {string} apiKey - Your personal API key for Lighthouse.
 * 
 * @return {object} - Returns details about the uploaded data.
*/


// window.ethereumの型定義
declare global {
  interface Window {
    ethereum: any;
  }
}


// ドラッグエリアのスタイル付きコンポーネント
const DropArea = styled(Box, {
  shouldForwardProp: (prop) => prop !== "isDragging",
})<{ isDragging: boolean }>(({ theme, isDragging }) => ({
  border: `2px dashed ${isDragging ? theme.palette.primary.main : theme.palette.grey[300]}`,
  borderRadius: theme.shape.borderRadius,
  padding: theme.spacing(3),
  display: "flex",
  flexDirection: "column",
  alignItems: "center",
  justifyContent: "center",
  cursor: "pointer",
  transition: "all 0.2s ease",
  backgroundColor: isDragging ? theme.palette.primary.light + "20" : "transparent",
}))


export interface FileUploaderProps {
  onFileSelect?: (file: File) => void
  title?: string
  acceptedFileTypes?: string
  maxFileSizeMB?: number
  buttonText?: string
  dropzoneText?: string
}


export default function FileUploader({
  onFileSelect,
  title = "NFTアップローダー",
  acceptedFileTypes = "image/*",
  maxFileSizeMB = 10,
  buttonText = "ファイルを選択",
  dropzoneText = "ここにドラッグ＆ドロップしてね",
}: FileUploaderProps) {
  const [file, setFile] = useState<File | null>(null)
  const [preview, setPreview] = useState<string | null>(null)
  const [isDragging, setIsDragging] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [currentAccount, setCurrentAccount] = useState("")
  const [mintInfo, setMintInfo] = useState<{
    transactionHash: string;
  } | null>(null)
  const fileInputRef = useRef<HTMLInputElement>(null)


  const imageToNFT = async (e: React.ChangeEvent<HTMLInputElement>) => {
    try {
      if (!e.target.files || e.target.files.length === 0) {
        return;
      }


      const file = e.target.files[0];
      
      // ファイルのバリデーション
      if (!file.type.startsWith('image/')) {
        setError('画像ファイルのみアップロード可能です。');
        return;
      }


      // アップロード中の状態を表示
      setError('IPFSにアップロード中...');


      const progressCallback = (progressData: any) => {
        if (progressData && progressData.total) {
          const percentageDone = Math.round((progressData.uploaded / progressData.total) * 100);
          console.log('Upload Progress:', percentageDone + '%');
        }
      }

      // ファイルをArrayBufferに変換
      const arrayBuffer = await file.arrayBuffer();
      //const uint8Array = new Uint8Array(arrayBuffer);


      // IPFSにアップロード
      const output = await lighthouse.uploadBuffer(
        arrayBuffer,
        "205a00ba.60e15b60d62343c585c55cc893e5d3c9"
      )
      console.log('File Status:', output)
      const hash = output.data.Hash


      console.log('IPFS Hash:', hash)
      setError('NFTをミント中...');


      // NFTをミント
      await askContractToMintNft(hash);
      
      setError('NFTのミントが完了しました！');
    } catch (error) {
      console.error('Error uploading to IPFS:', error)
      setError('エラーが発生しました: ' + (error as Error).message)
    }
  }


  const connectWallet = async () => {
    try {
      const { ethereum } = window as any;
      if (!ethereum) {
        alert("Connect your MetaMask account.");
        return;
      }
      const permissions = await ethereum.request({ method: 'eth_requestAccounts' });
      console.log("Connected", permissions[0]);
      setCurrentAccount(permissions[0]);
    } catch (err) {
      console.error(err);
    }
  };


  const askContractToMintNft = async (ipfs: string) => {
    const CONTRACT_ADDRESS = "0x5B1fb722a9C73799A04db1346988B1459C680dDA"


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


        console.log("Going to pop wallet now to pay gas...");


        let nftTxn = await connectedContract.mintIpfsNFT("sample", ipfs);
        console.log("Mining...please wait.");
        const receipt = await nftTxn.wait();
        console.log(
          `Mined, see transaction: https://sepolia.etherscan.io/tx/${nftTxn.hash}`
        );


        // ミント情報を保存
        setMintInfo({
          transactionHash: nftTxn.hash
        });
      } else {
        console.log("Ethereum object doesn't exist!");
      }
    } catch (error) {
      console.log(error);
      throw error;
    }
  }


  const validateFile = (selectedFile: File): boolean => {
    // ファイルタイプのチェック
    if (acceptedFileTypes && !selectedFile.type.match(acceptedFileTypes.replace(/\*/g, ".*"))) {
      setError(`対応していないファイル形式です。${acceptedFileTypes}のファイルを選択してください。`)
      return false
    }


    // ファイルサイズのチェック
    if (maxFileSizeMB && selectedFile.size > maxFileSizeMB * 1024 * 1024) {
      setError(`ファイルサイズが大きすぎます。${maxFileSizeMB}MB以下のファイルを選択してください。`)
      return false
    }


    setError(null)
    return true
  }


  const handleDragOver = (e: React.DragEvent<HTMLDivElement>) => {
    e.preventDefault()
    setIsDragging(true)
  }


  const handleDragLeave = (e: React.DragEvent<HTMLDivElement>) => {
    e.preventDefault()
    setIsDragging(false)
  }


  const handleDrop = (e: React.DragEvent<HTMLDivElement>) => {
    e.preventDefault()
    setIsDragging(false)


    if (e.dataTransfer.files && e.dataTransfer.files.length > 0) {
      const droppedFile = e.dataTransfer.files[0]


      if (validateFile(droppedFile)) {
        setFile(droppedFile)


        // プレビュー画像を生成
        if (droppedFile.type.startsWith("image/")) {
          const reader = new FileReader()
          reader.onload = () => {
            setPreview(reader.result as string)
          }
          reader.readAsDataURL(droppedFile)
        }


        // ドラッグ&ドロップされたファイルをIPFSにアップロード
        const fakeEvent = {
          target: {
            files: e.dataTransfer.files
          }
        } as React.ChangeEvent<HTMLInputElement>
        imageToNFT(fakeEvent)


        // 親コンポーネントに選択されたファイルを通知
        if (onFileSelect) {
          onFileSelect(droppedFile)
        }
      }
    }
  }


  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files.length > 0) {
      const selectedFile = e.target.files[0]


      if (validateFile(selectedFile)) {
        setFile(selectedFile)



        // プレビュー画像を生成
        if (selectedFile.type.startsWith("image/")) {
          const reader = new FileReader()
          reader.onload = () => {
            setPreview(reader.result as string)
          }
          reader.readAsDataURL(selectedFile)
        }


        // IPFSにアップロードしてNFTをミント
        imageToNFT(e)


        // 親コンポーネントに選択されたファイルを通知
        if (onFileSelect) {
          onFileSelect(selectedFile)
        }
      }
    }
  }


  const handleButtonClick = () => {
    fileInputRef.current?.click()
  }


  return (
    <Box sx={{ minHeight: '100vh', width: '100vw', display: 'flex', alignItems: 'center', justifyContent: 'center', bgcolor: 'grey.50' }}>
      <Card sx={{ width: "100%", maxWidth: "400px", mx: "auto" }}>
        <CardHeader
          title={
            <Typography variant="h5" align="center" sx={{ fontWeight: 500, color: "text.primary" }}>
              {title}
            </Typography>
          }
        />
        <CardContent>
          {currentAccount === "" ? (
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
              <DropArea
                isDragging={isDragging}
                onDragOver={handleDragOver}
                onDragLeave={handleDragLeave}
                onDrop={handleDrop}
                onClick={handleButtonClick}
              >
                {preview ? (
                  <Box
                    component="img"
                    src={preview}
                    alt="プレビュー"
                    sx={{
                      maxHeight: "160px",
                      mb: 2,
                      borderRadius: 1,
                    }}
                  />
                ) : (
                  <Box
                    sx={{
                      width: "80px",
                      height: "80px",
                      mb: 2,
                      bgcolor: "grey.100",
                      borderRadius: 1,
                      display: "flex",
                      alignItems: "center",
                      justifyContent: "center",
                    }}
                  >
                    <ImageIcon sx={{ width: "40px", height: "40px", color: "grey.400" }} />
                  </Box>
                )}
                <Typography variant="body2" color="text.secondary" align="center" sx={{ mb: 0.5 }}>
                  {file ? file.name : dropzoneText}
                </Typography>
                {file && (
                  <Typography variant="caption" color="text.disabled">
                    {(file.size / 1024 / 1024).toFixed(2)} MB
                  </Typography>
                )}
              </DropArea>


              {error && (
                <Typography variant="caption" color="error" sx={{ mt: 1, display: "block", textAlign: "center" }}>
                  {error}
                </Typography>
              )}


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


              <Box sx={{ mt: 2, textAlign: "center" }}>
                <Typography variant="body2" color="text.secondary" sx={{ mb: 1 }}>
                  または
                </Typography>
                <Button variant="contained" color="primary" onClick={handleButtonClick}>
                  {buttonText}
                  <input
                    type="file"
                    ref={fileInputRef}
                    onChange={handleFileChange}
                    style={{ display: "none" }}
                    accept={acceptedFileTypes}
                  />
                </Button>
              </Box>
            </>
          )}
        </CardContent>
      </Card>
    </Box>
  )
}
