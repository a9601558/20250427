# 🔧 本番環境デプロイ用環境変数設定ガイド

## 📋 必須の環境変数

本番サーバー（`/www/wwwroot/root/git/dist/server/.env`）に以下の環境変数を設定してください。

### 1. サーバー基本設定

```bash
# サーバーポート
PORT=5000

# 環境（本番環境）
NODE_ENV=production

# フロントエンドURL（CORS設定用）
FRONTEND_URL=https://montopi.com
CLIENT_URL=https://montopi.com
```

### 2. データベース設定

```bash
# MySQL接続情報
DB_HOST=localhost
DB_PORT=3306
DB_NAME=quizdb
DB_USER=root
DB_PASSWORD=your_secure_password_here  # ⚠️ 実際のパスワードに置き換えてください

# データベース同期（本番環境ではfalse推奨）
SYNC_DB=false
```

### 3. JWT設定

```bash
# JWT署名用シークレットキー（強力なランダム文字列）
JWT_SECRET=examPracticeAppSecretKey123456
JWT_REFRESH_SECRET=examPracticeAppRefreshKey789012

# トークン有効期限
JWT_EXPIRES_IN=30d
JWT_REFRESH_EXPIRES_IN=7d
```

### 4. AWS Cognito設定 ⚠️ **重要**

```bash
# Cognitoリージョン
COGNITO_REGION=ap-southeast-2

# Cognito User Pool ID
COGNITO_USER_POOL_ID=ap-southeast-2_El0UTGvLD

# Cognito App Client ID（フロントエンドと同じ）
COGNITO_CLIENT_ID=your_app_client_id_here
```

**確認方法:**
1. AWS Cognitoコンソールにログイン
2. User Poolを確認: `ap-southeast-2_El0UTGvLD`
3. App Clientを確認して、正しいClient IDを取得

### 5. Stripe決済設定 🔒 **機密情報**

```bash
# Stripe公開可能キー（テスト環境用）
STRIPE_PUBLIC_KEY=pk_test_your_public_key_here

# Stripeシークレットキー（絶対に公開しない！本番用は別途設定）
STRIPE_SECRET_KEY=sk_test_your_secret_key_here

# ⚠️ 重要: 実際のキーは別途安全な方法で管理してください
# 本番環境では必ず本番用キー（pk_live_xxx, sk_live_xxx）を使用
```

## 🐛 現在のエラー解決

### エラー1: "Token issuer does not match Cognito"

**原因**: Cognitoの設定が正しくありません

**解決策**:
```bash
# server/.envで以下を確認・設定
COGNITO_REGION=ap-southeast-2
COGNITO_USER_POOL_ID=ap-southeast-2_El0UTGvLD
```

設定後、サーバーを再起動：
```bash
pm2 restart montopi-server
# または
pm2 restart all
```

### エラー2: 題庫が0件

**原因**: データベースが空です

**解決策**:

#### オプション1: 管理画面からアップロード
1. https://montopi.com にアクセス
2. 管理者でログイン
3. 管理ページ → JSON一括アップロード
4. JSONファイルをアップロード

#### オプション2: SQLで直接インポート
```bash
# MySQLにログイン
mysql -u root -p quizdb

# サンプル題庫を挿入
INSERT INTO question_sets (id, title, description, category, icon, is_paid, price, trial_questions, is_featured, featured_category, created_at, updated_at) 
VALUES (
  UUID(),
  'AWS SAP認定試験',
  'AWS Solutions Architect Professional練習問題',
  'AWS',
  '☁️',
  1,
  1980,
  5,
  1,
  'AWS',
  NOW(),
  NOW()
);
```

## 📝 完全な.envファイルテンプレート

```bash
# ============================================
# 本番環境設定 - /www/wwwroot/root/git/dist/server/.env
# ============================================

# Server Configuration
PORT=5000
NODE_ENV=production

# MySQL Database Configuration
DB_HOST=localhost
DB_PORT=3306
DB_NAME=quizdb
DB_USER=root
DB_PASSWORD=your_secure_password_here
SYNC_DB=false

# JWT Configuration
JWT_SECRET=examPracticeAppSecretKey123456
JWT_REFRESH_SECRET=examPracticeAppRefreshKey789012
JWT_EXPIRES_IN=30d
JWT_REFRESH_EXPIRES_IN=7d

# Stripe API Keys (本番環境では実際のキーを設定)
STRIPE_PUBLIC_KEY=pk_test_your_public_key_here
STRIPE_SECRET_KEY=sk_test_your_secret_key_here

# Frontend URL (for CORS)
FRONTEND_URL=https://montopi.com
CLIENT_URL=https://montopi.com

# AWS Cognito Configuration
COGNITO_REGION=ap-southeast-2
COGNITO_USER_POOL_ID=ap-southeast-2_El0UTGvLD
```

## 🔄 設定変更後の手順

1. **サーバーに接続**
```bash
ssh root@your-server-ip
```

2. **.envファイルを編集**
```bash
cd /www/wwwroot/root/git/dist/server
nano .env
# または
vim .env
```

3. **変更を保存してサーバー再起動**
```bash
pm2 restart montopi-server
pm2 logs montopi-server --lines 100
```

4. **ログを確認**
```bash
# エラーが出ていないか確認
pm2 logs --err

# デバッグログで設定を確認
# "[Socket Auth Debug]" のログを探す
```

## ✅ 確認チェックリスト

- [ ] COGNITO_REGION が正しい（ap-southeast-2）
- [ ] COGNITO_USER_POOL_ID が正しい（ap-southeast-2_El0UTGvLD）
- [ ] STRIPE_SECRET_KEY が設定されている
- [ ] DB_PASSWORD が正しい
- [ ] FRONTEND_URL が https://montopi.com
- [ ] PORT が5000（Nginxプロキシ設定と一致）
- [ ] サーバーを再起動した
- [ ] エラーログがクリーンになった

## 🆘 トラブルシューティング

### Cognitoエラーが続く場合

1. **トークンの内容を確認**
```javascript
// ブラウザコンソールで実行
const token = localStorage.getItem('idToken');
console.log(JSON.parse(atob(token.split('.')[1])));
```

2. **issクレームを確認**
- `iss` フィールドが `https://cognito-idp.ap-southeast-2.amazonaws.com/ap-southeast-2_El0UTGvLD` と一致するか

3. **フロントエンドのCognito設定も確認**
```bash
# フロントエンドの.env
cd /www/wwwroot/root/git/dist
cat .env | grep COGNITO
```

### データベース接続エラー

```bash
# MySQLが稼働しているか確認
systemctl status mysql

# データベースが存在するか確認
mysql -u root -p -e "SHOW DATABASES;"

# 接続テスト
mysql -u root -p -e "USE quizdb; SHOW TABLES;"
```

## 📞 サポート

問題が解決しない場合は、以下の情報を含めてお問い合わせください：
- サーバーログ（`pm2 logs --lines 200`）
- .envファイル（**機密情報は削除して**）
- エラーメッセージ全文
