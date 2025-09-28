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
        <div className="text-center mb-6">
          <div className="w-16 h-16 bg-gradient-to-r from-blue-500 to-purple-600 rounded-full mx-auto mb-4 flex items-center justify-center">
            <svg className="w-8 h-8 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z" />
            </svg>
          </div>
          <h1 className="text-2xl font-bold text-gray-800 mb-2">おかえりなさい</h1>
          <p className="text-gray-600 text-sm">アカウントにログインしてご利用ください</p>
        </div>
      );
    },
    SignIn: {
      Footer() {
        return (
          <div className="mt-4 space-y-3">
            <div className="text-center">
              <div className="text-sm text-gray-500 mb-3">利用可能な認証方法</div>
              <div className="grid grid-cols-1 gap-2 text-sm">
                <div className="flex items-center justify-center space-x-2 text-blue-600 bg-blue-50 p-2 rounded">
                  <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" />
                  </svg>
                  <span>ユーザー名 + パスワード</span>
                </div>
                <div className="flex items-center justify-center space-x-2 text-green-600 bg-green-50 p-2 rounded">
                  <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 8l7.89 4.26a2 2 0 002.22 0L21 8M5 19h14a2 2 0 002-2V7a2 2 0 00-2 2v10a2 2 0 002 2z" />
                  </svg>
                  <span>メールアドレス + パスワード</span>
                </div>
              </div>
              <div className="mt-3 p-3 bg-blue-50 rounded-lg border border-blue-200">
                <p className="text-xs text-blue-700">
                  <strong>� ログインについて:</strong><br/>
                  ・ユーザー名またはメールアドレスでログイン可能<br/>
                  ・パスワードを忘れた場合は「パスワードをお忘れですか？」をクリック<br/>
                  ・初回利用の場合は新規アカウント作成が必要です
                </p>
              </div>
            </div>
          </div>
        );
      }
    },
    Footer() {
      return (
        <div className="text-center mt-6 pt-4 border-t border-gray-100">
          <div className="flex items-center justify-center space-x-2 text-sm text-gray-500">
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m5.618-4.016A11.955 11.955 0 0112 2.944a11.955 11.955 0 01-8.618 3.04A12.02 12.02 0 003 9c0 5.591 3.824 10.29 9 11.622 5.176-1.332 9-6.03 9-11.622 0-1.042-.133-2.052-.382-3.016z" />
            </svg>
            <span>AWS Cognito による安全な認証</span>
          </div>
        </div>
      );
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center px-4 py-6 sm:px-6 lg:px-10 bg-black/70 backdrop-blur-md">
      <div className="absolute inset-0" onClick={onClose}></div>
      <div className="relative z-10 w-full max-w-5xl overflow-hidden rounded-3xl bg-white shadow-[0_40px_80px_-40px_rgba(15,23,42,0.55)] ring-1 ring-slate-900/10">
        {/* 閉じるボタン */}
        <button
          onClick={onClose}
          className="absolute top-4 right-4 z-20 flex h-10 w-10 items-center justify-center rounded-full bg-white/90 text-gray-500 shadow-lg transition-all hover:bg-white hover:text-gray-700 hover:shadow-xl focus:outline-none focus:ring-2 focus:ring-blue-400"
          aria-label="閉じる"
        >
          <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
          </svg>
        </button>

        <div className="grid grid-cols-1 lg:grid-cols-[1.08fr_1fr] min-h-[560px]">
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

          <div className="relative flex flex-col justify-center bg-white p-6 sm:p-8 lg:p-10 auth-container">
            <div className="mb-6 rounded-2xl bg-gradient-to-br from-blue-600 via-indigo-500 to-purple-500 p-6 text-white shadow-xl lg:hidden">
              <h2 className="text-2xl font-bold">安全な認証でログイン</h2>
              <p className="mt-2 text-sm text-blue-100">
                AWS Cognito を利用したマルチ認証で、モバイルからでも安心してアクセスできます。
              </p>
            </div>
            <style>{`
              .auth-container {
                position: relative;
                isolation: isolate;
              }

              .auth-container [data-amplify-authenticator] {
                width: 100%;
                --amplify-components-authenticator-modal-width: clamp(360px, 92vw, 920px);
                --amplify-components-authenticator-modal-height: auto;
                --amplify-components-authenticator-modal-top: auto;
                --amplify-components-authenticator-modal-left: auto;
                --amplify-components-authenticator-container-width-max: clamp(320px, 80vw, 560px);
                --amplify-components-authenticator-router-background-color: transparent;
                --amplify-components-authenticator-router-border-radius: 1.25rem;
                --amplify-components-authenticator-router-box-shadow: none;
                --amplify-components-button-primary-background-color: #3b82f6;
                --amplify-components-button-primary-hover-background-color: #2563eb;
                --amplify-components-button-border-radius: 0.75rem;
                --amplify-components-fieldcontrol-border-radius: 0.75rem;
                --amplify-components-fieldcontrol-focus-border-color: #3b82f6;
                --amplify-space-medium: 1.75rem;
                --amplify-space-small: 1.1rem;
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
                background: #ffffff;
                border-radius: 1.25rem;
                border: 1px solid rgba(226, 232, 240, 0.8);
                padding: clamp(1.5rem, 2.6vw, 2.5rem);
                box-shadow: 0 35px 60px -40px rgba(15, 23, 42, 0.45);
              }

              .auth-container .amplify-button--primary {
                background: linear-gradient(135deg, #3b82f6 0%, #8b5cf6 100%) !important;
                border: none !important;
                font-weight: 600 !important;
                padding: 0.85rem 1.6rem !important;
                transition: all 0.2s ease !important;
              }

              .auth-container .amplify-button--primary:hover {
                transform: translateY(-2px) !important;
                box-shadow: 0 8px 18px rgba(59, 130, 246, 0.35) !important;
              }

              .auth-container .amplify-input {
                border: 2px solid #e5e7eb !important;
                transition: all 0.2s ease !important;
                padding-block: 0.85rem !important;
                font-size: 1rem !important;
              }

              .auth-container .amplify-input:focus {
                border-color: #3b82f6 !important;
                box-shadow: 0 0 0 3px rgba(59, 130, 246, 0.12) !important;
              }

              .auth-container .amplify-tabs-item {
                font-weight: 600 !important;
                color: #6b7280 !important;
              }

              .auth-container .amplify-tabs-item[data-state="active"] {
                color: #3b82f6 !important;
                border-bottom-color: #3b82f6 !important;
              }

              .auth-container .amplify-alert--error {
                background-color: #fef2f2 !important;
                border-color: #fecaca !important;
                color: #dc2626 !important;
                border-radius: 0.75rem !important;
              }

              .auth-container .amplify-link {
                color: #3b82f6 !important;
                font-weight: 500 !important;
              }

              .auth-container .amplify-link:hover {
                color: #2563eb !important;
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