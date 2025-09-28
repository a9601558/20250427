import React, { createContext, useState, useContext, useEffect, ReactNode } from 'react';
import { getCurrentUser, fetchUserAttributes, signOut, signIn, signUp, fetchAuthSession } from 'aws-amplify/auth';
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

  // 自动退出定时器
  const autoLogoutTimeoutRef = React.useRef<NodeJS.Timeout | null>(null);
  const INACTIVITY_TIMEOUT = 30 * 60 * 1000; // 30分钟

  // 初始化时检查用户认证状态
  useEffect(() => {
    checkAuthState();
    setupAutoLogout();
    
    // 清理函数
    return () => {
      if (autoLogoutTimeoutRef.current) {
        clearTimeout(autoLogoutTimeoutRef.current);
      }
    };
  }, []);

  // 设置自动退出机制
  const setupAutoLogout = () => {
    // 监听用户活动
    const resetTimeout = () => {
      if (autoLogoutTimeoutRef.current) {
        clearTimeout(autoLogoutTimeoutRef.current);
      }
      
      // 只有在用户已登录时才设置超时
      if (isAuthenticated) {
        localStorage.setItem('lastActivity', Date.now().toString());
        
        autoLogoutTimeoutRef.current = setTimeout(() => {
          handleAutoLogout();
        }, INACTIVITY_TIMEOUT);
      }
    };

    // 用户活动事件
    const events = ['mousedown', 'mousemove', 'keypress', 'scroll', 'touchstart', 'click'];
    
    events.forEach(event => {
      document.addEventListener(event, resetTimeout, true);
    });
    
    // 页面可见性变化时检查
    document.addEventListener('visibilitychange', () => {
      if (!document.hidden) {
        checkLastActivity();
      }
    });

    // 初始设置超时
    if (isAuthenticated) {
      resetTimeout();
    }
  };

  // 检查最后活动时间
  const checkLastActivity = () => {
    const lastActivity = localStorage.getItem('lastActivity');
    if (lastActivity && isAuthenticated) {
      const timeDiff = Date.now() - parseInt(lastActivity);
      if (timeDiff > INACTIVITY_TIMEOUT) {
        handleAutoLogout();
      }
    }
  };

  // 处理自动退出
  const handleAutoLogout = async () => {
    if (isAuthenticated) {
      toast.warning('長時間操作がなく、自動的にログアウトされました');
      await cognitoLogout();
    }
  };

  // 监听认证状态变化
  useEffect(() => {
    if (isAuthenticated) {
      setupAutoLogout();
    } else {
      if (autoLogoutTimeoutRef.current) {
        clearTimeout(autoLogoutTimeoutRef.current);
      }
    }
  }, [isAuthenticated]);

  const checkAuthState = async () => {
    try {
      setLoading(true);
      const currentUser = await getCurrentUser();
      if (currentUser) {
        await loadUserFromCognito();
      }
    } catch (error) {
      console.log('ユーザーがログインしていません');
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
      
      // AWS Cognitoセッションからトークンを取得
      const session = await fetchAuthSession();
      const idToken = session.tokens?.idToken?.toString();
      const accessToken = session.tokens?.accessToken?.toString();
      
      // 既存システムとの互換性のためlocalStorageにトークンを保存
      // 後端認証では access token が期待されるため、access token を使用
      if (accessToken) {
        localStorage.setItem('token', accessToken);
        console.log('[CognitoUserContext] AWS Cognito Access Tokenを既存システムに設定しました');
      }
      
      if (idToken) {
        localStorage.setItem('cognitoIdToken', idToken);
      }

      const userData: User = {
        id: currentUser.userId,
        username: currentUser.username || attributes.preferred_username || '',
        email: attributes.email || '',
        createdAt: attributes.created_at || new Date().toISOString(),
        lastLogin: new Date().toISOString(),
        // デフォルト値
        purchases: [],
        progress: {}, // タイプエラー修正：Record<string, UserProgress>型であるべき
        isAdmin: false, // ユーザーグループまたはカスタム属性で決定可能
        accessRights: [],
      };
      
      // ユーザーIDも既存システムに保存
      localStorage.setItem('activeUserId', currentUser.userId);

      setUser(userData);
      setIsAuthenticated(true);
      setError(null);
      
      // 记录登录活动时间
      localStorage.setItem('lastActivity', Date.now().toString());
      
      // Socket接続とAPI呼び出しが正常に動作するように、新しいトークンを通知
      window.dispatchEvent(new CustomEvent('tokenUpdated', { 
        detail: { token: idToken, userId: currentUser.userId } 
      }));
      
    } catch (error) {
      console.error('ユーザー情報の読み込みに失敗しました:', error);
      setError('ユーザー情報の読み込みに失敗しました');
      setIsAuthenticated(false);
      setUser(null);
    }
  };

  const cognitoLogin = async (username: string, password: string): Promise<boolean> => {
    try {
      setLoading(true);
      setError(null);

      // 记录登录尝试
      console.log('尝试登录:', { username: username.substring(0, 3) + '***' });

      // 处理邮箱登录：AWS Cognito支持邮箱作为用户名
      let loginUsername = username.trim();
      
      // 如果输入的是邮箱，确保格式正确
      if (username.includes('@')) {
        loginUsername = username.toLowerCase().trim();
        console.log('检测到邮箱登录');
      }

      const { isSignedIn } = await signIn({
        username: loginUsername,
        password: password.trim(),
      });

      if (isSignedIn) {
        await loadUserFromCognito();
        
        // 重置自动退出计时器
        localStorage.setItem('lastActivity', Date.now().toString());
        
        toast.success('ログイン成功！');
        return true;
      }
      
      return false;
    } catch (error: any) {
      console.error('登录失败:', error);
      
      let errorMessage = '登录失败';
      
      // 根据不同的错误类型提供更准确的错误信息
      switch (error.name) {
        case 'NotAuthorizedException':
          if (error.message?.includes('Password attempts exceeded')) {
            errorMessage = '密码尝试次数过多，账户已被临时锁定，请稍后再试';
          } else if (error.message?.includes('Incorrect username or password')) {
            errorMessage = '用户名或密码错误，请检查后重试';
          } else {
            errorMessage = '认证失败，请检查用户名和密码';
          }
          break;
          
        case 'UserNotConfirmedException':
          errorMessage = '账户尚未验证，请检查邮件中的验证链接';
          break;
          
        case 'UserNotFoundException':
          errorMessage = '用户不存在，请检查用户名或先注册账户';
          break;
          
        case 'InvalidParameterException':
          errorMessage = '输入参数无效，请检查用户名和密码格式';
          break;
          
        case 'TooManyRequestsException':
          errorMessage = '请求过于频繁，请稍后再试';
          break;
          
        case 'NetworkError':
          errorMessage = '网络连接問題，请检查网络后重试';
          break;
          
        default:
          if (error.message) {
            // 如果有具体的错误信息，使用它
            if (error.message.includes('password')) {
              errorMessage = '密码验证失败，请确认密码正确';
            } else if (error.message.includes('username')) {
              errorMessage = '用户名验证失败，请确认用户名或邮箱正确';
            } else {
              errorMessage = `登录失败: ${error.message}`;
            }
          }
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
        toast.success('登録が成功しました！メールの確認リンクをチェックしてください');
        // 登録後、ユーザーはメール確認が必要な場合があり、自動ログインはされません
        return true;
      }

      return false;
    } catch (error: any) {
      console.error('登録に失敗しました:', error);
      
      let errorMessage = '登録に失敗しました';
      if (error.name === 'UsernameExistsException') {
        errorMessage = 'ユーザー名が既に存在します';
      } else if (error.name === 'InvalidPasswordException') {
        errorMessage = 'パスワードが要件を満たしていません';
      } else if (error.name === 'InvalidParameterException') {
        errorMessage = 'パラメータが無効です。入力内容を確認してください';
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
      
      // 完全清除所有本地存储的登录信息
      const keysToRemove = [
        'token',
        'cognitoIdToken', 
        'activeUserId',
        'authToken',
        'refreshToken',
        'userCredentials',
        'lastActivity'
      ];
      
      keysToRemove.forEach(key => localStorage.removeItem(key));
      
      // 清除所有用户相关的缓存数据
      Object.keys(localStorage).forEach(key => {
        if (key.startsWith('user_') || key.startsWith('cognito_') || key.startsWith('auth_')) {
          localStorage.removeItem(key);
        }
      });
      
      // 重置状态
      setUser(null);
      setIsAuthenticated(false);
      setError(null);
      
      // 触发全局登出事件
      window.dispatchEvent(new CustomEvent('userLoggedOut'));
      
      toast.success('ログアウト成功');
      
      // 强制刷新页面确保完全清除状态
      setTimeout(() => {
        window.location.href = '/';
      }, 1000);
      
    } catch (error) {
      console.error('登出失败:', error);
      
      // 即使AWS登出失败，也要清除本地数据
      const keysToRemove = [
        'token', 'cognitoIdToken', 'activeUserId', 'authToken', 
        'refreshToken', 'userCredentials', 'lastActivity'
      ];
      keysToRemove.forEach(key => localStorage.removeItem(key));
      
      setUser(null);
      setIsAuthenticated(false);
      
      toast.error('ログアウト処理中に問題が発生しましたが、ローカルデータはクリアされました');
      
      // 即使出错也跳转到首页
      setTimeout(() => {
        window.location.href = '/';
      }, 1000);
      
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