# 🔴 Cognito統合問題の診断レポート

## 問題の概要

1. **ログイン後、フロントエンドでユーザー情報が表示されない**
2. **新規ユーザー登録ができない**

---

## 🔍 問題の根本原因

### 発見された設定の不一致

プロジェクトには**2つの異なる認証システム**が混在しています：

#### 1. **AWS Amplify (Cognito直接統合)**
- ファイル: `src/config/amplifyConfig.ts`
- User Pool ID: `ap-northeast-1_06Lr5s5h9` ✅
- Client ID: `3l9nrspcr34tjjs1isupccvb4t`
- 使用箇所: `src/contexts/CognitoUserContext.tsx`

#### 2. **OIDC (Cognito Hosted UI経由)**
- ファイル: `src/main.tsx`
- User Pool ID: `ap-northeast-1_06Lr5s5h9` ✅
- Client ID: `3tdjflgaoojolmlau5thc9lv5c` ⚠️ **異なる！**
- 使用箇所: `src/contexts/OIDCUserContext.tsx`

### 🚨 問題点

**2つの異なるApp Client IDが使用されている**

- **Amplify用**: `3l9nrspcr34tjjs1isupccvb4t`
- **OIDC用**: `3tdjflgaoojolmlau5thc9lv5c`

これにより、以下の問題が発生する可能性があります：

1. 一方の方法でログインしても、もう一方のシステムでは認証されない
2. トークンが互換性を持たない
3. ユーザー情報の取得に失敗する

---

## 🛠️ 解決策

### オプションA: OIDC（Hosted UI）を使用（推奨）

Hosted UI を使用している場合、Amplifyの直接統合は必要ありません。

#### 手順:

1. **AWS Consoleで確認**
   - User Pool: `ap-northeast-1_06Lr5s5h9`
   - App Client: `3tdjflgaoojolmlau5thc9lv5c`
   - Hosted UI が設定されているか確認
   - Callback URLs に `https://montopi.com` と `http://localhost:3000` が含まれているか

2. **amplifyConfig.ts を OIDC の Client ID に統一**

```typescript
// src/config/amplifyConfig.ts
const amplifyConfig = {
  Auth: {
    Cognito: {
      userPoolId: 'ap-northeast-1_06Lr5s5h9',
      userPoolClientId: '3tdjflgaoojolmlau5thc9lv5c', // OIDC と同じ ID
      region: 'ap-northeast-1',
      // ...残りの設定
    },
  },
};
```

3. **App Client の設定を確認**（AWS Console）
   - Authentication flows:
     - ✅ ALLOW_USER_PASSWORD_AUTH（ユーザー名/パスワードログイン）
     - ✅ ALLOW_USER_SRP_AUTH（SRP認証）
     - ✅ ALLOW_REFRESH_TOKEN_AUTH（リフレッシュトークン）
   - App client secret: なし（推奨）
   - Hosted UI: 設定済み

---

### オプションB: Amplify直接統合を使用

Hosted UIを使用せず、Amplifyの直接統合のみを使用する場合。

#### 手順:

1. **main.tsx の OIDC 設定を削除**

2. **すべての認証を CognitoUserContext に統一**

3. **amplifyConfig.ts の Client ID を確認**

---

## 📋 AWS Consoleで確認すべき項目

### 1. App Client 設定

```
AWS Console → Cognito → User Pools → ap-northeast-1_06Lr5s5h9 → App integration → App clients
```

以下を確認してください：

#### Client ID: `3tdjflgaoojolmlau5thc9lv5c` の設定

- [ ] **Authentication flows**
  - [ ] ALLOW_USER_PASSWORD_AUTH
  - [ ] ALLOW_USER_SRP_AUTH
  - [ ] ALLOW_REFRESH_TOKEN_AUTH

- [ ] **Hosted UI configuration**
  - Allowed callback URLs: 
    - `https://montopi.com`
    - `http://localhost:3000`
  - Allowed sign-out URLs:
    - `https://montopi.com`
    - `http://localhost:3000`

- [ ] **OAuth 2.0 grant types**
  - [ ] Authorization code grant
  - [ ] Implicit grant（オプション）

- [ ] **OpenID Connect scopes**
  - [ ] email
  - [ ] openid
  - [ ] phone

#### Client ID: `3l9nrspcr34tjjs1isupccvb4t` の設定

同様の設定を確認してください。

---

### 2. User Pool 設定

```
AWS Console → Cognito → User Pools → ap-northeast-1_06Lr5s5h9 → Sign-up experience
```

- [ ] **Self-registration**: 有効
- [ ] **Required attributes**:
  - email: 必須
  - phone_number: 任意（推奨）
- [ ] **Email verification**: 有効
- [ ] **MFA**: オプション or 無効

---

### 3. Hosted UI ドメイン

```
AWS Console → Cognito → User Pools → ap-northeast-1_06Lr5s5h9 → App integration → Domain
```

- [ ] ドメインが設定されているか確認
- 形式: `https://your-domain.auth.ap-northeast-1.amazoncognito.com`

---

## 🔍 デバッグ手順

### ステップ1: ブラウザでデバッグツールを使用

開発環境でアプリケーションを起動：

```bash
npm run dev
```

ブラウザの開発者ツールを開き（F12）、Consoleで以下を実行：

```javascript
// Cognito 設定を確認
window.cognitoDebug()

// ログインテスト
window.testCognitoLogin("your_username", "your_password")

// 登録テスト
window.testCognitoSignup("new_username", "email@example.com", "Password123")
```

### ステップ2: Network タブでリクエストを確認

1. Network タブを開く
2. ログイン/登録を試みる
3. 以下のエンドポイントへのリクエストを確認：
   - `https://cognito-idp.ap-northeast-1.amazonaws.com/`
   - エラーレスポンスの内容を確認

### ステップ3: エラーメッセージを記録

Console に表示されるエラーを記録してください：

- エラー名（例: `UsernameExistsException`, `InvalidParameterException`）
- エラーメッセージ
- スタックトレース

---

## 💡 推奨される統一方法

### 推奨：OIDC（Hosted UI）のみを使用

理由：
- ✅ AWS が管理する認証UI
- ✅ セキュリティベストプラクティスが適用済み
- ✅ ソーシャルログイン（Google, Facebookなど）への拡張が容易
- ✅ MFA設定が簡単

#### 実装:

1. **amplifyConfig.ts の Client ID を統一**
2. **CognitoUserContext を削除または無効化**
3. **すべての認証を OIDCUserContext に統一**

---

## 📞 次のステップ

### 必要な情報

以下の情報をAWS Consoleで確認して提供してください：

1. **App Client ID `3tdjflgaoojolmlau5thc9lv5c` の設定**:
   - Authentication flows: [  ]
   - App client secret: [ あり / なし ]
   - Hosted UI: [ 設定済み / 未設定 ]

2. **App Client ID `3l9nrspcr34tjjs1isupccvb4t` の設定**:
   - Authentication flows: [  ]
   - App client secret: [ あり / なし ]
   - Hosted UI: [ 設定済み / 未設定 ]

3. **どちらの App Client を使用したいか**:
   - [ ] `3tdjflgaoojolmlau5thc9lv5c` (OIDC用)
   - [ ] `3l9nrspcr34tjjs1isupccvb4t` (Amplify直接統合用)
   - [ ] 両方（推奨しません）

4. **ブラウザのエラーメッセージ**:
   - ログイン時のエラー: [  ]
   - 登録時のエラー: [  ]

この情報があれば、具体的な修正を行うことができます。

---

## 📄 関連ファイル

- `src/config/amplifyConfig.ts` - Amplify設定
- `src/main.tsx` - OIDC設定
- `src/contexts/CognitoUserContext.tsx` - Amplify認証コンテキスト
- `src/contexts/OIDCUserContext.tsx` - OIDC認証コンテキスト
- `src/utils/cognitoDebugger.ts` - デバッグツール
- `diagnose-cognito.sh` - CLI診断スクリプト
