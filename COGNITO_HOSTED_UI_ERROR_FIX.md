# 🚨 Cognito Hosted UI ドメイン設定エラー

## 問題の詳細

### エラー内容
```
POST https://ap-northeast-106lr5s5h9.auth.ap-northeast-1.amazoncognito.com/signup
400 (Bad Request)
```

### 問題点
URLが間違っています：
- **現在**: `ap-northeast-106lr5s5h9` ❌
- **正しい**: `ap-northeast-1_06Lr5s5h9` ✅

アンダースコア `_` が抜けています。

---

## 🔧 修正方法

### オプションA: Hosted UI を使用する場合（推奨）

#### 1. AWS Console でドメインを設定

1. **AWS Console にログイン**
   ```
   https://console.aws.amazon.com/cognito/
   ```

2. **User Pool を選択**
   - Region: ap-northeast-1（東京）
   - User Pool: ap-northeast-1_06Lr5s5h9

3. **App integration → Domain を選択**

4. **ドメインを作成**
   
   **オプション1: Cognito ドメイン（簡単）**
   - ドメインプレフィックスを入力: 例 `montopi-auth`
   - 完全なドメイン: `https://montopi-auth.auth.ap-northeast-1.amazoncognito.com`
   
   **オプション2: カスタムドメイン（高度）**
   - 自分のドメインを使用: 例 `auth.montopi.com`
   - SSL証明書が必要

5. **保存して確認**

---

### オプションB: Hosted UI を使用しない（Amplify直接統合のみ）

もしHosted UIが不要な場合、Amplifyの直接統合のみを使用できます。

#### コード修正が必要

`src/main.tsx` の OIDC 設定を削除または無効化して、Amplify の `signUp` 関数を使用します。

---

## 📋 AWS Console での確認手順

### ステップ1: ドメイン設定を確認

```
AWS Console → Cognito → User Pools 
→ ap-northeast-1_06Lr5s5h9 
→ App integration 
→ Domain
```

#### 確認事項:
- [ ] ドメインが設定されているか
- [ ] ドメインのステータスが "Active" か
- [ ] ドメイン名を記録する

#### ドメインが設定されていない場合:

1. **"Create Cognito domain"** をクリック
2. ドメインプレフィックスを入力: `montopi-auth`
3. **"Create"** をクリック
4. ステータスが "Active" になるまで待つ（数分）

---

### ステップ2: Hosted UI 設定を確認

```
AWS Console → Cognito → User Pools 
→ ap-northeast-1_06Lr5s5h9 
→ App integration 
→ App clients 
→ 3tdjflgaoojolmlau5thc9lv5c
```

#### 確認事項:
- [ ] **Hosted UI**: 有効
- [ ] **Allowed callback URLs**: 
  - `https://montopi.com`
  - `http://localhost:3000`
- [ ] **Allowed sign-out URLs**: 
  - `https://montopi.com`
  - `http://localhost:3000`
- [ ] **Identity providers**: Cognito user pool
- [ ] **OAuth 2.0 grant types**:
  - ☑️ Authorization code grant
- [ ] **OpenID Connect scopes**:
  - ☑️ openid
  - ☑️ email
  - ☑️ phone

---

## 🔄 コード修正（ドメイン設定後）

### ステップ3: main.tsx を更新

ドメインを設定したら、`src/main.tsx` を更新します：

```typescript
// Cognito OIDC 配置
const cognitoAuthConfig = {
  // ⚠️ ここを実際のドメインに変更
  authority: "https://montopi-auth.auth.ap-northeast-1.amazoncognito.com", // 👈 新しいドメイン
  client_id: "3tdjflgaoojolmlau5thc9lv5c",
  redirect_uri: getRedirectUri(),
  response_type: "code",
  scope: "email openid phone",
  post_logout_redirect_uri: getRedirectUri(),
  // ... 残りの設定
}
```

---

## 🎯 代替案: Amplify直接統合のみを使用

Hosted UIを使用せず、Amplifyの `signUp` 関数を使用する場合：

### 1. 新規登録コンポーネントの修正

```typescript
import { signUp } from 'aws-amplify/auth';

const handleSignup = async (username: string, email: string, password: string) => {
  try {
    const { isSignUpComplete, userId } = await signUp({
      username,
      password,
      options: {
        userAttributes: {
          email,
        },
      },
    });
    
    if (isSignUpComplete) {
      toast.success('登録成功！メールを確認してください');
    }
  } catch (error: any) {
    console.error('登録エラー:', error);
    toast.error(error.message);
  }
};
```

### 2. main.tsx の OIDC 設定を削除

```typescript
// この部分を削除またはコメントアウト
// const cognitoAuthConfig = { ... }
// <AuthProvider {...cognitoAuthConfig}>
```

---

## 🚀 推奨アプローチ

### アプローチ1: Hosted UI を使用（簡単）

**メリット:**
- AWS が管理する認証UI
- ソーシャルログイン対応（Google, Facebook等）
- セキュリティベストプラクティス適用済み

**手順:**
1. AWS Console でドメインを設定
2. `main.tsx` の `authority` を更新
3. ビルドして再デプロイ

---

### アプローチ2: Amplify直接統合のみ（カスタマイズ可能）

**メリット:**
- 完全にカスタマイズ可能なUI
- ドメイン設定不要
- より細かい制御が可能

**手順:**
1. OIDC設定を削除
2. すべての認証を `CognitoUserContext` に統一
3. カスタム登録フォームを使用

---

## 🔍 現在の状態を確認

### AWS Console で確認:

```bash
# 1. ドメインが設定されているか
AWS Console → Cognito → User Pool → App integration → Domain

# 2. Hosted UI が有効か
AWS Console → Cognito → User Pool → App integration → App client

# 3. 設定を記録
ドメイン: [                    ]
Hosted UI: [ 有効 / 無効 ]
```

---

## 💡 次のステップ

### どちらのアプローチを選びますか？

#### オプション1: Hosted UI を使用
→ AWS Console でドメインを設定してください
→ 設定後、ドメイン名を教えていただければコードを修正します

#### オプション2: Amplify直接統合のみ
→ OIDC設定を削除して、Amplifyの `signUp` を使用します
→ カスタム登録フォームで実装します

どちらを選択されますか？それに応じて次の手順を案内します。
