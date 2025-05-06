import React, { useState, useEffect, useCallback, useRef } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { UserProgress, QuestionSet } from '../types';
import { useUser } from '../contexts/UserContext';
import { useSocket } from '../contexts/SocketContext';
import { useUserProgress } from '../contexts/UserProgressContext';
import PaymentModal from './PaymentModal';
import ExamCountdownWidget from './ExamCountdownWidget';
import axios from 'axios';

// 题库访问类型
type AccessType = 'trial' | 'paid' | 'expired' | 'redeemed';

// 基础题库类型
interface BaseQuestionSet {
  id: string;
  title: string;
  description: string;
  category: string;
  icon: string;
  isPaid: boolean;
  price: number | null;
  trialQuestions: number | null;
  questionCount?: number;
  isFeatured: boolean;
  createdAt: Date;
  updatedAt: Date;
  hasAccess?: boolean;
  remainingDays?: number | null;
  paymentMethod?: string;
  questions?: { id: string }[];
  questionSetQuestions?: { id: string }[];
  validityPeriod?: number; // 题库有效期，以天为单位
}

// 扩展题库类型，添加访问类型
interface PreparedQuestionSet extends BaseQuestionSet {
  accessType: AccessType;
  remainingDays: number | null;
  validityPeriod: number;
  featuredCategory?: string; // 添加精选分类字段
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

// 保存访问数据到本地存储
const saveAccessToLocalStorage = (questionSetId: string, hasAccess: boolean, remainingDays: number | null, paymentMethod?: string, userId?: string) => {
  try {
    // 强制要求传入userId参数，不再使用localStorage作为后备
    if (!userId) {
      console.warn('[HomePage] saveAccessToLocalStorage被调用但没有提供userId，请检查调用位置');
      return; // 没有userId时不保存，避免数据混乱
    }
    
    // 记录当前保存的用户以便调试
    console.log(`[HomePage] 保存本地访问权限：题库=${questionSetId}, 用户=${userId}, 权限=${hasAccess}`);
    
    const cache = getLocalAccessCache();
    
    // 确保用户ID索引存在
    if (!cache[userId]) {
      cache[userId] = {};
    }
    
    // 更新题库的访问信息
    cache[userId][questionSetId] = {
      hasAccess,
      remainingDays,
      paymentMethod,
      timestamp: Date.now()
    };
    
    // 保存回本地存储
    localStorage.setItem('question_set_access', JSON.stringify(cache));
  } catch (error) {
    console.error('[HomePage] 保存本地缓存失败', error);
  }
};

const HomePage: React.FC = () => {
  const { user, isAdmin, syncAccessRights, userChangeEvent } = useUser();
  const { socket } = useSocket();
  // Remove unused destructured variables
  const { /* progressStats, fetchUserProgress */ } = useUserProgress();
  const [questionSets, setQuestionSets] = useState<PreparedQuestionSet[]>([]);
  const [activeCategory, setActiveCategory] = useState<string>('all');
  const [loading, setLoading] = useState(true);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [homeContent, setHomeContent] = useState<HomeContentData>(defaultHomeContent);
  const [showPaymentModal, setShowPaymentModal] = useState(false);
  const [selectedQuestionSet, setSelectedQuestionSet] = useState<PreparedQuestionSet | null>(null);
  const navigate = useNavigate();
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
      .filter(set => set.isPaid === true)
      .map(set => String(set.id).trim());
    
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
      
      // 处理响应数据（这里简化了代码）
      if (response && response.success && response.data) {
        console.log(`[HomePage] 成功获取${response.data.length}个题库`);
        
        // 处理数据并更新状态
        // ...
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
      const count = set.questionCount || (set.questionSetQuestions?.length || 0);
      const infoArray = [];
      
      if (count > 0) {
        infoArray.push(`${count}题`);
      }
      
      // 添加显示可试用题目数
      if (set.isPaid && set.trialQuestions && set.trialQuestions > 0) {
        infoArray.push(`可试用${set.trialQuestions}题`);
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
    return questionSets.filter(set => set.isFeatured).slice(0, 3);
  }, [questionSets]);

  // 优化 determineAccessStatus 函数逻辑，添加更细致的状态判断和日志
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

  // 切换分类
  const handleCategoryChange = (category: string) => {
    setActiveCategory(category);
  };

  // 获取过滤后的题库列表，按分类组织
  const getFilteredQuestionSets = useCallback(() => {
    // 先根据搜索词过滤
    let filteredSets = searchTerm.trim() ? 
      questionSets.filter(set => 
        set.title.toLowerCase().includes(searchTerm.toLowerCase()) || 
        set.category.toLowerCase().includes(searchTerm.toLowerCase())
      ) : 
      questionSets;
    
    // 再根据分类过滤
    if (activeCategory !== 'all') {
      // 直接按选中的分类筛选
      filteredSets = filteredSets.filter(set => set.category === activeCategory);
    } else if (homeContent.featuredCategories && homeContent.featuredCategories.length > 0) {
      // 在全部模式，且有精选分类时，只显示精选分类或标记为精选的题库
      filteredSets = filteredSets.filter(set => 
        // 属于精选分类
        homeContent.featuredCategories.includes(set.category) || 
        // 或者本身被标记为精选
        set.isFeatured === true || 
        // 或者精选分类与题库精选分类匹配
        (set.featuredCategory && homeContent.featuredCategories.includes(set.featuredCategory))
      );
      
      console.log(`[HomePage] 精选分类过滤: 共${filteredSets.length}个符合条件的题库`);
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

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="text-xl">正在加载...</div>
      </div>
    );
  }

  return (
    <div className={bgClass}>
      {/* 错误信息展示 */}
      {errorMessage && (
        <div className="bg-red-100 border border-red-400 text-red-700 px-4 py-3 rounded relative mb-4 mx-4 sm:mx-auto sm:max-w-4xl" role="alert">
          <strong className="font-bold mr-1">错误:</strong>
          <span className="block sm:inline">{errorMessage}</span>
          <button 
            className="absolute top-0 bottom-0 right-0 px-4 py-3"
            onClick={() => setErrorMessage(null)}
          >
            <svg className="h-6 w-6 text-red-500" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>
      )}

      {/* 现代化顶部英雄区域 - 替代原来的横幅 */}
      <div className="relative bg-gradient-to-br from-blue-600 to-indigo-800 pb-10 mb-10 overflow-hidden">
        {/* 装饰性圆形 */}
        <div className="absolute -top-24 -right-24 w-96 h-96 bg-purple-500 rounded-full opacity-10"></div>
        <div className="absolute top-1/2 left-10 w-32 h-32 bg-blue-400 rounded-full opacity-20"></div>
        <div className="absolute bottom-0 right-1/4 w-64 h-64 bg-indigo-400 rounded-full opacity-10"></div>
        
        <div className="container mx-auto px-4 pt-16 pb-20 relative z-10">
          <div className="max-w-5xl mx-auto text-center">
            <h1 className="text-4xl md:text-5xl lg:text-6xl font-bold text-white mb-6 leading-tight">
              {homeContent.welcomeTitle || defaultHomeContent.welcomeTitle}
            </h1>
            <p className="text-xl text-blue-100 mb-10 max-w-3xl mx-auto">
              {homeContent.welcomeDescription || defaultHomeContent.welcomeDescription}
            </p>
            
            {/* 搜索栏 - 移至英雄区域中央 */}
            <div className="relative w-full max-w-2xl mx-auto">
              <div className="relative flex bg-white rounded-full shadow-lg overflow-hidden p-1">
                <input
                  type="text"
                  placeholder="搜索题库名称或分类..."
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                  className="w-full px-6 py-3 rounded-full border-none focus:outline-none focus:ring-0 text-gray-700"
                  onKeyDown={(e) => {
                    if (e.key === 'Enter') {
                      // 触发搜索逻辑
                      const filtered = questionSets.filter(set => 
                        set.title.toLowerCase().includes(searchTerm.toLowerCase()) || 
                        set.category.toLowerCase().includes(searchTerm.toLowerCase())
                      );
                      console.log(`[HomePage] 搜索: "${searchTerm}", 找到 ${filtered.length} 个结果`);
                    }
                  }}
                />
                <div className="absolute inset-y-0 left-0 pl-4 flex items-center pointer-events-none">
                  <svg className="h-5 w-5 text-gray-400" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20" fill="currentColor">
                    <path fillRule="evenodd" d="M8 4a4 4 0 100 8 4 4 0 000-8zM2 8a6 6 0 1110.89 3.476l4.817 4.817a1 1 0 01-1.414 1.414l-4.816-4.816A6 6 0 012 8z" clipRule="evenodd" />
                  </svg>
                </div>
                
                {searchTerm && (
                  <button
                    onClick={() => setSearchTerm('')}
                    className="absolute inset-y-0 right-16 pr-3 flex items-center text-gray-400 hover:text-gray-600"
                  >
                    <svg className="h-5 w-5" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20" fill="currentColor">
                      <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zM8.707 7.293a1 1 0 00-1.414 1.414L8.586 10l-1.293 1.293a1 1 0 101.414 1.414L10 11.414l1.293 1.293a1 1 0 001.414-1.414L11.414 10l1.293-1.293a1 1 0 00-1.414-1.414L10 8.586 8.707 7.293z" clipRule="evenodd" />
                    </svg>
                  </button>
                )}
                
                <button
                  onClick={() => {
                    // 搜索按钮逻辑
                    if (searchTerm.trim()) {
                      console.log(`[HomePage] 搜索: "${searchTerm}"`);
                      // 已经在getFilteredQuestionSets函数中处理搜索逻辑
                      // 这里可以滚动到结果区域
                      document.getElementById('question-sets-section')?.scrollIntoView({ 
                        behavior: 'smooth',
                        block: 'start'
                      });
                    } else {
                      handleStartQuiz(questionSets[0] || recommendedSets[0]);
                    }
                  }}
                  className="px-6 py-3 bg-blue-600 hover:bg-blue-700 text-white font-medium rounded-full transition-colors duration-300 flex items-center"
                >
                  {searchTerm.trim() ? (
                    <>
                      <svg className="h-5 w-5 mr-1" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
                      </svg>
                      搜索
                    </>
                  ) : (
                    <>
                      <svg className="h-5 w-5 mr-1" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M14.752 11.168l-3.197-2.132A1 1 0 0010 9.87v4.263a1 1 0 001.555.832l3.197-2.132a1 1 0 000-1.664z" />
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                      </svg>
                      开始学习
                    </>
                  )}
                </button>
              </div>
            </div>
          </div>
        </div>
        
        {/* 波浪形分隔线 */}
        <div className="absolute bottom-0 left-0 right-0">
          <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 1440 320" className="w-full">
            <path fill="#fff" fillOpacity="1" d="M0,288L48,272C96,256,192,224,288,213.3C384,203,480,213,576,229.3C672,245,768,267,864,261.3C960,256,1056,224,1152,208C1248,192,1344,192,1392,192L1440,192L1440,320L1392,320C1344,320,1248,320,1152,320C1056,320,960,320,864,320C768,320,672,320,576,320C480,320,384,320,288,320C192,320,96,320,48,320L0,320Z"></path>
          </svg>
        </div>
      </div>
      
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 -mt-6 relative z-20">
        {/* 公告信息 - 改为更现代的卡片式设计 */}
        {homeContent.announcements && (
          <div className="relative bg-white rounded-2xl p-6 shadow-xl mb-10 border-l-4 border-blue-500 transform hover:scale-[1.01] transition-all duration-300">
            <div className="absolute -left-3 top-1/2 transform -translate-y-1/2 w-6 h-6 bg-blue-500 rounded-full flex items-center justify-center shadow-md">
              <svg className="h-3 w-3 text-white" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11 5.882V19.24a1.76 1.76 0 01-3.417.592l-2.147-6.15M18 13a3 3 0 100-6M5.436 13.683A4.001 4.001 0 017 6h1.832c4.1 0 7.625-1.234 9.168-3v14c-1.543-1.766-5.067-3-9.168-3H7a3.988 3.988 0 01-1.564-.317z" />
              </svg>
            </div>
            <p className="text-gray-700">
              <span className="font-bold text-blue-600 mr-2">📢 公告:</span>
              {homeContent.announcements}
            </p>
          </div>
        )}

        {/* 考试倒计时组件 */}
        <div className="mt-6 mx-auto max-w-2xl">
          <div className="flex items-center justify-between mb-4">
            <h2 className={`text-xl font-semibold ${homeContent.theme === 'dark' ? 'text-white' : 'text-gray-900'}`}>考试倒计时</h2>
            <span className="text-sm text-gray-500">与个人中心同步</span>
          </div>
          <ExamCountdownWidget theme={homeContent.theme === 'auto' || homeContent.theme === undefined ? 'light' : homeContent.theme} />
        </div>

        {/* 推荐题库栏 */}
        {recommendedSets.length > 0 && (
          <div className="mt-8 mx-auto">
            <div className="flex items-center mb-4">
              <h2 className={`text-xl font-semibold ${homeContent.theme === 'dark' ? 'text-white' : 'text-gray-900'}`}>推荐题库</h2>
              <span className={`ml-2 px-2 py-1 text-xs font-medium bg-blue-100 text-blue-800 rounded-full`}>精选</span>
            </div>
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
              {recommendedSets.map(set => (
                <BaseCard 
                  key={set.id} 
                  set={{...set, accessType: set.accessType}} 
                  onStartQuiz={handleStartQuiz} 
                />
              ))}
            </div>
          </div>
        )}
        
        {!user && (
          <div className={`mt-6 ${homeContent.theme === 'dark' ? 'bg-blue-900' : 'bg-gradient-to-r from-blue-50 to-indigo-50'} border ${homeContent.theme === 'dark' ? 'border-blue-800' : 'border-blue-100'} rounded-lg p-6 mx-auto max-w-2xl shadow-sm`}>
            <h3 className={`text-lg font-medium ${homeContent.theme === 'dark' ? 'text-blue-300' : 'text-blue-800'} mb-2`}>随时开始，无需登录</h3>
            <p className={`text-sm ${homeContent.theme === 'dark' ? 'text-blue-200' : 'text-blue-600'} mb-4`}>
              您可以直接开始答题，但登录后可以保存答题进度、查看错题记录，以及收藏喜欢的题库。
            </p>
            <button 
              onClick={() => {
                // 触发登录弹窗而不是跳转到登录页面
                const loginEvent = new CustomEvent('auth:showLogin', { 
                  detail: { 
                    redirect: false,
                    returnUrl: window.location.pathname
                  } 
                });
                window.dispatchEvent(loginEvent);
              }}
              className="inline-flex items-center px-4 py-2 border border-transparent rounded-md shadow-sm text-sm font-medium text-white bg-blue-600 hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500"
            >
              <svg className="h-4 w-4 mr-1.5" fill="none" stroke="currentColor" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M11 16l-4-4m0 0l4-4m-4 4h14m-5 4v1a3 3 0 01-3 3H6a3 3 0 01-3-3V7a3 3 0 013-3h7a3 3 0 013 3v1" />
              </svg>
              登录账号
            </button>
          </div>
        )}
        
        {/* 管理员入口 */}
        {user && isAdmin() && (
          <div className={`mt-6 ${homeContent.theme === 'dark' ? 'bg-purple-900' : 'bg-gradient-to-r from-purple-50 to-pink-50'} border ${homeContent.theme === 'dark' ? 'border-purple-800' : 'border-purple-100'} rounded-lg p-4 mx-auto max-w-2xl shadow-sm`}>
            <div className="flex justify-between items-center">
              <div>
                <h3 className={`text-md font-medium ${homeContent.theme === 'dark' ? 'text-purple-300' : 'text-purple-800'}`}>管理员控制面板</h3>
                <p className={`text-sm ${homeContent.theme === 'dark' ? 'text-purple-200' : 'text-purple-600'}`}>
                  您可以管理用户、题库和网站内容
                </p>
              </div>
              <Link 
                to="/admin"
                className="inline-flex items-center px-4 py-2 border border-transparent rounded-md shadow-sm text-sm font-medium text-white bg-purple-600 hover:bg-purple-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-purple-500"
              >
                <svg className="h-4 w-4 mr-1.5" fill="none" stroke="currentColor" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.065 2.572c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.572 1.065c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.065-2.572c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065z" />
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
                </svg>
                进入管理后台
              </Link>
            </div>
          </div>
        )}
        
        {/* 分类选择器 */}
        <div className="mb-8 flex flex-wrap justify-center gap-2">
          <button 
            onClick={() => handleCategoryChange('all')}
            className={`px-4 py-2 rounded-full text-sm font-medium ${
              activeCategory === 'all' 
                ? `bg-blue-600 text-white` 
                : `${homeContent.theme === 'dark' ? 'bg-gray-700 text-gray-300 hover:bg-gray-600' : 'bg-gray-200 text-gray-700 hover:bg-gray-300'}`
            }`}
          >
            全部题库
          </button>
          {homeContent.featuredCategories.map(category => (
            <button 
              key={category}
              onClick={() => handleCategoryChange(category)}
              className={`px-4 py-2 rounded-full text-sm font-medium ${
                activeCategory === category 
                  ? `bg-blue-600 text-white` 
                  : `${homeContent.theme === 'dark' ? 'bg-gray-700 text-gray-300 hover:bg-gray-600' : 'bg-gray-200 text-gray-700 hover:bg-gray-300'}`
              }`}
            >
              {category}
            </button>
          ))}
        </div>

        {/* 题库分类展示 */}
        <div id="question-sets-section">
          {/* 分类展示题库 */}
          {(() => {
            const categorized = getCategorizedQuestionSets();
            const sections = [];
            
            // 我的题库（已购买/兑换的题库）
            if (categorized.purchased.length > 0) {
              sections.push(
                <div key="purchased" className="mb-12">
                  <div className="flex items-center mb-4">
                    <h2 className={`text-xl font-semibold ${homeContent.theme === 'dark' ? 'text-white' : 'text-gray-900'}`}>
                      我的题库
                    </h2>
                    <span className="ml-2 px-2 py-1 text-xs font-medium rounded-full bg-green-100 text-green-800">
                      {categorized.purchased.length}个已购买/兑换
                    </span>
                  </div>
                  <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                    {categorized.purchased.map((set: PreparedQuestionSet) => (
                      <BaseCard
                        key={set.id}
                        set={set}
                        onStartQuiz={handleStartQuiz}
                      />
                    ))}
                  </div>
                </div>
              );
            }
            
            // 免费题库
            if (categorized.free.length > 0) {
              sections.push(
                <div key="free" className="mb-12">
                  <div className="flex items-center mb-4">
                    <h2 className={`text-xl font-semibold ${homeContent.theme === 'dark' ? 'text-white' : 'text-gray-900'}`}>
                      免费题库
                    </h2>
                    <span className="ml-2 px-2 py-1 text-xs font-medium rounded-full bg-blue-100 text-blue-800">
                      {categorized.free.length}个免费题库
                    </span>
                  </div>
                  <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                    {categorized.free.map((set: PreparedQuestionSet) => (
                      <BaseCard
                        key={set.id}
                        set={set}
                        onStartQuiz={handleStartQuiz}
                      />
                    ))}
                  </div>
                </div>
              );
            }
            
            // 付费题库
            if (categorized.paid.length > 0) {
              sections.push(
                <div key="paid" className="mb-12">
                  <div className="flex items-center mb-4">
                    <h2 className={`text-xl font-semibold ${homeContent.theme === 'dark' ? 'text-white' : 'text-gray-900'}`}>
                      付费题库
                    </h2>
                    <span className="ml-2 px-2 py-1 text-xs font-medium rounded-full bg-yellow-100 text-yellow-800">
                      {categorized.paid.length}个待购买
                    </span>
                  </div>
                  <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                    {categorized.paid.map((set: PreparedQuestionSet) => (
                      <BaseCard
                        key={set.id}
                        set={set}
                        onStartQuiz={handleStartQuiz}
                      />
                    ))}
                  </div>
                </div>
              );
            }
            
            // 已过期题库
            if (categorized.expired.length > 0) {
              sections.push(
                <div key="expired" className="mb-12">
                  <div className="flex items-center mb-4">
                    <h2 className={`text-xl font-semibold ${homeContent.theme === 'dark' ? 'text-white' : 'text-gray-900'}`}>
                      已过期题库
                    </h2>
                    <span className="ml-2 px-2 py-1 text-xs font-medium rounded-full bg-red-100 text-red-800">
                      {categorized.expired.length}个已过期
                    </span>
                    <button 
                      onClick={() => {
                        const refreshEvent = new CustomEvent('questionSets:refresh');
                        window.dispatchEvent(refreshEvent);
                      }}
                      className="ml-auto px-3 py-1 text-sm bg-gray-200 hover:bg-gray-300 text-gray-700 rounded flex items-center"
                    >
                      <svg className="h-4 w-4 mr-1" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
                      </svg>
                      更新状态
                    </button>
                  </div>
                  <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                    {categorized.expired.map((set: PreparedQuestionSet) => (
                      <BaseCard
                        key={set.id}
                        set={set}
                        onStartQuiz={handleStartQuiz}
                      />
                    ))}
                  </div>
                </div>
              );
            }
            
            // 如果没有题库，显示提示
            if (sections.length === 0) {
              sections.push(
                <div key="empty" className="flex flex-col items-center justify-center py-12 text-center">
                  <svg className="h-16 w-16 text-gray-400 mb-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="1" d="M9.172 16.172a4 4 0 015.656 0M9 10h.01M15 10h.01M12 2C6.477 2 2 6.477 2 12s4.477 10 10 10 10-4.477 10-10S17.523 2 12 2z" />
                  </svg>
                  <h3 className={`text-xl font-medium ${homeContent.theme === 'dark' ? 'text-gray-200' : 'text-gray-700'} mb-2`}>未找到题库</h3>
                  <p className={`text-sm ${homeContent.theme === 'dark' ? 'text-gray-400' : 'text-gray-500'} max-w-md`}>
                    没有符合当前筛选条件的题库。请尝试更改筛选条件或搜索关键词。
                  </p>
                  <button
                    onClick={() => {
                      setActiveCategory('all');
                      setSearchTerm('');
                    }}
                    className="mt-4 inline-flex items-center px-4 py-2 border border-transparent rounded-md shadow-sm text-sm font-medium text-white bg-blue-600 hover:bg-blue-700"
                  >
                    <svg className="h-4 w-4 mr-1.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
                    </svg>
                    重置筛选条件
                  </button>
                </div>
              );
            }
            
            return sections;
          })()}
        </div>
      </div>
      
      {/* Add Payment Modal */}
      {showPaymentModal && selectedQuestionSet && (
        <PaymentModal
          isOpen={showPaymentModal}
          onClose={() => setShowPaymentModal(false)}
          questionSet={selectedQuestionSet as unknown as QuestionSet}
          onSuccess={() => {
            setShowPaymentModal(false);
            // 更新题库访问权限
            if (socket && user) {
              socket.emit('questionSet:checkAccess', {
                userId: user.id,
                questionSetId: selectedQuestionSet.id
              });
            }
          }}
        />
      )}
    </div>
  );
};

export default HomePage;