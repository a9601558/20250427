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
      password: {
        placeholder: '请输入密码（至少8位）',
        label: '密码',
        isRequired: true,
        order: 3,
      },
      confirm_password: {
        placeholder: '请再次输入密码',
        label: '确认密码',
        isRequired: true,
        order: 4,
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
        <div className="amplify-flex amplify-flex--column amplify-flex--center">
          <h1 className="amplify-heading--1">欢迎</h1>
        </div>
      );
    },
    Footer() {
      return (
        <div className="amplify-flex amplify-flex--center">
          <p className="amplify-text--tertiary">
            使用AWS Cognito安全认证
          </p>
        </div>
      );
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center">
      <div className="fixed inset-0 bg-black opacity-50" onClick={onClose}></div>
      <div className="bg-white rounded-lg p-6 max-w-md w-full relative z-10 max-h-[90vh] overflow-y-auto">
        <div className="flex justify-between items-center mb-4">
          <h3 className="text-xl font-semibold text-gray-900">
            用户认证
          </h3>
          <button
            onClick={onClose}
            className="text-gray-400 hover:text-gray-600 text-2xl font-bold"
            aria-label="关闭"
          >
            ×
          </button>
        </div>
        
        <Authenticator
          formFields={formFields}
          components={components}
          socialProviders={[]}
          signUpAttributes={['email']}
          loginMechanisms={['username', 'email']}
        >
          <AuthWrapper onClose={onClose} />
        </Authenticator>
      </div>
    </div>
  );
};

export default CognitoAuth;