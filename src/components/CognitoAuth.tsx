import React, { useEffect } from 'react';
import { Authenticator, useAuthenticator } from '@aws-amplify/ui-react';
import '@aws-amplify/ui-react/styles.css';
// AWS Amplify Auth functions are handled by the CognitoUserContext
import { useCognitoUser } from '../contexts/CognitoUserContext';
import { toast } from 'react-toastify';

interface CognitoAuthProps {
  isOpen?: boolean;
  onClose: () => void;
}

// 自定义认证包装组件
const AuthWrapper: React.FC<{ onClose: () => void }> = ({ onClose }) => {
  const { user, route } = useAuthenticator((context) => [context.user, context.route]);
  const { refreshCognitoUser } = useCognitoUser();

  useEffect(() => {
    // 当用户成功认证后
    if (user && route === 'authenticated') {
      handleAuthSuccess();
    }
  }, [user, route]);

  const handleAuthSuccess = async () => {
    try {
      console.log('[CognitoAuth] ユーザー認証が成功しました。処理を開始します...');
      
      // Cognitoユーザー状態を更新
      await refreshCognitoUser();
      
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
        placeholder: 'ユーザー名・メール・電話番号を入力してください',
        label: 'ユーザー名/メール/電話番号',
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
        placeholder: 'ユーザー名を入力してください',
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
        placeholder: '電話番号を入力してください',
        label: '電話番号',
        isRequired: true,
        order: 3,
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
        placeholder: 'ユーザー名またはメールアドレスを入力してください',
        label: 'ユーザー名/メール',
      }
    },
    confirmResetPassword: {
      username: {
        placeholder: 'ユーザー名またはメールアドレスを入力してください',
        label: 'ユーザー名/メール',
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
              <div className="text-sm text-gray-500 mb-3">または</div>
              <div className="space-y-2">
                <div className="flex items-center justify-center space-x-4 text-sm">
                  <div className="flex items-center space-x-2 text-blue-600">
                    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 18h.01M8 21h8a2 2 0 002-2V5a2 2 0 00-2-2H8a2 2 0 00-2 2v14a2 2 0 002 2z" />
                    </svg>
                    <span>電話番号でログイン可能</span>
                  </div>
                </div>
                <div className="flex items-center justify-center space-x-4 text-sm">
                  <div className="flex items-center space-x-2 text-green-600">
                    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 8l7.89 4.26a2 2 0 002.22 0L21 8M5 19h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z" />
                    </svg>
                    <span>メールアドレスでログイン可能</span>
                  </div>
                </div>
              </div>
              <div className="mt-3 p-3 bg-blue-50 rounded-lg">
                <p className="text-xs text-blue-700">
                  <strong>ヒント:</strong> 電話番号の場合は「+81」から始まる形式（例：+8190-1234-5678）で入力してください。
                  パスワードをお忘れの場合は、「パスワードをお忘れですか？」から SMS または メール で認証コードを受信できます。
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
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black bg-opacity-60 backdrop-blur-sm">
      <div className="fixed inset-0" onClick={onClose}></div>
      <div className="bg-white rounded-2xl shadow-2xl max-w-lg w-full relative z-10 max-h-[90vh] overflow-y-auto transform transition-all">
        {/* 关闭按钮 */}
        <button
          onClick={onClose}
          className="absolute top-4 right-4 z-20 w-8 h-8 flex items-center justify-center rounded-full bg-gray-100 hover:bg-gray-200 text-gray-500 hover:text-gray-700 transition-colors"
          aria-label="关闭"
        >
          <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
          </svg>
        </button>
        
        {/* 认证表单容器 */}
        <div className="p-8 auth-container">
          <style>{`
            .auth-container .amplify-authenticator {
              --amplify-components-authenticator-router-background-color: transparent;
              --amplify-components-authenticator-router-border-radius: 0;
              --amplify-components-authenticator-router-box-shadow: none;
              --amplify-components-button-primary-background-color: #3b82f6;
              --amplify-components-button-primary-hover-background-color: #2563eb;
              --amplify-components-button-border-radius: 0.5rem;
              --amplify-components-fieldcontrol-border-radius: 0.5rem;
              --amplify-components-fieldcontrol-focus-border-color: #3b82f6;
              --amplify-space-medium: 1.5rem;
              --amplify-space-small: 1rem;
            }
            
            .auth-container .amplify-button--primary {
              background: linear-gradient(135deg, #3b82f6 0%, #8b5cf6 100%) !important;
              border: none !important;
              font-weight: 600 !important;
              padding: 0.75rem 1.5rem !important;
              transition: all 0.2s ease !important;
            }
            
            .auth-container .amplify-button--primary:hover {
              transform: translateY(-1px) !important;
              box-shadow: 0 4px 12px rgba(59, 130, 246, 0.4) !important;
            }
            
            .auth-container .amplify-input {
              border: 2px solid #e5e7eb !important;
              transition: all 0.2s ease !important;
            }
            
            .auth-container .amplify-input:focus {
              border-color: #3b82f6 !important;
              box-shadow: 0 0 0 3px rgba(59, 130, 246, 0.1) !important;
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
              border-radius: 0.5rem !important;
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
            loginMechanisms={['username', 'email', 'phone_number']}
          >
            <AuthWrapper onClose={onClose} />
          </Authenticator>
        </div>
      </div>
    </div>
  );
};

export default CognitoAuth;