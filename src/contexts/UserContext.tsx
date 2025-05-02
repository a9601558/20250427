import React, { createContext, useState, useContext, useEffect, ReactNode, useCallback, useMemo, useRef } from 'react';
import { User, Purchase, RedeemCode, UserProgress } from '../types';
import { userApi, redeemCodeApi, userProgressApi } from '../utils/api';
import { initializeSocket, authenticateUser } from '../config/socket';
import { useSocket } from './SocketContext';
import apiClient from '../utils/api-client';
import { userProgressService } from '../services/user-progress-service';
import { logger } from '../utils/logger';

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

// Define interfaces for redeem types
interface RedeemItem {
  questionSetId: string;
  [key: string]: unknown;
}

interface RedeemedCode {
  questionSetId: string;
  [key: string]: unknown;
}

interface PurchaseResponse {
  id: string;
  questionSetId?: string;
  question_set_id?: string;
  purchaseDate?: string;
  purchase_date?: string;
  expiryDate?: string;
  expiry_date?: string;
  status?: string;
  amount?: number;
  transactionId?: string;
  paymentMethod?: string;
  purchaseQuestionSet?: unknown;
  [key: string]: unknown;
}

interface QuestionSetResponse {
  id: string;
  title: string;
  [key: string]: unknown;
}

interface RedeemCodeResponse {
  success: boolean;
  data?: {
    purchase?: PurchaseResponse;
    questionSet?: QuestionSetResponse;
  };
  message?: string;
  error?: string;
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
  redeemCode: (code: string) => Promise<{ success: boolean; message: string; questionSetId?: string; quizTitle?: string }>;
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
  const [userChangeEvent, setUserChangeEvent] = useState<{userId: string | null, timestamp: number}>({ userId: null, timestamp: 0 });
  // 添加一个上次通知时间引用，用于防抖
  const lastNotifyTimeRef = useRef<number>(0);
  // 添加当前用户ID引用，用于比较
  const prevUserIdRef = useRef<string | null>(null);
  const { socket } = useSocket();

  // 当用户变化时触发事件
  const notifyUserChange = useCallback((newUser: User | null) => {
    // 获取新用户ID
    const newUserId = newUser?.id || null;
    // 获取当前时间
    const now = Date.now();
    
    // 如果与上次通知的用户ID相同且时间间隔小于500ms，则忽略此次通知
    if (newUserId === prevUserIdRef.current && now - lastNotifyTimeRef.current < 500) {
      logger.info('忽略重复的用户变更通知:', newUserId);
      return;
    }
    
    // 更新上次通知时间和用户ID
    lastNotifyTimeRef.current = now;
    prevUserIdRef.current = newUserId;
    
    // 触发事件
    logger.info('发送用户变更通知:', newUserId);
    setUserChangeEvent({
      userId: newUserId,
      timestamp: now,
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
      setUser((prev) => {
        if (!prev) return null;
        return {
          ...prev,
          progress: {
            ...prev.progress,
            [data.questionSetId]: {
              ...data.progress,
                lastAccessed: data.progress?.lastAccessed || new Date().toISOString(),
            },
          },
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
        logger.info('[UserContext] 获取到用户数据:', response.data);
        
        // 检查购买记录
        if (response.data.purchases) {
          logger.info('[UserContext] 用户购买记录数量:', response.data.purchases.length);
          
          // 详细打印第一条购买记录的结构（如果有）
          if (response.data.purchases.length > 0) {
            logger.info('[UserContext] 购买记录结构示例:', JSON.stringify(response.data.purchases[0]));
            
            // 检查关键字段
            const firstPurchase = response.data.purchases[0];
            logger.info('[UserContext] 购买记录字段检查:');
            logger.info('- questionSetId:', firstPurchase.questionSetId);
            logger.info('- question_set_id:', (firstPurchase as PurchaseResponse).question_set_id);
            logger.info('- purchaseQuestionSet:', firstPurchase.purchaseQuestionSet);
            logger.info('- expiryDate:', firstPurchase.expiryDate);
            logger.info('- expiry_date:', (firstPurchase as PurchaseResponse).expiry_date);
          }
        } else {
          logger.info('[UserContext] 用户没有购买记录或购买记录字段缺失');
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
      logger.error('[UserProvider] Failed to fetch current user:', error);
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
        const token = response.data.token || '';
        localStorage.setItem('token', token);
        
        // 处理用户数据存在的情况
        if (response.data.user) {
          const userData = response.data.user;
          setUser(userData);
          
          // 登录后初始化Socket连接
          const socketInstance = initializeSocket();
          authenticateUser(userData.id, token);
          
          // 延迟一下再检查题库权限，确保Socket连接已建立
          setTimeout(() => {
            logger.info('[UserContext] 登录成功，开始检查题库访问权限');
            
            // 获取所有题库ID并检查权限
            if (socketInstance) {
              // 检查已购买题库
              const purchasedQuestionSetIds = userData.purchases?.map((p) => p.questionSetId) || [];
              logger.info(`[UserContext] 已购买题库: ${purchasedQuestionSetIds.length}个`);
              
              // 检查已兑换题库 - 根据用户类型可能有不同的字段名
              const redeemedQuestionSetIds: string[] = [];
              
              // 检查redeems字段（如果存在）
              if (Array.isArray((userData as User & { redeems?: RedeemItem[] }).redeems)) {
                const redeemIds = (userData as User & { redeems?: RedeemItem[] }).redeems
                  ?.map((r: RedeemItem) => r.questionSetId)
                  .filter(Boolean) || [];
                redeemedQuestionSetIds.push(...redeemIds);
              }
              
              // 检查redeemedCodes字段（如果存在）
              if (Array.isArray((userData as User & { redeemedCodes?: RedeemedCode[] }).redeemedCodes)) {
                const redeemCodeIds = (userData as User & { redeemedCodes?: RedeemedCode[] }).redeemedCodes
                  ?.map((r: RedeemedCode) => r.questionSetId)
                  .filter(Boolean) || [];
                redeemedQuestionSetIds.push(...redeemCodeIds);
              }
              
              logger.info(`[UserContext] 已兑换题库: ${redeemedQuestionSetIds.length}个`);
              
              // 合并去重
              const allQuestionSetIds = [...new Set([...purchasedQuestionSetIds, ...redeemedQuestionSetIds])];
              logger.info(`[UserContext] 总共需要检查: ${allQuestionSetIds.length}个题库`);
              
              if (allQuestionSetIds.length > 0) {
                // 批量检查
                socketInstance.emit('questionSet:checkAccessBatch', {
                  userId: userData.id,
                  questionSetIds: allQuestionSetIds,
                });
                
                // 逐个检查作为备份
                allQuestionSetIds.forEach((questionSetId) => {
                  if (questionSetId) {
                    socketInstance.emit('questionSet:checkAccess', {
                      userId: userData.id,
                      questionSetId: String(questionSetId).trim(),
                    });
                  }
                });
              }
            }
          }, 500);
          
          notifyUserChange(userData); // 通知用户变化
          return true;
        } else {
          // 用户数据不存在，尝试获取
          const userResponse = await fetchCurrentUser(); 
          if (userResponse) {
            // 同样需要检查题库权限
            const socketInstance = initializeSocket();
            authenticateUser(userResponse.id, token);
            
            setTimeout(() => {
              if (socketInstance) {
                const purchasedQuestionSetIds = userResponse.purchases?.map((p) => p.questionSetId) || [];
                
                // 检查已兑换题库 - 根据用户类型可能有不同的字段名
                const redeemedQuestionSetIds: string[] = [];
                
                // 检查redeems字段（如果存在）
                if (Array.isArray((userResponse as User & { redeems?: RedeemItem[] }).redeems)) {
                  const redeemIds = (userResponse as User & { redeems?: RedeemItem[] }).redeems
                    ?.map((r: RedeemItem) => r.questionSetId)
                    .filter(Boolean) || [];
                  redeemedQuestionSetIds.push(...redeemIds);
                }
                
                // 检查redeemedCodes字段（如果存在）
                if (Array.isArray((userResponse as User & { redeemedCodes?: RedeemedCode[] }).redeemedCodes)) {
                  const redeemCodeIds = (userResponse as User & { redeemedCodes?: RedeemedCode[] }).redeemedCodes
                    ?.map((r: RedeemedCode) => r.questionSetId)
                    .filter(Boolean) || [];
                  redeemedQuestionSetIds.push(...redeemCodeIds);
                }
                
                const allQuestionSetIds = [...new Set([...purchasedQuestionSetIds, ...redeemedQuestionSetIds])];
                
                if (allQuestionSetIds.length > 0) {
                  // 批量检查
                  socketInstance.emit('questionSet:checkAccessBatch', {
                    userId: userResponse.id,
                    questionSetIds: allQuestionSetIds,
                  });
                  
                  // 逐个检查作为备份
                  allQuestionSetIds.forEach((questionSetId) => {
                    if (questionSetId) {
                      socketInstance.emit('questionSet:checkAccess', {
                        userId: userResponse.id,
                        questionSetId: String(questionSetId).trim(),
                      });
                    }
                  });
                }
              }
            }, 500);
            
            notifyUserChange(userResponse); // 通知用户变化
          }
          return userResponse !== null;
        }
      } else {
        setError(response.message || 'Invalid username or password');
        return false;
      }
    } catch (error) {
      logger.error('[UserProvider] Login failed:', error);
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
      logger.error('[UserProvider] Registration failed:', error);
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
      logger.error('[UserProvider] Failed to update user:', error);
      setError('An error occurred while updating user');
    } finally {
      setLoading(false);
    }
  };

  const addProgress = async (progress: QuizProgress) => {
    if (!user) {
      logger.error('[UserProvider] User not logged in');
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
        accuracy: 0,
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
        accuracy: existingProgress.accuracy,
      };

      // Sync with backend
      const response = await userProgressApi.updateProgress(updatedProgress);
      if (!response.success) {
        throw new Error(response.message || 'Failed to update progress on server');
      }

      const newProgress: Record<string, UserProgress> = {
        ...currentProgress,
        [progress.questionSetId]: updatedProgress,
      };

      await updateUser({ progress: newProgress });
    } catch (error) {
      logger.error('[UserProvider] Failed to add progress:', error);
      throw error;
    }
  };

  const addPurchase = async (purchase: Purchase) => {
    if (!user) return;
    try {
      logger.info('[addPurchase] 开始添加购买记录:', purchase);
      
      // 确保ID格式正确
      const formattedPurchase = {
        ...purchase,
        questionSetId: String(purchase.questionSetId).trim(),
      };
      
      // 检查是否已存在相同ID的购买记录
      const updatedPurchases = [...(user.purchases || [])];
      if (!updatedPurchases.some((p) => p.id === formattedPurchase.id)) {
        updatedPurchases.push(formattedPurchase);
        
        logger.info(`[addPurchase] 更新前用户购买记录数量: ${user.purchases?.length || 0}`);
        logger.info(`[addPurchase] 更新后用户购买记录数量: ${updatedPurchases.length}`);
        
        // 创建更新后的用户对象
        const updatedUser = {
          ...user,
          purchases: updatedPurchases,
        };
        
        // 更新用户状态
        setUser(updatedUser);
        
        // 尝试通过socket通知权限更新
        if (socket) {
          logger.info(`[addPurchase] 通过socket发送权限更新通知: ${formattedPurchase.questionSetId}`);
          socket.emit('questionSet:accessUpdate', {
            userId: user.id,
            questionSetId: formattedPurchase.questionSetId,
            hasAccess: true,
          });
          
          // 发送购买成功事件
          socket.emit('purchase:success', {
            userId: user.id,
            questionSetId: formattedPurchase.questionSetId,
            purchaseId: formattedPurchase.id,
            expiryDate: formattedPurchase.expiryDate,
          });
        }
        
        // 通知用户状态变化
        notifyUserChange(updatedUser);
        
        // 强制刷新用户数据
        setTimeout(() => {
          logger.info('[addPurchase] 开始获取最新用户数据');
          fetchCurrentUser();
        }, 500);
      } else {
        logger.info(`[addPurchase] 购买记录ID已存在，跳过添加: ${formattedPurchase.id}`);
      }
      
      // 同步更新到数据库
      await updateUser({ purchases: updatedPurchases });
      logger.info('[addPurchase] 购买记录已同步到数据库');
    } catch (error) {
      logger.error('[addPurchase] 添加购买记录失败:', error);
      throw error;
    }
  };

  const hasAccessToQuestionSet = useCallback((questionSetId: string): boolean => {
    if (!user || !user.purchases) {
      logger.info(`[hasAccessToQuestionSet] 无权限访问题库 ${questionSetId}:`, { hasUser: !!user, hasPurchases: !!(user?.purchases) });
      return false;
    }

    logger.info(`[hasAccessToQuestionSet] 检查题库权限 ${questionSetId}, 购买记录:`, user.purchases);
    
    // 确保questionSetId是字符串类型并规范化比较
    const strQuestionSetId = String(questionSetId).trim();
    
    // 打印出所有购买记录的ID以便调试
    user.purchases.forEach((purchase, index) => {
      const purchaseId = String(purchase.questionSetId).trim();
      logger.info(`[hasAccessToQuestionSet] 购买记录 #${index}: ${purchaseId} vs ${strQuestionSetId}, 匹配: ${purchaseId === strQuestionSetId}`);
    });
    
    const hasAccess = user.purchases.some((p) => {
      // 对两个ID进行严格的字符串处理
      const purchaseQuestionSetId = String(p.questionSetId).trim();
      const isMatching = purchaseQuestionSetId === strQuestionSetId;
      const isValid = new Date(p.expiryDate) > new Date() || !p.expiryDate;
      const isActive = p.status !== 'cancelled' && p.status !== 'expired';
      
      logger.info(`[hasAccessToQuestionSet] 评估: ID匹配=${isMatching}, 有效期=${isValid}, 状态有效=${isActive}`);
      
      return isMatching && isValid && isActive;
    });
    
    logger.info(`[hasAccessToQuestionSet] 题库 ${questionSetId} 访问结果:`, hasAccess);
    
    return hasAccess;
  }, [user]);

  const getRemainingAccessDays = useCallback((questionSetId: string): number | null => {
    if (!user || !user.purchases) return null;

    const purchase = user.purchases.find((p) => 
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
      lastAttemptDate: progress.lastAccessed ? new Date(progress.lastAccessed) : undefined,
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
      logger.info(`[RedeemCode] 开始兑换码: ${code}`);
      const response = await redeemCodeApi.redeemCode(code) as RedeemCodeResponse;
      
      logger.info('[RedeemCode] 后端响应:', response);
      
      if (response.success) {
        // 获取购买记录和题库信息
        const rawPurchase = response.data?.purchase;
        const questionSet = response.data?.questionSet;
        
        logger.info('[RedeemCode] 原始购买记录:', rawPurchase);
        logger.info('[RedeemCode] 题库信息:', questionSet);
        
        if (rawPurchase && user) {
          // 从原始数据中获取字段，考虑到API可能返回蛇形命名法
          const questionSetId = questionSet?.id || 
                             rawPurchase.questionSetId || 
                             rawPurchase.question_set_id;
                             
          const purchaseDate = rawPurchase.purchaseDate || 
                            rawPurchase.purchase_date || 
                            new Date().toISOString();
                            
          const expiryDate = rawPurchase.expiryDate || 
                          rawPurchase.expiry_date || 
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
            paymentMethod: rawPurchase.paymentMethod || 'redeem',
          };
          
          logger.info('[RedeemCode] 格式化后的购买记录:', formattedPurchase);
          logger.info(`[RedeemCode] 格式化后的购买记录ID: ${formattedPurchase.questionSetId}`);
          
          // 直接更新用户状态中的购买记录
          const updatedPurchases = [...(user.purchases || [])];
          
          // 确保不添加重复的购买记录
          if (!updatedPurchases.some((p) => p.id === formattedPurchase.id)) {
            updatedPurchases.push(formattedPurchase);
            
            logger.info(`[RedeemCode] 更新前用户购买记录数量: ${user.purchases?.length || 0}`);
            logger.info(`[RedeemCode] 更新后用户购买记录数量: ${updatedPurchases.length}`);
            
            // 立即更新用户状态
            const updatedUser = {
              ...user,
              purchases: updatedPurchases,
            };
            
            setUser(updatedUser);
            
            // 尝试通过socket通知权限更新
            if (socket) {
              logger.info(`[RedeemCode] 通过socket发送权限更新通知: ${questionSetId}`);
              socket.emit('questionSet:accessUpdate', {
                userId: user.id,
                questionSetId: String(questionSetId).trim(),
                hasAccess: true,
              });
            }
            
            // 通知用户状态变化
            notifyUserChange(updatedUser);
            
            // 强制刷新用户数据
            setTimeout(() => {
              logger.info('[RedeemCode] 开始获取最新用户数据');
              fetchCurrentUser();
            }, 500);
            
            logger.info('[RedeemCode] 用户状态已更新，新购买记录已添加');
          } else {
            logger.info('[RedeemCode] 购买记录已存在，跳过添加');
          }
        } else {
          logger.warn('[RedeemCode] 无法更新用户状态:', { hasPurchase: !!rawPurchase, hasUser: !!user });
        }
        
        // 安全地获取题库ID和标题
        const questionSetId = questionSet?.id || 
                      rawPurchase?.questionSetId || 
                      rawPurchase?.question_set_id;
        const quizTitle = questionSet?.title;
        
        logger.info('[RedeemCode] 返回兑换结果:', { questionSetId, quizTitle });
        
        return {
          success: true,
          message: '兑换成功!',
          questionSetId,
          quizTitle,
        };
      } else {
        logger.error('兑换码兑换失败:', response.message, response);
        return {
          success: false,
          message: response.message || '兑换失败，请检查兑换码是否有效',
        };
      }
    } catch (error) {
      const errorObj = error as Error;
      logger.error('兑换码处理错误:', errorObj);
      return {
        success: false,
        message: errorObj.message || '兑换过程中发生错误',
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
          message: `成功生成 ${response.data.length} 个兑换码`, 
        };
      } else {
        return { 
          success: false, 
          message: response.message || response.error || '生成兑换码失败', 
        };
      }
    } catch (error) {
      const errorObj = error as Error;
      return { success: false, message: errorObj.message || '生成兑换码过程中发生错误' };
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
      logger.error('questionSetId is required for progress update');
      return;
    }

    const questionSetId = progressUpdate.questionSetId;

    setUser((prev) => {
      if (!prev) return null;
      return {
        ...prev,
        progress: {
          ...prev.progress,
          [questionSetId]: {
            ...prev.progress?.[questionSetId],
            ...progressUpdate,
            lastAccessed: new Date().toISOString(),
          } as UserProgress,
        },
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
    updateUserProgress,
  }), [user, loading, error, userChangeEvent, hasAccessToQuestionSet, getRemainingAccessDays]);

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
