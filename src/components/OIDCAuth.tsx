import React, { useEffect, useState } from 'react';
import { useAuth } from "react-oidc-context";
import { toast } from 'react-toastify';

interface OIDCAuthProps {
  isOpen?: boolean;
  onClose: () => void;
}

const OIDCAuth: React.FC<OIDCAuthProps> = ({ isOpen = true, onClose }) => {
  const auth = useAuth();
  const [isLoading, setIsLoading] = useState(false);

  if (!isOpen) return null;

  // 处理认证成功
  useEffect(() => {
    if (auth.isAuthenticated && auth.user) {
      console.log('[OIDCAuth] ユーザー認証が成功しました:', {
        email: auth.user.profile.email,
        name: auth.user.profile.name,
        sub: auth.user.profile.sub
      });
      
      toast.success('ログインが成功しました！');
      onClose();
    }
  }, [auth.isAuthenticated, auth.user, onClose]);

  // 处理认证错误
  useEffect(() => {
    if (auth.error) {
      console.error('[OIDCAuth] 認証エラー:', auth.error);
      
      // 特殊处理"No matching state found in storage"错误
      if (auth.error.message && auth.error.message.includes('No matching state found')) {
        console.log('[OIDCAuth] 状態不一致错误，清理缓存并重新开始认证');
        
        // 清理存储的认证状态
        try {
          localStorage.removeItem('oidc.user');
          sessionStorage.removeItem('oidc.user');
          // 清理所有oidc相关的存储
          Object.keys(localStorage).forEach(key => {
            if (key.startsWith('oidc.')) {
              localStorage.removeItem(key);
            }
          });
          Object.keys(sessionStorage).forEach(key => {
            if (key.startsWith('oidc.')) {
              sessionStorage.removeItem(key);
            }
          });
        } catch (cleanupError) {
          console.warn('[OIDCAuth] 清理存储时出错:', cleanupError);
        }
        
        toast.warning('認証状態がリセットされました。再度ログインしてください。');
        return;
      }
      
      // 其他错误的处理
      toast.error(`認証エラー: ${auth.error.message}`);
    }
  }, [auth.error]);

  const handleSignIn = async () => {
    try {
      setIsLoading(true);
      console.log('[OIDCAuth] サインインを開始します...');
      
      // 在开始新的认证流程之前，清理之前的状态
      try {
        // 清理所有oidc相关的存储
        Object.keys(localStorage).forEach(key => {
          if (key.startsWith('oidc.')) {
            localStorage.removeItem(key);
          }
        });
        Object.keys(sessionStorage).forEach(key => {
          if (key.startsWith('oidc.')) {
            sessionStorage.removeItem(key);
          }
        });
        console.log('[OIDCAuth] 既存のOIDC状態をクリアしました');
      } catch (cleanupError) {
        console.warn('[OIDCAuth] 状態クリア中にエラー:', cleanupError);
      }
      
      await auth.signinRedirect();
    } catch (error) {
      console.error('[OIDCAuth] サインイン失敗:', error);
      toast.error('サインインに失敗しました。再試行してください。');
    } finally {
      setIsLoading(false);
    }
  };

  const handleSignOut = () => {
    try {
      console.log('[OIDCAuth] サインアウトを開始します...');
      const clientId = "3tdjflgaoojolmlau5thc9lv5c";
      const logoutUri = "https://d84l1y8p4kdic.cloudfront.net";
      const cognitoDomain = "https://ap-northeast-106lr5s5h9.auth.ap-northeast-1.amazoncognito.com";
      
      window.location.href = `${cognitoDomain}/logout?client_id=${clientId}&logout_uri=${encodeURIComponent(logoutUri)}`;
    } catch (error) {
      console.error('[OIDCAuth] サインアウト失敗:', error);
      toast.error('サインアウトに失敗しました。');
    }
  };

  // 加载状态
  if (auth.isLoading) {
    return (
      <div className="fixed inset-0 z-50 flex items-center justify-center px-4 py-6 bg-black/50">
        <div className="relative z-10 w-full max-w-lg overflow-hidden rounded-lg bg-white shadow-2xl border border-gray-200">
          <div className="p-6 text-center">
            <div className="w-16 h-16 apple-card rounded-full mx-auto mb-4 flex items-center justify-center bg-gradient-to-br from-blue-500 to-purple-600 shadow-lg">
              <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-white"></div>
            </div>
            <h2 className="apple-title text-xl text-gray-900 mb-2">認証中...</h2>
            <p className="apple-text text-gray-600 text-sm">しばらくお待ちください</p>
          </div>
        </div>
      </div>
    );
  }

  // 认证成功状态
  if (auth.isAuthenticated && auth.user) {
    return (
      <div className="fixed inset-0 z-50 flex items-center justify-center px-4 py-6 bg-black/50">
        <div className="absolute inset-0" onClick={onClose}></div>
        <div className="relative z-10 w-full max-w-lg overflow-hidden rounded-lg bg-white shadow-2xl border border-gray-200">
          <button
            onClick={onClose}
            className="absolute top-4 right-4 z-20 flex h-10 w-16 items-center justify-center rounded bg-gray-500 text-white text-sm font-medium hover:bg-gray-600 focus:outline-none"
            aria-label="CLOSE"
          >
            CLOSE
          </button>

          <div className="p-6">
            <div className="text-center mb-6">
              <div className="w-16 h-16 apple-card rounded-full mx-auto mb-4 flex items-center justify-center bg-gradient-to-br from-green-500 to-blue-600 shadow-lg">
                <svg className="w-8 h-8 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M9 12l2 2 4-4m5.618-4.016A11.955 11.955 0 0112 2.944a11.955 11.955 0 01-8.618 3.04A12.02 12.02 0 003 9c0 5.591 3.824 10.29 9 11.622 5.176-1.332 9-6.031 9-11.622 0-1.042-.133-2.052-.382-3.016z" />
                </svg>
              </div>
              <h2 className="apple-title text-xl text-gray-900 mb-2">認証成功</h2>
              <p className="apple-text text-gray-600 text-sm">ようこそ、{auth.user.profile.email}さん</p>
            </div>

            <div className="space-y-4">
              <div className="bg-gray-50 rounded-lg p-4">
                <h3 className="text-sm font-medium text-gray-700 mb-2">ユーザー情報:</h3>
                <div className="text-sm text-gray-600 space-y-1">
                  <p><strong>メール:</strong> {auth.user.profile.email}</p>
                  <p><strong>名前:</strong> {auth.user.profile.name || 'N/A'}</p>
                  <p><strong>電話:</strong> {auth.user.profile.phone_number || 'N/A'}</p>
                </div>
              </div>

              <div className="flex space-x-3">
                <button
                  onClick={onClose}
                  className="flex-1 bg-blue-600 text-white py-2 px-4 rounded-md hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2"
                >
                  続行
                </button>
                <button
                  onClick={handleSignOut}
                  className="flex-1 bg-gray-600 text-white py-2 px-4 rounded-md hover:bg-gray-700 focus:outline-none focus:ring-2 focus:ring-gray-500 focus:ring-offset-2"
                >
                  サインアウト
                </button>
              </div>
            </div>
          </div>
        </div>
      </div>
    );
  }

  // 默认登录界面
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center px-4 py-6 bg-black/50">
      <div className="absolute inset-0" onClick={onClose}></div>
      <div className="relative z-10 w-full max-w-lg overflow-hidden rounded-lg bg-white shadow-2xl border border-gray-200">
        <button
          onClick={onClose}
          className="absolute top-4 right-4 z-20 flex h-10 w-16 items-center justify-center rounded bg-gray-500 text-white text-sm font-medium hover:bg-gray-600 focus:outline-none"
          aria-label="CLOSE"
        >
          CLOSE
        </button>

        <div className="p-6">
          <div className="text-left mb-6">
            <h1 className="text-2xl font-semibold text-gray-800 mb-2">Log in to MonTopi</h1>
          </div>

          {/* 错误显示 */}
          {auth.error && (
            <div className="mb-4 bg-red-50 border border-red-200 rounded-md p-4">
              <div className="flex">
                <div className="flex-shrink-0">
                  <svg className="h-5 w-5 text-red-400" viewBox="0 0 20 20" fill="currentColor">
                    <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zM8.707 7.293a1 1 0 00-1.414 1.414L8.586 10l-1.293 1.293a1 1 0 101.414 1.414L10 11.414l1.293 1.293a1 1 0 001.414-1.414L11.414 10l1.293-1.293a1 1 0 00-1.414-1.414L10 8.586 8.707 7.293z" clipRule="evenodd" />
                  </svg>
                </div>
                <div className="ml-3">
                  <h3 className="text-sm font-medium text-red-800">認証エラー</h3>
                  <div className="mt-2 text-sm text-red-700">
                    <p>{auth.error.message}</p>
                  </div>
                </div>
              </div>
            </div>
          )}

          <div className="space-y-6">
            {/* 主要登录按钮 */}
            <div className="text-center">
              <div className="w-16 h-16 apple-card rounded-full mx-auto mb-4 flex items-center justify-center bg-gradient-to-br from-blue-500 to-purple-600 shadow-lg">
                <svg className="w-8 h-8 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M15.75 5.25a3 3 0 013 3m3 0a6 6 0 01-7.029 5.912c-.563-.097-1.159.026-1.563.43L10.5 17.25H8.25v2.25H6v2.25H2.25v-2.818c0-.597.237-1.17.659-1.591l6.499-6.499c.404-.404.527-1 .43-1.563A6 6 0 1121.75 8.25z" />
                </svg>
              </div>
              <h2 className="apple-title text-xl text-gray-900 mb-2">安全な認証</h2>
              <p className="apple-text text-gray-600 text-sm mb-6">AWS Cognito による認証を開始します</p>
              
              <button
                onClick={handleSignIn}
                disabled={isLoading}
                className={`w-full flex justify-center py-3 px-4 border border-transparent rounded-md shadow-sm text-sm font-medium text-white ${
                  isLoading 
                    ? 'bg-gray-400 cursor-not-allowed' 
                    : 'bg-blue-600 hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500'
                }`}
              >
                {isLoading ? (
                  <>
                    <svg className="animate-spin -ml-1 mr-3 h-5 w-5 text-white" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                      <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                      <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                    </svg>
                    認証中...
                  </>
                ) : (
                  'ログイン / 新規登録'
                )}
              </button>
              
              {/* 认证状态清理按钮 */}
              {auth.error && auth.error.message.includes('No matching state found') && (
                <button
                  onClick={() => {
                    try {
                      // 清理所有OIDC相关的存储
                      Object.keys(localStorage).forEach(key => {
                        if (key.startsWith('oidc.')) {
                          localStorage.removeItem(key);
                        }
                      });
                      Object.keys(sessionStorage).forEach(key => {
                        if (key.startsWith('oidc.')) {
                          sessionStorage.removeItem(key);
                        }
                      });
                      console.log('[OIDCAuth] 手動で認証状態をクリアしました');
                      toast.success('認証状態をリセットしました。再度お試しください。');
                      
                      // 刷新页面以重新初始化OIDC
                      setTimeout(() => {
                        window.location.reload();
                      }, 1000);
                    } catch (error) {
                      console.error('[OIDCAuth] 状態クリア中にエラー:', error);
                    }
                  }}
                  className="w-full mt-2 flex justify-center py-2 px-4 border border-gray-300 rounded-md shadow-sm text-sm font-medium text-gray-700 bg-white hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500"
                >
                  認証状態をリセット
                </button>
              )}
            </div>

            {/* 功能说明 */}
            <div className="bg-blue-50 border border-blue-200 rounded-md p-4">
              <div className="flex">
                <div className="flex-shrink-0">
                  <svg className="h-5 w-5 text-blue-400" viewBox="0 0 20 20" fill="currentColor">
                    <path fillRule="evenodd" d="M18 10a8 8 0 11-16 0 8 8 0 0116 0zm-7-4a1 1 0 11-2 0 1 1 0 012 0zM9 9a1 1 0 000 2v3a1 1 0 001 1h1a1 1 0 100-2v-3a1 1 0 00-1-1H9z" clipRule="evenodd" />
                  </svg>
                </div>
                <div className="ml-3">
                  <h3 className="text-sm font-medium text-blue-800">認証について</h3>
                  <div className="mt-2 text-sm text-blue-700">
                    <ul className="list-disc list-inside space-y-1">
                      <li>AWS Cognito による安全な認証</li>
                      <li>既存アカウントでのログイン</li>
                      <li>新規ユーザーの自動登録</li>
                      <li>メール、電話番号での認証に対応</li>
                      <li>多要素認証（MFA）対応</li>
                      <li>パスワードリセット機能</li>
                    </ul>
                  </div>
                </div>
              </div>
            </div>

            {/* フッター */}
            <div className="text-center pt-4 border-t border-gray-100">
              <p className="apple-text text-xs text-gray-500">
                AWS Cognito OIDC による安全な認証
              </p>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default OIDCAuth;