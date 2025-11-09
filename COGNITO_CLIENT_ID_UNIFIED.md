# ✅ Cognito Client ID 統一完了

## 📋 実施した変更

### 1. Client ID を統一

**以前の設定:**
- Amplify: `3l9nrspcr34tjjs1isupccvb4t` ❌
- OIDC: `3tdjflgaoojolmlau5thc9lv5c` ✅

**新しい設定（統一後）:**
- Amplify: `3tdjflgaoojolmlau5thc9lv5c` ✅
- OIDC: `3tdjflgaoojolmlau5thc9lv5c` ✅

### 2. 変更されたファイル

1. **`src/config/amplifyConfig.ts`**
   ```typescript
   userPoolClientId: '3tdjflgaoojolmlau5thc9lv5c'
   ```

2. **`src/main.tsx`**
   - デバッグツールを追加
   - Client ID をコンソールに出力

---

## 🔍 デバッグツールの使い方

### 開発環境で確認

```bash
npm run dev
```

ブラウザの開発者ツール（F12）のConsoleで以下を実行：

#### 1. 現在の設定を確認
```javascript
window.cognitoDebug()
```

出力される情報：
- Amplify 設定（Region, User Pool ID, Client ID）
- ローカルストレージのトークン状態
- 現在のユーザー状態
- トークンの有効期限
- Cognito エンドポイントへの接続テスト

#### 2. ログインをテスト
```javascript
window.testCognitoLogin("your_username", "your_password")
```

#### 3. 新規登録をテスト
```javascript
window.testCognitoSignup("new_username", "email@example.com", "Password123")
```

---

## 🚀 次のステップ

### ステップ1: 本番サーバーを更新

#### A. フロントエンドをビルドしてデプロイ

```bash
# ローカルでビルド
cd /Users/wilson/Desktop/montopi/20250427
npm run build

# 本番サーバーにデプロイ
scp -r dist/* root@your-server:/www/wwwroot/root/git/dist/
```

#### B. バックエンド .env を更新（既に完了）

本番サーバー: `/www/wwwroot/root/git/dist/server/.env`

```properties
COGNITO_REGION=ap-northeast-1
COGNITO_USER_POOL_ID=ap-northeast-1_06Lr5s5h9
```

#### C. サーバーを再起動

```bash
pm2 restart montopi-server
pm2 logs montopi-server
```

---

### ステップ2: AWS Cognito の設定を確認

AWS Console → Cognito → User Pools → `ap-northeast-1_06Lr5s5h9` → App integration

#### App Client: `3tdjflgaoojolmlau5thc9lv5c` の設定を確認

##### ✅ 必須設定:

1. **Authentication flows** を有効化:
   - ☑️ ALLOW_USER_PASSWORD_AUTH
   - ☑️ ALLOW_USER_SRP_AUTH
   - ☑️ ALLOW_REFRESH_TOKEN_AUTH

2. **Hosted UI configuration**:
   - Allowed callback URLs:
     ```
     https://montopi.com
     http://localhost:3000
     ```
   - Allowed sign-out URLs:
     ```
     https://montopi.com
     http://localhost:3000
     ```

3. **OAuth 2.0 grant types**:
   - ☑️ Authorization code grant
   - ☑️ Implicit grant（オプション）

4. **OpenID Connect scopes**:
   - ☑️ email
   - ☑️ openid
   - ☑️ phone

##### ✅ User Pool の設定:

**Sign-up experience:**
- ☑️ Self-registration: 有効
- Required attributes:
  - ☑️ email（必須）
  - ☐ phone_number（オプション）
- ☑️ Email verification: 有効

**Multi-factor authentication (MFA):**
- Optional または Off（推奨）

**Password policy:**
- Minimum length: 8文字以上
- ☑️ Require uppercase
- ☑️ Require lowercase  
- ☑️ Require numbers
- ☐ Require special characters（オプション）

---

## ✅ 動作確認

### 1. 開発環境でテスト

```bash
npm run dev
```

#### A. ログイン機能
1. アプリケーションを開く: http://localhost:3000
2. 既存のユーザーでログイン
3. ユーザー情報が表示されるか確認
4. Console で `window.cognitoDebug()` を実行して状態を確認

#### B. 新規登録機能
1. 新規登録フォームを開く
2. ユーザー名、メール、パスワードを入力
3. 登録ボタンをクリック
4. 確認メールが届くか確認
5. メールのリンクをクリックしてアカウントを有効化

#### C. エラーハンドリング
Console に表示されるエラーメッセージを確認：
- エラーがなければ: ✅ 設定成功
- エラーがある場合: エラーメッセージをコピーして報告

---

### 2. 本番環境でテスト

#### 前提条件:
- フロントエンドがデプロイ済み
- バックエンド .env が更新済み
- PM2 でサーバーが再起動済み

#### テスト手順:

1. **ログインテスト**
   - https://montopi.com にアクセス
   - 既存ユーザーでログイン
   - ユーザー情報が表示されるか確認

2. **Socket接続テスト**
   - リアルタイム機能が動作するか確認
   - サーバーログで認証エラーが出ていないか確認

3. **新規登録テスト**
   - 新規ユーザーを登録
   - 確認メールが届くか確認
   - ログインできるか確認

---

## 🔴 トラブルシューティング

### 問題1: ログイン後もユーザー情報が表示されない

**確認事項:**
1. Console で `window.cognitoDebug()` を実行
2. Token が存在するか確認
3. Token の有効期限を確認

**解決方法:**
```javascript
// ローカルストレージをクリア
localStorage.clear()

// 再ログイン
```

---

### 問題2: 新規登録ができない

**Console のエラーを確認:**

- `UsernameExistsException`: ユーザー名が既に存在
- `InvalidPasswordException`: パスワードが要件を満たしていない
- `InvalidParameterException`: 入力パラメータが無効

**解決方法:**
1. AWS Console で Self-registration が有効か確認
2. 必須属性（email, phone_number）を確認
3. Password policy を確認

---

### 問題3: Socket認証エラー

**サーバーログを確認:**
```bash
pm2 logs montopi-server | grep "Socket Auth"
```

**期待される出力:**
```
[Socket Auth Debug] Token issuer check: {
  actualIssuer: 'https://cognito-idp.ap-northeast-1.amazonaws.com/ap-northeast-1_06Lr5s5h9',
  expectedIssuer: 'https://cognito-idp.ap-northeast-1.amazonaws.com/ap-northeast-1_06Lr5s5h9',
  ...
}
```

**解決方法:**
- Issuer が一致していない場合: バックエンド .env の COGNITO_REGION と COGNITO_USER_POOL_ID を確認
- Token が無効な場合: 再ログインしてトークンを更新

---

## 📊 設定確認チェックリスト

### フロントエンド
- [x] amplifyConfig.ts の Client ID: `3tdjflgaoojolmlau5thc9lv5c`
- [x] main.tsx の Client ID: `3tdjflgaoojolmlau5thc9lv5c`
- [x] Region: `ap-northeast-1`
- [x] User Pool ID: `ap-northeast-1_06Lr5s5h9`
- [x] デバッグツール有効

### バックエンド
- [x] server/.env の COGNITO_REGION: `ap-northeast-1`
- [x] server/.env の COGNITO_USER_POOL_ID: `ap-northeast-1_06Lr5s5h9`

### AWS Cognito
- [ ] App Client ID: `3tdjflgaoojolmlau5thc9lv5c`
- [ ] Authentication flows 有効
- [ ] Hosted UI 設定完了
- [ ] Callback URLs 設定済み
- [ ] Self-registration 有効
- [ ] Email verification 有効

### 本番環境
- [ ] フロントエンドビルド完了
- [ ] 本番サーバーにデプロイ済み
- [ ] PM2 再起動済み
- [ ] ログインテスト成功
- [ ] 新規登録テスト成功

---

## 📞 サポート

問題が発生した場合、以下の情報を提供してください：

1. **ブラウザのConsole出力:**
   ```javascript
   window.cognitoDebug()
   ```

2. **サーバーログ:**
   ```bash
   pm2 logs montopi-server --lines 50
   ```

3. **エラーメッセージ:**
   - ログイン時のエラー
   - 登録時のエラー
   - Socket接続のエラー

4. **AWS Console のスクリーンショット:**
   - App Client の設定
   - Authentication flows
   - Hosted UI 設定

---

## 🎉 完了

Client ID の統一が完了しました！

次のステップ:
1. 開発環境でテスト
2. AWS Console で設定を確認
3. 本番環境にデプロイ
4. 動作確認

問題があれば、デバッグツールとこのドキュメントを参照してください。
