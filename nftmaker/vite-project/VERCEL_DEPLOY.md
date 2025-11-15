# Vercelデプロイガイド

このプロジェクトをVercelにデプロイする手順です。

## 前提条件

- Vercelアカウント（[vercel.com](https://vercel.com)で無料登録可能）
- GitHubアカウント（推奨）またはGitリポジトリ

## デプロイ手順

### 方法1: Vercel CLIを使用（推奨）

1. **Vercel CLIをインストール**
   ```bash
   npm i -g vercel
   ```

2. **プロジェクトディレクトリに移動**
   ```bash
   cd nftmaker/vite-project
   ```

3. **Vercelにログイン**
   ```bash
   vercel login
   ```

4. **デプロイ**
   ```bash
   vercel
   ```
   
   初回デプロイ時は、いくつか質問されます：
   - Set up and deploy? → **Y**
   - Which scope? → アカウントを選択
   - Link to existing project? → **N**（新規プロジェクトの場合）
   - Project name? → プロジェクト名を入力（またはEnterでデフォルト）
   - Directory? → **./**（現在のディレクトリ）
   - Override settings? → **N**

5. **本番環境にデプロイ**
   ```bash
   vercel --prod
   ```

### 方法2: GitHub連携を使用

1. **GitHubにリポジトリをプッシュ**
   ```bash
   git init
   git add .
   git commit -m "Initial commit"
   git remote add origin <your-github-repo-url>
   git push -u origin main
   ```

2. **Vercelダッシュボードでインポート**
   - [Vercel Dashboard](https://vercel.com/dashboard)にアクセス
   - "Add New..." → "Project" をクリック
   - GitHubリポジトリを選択
   - プロジェクト設定を確認：
     - Framework Preset: **Vite**
     - Root Directory: **nftmaker/vite-project**（またはプロジェクトのルート）
     - Build Command: **npm run build**
     - Output Directory: **dist**
   - "Deploy" をクリック

## 環境変数の設定

Vercelダッシュボードで環境変数を設定します：

1. **プロジェクト設定に移動**
   - Vercelダッシュボードでプロジェクトを選択
   - "Settings" → "Environment Variables" をクリック

2. **以下の環境変数を追加**
   ```
   LIGHTHOUSE_API_KEY=your_lighthouse_api_key_here
   ```

3. **環境を選択**
   - Production, Preview, Development すべてに適用することを推奨

4. **再デプロイ**
   - 環境変数を追加した後、再デプロイが必要です

## プロジェクト構造

Vercelデプロイ用の構造：

```
nftmaker/vite-project/
├── api/                    # Vercelサーバーレス関数
│   └── sessions/
│       ├── index.js        # POST /api/sessions
│       ├── [sessionId].js # GET /api/sessions/:sessionId
│       └── [sessionId]/
│           └── upload.js   # POST /api/sessions/:sessionId/upload
├── src/                    # フロントエンドソース
├── dist/                   # ビルド出力（自動生成）
├── vercel.json            # Vercel設定
└── package.json
```

## 注意事項

### セッション管理について

現在、セッションはメモリ内（`global.sessions`）で管理されています。Vercelのサーバーレス関数はステートレスなため、以下の制限があります：

- **同一リクエスト内でのみ有効**: 異なるリクエスト間でセッションが共有されない可能性があります
- **推奨**: 本番環境では、外部ストレージ（Redis、Upstash、Vercel KVなど）を使用することを推奨します

### ファイルサイズ制限

- Vercelのサーバーレス関数には10秒の実行時間制限があります
- 大きなファイルのアップロードには時間がかかる可能性があります

### CORS設定

API関数でCORSを設定していますが、必要に応じて本番環境のドメインに制限してください。

## トラブルシューティング

### ビルドエラー

- `npm run build` がローカルで成功することを確認
- TypeScriptエラーがないか確認

### APIエラー

- Vercelダッシュボードの "Functions" タブでログを確認
- 環境変数が正しく設定されているか確認

### セッションが見つからない

- メモリベースのセッション管理の制限による可能性があります
- 外部ストレージの導入を検討してください

## 次のステップ

1. **外部ストレージの導入**（推奨）
   - Vercel KV、Upstash Redis、またはMongoDBなどの使用を検討

2. **カスタムドメインの設定**
   - Vercelダッシュボードでカスタムドメインを設定可能

3. **モニタリング**
   - Vercel Analyticsの有効化を検討

