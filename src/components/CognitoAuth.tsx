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
        placeholder: 'Email or nickname',
        label: '',
        isRequired: true,
      },
      password: {
        placeholder: 'Password',
        label: '',
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
        isRequired: true,
      }
    },
    confirmResetPassword: {
      username: {
        placeholder: 'ユーザー名・メール・電話番号を入力してください',
        label: 'ユーザー名/メール/電話番号',
        isRequired: true,
      },
      confirmation_code: {
        placeholder: '確認コードを入力してください',
        label: '確認コード',
        isRequired: true,
      },
      password: {
        placeholder: '新しいパスワードを入力してください',
        label: '新しいパスワード',
        isRequired: true,
      }
    }
  };

  const components = {
    Header() {
      return null; // 移除默认标题，使用自定义标题
    },
    SignIn: {
      Header() {
        return (
          <div className="mb-6">
            <h2 className="text-lg font-medium text-gray-700 mb-4">Sign in:</h2>
          </div>
        );
      },
      Footer() {
        const { toSignUp, toForgotPassword } = useAuthenticator();
        
        return (
          <div className="mt-6 text-sm text-gray-600">
            <p>Don't have an account yet? just <button 
              type="button" 
              className="text-blue-500 hover:text-blue-600 font-medium"
              onClick={() => toSignUp()}
            >sign-up</button>.</p>
            <p className="mt-2">� <button 
              type="button" 
              className="text-blue-500 hover:text-blue-600"
              onClick={() => toForgotPassword()}
            >パスワードを忘れましたか？</button></p>
          </div>
        );
      }
    },
    SignUp: {
      Header() {
        return (
          <div className="mb-6">
            <h2 className="text-lg font-medium text-gray-700 mb-4">アカウントを作成:</h2>
          </div>
        );
      },
      Footer() {
        const { toSignIn } = useAuthenticator();
        
        return (
          <div className="mt-6 text-sm text-gray-600">
            <p>既にアカウントをお持ちですか？ <button 
              type="button" 
              className="text-blue-500 hover:text-blue-600 font-medium"
              onClick={() => toSignIn()}
            >サインイン</button></p>
          </div>
        );
      }
    },
    ForgotPassword: {
      Header() {
        return (
          <div className="text-center mb-6">
            <div className="w-16 h-16 apple-card rounded-full mx-auto mb-4 flex items-center justify-center bg-gradient-to-br from-orange-500 to-red-600 shadow-lg">
              <svg className="w-8 h-8 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M15.75 5.25a3 3 0 013 3m3 0a6 6 0 01-7.029 5.912c-.563-.097-1.159.026-1.563.43L10.5 17.25H8.25v2.25H6v2.25H2.25v-2.818c0-.597.237-1.17.659-1.591l6.499-6.499c.404-.404.527-1 .43-1.563A6 6 0 1121.75 8.25z" />
              </svg>
            </div>
            <h2 className="apple-title text-xl text-gray-900 mb-2">パスワードを忘れましたか？</h2>
            <p className="apple-text text-gray-600 text-sm">メールアドレスまたは電話番号でリセットできます</p>
          </div>
        );
      },
      Footer() {
        const { toSignIn } = useAuthenticator();
        
        return (
          <div className="mt-4">
            <div className="apple-badge rounded-xl p-3 text-center">
              <p className="apple-text text-xs text-gray-600">
                <strong>リセット方法:</strong> メールまたはSMSで確認コードを送信
              </p>
            </div>
            <div className="mt-4 text-center">
              <button 
                type="button" 
                className="text-blue-500 hover:text-blue-600 font-medium text-sm"
                onClick={() => toSignIn()}
              >← サインインに戻る</button>
            </div>
          </div>
        );
      }
    },
    ConfirmResetPassword: {
      Header() {
        return (
          <div className="text-center mb-6">
            <div className="w-16 h-16 apple-card rounded-full mx-auto mb-4 flex items-center justify-center bg-gradient-to-br from-green-500 to-blue-600 shadow-lg">
              <svg className="w-8 h-8 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M9 12l2 2 4-4m5.618-4.016A11.955 11.955 0 0112 2.944a11.955 11.955 0 01-8.618 3.04A12.02 12.02 0 003 9c0 5.591 3.824 10.29 9 11.622 5.176-1.332 9-6.031 9-11.622 0-1.042-.133-2.052-.382-3.016z" />
              </svg>
            </div>
            <h2 className="apple-title text-xl text-gray-900 mb-2">パスワードをリセット</h2>
            <p className="apple-text text-gray-600 text-sm">確認コードと新しいパスワードを入力してください</p>
          </div>
        );
      },
      Footer() {
        const { toSignIn, toForgotPassword } = useAuthenticator();
        
        return (
          <div className="mt-4">
            <div className="apple-badge rounded-xl p-3 text-center">
              <p className="apple-text text-xs text-gray-600">
                確認コードが送られてこない場合は、迷惑メールをチェックしてください
              </p>
            </div>
            <div className="mt-4 text-center space-x-4">
              <button 
                type="button" 
                className="text-blue-500 hover:text-blue-600 font-medium text-sm"
                onClick={() => toForgotPassword()}
              >← コード再送信</button>
              <button 
                type="button" 
                className="text-gray-500 hover:text-gray-600 font-medium text-sm"
                onClick={() => toSignIn()}
              >サインインに戻る</button>
            </div>
          </div>
        );
      }
    },
    Footer() {
      return (
        <div className="text-center mt-4 pt-4 border-t border-gray-100">
          <p className="apple-text text-xs text-gray-500">
            AWS Cognito による安全な認証
          </p>
        </div>
      );
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center px-4 py-6 bg-black/50">
      <div className="absolute inset-0" onClick={onClose}></div>
      <div className="relative z-10 w-full max-w-lg overflow-hidden rounded-lg bg-white shadow-2xl border border-gray-200">
        {/* 閉じるボタン */}
        <button
          onClick={onClose}
          className="absolute top-4 right-4 z-20 flex h-10 w-16 items-center justify-center rounded bg-gray-500 text-white text-sm font-medium hover:bg-gray-600 focus:outline-none"
          aria-label="CLOSE"
        >
          CLOSE
        </button>

        <div className="p-6">
          <div className="text-left mb-6">
            <h1 className="text-2xl font-semibold text-gray-800 mb-2">Log in to ExamTopics</h1>
          </div>
          
          <div className="auth-container">
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
                background: transparent;
                border: none;
                padding: 0;
                box-shadow: none;
              }

              .auth-container .amplify-button--primary {
                background: #3b82f6 !important;
                border: none !important;
                font-weight: 600 !important;
                font-family: 'Inter', -apple-system, BlinkMacSystemFont, sans-serif !important;
                padding: 1rem 2rem !important;
                border-radius: 8px !important;
                transition: all 0.2s ease !important;
                letter-spacing: 0.05em !important;
                font-size: 1rem !important;
                text-transform: uppercase !important;
                width: 100% !important;
              }

              .auth-container .amplify-button--primary:hover {
                transform: translateY(-1px) !important;
                box-shadow: 0 8px 25px rgba(59, 130, 246, 0.3) !important;
                background: linear-gradient(135deg, #2563eb 0%, #1d4ed8 100%) !important;
              }

              .auth-container .amplify-input {
                border: 2px solid #e5e7eb !important;
                background: #f8f9fa !important;
                transition: all 0.2s ease !important;
                padding: 1rem !important;
                padding-left: 3.5rem !important;
                font-size: 1rem !important;
                font-family: 'Inter', -apple-system, BlinkMacSystemFont, sans-serif !important;
                border-radius: 8px !important;
                font-weight: 400 !important;
              }

              /* 添加输入框图标 */
              .auth-container .amplify-field:has(input[name="username"])::before {
                content: "👤";
                position: absolute;
                left: 1rem;
                top: 50%;
                transform: translateY(-50%);
                font-size: 1.25rem;
                z-index: 10;
                background: #3b82f6;
                color: white;
                width: 2rem;
                height: 2rem;
                display: flex;
                align-items: center;
                justify-content: center;
                border-radius: 4px;
              }

              .auth-container .amplify-field:has(input[name="password"])::before {
                content: "🔒";
                position: absolute;
                left: 1rem;
                top: 50%;
                transform: translateY(-50%);
                font-size: 1.25rem;
                z-index: 10;
                background: #3b82f6;
                color: white;
                width: 2rem;
                height: 2rem;
                display: flex;
                align-items: center;
                justify-content: center;
                border-radius: 4px;
              }

              .auth-container .amplify-field {
                position: relative;
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

              /* 忘记密码链接样式 */
              .auth-container .amplify-link {
                color: #3b82f6 !important;
                font-weight: 400 !important;
                font-family: 'Inter', -apple-system, BlinkMacSystemFont, sans-serif !important;
                transition: all 0.2s ease !important;
                text-decoration: none !important;
                font-size: 0.875rem !important;
              }

              .auth-container .amplify-link:hover {
                color: #2563eb !important;
                text-decoration: underline !important;
              }

              /* 特别针对忘记密码链接的样式 */
              .auth-container [data-amplify-router] button[type="button"]:not([data-amplify-button-variation]) {
                color: #6b7280 !important;
                background: none !important;
                border: none !important;
                font-size: 0.875rem !important;
                font-weight: 500 !important;
                padding: 0.5rem 0 !important;
                transition: all 0.2s cubic-bezier(0.25, 0.46, 0.45, 0.94) !important;
              }

              .auth-container [data-amplify-router] button[type="button"]:not([data-amplify-button-variation]):hover {
                color: #3b82f6 !important;
              }

              /* 针对不同认证状态的动画效果 */
              .auth-container [data-amplify-router] {
                transition: all 0.3s cubic-bezier(0.25, 0.46, 0.45, 0.94) !important;
              }

              /* 输入框验证状态样式 */
              .auth-container .amplify-input[data-invalid="true"] {
                border-color: #ef4444 !important;
                box-shadow: 0 0 0 4px rgba(239, 68, 68, 0.08) !important;
              }

              .auth-container .amplify-input[data-valid="true"] {
                border-color: #10b981 !important;
                box-shadow: 0 0 0 4px rgba(16, 185, 129, 0.08) !important;
              }
            `}</style>

            <Authenticator
              formFields={formFields}
              components={components}
              socialProviders={[]}
              signUpAttributes={['email', 'phone_number']}
              loginMechanisms={['username', 'email', 'phone_number']}
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
