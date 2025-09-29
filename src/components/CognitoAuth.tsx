import React, { useEffect } from 'react';
import { Authenticator, useAuthenticator } from '@aws-amplify/ui-react';
import '@aws-amplify/ui-react/styles.css';
// AWS Amplify Auth functions are handled by the CognitoUserContext
import { useCognitoUser } from '../contexts/CognitoUserContext';
import { useUser } from '../contexts/UserContext';
import { toast } from 'react-toastify';

interface CognitoAuthProps {
  isOpen?: boolean;
  onClose: () => void;
}

// 自定义认证包装组件
const AuthWrapper: React.FC<{ onClose: () => void }> = ({ onClose }) => {
  const { user, route } = useAuthenticator((context) => [context.user, context.route]);
  const { refreshCognitoUser } = useCognitoUser();
  const { syncAccessRights } = useUser();

  useEffect(() => {
    // 当用户成功认证后
    if (user && route === 'authenticated') {
      handleAuthSuccess();
    }
  }, [user, route]);

  const handleAuthSuccess = async () => {
    try {
      console.log('[CognitoAuth] ユーザー認証が成功しました。処理を開始します...');
      
      // Cognitoユーザー状态を更新
      await refreshCognitoUser();
      
      // UserContext状态も同期
      await syncAccessRights();
      
      // 成功メッセージを表示
      toast.success('ログインが成功しました！');
      
      // 認証ダイアログを閉じる
      onClose();
      
      console.log('[CognitoAuth] 認証成功処理が完了しました');
    } catch (error) {
      console.error('[CognitoAuth] 認証成功処理中にエラーが発生しました:', error);
      toast.error('ログイン処理に失敗しました。再試行してください');
    }
  };

  return null; // 这个组件不需要渲染任何UI，只负责处理认证成功逻辑
};

const CognitoAuth: React.FC<CognitoAuthProps> = ({ isOpen = true, onClose }) => {
  if (!isOpen) return null;

  const formFields = {
    signIn: {
      username: {
        placeholder: 'ユーザー名またはメールアドレスを入力してください',
        label: 'ユーザー名/メール',
        isRequired: true,
      },
      password: {
        placeholder: 'パスワードを入力してください',
        label: 'パスワード',
        isRequired: true,
      }
    },
    signUp: {
      username: {
        placeholder: 'ユーザー名を入力してください（4-20文字の英数字）',
        label: 'ユーザー名',
        isRequired: true,
        order: 1,
      },
      email: {
        placeholder: 'メールアドレスを入力してください',
        label: 'メールアドレス',
        isRequired: true,
        order: 2,
      },
      phone_number: {
        placeholder: '電話番号を入力してください（例：+81-90-1234-5678）',
        label: '電話番号',
        isRequired: true,
        order: 3,
        dialCode: '+81',
      },
      password: {
        placeholder: 'パスワードを入力してください（8文字以上）',
        label: 'パスワード',
        isRequired: true,
        order: 4,
      },
      confirm_password: {
        placeholder: 'パスワードを再入力してください',
        label: 'パスワード確認',
        isRequired: true,
        order: 5,
      }
    },
    forceNewPassword: {
      password: {
        placeholder: '新しいパスワードを入力してください',
        label: '新しいパスワード',
      }
    },
    forgotPassword: {
      username: {
        placeholder: 'ユーザー名・メール・電話番号を入力してください',
        label: 'ユーザー名/メール/電話番号',
      }
    },
    confirmResetPassword: {
      username: {
        placeholder: 'ユーザー名・メール・電話番号を入力してください',
        label: 'ユーザー名/メール/電話番号',
      },
      confirmation_code: {
        placeholder: '確認コードを入力してください',
        label: '確認コード',
      },
      password: {
        placeholder: '新しいパスワードを入力してください',
        label: '新しいパスワード',
      }
    }
  };

  const components = {
    Header() {
      return (
        <div className="text-center mb-8">
          <div className="w-20 h-20 apple-card rounded-full mx-auto mb-6 flex items-center justify-center bg-gradient-to-br from-blue-500 to-indigo-600 shadow-lg">
            <svg className="w-10 h-10 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M15.75 6a3.75 3.75 0 11-7.5 0 3.75 3.75 0 017.5 0zM4.501 20.118a7.5 7.5 0 0114.998 0A17.933 17.933 0 0112 21.75c-2.676 0-5.216-.584-7.499-1.632z" />
            </svg>
          </div>
          <h1 className="apple-title text-3xl text-gray-900 mb-3">おかえりなさい</h1>
          <p className="apple-text text-gray-600">アカウントにログインしてご利用ください</p>
        </div>
      );
    },
    SignIn: {
      Footer() {
        return (
          <div className="mt-6">
            <div className="apple-badge rounded-xl p-4 text-center">
              <p className="apple-text text-sm text-gray-600">
                <strong>ログイン方法:</strong> ユーザー名・メールアドレス・電話番号
              </p>
            </div>
          </div>
        );
      }
    },
    Footer() {
      return (
        <div className="text-center mt-8 pt-6 border-t border-gray-100">
          <div className="flex items-center justify-center space-x-2 apple-text text-sm text-gray-500">
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4M21 12c0 1.268-.63 2.39-1.593 3.068a3.745 3.745 0 01-1.043 3.296 3.745 3.745 0 01-3.296 1.043A3.745 3.745 0 0112 21c-1.268 0-2.39-.63-3.068-1.593a3.746 3.746 0 01-3.296-1.043 3.745 3.745 0 01-1.043-3.296A3.745 3.745 0 013 12c0-1.268.63-2.39 1.593-3.068a3.745 3.745 0 011.043-3.296 3.746 3.746 0 013.296-1.043A3.746 3.746 0 0112 3c1.268 0 2.39.63 3.068 1.593a3.746 3.746 0 013.296 1.043 3.746 3.746 0 011.043 3.296A3.745 3.745 0 0121 12z" />
            </svg>
            <span>AWS Cognito による安全な認証</span>
          </div>
        </div>
      );
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center px-4 py-6 bg-black/60 backdrop-blur-xl">
      <div className="absolute inset-0" onClick={onClose}></div>
      <div className="relative z-10 w-full max-w-4xl overflow-hidden apple-card rounded-3xl bg-white/95 backdrop-filter backdrop-blur-xl shadow-[0_40px_100px_-20px_rgba(0,0,0,0.2)] border border-white/20">
        {/* 閉じるボタン */}
        <button
          onClick={onClose}
          className="absolute top-6 right-6 z-20 flex h-12 w-12 items-center justify-center rounded-full bg-white/80 backdrop-blur-sm text-gray-500 shadow-sm apple-button hover:bg-white hover:text-gray-700 focus:outline-none focus:ring-2 focus:ring-blue-500/20"
          aria-label="閉じる"
        >
          <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
          </svg>
        </button>

        <div className="grid grid-cols-1 lg:grid-cols-[1fr_1fr] min-h-[600px]">
          <div className="hidden lg:flex flex-col justify-between bg-gradient-to-br from-blue-600 via-indigo-500 to-purple-500 px-10 py-12 text-blue-50">
            <div>
              <span className="inline-flex items-center gap-2 rounded-full bg-white/15 px-3 py-1 text-xs font-semibold uppercase tracking-[0.18em] text-blue-100">
                安全な認証
              </span>
              <h2 className="mt-6 text-3xl font-bold leading-tight text-white">
                学習に集中できる、スムーズなログイン体験。
              </h2>
              <p className="mt-4 text-base leading-relaxed text-blue-100">
                AWS Cognito による多要素認証で、どのデバイスからでも安心してアクセスできます。
              </p>
            </div>
            <ul className="mt-8 space-y-5 text-sm leading-relaxed">
              <li className="flex items-start gap-3">
                <span className="mt-1 inline-flex h-6 w-6 items-center justify-center rounded-full bg-white/20 text-xs font-bold text-white">1</span>
                <span>SMS・メールコードの二段階認証に対応し、パスワードを忘れてもすぐ復旧。</span>
              </li>
              <li className="flex items-start gap-3">
                <span className="mt-1 inline-flex h-6 w-6 items-center justify-center rounded-full bg-white/20 text-xs font-bold text-white">2</span>
                <span>購入済み教材と学習記録を自動同期し、どこでも継続学習が可能。</span>
              </li>
              <li className="flex items-start gap-3">
                <span className="mt-1 inline-flex h-6 w-6 items-center justify-center rounded-full bg-white/20 text-xs font-bold text-white">3</span>
                <span>管理者チームが 24 時間モニタリングし、安全な学習環境を維持します。</span>
              </li>
            </ul>
          </div>

          <div className="relative flex flex-col justify-center bg-white/80 backdrop-blur-sm p-8 sm:p-10 lg:p-12 auth-container">
            <div className="mb-8 apple-card rounded-2xl p-6 text-center lg:hidden">
              <h2 className="apple-title text-2xl text-gray-900 mb-2">安全なログイン</h2>
              <p className="apple-text text-gray-600">
                シンプルで安全な認証体験
              </p>
            </div>
            <style>{`
              @import url('https://fonts.googleapis.com/css2?family=Inter:wght@300;400;500;600;700&display=swap');

              /* Apple风格基础样式 */
              .apple-card {
                backdrop-filter: blur(20px);
                -webkit-backdrop-filter: blur(20px);
                border: 1px solid rgba(255, 255, 255, 0.18);
                background: rgba(255, 255, 255, 0.9);
                transition: all 0.3s cubic-bezier(0.25, 0.46, 0.45, 0.94);
              }
              
              .apple-button {
                font-family: 'Inter', -apple-system, BlinkMacSystemFont, sans-serif;
                font-weight: 500;
                border-radius: 12px;
                transition: all 0.2s cubic-bezier(0.25, 0.46, 0.45, 0.94);
              }
              
              .apple-button:hover {
                transform: translateY(-1px);
                box-shadow: 0 8px 25px rgba(59, 130, 246, 0.3);
              }
              
              .apple-text {
                font-family: 'Inter', -apple-system, BlinkMacSystemFont, sans-serif;
                font-weight: 400;
                letter-spacing: -0.01em;
              }
              
              .apple-title {
                font-family: 'Inter', -apple-system, BlinkMacSystemFont, sans-serif;
                font-weight: 600;
                letter-spacing: -0.02em;
              }
              
              .apple-hero {
                background: linear-gradient(135deg, #3B82F6 0%, #1E40AF 100%);
                background-size: 200% 200%;
                animation: gradientShift 8s ease infinite;
              }
              
              @keyframes gradientShift {
                0% { background-position: 0% 50%; }
                50% { background-position: 100% 50%; }
                100% { background-position: 0% 50%; }
              }
              
              .apple-badge {
                backdrop-filter: blur(10px);
                -webkit-backdrop-filter: blur(10px);
                background: rgba(255, 255, 255, 0.8);
                border: 1px solid rgba(255, 255, 255, 0.2);
              }

              .auth-container {
                position: relative;
                isolation: isolate;
                font-family: 'Inter', -apple-system, BlinkMacSystemFont, sans-serif;
              }

              .auth-container [data-amplify-authenticator] {
                width: 100%;
                --amplify-components-authenticator-modal-width: 100%;
                --amplify-components-authenticator-modal-height: auto;
                --amplify-components-authenticator-router-background-color: transparent;
                --amplify-components-authenticator-router-border-radius: 20px;
                --amplify-components-authenticator-router-box-shadow: none;
                --amplify-components-button-primary-background-color: #3b82f6;
                --amplify-components-button-primary-hover-background-color: #2563eb;
                --amplify-components-button-border-radius: 12px;
                --amplify-components-fieldcontrol-border-radius: 12px;
                --amplify-components-fieldcontrol-focus-border-color: #3b82f6;
                --amplify-space-medium: 2rem;
                --amplify-space-small: 1.25rem;
                font-family: 'Inter', -apple-system, BlinkMacSystemFont, sans-serif;
              }

              .auth-container [data-amplify-authenticator][data-variation="modal"] {
                position: static;
                inset: auto;
                background-color: transparent;
                width: 100%;
                height: auto;
              }

              .auth-container [data-amplify-container] {
                width: 100%;
                max-width: none;
              }

              .auth-container [data-amplify-router] {
                background: rgba(255, 255, 255, 0.95);
                backdrop-filter: blur(20px);
                -webkit-backdrop-filter: blur(20px);
                border-radius: 20px;
                border: 1px solid rgba(255, 255, 255, 0.2);
                padding: 2.5rem;
                box-shadow: 0 25px 50px -12px rgba(0, 0, 0, 0.1);
              }

              .auth-container .amplify-button--primary {
                background: linear-gradient(135deg, #3b82f6 0%, #1e40af 100%) !important;
                border: none !important;
                font-weight: 500 !important;
                font-family: 'Inter', -apple-system, BlinkMacSystemFont, sans-serif !important;
                padding: 1rem 2rem !important;
                border-radius: 12px !important;
                transition: all 0.2s cubic-bezier(0.25, 0.46, 0.45, 0.94) !important;
                letter-spacing: -0.01em !important;
                font-size: 1rem !important;
              }

              .auth-container .amplify-button--primary:hover {
                transform: translateY(-1px) !important;
                box-shadow: 0 8px 25px rgba(59, 130, 246, 0.3) !important;
                background: linear-gradient(135deg, #2563eb 0%, #1d4ed8 100%) !important;
              }

              .auth-container .amplify-input {
                border: 1px solid rgba(209, 213, 219, 0.6) !important;
                background: rgba(249, 250, 251, 0.8) !important;
                backdrop-filter: blur(10px) !important;
                transition: all 0.2s cubic-bezier(0.25, 0.46, 0.45, 0.94) !important;
                padding-block: 1rem !important;
                font-size: 1rem !important;
                font-family: 'Inter', -apple-system, BlinkMacSystemFont, sans-serif !important;
                border-radius: 12px !important;
                font-weight: 400 !important;
              }

              .auth-container .amplify-input:focus {
                border-color: #3b82f6 !important;
                box-shadow: 0 0 0 4px rgba(59, 130, 246, 0.08) !important;
                background: rgba(255, 255, 255, 0.95) !important;
              }

              .auth-container .amplify-label {
                font-family: 'Inter', -apple-system, BlinkMacSystemFont, sans-serif !important;
                font-weight: 500 !important;
                color: #374151 !important;
                letter-spacing: -0.01em !important;
                margin-bottom: 0.5rem !important;
              }

              .auth-container .amplify-tabs-item {
                font-weight: 500 !important;
                font-family: 'Inter', -apple-system, BlinkMacSystemFont, sans-serif !important;
                color: #6b7280 !important;
                border-radius: 8px !important;
                transition: all 0.2s cubic-bezier(0.25, 0.46, 0.45, 0.94) !important;
              }

              .auth-container .amplify-tabs-item[data-state="active"] {
                color: #3b82f6 !important;
                background-color: rgba(59, 130, 246, 0.08) !important;
                border-bottom-color: transparent !important;
              }

              .auth-container .amplify-alert--error {
                background: rgba(254, 242, 242, 0.9) !important;
                backdrop-filter: blur(10px) !important;
                border: 1px solid rgba(252, 165, 165, 0.3) !important;
                color: #dc2626 !important;
                border-radius: 12px !important;
                font-family: 'Inter', -apple-system, BlinkMacSystemFont, sans-serif !important;
              }

              .auth-container .amplify-link {
                color: #3b82f6 !important;
                font-weight: 500 !important;
                font-family: 'Inter', -apple-system, BlinkMacSystemFont, sans-serif !important;
                transition: all 0.2s cubic-bezier(0.25, 0.46, 0.45, 0.94) !important;
                text-decoration: none !important;
              }

              .auth-container .amplify-link:hover {
                color: #2563eb !important;
                transform: translateY(-0.5px) !important;
              }

              .auth-container .amplify-tabs {
                border-bottom: 1px solid rgba(229, 231, 235, 0.6) !important;
              }

              .auth-container .amplify-fieldgroup {
                gap: 1.25rem !important;
              }
            `}</style>

            <Authenticator
              formFields={formFields}
              components={components}
              socialProviders={[]}
              signUpAttributes={['email', 'phone_number']}
              loginMechanisms={['username', 'email']}
              variation="modal"
              hideSignUp={false}
              initialState="signIn"
            >
              <AuthWrapper onClose={onClose} />
            </Authenticator>
          </div>
        </div>
      </div>
    </div>
  );
};

export default CognitoAuth;