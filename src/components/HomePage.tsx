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

const HomePage: React.FC = () => {
  const { user, isAdmin, syncAccessRights } = useUser();
  const { socket } = useSocket();
  const { progressStats, fetchUserProgress } = useUserProgress();
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

  // 切换分类
  const handleCategoryChange = (category: string) => {
    setActiveCategory(category);
  };

  // Add helper functions for localStorage access status cache
  const getLocalAccessCache = () => {
    try {
      const raw = localStorage.getItem('questionSetAccessCache') || '{}';
      return JSON.parse(raw);
    } catch (e) {
      console.error('[HomePage] 读取缓存失败:', e);
      return {};
    }
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

  // 缓存访问权限到本地存储
  const saveAccessToLocalStorage = useCallback((questionSetId: string, hasAccess: boolean, remainingDays?: number | null) => {
    try {
      if (!user?.id || !questionSetId) return;
      
      const cache = getLocalAccessCache();
      if (!cache[user.id]) cache[user.id] = {};
      
      // 保存访问权限信息
      cache[user.id][questionSetId] = {
        hasAccess,
        remainingDays,
        timestamp: Date.now()
      };
      
      localStorage.setItem('questionSetAccessCache', JSON.stringify(cache));
      console.log(`[saveAccessToLocalStorage] 已保存题库 ${questionSetId} 的访问权限 (剩余天数: ${remainingDays})`);
    } catch (error) {
      console.error('[saveAccessToLocalStorage] 保存到缓存失败:', error);
    }
  }, [user?.id]);

  // 获取题库列表的函数 - 优化缓存策略，支持强制刷新
  const fetchQuestionSets = useCallback(async (options: { forceFresh?: boolean } = {}) => {
    try {
      setLoading(true);
      console.log(`[fetchQuestionSets] 开始获取题库列表${options.forceFresh ? '(强制刷新)' : ''}`);
      
      // 如果用户已登录且需要实时数据，则不使用缓存
      const cacheDuration = (user?.id && options.forceFresh) ? 0 : 600000; // 10分钟缓存或不缓存
      
      // 添加时间戳和用户ID参数，确保针对当前用户的实时数据
      const params = user?.id ? { 
        userId: user.id,
        _t: Date.now() // 添加时间戳避免缓存
      } : undefined;
      
      const response = await apiClient.get('/api/question-sets', params, { 
        cacheDuration: cacheDuration
      });
      
      if (response && response.success) {
        console.log(`[fetchQuestionSets] 成功获取 ${response.data.length} 个题库数据`);
        
        // 使用优化后的prepareQuestionSets处理题库数据
        const preparedSets = prepareQuestionSets(response.data);
        console.log(`[fetchQuestionSets] 题库数据处理完成，设置状态`);
        setQuestionSets(preparedSets);
        
        // 设置推荐题库
        setRecommendedSets(preparedSets.filter(set => set.isFeatured).slice(0, 3));
        
        return preparedSets;
      } else {
        // 明确处理请求成功但返回错误的情况
        console.error('[fetchQuestionSets] 获取题库列表返回错误:', response?.message || '未知错误');
        setErrorMessage(response?.message || '获取题库列表失败，请稍后重试');
        return null;
      }
    } catch (error) {
      console.error('[fetchQuestionSets] 获取题库列表失败:', error);
      setErrorMessage('获取题库列表失败，请稍后重试');
      return null;
    } finally {
      setLoading(false);
    }
  }, [user?.id]);

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
      const cacheKey = 'questionSetAccessCache';
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
    
    // 监听权限更新事件
    const handleAccessUpdate = (data: any) => {
      // 过滤不是当前用户的事件
      if (data.userId !== user.id) return;
      
      console.log(`[HomePage] 收到题库 ${data.questionSetId} 权限更新:`, data);
      
      // 更新本地缓存
      saveAccessToLocalStorage(
        data.questionSetId, 
        data.hasAccess, 
        data.remainingDays
      );
      
      // 立即更新题库的UI状态
      setQuestionSets(prevSets => 
        prevSets.map(set => 
          set.id === data.questionSetId 
            ? {
                ...set,
                hasAccess: data.hasAccess,
                accessType: data.accessType || (data.hasAccess ? 'paid' : 'trial'),
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
      if (data.userId !== user.id || !Array.isArray(data.results)) return;
      
      console.log(`[HomePage] 收到批量访问检查结果: ${data.results.length} 个题库`);
      
      // 更新题库状态
      setQuestionSets(prevSets => {
        return prevSets.map(set => {
          // 在结果中查找当前题库
          const result = data.results.find((r: any) => 
            String(r.questionSetId).trim() === String(set.id).trim()
          );
          
          // 如果找到了结果且有访问权限，更新题库状态
          if (result && result.hasAccess) {
            console.log(`[HomePage] 批量检查: 题库 ${set.title} (${set.id}) 有访问权限`);
            
            // 标记为最近更新，实现视觉反馈
            setRecentlyUpdatedSets(prev => ({
              ...prev,
              [set.id]: Date.now()
            }));
            
            // 保存到本地缓存
            saveAccessToLocalStorage(set.id, true, result.remainingDays);
            
            // 返回更新后的题库对象
            return {
              ...set,
              hasAccess: true,
              accessType: result.paymentMethod === 'redeem' ? 'redeemed' : 'paid',
              remainingDays: result.remainingDays || set.remainingDays
            };
          }
          
          return set;
        });
      });
    };
    
    // 注册Socket事件监听
    socket.on('questionSet:accessUpdate', handleAccessUpdate);
    socket.on('user:deviceSync', handleDeviceSync);
    socket.on('questionSet:batchAccessResult', handleBatchAccessResult);
    
    // 主动请求批量检查所有付费题库的访问权限
    setTimeout(() => {
      const questionSetIds = questionSets
        .filter(set => set.isPaid)
        .map(set => set.id);
      
      if (questionSetIds.length > 0) {
        console.log(`[HomePage] Socket连接后请求批量检查 ${questionSetIds.length} 个付费题库`);
        socket.emit('questionSet:checkAccessBatch', {
          userId: user.id,
          questionSetIds
        });
      }
    }, 1000);
    
    return () => {
      // 清理事件监听
      socket.off('questionSet:accessUpdate', handleAccessUpdate);
      socket.off('user:deviceSync', handleDeviceSync);
      socket.off('questionSet:batchAccessResult', handleBatchAccessResult);
    };
  }, [socket, user?.id, questionSets, syncAccessRights, fetchQuestionSets, saveAccessToLocalStorage]);

  // 从localStorage获取已兑换题库ID列表的辅助函数
  const getRedeemedQuestionSetIds = () => {
    try {
      const redeemedStr = localStorage.getItem('redeemedQuestionSetIds');
      if (redeemedStr) {
        return JSON.parse(redeemedStr) || [];
      }
    } catch (e) {
      console.error('[HomePage] 解析localStorage兑换记录失败', e);
    }
    return [];
  };

  // 修改预处理题库数据的函数，优先使用UserContext中的权限信息
  const prepareQuestionSets = useCallback((sets: BaseQuestionSet[]): PreparedQuestionSet[] => {
    // 获取用户购买记录映射 - 优先使用这个作为权限来源
    const userPurchasesMap = new Map();
    if (user?.purchases && user.purchases.length > 0) {
      const now = new Date();
      
      user.purchases.forEach(purchase => {
        if (!purchase.questionSetId) return;
        
        const qsId = String(purchase.questionSetId).trim();
        
        // 处理过期日期
        const expiryDate = purchase.expiryDate ? new Date(purchase.expiryDate) : null;
        const isExpired = expiryDate && expiryDate <= now;
        const isActive = !isExpired && 
                        (purchase.status === 'active' || 
                         purchase.status === 'completed' || 
                         !purchase.status);
        
        // 计算剩余天数
        let remainingDays = null;
        if (expiryDate && !isExpired) {
          const diffTime = expiryDate.getTime() - now.getTime();
          remainingDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));
        }
        
        if (isActive) {
          userPurchasesMap.set(qsId, {
            hasAccess: true,
            remainingDays,
            accessType: purchase.paymentMethod === 'redeem' ? 'redeemed' : 'paid'
          });
        } else if (isExpired) {
          userPurchasesMap.set(qsId, {
            hasAccess: false,
            remainingDays: 0,
            accessType: 'expired'
          });
        }
      });
      
      console.log(`[prepareQuestionSets] 用户购买记录映射创建完成，共 ${userPurchasesMap.size} 条记录`);
    }
    
    // 检查localStorage中的兑换记录，作为辅助信息源
    const redeemedIds = getRedeemedQuestionSetIds();
    
    // 获取访问权限缓存，作为第三优先级的信息源
    const accessCache = getLocalAccessCache();
    const userAccessCache = user?.id ? (accessCache[user.id] || {}) : {};
    
    console.log(`[prepareQuestionSets] 处理 ${sets.length} 个题库, 用户缓存条目: ${Object.keys(userAccessCache).length}`);
    
    return sets.map(set => {
      const setId = String(set.id).trim();
      const isPaid = set.isPaid === true;
      
      // 默认为试用模式
      let accessType: AccessType = 'trial';
      let hasAccess = !isPaid; // 免费题库自动有访问权限
      let remainingDays: number | null = null;
      // 获取validityPeriod，或使用默认值
      const validityPeriod = set.validityPeriod || 180;
      
      // 1. 首先，优先检查用户购买记录 (来自UserContext，由syncAccessRights更新)
      if (userPurchasesMap.has(setId)) {
        const purchaseInfo = userPurchasesMap.get(setId);
        hasAccess = purchaseInfo.hasAccess;
        accessType = purchaseInfo.accessType;
        remainingDays = purchaseInfo.remainingDays;
        console.log(`[prepareQuestionSets] 题库 ${set.title} (${setId}) 从用户购买记录匹配: ${accessType}, 剩余天数: ${remainingDays}`);
      } 
      // 2. 其次，检查是否在兑换记录中
      else if (Array.isArray(redeemedIds) && redeemedIds.some(id => String(id).trim() === setId)) {
        hasAccess = true;
        accessType = 'redeemed';
        console.log(`[prepareQuestionSets] 题库 ${set.title} (${setId}) 从兑换记录匹配`);
      }
      // 3. 最后，检查本地缓存
      else if (userAccessCache[setId] && userAccessCache[setId].hasAccess) {
        hasAccess = true;
        remainingDays = userAccessCache[setId].remainingDays;
        // 根据剩余天数判断是已购买还是兑换的
        accessType = remainingDays ? 'paid' : 'redeemed';
        console.log(`[prepareQuestionSets] 题库 ${set.title} (${setId}) 从本地缓存匹配: ${accessType}, 剩余天数: ${remainingDays}`);
      }
      
      // 如果是免费题库，不论状态如何都应该可以访问
      if (!isPaid) {
        hasAccess = true;
        accessType = 'trial'; // 使用trial替代free，与AccessType枚举兼容
      }
      
      return {
        ...set,
        hasAccess,
        accessType,
        remainingDays,
        validityPeriod
      };
    });
  }, [user?.id, user?.purchases]);

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

  // 根据主题设置页面背景色
  const bgClass = homeContent.theme === 'dark' 
    ? 'min-h-screen bg-gray-800 py-6 flex flex-col justify-center sm:py-12 text-white' 
    : 'min-h-screen bg-gray-50 py-6 flex flex-col justify-center sm:py-12';

  // Add back the handleStartQuiz function
  const handleStartQuiz = (questionSet: PreparedQuestionSet) => {
    // 免费题库，直接开始
    if (!questionSet.isPaid) {
      navigate(`/quiz/${questionSet.id}`);
      return;
    }
    
    // 未登录用户，显示登录弹窗而非重定向到登录页
    if (!user) {
      // 保存当前题库ID，以便登录后返回
      sessionStorage.setItem('redirectQuestionSetId', questionSet.id);
      
      // 触发登录弹窗
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
    
    const { hasAccess } = getQuestionSetAccessStatus(questionSet);
    
    // 已购买，直接开始
    if (hasAccess) {
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

  // Add back the getQuestionSetAccessStatus function
  const getQuestionSetAccessStatus = (questionSet: BaseQuestionSet) => {
    // 如果是免费题库，直接返回有访问权限
    if (!questionSet.isPaid) {
      return { hasAccess: true, remainingDays: null };
    }
    
    // 如果用户未登录，返回无访问权限
    if (!user) {
      return { hasAccess: false, remainingDays: null };
    }

    // 直接使用题库的hasAccess属性(通过API或socket实时更新)
    if (questionSet.hasAccess !== undefined) {
      console.log(`[getQuestionSetAccessStatus] 题库 "${questionSet.title}" 有hasAccess字段:`, questionSet.hasAccess);
      
      // 检查是否已过期（remainingDays <= 0）
      if (questionSet.remainingDays !== undefined && questionSet.remainingDays !== null && questionSet.remainingDays <= 0) {
        console.log(`[getQuestionSetAccessStatus] 题库 "${questionSet.title}" 已过期:`, questionSet.remainingDays);
        return { hasAccess: false, remainingDays: 0 };
      }
      
      return { 
        hasAccess: questionSet.hasAccess, 
        remainingDays: questionSet.remainingDays || null 
      };
    }
    
    // 如果仍未设置hasAccess字段，则可能是初始状态，返回无访问权限
    // 稍后会通过API/Socket更新访问权限
    return { hasAccess: false, remainingDays: null };
  };

  // 在现有的useEffect中添加对推荐题库的处理
  useEffect(() => {
    if (questionSets.length > 0) {
      setRecommendedSets(getRecommendedSets());
    }
  }, [questionSets, getRecommendedSets]);

  // Add a new function to render the validity period badge
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
  }

  const BaseCard: React.FC<BaseCardProps> = ({ set, onStartQuiz }) => {
    const stats = progressStats[set.id];
    const progress = stats ? (stats.completedQuestions / stats.totalQuestions) * 100 : 0;
    const accuracy = stats ? (stats.correctAnswers / stats.completedQuestions) * 100 : 0;
    
    // 检查题库是否是最近更新的（用于添加动画效果）
    const isRecentlyUpdated = recentlyUpdatedSets[set.id] && 
      (Date.now() - recentlyUpdatedSets[set.id] < 5000); // 5秒内算最近更新
    
    // 检查是否已兑换
    const isRedeemed = React.useMemo(() => {
      try {
        const redeemedStr = localStorage.getItem('redeemedQuestionSetIds');
        if (!redeemedStr) return false;
        
        const redeemedIds = JSON.parse(redeemedStr);
        if (!Array.isArray(redeemedIds)) return false;
        
        return redeemedIds.some(id => 
          String(id).trim() === String(set.id).trim()
        );
      } catch (e) {
        console.error('检查兑换状态失败:', e);
        return false;
      }
    }, [set.id]);
    
    // 根据兑换状态和accessType确定显示状态
    const displayAsRedeemed = isRedeemed || set.accessType === 'redeemed';
    const displayAsPaid = set.accessType === 'paid';
    const displayAsExpired = set.accessType === 'expired';
    const displayAsTrial = !displayAsRedeemed && !displayAsPaid && !displayAsExpired;

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
          {displayAsPaid && (
            <>
              <span className="px-2 py-1 text-xs font-semibold text-green-800 bg-green-100 rounded-full shadow-sm backdrop-blur-sm">
                已购买
              </span>
              {renderValidityBadge(set.remainingDays)}
            </>
          )}
          {displayAsRedeemed && (
            <>
              <span className="px-2 py-1 text-xs font-semibold text-blue-800 bg-blue-100 rounded-full shadow-sm backdrop-blur-sm">
                已兑换
              </span>
              {renderValidityBadge(set.remainingDays)}
            </>
          )}
          {displayAsExpired && (
            <span className="px-2 py-1 text-xs font-semibold text-red-800 bg-red-100 rounded-full shadow-sm backdrop-blur-sm">
              已过期
            </span>
          )}
          {!set.isPaid && (
            <span className="px-2 py-1 text-xs font-semibold text-blue-800 bg-blue-100 rounded-full shadow-sm backdrop-blur-sm">
              免费
            </span>
          )}
          {set.isPaid && displayAsTrial && (
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
                  displayAsRedeemed ? 'bg-blue-500' :
                  displayAsPaid ? 'bg-green-500' : 
                  displayAsExpired ? 'bg-red-500' : 
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
              onClick={() => {
                // 根据当前状态确定传递给onStartQuiz的参数
                const updatedSet: PreparedQuestionSet = {
                  ...set,
                  hasAccess: displayAsRedeemed || displayAsPaid || !set.isPaid
                };
                onStartQuiz(updatedSet);
              }}
              className={`mt-4 w-full py-2.5 px-4 rounded-lg text-white font-medium 
                flex items-center justify-center transition-all duration-300
                transform hover:translate-y-[-2px] hover:shadow-md
                ${
                  displayAsExpired
                    ? 'bg-gray-400 cursor-not-allowed'
                    : (displayAsTrial && set.isPaid)
                    ? 'bg-gradient-to-r from-yellow-400 to-yellow-600 hover:from-yellow-500 hover:to-yellow-700'
                    : 'bg-gradient-to-r from-blue-500 to-indigo-600 hover:from-blue-600 hover:to-indigo-700'
                }`}
              disabled={displayAsExpired}
            >
              {displayAsExpired ? (
                '题库已过期'
              ) : (displayAsTrial && set.isPaid) ? (
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

  // 将题库按类型分组
  const getCategorizedQuestionSets = useCallback(() => {
    const filtered = getFilteredQuestionSets();
    
    // 检查localStorage中的兑换记录
    const getRedeemedQuestionSetIds = () => {
      try {
        const redeemedStr = localStorage.getItem('redeemedQuestionSetIds');
        if (redeemedStr) {
          return JSON.parse(redeemedStr) || [];
        }
      } catch (e) {
        console.error('解析localStorage兑换记录失败', e);
      }
      return [];
    };
    
    const redeemedIds = getRedeemedQuestionSetIds();
    
    // 按访问类型分组，添加对兑换记录的检查
    const freeQuestionSets = filtered.filter((set: any) => !set.isPaid);
    const purchasedQuestionSets = filtered.filter((set: any) => {
      // 已购买的情况
      const isPurchasedAndValid = (set.accessType === 'paid' || set.accessType === 'redeemed') && 
                                  set.remainingDays && set.remainingDays > 0;
      
      // 检查是否在兑换记录中
      const isRedeemed = Array.isArray(redeemedIds) && redeemedIds.some(id => 
        String(id).trim() === String(set.id).trim()
      );
      
      return isPurchasedAndValid || isRedeemed;
    });
    
    // 排除已归类为purchased的题库，避免重复显示
    const purchasedIds = purchasedQuestionSets.map((set: any) => set.id);
    const paidQuestionSets = filtered.filter((set: any) => 
      set.isPaid && set.accessType === 'trial' && !purchasedIds.includes(set.id)
    );
    
    const expiredQuestionSets = filtered.filter((set: any) => 
      set.accessType === 'expired' || (set.remainingDays !== null && set.remainingDays <= 0)
    );
    
    return {
      free: freeQuestionSets,
      paid: paidQuestionSets,
      purchased: purchasedQuestionSets,
      expired: expiredQuestionSets
    };
  }, [getFilteredQuestionSets]);

  // Add event listener for access rights updates
  useEffect(() => {
    const handleAccessRightsUpdate = (event: Event) => {
      const customEvent = event as CustomEvent;
      console.log('[HomePage] Received access rights update event:', customEvent.detail);
      
      // Only process if it's for the current user
      if (user?.id && customEvent.detail?.userId === user.id) {
        console.log('[HomePage] Refreshing question sets after access rights update');
        // Refresh question sets to reflect updated access rights
        fetchQuestionSets();
      }
    };
    
    window.addEventListener('accessRights:updated', handleAccessRightsUpdate);
    
    return () => {
      window.removeEventListener('accessRights:updated', handleAccessRightsUpdate);
    };
  }, [user?.id, fetchQuestionSets]);

  // Sync access rights when user logs in
  useEffect(() => {
    if (user?.id) {
      console.log('[HomePage] User logged in, syncing access rights');
      syncAccessRights().then(() => {
        console.log('[HomePage] Access rights synced, refreshing question sets');
        fetchQuestionSets();
      });
    }
  }, [user?.id, syncAccessRights, fetchQuestionSets]);

  // Listen for device sync events
  useEffect(() => {
    if (!socket || !user?.id) return;
    
    const handleDeviceSync = (data: any) => {
      if (data.userId === user.id) {
        console.log('[HomePage] Received device sync event, refreshing question sets');
        syncAccessRights().then(() => {
          fetchQuestionSets();
        });
      }
    };
    
    socket.on('user:deviceSync', handleDeviceSync);
    
    // On component mount, request device sync
    socket.emit('user:requestDeviceSync', {
      userId: user.id,
      deviceInfo: navigator.userAgent,
      timestamp: Date.now()
    });
    
    return () => {
      socket.off('user:deviceSync', handleDeviceSync);
    };
  }, [socket, user?.id, syncAccessRights, fetchQuestionSets]);

  // 替换直接API请求的方法，改用现有用户数据和检查单个题库的API
  const fetchPurchaseRecords = useCallback(async () => {
    if (!user?.id) return [];
    
    try {
      console.log('[HomePage] 使用用户数据和有针对性的API检查购买记录');
      
      // 1. 首先使用现有用户对象中的购买记录
      const userPurchases = user.purchases || [];
      console.log(`[HomePage] 用户对象中已有 ${userPurchases.length} 条购买记录`);
      
      // 2. 如果已有购买记录，就直接使用
      if (userPurchases.length > 0) {
        return userPurchases;
      }
      
      // 3. 如果没有购买记录但有付费题库，尝试针对性地检查每个题库
      const paidQuestionSets = questionSets.filter(set => set.isPaid);
      if (paidQuestionSets.length > 0 && socket) {
        console.log(`[HomePage] 没有现成购买记录，通过Socket请求批量检查 ${paidQuestionSets.length} 个付费题库`);
        
        // 使用Socket批量检查
        socket.emit('questionSet:checkAccessBatch', {
          userId: user.id,
          questionSetIds: paidQuestionSets.map(set => set.id)
        });
        
        // 也单独检查每个题库，确保权限状态更新
        for (const set of paidQuestionSets.slice(0, 10)) { // 限制最多10个，避免请求过多
          try {
            const response = await apiClient.get(`/api/purchases/check/${set.id}`, {
              userId: user.id
            }, { cacheDuration: 0 });
            
            if (response?.success && response?.data?.hasAccess) {
              console.log(`[HomePage] 题库 ${set.title} (${set.id}) 有访问权限`);
              
              // 立即更新此题库状态
              setQuestionSets(prevSets => 
                prevSets.map(prevSet => 
                  prevSet.id === set.id 
                    ? {
                        ...prevSet,
                        hasAccess: true,
                        accessType: 'paid',
                        remainingDays: response.data.remainingDays || null
                      }
                    : prevSet
                )
              );
              
              // 保存到缓存
              saveAccessToLocalStorage(set.id, true, response.data.remainingDays);
              
              // 更新视觉反馈
              setRecentlyUpdatedSets(prev => ({
                ...prev,
                [set.id]: Date.now()
              }));
            }
          } catch (error) {
            console.error(`[HomePage] 检查题库 ${set.id} 访问权限失败:`, error);
          }
        }
      }
      
      return userPurchases;
    } catch (error) {
      console.error('[HomePage] 检查购买记录失败:', error);
      return user.purchases || [];
    }
  }, [user, questionSets, socket, saveAccessToLocalStorage]);

  // 添加根据购买记录立即更新题库状态的函数
  const updateQuestionSetsFromPurchases = useCallback((purchases: any[]) => {
    if (!purchases.length) return;
    
    console.log(`[HomePage] 根据 ${purchases.length} 条购买记录更新题库状态`);
    
    setQuestionSets(prevSets => {
      // 创建一个购买记录的映射，方便查找
      const purchaseMap = new Map();
      purchases.forEach(purchase => {
        const qsId = String(purchase.questionSetId || '').trim();
        if (qsId) {
          purchaseMap.set(qsId, purchase);
        }
      });
      
      // 更新每个题库的状态
      return prevSets.map(set => {
        const setId = String(set.id).trim();
        const purchase = purchaseMap.get(setId);
        
        // 如果没有找到购买记录，保持原状态
        if (!purchase) return set;
        
        console.log(`[HomePage] 发现题库 "${set.title}" 的购买记录`);
        
        // 检查购买记录是否有效
        const now = new Date();
        const expiryDate = purchase.expiryDate ? new Date(purchase.expiryDate) : null;
        const isExpired = expiryDate && expiryDate <= now;
        const isActive = !isExpired && 
                        (purchase.status === 'active' || 
                         purchase.status === 'completed' || 
                         !purchase.status);
        
        // 计算剩余天数
        let remainingDays = null;
        if (expiryDate && !isExpired) {
          const diffTime = expiryDate.getTime() - now.getTime();
          remainingDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));
        }
        
        // 确定购买类型
        const accessType: AccessType = purchase.paymentMethod === 'redeem' ? 'redeemed' : 'paid';
        
        // 如果购买有效，更新状态并保存到本地缓存
        if (isActive) {
          // 更新本地缓存
          if (user?.id) {
            saveAccessToLocalStorage(setId, true, remainingDays);
          }
          
          // 标记为最近更新
          setRecentlyUpdatedSets(prev => ({
            ...prev,
            [setId]: Date.now()
          }));
          
          // 返回更新后的题库对象
          return {
            ...set,
            hasAccess: true,
            accessType,
            remainingDays
          };
        }
        
        // 如果购买已过期，标记为过期
        if (isExpired) {
          return {
            ...set,
            hasAccess: false,
            accessType: 'expired',
            remainingDays: 0
          };
        }
        
        return set;
      });
    });
  }, [user?.id, saveAccessToLocalStorage]);

  // 优化登录后的行为 - 解决操作时序问题
  useEffect(() => {
    if (user?.id) {
      console.log('[HomePage] 用户登录事件触发，开始处理登录流程');
      
      // 完全重写登录流程，按顺序执行，避免竞态条件
      (async () => {
        try {
          // 第1步：通过syncAccessRights同步最新权限数据
          console.log('[HomePage] 1. 开始同步访问权限数据');
          await syncAccessRights();
          console.log('[HomePage] 同步访问权限完成，此时用户数据和访问权限已是最新');
          
          // 第2步：使用最新的权限信息，获取并处理题库列表
          console.log('[HomePage] 2. 获取题库列表，强制使用最新数据');
          await fetchQuestionSets({ forceFresh: true });
          console.log('[HomePage] 题库列表获取并处理完成，UI应显示正确的权限状态');
          
          // 第3步：通知其他组件用户已登录
          console.log('[HomePage] 3. 发送用户登录事件');
          window.dispatchEvent(new CustomEvent('user:loggedIn', {
            detail: {
              userId: user.id,
              timestamp: Date.now()
            }
          }));
          
          // 第4步：如果有socket连接，检查其他设备同步
          if (socket) {
            console.log('[HomePage] 4. 发送设备同步请求');
            socket.emit('user:requestDeviceSync', {
              userId: user.id,
              deviceInfo: navigator.userAgent,
              timestamp: Date.now()
            });
          }
        } catch (error) {
          console.error('[HomePage] 登录流程处理错误:', error);
        }
      })();
    }
  }, [user?.id, syncAccessRights, fetchQuestionSets, socket]);

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
                    {categorized.purchased.map(set => (
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
                    {categorized.free.map(set => (
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
                    {categorized.paid.map(set => (
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
                    {categorized.expired.map(set => (
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