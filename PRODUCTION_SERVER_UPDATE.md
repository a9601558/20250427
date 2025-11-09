# 🚀 本番サーバー更新手順（東京リージョン対応）

## 📋 更新内容

Cognito設定を**東京リージョン**（`ap-northeast-1_06Lr5s5h9`）に統一しました。

---

## ステップ1: 本番サーバーにSSH接続

```bash
ssh root@your-server-ip
```

---

## ステップ2: バックエンドの .env を更新

```bash
cd /www/wwwroot/root/git/dist/server
nano .env
```

以下の2行を探して更新してください：

```properties
# 変更前
COGNITO_REGION=ap-southeast-2
COGNITO_USER_POOL_ID=ap-southeast-2_El0UTGvLD

# 変更後（東京リージョン）
COGNITO_REGION=ap-northeast-1
COGNITO_USER_POOL_ID=ap-northeast-1_06Lr5s5h9
```

保存して終了: `Ctrl + O` → `Enter` → `Ctrl + X`

---

## ステップ3: フロントエンドをビルド＆デプロイ

### ローカル環境で実行:

```bash
cd /Users/wilson/Desktop/montopi/20250427

# フロントエンドをビルド
npm run build

# ビルドファイルを本番サーバーにコピー
scp -r dist/* root@your-server-ip:/www/wwwroot/root/git/dist/
```

---

## ステップ4: サーバーを再起動

本番サーバーで実行:

```bash
# PM2でサーバーを再起動
pm2 restart montopi-server

# ログを確認
pm2 logs montopi-server --lines 50
```

---

## ✅ 動作確認

### 1. Socket認証エラーが消えたか確認

ログに以下のエラーが**出ない**ことを確認：
```
[Socket Auth Error] Issuer mismatch detected
```

正常な場合は以下のように表示されます：
```
[Socket Auth Debug] Token issuer check: {
  actualIssuer: 'https://cognito-idp.ap-northeast-1.amazonaws.com/ap-northeast-1_06Lr5s5h9',
  expectedIssuer: 'https://cognito-idp.ap-northeast-1.amazonaws.com/ap-northeast-1_06Lr5s5h9',
  ...
}
```

### 2. ユーザーがログインできるか確認

ブラウザで https://montopi.com にアクセスして：
- ログインできるか
- Socket接続エラーが出ないか
- リアルタイム機能が動作するか

---

## 🔴 データベース問題の対応

現在、本番データベースには **0個の問題セット** しかありません。

### 解決方法: 管理画面からアップロード

1. https://montopi.com にアクセス
2. 管理者アカウントでログイン
3. **管理画面** → **問題セット管理**
4. **JSONファイルをアップロード**

---

## 📊 設定確認コマンド

本番サーバーで以下を実行して状態を確認できます：

```bash
# 1. 環境変数の確認
cd /www/wwwroot/root/git/dist/server
cat .env | grep COGNITO

# 2. データベースの問題セット数を確認
mysql -u quizuser -p quizdb -e "SELECT COUNT(*) as total FROM question_sets;"

# 3. サーバーログを確認
pm2 logs montopi-server --lines 100

# 4. サーバーのステータス確認
pm2 status
```

---

## 🔧 トラブルシューティング

### Socket認証エラーが続く場合

1. **キャッシュをクリア**:
```bash
pm2 restart montopi-server --update-env
```

2. **ログで実際のIssuerを確認**:
```bash
pm2 logs montopi-server | grep "actualIssuer"
```

### フロントエンドが更新されない場合

ブラウザのキャッシュをクリア:
- `Cmd + Shift + R` (Mac)
- `Ctrl + Shift + R` (Windows/Linux)

---

## 📝 更新後のチェックリスト

- [ ] 本番サーバーの .env を更新（Cognito設定）
- [ ] フロントエンドをビルドしてデプロイ
- [ ] PM2でサーバー再起動
- [ ] Socket認証エラーが消えたか確認
- [ ] ユーザーがログインできるか確認
- [ ] 問題セットをアップロード（管理画面経由）

---

## 🔐 セキュリティ注意事項

⚠️ **データベースパスワードの変更も忘れずに！**

古いパスワード `zqw20011216` はGit履歴に残っているため、以下を実施してください：

1. MySQLのパスワードを変更
2. 本番サーバーの .env を更新
3. サーバー再起動

詳細は `docs/SECURITY_INCIDENT_RESPONSE.md` を参照してください。

---

## 📞 問題が発生した場合

以下の情報を収集してください：

```bash
# ログ収集
pm2 logs montopi-server --lines 100 > logs.txt

# データベース状態
mysql -u quizuser -p quizdb -e "
  SELECT COUNT(*) as question_sets FROM question_sets;
  SELECT COUNT(*) as questions FROM questions;
  SELECT COUNT(*) as users FROM users;
" > db-status.txt

# 環境変数確認
cat /www/wwwroot/root/git/dist/server/.env | grep -E "(COGNITO|DB_|JWT_)" > env-status.txt
```
