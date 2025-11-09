// 🔍 Cognito デバッグツール
// ブラウザのコンソールで使用: window.cognitoDebug()

export const installCognitoDebugger = () => {
  if (typeof window === 'undefined') return;

  (window as any).cognitoDebug = async () => {
    console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
    console.log('🔍 Cognito 設定診断');
    console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
    
    // 1. Amplify 設定を確認
    console.log('\n1️⃣ Amplify 設定:');
    try {
      const { Amplify } = await import('aws-amplify');
      const config = Amplify.getConfig();
      console.log('Region:', config.Auth?.Cognito?.userPoolId?.split('_')[0]);
      console.log('User Pool ID:', config.Auth?.Cognito?.userPoolId);
      console.log('Client ID:', config.Auth?.Cognito?.userPoolClientId);
    } catch (error) {
      console.error('Amplify 設定の取得に失敗:', error);
    }

    // 2. ローカルストレージのトークンを確認
    console.log('\n2️⃣ ローカルストレージ:');
    console.log('Token:', localStorage.getItem('token') ? '✓ 存在' : '✗ なし');
    console.log('Cognito ID Token:', localStorage.getItem('cognitoIdToken') ? '✓ 存在' : '✗ なし');
    console.log('Active User ID:', localStorage.getItem('activeUserId') || 'なし');

    // 3. 現在のユーザー状態を確認
    console.log('\n3️⃣ 現在のユーザー状態:');
    try {
      const { getCurrentUser, fetchAuthSession } = await import('aws-amplify/auth');
      const user = await getCurrentUser();
      console.log('✓ ユーザーがログイン中');
      console.log('User ID:', user.userId);
      console.log('Username:', user.username);
      
      const session = await fetchAuthSession();
      console.log('Session 有効:', !!session.tokens);
      console.log('ID Token:', session.tokens?.idToken ? '✓' : '✗');
      console.log('Access Token:', session.tokens?.accessToken ? '✓' : '✗');
      
      // トークンの有効期限を確認
      if (session.tokens?.idToken) {
        const payload = JSON.parse(atob(session.tokens.idToken.toString().split('.')[1]));
        const exp = new Date(payload.exp * 1000);
        const now = new Date();
        console.log('Token 有効期限:', exp.toLocaleString());
        console.log('残り時間:', Math.round((exp.getTime() - now.getTime()) / 60000), '分');
      }
    } catch (error: any) {
      console.log('✗ ユーザーがログインしていない');
      console.log('エラー:', error.message);
    }

    // 4. ネットワーク接続を確認
    console.log('\n4️⃣ ネットワーク接続:');
    console.log('オンライン:', navigator.onLine ? '✓' : '✗');

    // 5. Cognito エンドポイントへの接続テスト
    console.log('\n5️⃣ Cognito エンドポイント接続テスト:');
    const region = 'ap-northeast-1';
    const userPoolId = 'ap-northeast-1_06Lr5s5h9';
    const jwksUrl = `https://cognito-idp.${region}.amazonaws.com/${userPoolId}/.well-known/jwks.json`;
    
    try {
      const response = await fetch(jwksUrl);
      if (response.ok) {
        console.log('✓ Cognito エンドポイントに接続成功');
        const data = await response.json();
        console.log('JWKs Keys:', data.keys.length, '個');
      } else {
        console.log('✗ Cognito エンドポイント接続失敗:', response.status);
      }
    } catch (error) {
      console.log('✗ Cognito エンドポイント接続エラー:', error);
    }

    console.log('\n━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
    console.log('💡 ヒント:');
    console.log('- ログイン問題の場合: localStorage.clear() を実行してから再ログイン');
    console.log('- AWS Console で App Client ID を確認');
    console.log('- ブラウザの Network タブで Cognito API リクエストを確認');
    console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
  };

  // テスト用のログイン関数
  (window as any).testCognitoLogin = async (username: string, password: string) => {
    console.log('🔐 Cognito ログインテスト開始...');
    try {
      const { signIn } = await import('aws-amplify/auth');
      const result = await signIn({ username, password });
      console.log('✓ ログイン成功!');
      console.log('結果:', result);
      return result;
    } catch (error: any) {
      console.error('✗ ログイン失敗:', error);
      console.error('エラー名:', error.name);
      console.error('エラーメッセージ:', error.message);
      return error;
    }
  };

  // テスト用の登録関数
  (window as any).testCognitoSignup = async (username: string, email: string, password: string) => {
    console.log('📝 Cognito 登録テスト開始...');
    try {
      const { signUp } = await import('aws-amplify/auth');
      const result = await signUp({
        username,
        password,
        options: {
          userAttributes: {
            email,
          },
        },
      });
      console.log('✓ 登録成功!');
      console.log('結果:', result);
      return result;
    } catch (error: any) {
      console.error('✗ 登録失敗:', error);
      console.error('エラー名:', error.name);
      console.error('エラーメッセージ:', error.message);
      
      // よくあるエラーの説明
      if (error.name === 'UsernameExistsException') {
        console.log('💡 このユーザー名は既に使用されています');
      } else if (error.name === 'InvalidPasswordException') {
        console.log('💡 パスワードが要件を満たしていません');
        console.log('   - 最低8文字');
        console.log('   - 大文字を含む');
        console.log('   - 小文字を含む');
        console.log('   - 数字を含む');
      } else if (error.name === 'InvalidParameterException') {
        console.log('💡 入力パラメータが無効です');
        console.log('   - メールアドレスが正しい形式か確認');
        console.log('   - 電話番号が必要かどうか AWS Console で確認');
      }
      
      return error;
    }
  };

  console.log('🔍 Cognito デバッグツールがインストールされました');
  console.log('使用方法:');
  console.log('  window.cognitoDebug() - 現在の状態を診断');
  console.log('  window.testCognitoLogin("username", "password") - ログインテスト');
  console.log('  window.testCognitoSignup("username", "email", "password") - 登録テスト');
};
