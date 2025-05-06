import React, { useState, useEffect, useCallback, useRef } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { UserProgress, QuestionSet } from '../types';
import { useUser } from '../contexts/UserContext';
import { useSocket } from '../contexts/SocketContext';
import { useUserProgress } from '../contexts/UserProgressContext';
import apiClient from '../utils/api-client';
import PaymentModal from './PaymentModal';
import ExamCountdownWidget from './ExamCountdownWidget';

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

const HomePage: React.FC = () => {
  const { user, isAdmin, syncAccessRights } = useUser();
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

  // 在这里添加BaseCard组件定义（组件内部）
  const BaseCard: React.FC<{
    key: string;
    set: PreparedQuestionSet;
    onStartQuiz: (set: PreparedQuestionSet) => void;
  }> = ({ set, onStartQuiz }) => {
    return (
      <div className="bg-white dark:bg-gray-800 rounded-lg shadow-md p-6 hover:shadow-lg transition-shadow duration-300">
        <h3 className="text-lg font-semibold mb-2">{set.title}</h3>
        <p className="text-sm text-gray-600 dark:text-gray-300 mb-3">{set.description}</p>
        <div className="flex justify-between items-center">
          <span className={`text-xs px-2 py-1 rounded ${set.hasAccess ? 'bg-green-100 text-green-800' : 'bg-red-100 text-red-800'}`}>
            {set.accessType === 'trial' ? '免费' : 
             set.accessType === 'paid' ? '已购买' :
             set.accessType === 'redeemed' ? '已兑换' :
             set.accessType === 'expired' ? '已过期' : '未知'}
          </span>
          <button
            onClick={() => onStartQuiz(set)}
            className="text-blue-600 hover:text-blue-800 dark:text-blue-400 dark:hover:text-blue-300"
          >
            开始
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
    
    // 检查是否有访问权限
    if (!set.hasAccess && set.isPaid) {
      console.log(`[HomePage] 无权访问付费题库: ${set.title} (ID: ${set.id})`);
      // 显示付款模态框
      setSelectedQuestionSet(set);
      setShowPaymentModal(true);
      return;
    }
    
    // 使用navigate进行路由跳转，而不是直接修改window.location
    navigate(`/quiz/${set.id}`);
  }, [navigate, setSelectedQuestionSet, setShowPaymentModal, setErrorMessage]);

  // Add getLocalAccessCache function before it's used
  const getLocalAccessCache = useCallback(() => {
    try {
      const cachedData = localStorage.getItem('question_set_access');
      if (cachedData) {
        return JSON.parse(cachedData) || {};
      }
    } catch (error) {
      console.error('[HomePage] 读取本地缓存失败', error);
    }
    return {};
  }, []);

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

  // Save access info to local storage
  const saveAccessToLocalStorage = useCallback((questionSetId: string, hasAccess: boolean, remainingDays: number | null, paymentMethod?: string) => {
    if (!user?.id) return;
    
    try {
      const cache = getLocalAccessCache();
      const userId = user.id;
      
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
  }, [user?.id, getLocalAccessCache]);
  
  const socketDataRef = useRef<{[key: string]: {hasAccess: boolean, remainingDays: number | null, accessType?: string}}>({}); 
  const bgClass = "min-h-screen bg-gray-50 dark:bg-gray-900 py-8";
  
  // 辅助函数：读取本地缓存的访问状态
  const getAccessFromLocalCache = useCallback((questionSetId: string, userId: string | undefined) => {
    if (!questionSetId || !userId) return null;
    
    try {
      const cache = getLocalAccessCache();
      if (cache[userId] && cache[userId][questionSetId]) {
        return cache[userId][questionSetId];
      }
    } catch (e) {
      console.error('[HomePage] 读取本地缓存失败:', e);
    }
    return null;
  }, [getLocalAccessCache]);
  
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
        console.warn(`[HomePage] 权限不一致: 数据库=${hasAccess}, Socket=${socketDataRef.current[questionSetId].hasAccess}`);
      }
      
      return hasAccess;
    } catch (error) {
      console.error(`[HomePage] 检查数据库权限失败:`, error);
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
      lastSocketUpdateTime.current = now;
      hasRequestedAccess.current = true;
      
      console.log(`[HomePage] 已为${paidQuestionSetIds.length}个付费题库请求权限状态`);
    } else {
      console.log('[HomePage] 没有付费题库需要请求权限');
    }
  }, [user?.id, socket, questionSets]);
  
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

  // 获取推荐题库的函数
  const getRecommendedSets = useCallback(() => {
    return questionSets.filter(set => set.isFeatured).slice(0, 3);
  }, [questionSets]);

  // 添加API缓存和请求防抖
  const [lastFetchTime, setLastFetchTime] = useState<number>(0);
  const pendingFetchRef = useRef<boolean>(false);
  const lastSocketUpdateTime = useRef<number>(0);
  const debounceTimerRef = useRef<any>(null);
  
  // 修改fetchQuestionSets，优先使用用户购买记录，然后才是socket数据和本地缓存
  const fetchQuestionSets = useCallback(async (options: { forceFresh?: boolean } = {}) => {
    const now = Date.now();
    
    // Ensure loading is set to true during fetch
    setLoading(true);
    
    // Set a safety timeout to prevent infinite loading state
    if (loadingTimeoutRef.current) {
      clearTimeout(loadingTimeoutRef.current);
    }
    
    loadingTimeoutRef.current = setTimeout(() => {
      console.log('[HomePage] Loading timeout triggered - forcing loading state to false');
      setLoading(false);
    }, 10000); // 10 seconds timeout
    
    // 防止频繁请求 - 仅在上次请求超过5秒或强制刷新时执行
    if (!options.forceFresh && now - lastFetchTime < 5000) {
      console.log(`[HomePage] 上次请求在 ${(now - lastFetchTime)/1000}秒前，跳过请求`);
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
      console.log(`[HomePage] 开始获取题库列表, 强制刷新: ${options.forceFresh}`);
      
      // 添加请求防缓存参数
      const timestamp = now;
      // 使用apiClient替代未定义的questionSetApi
      const response = await apiClient.get('/api/question-sets', 
        user?.id ? { 
          userId: user.id, 
          _t: timestamp 
        } : { _t: timestamp }
      );
      
      if (response && response.success && response.data) {
        console.log(`[HomePage] 成功获取${response.data.length}个题库`);
        
        // 预处理用户购买记录，创建一个Map方便快速查找
        const userPurchasesMap = new Map();
        if (user?.purchases && user.purchases.length > 0) {
          const nowDate = new Date();
          
          console.log(`[HomePage] 处理${user.purchases.length}条用户购买记录供题库映射使用`);
          
          user.purchases.forEach(purchase => {
            if (!purchase.questionSetId) return;
            
            const qsId = String(purchase.questionSetId).trim();
            
            // 处理过期日期
            const expiryDate = purchase.expiryDate ? new Date(purchase.expiryDate) : null;
            const isExpired = expiryDate && expiryDate <= nowDate;
            const isActive = !isExpired && 
                            (purchase.status === 'active' || 
                            purchase.status === 'completed' || 
                            !purchase.status);
            
            // 计算剩余天数
            let remainingDays = null;
            if (expiryDate && !isExpired) {
              const diffTime = expiryDate.getTime() - nowDate.getTime();
              remainingDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));
            }
            
            userPurchasesMap.set(qsId, {
              hasAccess: isActive,
              accessType: purchase.paymentMethod === 'redeem' ? 'redeemed' : 'paid',
              remainingDays: isActive ? remainingDays : (isExpired ? 0 : null),
              paymentMethod: purchase.paymentMethod || 'paid',
              isExpired
            });
            
            console.log(`[HomePage] 用户购买记录: 题库=${qsId}, 有效=${isActive}, 类型=${purchase.paymentMethod || 'paid'}, 剩余天数=${remainingDays}`);
          });
        }
        
        // 预处理用户兑换码记录，添加到快速查找Map
        if (user?.redeemCodes && user.redeemCodes.length > 0) {
          console.log(`[HomePage] 处理${user.redeemCodes.length}条用户兑换码记录供题库映射使用`);
          
          user.redeemCodes.forEach(code => {
            if (!code.questionSetId) return;
            
            const qsId = String(code.questionSetId).trim();
            
            // 只有在还没有此题库记录或现有记录已过期时，才添加兑换记录
            if (!userPurchasesMap.has(qsId) || userPurchasesMap.get(qsId).isExpired) {
              userPurchasesMap.set(qsId, {
                hasAccess: true,
                accessType: 'redeemed',
                remainingDays: null, // 兑换的题库通常不设置过期时间
                paymentMethod: 'redeem',
                isExpired: false
              });
              
              console.log(`[HomePage] 用户兑换记录: 题库=${qsId}, 已兑换可访问`);
            }
          });
        }
        
        // 处理题库数据，确保包含必要字段
        const preparedSets: PreparedQuestionSet[] = response.data.map((set: BaseQuestionSet) => {
          const setId = String(set.id).trim();
          const isPaid = set.isPaid === true;
          
          // 默认为试用状态
          let accessType: AccessType = 'trial';
          let hasAccess = !isPaid; // 免费题库自动有访问权限
          let remainingDays: number | null = null;
          let paymentMethod: string | undefined = undefined;
          
          // 1. 首先优先使用用户的购买记录（这是最高优先级，特别是刚登录时）
          const userPurchase = userPurchasesMap.get(setId);
          if (userPurchase) {
            console.log(`[HomePage] 题库"${set.title}"(${setId})找到用户购买/兑换记录, 状态=${userPurchase.hasAccess ? '有效' : '无效'}, 类型=${userPurchase.accessType}`);
            
            if (!userPurchase.isExpired) {
              hasAccess = userPurchase.hasAccess;
              accessType = userPurchase.accessType;
              remainingDays = userPurchase.remainingDays;
              paymentMethod = userPurchase.paymentMethod;
              
              // 立即保存到本地缓存以确保状态一致性
              if (user?.id) {
                saveAccessToLocalStorage(setId, hasAccess, remainingDays, paymentMethod);
              }
            } else {
              // 处理过期购买记录
              accessType = 'expired';
              hasAccess = false;
              remainingDays = 0;
              
              // 同样更新本地缓存
              if (user?.id) {
                saveAccessToLocalStorage(setId, false, 0, userPurchase.paymentMethod);
              }
            }
          }
          
          // 2. 其次检查Socket数据（如果尚未确定访问权限）
          const socketData = !hasAccess && socketDataRef.current[setId];
          if (socketData) {
            console.log(`[HomePage] 题库"${set.title}"(${setId})使用Socket数据更新权限`);
            
            hasAccess = socketData.hasAccess;
            remainingDays = socketData.remainingDays;
            
            if (socketData.accessType) {
              accessType = socketData.accessType as AccessType;
            } else if (hasAccess) {
              accessType = 'paid';
              // 检查剩余天数是否为0或负数，如果是则标记为过期
              if (remainingDays !== null && remainingDays <= 0) {
                accessType = 'expired';
                hasAccess = false;
              }
            }
          }
          
          // 3. 然后检查本地缓存（如果仍未确定访问权限）
          const cachedData = !hasAccess && getAccessFromLocalCache(setId, user?.id);
          if (cachedData && cachedData.hasAccess) {
            console.log(`[HomePage] 题库"${set.title}"(${setId})从本地缓存获取权限`);
            
            hasAccess = true;
            remainingDays = cachedData.remainingDays;
            
            // 根据支付方式和剩余天数确定访问类型
            if (cachedData.paymentMethod === 'redeem' || cachedData.accessType === 'redeemed') {
              accessType = 'redeemed';
            } else {
              accessType = 'paid';
              
              // 检查是否过期
              if (remainingDays !== null && remainingDays <= 0) {
                accessType = 'expired';
                hasAccess = false;
              }
            }
          }
          
          // 确保免费题库始终可访问
          if (!isPaid) {
            hasAccess = true;
            accessType = 'trial';
            remainingDays = null;
          }
          
          // 确保validityPeriod字段存在，默认为30天
          const validityPeriod = set.validityPeriod || 180;
          
          return {
            ...set,
            hasAccess,
            accessType,
            remainingDays,
            validityPeriod
          };
        });
        
        // 防止无效更新
        let needsUpdate = true;
        if (questionSets.length === preparedSets.length) {
          // 只比较权限相关字段和ID
          needsUpdate = questionSets.some((oldSet, index) => {
            const newSet = preparedSets[index];
            return oldSet.id !== newSet.id || 
                  oldSet.hasAccess !== newSet.hasAccess || 
                  oldSet.accessType !== newSet.accessType || 
                  oldSet.remainingDays !== newSet.remainingDays;
          });
        }
        
        if (needsUpdate) {
          console.log(`[HomePage] 题库数据或权限有变化，更新UI`);
          setQuestionSets(preparedSets);
          
          // 设置推荐题库
          setRecommendedSets(preparedSets.filter(set => set.isFeatured).slice(0, 3));
        } else {
          console.log(`[HomePage] 题库数据及权限无变化，跳过更新`);
        }
        
        // 更新最后获取时间
        setLastFetchTime(now);
        
        // Always set loading to false after successful fetch
        setLoading(false);
        clearTimeout(loadingTimeoutRef.current);
        
        // 3. 检查已兑换题库的本地存储（作为后备方案）
        try {
          const redeemedStr = localStorage.getItem('redeemedQuestionSetIds');
          if (redeemedStr) {
            const redeemedIds = JSON.parse(redeemedStr);
            if (Array.isArray(redeemedIds) && redeemedIds.length > 0) {
              console.log(`[HomePage] 发现本地存储的${redeemedIds.length}个已兑换题库ID，作为后备检查`);
              
              // 对每个已兑换题库进行处理
              let localUpdatesCount = 0;
              
              redeemedIds.forEach(id => {
                const normalizedId = String(id).trim();
                
                // 查找对应题库
                const matchingSet = preparedSets.find(s => String(s.id).trim() === normalizedId);
                if (matchingSet && matchingSet.isPaid && !matchingSet.hasAccess) {
                  console.log(`[HomePage] 应用本地兑换记录: 题库ID=${normalizedId}, 名称="${matchingSet.title}"`);
                  
                  // 更新为已兑换状态
                  matchingSet.hasAccess = true;
                  matchingSet.accessType = 'redeemed';
                  localUpdatesCount++;
                  
                  // 保存到本地缓存
                  saveAccessToLocalStorage(normalizedId, true, null, 'redeem');
                }
              });
              
              if (localUpdatesCount > 0) {
                console.log(`[HomePage] 通过本地存储更新了${localUpdatesCount}个题库的访问权限`);
                // 有变更时重新更新题库列表状态
                setQuestionSets([...preparedSets]);
              }
            }
          }
        } catch (error) {
          console.error('[HomePage] 检查兑换记录出错:', error);
        }
        
        // 同步完成后触发一个全局事件，通知其他组件刷新
        window.dispatchEvent(new CustomEvent('questionSets:loaded', {
          detail: { 
            timestamp: now,
            count: preparedSets.length
          }
        }));
        
        return preparedSets;
      } else {
        console.error('[HomePage] 获取题库失败:', response?.message);
        // Set loading to false even if the request failed
        setLoading(false);
        clearTimeout(loadingTimeoutRef.current);
        
        // Show error message to user
        setErrorMessage('获取题库数据失败，请稍后重试');
        return questionSets;
      }
    } catch (error) {
      console.error('[HomePage] 获取题库异常:', error);
      // Set loading to false even if an error occurred
      setLoading(false);
      clearTimeout(loadingTimeoutRef.current);
      
      // Show error message to user
      setErrorMessage('获取题库时发生错误，请刷新页面重试');
      return questionSets;
    } finally {
      pendingFetchRef.current = false;
    }
  }, [questionSets, user?.id, user?.purchases, user?.redeemCodes, getAccessFromLocalCache, saveAccessToLocalStorage]);
  
  // 初始化时获取题库列表
  useEffect(() => {
    // 如果已经有题库列表，则不重新加载
    if (questionSets.length === 0) {
      console.log(`[HomePage] 初始化获取题库列表`);
      fetchQuestionSets();
    } else {
      // If we already have question sets, ensure loading is false
      setLoading(false);
    }
  }, [fetchQuestionSets, questionSets.length]);

  // 监听来自ProfilePage的刷新通知 - 超简化版本，避免无限循环
  useEffect(() => {
    // 只在组件挂载时刷新一次题库列表
    fetchQuestionSets();
    
    // 添加一个简单的事件监听器来处理ProfilePage的刷新通知
    const handleRefreshRequest = () => {
      console.log('[HomePage] 收到刷新请求');
      fetchQuestionSets();
    };
    
    // 使用自定义事件而不是socket
    window.addEventListener('questionSets:refresh', handleRefreshRequest);
    
    return () => {
      window.removeEventListener('questionSets:refresh', handleRefreshRequest);
    };
  }, []); // 空依赖数组，只在挂载时执行

  // 页面加载时获取题库列表
  useEffect(() => {
    fetchQuestionSets();
  }, [fetchQuestionSets]);

  // 用户登录状态改变时重新获取题库列表
  useEffect(() => {
    if (user?.id) {
      console.log('[HomePage] 用户登录状态变化，重新获取题库列表');
      fetchQuestionSets();
    }
  }, [user?.id, fetchQuestionSets]);

  // 添加函数来清除本地存储中过期的缓存数据
  useEffect(() => {
    if (!user?.id) return;
    
    console.log('[HomePage] 用户登录，清除本地过期缓存');
    
    // 清除过期的访问权限缓存
    try {
      const cacheKey = 'question_set_access';
      const cache = localStorage.getItem(cacheKey);
      
      if (cache) {
        const cacheData = JSON.parse(cache);
        let hasUpdates = false;
        
        // 遍历所有用户的缓存
        Object.keys(cacheData).forEach(userId => {
          // 如果不是当前用户的缓存，跳过
          if (userId !== user.id) return;
          
          const userCache = cacheData[userId];
          
          // 遍历该用户的所有题库缓存
          Object.keys(userCache).forEach(qsId => {
            const record = userCache[qsId];
            const cacheAge = Date.now() - (record.timestamp || 0);
            
            // 缓存超过2小时视为过期，确保从服务器获取最新状态
            if (cacheAge > 7200000) {
              console.log(`[HomePage] 清除过期缓存: ${qsId}，缓存时间: ${cacheAge/1000/60}分钟`);
              delete userCache[qsId];
              hasUpdates = true;
            }
          });
        });
        
        // 如果有更新，保存回localStorage
        if (hasUpdates) {
          localStorage.setItem(cacheKey, JSON.stringify(cacheData));
          console.log('[HomePage] 已清理过期缓存');
        }
      }
    } catch (error) {
      console.error('[HomePage] 清除缓存失败:', error);
    }
  }, [user?.id]);

  // 监听全局兑换码成功事件
  useEffect(() => {
    const handleRedeemSuccess = (e: Event) => {
      const customEvent = e as CustomEvent;
      
      // 优先使用 questionSetId，兼容旧版本的 quizId
      const questionSetId = customEvent.detail?.questionSetId || customEvent.detail?.quizId;
      
      // 从事件中获取剩余天数，如果不存在则使用默认值
      const remainingDays = customEvent.detail?.remainingDays || customEvent.detail?.validityPeriod || 30;
      
      console.log('[HomePage] 接收到兑换码成功事件:', { questionSetId, remainingDays });
      
      if (questionSetId) {
        setQuestionSets(prevSets => {
          return prevSets.map(set => {
            if (set.id === questionSetId) {
              console.log('[HomePage] 更新题库访问状态:', set.title);
              
              // 保存到localStorage缓存，确保用户已登录
              if (user?.id) {
                saveAccessToLocalStorage(questionSetId, true, remainingDays);
              }
              
              // Add to recently updated sets for animation
              setRecentlyUpdatedSets(prev => ({
                ...prev,
                [questionSetId]: Date.now() 
              }));
              
              return {
                ...set,
                hasAccess: true,
                remainingDays,
                accessType: 'redeemed'
              };
            }
            return set;
          });
        });
      }
    };

    window.addEventListener('redeem:success', handleRedeemSuccess);

    return () => {
      window.removeEventListener('redeem:success', handleRedeemSuccess);
    };
  }, [user?.id, saveAccessToLocalStorage]);

  // 增强监听socket权限更新事件的实现
  useEffect(() => {
    if (!socket || !user?.id) return;
    
    console.log('[HomePage] 设置Socket事件监听');
    
    // 添加连接状态监听
    const handleConnect = () => {
      console.log('[HomePage] Socket重新连接，重新请求权限数据');
      
      // 重置请求标记
      hasRequestedAccess.current = false;
      
      // 重新请求权限
      if (questionSets.length > 0) {
        requestAccessStatusForAllQuestionSets();
      }
    };
    
    // 添加连接错误监听
    const handleConnectError = (error: any) => {
      console.error('[HomePage] Socket连接错误:', error);
    };
    
    // 监听权限更新事件
    const handleAccessUpdate = (data: any) => {
      // 过滤不是当前用户的事件
      if (data.userId !== user.id) return;
      
      console.log(`[HomePage] 收到题库 ${data.questionSetId} 权限更新:`, data);
      
      // 添加防御性检查
      if (!data.questionSetId) {
        console.error('[HomePage] 收到无效的权限更新数据:', data);
        return;
      }
      
      // 更新本地缓存
      saveAccessToLocalStorage(
        data.questionSetId, 
        data.hasAccess, 
        data.remainingDays,
        data.paymentMethod || 'unknown'
      );
      
      // 检查数据一致性，可选择直接查询数据库
      if (data.source !== 'db_check' && data.hasAccess) {
        setTimeout(async () => {
          try {
            const dbAccess = await hasAccessInDatabase(data.questionSetId);
            if (dbAccess !== data.hasAccess) {
              console.warn(`[HomePage] 权限数据不一致，执行数据库验证 - Socket=${data.hasAccess}, 数据库=${dbAccess}`);
            }
          } catch (error) {
            console.error('[HomePage] 验证数据库权限失败:', error);
          }
        }, 2000);
      }
      
      // 立即更新题库的UI状态
      setQuestionSets(prevSets => 
        prevSets.map(set => 
          set.id === data.questionSetId 
            ? {
                ...set,
                hasAccess: data.hasAccess,
                accessType: data.accessType || (data.hasAccess ? (data.paymentMethod === 'redeem' ? 'redeemed' : 'paid') : 'trial'),
                remainingDays: data.remainingDays
              }
            : set
        )
      );
      
      // 标记为最近更新
      setRecentlyUpdatedSets(prev => ({
        ...prev,
        [data.questionSetId]: Date.now()
      }));
    };
    
    // 监听设备同步事件
    const handleDeviceSync = (data: any) => {
      if (data.userId !== user.id) return;
      
      console.log("[HomePage] 收到设备同步事件:", data);
      
      // 设备同步事件要求完整刷新权限和题库列表
      (async () => {
        try {
          // 同步最新权限
          await syncAccessRights();
          
          // 刷新题库列表，使用最新数据
          await fetchQuestionSets({ forceFresh: true });
        } catch (error) {
          console.error('[HomePage] 处理设备同步事件错误:', error);
        }
      })();
    };
    
    // 监听批量访问检查结果
    const handleBatchAccessResult = (data: any) => {
      if (data.userId !== user?.id || !Array.isArray(data.results)) return;
      
      const now = Date.now();
      console.log(`[HomePage] 收到批量访问检查结果: ${data.results.length} 个题库, 来源: ${data.source || '未知'}, 时间戳: ${data.timestamp || '未知'}`);
      
      // 添加防御性检查
      if (data.results.length === 0) {
        console.log('[HomePage] 收到空结果集，跳过处理');
        return;
      }
      
      // 只在特定情况下应用时间戳检查 - 对于登录后的首次检查，应始终应用结果
      const isLoginCheck = data.source === 'login_explicit_check' || data.source === 'login_sync';
      
      if (!isLoginCheck && data.timestamp && data.timestamp < lastSocketUpdateTime.current) {
        console.log(`[HomePage] 收到的批量检查结果已过期 (${data.timestamp} < ${lastSocketUpdateTime.current})，跳过处理`);
        return;
      }
      
      // 尝试解析和处理兑换码数据
      try {
        const redeemedStr = localStorage.getItem('redeemedQuestionSetIds');
        const redeemedIds = redeemedStr ? JSON.parse(redeemedStr) : [];
        if (Array.isArray(redeemedIds) && redeemedIds.length > 0) {
          console.log(`[HomePage] 本地兑换记录: ${redeemedIds.length}个题库`);
        }
      } catch (error) {
        console.error('[HomePage] 解析兑换记录出错:', error);
      }

      // 收集所有需要更新的题库ID及其状态，用于批量更新
      const updatesById = new Map();
      
      // 更新Socket数据引用和本地缓存
      data.results.forEach((result: any) => {
        const questionSetId = String(result.questionSetId).trim();
        
        // 确保数据有效且包含必要字段
        if (!questionSetId || result.hasAccess === undefined) {
          console.log(`[HomePage] 跳过无效数据: ${JSON.stringify(result)}`);
          return;
        }
        
        // 确保转换为正确的类型
        const hasAccess = Boolean(result.hasAccess);
        const remainingDays = result.remainingDays !== undefined ? Number(result.remainingDays) : null;
        const paymentMethod = result.paymentMethod || 'unknown';
        const accessType = paymentMethod === 'redeem' ? 'redeemed' : (hasAccess ? 'paid' : 'trial');
        
        console.log(`[HomePage] 题库 ${questionSetId} 权限检查结果: 可访问=${hasAccess}, 剩余天数=${remainingDays}, 支付方式=${paymentMethod}`);
        
        // 保存到socketDataRef引用
        socketDataRef.current[questionSetId] = {
          hasAccess,
          remainingDays,
          accessType
        };
        
        // 更新本地缓存
        saveAccessToLocalStorage(
          questionSetId,
          hasAccess,
          remainingDays,
          paymentMethod
        );
        
        // 添加到批量更新映射
        updatesById.set(questionSetId, {
          hasAccess,
          remainingDays,
          accessType,
          paymentMethod
        });
      });
      
      // 如果收到的是登录相关的检查结果，优先级更高，立即更新UI
      if (isLoginCheck) {
        console.log(`[HomePage] 这是登录后的首次检查，立即更新题库UI状态`);
        updateQuestionSetsImmediately();
        return;
      }
      
      // 常规更新使用防抖，合并短时间内的多次更新
      if (debounceTimerRef.current) {
        clearTimeout(debounceTimerRef.current);
      }
      
      debounceTimerRef.current = setTimeout(() => {
        updateQuestionSetsImmediately();
      }, 1000); // 1秒防抖时间
      
      // 实际执行更新的函数
      function updateQuestionSetsImmediately() {
        if (updatesById.size === 0) {
          console.log(`[HomePage] 没有需要更新的题库状态`);
          return;
        }
        
        console.log(`[HomePage] 应用批量权限更新到 ${updatesById.size} 个题库`);
        
        // 更新题库状态，增加变化检测逻辑
        setQuestionSets(prevSets => {
          let hasChanged = false;
          let updatedCount = 0;
          
          const updatedSets = prevSets.map(set => {
            const setId = String(set.id).trim();
            const updateData = updatesById.get(setId);
            
            if (!updateData) return set;
            
            // 使用统一函数确定访问状态
            const newStatus = determineAccessStatus(
              set,
              updateData.hasAccess,
              updateData.remainingDays,
              updateData.paymentMethod
            );
            
            // 只有在状态真正变化时才更新
            if (set.hasAccess !== newStatus.hasAccess || 
                set.accessType !== newStatus.accessType || 
                set.remainingDays !== newStatus.remainingDays) {
              
              console.log(`[HomePage] 题库 "${set.title}" 状态有变化: ${set.accessType} -> ${newStatus.accessType}, hasAccess: ${set.hasAccess} -> ${newStatus.hasAccess}`);
              hasChanged = true;
              updatedCount++;
              
              // 标记为最近更新
              setRecentlyUpdatedSets(prev => ({
                ...prev,
                [set.id]: Date.now()
              }));
              
              // 返回更新后的题库对象
              return {
                ...set,
                ...newStatus
              };
            }
            
            return set;
          });
          
          // 记录更新结果
          console.log(`[HomePage] 批量更新完成: ${updatedCount}/${updatesById.size}个题库状态有变化`);
          
          // 清空Socket数据引用
          socketDataRef.current = {};
          
          // 只有在实际有变化时才返回新数组，避免不必要的重渲染
          return hasChanged ? updatedSets : prevSets;
        });
        
        // 更新时间戳
        lastSocketUpdateTime.current = now;
        
        // 通知页面已更新权限
        window.dispatchEvent(new CustomEvent('accessRights:updated', {
          detail: {
            userId: user?.id, // 使用可选链操作符处理user可能为null的情况
            timestamp: now,
            source: 'socket_batch_update',
            updatedCount: updatesById.size
          }
        }));
      }
    };
    
    // 注册Socket连接状态事件监听
    socket.on('connect', handleConnect);
    socket.on('connect_error', handleConnectError);
    
    // 注册Socket权限事件监听
    socket.on('questionSet:accessUpdate', handleAccessUpdate);
    socket.on('user:deviceSync', handleDeviceSync);
    socket.on('questionSet:batchAccessResult', handleBatchAccessResult);
    
    // 发送状态同步请求，确保服务器知道此连接是谁的
    socket.emit('user:identify', {
      userId: user.id,
      clientId: `homepage_${Date.now()}`,
      timestamp: Date.now()
    });
    
    return () => {
      // 清理所有事件监听
      socket.off('connect', handleConnect);
      socket.off('connect_error', handleConnectError);
      socket.off('questionSet:accessUpdate', handleAccessUpdate);
      socket.off('user:deviceSync', handleDeviceSync);
      socket.off('questionSet:batchAccessResult', handleBatchAccessResult);
      
      // 清理定时器
      if (debounceTimerRef.current) {
        clearTimeout(debounceTimerRef.current);
      }
      
      console.log('[HomePage] 已清理所有Socket事件监听');
    };
  }, [socket, user?.id, syncAccessRights, fetchQuestionSets, saveAccessToLocalStorage, requestAccessStatusForAllQuestionSets, determineAccessStatus, hasAccessInDatabase, questionSets.length]); // 添加了必要的依赖项

  // 登录状态变化后重新获取题库数据
  useEffect(() => {
    if (!user?.id) {
      // Reset the flag when user logs out
      hasRequestedAccess.current = false;
      // Make sure loading is false when logged out
      setLoading(false);
      return;
    }
    
    console.log('[HomePage] 用户登录事件触发，开始处理登录流程');
    
    // 防止多次触发 - 使用ref标记代替sessionStorage
    if (hasRequestedAccess.current) {
      console.log('[HomePage] 已在处理登录流程，跳过重复请求');
      return;
    }
    
    // 标记为已处理
    hasRequestedAccess.current = true;
    
    // Set loading true explicitly when starting login flow
    setLoading(true);
    
    // Set a safety timeout to prevent infinite loading state
    if (loadingTimeoutRef.current) {
      clearTimeout(loadingTimeoutRef.current);
    }
    
    loadingTimeoutRef.current = setTimeout(() => {
      console.log('[HomePage] Login flow timeout triggered - forcing loading state to false');
      setLoading(false);
    }, 15000); // 15 seconds timeout for the entire login flow
    
    // 添加对同步事件的监听
    const handleSyncComplete = (event: Event) => {
      const syncEvent = event as CustomEvent;
      console.log('[HomePage] 接收到权限同步完成事件:', syncEvent.detail);
      
      // 强制刷新题库列表，以确保显示最新的权限状态
      fetchQuestionSets({ forceFresh: true }).then(() => {
        console.log('[HomePage] 权限同步后题库列表已更新');
      });
    };
    
    // 添加权限同步完成事件监听
    window.addEventListener('accessRights:updated', handleSyncComplete);
    
    // 登录流程，按顺序执行，避免竞态条件
    (async () => {
      try {
        // 第1步：通过syncAccessRights同步最新权限数据
        console.log('[HomePage] 1. 开始同步访问权限数据');
        await syncAccessRights();
        console.log('[HomePage] 同步访问权限完成，此时用户数据和访问权限已是最新');
        
        // 第2步：使用最新的权限信息，获取并处理题库列表
        console.log('[HomePage] 2. 获取题库列表，强制使用最新数据');
        const freshSets = await fetchQuestionSets({ forceFresh: true });
        console.log('[HomePage] 题库列表获取并处理完成，UI应显示正确的权限状态');
        
        // 第3步：通过socket请求批量权限检查，确保数据一致性
        if (socket) {
          console.log('[HomePage] 3. 请求Socket批量权限检查，确保数据一致性');
          socket.emit('user:syncAccessRights', {
            userId: user.id,
            forceRefresh: true,
            timestamp: Date.now()
          });
          
          // 立即触发设备同步事件，确保其他设备也更新
          socket.emit('user:deviceSync', {
            userId: user.id,
            type: 'access_refresh',
            timestamp: Date.now(),
            source: 'login_sync'
          });
          
          // 显式针对每个付费题库检查访问权限
          const paidSets = freshSets.filter(set => set.isPaid === true);
          if (paidSets.length > 0) {
            console.log(`[HomePage] 4. 主动检查 ${paidSets.length} 个付费题库的访问权限`);
            socket.emit('questionSet:checkAccessBatch', {
              userId: user.id,
              questionSetIds: paidSets.map(set => String(set.id).trim()),
              source: 'login_explicit_check',
              timestamp: Date.now()
            });
          }
        }
        
        // 设置loading状态为false，表示登录流程完成
        setLoading(false);
        clearTimeout(loadingTimeoutRef.current);
      } catch (error) {
        console.error('[HomePage] 登录流程处理出错:', error);
        // Reset the flag on error so we can try again
        hasRequestedAccess.current = false;
        // Ensure loading is set to false even if an error occurs
        setLoading(false);
        clearTimeout(loadingTimeoutRef.current);
        
        // Show error message to user
        setErrorMessage('登录后加载数据时出错，请刷新页面重试');
      }
    })();
    
    // Clean up the timeout and event listeners when the component unmounts or when the effect runs again
    return () => {
      if (loadingTimeoutRef.current) {
        clearTimeout(loadingTimeoutRef.current);
      }
      window.removeEventListener('accessRights:updated', handleSyncComplete);
    };
  }, [user?.id, syncAccessRights, fetchQuestionSets, socket]);

  // 添加重复请求检测和预防 - 防止组件重渲染引起的重复请求
  useEffect(() => {
    if (!user?.id) return;
    
    const checkForLoops = () => {
      const now = Date.now();
      const requestsKey = 'homepage_requests_count';
      const requestsTimeKey = 'homepage_requests_time';
      
      // 获取请求计数和时间
      const requestsCount = parseInt(sessionStorage.getItem(requestsKey) || '0', 10);
      const requestsTime = parseInt(sessionStorage.getItem(requestsTimeKey) || '0', 10);
      
      // 检查是否有重复请求迹象
      if (now - requestsTime < 5000 && requestsCount > 8) {
        console.warn('[HomePage] 检测到异常重复请求，可能存在循环!');
        
        // 尝试中断可能的循环
        hasRequestedAccess.current = true;
        lastSocketUpdateTime.current = now;
        pendingFetchRef.current = true;
        
        // 5秒后重置阻止状态
        setTimeout(() => {
          pendingFetchRef.current = false;
        }, 5000);
        
        // 重置计数器
        sessionStorage.setItem(requestsKey, '0');
        sessionStorage.setItem(requestsTimeKey, now.toString());
        
        return true;
      }
      
      // 如果间隔超过10秒，重置计数器
      if (now - requestsTime > 10000) {
        sessionStorage.setItem(requestsKey, '1');
        sessionStorage.setItem(requestsTimeKey, now.toString());
      } else {
        // 否则增加计数
        sessionStorage.setItem(requestsKey, (requestsCount + 1).toString());
        sessionStorage.setItem(requestsTimeKey, now.toString());
      }
      
      return false;
    };
    
    // 启动循环检测
    const loopDetected = checkForLoops();
    
    // 如果检测到循环，显示警告并中断操作
    if (loopDetected) {
      console.warn('[HomePage] 已中断可能的无限循环，暂停操作5秒');
    }
  }, [user?.id]);

  // 添加监听题库更新的useEffect
  useEffect(() => {
    if (!isInitialLoad.current) {
      // Only log if we're not already requesting access
      if (!hasRequestedAccess.current) {
        console.log('[HomePage] 题库列表更新，可能需要请求最新权限状态');
        
        // Only make an access request if all conditions are met and we haven't recently made a request
        const now = Date.now();
        if (user?.id && socket && questionSets.length > 0 && 
            !hasRequestedAccess.current && 
            now - lastSocketUpdateTime.current > 15000) { // Add a time threshold (15 seconds)
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

  // Add a cleanup effect to clear timeouts when component unmounts
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