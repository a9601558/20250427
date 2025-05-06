import React, { useState, useEffect, useCallback, useRef } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { UserProgress, QuestionSet } from '../types';
import { useUser } from '../contexts/UserContext';
import { useSocket } from '../contexts/SocketContext';
import { useUserProgress } from '../contexts/UserProgressContext';
import PaymentModal from './PaymentModal';
import ExamCountdownWidget from './ExamCountdownWidget';
import axios from 'axios';
import { Button, message, Skeleton, Tabs, Input, Typography } from 'antd';
import { MenuOutlined, AppstoreOutlined, SearchOutlined, ReloadOutlined, DisconnectOutlined, WifiOutlined } from '@ant-design/icons';

// 题库访问类型
type AccessType = 'trial' | 'paid' | 'expired' | 'redeemed';

// 基础题库类型
interface BaseQuestionSet {
  id: string;
  title: string;
  description?: string;
  category?: string;
  icon?: string;
  isPaid?: boolean;
  price?: number | null;
  trialQuestions?: number | null;
  questionCount?: number;
  isFeatured?: boolean;
  createdAt?: Date;
  updatedAt?: Date;
  hasAccess?: boolean;
  remainingDays?: number | null;
  paymentMethod?: string;
  questions?: any[];
  questionSetQuestions?: any[];
  validityPeriod?: number; // 题库有效期，以天为单位
}

// 扩展题库类型，添加访问类型
interface PreparedQuestionSet extends BaseQuestionSet {
  accessType: AccessType;
  remainingDays: number | null;
  validityPeriod: number;
  featuredCategory?: string;
  recentlyUpdated?: boolean;
  hasAccess: boolean; // Make hasAccess required in PreparedQuestionSet
  trialQuestions?: number | null;
}

// 使用本地接口替代
interface HomeContentData {
  welcomeTitle: string;
  welcomeDescription: string;
  featuredCategories: string[];
  announcements: string;
  footerText: string;
  bannerImage?: string;
  theme?: 'light' | 'dark' | 'auto';
}

// 默认首页内容
const defaultHomeContent: HomeContentData = {
  welcomeTitle: "ExamTopics 模拟练习",
  welcomeDescription: "选择以下任一题库开始练习，测试您的知识水平",
  featuredCategories: ["网络协议", "编程语言", "计算机基础"],
  announcements: "欢迎使用在线题库系统，新增题库将定期更新，请持续关注！",
  footerText: "© 2023 ExamTopics 在线题库系统 保留所有权利",
  bannerImage: "https://via.placeholder.com/1500x500/4F46E5/FFFFFF?text=考试练习系统",
  theme: 'light'
};

// Add this helper function after the defaultHomeContent definition
const calculateQuestionCount = (set: BaseQuestionSet): number => {
  if (typeof set.questionCount === 'number' && set.questionCount > 0) {
    return set.questionCount;
  }
  if (Array.isArray(set.questionSetQuestions) && set.questionSetQuestions.length > 0) {
    return set.questionSetQuestions.length;
  }
  return 0; // 不再使用 trialQuestions 作为后备选项
};

// 删除重复的 QuestionSet 接口，统一使用 BaseQuestionSet

// Add a new interface for purchase data
interface PurchaseData {
  id: string;
  questionSetId: string;
  purchaseDate: string;
  expiryDate: string;
  remainingDays: number;
  hasAccess: boolean;
  questionSet?: any;
}

// 新增购买记录接口用于类型检查
interface DatabasePurchaseRecord {
  id: string;
  userId: string;
  questionSetId: string;
  purchaseDate: string;
  expiryDate: string;
  status?: string;
  amount?: number;
  transactionId?: string;
  paymentMethod?: string;
  remainingDays?: number;
}

// 删除这里的BaseCard和handleStartQuiz定义，移到组件内部

// Add utility functions at the top of the file, after the imports
// 简化版的apiClient
const apiClient = {
  get: async (url: string, params?: any, options?: any) => {
    try {
      const queryParams = new URLSearchParams();
      if (params) {
        Object.entries(params).forEach(([key, value]) => {
          queryParams.append(key, String(value));
        });
      }
      
      const queryString = queryParams.toString();
      const fullUrl = queryString ? `${url}?${queryString}` : url;
      
      const response = await axios.get(fullUrl, { 
        signal: options?.signal,
        headers: {
          'Authorization': `Bearer ${localStorage.getItem('token')}`
        }
      });
      
      return response.data;
    } catch (error: any) {
      // 改进错误处理逻辑，特别是针对取消的请求
      if (error.name === 'CanceledError' || error.name === 'AbortError' || axios.isCancel(error)) {
        console.log(`[apiClient] 请求已被中止: ${url}`);
        // 对于取消的请求，返回特殊标识，而不是错误
        return { success: false, canceled: true, message: '请求已被中止' };
      }
      
      // 分类处理不同类型的错误
      if (error.response) {
        // 服务器返回了错误状态码
        console.error(`[apiClient] 请求错误(${error.response.status}): ${url}`, error.response.data);
        return { 
          success: false, 
          status: error.response.status,
          message: error.response.data?.message || error.message || '服务器错误'
        };
      } else if (error.request) {
        // 请求已发送但没有收到响应
        console.error(`[apiClient] 网络错误: ${url}`, error.request);
        return { 
          success: false, 
          networkError: true,
          message: '网络连接错误，请检查网络连接' 
        };
      } else {
        // 请求设置时出现问题
        console.error(`[apiClient] 请求设置错误: ${url}`, error);
        return { 
          success: false, 
          message: error.message || '请求错误' 
        };
      }
    }
  }
};

// 获取本地缓存
const getLocalAccessCache = () => {
  try {
    const cachedData = localStorage.getItem('question_set_access');
    if (cachedData) {
      return JSON.parse(cachedData) || {};
    }
  } catch (error) {
    console.error('[HomePage] 读取本地缓存失败', error);
  }
  return {};
};

export interface AccessData {
  hasAccess: boolean;
  remainingDays?: number;
  paymentMethod?: string;
  timestamp?: number;
}

export const saveAccessToLocalStorage = (
  questionSetId: string, 
  hasAccess: boolean, 
  userId: string,
  remainingDays?: number, 
  paymentMethod?: string
) => {
  try {
    const key = `access_${questionSetId}`;
    const value = JSON.stringify({
      hasAccess,
      userId,
      remainingDays,
      paymentMethod,
      timestamp: Date.now()
    });
    localStorage.setItem(key, value);
    console.log(`[HomePage] Saved access data to localStorage: ${questionSetId}, hasAccess=${hasAccess}`);
    
    // Trigger a DOM event to notify components of the update
    const event = new CustomEvent('access:update', {
      detail: { userId, questionSetId, hasAccess, remainingDays, paymentMethod }
    });
    window.dispatchEvent(event);
    
    return true;
  } catch (e) {
    console.error('[HomePage] Failed to save access data to localStorage', e);
    return false;
  }
};

// Helper function to ensure socket authentication
const ensureSocketAuthentication = (socket: any, userId: string | undefined) => {
  if (!socket || !userId) return;
  
  try {
    const token = localStorage.getItem('token');
    if (token) {
      // Create a DOM event to reset socket auth
      const socketResetEvent = new CustomEvent('socket:reset', {
        detail: { userId, token }
      });
      window.dispatchEvent(socketResetEvent);
      console.log(`[HomePage] Requested socket authentication for user ${userId}`);
    }
  } catch (e) {
    console.error('[HomePage] Error ensuring socket authentication:', e);
  }
};

const HomePage: React.FC = () => {
  const navigate = useNavigate();
  const { user, isAdmin, syncAccessRights, userChangeEvent } = useUser();
  const { socket, connected, connectionFailed, offlineMode, reconnect } = useSocket();
  const { /* progressStats, fetchUserProgress */ } = useUserProgress();
  
  const [questionSets, setQuestionSets] = useState<PreparedQuestionSet[]>([]);
  const [activeCategory, setActiveCategory] = useState<string>('all');
  const [loading, setLoading] = useState(true);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [homeContent, setHomeContent] = useState<HomeContentData>(defaultHomeContent);
  const [showPaymentModal, setShowPaymentModal] = useState(false);
  const [selectedQuestionSet, setSelectedQuestionSet] = useState<PreparedQuestionSet | null>(null);
  const [recentlyUpdatedSets, setRecentlyUpdatedSets] = useState<{[key: string]: number}>({});
  const [searchTerm, setSearchTerm] = useState<string>('');
  const [recommendedSets, setRecommendedSets] = useState<PreparedQuestionSet[]>([]);
  
  // 添加题库列表初始加载标记，避免重复请求
  const isInitialLoad = useRef<boolean>(true);
  // Add hasRequestedAccess ref to track if access has been requested
  const hasRequestedAccess = useRef<boolean>(false);
  // Add loading timeout ref to avoid getting stuck in loading state
  const loadingTimeoutRef = useRef<any>(null);
  // 保存当前用户ID供比较用
  const currentUserIdRef = useRef<string | null>(null);
  // 添加强制刷新标记
  const forceRefreshAfterUserChange = useRef(false);
  // 中止控制器引用
  const abortControllerRef = useRef<AbortController | null>(null);
  // 上次请求时间引用
  const lastFetchTimeRef = useRef<number>(0);
  // 防抖计时器引用
  const debounceTimerRef = useRef<any>(null);
  // 请求中标记
  const pendingFetchRef = useRef<boolean>(false);
  // 记录上次Socket更新时间
  const lastSocketUpdateTimeRef = useRef<number>(0);
  // 记录socket数据
  const socketDataRef = useRef<{[key: string]: any}>({});
  const [accessData, setAccessData] = useState<Record<string, AccessData>>({});
  const [isCheckingAccess, setIsCheckingAccess] = useState(false);
  const [accessChecked, setAccessChecked] = useState(false);
  
  // Re-add determineAccessStatus as a memoized function inside the component
  const determineAccessStatus = useCallback((
    set: BaseQuestionSet,
    hasAccessValue: boolean,
    remainingDays: number | null,
    paymentMethod?: string
  ) => {
    // 如果是免费题库，始终可访问且类型为trial
    if (!set.isPaid) {
      console.log(`[determineAccessStatus] 题库ID=${set.id} 免费题库，自动授予访问权限`);
      return {
        hasAccess: true,
        accessType: 'trial' as AccessType,
        remainingDays: null
      };
    }
    
    // 优化访问类型判断逻辑
    let accessType: AccessType = 'trial';
    let finalHasAccess = hasAccessValue;
    
    // 根据支付方式优先判断
    if (paymentMethod === 'redeem') {
      accessType = 'redeemed';
    } else if (remainingDays !== null && remainingDays <= 0) {
      accessType = 'expired';
      finalHasAccess = false;
    } else if (hasAccessValue) {
      accessType = 'paid';
    } else {
      accessType = 'trial';
    }
    
    console.log(`[determineAccessStatus] 题库ID=${set.id}, 标题="${set.title}" - 付费=${set.isPaid}, 有权限=${finalHasAccess}, 类型=${accessType}, 支付方式=${paymentMethod || '未知'}, 剩余天数=${remainingDays}`);
    
    return {
      hasAccess: finalHasAccess,
      accessType,
      remainingDays
    };
  }, []);

  // 请求数据库直接检查权限 - 添加更强的验证机制
  const hasAccessInDatabase = useCallback(async (questionSetId: string): Promise<boolean> => {
    if (!user?.id) return false;
    
    try {
      console.log(`[HomePage] 直接向数据库请求题库 ${questionSetId} 的访问权限`);
      
      // 添加时间戳防止缓存，将缓存时间设为0
      const response = await apiClient.get(`/api/purchases/check/${questionSetId}`, {
        userId: user.id,
        _t: Date.now() // 防止缓存
      }, { 
        cacheDuration: 0 // 禁用缓存，确保每次都获取最新数据
      });
      
      const hasAccess = response?.success && response?.data?.hasAccess === true;
      console.log(`[HomePage] 数据库权限检查结果: ${hasAccess ? '有权限' : '无权限'}`);
      
      // 对比Socket数据与数据库结果，检测不一致
      if (socketDataRef.current[questionSetId] && 
          socketDataRef.current[questionSetId].hasAccess !== hasAccess) {
        console.warn(`[HomePage] 权限不一致，执行数据库验证 - 数据库=${hasAccess}, Socket=${socketDataRef.current[questionSetId].hasAccess}`);
      }
      
      return hasAccess;
    } catch (error) {
      console.error('[HomePage] 检查数据库权限失败:', error);
      return false;
    }
  }, [user?.id]);

  // 添加请求AccessStatusForAllQuestionSets函数
  const requestAccessStatusForAllQuestionSets = useCallback(() => {
    if (!user?.id || !socket || questionSets.length === 0) {
      console.log('[HomePage] 无法请求权限: 用户未登录或无题库');
      return;
    }
    
    const now = Date.now();
    console.log(`[HomePage] 请求所有题库的权限状态（${questionSets.length}个题库）`);
    
    // 只请求付费题库的权限
    const paidQuestionSetIds = questionSets
      .filter((set: any) => set.isPaid === true)
      .map((set: any) => String(set.id).trim());
    
    if (paidQuestionSetIds.length > 0) {
      // 发送详细的调试数据
      socket.emit('server:debug', {
        userId: user.id,
        action: 'requestBatchAccess',
        questionSetCount: paidQuestionSetIds.length,
        timestamp: now
      });
      
            socket.emit('questionSet:checkAccessBatch', {
              userId: user.id,
        questionSetIds: paidQuestionSetIds,
        timestamp: now,
        source: 'explicit_homepage_check'
      });
      
      // 更新最后请求时间
      lastSocketUpdateTimeRef.current = now;
      hasRequestedAccess.current = true;
      
      console.log(`[HomePage] 已为${paidQuestionSetIds.length}个付费题库请求权限状态`);
    } else {
      console.log('[HomePage] 没有付费题库需要请求权限');
    }
  }, [user?.id, socket, questionSets]);

  // 将fetchQuestionSets函数声明提前到它被使用之前，避免循环依赖
  const fetchQuestionSets = useCallback(async (options: { forceFresh?: boolean, signal?: AbortSignal } = {}) => {
    const now = Date.now();
    
    // 强制使用最新的用户ID，不依赖闭包中的user
    const currentUser = user; // 获取当前最新的user引用
    const currentUserId = currentUser?.id || null;
    
    // 记录关键信息以方便调试
    console.log(`[HomePage] fetchQuestionSets 使用的用户ID: ${currentUserId}`);
    console.log(`[HomePage] 当前保存的引用用户ID: ${currentUserIdRef.current}`);
    
    // 验证用户ID一致性
    if (currentUserId !== currentUserIdRef.current) {
      console.warn(`[HomePage] 用户ID不匹配警告! 组件状态=${currentUserIdRef.current}, 当前=${currentUserId}`);
      // 更新引用
      currentUserIdRef.current = currentUserId;
    }
    
    // Ensure loading is set to true during fetch
    setLoading(true);
    
    // 在强制刷新模式下重置状态
    if (options.forceFresh || forceRefreshAfterUserChange.current) {
      console.log(`[HomePage] 强制刷新模式，重置缓存状态`);
      forceRefreshAfterUserChange.current = false; // 重置标记
      lastFetchTimeRef.current = 0; // 重置上次请求时间
    }
    
    // Set a safety timeout to prevent infinite loading state
    if (loadingTimeoutRef.current) {
      clearTimeout(loadingTimeoutRef.current);
    }
    
    loadingTimeoutRef.current = setTimeout(() => {
      console.log('[HomePage] Loading timeout triggered - forcing loading state to false');
      setLoading(false);
    }, 10000); // 10 seconds timeout
    
    // 防止频繁请求 - 仅在上次请求超过5秒或强制刷新时执行
    if (!options.forceFresh && now - lastFetchTimeRef.current < 5000) {
      console.log(`[HomePage] 上次请求在 ${(now - lastFetchTimeRef.current)/1000}秒前，跳过请求`);
      setLoading(false); // Make sure to set loading to false when skipping
      clearTimeout(loadingTimeoutRef.current);
      return questionSets;
    }
    
    // 防止并发请求
    if (pendingFetchRef.current) {
      console.log(`[HomePage] 有请求正在进行中，跳过重复请求`);
      // Don't set loading to false here to maintain the loading indicator
      return questionSets;
    }
    
    try {
      pendingFetchRef.current = true;
      console.log(`[HomePage] 开始获取题库列表, 强制刷新: ${options.forceFresh}, 用户ID: ${currentUserId}`);
      
      // 添加请求防缓存参数
      const timestamp = now;
      
      // 使用最新的用户ID构建请求参数
      const params = currentUserId ? { 
        userId: currentUserId, 
        _t: timestamp 
      } : { _t: timestamp };
      
      // 使用apiClient替代未定义的questionSetApi
      const response = await apiClient.get('/api/question-sets', params, {
        // 传递AbortSignal以支持请求取消
        signal: options.signal
      });
      
      // 请求完成后保存最后请求时间
      lastFetchTimeRef.current = now;
      
      // 检查是否已中止
      if (options.signal?.aborted) {
        console.log('[HomePage] 请求已被中止');
        pendingFetchRef.current = false;
        return questionSets;
      }
      
      // 改进的响应处理，支持取消请求
      if (response && response.canceled) {
        console.log('[HomePage] 请求已被取消，保持当前题库列表');
        setLoading(false);
        clearTimeout(loadingTimeoutRef.current);
        pendingFetchRef.current = false;
        return questionSets;
      }
      
      // 处理响应数据
      if (response && response.success && response.data) {
        console.log(`[HomePage] 成功获取${response.data.length}个题库`);
        
        // 处理每个题库的访问权限
        const preparedQuestionSets = response.data.map((set: BaseQuestionSet) => {
          // 计算问题数量
          const questionCount = calculateQuestionCount(set);
          
          // 获取本地缓存的访问权限
          let hasAccess = false;
          let remainingDays = null;
          let paymentMethod = '';
          
          // 检查是否有本地缓存的访问数据
          if (user?.id) {
            const key = `access_${set.id}`;
            try {
              const cachedDataStr = localStorage.getItem(key);
              if (cachedDataStr) {
                const cachedData = JSON.parse(cachedDataStr);
                // 验证数据是否属于当前用户
                if (cachedData.userId === user.id) {
                  hasAccess = cachedData.hasAccess;
                  remainingDays = cachedData.remainingDays;
                  paymentMethod = cachedData.paymentMethod;
                }
              }
            } catch (e) {
              console.error(`[HomePage] 读取题库${set.id}的本地访问数据失败:`, e);
            }
          }
          
          // 确定访问类型
          const { accessType, hasAccess: finalHasAccess } = determineAccessStatus(
            set,
            hasAccess,
            remainingDays,
            paymentMethod
          );
          
          return {
            ...set,
            questionCount,
            hasAccess: finalHasAccess,
            accessType,
            remainingDays,
            paymentMethod,
            validityPeriod: set.validityPeriod || 180 // 默认有效期为180天
          } as PreparedQuestionSet;
        });
        
        // 更新状态
        setQuestionSets(preparedQuestionSets);
        
        // 更新推荐题库
        const recommended = preparedQuestionSets.filter((set: PreparedQuestionSet) => set.isFeatured).slice(0, 3);
        setRecommendedSets(recommended);
        
        setLoading(false);
        clearTimeout(loadingTimeoutRef.current);
        return preparedQuestionSets;
      }
      
      setLoading(false);
      clearTimeout(loadingTimeoutRef.current);
      return questionSets;
    } catch (error) {
      console.error('[HomePage] 获取题库列表失败:', error);
      setErrorMessage('获取题库列表失败，请稍后重试');
      setLoading(false);
      clearTimeout(loadingTimeoutRef.current);
      return questionSets;
    } finally {
      pendingFetchRef.current = false;
    }
  }, [user, questionSets]);

  // 重置网络状态
  const resetNetworkState = useCallback(() => {
    console.log('[HomePage] 重置网络请求状态');
    
    // 取消任何正在进行的请求
    if (abortControllerRef.current) {
      abortControllerRef.current.abort('用户变更');
      abortControllerRef.current = new AbortController();
    }
    
    // 重置网络状态标记
    pendingFetchRef.current = false;
    
    // 重置请求时间
    lastFetchTimeRef.current = 0;
    
    // 清除防抖计时器
    if (debounceTimerRef.current) {
      clearTimeout(debounceTimerRef.current);
      debounceTimerRef.current = null;
    }
    
    // 清除加载超时
    if (loadingTimeoutRef.current) {
      clearTimeout(loadingTimeoutRef.current);
      loadingTimeoutRef.current = null;
    }
  }, []);

  // 监听userChangeEvent以完全重置组件状态
  useEffect(() => {
    if (!userChangeEvent || !userChangeEvent.timestamp) return;
    
    const oldUserId = currentUserIdRef.current;
    const newUserId = user?.id || null;
    
    // 仅当用户ID实际发生变化时执行重置
    if (oldUserId !== newUserId) {
      console.log(`[HomePage] 检测到用户变更: ${oldUserId} → ${newUserId}, 时间戳: ${userChangeEvent.timestamp}`);
      
      // 重置所有状态和缓存引用
      setQuestionSets([]);
      setRecentlyUpdatedSets({});
      socketDataRef.current = {};
      hasRequestedAccess.current = false;
      
      // 标记需要强制刷新
      forceRefreshAfterUserChange.current = true;
      
      // 更新用户ID引用
      currentUserIdRef.current = newUserId;
      
      // 重置网络状态
      resetNetworkState();
      
      // 重置加载状态
      setLoading(true);
      
      // 如果是登出，显式清除本地缓存
      if (!newUserId) {
        try {
          console.log('[HomePage] 用户登出，清理本地题库访问缓存');
          localStorage.removeItem('question_set_access');
          localStorage.removeItem('redeemedQuestionSetIds');
        } catch (e) {
          console.error('清理本地缓存失败', e);
        }
      }
      
      // 如果有新用户，立即获取题库列表
      if (newUserId) {
        const controller = new AbortController();
        abortControllerRef.current = controller;
        console.log('[HomePage] 用户变更后触发题库刷新');
        
        // 确保先同步权限再获取题库
        (async () => {
          try {
            if (syncAccessRights) {
              console.log('[HomePage] 先同步用户权限');
              await syncAccessRights();
            }
            
            console.log('[HomePage] 获取最新题库列表');
            await fetchQuestionSets({ forceFresh: true, signal: controller.signal });
          } catch (error) {
            console.error('[HomePage] 用户变更后刷新数据失败:', error);
            setLoading(false);
          }
        })();
        
        // 10秒超时以避免无限加载
        setTimeout(() => {
          if (controller && !controller.signal.aborted) {
            controller.abort('超时保护');
            setLoading(false);
            console.log('[HomePage] 用户变更数据刷新超时');
          }
        }, 10000);
      }
    }
  }, [userChangeEvent, user, resetNetworkState, syncAccessRights, fetchQuestionSets]);

  // 组件挂载时保存初始用户ID
  useEffect(() => {
    currentUserIdRef.current = user?.id || null;
    console.log(`[HomePage] 组件挂载，初始用户ID: ${currentUserIdRef.current}`);
    
    // 创建初始AbortController
    abortControllerRef.current = new AbortController();
    
    return () => {
      // 组件卸载时取消请求和清理资源
      if (abortControllerRef.current) {
        abortControllerRef.current.abort('组件卸载');
      }
      // 清除所有计时器
      resetNetworkState();
      console.log('[HomePage] 组件卸载，清理资源，最终用户ID:', currentUserIdRef.current);
    };
  }, [resetNetworkState]);

  // 在这里添加BaseCard组件定义（组件内部）
  const BaseCard: React.FC<{
    key: string;
    set: PreparedQuestionSet;
    onStartQuiz: (set: PreparedQuestionSet) => void;
  }> = ({ set, onStartQuiz }) => {
    // 计算剩余天数的显示文本
    const getRemainingDaysText = () => {
      if (set.accessType === 'trial' || !set.isPaid) return null;
      if (set.accessType === 'expired') return '已过期';
      if (set.remainingDays === null) return '永久访问';
      return `剩余 ${set.remainingDays} 天`;
    };
    
    // 确定卡片的背景样式
    const getCardStyle = () => {
      switch (set.accessType) {
        case 'paid':
          return 'from-green-500 to-teal-600'; // 改为绿色渐变
        case 'redeemed':
          return 'from-emerald-500 to-teal-600'; // 绿色渐变
        case 'trial':
          return 'from-amber-400 to-orange-500'; // 橙色渐变
        case 'expired':
          return 'from-gray-400 to-gray-600'; // 灰色渐变
        default:
          return 'from-gray-400 to-gray-600';
      }
    };
    
    // 计算卡片状态标签的样式
    const getStatusStyle = () => {
      switch (set.accessType) {
        case 'paid':
          return 'bg-green-100 text-green-800'; // 改为绿色
        case 'redeemed':
          return 'bg-emerald-100 text-emerald-800';
        case 'trial':
          return 'bg-amber-100 text-amber-800';
        case 'expired':
          return 'bg-gray-100 text-gray-800';
        default:
          return 'bg-gray-100 text-gray-800';
      }
    };
    
    // 计算剩余天数进度条百分比
    const getProgressPercentage = () => {
      if (set.accessType === 'trial' || set.accessType === 'expired' || !set.isPaid || set.remainingDays === null) {
        return 0;
      }
      
      // 假设普通购买的有效期是180天
      const totalDays = set.validityPeriod || 180;
      const remainingPercentage = Math.min(100, Math.max(0, (set.remainingDays / totalDays) * 100));
      return remainingPercentage;
    };
    
    // 判断是否显示有效期
    const shouldShowValidity = set.accessType === 'paid' || set.accessType === 'redeemed';
    
    // 题库信息显示文字（总题目数、章节等）
    const getInfoText = () => {
      const count = (set.questionCount !== undefined ? set.questionCount : 0) || 
                   (set.questionSetQuestions?.length || 0);
      const infoArray = [];
      
      if (count > 0) {
        infoArray.push(`${count}题`);
      }
      
      // Update the trialQuestions check to handle null values
      if (set.isPaid && set.trialQuestions !== undefined && set.trialQuestions !== null && set.trialQuestions > 0) {
        const trialCount = set.trialQuestions; // This avoids the null warning in the template
        infoArray.push(`可试用${trialCount}题`);
      }
      
      if (set.category) {
        infoArray.push(set.category);
      }
      
      return infoArray.join(' · ');
    };

    return (
      <div className="relative group overflow-hidden rounded-xl shadow-md transition-all duration-300 hover:shadow-xl hover:-translate-y-1 bg-white dark:bg-gray-800">
        {/* 卡片装饰元素 - 背景渐变 */}
        <div className={`absolute inset-0 h-2 bg-gradient-to-r ${getCardStyle()} transform transition-all duration-300 group-hover:h-full group-hover:opacity-10`}></div>
        
        {/* 几何装饰元素 */}
        <div className="absolute -top-6 -right-6 w-12 h-12 rounded-full border border-gray-200 dark:border-gray-700 opacity-20"></div>
        <div className="absolute bottom-10 -left-6 w-16 h-16 rounded-full border border-gray-200 dark:border-gray-700 opacity-10"></div>
        
        {/* 卡片内容 */}
        <div className="p-6 relative z-10">
          {/* 标题和类型标签 */}
          <div className="flex justify-between items-start mb-2">
            <h3 className="text-lg font-semibold text-gray-800 dark:text-white line-clamp-1 flex-1">{set.title}</h3>
            <span className={`ml-2 text-xs font-medium px-2 py-1 rounded-full whitespace-nowrap ${getStatusStyle()}`}>
              {set.accessType === 'trial' ? '免费' : 
               set.accessType === 'paid' ? '已购买' :
               set.accessType === 'redeemed' ? '已兑换' :
               set.accessType === 'expired' ? '已过期' : '未知'}
              </span>
        </div>

          {/* 描述文字 */}
          <p className="text-sm text-gray-600 dark:text-gray-300 mb-3 line-clamp-2 h-10">
            {set.description}
          </p>

          {/* 题库信息 */}
          <div className="flex items-center text-xs text-gray-500 dark:text-gray-400 mb-4">
            <svg className="w-3.5 h-3.5 mr-1" fill="none" stroke="currentColor" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2"></path>
                </svg>
            {getInfoText()}
              </div>
              
          {/* 剩余有效期进度条（仅对已购买/已兑换的题库显示） */}
          {shouldShowValidity && (
            <div className="mb-3">
              <div className="flex justify-between items-center text-xs mb-1">
                <span className="font-medium text-gray-700 dark:text-gray-300">有效期</span>
                <span className={`font-medium ${
                  set.remainingDays !== null && set.remainingDays < 7 
                    ? 'text-red-600 dark:text-red-400' 
                    : 'text-gray-600 dark:text-gray-400'
                }`}>
                  {getRemainingDaysText()}
                </span>
              </div>
              <div className="h-1.5 w-full bg-gray-200 dark:bg-gray-700 rounded-full overflow-hidden">
                <div 
                  className={`h-full rounded-full transition-all duration-300 ${
                    set.remainingDays !== null && set.remainingDays < 7 
                      ? 'bg-red-500' 
                      : set.accessType === 'redeemed' 
                        ? 'bg-emerald-500' 
                        : 'bg-blue-500'
                  }`}
                  style={{ width: `${getProgressPercentage()}%` }}
                ></div>
                </div>
              </div>
            )}

          {/* 开始按钮 */}
            <button
            onClick={() => onStartQuiz(set)}
            className={`w-full mt-2 px-4 py-2 rounded-lg text-sm font-medium transition-all duration-300 ${
              !set.hasAccess
                ? set.isPaid 
                  ? 'bg-green-100 text-green-800 hover:bg-green-200 dark:bg-green-800/20 dark:text-green-400 dark:hover:bg-green-800/30'
                  : 'bg-gray-100 text-gray-800 hover:bg-gray-200 dark:bg-gray-700 dark:text-gray-300 dark:hover:bg-gray-600'
                : set.accessType === 'redeemed'
                  ? 'bg-emerald-100 text-emerald-800 hover:bg-emerald-200 dark:bg-emerald-800/20 dark:text-emerald-400 dark:hover:bg-emerald-800/30'
                  : set.accessType === 'paid'
                    ? 'bg-green-100 text-green-800 hover:bg-green-200 dark:bg-green-800/20 dark:text-green-400 dark:hover:bg-green-800/30'
                    : 'bg-amber-100 text-amber-800 hover:bg-amber-200 dark:bg-amber-800/20 dark:text-amber-400 dark:hover:bg-amber-800/30'
            }`}
          >
            {set.hasAccess ? (
              <span className="flex items-center justify-center">
                <svg className="w-4 h-4 mr-1" fill="none" stroke="currentColor" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M14.752 11.168l-3.197-2.132A1 1 0 0010 9.87v4.263a1 1 0 001.555.832l3.197-2.132a1 1 0 000-1.664z"></path>
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M21 12a9 9 0 11-18 0 9 9 0 0118 0z"></path>
                  </svg>
                立即开始
              </span>
            ) : (
              <span className="flex items-center justify-center">
                <svg className="w-4 h-4 mr-1" fill="none" stroke="currentColor" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M14.752 11.168l-3.197-2.132A1 1 0 0010 9.87v4.263a1 1 0 001.555.832l3.197-2.132a1 1 0 000-1.664z"></path>
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M21 12a9 9 0 11-18 0 9 9 0 0118 0z"></path>
                  </svg>
                立即试用
              </span>
              )}
            </button>
        </div>
      </div>
    );
  };

  // 添加handleStartQuiz函数（组件内部）
  const handleStartQuiz = useCallback((set: PreparedQuestionSet) => {
    console.log(`[HomePage] 开始答题:`, set);
    
    // 防御性检查：确保题库数据有效
    if (!set || !set.id || !set.title) {
      console.error('[handleStartQuiz] 无效题库数据:', set);
      setErrorMessage('无法访问题库：数据无效');
      return;
    }
    
    // 修改为始终允许进入试用模式，不再弹出购买提示
    // 直接使用navigate进行路由跳转
    navigate(`/quiz/${set.id}`);
  }, [navigate, setErrorMessage]);

  // 将 getCategorizedQuestionSets 函数移到组件内部，这样它可以访问 questionSets 状态
  const getCategorizedQuestionSets = useCallback(() => {
    // 根据状态过滤题库
    const purchased = questionSets.filter((set: PreparedQuestionSet) => 
      (set.accessType === 'paid' || set.accessType === 'redeemed') && set.hasAccess
    );
    
    const free = questionSets.filter((set: PreparedQuestionSet) => 
      set.accessType === 'trial' && !set.isPaid
    );
    
    const paid = questionSets.filter((set: PreparedQuestionSet) => 
      set.isPaid && !set.hasAccess && set.accessType !== 'expired'
    );
    
    const expired = questionSets.filter((set: PreparedQuestionSet) => 
      set.accessType === 'expired'
    );
    
    return { purchased, free, paid, expired };
  }, [questionSets]);

  const bgClass = "min-h-screen bg-gray-50 dark:bg-gray-900 py-8";
  
  // 辅助函数：读取本地缓存的访问状态
  const getAccessFromLocalCache = (questionSetId: string, userId?: string) => {
    if (!questionSetId) return null;
    
    try {
      const cache = getLocalAccessCache();
      
      if (userId && cache[userId] && cache[userId][questionSetId]) {
        return cache[userId][questionSetId];
      }
    } catch (error) {
      console.error('[HomePage] 读取本地缓存失败:', error);
    }
    
    return null;
  };
  
  // 获取推荐题库的函数
  const getRecommendedSets = useCallback(() => {
    return questionSets.filter((set: PreparedQuestionSet) => set.isFeatured).slice(0, 3);
  }, [questionSets]);

  // 切换分类
  const handleCategoryChange = (category: string) => {
    setActiveCategory(category);
  };

  // 获取过滤后的题库列表，按分类组织
  const getFilteredQuestionSets = useCallback(() => {
    // First filter by search term
    let filteredSets = searchTerm.trim() ? 
      questionSets.filter((set: any) => 
        set.title.toLowerCase().includes(searchTerm.toLowerCase()) || 
        set.category?.toLowerCase().includes(searchTerm.toLowerCase())
      ) : 
      questionSets;
    
    // Then filter by category
    if (activeCategory !== 'all') {
      // Filter by selected category
      filteredSets = filteredSets.filter((set: any) => set.category === activeCategory);
    } else if (homeContent.featuredCategories && homeContent.featuredCategories.length > 0) {
      // In all mode with featured categories, only show featured categories or sets
      filteredSets = filteredSets.filter((set: any) => 
        // Is in featured category
        homeContent.featuredCategories.includes(set.category) || 
        // Or is marked as featured
        set.isFeatured === true || 
        // Or featured category matches
        (set.featuredCategory && homeContent.featuredCategories.includes(set.featuredCategory))
      );
    }
    
    return filteredSets;
  }, [questionSets, activeCategory, homeContent.featuredCategories, searchTerm]);

  // 修改业务逻辑，使用lastSocketUpdateTimeRef
  useEffect(() => {
    if (!isInitialLoad.current) {
      // Only log if we're not already requesting access
      if (!hasRequestedAccess.current) {
        console.log('[HomePage] 题库列表更新，可能需要请求最新权限状态');
        
        // Only make an access request if all conditions are met and we haven't recently made a request
        const now = Date.now();
        if (user?.id && socket && questionSets.length > 0 && 
            !hasRequestedAccess.current && 
            now - lastSocketUpdateTimeRef.current > 15000) { // Use the correct Ref version
          requestAccessStatusForAllQuestionSets();
        } else {
          console.log('[HomePage] 跳过权限请求: 最近已请求过或条件不满足');
        }
      } else {
        console.log('[HomePage] 题库列表更新，但已有请求正在进行，跳过');
      }
    } else {
      console.log('[HomePage] 初次加载，跳过权限检查');
      isInitialLoad.current = false;
    }
  }, [questionSets.length, user?.id, socket, requestAccessStatusForAllQuestionSets]);

  // 添加清理超时的效果
  useEffect(() => {
    return () => {
      if (loadingTimeoutRef.current) {
        clearTimeout(loadingTimeoutRef.current);
      }
      if (debounceTimerRef.current) {
        clearTimeout(debounceTimerRef.current);
      }
    };
  }, []);

  // Define handlers for socket events
  const handleAccessUpdate = useCallback((data: any) => {
    if (!data) return;
    
    console.log('[HomePage] 收到访问权限更新:', data);
    
    const { userId, questionSetId, hasAccess, remainingDays, paymentMethod } = data;
    
    // 验证数据有效性
    if (!questionSetId || hasAccess === undefined || !userId) {
      console.warn('[HomePage] 访问权限更新数据不完整');
      return;
    }
    
    // 确认用户ID匹配
    if (user?.id !== userId) {
      console.warn(`[HomePage] 访问权限更新的用户ID不匹配: 当前=${user?.id}, 收到=${userId}`);
      return;
    }
    
    console.log(`[HomePage] 更新题库访问权限: 题库=${questionSetId}, 权限=${hasAccess}, 剩余天数=${remainingDays}, 支付方式=${paymentMethod || '未指定'}`);
    
    // 保存到本地存储
    saveAccessToLocalStorage(questionSetId, hasAccess, remainingDays, paymentMethod, userId);
    
    // 更新状态
    setQuestionSets(prevSets => 
      prevSets.map(set => {
        if (set.id === questionSetId) {
          const { accessType, hasAccess: finalHasAccess } = determineAccessStatus(
            set, 
            hasAccess, 
            remainingDays, 
            paymentMethod
          );
          
          return {
            ...set,
            hasAccess: finalHasAccess,
            accessType,
            remainingDays: remainingDays || null,
            paymentMethod,
            recentlyUpdated: true
          };
        }
        return set;
      })
    );
    
    // 标记最近更新的题库
    setRecentlyUpdatedSets(prev => ({
      ...prev,
      [questionSetId]: Date.now()
    }));
  }, [user?.id, saveAccessToLocalStorage]);
  
  const handleSyncDevice = useCallback((data: any) => {
    console.log('[HomePage] 收到设备同步请求');
    
    if (!user?.id || !socket) {
      console.warn('[HomePage] 无法同步设备: 用户未登录或socket未连接');
      return;
    }
    
    // 刷新访问权限
    if (typeof syncAccessRights === 'function') {
      console.log('[HomePage] 同步用户访问权限');
      syncAccessRights();
    }
    
    // 刷新题库列表
    console.log('[HomePage] 重新获取题库列表');
    fetchQuestionSets({ forceFresh: true });
  }, [user?.id, socket, syncAccessRights, fetchQuestionSets]);
  
  const handleBatchAccessResult = useCallback((data: any) => {
    if (!data || !Array.isArray(data.results)) {
      console.warn('[HomePage] Received invalid batch access result:', data);
      setIsCheckingAccess(false);
      setAccessChecked(true);
      return;
    }
    
    console.log(`[HomePage] Received batch access results: ${data.results.length} items`);
    
    // Update checking state
    setIsCheckingAccess(false);
    setAccessChecked(true);
    
    // Update last sync time
    lastSocketUpdateTimeRef.current = Date.now();
    hasRequestedAccess.current = false;
    
    // Defensive check: ensure user ID matches
    if (data.userId && user?.id && data.userId !== user.id) {
      console.warn(`[HomePage] Batch access results user ID mismatch: current=${user.id}, received=${data.userId}`);
      return;
    }
    
    // Process each question set access result
    const updates = data.results
      .filter((result: any) => result && result.questionSetId)
      .map((result: any) => {
        const { questionSetId, hasAccess, remainingDays, paymentMethod, timestamp } = result;
        
        // Save to localStorage for offline access
        if (user?.id) {
          saveAccessToLocalStorage(
            questionSetId,
            hasAccess,
            user.id,
            remainingDays || null,
            paymentMethod
          );
        }
        
        // Check if this data is newer than what we already have
        if (socketDataRef.current[questionSetId] && 
            socketDataRef.current[questionSetId].timestamp > (timestamp || 0)) {
          console.log(`[HomePage] Ignoring older access data: questionSetId=${questionSetId}`);
          return null;
        }
        
        // Save to socketDataRef for future reference
        socketDataRef.current[questionSetId] = {
          ...result,
          timestamp: timestamp || Date.now()
        };
        
        return {
          questionSetId,
          hasAccess,
          remainingDays,
          paymentMethod
        };
      })
      .filter(Boolean);
    
    if (updates.length > 0) {
      console.log(`[HomePage] Updating ${updates.length} question sets with access data`);
      
      // Update question sets in a batch
      setQuestionSets(prevSets => 
        prevSets.map(set => {
          const update = updates.find((u: any) => u.questionSetId === set.id);
          
          if (update) {
            const { accessType, hasAccess: finalHasAccess } = determineAccessStatus(
              set,
              update.hasAccess,
              update.remainingDays,
              update.paymentMethod
            );
            
            return {
              ...set,
              hasAccess: finalHasAccess,
              accessType,
              remainingDays: update.remainingDays || null,
              paymentMethod: update.paymentMethod,
              recentlyUpdated: true
            };
          }
          
          return set;
        })
      );
      
      // Mark recently updated sets
      const updatedTimestamp = Date.now();
      const newRecentlyUpdated = updates.reduce((acc: Record<string, number>, update: any) => {
        if (update && update.questionSetId) {
          acc[update.questionSetId] = updatedTimestamp;
        }
        return acc;
      }, {});
      
      setRecentlyUpdatedSets(prev => ({
        ...prev,
        ...newRecentlyUpdated
      }));
    } else {
      console.log('[HomePage] No updates needed from batch access results');
    }
  }, [user?.id, determineAccessStatus]);

  // Update the socket event listener useEffect to include authentication check
  useEffect(() => {
    if (!socket) return;
    
    console.log('[HomePage] Registering socket event listeners');
    
    // First ensure socket is authenticated if user exists
    if (user?.id) {
      ensureSocketAuthentication(socket, user.id);
    }
    
    // Register event listeners
    socket.on('questionSet:accessUpdate', handleAccessUpdate);
    socket.on('sync:device', handleSyncDevice);
    socket.on('batch:accessResult', handleBatchAccessResult);
    
    // If socket connection has failed, use localStorage as fallback
    if (connectionFailed || offlineMode) {
      console.warn('[HomePage] Socket connection failed or offline mode, using localStorage fallback only');
      // Load access data from localStorage instead of waiting for socket events
      const loadAccessFromLocalStorage = () => {
        if (!user?.id) return;
        
        try {
          console.log('[HomePage] Loading access data from localStorage');
          // Get all keys in localStorage that start with "access_"
          const accessKeys = Object.keys(localStorage).filter(key => key.startsWith('access_'));
          
          if (accessKeys.length > 0) {
            console.log(`[HomePage] Found ${accessKeys.length} access keys in localStorage`);
          } else {
            console.log('[HomePage] No access keys found in localStorage');
          }
          
          // Process each access entry
          for (const key of accessKeys) {
            try {
              const accessData = JSON.parse(localStorage.getItem(key) || '{}');
              
              // Check if this access entry belongs to current user
              if (accessData.userId === user.id) {
                const { questionSetId, hasAccess, remainingDays } = accessData;
                
                if (questionSetId && hasAccess !== undefined) {
                  console.log(`[HomePage] Found access in localStorage: questionSetId=${questionSetId}, hasAccess=${hasAccess}`);
                  
                  // Update question set access in state
                  setQuestionSets(prevSets => 
                    prevSets.map(set => 
                      set.id === questionSetId 
                        ? { 
                            ...set, 
                            hasAccess, 
                            remainingDays: remainingDays || null,
                            recentlyUpdated: true 
                          } 
                        : set
                    )
                  );
                }
              }
            } catch (err) {
              console.error('[HomePage] Error processing localStorage access entry', key, err);
            }
          }
          
          // Mark as checked to prevent infinite loading
          setAccessChecked(true);
        } catch (err) {
          console.error('[HomePage] Error loading access data from localStorage', err);
          setAccessChecked(true); // Ensure we exit loading state
        }
      };
      
      // Load data from localStorage after a short delay
      setTimeout(loadAccessFromLocalStorage, 500);
    }
    
    return () => {
      if (!socket) return;
      
      console.log('[HomePage] Removing socket event listeners');
      socket.off('questionSet:accessUpdate', handleAccessUpdate);
      socket.off('sync:device', handleSyncDevice);
      socket.off('batch:accessResult', handleBatchAccessResult);
    };
  }, [socket, user?.id, connectionFailed, offlineMode, handleAccessUpdate, handleSyncDevice, handleBatchAccessResult]);

  // Handle socket reconnection
  const handleReconnect = () => {
    reconnect();
    message.info('Attempting to reconnect...');
    setAccessChecked(false);
  };
  
  // Handle toggle offline mode
  const handleToggleOfflineMode = () => {
    const event = new CustomEvent('app:toggleOfflineMode');
    window.dispatchEvent(event);
    setAccessChecked(false);
  };
  
  // Render connection status indicator
  const renderConnectionStatus = () => {
    if (connectionFailed || offlineMode) {
    return (
        <div className="mb-4 rounded bg-amber-50 p-3 shadow-sm">
          <div className="flex items-center">
            <DisconnectOutlined className="mr-2 text-amber-500" />
            <span className="text-amber-700">
              Working in offline mode. Some features may be limited.
            </span>
            <Button 
              type="text"
              size="small"
              icon={<ReloadOutlined />}
              onClick={handleReconnect}
              className="ml-auto text-amber-700">
              Reconnect
            </Button>
          </div>
      </div>
    );
  }

    if (connected && !offlineMode) {
  return (
        <div className="mb-4 flex justify-end">
          <Button 
                  type="text"
            size="small"
            icon={<WifiOutlined />}
            onClick={handleToggleOfflineMode}
            className="text-gray-600">
            Switch to Offline Mode
          </Button>
        </div>
      );
    }
    
    return null;
  };

  // Update the access checking useEffect to handle authentication and data loading properly
  useEffect(() => {
    // Only check access if we have user, questionSets and socket
    if (!user || questionSets.length === 0 || !socket || isCheckingAccess || accessChecked) {
      return;
    }
    
    // Ensure socket is authenticated
    ensureSocketAuthentication(socket, user.id);
    
    // If connection failed or offline mode, rely on localStorage data only
    if (connectionFailed || offlineMode) {
      console.log('[HomePage] Connection failed or offline mode, skipping server access check');
      setAccessChecked(true);
      return;
    }
    
    // Only check access if socket is connected
    if (!connected) {
      console.log('[HomePage] Socket not connected, waiting for connection');
      return;
    }
    
    setIsCheckingAccess(true);
    console.log('[HomePage] Checking access for all question sets');
    
    // Use batch access check
    const questionSetIds = questionSets.map((set) => set.id);
    
    // Log the request being sent
    console.log(`[HomePage] Sending questionSet:checkAccessBatch for ${questionSetIds.length} question sets`);
    
    socket.emit('questionSet:checkAccessBatch', {
      userId: user.id,
      questionSetIds,
      timestamp: Date.now(),
      source: 'homepage_access_check'
    });
    
    // Set a timeout in case server doesn't respond
    const timeoutId = setTimeout(() => {
      console.warn('[HomePage] Access check timeout - no response from server');
      setIsCheckingAccess(false);
      setAccessChecked(true);
      message.warning('Server response timeout - using cached data. Some features may be limited.');
    }, 10000); // Increased timeout to 10 seconds for slower connections
    
    return () => {
      clearTimeout(timeoutId);
    };
  }, [user, questionSets, socket, connected, connectionFailed, offlineMode, isCheckingAccess, accessChecked]);
  
  // Socket event handlers for access check results
  useEffect(() => {
    if (!socket || !user) return;
    
    const handleAccessResult = (data: any) => {
      // Handle individual access result
      if (data && data.userId === user.id && data.questionSetId) {
        console.log(`[HomePage] Received access result for ${data.questionSetId}: ${data.hasAccess}`);
        setIsCheckingAccess(false);
        setAccessChecked(true);
      }
    };
    
    const handleBatchAccessResult = (data: any) => {
      // Handle batch access result
      if (data && data.userId === user.id && Array.isArray(data.results)) {
        console.log('[HomePage] Received batch access results', data.results);
        setIsCheckingAccess(false);
        setAccessChecked(true);
      }
    };
    
    socket.on('questionSet:accessResult', handleAccessResult);
    socket.on('batch:accessResult', handleBatchAccessResult);
    
    return () => {
      socket.off('questionSet:accessResult', handleAccessResult);
      socket.off('batch:accessResult', handleBatchAccessResult);
    };
  }, [socket, user]);
  
  // Modify the isPageLoading calculation to handle the loading state better
  const isPageLoading = loading || (isCheckingAccess && !accessChecked && !connectionFailed && !offlineMode);
  
  // Update the render method to properly handle loading and display question sets
  if (isPageLoading) {
    return (
      <div className="flex h-screen w-full items-center justify-center">
        <Skeleton active paragraph={{ rows: 10 }} />
      </div>
    );
  }

  // Return a simplified component structure for debugging
  return (
    <div className={bgClass}>
      <div className="container mx-auto px-4">
        {/* Connection status indicator */}
        {renderConnectionStatus()}
        
        {/* Title and search */}
        <div className="mb-8">
          <h1 className="text-2xl font-bold mb-2">题库列表</h1>
          <p className="text-gray-600">共 {questionSets.length} 个题库</p>
        </div>
        
        {/* Question set grid */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {getFilteredQuestionSets().map((set: PreparedQuestionSet) => (
            <div key={set.id} className="bg-white shadow-md rounded-lg p-4">
              <h2 className="text-lg font-semibold">{set.title}</h2>
              <p className="text-sm text-gray-600 mt-1">{set.description}</p>
              <div className="mt-4">
                <button 
                  onClick={() => handleStartQuiz(set)}
                  className="px-4 py-2 bg-blue-500 text-white rounded-md"
                >
                  {set.hasAccess ? "开始答题" : "查看详情"}
                </button>
              </div>
            </div>
          ))}
        </div>
        
        {/* No results message */}
        {getFilteredQuestionSets().length === 0 && (
          <div className="text-center py-10">
            <p className="text-lg text-gray-500">没有找到匹配的题库</p>
          </div>
        )}
      </div>
    </div>
  );
};

export default HomePage;