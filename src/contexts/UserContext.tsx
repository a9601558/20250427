import React, { createContext, useState, useContext, useEffect, ReactNode } from 'react';
import { User, Purchase, RedeemCode, UserProgress } from '../types';
import { userApi, redeemCodeApi } from '../utils/api';

export interface QuizProgress {
  questionSetId: string;
  answeredQuestions: {
    questionId: string;
    selectedOptionId: string;
    isCorrect: boolean;
  }[];
  score?: number;
  lastAttemptDate?: Date;
}

interface UserContextType {
  user: User | null;
  loading: boolean;
  error: string | null;
  login: (username: string, password: string) => Promise<boolean>;
  logout: () => void;
  register: (userData: Partial<User>) => Promise<boolean>;
  updateUser: (userData: Partial<User>) => Promise<void>;
  addProgress: (progress: QuizProgress) => Promise<void>;
  addPurchase: (purchase: Purchase) => Promise<void>;
  hasPurchased: (questionSetId: string) => boolean;
  getPurchaseExpiry: (questionSetId: string) => Date | null;
  isQuizCompleted: (questionSetId: string) => boolean;
  getQuizScore: (questionSetId: string) => number | null;
  getUserProgress: (questionSetId: string) => QuizProgress | undefined;
  getAnsweredQuestions: (questionSetId: string) => string[];
  isAdmin: () => boolean;
  redeemCode: (code: string) => Promise<{ success: boolean; message: string }>;
  generateRedeemCode: (questionSetId: string, validityDays: number, quantity: number) => Promise<{ success: boolean; codes?: RedeemCode[]; message: string }>;
  getRedeemCodes: () => Promise<RedeemCode[]>;
  getAllUsers: () => Promise<User[]>;
  deleteUser: (userId: string) => Promise<{ success: boolean; message: string }>;
  adminRegister: (userData: Partial<User>) => Promise<{ success: boolean; message: string }>;
}

const UserContext = createContext<UserContextType | undefined>(undefined);

export const UserProvider: React.FC<{ children: ReactNode }> = ({ children }) => {
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState<boolean>(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const token = localStorage.getItem('token');
    if (token) {
      fetchCurrentUser();
    } else {
      setLoading(false);
    }
  }, []);

  const fetchCurrentUser = async () => {
    setLoading(true);
    try {
      const response = await userApi.getCurrentUser();
      if (response.success && response.data) {
        setUser(response.data || null);
        return response.data;
      } else {
        localStorage.removeItem('token');
        setError(response.message || 'Failed to fetch user data');
        return null;
      }
    } catch (error) {
      localStorage.removeItem('token');
      setError('An error occurred while fetching user data');
      return null;
    } finally {
      setLoading(false);
    }
  };

  const login = async (username: string, password: string): Promise<boolean> => {
    setLoading(true);
    setError(null);
    try {
      const response = await userApi.login(username, password);
      if (response.success && response.data) {
        localStorage.setItem('token', response.data.token);
        if (response.data.user) {
          setUser(response.data.user);
          return true;
        } else {
          const userResponse = await fetchCurrentUser(); 
          return userResponse !== null;
        }
      } else {
        setError(response.message || 'Invalid username or password');
        return false;
      }
    } catch (error) {
      setError('An error occurred during login');
      return false;
    } finally {
      setLoading(false);
    }
  };

  const logout = () => {
    localStorage.removeItem('token');
    setUser(null);
  };

  const register = async (userData: Partial<User>): Promise<boolean> => {
    setLoading(true);
    setError(null);
    try {
      const response = await userApi.register(userData);
      if (response.success && response.data) {
        localStorage.setItem('token', response.data.token);
        setUser(response.data.user);
        return true;
      } else {
        setError(response.message || 'Registration failed');
        return false;
      }
    } catch (error) {
      setError('An error occurred during registration');
      return false;
    } finally {
      setLoading(false);
    }
  };

  const updateUser = async (userData: Partial<User>) => {
    if (!user) return;
    setLoading(true);
    setError(null);
    try {
      const response = await userApi.updateUser(user.id, userData);
      if (response.success && response.data) {
        setUser(response.data);
      } else {
        setError(response.message || 'Failed to update user');
      }
    } catch (error) {
      setError('An error occurred while updating user');
    } finally {
      setLoading(false);
    }
  };

  const addProgress = async (progress: QuizProgress) => {
    if (!user) return;
    try {
      const userProgress: UserProgress = {
        completedQuestions: progress.answeredQuestions.length,
        totalQuestions: progress.answeredQuestions.length,
        correctAnswers: progress.answeredQuestions.filter(a => a.isCorrect).length,
        lastAccessed: progress.lastAttemptDate ? progress.lastAttemptDate.toISOString() : new Date().toISOString()
      };
      const updatedProgress = { ...(user.progress || {}) };
      updatedProgress[progress.questionSetId] = userProgress;
      await updateUser({ progress: updatedProgress });
    } catch (error) {
      console.error('Failed to add progress:', error);
    }
  };

  const addPurchase = async (purchase: Purchase) => {
    if (!user) return;
    try {
      const updatedPurchases = [...(user.purchases || [])];
      updatedPurchases.push(purchase);
      await updateUser({ purchases: updatedPurchases });
    } catch (error) {
      console.error('Failed to add purchase:', error);
    }
  };

  const hasPurchased = (questionSetId: string): boolean => {
    if (!user || !user.purchases) return false;
    return user.purchases.some(p => p.quizId === questionSetId && (new Date(p.expiryDate) > new Date() || !p.expiryDate));
  };

  const getPurchaseExpiry = (questionSetId: string): Date | null => {
    if (!user || !user.purchases) return null;
    const purchase = user.purchases.find(p => p.quizId === questionSetId && new Date(p.expiryDate) > new Date());
    return purchase ? new Date(purchase.expiryDate) : null;
  };

  const isQuizCompleted = (questionSetId: string): boolean => {
    if (!user || !user.progress) return false;
    const progress = user.progress[questionSetId];
    return !!progress && progress.completedQuestions > 0 && progress.completedQuestions === progress.totalQuestions;
  };

  const getQuizScore = (questionSetId: string): number | null => {
    if (!user || !user.progress) return null;
    const progress = user.progress[questionSetId];
    if (!progress) return null;
    return progress.correctAnswers > 0 ? Math.round((progress.correctAnswers / progress.totalQuestions) * 100) : 0;
  };

  const getUserProgress = (questionSetId: string): QuizProgress | undefined => {
    if (!user || !user.progress) return undefined;
    const progress = user.progress[questionSetId];
    if (!progress) return undefined;
    return {
      questionSetId,
      answeredQuestions: [],
      score: Math.round((progress.correctAnswers / progress.totalQuestions) * 100),
      lastAttemptDate: progress.lastAccessed ? new Date(progress.lastAccessed) : undefined
    };
  };

  const getAnsweredQuestions = (questionSetId: string): string[] => {
    if (!user || !user.progress) return [];
    const progress = user.progress[questionSetId];
    return progress ? [] : [];
  };

  const isAdmin = (): boolean => {
    return !!user?.isAdmin;
  };

  const redeemCode = async (code: string): Promise<{ success: boolean; message: string }> => {
    if (!user) return { success: false, message: '请先登录' };
    try {
      const response = await redeemCodeApi.redeemCode(code);
      if (response.success) {
        await fetchCurrentUser();
        return { success: true, message: '兑换码使用成功！' };
      } else {
        return { success: false, message: response.message || '兑换码使用失败' };
      }
    } catch (error) {
      return { success: false, message: '兑换过程中发生错误' };
    }
  };

  const generateRedeemCode = async (questionSetId: string, validityDays: number, quantity: number): Promise<{ success: boolean; codes?: RedeemCode[]; message: string }> => {
    if (!isAdmin()) return { success: false, message: '无权限执行此操作' };
    try {
      console.log('Sending API request with params:', { questionSetId, validityDays, quantity });
      const response = await redeemCodeApi.generateRedeemCodes(questionSetId, validityDays, quantity);
      console.log('API response:', response);
      
      if (response.success && response.data) {
        return { success: true, codes: response.data, message: `成功生成 ${response.data.length} 个兑换码` };
      } else {
        return { success: false, message: response.message || response.error || '生成兑换码失败' };
      }
    } catch (error: any) {
      console.error('生成兑换码API错误:', error);
      return { success: false, message: error.message || '生成兑换码过程中发生错误' };
    }
  };

  const getRedeemCodes = async (): Promise<RedeemCode[]> => {
    if (!isAdmin()) return [];
    try {
      const response = await redeemCodeApi.getAllRedeemCodes();
      return response.success && response.data ? response.data : [];
    } catch (error) {
      return [];
    }
  };

  const getAllUsers = async (): Promise<User[]> => {
    if (!isAdmin()) return [];
    try {
      const response = await userApi.getAllUsers();
      return response.success && response.data ? response.data : [];
    } catch (error) {
      return [];
    }
  };

  const deleteUser = async (userId: string): Promise<{ success: boolean; message: string }> => {
    if (!isAdmin()) return { success: false, message: '无权限执行此操作' };
    try {
      const response = await userApi.deleteUser(userId);
      return response.success ? { success: true, message: '用户删除成功' } : { success: false, message: response.message || '删除用户失败' };
    } catch (error) {
      return { success: false, message: '删除用户过程中发生错误' };
    }
  };

  const adminRegister = async (userData: Partial<User>): Promise<{ success: boolean; message: string }> => {
    if (!isAdmin()) return { success: false, message: '无权限执行此操作' };
    try {
      const response = await userApi.register(userData);
      return response.success ? { success: true, message: '用户创建成功' } : { success: false, message: response.message || '用户创建失败' };
    } catch (error) {
      return { success: false, message: '创建用户过程中发生错误' };
    }
  };

  return (
    <UserContext.Provider value={{
      user,
      loading,
      error,
      login,
      logout,
      register,
      updateUser,
      addProgress,
      addPurchase,
      hasPurchased,
      getPurchaseExpiry,
      isQuizCompleted,
      getQuizScore,
      getUserProgress,
      getAnsweredQuestions,
      isAdmin,
      redeemCode,
      generateRedeemCode,
      getRedeemCodes,
      getAllUsers,
      deleteUser,
      adminRegister
    }}>
      {children}
    </UserContext.Provider>
  );
};

export const useUser = () => {
  const context = useContext(UserContext);
  if (context === undefined) {
    throw new Error('useUser must be used within a UserProvider');
  }
  return context;
};
