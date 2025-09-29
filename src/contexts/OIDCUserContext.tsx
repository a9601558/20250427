import React, { createContext, useState, useContext, useEffect, ReactNode } from 'react';
import { useAuth } from "react-oidc-context";
import { User } from '../types';
import { toast } from 'react-toastify';

interface OIDCUserContextType {
  user: User | null;
  loading: boolean;
  error: string | null;
  isAuthenticated: boolean;
  oidcLogin: () => Promise<void>;
  oidcLogout: () => Promise<void>;
  refreshOIDCUser: () => Promise<void>;
  updateLocalUser: (userData: Partial<User>) => void;
}

const OIDCUserContext = createContext<OIDCUserContextType | undefined>(undefined);

export const useOIDCUser = () => {
  const context = useContext(OIDCUserContext);
  if (context === undefined) {
    throw new Error('useOIDCUser must be used within an OIDCUserProvider');
  }
  return context;
};

export const OIDCUserProvider: React.FC<{ children: ReactNode }> = ({ children }) => {
  const auth = useAuth();
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState<boolean>(true);
  const [error, setError] = useState<string | null>(null);

  // 自动退出定时器
  const autoLogoutTimeoutRef = React.useRef<NodeJS.Timeout | null>(null);
  const INACTIVITY_TIMEOUT = 30 * 60 * 1000; // 30分钟

  // 监听 OIDC 认证状态变化
  useEffect(() => {
    if (auth.isLoading) {
      setLoading(true);
      return;
    }

    if (auth.error) {
      console.error('[OIDCUserContext] 認証エラー:', auth.error);
      setError(auth.error.message);
      setLoading(false);
      return;
    }

    if (auth.isAuthenticated && auth.user) {
      console.log('[OIDCUserContext] ユーザー認証成功:', auth.user.profile);
      handleAuthenticatedUser();
    } else {
      console.log('[OIDCUserContext] ユーザーが認証されていません');
      setUser(null);
      setError(null);
      setLoading(false);
    }
  }, [auth.isLoading, auth.isAuthenticated, auth.user, auth.error]);

  // 处理已认证用户
  const handleAuthenticatedUser = async () => {
    try {
      if (!auth.user?.profile) return;

      const profile = auth.user.profile;
      
      // 转换 OIDC 用户信息为应用用户格式
      const userInfo: User = {
        id: profile.sub || '',
        username: profile.preferred_username || profile.email || '',
        email: profile.email || '',
        isAdmin: false, // 默认为非管理员，可以根据需要从 JWT claims 中获取
        progress: {}, // 初始化为空对象
        cognitoUserId: profile.sub,
        createdAt: new Date().toISOString(),
        lastLogin: new Date().toISOString(),
        accessRights: [],
        // 添加 OIDC 特定信息（需要扩展 User 类型或使用 any）
        ...(profile.phone_number && { phone_number: profile.phone_number }),
        ...(profile.name && { name: profile.name }),
        ...(profile.family_name && { family_name: profile.family_name }),
        ...(profile.given_name && { given_name: profile.given_name }),
      } as User & {
        oidc_sub?: string;
        access_token?: string;
        id_token?: string;
        refresh_token?: string;
        phone_number?: string;
        name?: string;
        family_name?: string;
        given_name?: string;
      };

      console.log('[OIDCUserContext] ユーザー情報を設定:', userInfo);
      setUser(userInfo);
      setError(null);
      setLoading(false);

      // 设置自动退出
      resetAutoLogoutTimer();

    } catch (error) {
      console.error('[OIDCUserContext] ユーザー情報の処理中にエラー:', error);
      setError('ユーザー情報の取得に失敗しました');
      setLoading(false);
    }
  };

  // 设置自动退出定时器
  const setupAutoLogout = () => {
    const events = ['mousedown', 'mousemove', 'keypress', 'scroll', 'touchstart'];
    
    const resetTimer = () => {
      resetAutoLogoutTimer();
    };

    events.forEach(event => {
      document.addEventListener(event, resetTimer, true);
    });

    // 清理函数
    return () => {
      events.forEach(event => {
        document.removeEventListener(event, resetTimer, true);
      });
    };
  };

  // 重置自动退出定时器
  const resetAutoLogoutTimer = () => {
    if (autoLogoutTimeoutRef.current) {
      clearTimeout(autoLogoutTimeoutRef.current);
    }

    autoLogoutTimeoutRef.current = setTimeout(() => {
      console.log('[OIDCUserContext] 非活动状态超时，自动退出');
      toast.warning('非活動状態が続いたため、自動的にログアウトします');
      oidcLogout();
    }, INACTIVITY_TIMEOUT);
  };

  // 设置活动监听器
  useEffect(() => {
    if (auth.isAuthenticated) {
      const cleanup = setupAutoLogout();
      return cleanup;
    }
  }, [auth.isAuthenticated]);

  // 清理定时器
  useEffect(() => {
    return () => {
      if (autoLogoutTimeoutRef.current) {
        clearTimeout(autoLogoutTimeoutRef.current);
      }
    };
  }, []);

  // OIDC 登录
  const oidcLogin = async (): Promise<void> => {
    try {
      console.log('[OIDCUserContext] OIDC ログインを開始');
      setLoading(true);
      setError(null);
      
      await auth.signinRedirect();
    } catch (error: any) {
      console.error('[OIDCUserContext] OIDC ログインエラー:', error);
      setError(error.message || 'ログインに失敗しました');
      setLoading(false);
      throw error;
    }
  };

  // OIDC 登出
  const oidcLogout = async (): Promise<void> => {
    try {
      console.log('[OIDCUserContext] OIDC ログアウトを開始');
      setLoading(true);
      
      // 清除定时器
      if (autoLogoutTimeoutRef.current) {
        clearTimeout(autoLogoutTimeoutRef.current);
      }

      // 清除本地状态
      setUser(null);
      setError(null);
      
      // 清除登出标记，允许重新登录
      sessionStorage.removeItem('user_logged_out');

      // OIDC 登出重定向
      const clientId = "3tdjflgaoojolmlau5thc9lv5c";
      const logoutUri = "https://d84l1y8p4kdic.cloudfront.net";
      const cognitoDomain = "https://ap-northeast-106lr5s5h9.auth.ap-northeast-1.amazoncognito.com";
      
      // 也可以使用 auth.removeUser() 进行本地登出
      // await auth.removeUser();
      
      window.location.href = `${cognitoDomain}/logout?client_id=${clientId}&logout_uri=${encodeURIComponent(logoutUri)}`;
      
    } catch (error: any) {
      console.error('[OIDCUserContext] OIDC ログアウトエラー:', error);
      setError(error.message || 'ログアウトに失敗しました');
      setLoading(false);
      throw error;
    }
  };

  // 刷新用户信息
  const refreshOIDCUser = async (): Promise<void> => {
    try {
      console.log('[OIDCUserContext] ユーザー情報を更新');
      
      if (auth.isAuthenticated && auth.user) {
        await handleAuthenticatedUser();
      } else {
        setUser(null);
        setError(null);
        setLoading(false);
      }
    } catch (error: any) {
      console.error('[OIDCUserContext] ユーザー情報の更新エラー:', error);
      setError(error.message || 'ユーザー情報の更新に失敗しました');
    }
  };

  // 更新本地用户信息
  const updateLocalUser = (userData: Partial<User>) => {
    console.log('[OIDCUserContext] ローカルユーザー情報を更新:', userData);
    
    setUser(prev => {
      if (!prev) return prev;
      return { ...prev, ...userData };
    });
  };

  const contextValue: OIDCUserContextType = {
    user,
    loading,
    error,
    isAuthenticated: auth.isAuthenticated,
    oidcLogin,
    oidcLogout,
    refreshOIDCUser,
    updateLocalUser,
  };

  return (
    <OIDCUserContext.Provider value={contextValue}>
      {children}
    </OIDCUserContext.Provider>
  );
};

// 为了向后兼容，提供一个别名
export const useCognitoUser = useOIDCUser;
export const CognitoUserProvider = OIDCUserProvider;