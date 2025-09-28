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

      setUser(userData);
      setIsAuthenticated(true);
      setError(null);
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

      const { isSignedIn } = await signIn({
        username,
        password,
      });

      if (isSignedIn) {
        await loadUserFromCognito();
        toast.success('ログインが成功しました！');
        return true;
      }
      
      return false;
    } catch (error: any) {
      console.error('ログインに失敗しました:', error);
      
      let errorMessage = 'ログインに失敗しました';
      if (error.name === 'NotAuthorizedException') {
        errorMessage = 'ユーザー名またはパスワードが間違っています';
      } else if (error.name === 'UserNotConfirmedException') {
        errorMessage = 'アカウントが未確認です。メールの確認リンクをチェックしてください';
      } else if (error.name === 'UserNotFoundException') {
        errorMessage = 'ユーザーが存在しません';
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
      setUser(null);
      setIsAuthenticated(false);
      setError(null);
      toast.success('ログアウトしました');
    } catch (error) {
      console.error('ログアウトに失敗しました:', error);
      toast.error('ログアウトに失敗しました');
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