import React, { createContext, useState, useContext, useEffect, ReactNode, useCallback, useMemo, useRef } from 'react';
import { User, Purchase, RedeemCode, UserProgress } from '../types';
import { userApi, redeemCodeApi, userProgressApi } from '../utils/api';
import { initializeSocket, authenticateUser } from '../config/socket';
import apiClient from '../utils/api-client';
import { userProgressService } from '../services/UserProgressService';

// 添加事件类型定义
interface ProgressUpdateEvent {
  questionSetId: string;
  progress: {
    id: string;
    userId: string;
    questionSetId: string;
    questionId: string;
    isCorrect: boolean;
    timeSpent: number;
    completedQuestions: number;
    totalQuestions: number;
    correctAnswers: number;
    lastAccessed: string;
    totalTimeSpent: number;
    averageTimeSpent: number;
    accuracy: number;
  };
}

export interface QuizProgress {
  questionSetId: string;
  answeredQuestions?: {
    questionId: string;
    selectedOptionId: string;
    isCorrect: boolean;
  }[];
  completedQuestions?: number;
  totalQuestions?: number;
  correctAnswers?: number;
  score?: number;
  lastAttemptDate?: Date;
}

interface UserContextType {
  user: User | null;
  loading: boolean;
  error: string | null;
  userChangeEvent: { userId: string | null; timestamp: number };
  login: (username: string, password: string) => Promise<boolean>;
  logout: () => void;
  register: (userData: Partial<User>) => Promise<boolean>;
  updateUser: (userData: Partial<User>) => Promise<void>;
  addProgress: (progress: QuizProgress) => Promise<void>;
  addPurchase: (purchase: Purchase) => Promise<void>;
  hasAccessToQuestionSet: (questionSetId: string) => boolean;
  getRemainingAccessDays: (questionSetId: string) => number | null;
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
  updateUserProgress: (progressUpdate: Partial<UserProgress>) => void;
}

const UserContext = createContext<UserContextType | undefined>(undefined);

export const UserProvider: React.FC<{ children: ReactNode }> = ({ children }) => {
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState<boolean>(true);
  const [error, setError] = useState<string | null>(null);
  // 创建一个用户变化事件
  const [userChangeEvent, setUserChangeEvent] = useState<{userId: string | null, timestamp: number}>({userId: null, timestamp: 0});
  // 添加一个上次通知时间引用，用于防抖
  const lastNotifyTimeRef = useRef<number>(0);
  // 添加当前用户ID引用，用于比较
  const prevUserIdRef = useRef<string | null>(null);

  // 当用户变化时触发事件
  const notifyUserChange = useCallback((newUser: User | null) => {
    // 获取新用户ID
    const newUserId = newUser?.id || null;
    // 获取当前时间
    const now = Date.now();
    
    // 如果与上次通知的用户ID相同且时间间隔小于500ms，则忽略此次通知
    if (newUserId === prevUserIdRef.current && now - lastNotifyTimeRef.current < 500) {
      console.log('忽略重复的用户变更通知:', newUserId);
      return;
    }
    
    // 更新上次通知时间和用户ID
    lastNotifyTimeRef.current = now;
    prevUserIdRef.current = newUserId;
    
    // 触发事件
    console.log('发送用户变更通知:', newUserId);
    setUserChangeEvent({
      userId: newUserId,
      timestamp: now
    });
  }, []);

  useEffect(() => {
    const token = localStorage.getItem('token');
    if (token) {
      fetchCurrentUser();
    } else {
      setLoading(false);
    }
  }, []);

  // 初始化Socket.IO连接并处理实时进度更新及获取初始进度
  useEffect(() => {
    if (!user) return;

    // 使用防抖，确保socket只初始化一次
    const timer = setTimeout(() => {
      const socket = initializeSocket();
      authenticateUser(user.id, localStorage.getItem('token') || '');
      
      socket.on('progress:update', (data: ProgressUpdateEvent) => {
        setUser(prev => {
          if (!prev) return null;
          return {
            ...prev,
            progress: {
              ...prev.progress,
              [data.questionSetId]: {
                ...data.progress,
                lastAccessed: data.progress?.lastAccessed || new Date().toISOString()
              }
            }
          };
        });
      });

      return () => {
        socket.disconnect();
      };
    }, 300);
    
    return () => clearTimeout(timer);
  }, [user?.id]); // 只监听user.id，而不是整个user对象，减少不必要的重新渲染

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
      console.error('[UserProvider] Failed to fetch current user:', error);
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
          notifyUserChange(response.data.user); // 通知用户变化
          return true;
        } else {
          const userResponse = await fetchCurrentUser(); 
          if (userResponse) {
            notifyUserChange(userResponse); // 通知用户变化
          }
          return userResponse !== null;
        }
      } else {
        setError(response.message || 'Invalid username or password');
        return false;
      }
    } catch (error) {
      console.error('[UserProvider] Login failed:', error);
      setError('An error occurred during login');
      return false;
    } finally {
      setLoading(false);
    }
  };

  const logout = () => {
    // 确保先改变状态，再调用notifyUserChange
    localStorage.removeItem('token');
    
    // 清除API客户端缓存和状态
    apiClient.clearCache();
    apiClient.setAuthHeader(null);
    userProgressService.clearCachedUserId();
    
    setUser(null);
    
    // 短暂延迟后通知其他组件，避免状态更新冲突
    setTimeout(() => {
      notifyUserChange(null); // 通知用户登出
    }, 100);
  };

  const register = async (userData: Partial<User>): Promise<boolean> => {
    setLoading(true);
    setError(null);
    try {
      const response = await userApi.register(userData);
      if (response.success && response.data) {
        localStorage.setItem('token', response.data.token);
        setUser(response.data.user);
        notifyUserChange(response.data.user); // 通知用户变化
        return true;
      } else {
        setError(response.message || 'Registration failed');
        return false;
      }
    } catch (error) {
      console.error('[UserProvider] Registration failed:', error);
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
      console.error('[UserProvider] Failed to update user:', error);
      setError('An error occurred while updating user');
    } finally {
      setLoading(false);
    }
  };

  const addProgress = async (progress: QuizProgress) => {
    if (!user) {
      console.error('[UserProvider] User not logged in');
      return;
    }

    try {
      const currentProgress = user.progress || {};
      const existingProgress = currentProgress[progress.questionSetId] || {
        userId: user.id,
        questionSetId: progress.questionSetId,
        completedQuestions: 0,
        totalQuestions: 0,
        correctAnswers: 0,
        lastAccessed: new Date().toISOString(),
        totalTimeSpent: 0,
        averageTimeSpent: 0,
        accuracy: 0
      };

      const updatedProgress: UserProgress = {
        ...existingProgress,
        completedQuestions: progress.completedQuestions || existingProgress.completedQuestions,
        totalQuestions: progress.totalQuestions || existingProgress.totalQuestions,
        correctAnswers: progress.correctAnswers || existingProgress.correctAnswers,
        lastAccessed: progress.lastAttemptDate 
          ? progress.lastAttemptDate.toISOString() 
          : new Date().toISOString(),
        totalTimeSpent: existingProgress.totalTimeSpent,
        averageTimeSpent: existingProgress.averageTimeSpent,
        accuracy: existingProgress.accuracy
      };

      // Sync with backend
      const response = await userProgressApi.updateProgress(updatedProgress);
      if (!response.success) {
        throw new Error(response.message || 'Failed to update progress on server');
      }

      const newProgress: Record<string, UserProgress> = {
        ...currentProgress,
        [progress.questionSetId]: updatedProgress
      };

      await updateUser({ progress: newProgress });
    } catch (error) {
      console.error('[UserProvider] Failed to add progress:', error);
      throw error;
    }
  };

  const addPurchase = async (purchase: Purchase) => {
    if (!user) return;
    try {
      const updatedPurchases = [...(user.purchases || [])];
      updatedPurchases.push(purchase);
      await updateUser({ purchases: updatedPurchases });
    } catch (error) {
      console.error('[UserProvider] Failed to add purchase:', error);
    }
  };

  const hasAccessToQuestionSet = useCallback((questionSetId: string): boolean => {
    if (!user || !user.purchases) return false;

    return user.purchases.some(p => 
      p.questionSetId === questionSetId && 
      (new Date(p.expiryDate) > new Date() || !p.expiryDate)
    );
  }, [user]);

  const getRemainingAccessDays = useCallback((questionSetId: string): number | null => {
    if (!user || !user.purchases) return null;

    const purchase = user.purchases.find(p => 
      p.questionSetId === questionSetId && 
      new Date(p.expiryDate) > new Date()
    );

    if (purchase) {
      const expiryDate = new Date(purchase.expiryDate);
      const currentDate = new Date();
      const remainingTime = expiryDate.getTime() - currentDate.getTime();
      const remainingDays = Math.ceil(remainingTime / (1000 * 60 * 60 * 24));
      return remainingDays;
    }
    return null;
  }, [user]);

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
    if (!user || !user.progress || !user.progress[questionSetId]) return undefined;
    
    const progress = user.progress[questionSetId];
    return {
      questionSetId,
      completedQuestions: progress.completedQuestions,
      totalQuestions: progress.totalQuestions,
      correctAnswers: progress.correctAnswers,
      score: progress.totalQuestions > 0 ? Math.round((progress.correctAnswers / progress.totalQuestions) * 100) : 0,
      lastAttemptDate: progress.lastAccessed ? new Date(progress.lastAccessed) : undefined
    };
  };

  const getAnsweredQuestions = (questionSetId: string): string[] => {
    const answered = user?.progress?.[questionSetId]?.answeredQuestions;
    return answered ? answered.map((a: { questionId: string }) => a.questionId) : [];
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
      const response = await redeemCodeApi.generateRedeemCodes(questionSetId, validityDays, quantity);
      
      if (response.success && response.data) {
        return { 
          success: true, 
          codes: response.data, 
          message: `成功生成 ${response.data.length} 个兑换码` 
        };
      } else {
        return { 
          success: false, 
          message: response.message || response.error || '生成兑换码失败' 
        };
      }
    } catch (error: any) {
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

  const updateUserProgress = (progressUpdate: Partial<UserProgress>) => {
    if (!progressUpdate.questionSetId) {
      console.error('questionSetId is required for progress update');
      return;
    }

    const questionSetId = progressUpdate.questionSetId;

    setUser(prev => {
      if (!prev) return null;
      return {
        ...prev,
        progress: {
          ...prev.progress,
          [questionSetId]: {
            ...prev.progress?.[questionSetId],
            ...progressUpdate,
            lastAccessed: new Date().toISOString()
          } as UserProgress
        }
      };
    });
  };

  const contextValue = useMemo(() => ({
    user,
    loading,
    error,
    userChangeEvent, // 导出事件给其他上下文
    login,
    logout,
    register,
    updateUser,
    addProgress,
    addPurchase,
    hasAccessToQuestionSet,
    getRemainingAccessDays,
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
    adminRegister,
    updateUserProgress
  }), [user, loading, error, userChangeEvent]);

  return (
    <UserContext.Provider value={contextValue}>
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
