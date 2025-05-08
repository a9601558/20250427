import React, { createContext, useState, useContext, useEffect, ReactNode, useCallback, useMemo, useRef } from 'react';
import { User, Purchase, RedeemCode, UserProgress } from '../types';
import { userApi, redeemCodeApi, userProgressApi } from '../utils/api';
import { initializeSocket, authenticateUser } from '../config/socket';
import { useSocket } from './SocketContext';
import apiClient from '../utils/api-client';
import { userProgressService } from '../services/UserProgressService';
import { toast } from 'react-toastify';
import { refreshUserPurchases } from '../utils/paymentUtils';

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
  hasAccessToQuestionSet: (questionSetId: string) => Promise<boolean>;
  getRemainingAccessDays: (questionSetId: string) => number | null;
  isQuizCompleted: (questionSetId: string) => boolean;
  getQuizScore: (questionSetId: string) => number | null;
  getUserProgress: (questionSetId: string) => QuizProgress | undefined;
  getAnsweredQuestions: (questionSetId: string) => string[];
  isAdmin: () => boolean;
  redeemCode: (code: string) => Promise<{ success: boolean; message: string; questionSetId?: string; quizTitle?: string }>;
  generateRedeemCode: (questionSetId: string, validityDays: number, quantity: number) => Promise<{ success: boolean; codes?: RedeemCode[]; message: string }>;
  getRedeemCodes: () => Promise<RedeemCode[]>;
  getAllUsers: () => Promise<User[]>;
  deleteUser: (userId: string) => Promise<{ success: boolean; message: string }>;
  adminRegister: (userData: Partial<User>) => Promise<{ success: boolean; message: string }>;
  updateUserProgress: (progressUpdate: Partial<UserProgress>) => void;
  syncAccessRights: () => Promise<void>;
  refreshPurchases: () => Promise<Purchase[]>;
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
  const { socket } = useSocket();
  const [userPurchases, setUserPurchases] = useState<Purchase[]>([]);

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
        // 添加特别的调试日志，检查用户数据结构
        console.log('[UserContext] 获取到用户数据:', response.data);
        
        // 检查购买记录
        if (response.data.purchases) {
          console.log('[UserContext] 用户购买记录数量:', response.data.purchases.length);
          
          // 详细打印第一条购买记录的结构（如果有）
          if (response.data.purchases.length > 0) {
            console.log('[UserContext] 购买记录结构示例:', JSON.stringify(response.data.purchases[0]));
            
            // 检查关键字段
            const firstPurchase = response.data.purchases[0];
            console.log('[UserContext] 购买记录字段检查:');
            console.log('- questionSetId:', firstPurchase.questionSetId);
            console.log('- question_set_id:', (firstPurchase as any).question_set_id);
            console.log('- purchaseQuestionSet:', firstPurchase.purchaseQuestionSet);
            console.log('- expiryDate:', firstPurchase.expiryDate);
            console.log('- expiry_date:', (firstPurchase as any).expiry_date);
          }
        } else {
          console.log('[UserContext] 用户没有购买记录或购买记录字段缺失');
        }
        
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

  const logout = () => {
    // 确保先改变状态，再调用notifyUserChange
    localStorage.removeItem('token');
    
    // 清除所有相关的本地存储数据
    const keysToRemove = [];
    for (let i = 0; i < localStorage.length; i++) {
      const key = localStorage.key(i);
      if (key && (
        key.startsWith('quiz_progress_') ||
        key.startsWith('quiz_payment_completed_') ||
        key.startsWith('quiz_state_') ||
        key.startsWith('lastAttempt_') ||
        key.startsWith('quizAccessRights') ||
        key === 'redeemedQuestionSetIds' ||
        key === 'questionSetAccessCache'
      )) {
        keysToRemove.push(key);
      }
    }
    
    // 批量删除本地存储项
    keysToRemove.forEach(key => localStorage.removeItem(key));
    
    // 清除sessionStorage中的数据
    const sessionKeysToRemove = [];
    for (let i = 0; i < sessionStorage.length; i++) {
      const key = sessionStorage.key(i);
      if (key && (
        key.startsWith('quiz_') ||
        key.startsWith('user_')
      )) {
        sessionKeysToRemove.push(key);
      }
    }
    
    // 批量删除会话存储项
    sessionKeysToRemove.forEach(key => sessionStorage.removeItem(key));
    
    // 清除API客户端缓存和状态
    apiClient.clearCache();
    apiClient.setAuthHeader(null);
    userProgressService.clearCachedUserId();

    // 清空状态
    setUser(null);
    setUserPurchases([]);
    
    // 通知Socket断开连接
    if (socket) {
      socket.disconnect();
    }
    
    console.log('[UserContext] 用户已成功登出，已清理所有本地存储数据');
    
    // 通知用户登出，但不强制刷新页面
    notifyUserChange(null);
    
    // 改为使用回调方式，而不是直接执行导航
    // 这样可以让调用logout的组件决定是否需要导航
    try {
      // 如果在React组件环境外调用，则回退到直接导航
      if (typeof window !== 'undefined' && window.location) {
        // 使用较温和的方式 - 使用pushState保持用户在当前页面
        const currentLocation = window.location.pathname;
        if (currentLocation !== '/' && currentLocation !== '/home') {
          window.history.pushState({}, '', '/');
          
          // 触发一个自定义事件，让应用知道需要更新路由
          const navigationEvent = new CustomEvent('app:navigation', { 
            detail: { path: '/', reason: 'logout' } 
          });
          window.dispatchEvent(navigationEvent);
        } else {
          // 如果已经在首页，只需要触发页面刷新
          const refreshEvent = new CustomEvent('app:refresh', { 
            detail: { reason: 'logout' } 
          });
          window.dispatchEvent(refreshEvent);
        }
      }
    } catch (error) {
      console.error('[UserContext] 登出后导航错误:', error);
    }
  };

  const login = async (username: string, password: string): Promise<boolean> => {
    setLoading(true);
    setError(null);
    try {
      // 在登录之前清除所有之前用户的本地存储数据
      const oldToken = localStorage.getItem('token');
      if (oldToken) {
        console.log('[UserContext] 检测到之前的登录会话，清除旧数据...');
        
        // 执行完整的清理
        const keysToRemove = [];
        for (let i = 0; i < localStorage.length; i++) {
          const key = localStorage.key(i);
          if (key && (
            key.startsWith('quiz_') ||
            key.startsWith('user_') ||
            key === 'token' ||
            key === 'questionSetAccessCache' ||
            key === 'redeemedQuestionSetIds' ||
            key === 'quizAccessRights'
          )) {
            keysToRemove.push(key);
          }
        }
        
        // 批量删除本地存储项
        keysToRemove.forEach(key => localStorage.removeItem(key));
        
        // 清除sessionStorage中的数据
        const sessionKeysToRemove = [];
        for (let i = 0; i < sessionStorage.length; i++) {
          const key = sessionStorage.key(i);
          if (key && (
            key.startsWith('quiz_') ||
            key.startsWith('user_')
          )) {
            sessionKeysToRemove.push(key);
          }
        }
        
        // 批量删除会话存储项
        sessionKeysToRemove.forEach(key => sessionStorage.removeItem(key));
        
        // 清除API客户端缓存
        apiClient.clearCache();
      }
      
      // 清空状态
      setUser(null);
      setUserPurchases([]);
      
      const response = await userApi.login(username, password);
      if (response.success && response.data) {
        const token = response.data.token || '';
        localStorage.setItem('token', token);
        
        // 处理用户数据存在的情况
        if (response.data.user) {
          const userData = response.data.user;
          
          // 使用用户ID作为前缀，隔离不同用户的数据
          const userPrefix = `user_${userData.id}_`;
          
          // 设置用户状态
          setUser(userData);
          
          // 登录后初始化Socket连接
          const socketInstance = initializeSocket();
          authenticateUser(userData.id, token);
          
          // 登录成功后立即同步访问权限
          setTimeout(async () => {
            console.log("[UserContext] 登录成功，立即进行数据库权限同步");
            
            try {
              // 1. 从服务器重新获取最新的用户数据，确保购买记录是最新的
              const refreshedUserData = await userApi.getCurrentUser();
              if (refreshedUserData.success && refreshedUserData.data) {
                // 使用最新的用户数据更新状态
                setUser(refreshedUserData.data);
                
                // 2. 通过socket请求最新的访问权限
                if (socketInstance) {
                  socketInstance.emit('user:syncAccessRights', {
                    userId: userData.id,
                    forceRefresh: true
                  });
                }
                
                // 3a. 检查购买记录并同步到本地存储
                if (refreshedUserData.data.purchases && refreshedUserData.data.purchases.length > 0) {
                  console.log(`[UserContext] 同步 ${refreshedUserData.data.purchases.length} 条购买记录到本地`);
                  
                  const now = new Date();
                  refreshedUserData.data.purchases.forEach(purchase => {
                    if (!purchase.questionSetId) return;
                    
                    const expiryDate = purchase.expiryDate ? new Date(purchase.expiryDate) : null;
                    const isExpired = expiryDate && expiryDate <= now;
                    const isActive = purchase.status === 'active' || purchase.status === 'completed';
                    
                    if (!isExpired && isActive) {
                      // 使用用户ID前缀保存访问权限
                      localStorage.setItem(
                        `${userPrefix}access_${purchase.questionSetId}`,
                        JSON.stringify({
                          hasAccess: true,
                          expiryDate: purchase.expiryDate,
                          purchaseId: purchase.id
                        })
                      );
                    }
                  });
                }
                
                // 3b. 处理已兑换的题库，确保跨设备同步
                if (refreshedUserData.data.redeemCodes && refreshedUserData.data.redeemCodes.length > 0) {
                  console.log(`[UserContext] 同步 ${refreshedUserData.data.redeemCodes.length} 条兑换码记录到本地`);
                  
                  // 收集所有已兑换的题库ID
                  const redeemedQuestionSetIds: string[] = [];
                  
                  refreshedUserData.data.redeemCodes.forEach(code => {
                    if (!code.questionSetId) return;
                    
                    // 添加到已兑换题库ID列表
                    redeemedQuestionSetIds.push(code.questionSetId);
                    
                    // 使用用户ID前缀保存到本地存储
                    localStorage.setItem(
                      `${userPrefix}redeemed_${code.questionSetId}`,
                      JSON.stringify({
                        redeemedAt: code.usedAt,
                        expiryDate: code.expiryDate
                      })
                    );
                  });
                  
                  // 将所有兑换码对应的题库ID保存到localStorage
                  try {
                    localStorage.setItem(
                      `${userPrefix}redeemedQuestionSetIds`,
                      JSON.stringify(redeemedQuestionSetIds)
                    );
                    console.log(`[UserContext] 已保存${redeemedQuestionSetIds.length}个已兑换题库ID到本地存储`);
                  } catch (error) {
                    console.error('[UserContext] 保存兑换记录到本地存储失败:', error);
                  }
                }
                
                // 4. 触发全局事件通知组件更新状态
                window.dispatchEvent(new CustomEvent('accessRights:updated', {
                  detail: {
                    userId: userData.id,
                    timestamp: Date.now(),
                    source: 'login_refresh'
                  }
                }));
              }
            } catch (error) {
              console.error('[UserContext] 登录后同步访问权限失败:', error);
            }
          }, 500);
          
          notifyUserChange(userData);
          return true;
        } else {
          // 用户数据不存在，尝试获取
          const userResponse = await fetchCurrentUser(); 
          if (userResponse) {
            // 同样需要立即同步数据库权限
            setTimeout(async () => {
              await syncAccessRights();
            }, 500);
            
            notifyUserChange(userResponse);
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
      console.log(`[addPurchase] 开始添加购买记录:`, purchase);
      
      // 确保ID格式正确
      const formattedPurchase = {
        ...purchase,
        questionSetId: String(purchase.questionSetId).trim()
      };
      
      // 检查是否已存在相同ID的购买记录
      const updatedPurchases = [...(user.purchases || [])];
      if (!updatedPurchases.some(p => p.id === formattedPurchase.id)) {
        updatedPurchases.push(formattedPurchase);
        
        console.log(`[addPurchase] 更新前用户购买记录数量: ${user.purchases?.length || 0}`);
        console.log(`[addPurchase] 更新后用户购买记录数量: ${updatedPurchases.length}`);
        
        // 创建更新后的用户对象
        const updatedUser = {
          ...user,
          purchases: updatedPurchases
        };
        
        // 更新用户状态
        setUser(updatedUser);
        
        // 尝试通过socket通知权限更新
        if (socket) {
          console.log(`[addPurchase] 通过socket发送权限更新通知: ${formattedPurchase.questionSetId}`);
          socket.emit('questionSet:accessUpdate', {
            userId: user.id,
            questionSetId: formattedPurchase.questionSetId,
            hasAccess: true
          });
          
          // 发送购买成功事件
          socket.emit('purchase:success', {
            userId: user.id,
            questionSetId: formattedPurchase.questionSetId,
            purchaseId: formattedPurchase.id,
            expiryDate: formattedPurchase.expiryDate
          });
        }
        
        // 通知用户状态变化
        notifyUserChange(updatedUser);
        
        // 强制刷新用户数据
        setTimeout(() => {
          console.log(`[addPurchase] 开始获取最新用户数据`);
          fetchCurrentUser();
        }, 500);
      } else {
        console.log(`[addPurchase] 购买记录ID已存在，跳过添加: ${formattedPurchase.id}`);
      }
      
      // 同步更新到数据库
      await updateUser({ purchases: updatedPurchases });
      console.log(`[addPurchase] 购买记录已同步到数据库`);
    } catch (error) {
      console.error('[addPurchase] 添加购买记录失败:', error);
      throw error;
    }
  };

  // 获取本地缓存
  const getLocalAccessCache = () => {
    try {
      const raw = localStorage.getItem('questionSetAccessCache') || '{}';
      return JSON.parse(raw);
    } catch (e) {
      console.error('[UserContext] Error reading cache:', e);
      return {};
    }
  };

  // Save access rights to localStorage
  const saveAccessToLocalStorage = (questionSetId: string, hasAccess: boolean, remainingDays?: number | null, accessType?: string) => {
    try {
      // Skip if no user or questionSetId
      if (!user?.id || !questionSetId) return;
      
      const cache = getLocalAccessCache();
      
      // Create user section if it doesn't exist
      if (!cache[user.id]) cache[user.id] = {};
      
      // Store access info with timestamp
      cache[user.id][questionSetId] = {
        hasAccess,
        remainingDays,
        timestamp: Date.now(),
        accessType
      };
      
      // Save to localStorage
      localStorage.setItem('questionSetAccessCache', JSON.stringify(cache));
      console.log(`[UserContext] Saved access right for ${questionSetId} (User: ${user.id})`);
    } catch (error) {
      console.error('[UserContext] Error saving access rights to localStorage:', error);
    }
  };

  // 添加检查数据库购买记录函数
  const hasAccessInDatabase = useCallback(async (questionSetId: string): Promise<boolean> => {
    if (!user?.id) return false;
    
    try {
      // 从服务器获取最新购买状态
      const response = await apiClient.get(`/api/purchases/check/${questionSetId}`, {
        userId: user.id
      }, { 
        cacheDuration: 60000 // 1分钟缓存，避免频繁请求
      });
      
      return response?.success && response?.data?.hasAccess === true;
    } catch (error) {
      console.error(`[UserContext] 检查数据库购买记录失败:`, error);
      return false;
    }
  }, [user?.id]);

  // 增强的访问权限检查函数
  const hasAccessToQuestionSet = useCallback(async (questionSetId: string): Promise<boolean> => {
    if (!user || !questionSetId) return false;
    
    // 记录函数调用
    console.log(`[hasAccessToQuestionSet] 检查题库权限: ${questionSetId}`);
    
    // 1. 首先检查本地缓存 (最快)
    try {
      const cache = getLocalAccessCache();
      if (cache[user.id] && cache[user.id][questionSetId]) {
        const accessInfo = cache[user.id][questionSetId];
        
        // 检查缓存是否较新 (30分钟内)
        const isCacheRecent = (Date.now() - accessInfo.timestamp) < 1800000;
        
        if (isCacheRecent && accessInfo.hasAccess) {
          console.log(`[hasAccessToQuestionSet] 本地缓存显示有权限`);
          return true;
        }
      }
    } catch (error) {
      console.error('[hasAccessToQuestionSet] 检查本地缓存出错:', error);
    }
    
    // 2. 然后检查用户对象中的购买记录
    if (user.purchases && user.purchases.length > 0) {
      const purchase = user.purchases.find(p => {
        // 标准化ID进行比较
        const purchaseId = String(p.questionSetId || '').trim();
        const targetId = String(questionSetId).trim();
        
        // 检查精确匹配或相似匹配
        const exactMatch = purchaseId === targetId;
        const partialMatch = (purchaseId.includes(targetId) || targetId.includes(purchaseId)) 
          && Math.abs(purchaseId.length - targetId.length) <= 3
          && purchaseId.length > 5 && targetId.length > 5;
        
        return exactMatch || partialMatch;
      });
      
      if (purchase) {
        const now = new Date();
        const expiryDate = purchase.expiryDate ? new Date(purchase.expiryDate) : null;
        const isExpired = expiryDate && expiryDate <= now;
        const isActive = purchase.status === 'active' || purchase.status === 'completed' || !purchase.status;
        
        const hasAccess = !isExpired && isActive;
        if (hasAccess) {
          console.log(`[hasAccessToQuestionSet] 用户购买记录显示有权限`);
          
          // 更新本地缓存
          try {
            let remainingDays = null;
            if (expiryDate) {
              const diffTime = expiryDate.getTime() - now.getTime();
              remainingDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));
            }
            
            saveAccessToLocalStorage(questionSetId, true, remainingDays);
          } catch (error) {
            console.error('[hasAccessToQuestionSet] 更新缓存出错:', error);
          }
          
          return true;
        }
      }
    }
    
    // 3. 检查已兑换题库的本地存储
    try {
      const redeemedStr = localStorage.getItem('redeemedQuestionSetIds');
      if (redeemedStr) {
        const redeemedIds = JSON.parse(redeemedStr);
        if (Array.isArray(redeemedIds)) {
          const normalizedId = String(questionSetId).trim();
          const isRedeemed = redeemedIds.some(id => String(id).trim() === normalizedId);
          
          if (isRedeemed) {
            console.log(`[hasAccessToQuestionSet] 本地兑换记录显示有权限`);
            
            // 更新本地缓存
            saveAccessToLocalStorage(questionSetId, true, null);
            return true;
          }
        }
      }
    } catch (error) {
      console.error('[hasAccessToQuestionSet] 检查兑换记录出错:', error);
    }
    
    // 4. 最后，如果本地检查都失败，则直接检查数据库
    try {
      const dbAccess = await hasAccessInDatabase(questionSetId);
      if (dbAccess) {
        console.log(`[hasAccessToQuestionSet] 数据库显示有权限`);
        
        // 同步更新缓存和状态
        saveAccessToLocalStorage(questionSetId, true, null);
        
        // 同步其他设备
        if (socket) {
          socket.emit('questionSet:accessUpdate', {
            userId: user.id,
            questionSetId: questionSetId,
            hasAccess: true,
            source: 'db_check'
          });
        }
        
        return true;
      }
    } catch (error) {
      console.error('[hasAccessToQuestionSet] 检查数据库出错:', error);
    }
    
    // 所有检查都失败，无权限
    console.log(`[hasAccessToQuestionSet] 无权限访问`);
    return false;
  }, [user, socket, hasAccessInDatabase]);

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

  const redeemCode = async (code: string): Promise<{ success: boolean; message: string; questionSetId?: string; quizTitle?: string }> => {
    if (!user) return { success: false, message: '请先登录' };
    try {
      console.log(`[RedeemCode] 开始兑换码: ${code}`);
      const response = await redeemCodeApi.redeemCode(code);
      
      console.log(`[RedeemCode] 后端响应:`, response);
      
      if (response.success) {
        // 获取购买记录和题库信息
        const rawPurchase = response.data?.purchase;
        const questionSet = response.data?.questionSet;
        
        console.log(`[RedeemCode] 原始购买记录:`, rawPurchase);
        console.log(`[RedeemCode] 题库信息:`, questionSet);
        
        if (rawPurchase && user) {
          // 从原始数据中获取字段，考虑到API可能返回蛇形命名法
          const questionSetId = questionSet?.id || 
                             rawPurchase.questionSetId || 
                             (rawPurchase as any).question_set_id;
                             
          const purchaseDate = rawPurchase.purchaseDate || 
                            (rawPurchase as any).purchase_date || 
                            new Date().toISOString();
                            
          const expiryDate = rawPurchase.expiryDate || 
                          (rawPurchase as any).expiry_date || 
                          new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString();
          
          // 格式化购买记录，确保符合Purchase接口定义
          const formattedPurchase: Purchase = {
            id: rawPurchase.id,
            userId: user.id,
            questionSetId: String(questionSetId).trim(), // 确保ID格式一致
            purchaseDate,
            expiryDate,
            status: rawPurchase.status || 'active',
            amount: rawPurchase.amount || 0,
            transactionId: rawPurchase.transactionId || '',
            paymentMethod: rawPurchase.paymentMethod || 'redeem'
          };
          
          console.log(`[RedeemCode] 格式化后的购买记录:`, formattedPurchase);
          console.log(`[RedeemCode] 格式化后的购买记录ID: ${formattedPurchase.questionSetId}`);
          
          // 直接更新用户状态中的购买记录
          const updatedPurchases = [...(user.purchases || [])];
          
          // 确保不添加重复的购买记录
          if (!updatedPurchases.some(p => p.id === formattedPurchase.id)) {
            updatedPurchases.push(formattedPurchase);
            
            console.log(`[RedeemCode] 更新前用户购买记录数量: ${user.purchases?.length || 0}`);
            console.log(`[RedeemCode] 更新后用户购买记录数量: ${updatedPurchases.length}`);
            
            // 立即更新用户状态
            const updatedUser = {
              ...user,
              purchases: updatedPurchases
            };
            
            setUser(updatedUser);
            
            // 尝试通过socket通知权限更新
            if (socket) {
              console.log(`[RedeemCode] 通过socket发送权限更新通知: ${questionSetId}`);
              socket.emit('questionSet:accessUpdate', {
                userId: user.id,
                questionSetId: String(questionSetId).trim(),
                hasAccess: true
              });
            }
            
            // 通知用户状态变化
            notifyUserChange(updatedUser);
            
            // 强制刷新用户数据
            setTimeout(() => {
              console.log(`[RedeemCode] 开始获取最新用户数据`);
              fetchCurrentUser();
            }, 500);
            
            console.log(`[RedeemCode] 用户状态已更新，新购买记录已添加`);
          } else {
            console.log(`[RedeemCode] 购买记录已存在，跳过添加`);
          }
        } else {
          console.warn(`[RedeemCode] 无法更新用户状态:`, { hasPurchase: !!rawPurchase, hasUser: !!user });
        }
        
        // 安全地获取题库ID和标题
        const questionSetId = questionSet?.id || 
                      rawPurchase?.questionSetId || 
                      (rawPurchase as any)?.question_set_id;
        const quizTitle = questionSet?.title;
        
        console.log(`[RedeemCode] 返回兑换结果:`, { questionSetId, quizTitle });
        
        return {
          success: true,
          message: '兑换成功!',
          questionSetId,
          quizTitle
        };
      } else {
        console.error('兑换码兑换失败:', response.message, response);
        return {
          success: false,
          message: response.message || '兑换失败，请检查兑换码是否有效'
        };
      }
    } catch (error: any) {
      console.error('兑换码处理错误:', error);
      return {
        success: false,
        message: error.message || '兑换过程中发生错误'
      };
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

  // Function to synchronize access rights across devices
  const syncAccessRights = useCallback(async () => {
    if (!user || !user.id || !socket) return;
    
    console.log('[UserContext] 开始跨设备访问权限同步');
    
    try {
      // 1. 首先从服务器获取最新用户数据
      const freshUserResponse = await userApi.getCurrentUser();
      if (freshUserResponse.success && freshUserResponse.data) {
        console.log('[UserContext] 成功获取最新用户数据');
        
        // 更新用户状态，包括最新的购买记录
        setUser(freshUserResponse.data);
        
        // 2. 通知socket进行权限同步
        socket.emit('user:syncAccessRights', {
          userId: user.id,
          forceRefresh: true
        });
        
        // 3. 处理最新的购买记录
        if (freshUserResponse.data.purchases && freshUserResponse.data.purchases.length > 0) {
          console.log(`[UserContext] 处理 ${freshUserResponse.data.purchases.length} 条最新购买记录`);
          
          const now = new Date();
          freshUserResponse.data.purchases.forEach(purchase => {
            if (!purchase.questionSetId) return;
            
            const expiryDate = purchase.expiryDate ? new Date(purchase.expiryDate) : null;
            const isExpired = expiryDate && expiryDate <= now;
            const isActive = purchase.status === 'active' || purchase.status === 'completed' || !purchase.status;
            
            if (!isExpired && isActive) {
              // 计算剩余天数
              let remainingDays = null;
              if (expiryDate) {
                const diffTime = expiryDate.getTime() - now.getTime();
                remainingDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));
              }
              
              console.log(`[UserContext] 同步题库访问权限: ${purchase.questionSetId}, 剩余天数: ${remainingDays}`);
              
              // 保存到本地存储
              saveAccessToLocalStorage(purchase.questionSetId, true, remainingDays);
              
              // 单独请求题库权限状态，确保其他数据也同步
              socket.emit('questionSet:checkAccess', {
                userId: user.id,
                questionSetId: purchase.questionSetId
              });
            }
          });
        }
        
        // 4. 触发全局事件更新UI
        window.dispatchEvent(new CustomEvent('accessRights:updated', {
          detail: { 
            userId: user.id, 
            timestamp: Date.now(),
            source: 'database_refresh'
          }
        }));
        
        // 5. 广播到用户的其他设备
        socket.emit('user:deviceSync', {
          userId: user.id,
          type: 'access_refresh',
          timestamp: Date.now()
        });
      }
    } catch (error) {
      console.error('[UserContext] 同步访问权限错误:', error);
    }
  }, [user, socket]);

  // 刷新购买记录
  const refreshPurchases = useCallback(async () => {
    if (!user) {
      console.log('[用户] 用户未登录，无法刷新购买记录');
      return [];
    }

    try {
      console.log('[用户] 开始刷新购买记录');
      const purchases = await refreshUserPurchases();
      
      if (purchases && Array.isArray(purchases)) {
        console.log(`[用户] 刷新购买记录成功，获取 ${purchases.length} 条记录`);
        setUserPurchases(purchases);
        return purchases;
      } else {
        console.error('[用户] 刷新购买记录返回无效数据:', purchases);
        return [];
      }
    } catch (error) {
      console.error('[用户] 刷新购买记录失败:', error);
      return [];
    }
  }, [user]);

  const contextValue = useMemo(() => ({
    user,
    loading,
    error,
    userChangeEvent,
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
    updateUserProgress,
    syncAccessRights,
    refreshPurchases
  }), [user, loading, error, userChangeEvent, login, logout, register, updateUser, addProgress, addPurchase, hasAccessToQuestionSet, getRemainingAccessDays, isQuizCompleted, getQuizScore, getUserProgress, getAnsweredQuestions, isAdmin, redeemCode, generateRedeemCode, getRedeemCodes, getAllUsers, deleteUser, adminRegister, updateUserProgress, syncAccessRights, refreshPurchases]);

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
