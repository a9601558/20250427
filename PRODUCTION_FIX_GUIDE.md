# 🚨 本番環境の緊急修正ガイド

## 問題の概要

### 1. Cognito設定のミスマッチ ❌
- **実際のトークン**: `ap-northeast-1_06Lr5s5h9`
- **サーバー期待値**: `ap-southeast-2_El0UTGvLD`

### 2. データベースが空 ❌
- 0個の問題セットしか存在しない

---

## 🔧 修正手順

### ステップ1: 正しいCognito設定を確認

まず、**どちらのCognitoプールを使用するべきか**を決定してください：

#### オプションA: `ap-northeast-1_06Lr5s5h9` を使用（推奨）
もしこれが実際の本番環境のプールなら：

1. **フロントエンドを更新** (`src/config/amplifyConfig.ts`):
```typescript
const amplifyConfig = {
  Auth: {
    Cognito: {
      userPoolId: 'ap-northeast-1_06Lr5s5h9',
      userPoolClientId: '該当のクライアントID',
      region: 'ap-northeast-1',
      // ... 残りの設定
    },
  },
};
```

2. **本番サーバーの .env を更新**:
```bash
ssh root@your-server
cd /www/wwwroot/root/git/dist/server
nano .env
```

以下の値を更新：
```properties
# AWS Cognito Configuration
COGNITO_REGION=ap-northeast-1
COGNITO_USER_POOL_ID=ap-northeast-1_06Lr5s5h9
```

#### オプションB: `ap-southeast-2_El0UTGvLD` を使用
もしこれが正しい本番環境のプールなら：

**ユーザーに再ログインしてもらう必要があります。**
古いトークンをクリアするため、フロントエンドでログアウトを実行してください。

---

### ステップ2: サーバーを再起動

```bash
pm2 restart montopi-server
pm2 logs montopi-server
```

---

### ステップ3: データベースに問題セットをアップロード

本番環境のデータベースが空です。以下の方法で問題セットを追加してください：

#### 方法1: 管理画面からアップロード（推奨）

1. https://montopi.com にアクセス
2. 管理者アカウントでログイン
3. 管理画面 → 「問題セット管理」
4. JSON ファイルをアップロード

#### 方法2: SQLを直接実行

もし既存のデータベースバックアップがある場合：

```bash
mysql -u quizuser -p quizdb < backup.sql
```

---

## 📋 設定確認チェックリスト

### フロントエンド設定
- [ ] `src/config/amplifyConfig.ts` のCognito設定が正しい
- [ ] ビルドして再デプロイ済み
```bash
npm run build
# ビルドファイルを本番サーバーにコピー
```

### バックエンド設定（本番サーバー）
- [ ] `/www/wwwroot/root/git/dist/server/.env` の以下が正しい：
  ```properties
  COGNITO_REGION=ap-northeast-1
  COGNITO_USER_POOL_ID=ap-northeast-1_06Lr5s5h9
  ```
- [ ] PM2でサーバー再起動済み
- [ ] ログでエラーが出ていない

### データベース
- [ ] 問題セットが1個以上存在する
- [ ] ユーザーデータが正しく保存されている

---

## 🔍 設定確認コマンド

### 本番サーバーで実行

```bash
# 現在の .env を確認
cd /www/wwwroot/root/git/dist/server
cat .env | grep COGNITO

# データベースの問題セット数を確認
mysql -u quizuser -p quizdb -e "SELECT COUNT(*) FROM question_sets;"

# サーバーログを確認
pm2 logs montopi-server --lines 50
```

---

## ❓ どちらのCognitoプールを使用すべきか？

**確認方法：**

1. **AWS コンソール**にログイン
2. **Cognito** → **User Pools**
3. 以下の2つを確認：
   - `ap-northeast-1_06Lr5s5h9` (東京リージョン)
   - `ap-southeast-2_El0UTGvLD` (シドニーリージョン)

4. **ユーザー数が多い方**、または**本番環境として設定した方**を使用してください

---

## 🚀 推奨設定（東京リージョン使用の場合）

### フロントエンド `.env`
```properties
VITE_API_BASE_URL=/api
VITE_STRIPE_PUBLIC_KEY=pk_test_xxx
```

### バックエンド `server/.env` (本番サーバー)
```properties
# Server Configuration
PORT=5000
NODE_ENV=production

# MySQL Database
DB_HOST=localhost
DB_PORT=3306
DB_NAME=quizdb
DB_USER=quizuser
DB_PASSWORD=【新しいパスワードに変更してください】
SYNC_DB=false

# JWT Configuration
JWT_SECRET=【強力なランダム文字列】
JWT_REFRESH_SECRET=【強力なランダム文字列】
JWT_EXPIRES_IN=30d
JWT_REFRESH_EXPIRES_IN=7d

# Stripe API Keys
STRIPE_PUBLIC_KEY=pk_test_xxx
STRIPE_SECRET_KEY=sk_test_xxx

# Frontend URL
FRONTEND_URL=https://montopi.com
CLIENT_URL=https://montopi.com

# AWS Cognito Configuration
COGNITO_REGION=ap-northeast-1
COGNITO_USER_POOL_ID=ap-northeast-1_06Lr5s5h9
```

---

## 📞 サポート

もし問題が解決しない場合、以下の情報を提供してください：

1. どちらのCognitoプールを使用したいか
2. 本番サーバーのログ（最新50行）
3. データベースの状態（問題セット数）

```bash
# ログ収集コマンド
pm2 logs montopi-server --lines 50 > server-logs.txt
mysql -u quizuser -p quizdb -e "SELECT COUNT(*) as question_set_count FROM question_sets; SELECT COUNT(*) as question_count FROM questions;" > db-status.txt
```
