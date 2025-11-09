import React, { useState } from 'react';
import { signUp, signIn, confirmSignUp } from 'aws-amplify/auth';
import { toast } from 'react-toastify';

interface CognitoAuthProps {
  isOpen?: boolean;
  onClose: () => void;
}

const CognitoAuth: React.FC<CognitoAuthProps> = ({ isOpen = true, onClose }) => {
  const [isLogin, setIsLogin] = useState(true);
  const [username, setUsername] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [confirmationCode, setConfirmationCode] = useState('');
  const [needsConfirmation, setNeedsConfirmation] = useState(false);
  const [loading, setLoading] = useState(false);

  if (!isOpen) return null;

  const handleSignUp = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);

    try {
      const { isSignUpComplete, userId, nextStep } = await signUp({
        username,
        password,
        options: {
          userAttributes: {
            email,
          },
        },
      });

      console.log('SignUp result:', { isSignUpComplete, userId, nextStep });

      if (nextStep.signUpStep === 'CONFIRM_SIGN_UP') {
        toast.success('登録成功！確認コードをメールで送信しました');
        setNeedsConfirmation(true);
      } else if (isSignUpComplete) {
        toast.success('登録成功！ログインしてください');
        setIsLogin(true);
      }
    } catch (error: any) {
      console.error('SignUp error:', error);
      
      let errorMessage = '登録に失敗しました';
      if (error.name === 'UsernameExistsException') {
        errorMessage = 'このユーザー名は既に使用されています';
      } else if (error.name === 'InvalidPasswordException') {
        errorMessage = 'パスワードは8文字以上で、大文字・小文字・数字を含む必要があります';
      } else if (error.name === 'InvalidParameterException') {
        errorMessage = '入力内容が無効です。メールアドレスを確認してください';
      } else if (error.message) {
        errorMessage = error.message;
      }
      
      toast.error(errorMessage);
    } finally {
      setLoading(false);
    }
  };

  const handleConfirmSignUp = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);

    try {
      await confirmSignUp({
        username,
        confirmationCode,
      });

      toast.success('メール確認完了！ログインしてください');
      setNeedsConfirmation(false);
      setIsLogin(true);
      setConfirmationCode('');
    } catch (error: any) {
      console.error('Confirmation error:', error);
      toast.error(error.message || '確認に失敗しました');
    } finally {
      setLoading(false);
    }
  };

  const handleSignIn = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);

    try {
      const { isSignedIn, nextStep } = await signIn({
        username,
        password,
      });

      if (isSignedIn) {
        toast.success('ログイン成功！');
        onClose();
        window.location.reload(); // ページをリロードしてユーザー情報を更新
      } else if (nextStep.signInStep === 'CONFIRM_SIGN_UP') {
        toast.warning('メールアドレスの確認が必要です');
        setNeedsConfirmation(true);
      }
    } catch (error: any) {
      console.error('SignIn error:', error);
      
      let errorMessage = 'ログインに失敗しました';
      if (error.name === 'NotAuthorizedException') {
        errorMessage = 'ユーザー名またはパスワードが正しくありません';
      } else if (error.name === 'UserNotConfirmedException') {
        errorMessage = 'メールアドレスが未確認です';
        setNeedsConfirmation(true);
      } else if (error.message) {
        errorMessage = error.message;
      }
      
      toast.error(errorMessage);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
      <div className="bg-white rounded-lg p-8 max-w-md w-full mx-4">
        <div className="flex justify-between items-center mb-6">
          <h2 className="text-2xl font-bold">
            {needsConfirmation ? 'メール確認' : isLogin ? 'ログイン' : '新規登録'}
          </h2>
          <button
            onClick={onClose}
            className="text-gray-500 hover:text-gray-700 text-2xl"
          >
            ×
          </button>
        </div>

        {needsConfirmation ? (
          <form onSubmit={handleConfirmSignUp} className="space-y-4">
            <p className="text-sm text-gray-600 mb-4">
              {email} に確認コードを送信しました。メールをご確認ください。
            </p>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                確認コード
              </label>
              <input
                type="text"
                value={confirmationCode}
                onChange={(e) => setConfirmationCode(e.target.value)}
                className="w-full px-3 py-2 border border-gray-300 rounded-md"
                placeholder="123456"
                required
              />
            </div>
            <button
              type="submit"
              disabled={loading}
              className="w-full bg-blue-600 text-white py-2 px-4 rounded-md hover:bg-blue-700 disabled:opacity-50"
            >
              {loading ? '確認中...' : '確認'}
            </button>
            <button
              type="button"
              onClick={() => setNeedsConfirmation(false)}
              className="w-full text-blue-600 hover:underline text-sm"
            >
              戻る
            </button>
          </form>
        ) : isLogin ? (
          <form onSubmit={handleSignIn} className="space-y-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                ユーザー名
              </label>
              <input
                type="text"
                value={username}
                onChange={(e) => setUsername(e.target.value)}
                className="w-full px-3 py-2 border border-gray-300 rounded-md"
                required
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                パスワード
              </label>
              <input
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                className="w-full px-3 py-2 border border-gray-300 rounded-md"
                required
              />
            </div>
            <button
              type="submit"
              disabled={loading}
              className="w-full bg-blue-600 text-white py-2 px-4 rounded-md hover:bg-blue-700 disabled:opacity-50"
            >
              {loading ? 'ログイン中...' : 'ログイン'}
            </button>
            <button
              type="button"
              onClick={() => setIsLogin(false)}
              className="w-full text-blue-600 hover:underline text-sm"
            >
              アカウントをお持ちでない方はこちら
            </button>
          </form>
        ) : (
          <form onSubmit={handleSignUp} className="space-y-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                ユーザー名
              </label>
              <input
                type="text"
                value={username}
                onChange={(e) => setUsername(e.target.value)}
                className="w-full px-3 py-2 border border-gray-300 rounded-md"
                required
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                メールアドレス
              </label>
              <input
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                className="w-full px-3 py-2 border border-gray-300 rounded-md"
                required
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                パスワード
              </label>
              <input
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                className="w-full px-3 py-2 border border-gray-300 rounded-md"
                placeholder="8文字以上、大文字・小文字・数字を含む"
                required
              />
            </div>
            <button
              type="submit"
              disabled={loading}
              className="w-full bg-blue-600 text-white py-2 px-4 rounded-md hover:bg-blue-700 disabled:opacity-50"
            >
              {loading ? '登録中...' : '登録'}
            </button>
            <button
              type="button"
              onClick={() => setIsLogin(true)}
              className="w-full text-blue-600 hover:underline text-sm"
            >
              すでにアカウントをお持ちの方はこちら
            </button>
          </form>
        )}
      </div>
    </div>
  );
};

export default CognitoAuth;
