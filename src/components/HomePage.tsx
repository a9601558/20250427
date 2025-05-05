import React, { useState, useEffect, useCallback, useRef } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { UserProgress, QuestionSet, Question, Option } from '../types';
import { useUser } from '../contexts/UserContext';
import { useSocket } from '../contexts/SocketContext';
import { useUserProgress } from '../contexts/UserProgressContext';
import apiClient from '../utils/api-client';
import PaymentModal from './PaymentModal';
import ExamCountdownWidget from './ExamCountdownWidget';

// 题库访问类型
type AccessType = 'trial' | 'paid' | 'expired' | 'redeemed';

// 扩展题库类型，基于QuestionSet模型
interface BaseQuestionSet extends Omit<QuestionSet, 'price' | 'trialQuestions'> {
  price: number | null;
  trialQuestions: number | null;
  remainingDays?: number | null;
  paymentMethod?: string;
  questionSetQuestions?: { id: string }[];
  validityPeriod?: number; // 题库有效期，以天为单位
}

// 扩展题库类型，添加访问类型
interface PreparedQuestionSet extends BaseQuestionSet {
  accessType: AccessType;
  remainingDays: number | null;
  validityPeriod: number;
}

// 首页内容数据接口
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

// 计算题目数量的辅助函数
const calculateQuestionCount = (set: BaseQuestionSet): number => {
  if (typeof set.questionCount === 'number' && set.questionCount > 0) {
    return set.questionCount;
  }
  if (Array.isArray(set.questionSetQuestions) && set.questionSetQuestions.length > 0) {
    return set.questionSetQuestions.length;
  }
  if (Array.isArray(set.questions) && set.questions.length > 0) {
    return set.questions.length;
  }
  return 0; // 不再使用 trialQuestions 作为后备选项
};

// 购买数据接口，使用QuestionSet而非any
interface PurchaseData {
  id: string;
  questionSetId: string;
  purchaseDate: string;
  expiryDate: string;
  remainingDays: number;
  hasAccess: boolean;
  questionSet?: QuestionSet;
}

// 修改QuestionSetCacheManager，整合localStorage键
const QuestionSetCacheManager = {
  // 缓存TTL，默认10分钟
  CACHE_TTL: 10 * 60 * 1000,
  
  // 缓存键
  STORAGE_KEY: 'questionSets.cache',
  
  // 缓存数据结构
  /*
  {
    meta: {
      version: 1,
      lastUpdate: timestamp,
      ttl: 600000
    },
    users: {
      [userId]: {
        sets: {
          [questionSetId]: {
            hasAccess: boolean,
            accessType: 'trial' | 'paid' | 'expired' | 'redeemed',
            remainingDays: number | null,
            validityPeriod: number,
            timestamp: number,
            source: string
          }
        },
        lastSync: timestamp
      }
    },
    redeemed: [questionSetId1, questionSetId2, ...], // 全局兑换记录
    globalAccess: { // 兼容旧版quizAccessRights
      [questionSetId]: {
        hasAccess: boolean,
        timestamp: number
      }
    }
  }
  */
  
  // 初始化缓存
  initCache: () => {
    try {
      const cache = localStorage.getItem(QuestionSetCacheManager.STORAGE_KEY);
      if (!cache) {
        // 创建新的缓存结构
        const newCache = {
          meta: {
            version: 1,
            lastUpdate: Date.now(),
            ttl: QuestionSetCacheManager.CACHE_TTL
          },
          users: {},
          redeemed: [],
          globalAccess: {}
        };
        
        localStorage.setItem(QuestionSetCacheManager.STORAGE_KEY, JSON.stringify(newCache));
        
        // 迁移旧数据
        QuestionSetCacheManager.migrateOldData();
        
        return newCache;
      }
      
      return JSON.parse(cache);
    } catch (e) {
      console.error('[QuestionSetCacheManager] 初始化缓存失败:', e);
      return {
        meta: { version: 1, lastUpdate: Date.now(), ttl: QuestionSetCacheManager.CACHE_TTL },
        users: {},
        redeemed: [],
        globalAccess: {}
      };
    }
  },
  
  // 迁移旧版数据
  migrateOldData: () => {
    try {
      const cache = QuestionSetCacheManager.getCache();
      let updated = false;
      
      // 1. 迁移questionSetAccessCache
      const accessCacheStr = localStorage.getItem('questionSetAccessCache');
      if (accessCacheStr) {
        try {
          const accessCache = JSON.parse(accessCacheStr);
          
          // 遍历用户
          Object.keys(accessCache).forEach(userId => {
            if (!cache.users[userId]) {
              cache.users[userId] = {
                sets: {},
                lastSync: Date.now()
              };
            }
            
            // 遍历题库权限
            const userCache = accessCache[userId];
            Object.keys(userCache).forEach(questionSetId => {
              const entry = userCache[questionSetId];
              
              if (!cache.users[userId].sets[questionSetId]) {
                cache.users[userId].sets[questionSetId] = {
                  hasAccess: entry.hasAccess,
                  accessType: entry.source && entry.source.includes('redeem') ? 'redeemed' : 'paid',
                  remainingDays: entry.remainingDays,
                  validityPeriod: 180,
                  timestamp: entry.timestamp || Date.now(),
                  source: entry.source || 'migration'
                };
                updated = true;
              }
            });
          });
        } catch (e) {
          console.error('[QuestionSetCacheManager] 迁移questionSetAccessCache失败:', e);
        }
      }
      
      // 2. 迁移redeemedQuestionSetIds
      const redeemedStr = localStorage.getItem('redeemedQuestionSetIds');
      if (redeemedStr) {
        try {
          const redeemedIds = JSON.parse(redeemedStr);
          if (Array.isArray(redeemedIds)) {
            cache.redeemed = [...new Set([...cache.redeemed, ...redeemedIds])];
            updated = true;
          }
        } catch (e) {
          console.error('[QuestionSetCacheManager] 迁移redeemedQuestionSetIds失败:', e);
        }
      }
      
      // 3. 迁移quizAccessRights
      const accessRightsStr = localStorage.getItem('quizAccessRights');
      if (accessRightsStr) {
        try {
          const accessRights = JSON.parse(accessRightsStr);
          Object.keys(accessRights).forEach(questionSetId => {
            const entry = accessRights[questionSetId];
            cache.globalAccess[questionSetId] = {
              hasAccess: entry.hasAccess,
              timestamp: entry.timestamp || Date.now()
            };
            updated = true;
          });
        } catch (e) {
          console.error('[QuestionSetCacheManager] 迁移quizAccessRights失败:', e);
        }
      }
      
      // 保存更新后的缓存
      if (updated) {
        cache.meta.lastUpdate = Date.now();
        localStorage.setItem(QuestionSetCacheManager.STORAGE_KEY, JSON.stringify(cache));
        console.log('[QuestionSetCacheManager] 旧数据迁移完成');
      }
    } catch (e) {
      console.error('[QuestionSetCacheManager] 数据迁移失败:', e);
    }
  },
  
  // 获取缓存
  getCache: () => {
    try {
      const cache = localStorage.getItem(QuestionSetCacheManager.STORAGE_KEY);
      if (!cache) {
        return QuestionSetCacheManager.initCache();
      }
      return JSON.parse(cache);
    } catch (e) {
      console.error('[QuestionSetCacheManager] 读取缓存失败:', e);
      return QuestionSetCacheManager.initCache();
    }
  },
  
  // 存储访问权限到缓存
  saveAccessToCache: (userId: string, questionSetId: string, hasAccess: boolean, remainingDays?: number | null, accessType?: AccessType, source?: string) => {
    try {
      if (!userId || !questionSetId) return;
      
      const cache = QuestionSetCacheManager.getCache();
      
      // 确保用户存在
      if (!cache.users[userId]) {
        cache.users[userId] = {
          sets: {},
          lastSync: Date.now()
        };
      }
      
      // 确定访问类型
      const actualAccessType = accessType || 
        (source && source.includes('redeem') ? 'redeemed' : 'paid') as AccessType;
      
      // 更新用户题库权限
      cache.users[userId].sets[questionSetId] = {
        hasAccess,
        accessType: actualAccessType,
        remainingDays: remainingDays || null,
        validityPeriod: 180, // 默认值
        timestamp: Date.now(),
        source: source || 'direct_save'
      };
      
      // 更新全局访问记录
      if (actualAccessType === 'redeemed' && !cache.redeemed.includes(questionSetId)) {
        cache.redeemed.push(questionSetId);
      }
      
      cache.globalAccess[questionSetId] = {
        hasAccess,
        timestamp: Date.now()
      };
      
      // 更新元数据
      cache.meta.lastUpdate = Date.now();
      
      // 保存缓存
      localStorage.setItem(QuestionSetCacheManager.STORAGE_KEY, JSON.stringify(cache));
      
      console.log(`[QuestionSetCacheManager] 已缓存题库 ${questionSetId} 的访问权限, 用户: ${userId}`);
    } catch (e) {
      console.error('[QuestionSetCacheManager] 保存缓存失败:', e);
    }
  },
  
  // 检查缓存是否过期
  isCacheExpired: (userId: string, questionSetId: string) => {
    try {
      const cache = QuestionSetCacheManager.getCache();
      
      if (!cache.users[userId] || !cache.users[userId].sets[questionSetId]) {
        return true;
      }
      
      const entry = cache.users[userId].sets[questionSetId];
      return !entry.timestamp || (Date.now() - entry.timestamp > QuestionSetCacheManager.CACHE_TTL);
    } catch (e) {
      console.error('[QuestionSetCacheManager] 检查缓存是否过期失败:', e);
      return true;
    }
  },
  
  // 检查题库是否已兑换
  isQuestionSetRedeemed: (questionSetId: string): boolean => {
    try {
      const cache = QuestionSetCacheManager.getCache();
      return cache.redeemed.includes(questionSetId);
    } catch (e) {
      console.error('[QuestionSetCacheManager] 检查题库是否已兑换失败:', e);
      return false;
    }
  },
  
  // 获取题库访问状态，整合所有来源
  getQuestionSetAccess: (userId: string, questionSetId: string, set: BaseQuestionSet) => {
    // 如果是免费题库，直接返回有访问权限
    if (!set.isPaid) {
      return { hasAccess: true, remainingDays: null, accessType: 'trial' as AccessType };
    }
    
    // 如果用户未登录，返回无访问权限
    if (!userId) {
      return { hasAccess: false, remainingDays: null, accessType: 'trial' as AccessType };
    }
    
    // 1. 首先检查题库对象本身的属性
    if (set.hasAccess !== undefined) {
      // 检查是否已过期（remainingDays <= 0）
      if (set.remainingDays !== undefined && set.remainingDays !== null && set.remainingDays <= 0) {
        return { hasAccess: false, remainingDays: 0, accessType: 'expired' as AccessType };
      }
      
      // 确定访问类型
      let accessType: AccessType = 'trial';
      if (set.hasAccess) {
        // 检查是否是兑换的题库
        accessType = set.paymentMethod === 'redeem' ? 'redeemed' : 'paid';
      } else if (set.remainingDays !== undefined && set.remainingDays !== null && set.remainingDays <= 0) {
        accessType = 'expired';
      }
      
      return { 
        hasAccess: set.hasAccess, 
        remainingDays: set.remainingDays || null,
        accessType
      };
    }
    
    // 2. 从统一缓存中获取访问权限
    try {
      const cache = QuestionSetCacheManager.getCache();
      
      // 检查是否已兑换
      if (cache.redeemed.includes(questionSetId)) {
        // 从题库获取有效期或使用默认值
        return { 
          hasAccess: true, 
          remainingDays: set.validityPeriod || 30, 
          accessType: 'redeemed' as AccessType 
        };
      }
      
      // 检查用户特定的缓存
      if (cache.users[userId] && cache.users[userId].sets[questionSetId]) {
        const entry = cache.users[userId].sets[questionSetId];
        return {
          hasAccess: entry.hasAccess,
          remainingDays: entry.remainingDays,
          accessType: entry.accessType as AccessType
        };
      }
      
      // 检查全局访问权限
      if (cache.globalAccess[questionSetId] && cache.globalAccess[questionSetId].hasAccess) {
        return {
          hasAccess: true,
          remainingDays: set.validityPeriod || 30,
          accessType: 'paid' as AccessType
        };
      }
    } catch (e) {
      console.error('[QuestionSetCacheManager] 获取访问权限失败:', e);
    }
    
    // 3. 如果都没有找到，返回默认无访问权限
    return { hasAccess: false, remainingDays: null, accessType: 'trial' as AccessType };
  },
  
  // 收集需要检查访问权限的题库ID
  collectQuestionSetIdsToCheck: (userId: string) => {
    const questionSetIdsToCheck = new Set<string>();
    
    try {
      const cache = QuestionSetCacheManager.getCache();
      
      // 从用户缓存收集
      if (cache.users[userId]) {
        Object.keys(cache.users[userId].sets).forEach((id: string) => {
          const entry = cache.users[userId].sets[id];
          // 仅收集过期的缓存条目
          if (!entry.timestamp || (Date.now() - entry.timestamp > QuestionSetCacheManager.CACHE_TTL)) {
            questionSetIdsToCheck.add(id);
          }
        });
      }
      
      // 从全局兑换记录收集
      cache.redeemed.forEach((id: string) => questionSetIdsToCheck.add(id));
      
      // 从全局访问权限收集
      Object.keys(cache.globalAccess).forEach((id: string) => questionSetIdsToCheck.add(id));
    } catch (e) {
      console.error('[QuestionSetCacheManager] 收集题库ID失败:', e);
    }
    
    return Array.from(questionSetIdsToCheck);
  },
  
  // 清除特定题库的缓存
  clearCache: (questionSetId: string) => {
    try {
      const cache = QuestionSetCacheManager.getCache();
      
      // 清除所有用户对该题库的缓存
      Object.keys(cache.users).forEach(userId => {
        if (cache.users[userId].sets[questionSetId]) {
          delete cache.users[userId].sets[questionSetId];
        }
      });
      
      // 从全局兑换记录中移除
      cache.redeemed = cache.redeemed.filter((id: string) => id !== questionSetId);
      
      // 从全局访问权限中移除
      if (cache.globalAccess[questionSetId]) {
        delete cache.globalAccess[questionSetId];
      }
      
      // 更新元数据
      cache.meta.lastUpdate = Date.now();
      
      // 保存缓存
      localStorage.setItem(QuestionSetCacheManager.STORAGE_KEY, JSON.stringify(cache));
      
      console.log(`[QuestionSetCacheManager] 已清除题库 ${questionSetId} 的缓存`);
    } catch (e) {
      console.error('[QuestionSetCacheManager] 清除缓存失败:', e);
    }
  },
  
  // 获取缓存状态统计
  getCacheStats: () => {
    try {
      const cache = QuestionSetCacheManager.getCache();
      const userCount = Object.keys(cache.users).length;
      
      let totalEntries = 0;
      let expiredEntries = 0;
      const now = Date.now();
      
      Object.keys(cache.users).forEach(userId => {
        const userSets = cache.users[userId].sets;
        const entries = Object.keys(userSets).length;
        totalEntries += entries;
        
        Object.keys(userSets).forEach(qsId => {
          const entry = userSets[qsId];
          if (entry.timestamp && (now - entry.timestamp > QuestionSetCacheManager.CACHE_TTL)) {
            expiredEntries++;
          }
        });
      });
      
      return {
        version: cache.meta.version,
        lastUpdate: new Date(cache.meta.lastUpdate).toISOString(),
        userCount,
        totalEntries,
        expiredEntries,
        freshEntries: totalEntries - expiredEntries,
        redeemedCount: cache.redeemed.length,
        globalAccessCount: Object.keys(cache.globalAccess).length
      };
    } catch (e) {
      console.error('[QuestionSetCacheManager] 获取缓存统计失败:', e);
      return { 
        version: 1,
        lastUpdate: new Date().toISOString(),
        userCount: 0, 
        totalEntries: 0, 
        expiredEntries: 0, 
        freshEntries: 0,
        redeemedCount: 0,
        globalAccessCount: 0
      };
    }
  }
};

// 在HomePage组件中添加useQuestionSets自定义Hook
const useQuestionSets = (userId: string | undefined, socket: any) => {
  const [questionSets, setQuestionSets] = useState<PreparedQuestionSet[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<{
    type: 'API_ERROR' | 'NETWORK_ERROR' | 'UNKNOWN_ERROR' | null;
    message: string;
    details?: any;
    originalError?: string;
    timestamp: number;
    usingCache?: boolean;
  } | null>(null);
  
  // 同步访问权限
  const synchronizeAccess = useCallback((userId: string, sets: PreparedQuestionSet[], socket: any) => {
    const paidSets = sets.filter(set => set.isPaid);
    
    // 如果有付费题库，检查访问权限
    if (paidSets.length > 0) {
      console.log('[HomePage] 检查付费题库访问权限');
      
      // 获取或创建设备ID
      let deviceId = localStorage.getItem('deviceId');
      if (!deviceId) {
        deviceId = `device_${Date.now()}_${Math.random().toString(36).substring(2, 9)}`;
        localStorage.setItem('deviceId', deviceId);
      }
      
      // 收集需要检查的题库ID
      const idsToCheck = new Set<string>();
      
      // 1. 添加付费题库ID
      paidSets.forEach(set => idsToCheck.add(set.id));
      
      // 2. 添加来自缓存的ID
      const cachedIds = QuestionSetCacheManager.collectQuestionSetIdsToCheck(userId);
      cachedIds.forEach(id => idsToCheck.add(id));
      
      const finalIdsToCheck = Array.from(idsToCheck);
      
      // 发送批量检查请求
      if (finalIdsToCheck.length > 0) {
        console.log(`[HomePage] 发送批量访问权限检查请求, 共 ${finalIdsToCheck.length} 个题库`);
        socket.emit('questionSet:checkAccessBatch', {
          userId,
          questionSetIds: finalIdsToCheck,
          deviceId,
          source: 'homepage_sync'
        });
      }
      
      // 发送设备同步请求
      socket.emit('user:requestDeviceSync', {
        userId,
        deviceId,
        deviceInfo: {
          userAgent: navigator.userAgent,
          timestamp: Date.now(),
          page: 'homePage'
        }
      });
    }
  }, []);
  
  // 预处理题库数据，统一处理访问类型
  const prepareQuestionSets = useCallback((sets: BaseQuestionSet[]): PreparedQuestionSet[] => {
    return sets.map(set => {
      // 使用缓存管理器获取访问状态
      let { hasAccess, remainingDays, accessType } = userId ?
        QuestionSetCacheManager.getQuestionSetAccess(userId, set.id, set) :
        { hasAccess: !set.isPaid, remainingDays: null, accessType: 'trial' as AccessType };
      
      // 改进有效期检测逻辑
      // 1. 首先从题库本身获取有效期
      let validityPeriod = set.validityPeriod || 180;
      
      // 2. 如果题库没有提供，尝试从服务端配置获取
      if (!validityPeriod) {
        // 根据题库类型选择合适的默认值
        if (accessType === 'redeemed') {
          validityPeriod = (window as any)?.APP_CONFIG?.redeemedValidityPeriod || 30; // 兑换码默认30天
        } else if (accessType === 'paid') {
          validityPeriod = (window as any)?.APP_CONFIG?.paidValidityPeriod || 180; // 购买默认180天
        } else {
          validityPeriod = 180; // 通用默认值
        }
      }
      
      // 3. 处理特殊情况 - 过期题库
      if (remainingDays !== null && remainingDays <= 0) {
        hasAccess = false;
        accessType = 'expired';
      }
      
      // 4. 对于永久有效的题库，显示最大天数
      if (hasAccess && remainingDays === null && (accessType === 'paid' || accessType === 'redeemed')) {
        const isPermanent = (set as any).metadata?.permanent || false;
        remainingDays = isPermanent ? 36500 : validityPeriod; // 约100年或使用有效期
      }
      
      return {
        ...set,
        hasAccess,
        accessType,
        remainingDays,
        validityPeriod
      };
    });
  }, [userId]);
  
  // 获取题库列表
  const fetchQuestionSets = useCallback(async (forceRefresh = false) => {
    try {
      setLoading(true);
      
      // 使用cacheDuration策略，默认10分钟缓存
      const response = await apiClient.get('/api/question-sets', undefined, { 
        cacheDuration: QuestionSetCacheManager.CACHE_TTL, 
        forceRefresh 
      });
      
      if (response && response.success) {
        // 预处理题库数据，使用统一的方法添加访问类型
        const preparedSets = prepareQuestionSets(response.data);
        setQuestionSets(preparedSets);
        setError(null);
        
        // 如果用户已登录，并且有socket连接，检查访问权限
        if (userId && socket) {
          synchronizeAccess(userId, preparedSets, socket);
        }
      } else {
        // 改进错误处理 - 增加明确的错误类型和描述
        const errorMessage = response?.message || '获取题库列表失败，请稍后重试';
        console.error('[HomePage] 获取题库列表错误:', {
          status: response?.status,
          message: errorMessage,
          responseData: response?.data,
          timestamp: new Date().toISOString()
        });
        setError({
          type: 'API_ERROR',
          message: errorMessage,
          details: response?.data,
          timestamp: Date.now()
        });
      }
    } catch (error) {
      // 增强错误处理 - 分类网络错误和其他错误
      const isNetworkError = error instanceof Error && 
        (error.message.includes('network') || error.message.includes('fetch'));
      
      console.error('[HomePage] 获取题库列表失败:', error, isNetworkError ? '网络错误' : '其他错误');
      
      setError({
        type: isNetworkError ? 'NETWORK_ERROR' : 'UNKNOWN_ERROR',
        message: isNetworkError ? 
          '网络连接错误，请检查您的网络连接并稍后重试' : 
          '获取题库列表时出现未知错误，请稍后重试',
        originalError: error instanceof Error ? error.message : String(error),
        timestamp: Date.now()
      });
      
      // 如果是网络错误，尝试使用本地缓存数据
      if (isNetworkError) {
        try {
          const cache = QuestionSetCacheManager.getCache();
          const cachedSets: BaseQuestionSet[] = [];
          
          // 从缓存中收集题库数据
          if (userId && cache.users[userId]) {
            Object.keys(cache.users[userId].sets).forEach(questionSetId => {
              const cachedSet = cache.users[userId].sets[questionSetId];
              if (cachedSet && !cachedSets.some(s => s.id === questionSetId)) {
                cachedSets.push({
                  id: questionSetId,
                  title: `缓存题库 ${questionSetId.substring(0, 8)}...`,
                  description: '这是从本地缓存加载的题库数据，可能不是最新的。',
                  category: '缓存数据',
                  icon: 'default-icon',
                  isPaid: true,
                  hasAccess: cachedSet.hasAccess,
                  price: null,
                  trialQuestions: null,
                  remainingDays: cachedSet.remainingDays,
                  isFeatured: false,
                  createdAt: new Date(),
                  updatedAt: new Date(),
                  validityPeriod: 180 // 确保此字段有值
                });
              }
            });
          }
          
          if (cachedSets.length > 0) {
            const preparedSets = prepareQuestionSets(cachedSets);
            setQuestionSets(preparedSets);
            // 修复prev类型错误
            setError((prev) => {
              if (!prev) return {
                type: 'NETWORK_ERROR',
                message: '网络连接错误 (使用本地缓存数据显示)',
                timestamp: Date.now(),
                usingCache: true
              };
              
              return {
                ...prev,
                message: prev.message + ' (使用本地缓存数据显示)',
                usingCache: true
              };
            });
          }
        } catch (cacheError) {
          console.error('[HomePage] 使用缓存数据失败:', cacheError);
        }
      }
    } finally {
      setLoading(false);
    }
  }, [userId, socket, prepareQuestionSets, synchronizeAccess]);
  
  // 统一的全局事件监听器设置
  useEffect(() => {
    // 处理全局权限变更事件
    const handleAccessChanged = (e: Event) => {
      try {
        const customEvent = e as CustomEvent;
        const { questionSetId, hasAccess, remainingDays, source } = customEvent.detail || {};
        
        console.log(`[HomePage] 收到全局访问权限变更事件: ${questionSetId}, hasAccess=${hasAccess}, source=${source}`);
        
        if (questionSetId && hasAccess !== undefined) {
          // 1. 更新题库列表中的访问状态
          setQuestionSets(prev => 
            prev.map(set => 
              String(set.id).trim() === String(questionSetId).trim() 
                ? { 
                    ...set, 
                    hasAccess, 
                    remainingDays: remainingDays !== undefined ? remainingDays : set.remainingDays,
                    accessType: source === 'redeem' ? 'redeemed' : 'paid' 
                  } 
                : set
            )
          );
          
          // 2. 如果是当前用户，保存到缓存
          if (userId) {
            QuestionSetCacheManager.saveAccessToCache(
              userId, 
              questionSetId, 
              hasAccess, 
              remainingDays
            );
          }
        }
      } catch (e) {
        console.error('[HomePage] 处理全局访问权限变更事件失败:', e);
      }
    };
    
    // 处理题库刷新事件
    const handleRefreshRequest = () => {
      console.log('[HomePage] 收到刷新请求');
      fetchQuestionSets(true); // 强制刷新
    };
    
    // 注册事件监听器
    window.addEventListener('questionSet:accessChanged', handleAccessChanged);
    window.addEventListener('questionSets:refresh', handleRefreshRequest);
    
    // 清理函数
    return () => {
      window.removeEventListener('questionSet:accessChanged', handleAccessChanged);
      window.removeEventListener('questionSets:refresh', handleRefreshRequest);
    };
  }, [fetchQuestionSets, userId]);
  
  // 修改useQuestionSets hook中的useEffect部分，优化定时刷新
  // 组件挂载和用户登录状态变化时的数据获取
  useEffect(() => {
    // 初始化加载数据
    fetchQuestionSets();
    
    // 配置基于WebSocket的更新策略而非定时轮询
    if (userId && socket) {
      // 注册获取题库更新的socket事件处理
      socket.on('questionSet:updated', (data: any) => {
        console.log('[HomePage] 收到题库更新通知:', data);
        if (data && data.questionSetId) {
          // 选择性更新单个题库而非重新获取全部
          apiClient.get(`/api/question-sets/${data.questionSetId}`)
            .then(response => {
              if (response && response.success) {
                setQuestionSets(prev => {
                  return prev.map(set => 
                    set.id === data.questionSetId 
                      ? { ...prepareQuestionSets([response.data])[0] } 
                      : set
                  );
                });
              }
            })
            .catch(err => console.error('[HomePage] 更新单个题库失败:', err));
        }
      });
      
      // 注册批量更新通知
      socket.on('questionSets:batchUpdated', () => {
        console.log('[HomePage] 收到批量题库更新通知');
        fetchQuestionSets(true);
      });
      
      // 定期检查socket连接状态，如果断开则使用备用的轮询策略
      const connectionChecker = setInterval(() => {
        if (!socket.connected) {
          console.log('[HomePage] Socket连接断开，使用备用轮询刷新');
          fetchQuestionSets(true);
        }
      }, QuestionSetCacheManager.CACHE_TTL);
      
      // 清理函数
      return () => {
        socket.off('questionSet:updated');
        socket.off('questionSets:batchUpdated');
        clearInterval(connectionChecker);
      };
    } else {
      // 如果没有socket连接，回退到基础的定时刷新策略
      // 但使用更智能的刷新间隔（使用缓存TTL的两倍，避免频繁刷新）
      const refreshInterval = setInterval(() => {
        console.log('[HomePage] 定时刷新题库列表（备用策略）');
        fetchQuestionSets(true);
      }, QuestionSetCacheManager.CACHE_TTL * 2);
      
      return () => clearInterval(refreshInterval);
    }
  }, [fetchQuestionSets, userId, socket, prepareQuestionSets]);
  
  // 设备同步和ID生成
  useEffect(() => {
    // 设备ID管理
    let deviceId = localStorage.getItem('deviceId');
    if (!deviceId) {
      deviceId = `device_${Date.now()}_${Math.random().toString(36).substring(2, 9)}`;
      localStorage.setItem('deviceId', deviceId);
    }
    
    // 仅在用户登录且有socket时执行
    if (userId && socket) {
      // 发送设备同步请求
      socket.emit('user:requestDeviceSync', {
        userId,
        deviceId,
        deviceInfo: {
          userAgent: navigator.userAgent,
          timestamp: Date.now(),
          page: 'homePage',
          cacheStats: QuestionSetCacheManager.getCacheStats()
        }
      });
    }
  }, [userId, socket]);
  
  return {
    questionSets,
    loading,
    error,
    refreshQuestionSets: fetchQuestionSets,
    prepareQuestionSets
  };
};

const HomePage: React.FC = () => {
  const { user, isAdmin } = useUser();
  const { socket } = useSocket();
  const { progressStats } = useUserProgress();
  const [activeCategory, setActiveCategory] = useState<string>('all');
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [homeContent, setHomeContent] = useState<HomeContentData>(defaultHomeContent);
  const [showPaymentModal, setShowPaymentModal] = useState(false);
  const [selectedQuestionSet, setSelectedQuestionSet] = useState<PreparedQuestionSet | null>(null);
  const navigate = useNavigate();
  const [recentlyUpdatedSets, setRecentlyUpdatedSets] = useState<{[key: string]: number}>({});
  const [searchTerm, setSearchTerm] = useState<string>('');
  const [recommendedSets, setRecommendedSets] = useState<PreparedQuestionSet[]>([]);

  // 使用自定义Hook管理题库
  const { 
    questionSets, 
    loading, 
    error, 
    refreshQuestionSets 
  } = useQuestionSets(user?.id, socket);

  // 设置错误信息
  useEffect(() => {
    if (error) {
      setErrorMessage(error.message);
    }
  }, [error]);

  // 处理推荐题库
  useEffect(() => {
    if (questionSets.length > 0) {
      setRecommendedSets(getRecommendedSets());
    }
  }, [questionSets]);

  // 获取推荐题库
  const getRecommendedSets = useCallback(() => {
    return questionSets.filter(set => set.isFeatured).slice(0, 3);
  }, [questionSets]);

  // 处理兑换成功事件
  useEffect(() => {
    const handleRedeemSuccess = (e: Event) => {
      try {
        const customEvent = e as CustomEvent;
        
        // 优先使用 questionSetId，兼容旧版本的 quizId
        const questionSetId = customEvent.detail?.questionSetId || customEvent.detail?.quizId;
        
        // 从事件中获取剩余天数，如果不存在则使用默认值
        const remainingDays = customEvent.detail?.remainingDays || customEvent.detail?.validityPeriod || 30;
        
        console.log('[HomePage] 接收到兑换码成功事件:', { questionSetId, remainingDays });
        
        if (questionSetId) {
          // 更新题库列表状态
          if (user?.id) {
            // 保存到缓存
            QuestionSetCacheManager.saveAccessToCache(
              user.id, 
              questionSetId, 
              true, 
              remainingDays
            );
          }
          
          // 动画效果处理
          setRecentlyUpdatedSets(prev => ({
            ...prev,
            [questionSetId]: Date.now() 
          }));
          
          // 触发刷新事件
          const refreshEvent = new CustomEvent('questionSets:refresh');
          window.dispatchEvent(refreshEvent);
        }
      } catch (e) {
        console.error('[HomePage] 处理兑换成功事件失败:', e);
      }
    };
    
    // 注册事件监听器
    window.addEventListener('redeem:success', handleRedeemSuccess);
    
    // 清理函数
    return () => {
      window.removeEventListener('redeem:success', handleRedeemSuccess);
    };
  }, [user]);

  // 在HomePage组件中添加对应的事件监听
  useEffect(() => {
    const handleRecentlyUpdated = (e: Event) => {
      const customEvent = e as CustomEvent;
      const { questionSetId, timestamp } = customEvent.detail || {};
      
      if (questionSetId) {
        setRecentlyUpdatedSets((prev) => ({
          ...prev,
          [questionSetId]: timestamp || Date.now()
        }));
      }
    };
    
    window.addEventListener('questionSet:recentlyUpdated', handleRecentlyUpdated);
    
    return () => {
      window.removeEventListener('questionSet:recentlyUpdated', handleRecentlyUpdated);
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

  // Start Quiz处理逻辑（保持不变）
  const handleStartQuiz = (questionSet: PreparedQuestionSet) => {
    // 免费题库，直接开始
    if (!questionSet.isPaid) {
      navigate(`/quiz/${questionSet.id}`);
      return;
    }
    
    // 未登录用户，显示登录弹窗
    if (!user) {
      sessionStorage.setItem('redirectQuestionSetId', questionSet.id);
      
      const loginEvent = new CustomEvent('auth:showLogin', { 
        detail: { 
          redirect: false,
          returnUrl: `/quiz/${questionSet.id}`,
          message: '登录后即可开始学习付费题库'
        } 
      });
      window.dispatchEvent(loginEvent);
      return;
    }
    
    // 已购买，直接开始
    if (questionSet.hasAccess) {
      navigate(`/quiz/${questionSet.id}`);
      return;
    }
    
    // 有试用题目，可以开始试用
    if (questionSet.trialQuestions && questionSet.trialQuestions > 0) {
      navigate(`/quiz/${questionSet.id}`);
      return;
    }
    
    // 无试用题目，显示购买提示
    setSelectedQuestionSet(questionSet);
    setShowPaymentModal(true);
  };

  // 将题库按类型分组
  const getCategorizedQuestionSets = useCallback(() => {
    const filtered = getFilteredQuestionSets();
    
    // 按访问类型分组
    const freeQuestionSets = filtered.filter(set => !set.isPaid);
    const purchasedQuestionSets = filtered.filter(set => 
      (set.accessType === 'paid' || set.accessType === 'redeemed') && 
      set.remainingDays && set.remainingDays > 0
    );
    
    // 排除已归类为purchased的题库，避免重复显示
    const purchasedIds = purchasedQuestionSets.map(set => set.id);
    const paidQuestionSets = filtered.filter(set => 
      set.isPaid && set.accessType === 'trial' && !purchasedIds.includes(set.id)
    );
    
    const expiredQuestionSets = filtered.filter(set => 
      set.accessType === 'expired' || (set.remainingDays !== null && set.remainingDays <= 0)
    );
    
    return {
      free: freeQuestionSets,
      paid: paidQuestionSets,
      purchased: purchasedQuestionSets,
      expired: expiredQuestionSets
    };
  }, [getFilteredQuestionSets]);

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="text-xl">正在加载...</div>
      </div>
    );
  }

  return (
    <div className={`${homeContent.theme === 'dark' ? 'bg-gray-800' : 'bg-gray-50'} min-h-screen py-6 flex flex-col justify-center sm:py-12`}>
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
              {recommendedSets.map(set => {
                const isSetRecentlyUpdated = !!(recentlyUpdatedSets[set.id] && 
                  (Date.now() - recentlyUpdatedSets[set.id] < 5000));
                return (
                  <BaseCard 
                    key={set.id} 
                    set={{...set, accessType: set.accessType}} 
                    onStartQuiz={handleStartQuiz}
                    isRecentlyUpdated={isSetRecentlyUpdated}
                  />
                );
              })}
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
                    {categorized.purchased.map(set => {
                      const isSetRecentlyUpdated = !!(recentlyUpdatedSets[set.id] && 
                        (Date.now() - recentlyUpdatedSets[set.id] < 5000));
                      return (
                        <BaseCard
                          key={set.id}
                          set={set}
                          onStartQuiz={handleStartQuiz}
                          isRecentlyUpdated={isSetRecentlyUpdated}
                        />
                      );
                    })}
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
                    {categorized.free.map(set => {
                      const isSetRecentlyUpdated = !!(recentlyUpdatedSets[set.id] && 
                        (Date.now() - recentlyUpdatedSets[set.id] < 5000));
                      return (
                        <BaseCard
                          key={set.id}
                          set={set}
                          onStartQuiz={handleStartQuiz}
                          isRecentlyUpdated={isSetRecentlyUpdated}
                        />
                      );
                    })}
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
                    {categorized.paid.map(set => {
                      const isSetRecentlyUpdated = !!(recentlyUpdatedSets[set.id] && 
                        (Date.now() - recentlyUpdatedSets[set.id] < 5000));
                      return (
                        <BaseCard
                          key={set.id}
                          set={set}
                          onStartQuiz={handleStartQuiz}
                          isRecentlyUpdated={isSetRecentlyUpdated}
                        />
                      );
                    })}
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
                    {categorized.expired.map(set => {
                      const isSetRecentlyUpdated = !!(recentlyUpdatedSets[set.id] && 
                        (Date.now() - recentlyUpdatedSets[set.id] < 5000));
                      return (
                        <BaseCard
                          key={set.id}
                          set={set}
                          onStartQuiz={handleStartQuiz}
                          isRecentlyUpdated={isSetRecentlyUpdated}
                        />
                      );
                    })}
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

// 修改显示进度的部分
const renderProgressBar = (set: PreparedQuestionSet) => {
  if (!set.remainingDays || set.remainingDays <= 0) return null;
  
  const percentage = Math.min(100, (set.remainingDays / (set.validityPeriod || 180)) * 100);
  
  return (
    <div className="mt-4 pt-3 border-t border-gray-100">
      <div className="mb-1 flex items-center justify-between">
        <span className="text-xs text-gray-500">有效期</span>
        <span className="text-xs font-medium text-gray-700">剩余 {set.remainingDays} 天</span>
      </div>
      <div className="w-full bg-gray-100 rounded-full h-2 overflow-hidden">
        <div 
          className="bg-gradient-to-r from-green-300 to-green-500 h-2 rounded-full transition-all duration-500" 
          style={{ width: `${percentage}%` }}
        />
      </div>
    </div>
  );
};

// 渲染有效期徽章的函数
const renderValidityBadge = (remainingDays: number | null) => {
  if (remainingDays === null) return null;
  
  const getBadgeColor = (days: number) => {
    if (days <= 0) return 'bg-red-100 text-red-800';
    if (days <= 7) return 'bg-orange-100 text-orange-800';
    return 'bg-green-100 text-green-800';
  };

  const getBadgeText = (days: number) => {
    if (days <= 0) return '已过期';
    if (days <= 7) return `剩余${days}天`;
    return `剩余${days}天`;
  };

  return (
    <span className={`px-2 py-1 text-xs font-semibold rounded-full ${getBadgeColor(remainingDays)}`}>
      {getBadgeText(remainingDays)}
    </span>
  );
};

// 基础卡片组件
interface BaseCardProps {
  set: PreparedQuestionSet;
  onStartQuiz: (set: PreparedQuestionSet) => void;
  isRecentlyUpdated?: boolean; // 新增参数
}

const BaseCard: React.FC<BaseCardProps> = ({ set, onStartQuiz, isRecentlyUpdated = false }) => {
  const { progressStats } = useUserProgress();
  const stats = progressStats?.[set.id];
  const progress = stats ? (stats.completedQuestions / stats.totalQuestions) * 100 : 0;
  const accuracy = stats ? (stats.correctAnswers / stats.completedQuestions) * 100 : 0;
  
  // 注意：此处不再从localStorage读取兑换状态，而是完全依赖set.accessType
  const isRedeemed = set.accessType === 'redeemed';

  return (
    <div 
      className={`bg-white backdrop-blur-sm bg-opacity-80 rounded-xl shadow-lg overflow-hidden 
      hover:shadow-xl hover:translate-y-[-5px] transition-all duration-300 transform 
      border border-gray-100 hover:border-blue-200
      ${isRecentlyUpdated ? 'ring-2 ring-blue-400 scale-[1.02]' : ''}`}
      style={{
        animation: isRecentlyUpdated ? 'pulse 2s ease-in-out' : 'none',
      }}
    >
      {/* 闪光效果顶部条 */}
      <div className="h-1.5 bg-gradient-to-r from-blue-500 via-purple-500 to-indigo-500"></div>
      
      {isRecentlyUpdated && (
        <div className="absolute -top-1 -right-1 z-10">
          <span className="flex h-4 w-4">
            <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-blue-400 opacity-75"></span>
            <span className="relative inline-flex rounded-full h-4 w-4 bg-blue-500 text-white flex items-center justify-center">
              <svg xmlns="http://www.w3.org/2000/svg" className="h-3 w-3" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
              </svg>
            </span>
          </span>
        </div>
      )}
    
      <div className="absolute top-3 right-3 flex gap-1 z-10">
        {set.accessType === 'paid' && (
          <>
            <span className="px-2 py-1 text-xs font-semibold text-green-800 bg-green-100 rounded-full shadow-sm backdrop-blur-sm">
              已购买
            </span>
            {renderValidityBadge(set.remainingDays)}
          </>
        )}
        {set.accessType === 'redeemed' && (
          <>
            <span className="px-2 py-1 text-xs font-semibold text-blue-800 bg-blue-100 rounded-full shadow-sm backdrop-blur-sm">
              已兑换
            </span>
            {renderValidityBadge(set.remainingDays)}
          </>
        )}
        {set.accessType === 'expired' && (
          <span className="px-2 py-1 text-xs font-semibold text-red-800 bg-red-100 rounded-full shadow-sm backdrop-blur-sm">
            已过期
          </span>
        )}
        {set.accessType === 'trial' && !set.isPaid && (
          <span className="px-2 py-1 text-xs font-semibold text-blue-800 bg-blue-100 rounded-full shadow-sm backdrop-blur-sm">
            免费
          </span>
        )}
        {set.accessType === 'trial' && set.isPaid && !isRedeemed && (
          <span className="px-2 py-1 text-xs font-semibold text-yellow-800 bg-yellow-100 rounded-full shadow-sm backdrop-blur-sm flex items-center">
            <svg className="h-3 w-3 mr-1" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8c-1.657 0-3 .895-3 2s1.343 2 3 2 3 .895 3 2-1.343 2-3 2m0-8c1.11 0 2.08.402 2.599 1M12 8V7m0 1v8m0 0v1m0-1c-1.11 0-2.08-.402-2.599-1M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
            </svg>
            {set.price ? `¥${set.price}` : '付费题库'}
          </span>
        )}
      </div>

      <div className="p-6">
        <div className="mb-4 flex items-center space-x-3">
          <div className="bg-gradient-to-br from-blue-100 to-indigo-100 p-2 rounded-lg">
            <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5 text-blue-600" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
            </svg>
          </div>
          <h3 className="text-xl font-bold text-gray-800 flex-1">
            {set.title}
          </h3>
        </div>
        
        <p className="text-gray-600 text-sm line-clamp-2 h-10 mb-4">
          {set.description}
        </p>

        <div className="flex flex-col space-y-3">
          <div className="flex items-center justify-between text-sm bg-gray-50 p-2.5 rounded-lg border border-gray-100">
            <div className="flex items-center">
              <svg className="h-4 w-4 mr-2 text-blue-500" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8.228 9c.549-1.165 2.03-2 3.772-2 2.21 0 4 1.343 4 3 0 1.4-1.278 2.575-3.006 2.907-.542.104-.994.54-.994 1.093m0 3h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
              </svg>
              <span className="text-gray-700 font-medium">
                题目数量: <b>{calculateQuestionCount(set)}</b>
              </span>
            </div>
            
            <div className="flex items-center">
              <span className={`inline-block w-2 h-2 rounded-full mr-1.5 ${
                isRedeemed ? 'bg-blue-500' :
                set.accessType === 'paid' ? 'bg-green-500' : 
                'bg-gray-400'
              }`}></span>
              <span className="text-gray-600">{set.category}</span>
            </div>
          </div>

          {stats && (
            <div className="mt-2">
              <div className="grid grid-cols-2 gap-2 mb-2">
                <div className="bg-gray-50 p-2 rounded-lg border border-gray-100 flex flex-col items-center">
                  <span className="text-xs text-gray-500 mb-1">进度</span>
                  <div className="flex items-center">
                    <svg className="h-3.5 w-3.5 mr-1 text-blue-500" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 7h8m0 0v8m0-8l-8 8-4-4-6 6" />
                    </svg>
                    <span className="text-sm font-bold">{Math.round(progress)}%</span>
                  </div>
                </div>
                <div className="bg-gray-50 p-2 rounded-lg border border-gray-100 flex flex-col items-center">
                  <span className="text-xs text-gray-500 mb-1">正确率</span>
                  <div className="flex items-center">
                    <svg className="h-3.5 w-3.5 mr-1 text-green-500" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
                    </svg>
                    <span className="text-sm font-bold">{Math.round(accuracy)}%</span>
                  </div>
                </div>
              </div>
              <div className="w-full bg-gray-100 rounded-full h-1.5 overflow-hidden mt-1">
                <div
                  className="bg-gradient-to-r from-blue-400 to-blue-600 h-1.5 rounded-full transition-all duration-500"
                  style={{ width: `${progress}%` }}
                />
              </div>
            </div>
          )}

          {renderProgressBar(set)}

          <button
            onClick={() => onStartQuiz(set)}
            className={`mt-4 w-full py-2.5 px-4 rounded-lg text-white font-medium 
              flex items-center justify-center transition-all duration-300
              transform hover:translate-y-[-2px] hover:shadow-md
              ${
                set.accessType === 'expired'
                  ? 'bg-gray-400 cursor-not-allowed'
                  : (set.accessType === 'trial' && set.isPaid && !isRedeemed)
                  ? 'bg-gradient-to-r from-yellow-400 to-yellow-600 hover:from-yellow-500 hover:to-yellow-700'
                  : 'bg-gradient-to-r from-blue-500 to-indigo-600 hover:from-blue-600 hover:to-indigo-700'
              }`}
            disabled={set.accessType === 'expired'}
          >
            {set.accessType === 'expired' ? (
              '题库已过期'
            ) : (set.accessType === 'trial' && set.isPaid && !isRedeemed) ? (
              <>
                <svg className="h-5 w-5 mr-1.5" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 15l-2 5L9 9l11 4-5 2zm0 0l5 5M7.188 2.239l.777 2.897M5.136 7.965l-2.898-.777M13.95 4.05l-2.122 2.122m-5.657 5.656l-2.12 2.122" />
                </svg>
                免费试用
              </>
            ) : (
              <>
                <svg className="h-5 w-5 mr-1.5" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M14.752 11.168l-3.197-2.132A1 1 0 0010 9.87v4.263a1 1 0 001.555.832l3.197-2.132a1 1 0 000-1.664z" />
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                </svg>
                {stats ? '继续练习' : '开始练习'}
              </>
            )}
          </button>
        </div>
      </div>
    </div>
  );
};

export default HomePage;