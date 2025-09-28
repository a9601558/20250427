import React, { createContext, useState, useContext, useEffect, ReactNode } from 'react';
import { getCurrentUser, fetchUserAttributes, signOut, signIn, signUp } from 'aws-amplify/auth';
import { User } from '../types';
import { toast } from 'react-toastify';

interface CognitoUserContextType {
  user: User | null;
  loading: boolean;
  error: string | null;
  isAuthenticated: boolean;
  cognitoLogin: (username: string, password: string) => Promise<boolean>;
  cognitoRegister: (userData: { username: string; email: string; password: string; phone_number?: string }) => Promise<boolean>;
  cognitoLogout: () => Promise<void>;
  refreshCognitoUser: () => Promise<void>;
  updateLocalUser: (userData: Partial<User>) => void;
}

const CognitoUserContext = createContext<CognitoUserContextType | undefined>(undefined);

export const useCognitoUser = () => {
  const context = useContext(CognitoUserContext);
  if (context === undefined) {
    throw new Error('useCognitoUser must be used within a CognitoUserProvider');
  }
  return context;
};

export const CognitoUserProvider: React.FC<{ children: ReactNode }> = ({ children }) => {
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState<boolean>(true);
  const [error, setError] = useState<string | null>(null);
  const [isAuthenticated, setIsAuthenticated] = useState<boolean>(false);

  // 初始化时检查用户认证状态
  useEffect(() => {
    checkAuthState();
  }, []);

  const checkAuthState = async () => {
    try {
      setLoading(true);
      const currentUser = await getCurrentUser();
      if (currentUser) {
        await loadUserFromCognito();
      }
    } catch (error) {
      console.log('用户未登录');
      setIsAuthenticated(false);
      setUser(null);
    } finally {
      setLoading(false);
    }
  };

  const loadUserFromCognito = async () => {
    try {
      const currentUser = await getCurrentUser();
      const attributes = await fetchUserAttributes();

      const userData: User = {
        id: currentUser.userId,
        username: currentUser.username || attributes.preferred_username || '',
        email: attributes.email || '',
        createdAt: attributes.created_at || new Date().toISOString(),
        lastLogin: new Date().toISOString(),
        // 默认值
        purchases: [],
        progress: {}, // 修复类型错误：应该是Record<string, UserProgress>
        isAdmin: false, // 可以通过用户组或自定义属性来确定
        accessRights: [],
      };

      setUser(userData);
      setIsAuthenticated(true);
      setError(null);
    } catch (error) {
      console.error('加载用户信息失败:', error);
      setError('加载用户信息失败');
      setIsAuthenticated(false);
      setUser(null);
    }
  };

  const cognitoLogin = async (username: string, password: string): Promise<boolean> => {
    try {
      setLoading(true);
      setError(null);

      const { isSignedIn } = await signIn({
        username,
        password,
      });

      if (isSignedIn) {
        await loadUserFromCognito();
        toast.success('登录成功！');
        return true;
      }
      
      return false;
    } catch (error: any) {
      console.error('登录失败:', error);
      
      let errorMessage = '登录失败';
      if (error.name === 'NotAuthorizedException') {
        errorMessage = '用户名或密码错误';
      } else if (error.name === 'UserNotConfirmedException') {
        errorMessage = '账号未验证，请检查邮箱验证链接';
      } else if (error.name === 'UserNotFoundException') {
        errorMessage = '用户不存在';
      } else if (error.message) {
        errorMessage = error.message;
      }

      setError(errorMessage);
      toast.error(errorMessage);
      return false;
    } finally {
      setLoading(false);
    }
  };

  const cognitoRegister = async (userData: { username: string; email: string; password: string; phone_number?: string }): Promise<boolean> => {
    try {
      setLoading(true);
      setError(null);

      const { isSignUpComplete, userId } = await signUp({
        username: userData.username,
        password: userData.password,
        options: {
          userAttributes: {
            email: userData.email,
          },
        },
      });

      if (isSignUpComplete || userId) {
        toast.success('注册成功！请检查邮箱验证链接');
        // 注册成功后，用户可能需要验证邮箱，这时不会自动登录
        return true;
      }

      return false;
    } catch (error: any) {
      console.error('注册失败:', error);
      
      let errorMessage = '注册失败';
      if (error.name === 'UsernameExistsException') {
        errorMessage = '用户名已存在';
      } else if (error.name === 'InvalidPasswordException') {
        errorMessage = '密码不符合要求';
      } else if (error.name === 'InvalidParameterException') {
        errorMessage = '参数无效，请检查输入';
      } else if (error.message) {
        errorMessage = error.message;
      }

      setError(errorMessage);
      toast.error(errorMessage);
      return false;
    } finally {
      setLoading(false);
    }
  };

  const cognitoLogout = async (): Promise<void> => {
    try {
      setLoading(true);
      await signOut();
      setUser(null);
      setIsAuthenticated(false);
      setError(null);
      toast.success('已退出登录');
    } catch (error) {
      console.error('退出登录失败:', error);
      toast.error('退出登录失败');
    } finally {
      setLoading(false);
    }
  };

  const refreshCognitoUser = async (): Promise<void> => {
    await checkAuthState();
  };

  const updateLocalUser = (userData: Partial<User>): void => {
    if (user) {
      setUser(prev => prev ? { ...prev, ...userData } : null);
    }
  };

  const contextValue: CognitoUserContextType = {
    user,
    loading,
    error,
    isAuthenticated,
    cognitoLogin,
    cognitoRegister,
    cognitoLogout,
    refreshCognitoUser,
    updateLocalUser,
  };

  return (
    <CognitoUserContext.Provider value={contextValue}>
      {children}
    </CognitoUserContext.Provider>
  );
};

export default CognitoUserContext;