import React, { useEffect } from 'react';
import { Authenticator, useAuthenticator } from '@aws-amplify/ui-react';
import '@aws-amplify/ui-react/styles.css';
import { getCurrentUser, fetchUserAttributes, signOut } from 'aws-amplify/auth';
import { useUser } from '../contexts/UserContext';
import { toast } from 'react-toastify';

interface CognitoAuthProps {
  isOpen?: boolean;
  onClose: () => void;
}

// 自定义认证包装组件
const AuthWrapper: React.FC<{ onClose: () => void }> = ({ onClose }) => {
  const { user, route } = useAuthenticator((context) => [context.user, context.route]);
  const { updateUser } = useUser();

  useEffect(() => {
    // 当用户成功认证后
    if (user && route === 'authenticated') {
      handleAuthSuccess();
    }
  }, [user, route]);

  const handleAuthSuccess = async () => {
    try {
      // 获取用户属性
      const attributes = await fetchUserAttributes();
      const currentUser = await getCurrentUser();
      
      // 更新本地用户上下文
      const userData = {
        id: currentUser.userId,
        username: currentUser.username || attributes.preferred_username || '',
        email: attributes.email || '',
        // 从Cognito属性映射到本地用户数据结构
        createdAt: attributes.created_at || new Date().toISOString(),
        lastLogin: new Date().toISOString(),
      };

      await updateUser(userData);
      toast.success('登录成功！');
      onClose();
    } catch (error) {
      console.error('处理认证成功时出错:', error);
      toast.error('登录处理失败，请重试');
    }
  };

  return null; // 这个组件不需要渲染任何UI，只负责处理认证成功逻辑
};

const CognitoAuth: React.FC<CognitoAuthProps> = ({ isOpen = true, onClose }) => {
  if (!isOpen) return null;

  const formFields = {
    signIn: {
      username: {
        placeholder: '请输入用户名或邮箱',
        label: '用户名/邮箱',
        isRequired: true,
      },
      password: {
        placeholder: '请输入密码',
        label: '密码',
        isRequired: true,
      }
    },
    signUp: {
      username: {
        placeholder: '请输入用户名',
        label: '用户名',
        isRequired: true,
        order: 1,
      },
      email: {
        placeholder: '请输入邮箱地址',
        label: '邮箱',
        isRequired: true,
        order: 2,
      },
      phone_number: {
        placeholder: '请输入手机号码',
        label: '手机号码',
        isRequired: true,
        order: 3,
      },
      password: {
        placeholder: '请输入密码（至少8位）',
        label: '密码',
        isRequired: true,
        order: 4,
      },
      confirm_password: {
        placeholder: '请再次输入密码',
        label: '确认密码',
        isRequired: true,
        order: 5,
      }
    },
    forceNewPassword: {
      password: {
        placeholder: '请输入新密码',
        label: '新密码',
      }
    },
    forgotPassword: {
      username: {
        placeholder: '请输入用户名或邮箱',
        label: '用户名/邮箱',
      }
    },
    confirmResetPassword: {
      username: {
        placeholder: '请输入用户名或邮箱',
        label: '用户名/邮箱',
      },
      confirmation_code: {
        placeholder: '请输入验证码',
        label: '验证码',
      },
      password: {
        placeholder: '请输入新密码',
        label: '新密码',
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
          <h1 className="text-2xl font-bold text-gray-800 mb-2">欢迎回来</h1>
          <p className="text-gray-600 text-sm">请登录您的账户继续使用</p>
        </div>
      );
    },
    Footer() {
      return (
        <div className="text-center mt-6 pt-4 border-t border-gray-100">
          <div className="flex items-center justify-center space-x-2 text-sm text-gray-500">
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m5.618-4.016A11.955 11.955 0 0112 2.944a11.955 11.955 0 01-8.618 3.04A12.02 12.02 0 003 9c0 5.591 3.824 10.29 9 11.622 5.176-1.332 9-6.03 9-11.622 0-1.042-.133-2.052-.382-3.016z" />
            </svg>
            <span>由 AWS Cognito 提供安全保障</span>
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
            loginMechanisms={['username', 'email']}
          >
            <AuthWrapper onClose={onClose} />
          </Authenticator>
        </div>
      </div>
    </div>
  );
};

export default CognitoAuth;