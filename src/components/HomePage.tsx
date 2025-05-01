import React, { useState, useEffect, useCallback, useRef } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { UserProgress } from '../types';
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
  validityPeriod?: number; // 题库有效期，以天为单位
}

// 扩展题库类型，添加访问类型
interface PreparedQuestionSet extends BaseQuestionSet {
  accessType: AccessType;
  remainingDays: number | null;
  validityPeriod: number;
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
  if (Array.isArray(set.questions) && set.questions.length > 0) {
    return set.questions.length;
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
  const { user, isAdmin } = useUser();
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

  // 获取题库列表的函数 - 统一缓存策略
  const fetchQuestionSets = useCallback(async () => {
    try {
      setLoading(true);
      
      // 统一使用cacheDuration策略，允许10分钟缓存，不强制刷新
      const response = await apiClient.get('/api/question-sets', undefined, { 
        cacheDuration: 600000, // 10分钟缓存，与初始加载保持一致
      });
      
      if (response && response.success) {
        // 预处理题库数据，添加 accessType
        const preparedSets = prepareQuestionSets(response.data);
        setQuestionSets(preparedSets);
        
        // 如果用户已登录，检查访问权限
        if (user?.id && socket) {
          const paidSets = preparedSets.filter(set => set.isPaid);
          if (paidSets.length > 0) {
            socket.emit('questionSet:checkAccessBatch', {
              userId: user.id,
              questionSetIds: paidSets.map(set => set.id)
            });
          }
        }
      } else {
        // 明确处理请求成功但返回错误的情况
        console.error('获取题库列表返回错误:', response?.message || '未知错误');
        setErrorMessage(response?.message || '获取题库列表失败，请稍后重试');
      }
    } catch (error) {
      console.error('获取题库列表失败:', error);
      setErrorMessage('获取题库列表失败，请稍后重试');
    } finally {
      setLoading(false);
    }
  }, [user?.id, socket]);

  // 监听 Socket 事件，更新题库访问状态
  useEffect(() => {
    if (!socket) return;

    const handleBatchAccessUpdate = (data: { 
      updates: Array<{
        questionSetId: string;
        hasAccess: boolean;
        remainingDays: number | null;
      }>
    }) => {
      if (!data.updates || !Array.isArray(data.updates)) return;
      
      setQuestionSets(prevSets => {
        const newSets = [...prevSets];
        let hasUpdates = false;
        
        data.updates.forEach(update => {
          const setIndex = newSets.findIndex(set => set.id === update.questionSetId);
          if (setIndex !== -1) {
            const set = newSets[setIndex];
            let accessType: AccessType = set.accessType;
            
            if (update.hasAccess) {
              accessType = set.paymentMethod === 'redeem' ? 'redeemed' : 'paid';
            } else if (update.remainingDays !== null && update.remainingDays <= 0) {
              accessType = 'expired';
            }
            
            newSets[setIndex] = {
              ...set,
              hasAccess: update.hasAccess,
              remainingDays: update.remainingDays,
              accessType
            };
            hasUpdates = true;
          }
        });
        
        return hasUpdates ? newSets : prevSets;
      });
    };

    socket.on('questionSet:batchAccessUpdate', handleBatchAccessUpdate);
    
    return () => {
      socket.off('questionSet:batchAccessUpdate', handleBatchAccessUpdate);
    };
  }, [socket]);

  // 定期刷新题库列表（改为10分钟，与缓存时间一致）
  useEffect(() => {
    const intervalId = setInterval(() => {
      fetchQuestionSets();
    }, 600000); // 10分钟，与缓存时间一致
    
    return () => clearInterval(intervalId);
  }, [fetchQuestionSets]);

  // 页面加载时获取题库列表
  useEffect(() => {
    fetchQuestionSets();
  }, [fetchQuestionSets]);

  // 用户登录状态改变时重新获取题库列表
  useEffect(() => {
    if (user?.id) {
      fetchQuestionSets();
    }
  }, [user?.id, fetchQuestionSets]);

  // 获取过滤后的题库列表
  const getFilteredQuestionSets = useCallback(() => {
    if (activeCategory === 'all') {
      if (homeContent.featuredCategories && homeContent.featuredCategories.length > 0) {
        return questionSets.filter(set => 
          homeContent.featuredCategories.includes(set.category) || set.isFeatured
        );
      }
      return questionSets;
    }
    
    return questionSets.filter(set => set.category === activeCategory);
  }, [questionSets, activeCategory, homeContent.featuredCategories]);

  // 获取首页设置、分类和题库列表
  useEffect(() => {
    const fetchData = async () => {
      try {
        setLoading(true);
        setErrorMessage(null);

        // 并行请求首页数据，减少请求阻塞
        const [questionsetsData, settingsData, categoriesData, purchasesData] = await Promise.allSettled([
          // 获取题库列表 - 统一使用10分钟缓存
          apiClient.get('/api/question-sets', undefined, { 
            cacheDuration: 600000, // 10分钟缓存
            retries: 3 
          }),
          
          // 获取首页设置 - 缓存10分钟
          apiClient.get('/api/homepage/content', undefined, { 
            cacheDuration: 600000,
            retries: 2
          }),
          
          // 获取精选分类 - 缓存10分钟
          apiClient.get('/api/homepage/featured-categories', undefined, { 
            cacheDuration: 600000
          }),
          
          // 获取用户的购买记录 - 只有用户登录后才请求
          user?.id ? apiClient.get('/api/purchases/active') : Promise.resolve(null)
        ]);

        // 处理题库列表数据
        if (questionsetsData.status === 'fulfilled' && questionsetsData.value?.success) {
          await processQuestionSets(questionsetsData.value.data);
        }

        // 处理首页设置数据
        if (settingsData.status === 'fulfilled' && settingsData.value?.success) {
          const contentData = settingsData.value.data;
          setHomeContent(contentData);
        }

        // 处理分类数据
        if (categoriesData.status === 'fulfilled' && categoriesData.value?.success) {
          setHomeContent(prev => ({
            ...prev,
            featuredCategories: categoriesData.value.data
          }));
        }

        // 处理购买记录数据
        if (purchasesData.status === 'fulfilled' && purchasesData.value?.success && user?.id) {
          console.log(`[HomePage] 获取到 ${purchasesData.value.data.length} 条有效的购买记录`);
          
          // 更新题库的访问权限状态
          setQuestionSets(prevSets => {
            const newSets = [...prevSets];
            
            purchasesData.value.data.forEach((purchase: PurchaseData) => {
              const setIndex = newSets.findIndex(set => set.id === purchase.questionSetId);
              if (setIndex !== -1) {
                console.log(`[HomePage] 更新题库 "${newSets[setIndex].title}" 的访问权限`);
                newSets[setIndex] = {
                  ...newSets[setIndex],
                  hasAccess: true,
                  remainingDays: purchase.remainingDays,
                  accessType: 'paid'
                };
                
                // 保存到本地缓存
                saveAccessToLocalStorage(purchase.questionSetId, true, purchase.remainingDays);
              }
            });
            
            return newSets;
          });
        }
      } catch (error) {
        console.error('获取数据失败:', error);
        setErrorMessage('获取数据失败，请稍后重试');
      } finally {
        setLoading(false);
      }
    };

    // 请求数据
    fetchData();

    // 删除定时刷新，没有必要频繁刷新主页数据
  }, [user?.id]);

  // 异步处理题库列表数据 - 经过封装的函数
  const processQuestionSets = async (data: BaseQuestionSet[]) => {
    if (!data || data.length === 0) return;
    
    const updatedData = prepareQuestionSets(data);
    setQuestionSets(updatedData);
  };

  // Add helper functions for localStorage access status cache at the top of the component
  const getLocalAccessCache = () => {
    try {
      const raw = localStorage.getItem('questionSetAccessCache') || '{}';
      return JSON.parse(raw);
    } catch (e) {
      console.error('[HomePage] 读取缓存失败:', e);
      return {};
    }
  };

  const saveAccessToLocalStorage = useCallback((questionSetId: string, hasAccess: boolean, remainingDays?: number | null) => {
    try {
      // 仅在用户登录时缓存，确保权限与用户绑定
      if (!user?.id) return;
      
      const cache = getLocalAccessCache();
      
      // 使用用户ID组织缓存，避免用户切换后错用缓存
      if (!cache[user.id]) cache[user.id] = {};
      
      // Update the cache with fresh data
      cache[user.id][questionSetId] = {
        hasAccess,
        remainingDays,
        timestamp: Date.now()
      };
      
      // Save back to localStorage
      localStorage.setItem('questionSetAccessCache', JSON.stringify(cache));
      console.log(`[HomePage] 已保存题库 ${questionSetId} 的访问权限到缓存，用户: ${user.id}`);
    } catch (error) {
      console.error('[HomePage] 保存访问权限缓存失败:', error);
    }
  }, [user?.id]);

  const getAccessFromLocalStorage = useCallback((questionSetId: string) => {
    try {
      // 仅在用户登录时获取缓存
      if (!user?.id) return null;
      
      const cache = getLocalAccessCache();
      
      // 检查该用户的缓存数据
      const userCache = cache[user.id];
      if (!userCache) return null;
      
      // Check if we have cached data for this question set
      if (userCache[questionSetId]) {
        const cacheAge = Date.now() - userCache[questionSetId].timestamp;
        const remainingDays = userCache[questionSetId].remainingDays;
        
        // 缓存失效情况：
        // 1. 缓存超过24小时 (86400000 ms)
        // 2. 缓存的剩余天数 <= 0（题库已过期）
        if (cacheAge > 86400000 || (remainingDays !== null && remainingDays <= 0)) {
          console.log(`[HomePage] 缓存已失效 ${questionSetId}`, 
            cacheAge > 86400000 ? '缓存超时' : '题库已过期');
          return null;
        }
        
        console.log(`[HomePage] 从缓存读取题库 ${questionSetId} 的访问权限，用户: ${user.id}`);
        return userCache[questionSetId];
      }
      return null;
    } catch (error) {
      console.error('[HomePage] 读取访问权限缓存失败:', error);
      return null;
    }
  }, [user?.id]);

  // Add useEffect to load cached access status when component mounts
  useEffect(() => {
    if (!questionSets.length) return;
    
    console.log('[HomePage] 检查缓存的题库访问权限');
    
    // 仅当用户登录时加载缓存
    if (user?.id) {
      setQuestionSets(prevSets => {
        const newSets = [...prevSets];
        let hasUpdates = false;
        
        newSets.forEach((set, index) => {
          const cachedAccess = getAccessFromLocalStorage(set.id);
          if (cachedAccess) {
            // Update from cache only if not already set
            if (set.hasAccess !== cachedAccess.hasAccess || set.remainingDays !== cachedAccess.remainingDays) {
        newSets[index] = {
          ...newSets[index],
                hasAccess: cachedAccess.hasAccess,
                remainingDays: cachedAccess.remainingDays
              };
              hasUpdates = true;
            }
          }
        });
        
        return hasUpdates ? newSets : prevSets;
      });
    }
  }, [questionSets.length, getAccessFromLocalStorage, user?.id]);
  
  // 新增：用户登录后主动获取题库访问权限（不依赖socket）
  useEffect(() => {
    // 仅当用户已登录且题库列表已加载时执行
    if (!user?.id || !questionSets.length) return;
    
    console.log('[HomePage] 用户已登录，主动获取题库访问权限');
    
    const fetchAccessStatusFromServer = async () => {
      try {
        // 仅查询付费题库的访问权限
        const paidQuestionSets = questionSets.filter(set => set.isPaid);
        
        // 没有付费题库，不需要查询
        if (paidQuestionSets.length === 0) return;
        
        console.log(`[HomePage] 主动获取 ${paidQuestionSets.length} 个付费题库的访问权限`);
        
        // 方式一：使用RESTful API（如果有的话）
        // const response = await apiClient.post('/api/user/access-status', {
        //   questionSetIds: paidQuestionSets.map(q => q.id),
        // });
        
        // if (response.success && Array.isArray(response.data)) {
        //   updateQuestionSetsAccess(response.data);
        // }
        
        // 方式二：使用Socket（当前实现）
        if (socket) {
          // 确保socket已连接
          if (socket.connected) {
            socket.emit('questionSet:checkAccessBatch', {
              userId: user.id,
              questionSetIds: paidQuestionSets.map(set => set.id)
            });
          } else {
            // 如果socket未连接，等待连接后再发送
            console.log('[HomePage] Socket未连接，等待连接后获取权限');
            const checkConnection = () => {
              if (socket.connected) {
                socket.emit('questionSet:checkAccessBatch', {
                  userId: user.id,
                  questionSetIds: paidQuestionSets.map(set => set.id)
                });
                clearInterval(connectionTimer);
              }
            };
            
            const connectionTimer = setInterval(checkConnection, 1000);
            
            // 最多等待10秒
            setTimeout(() => {
              clearInterval(connectionTimer);
              console.log('[HomePage] Socket连接超时，无法获取题库权限');
            }, 10000);
          }
        }
      } catch (error) {
        console.error('[HomePage] 获取题库访问权限失败:', error);
      }
    };
    
    // 执行获取
    fetchAccessStatusFromServer();
    
    // 用户更改时清除定时器
  }, [user?.id, questionSets.length, socket]);
  
  // 统一处理批量更新题库访问状态的逻辑
  const updateQuestionSetsAccess = useCallback((updates: Array<{
      questionSetId: string;
      hasAccess: boolean;
      remainingDays: number | null;
  }>) => {
    if (!updates || !Array.isArray(updates) || updates.length === 0) return;
    
    console.log('[updateQuestionSetsAccess] 收到批量更新:', updates);
    
    setQuestionSets(prevSets => {
        const newSets = [...prevSets];
      let updatedCount = 0;
      
      // 批量更新题库状态
      updates.forEach(update => {
        // 标准化ID格式，避免类型不匹配
        const normalizedUpdateId = String(update.questionSetId).trim();
        console.log(`[updateQuestionSetsAccess] 处理更新: questionSetId=${normalizedUpdateId}, hasAccess=${update.hasAccess}, remainingDays=${update.remainingDays}`);
        
        const index = newSets.findIndex(set => String(set.id).trim() === normalizedUpdateId);
        if (index !== -1) {
          console.log(`[updateQuestionSetsAccess] 找到匹配题库 index=${index}, 旧值:`, {
            id: newSets[index].id,
            title: newSets[index].title,
            hasAccess: newSets[index].hasAccess,
            remainingDays: newSets[index].remainingDays
          });
          
        newSets[index] = {
          ...newSets[index],
            hasAccess: update.hasAccess,
            remainingDays: update.remainingDays
          };
          
          console.log(`[updateQuestionSetsAccess] 更新后的题库:`, {
            id: newSets[index].id,
            title: newSets[index].title,
            hasAccess: newSets[index].hasAccess, 
            remainingDays: newSets[index].remainingDays
          });
          
          updatedCount++;
          
          // 保存到localStorage缓存
          saveAccessToLocalStorage(update.questionSetId, update.hasAccess, update.remainingDays);
        } else {
          console.warn(`[updateQuestionSetsAccess] 未找到匹配的题库ID: ${normalizedUpdateId}`);
        }
      });
      
      console.log(`[updateQuestionSetsAccess] 完成更新 ${updatedCount}/${updates.length} 个题库`);
      return updatedCount > 0 ? newSets : prevSets;
    });
  }, [saveAccessToLocalStorage]);

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

  // 预处理题库数据，添加访问类型
  const prepareQuestionSets = (sets: BaseQuestionSet[]): PreparedQuestionSet[] => {
    return sets.map(set => {
      const { hasAccess, remainingDays } = getQuestionSetAccessStatus(set);
      
      let accessType: AccessType = 'trial';
      
      if (set.isPaid) {
        if (hasAccess) {
          // 检查是否是兑换的题库
          const isRedeemed = set.paymentMethod === 'redeem';
          accessType = isRedeemed ? 'redeemed' : 'paid';
        } else if (remainingDays !== null && remainingDays <= 0) {
          accessType = 'expired';
        }
      }
      
      // 从题库数据获取validityPeriod，或使用默认值
      const validityPeriod = set.validityPeriod || 180; // 从数据中读取或使用默认180天
      
      return {
        ...set,
        accessType,
        remainingDays: remainingDays || null,
        validityPeriod
      };
    });
  };

  // 修改显示进度的部分
  const renderProgressBar = (set: PreparedQuestionSet) => {
    if (!set.remainingDays || set.remainingDays <= 0) return null;
    
    const percentage = Math.min(100, (set.remainingDays / (set.validityPeriod || 180)) * 100);
    
    return (
      <div className="mt-4 pt-3 border-t border-gray-100">
        <div className="mb-4 flex items-center">
          <div className="w-full bg-gray-200 rounded-full h-2.5">
            <div 
              className="bg-green-600 h-2.5 rounded-full" 
              style={{ width: `${percentage}%` }}
            />
          </div>
          <span className="ml-2 text-xs text-gray-500">{Math.round(percentage)}%</span>
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

    // 添加调试日志，检查用户购买记录
    console.log(`[调试] 题库 "${questionSet.title}" (ID: ${questionSet.id}) 检查访问权限`);
    
    // 直接使用题库的hasAccess属性(通过socket实时更新)
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
    
    // 查找用户的购买记录 - 增强兼容性处理
    const userAny = user as any;
    const userPurchasesFallback = userAny.userPurchases || user.purchases || [];
    console.log(`[调试] 用户购买记录数组:`, userPurchasesFallback);
    
    // 尝试查找有效的购买记录
    let purchase = userPurchasesFallback.find((p: any) => {
      const purchaseQuestionSetId = p.questionSetId || p.question_set_id;
      const isActive = p.status === 'active' || p.status === 'completed';
      const isNotExpired = !p.expiryDate || new Date(p.expiryDate) > new Date();
      
      return purchaseQuestionSetId === questionSet.id && isActive && isNotExpired;
    });
    
    if (!purchase) {
      console.log(`[调试] 尝试其他查找方式...`);
      
      // 如果在购买记录中找不到，尝试在用户数据中的其他可能位置找
      if (userAny.access && Array.isArray(userAny.access)) {
        const hasAccess = userAny.access.includes(questionSet.id);
        if (hasAccess) {
          console.log(`[调试] 在user.access字段中找到题库访问权限`);
          return { hasAccess: true, remainingDays: 180 }; // 默认180天
        }
      }
      
      // 兼容redeems/redeemedItems等字段
      const possibleFields = [
        { name: 'redeems', value: userAny.redeems },
        { name: 'redeemedItems', value: userAny.redeemedItems },
        { name: 'redeemedCodes', value: userAny.redeemedCodes }
      ];
      
      for (const field of possibleFields) {
        if (Array.isArray(field.value)) {
          const foundItem = field.value.find((item: any) => {
            return item.questionSetId === questionSet.id || 
                   item.question_set_id === questionSet.id ||
                   (item.questionSet && item.questionSet.id === questionSet.id);
          });
          
          if (foundItem) {
            console.log(`[调试] 在user.${field.name}字段中找到题库访问权限`);
            return { hasAccess: true, remainingDays: 180 }; // 默认180天
          }
        }
      }
      
      console.log(`[getQuestionSetAccessStatus] 题库 "${questionSet.title}" 未找到购买记录`);
      return { hasAccess: false, remainingDays: null };
    }
    
    // 计算剩余天数
    const expiryDate = purchase.expiryDate || purchase.expiry_date;
    const remainingDays = expiryDate ? 
      Math.ceil((new Date(expiryDate).getTime() - Date.now()) / (1000 * 60 * 60 * 24)) : 
      null;
    
    console.log(`[getQuestionSetAccessStatus] 题库 "${questionSet.title}" 找到有效购买记录，剩余天数:`, remainingDays);
    return { 
      hasAccess: true, 
      remainingDays 
    };
  };

  // 添加Socket监听，使用依赖更少的方式
  useEffect(() => {
    if (!socket) return;

    // 监听批量题库访问状态更新
    const handleBatchAccessUpdate = (data: { 
      updates: Array<{
        questionSetId: string;
        hasAccess: boolean;
        remainingDays: number | null;
      }>
    }) => {
      if (!data.updates || !Array.isArray(data.updates) || data.updates.length === 0) return;
      
      console.log('[Socket] batchAccessUpdate 返回:', data);
      console.log('[HomePage] 收到批量题库访问状态更新:', data.updates);
      
      // 使用统一的更新函数处理
      updateQuestionSetsAccess(data.updates);
    };

    // 只监听批量更新事件
    socket.on('questionSet:batchAccessUpdate', handleBatchAccessUpdate);
    
    // 监听单个题库访问状态更新（兼容现有API）
    const handleAccessUpdate = (data: { 
      questionSetId: string;
      hasAccess: boolean;
      remainingDays: number | null;
    }) => {
      console.log('[Socket] accessUpdate 返回:', data);
      console.log('[HomePage] 收到单个题库访问状态更新:', data);
      
      // 转换为批量更新格式并使用统一的更新函数
      updateQuestionSetsAccess([{
        questionSetId: data.questionSetId,
        hasAccess: data.hasAccess,
        remainingDays: data.remainingDays
      }]);
    };

    socket.on('questionSet:accessUpdate', handleAccessUpdate);

    return () => {
      socket.off('questionSet:batchAccessUpdate', handleBatchAccessUpdate);
      socket.off('questionSet:accessUpdate', handleAccessUpdate);
    };
  }, [socket, updateQuestionSetsAccess]);

  // 监听来自ProfilePage的刷新通知
  useEffect(() => {
    const handleRefreshAccess = () => {
      console.log('[HomePage] 收到刷新题库访问权限的通知');
      
      // 检查用户和socket是否可用
      if (!user?.id || !socket) return;
      
      // 只检查付费题库
      const paidQuestionSets = questionSets.filter(set => set.isPaid);
      if (paidQuestionSets.length === 0) return;
      
      // 发送批量检查请求
      socket.emit('questionSet:checkAccessBatch', {
        userId: user.id,
        questionSetIds: paidQuestionSets.map(set => set.id)
      });
    };
    
    // 监听自定义事件
    window.addEventListener('questionSets:refreshAccess', handleRefreshAccess);
    
    return () => {
      window.removeEventListener('questionSets:refreshAccess', handleRefreshAccess);
    };
  }, [user?.id, socket, questionSets]);
  
  // 定期检查题库访问状态（每2小时），处理长时间不刷新页面的情况
  useEffect(() => {
    if (!user?.id || !socket || questionSets.length === 0) return;
    
    // 获取付费题库
    const paidQuestionSets = questionSets.filter(set => set.isPaid);
    if (paidQuestionSets.length === 0) return;
    
    console.log('[HomePage] 设置定期检查题库访问状态');
    
    // 从1小时改为2小时检查一次，减少服务器负载
    const checkTimer = setInterval(() => {
      console.log('[HomePage] 定期检查题库访问状态');
      
      socket.emit('questionSet:checkAccessBatch', {
        userId: user.id,
        questionSetIds: paidQuestionSets.map(set => set.id)
      });
    }, 7200000); // 2小时
    
    return () => {
      clearInterval(checkTimer);
    };
  }, [user?.id, socket, questionSets]);

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

    return (
      <div 
        className={`bg-white p-5 rounded-lg shadow-md overflow-hidden border relative hover:shadow-lg transition-all duration-300 ${
          isRecentlyUpdated ? 'border-green-500 transform scale-102' : ''
        }`}
        style={{
          animation: isRecentlyUpdated ? 'pulse 2s ease-in-out' : 'none'
        }}
      >
        {isRecentlyUpdated && (
          <div className="absolute -top-1 -right-1 bg-green-500 text-white rounded-full p-1 animate-ping">
            <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
            </svg>
          </div>
        )}
      
        <div className="absolute top-3 left-3 flex gap-1">
          {set.accessType === 'paid' && (
            <>
              <span className="px-2 py-1 text-xs font-semibold text-green-800 bg-green-100 rounded-full">
                已购买
              </span>
              {renderValidityBadge(set.remainingDays)}
            </>
          )}
          {set.accessType === 'redeemed' && (
            <>
              <span className="px-2 py-1 text-xs font-semibold text-blue-800 bg-blue-100 rounded-full">
                已兑换
              </span>
              {renderValidityBadge(set.remainingDays)}
            </>
          )}
          {set.accessType === 'expired' && (
            <span className="px-2 py-1 text-xs font-semibold text-red-800 bg-red-100 rounded-full">
              已过期
            </span>
          )}
          {set.accessType === 'trial' && (
            <span className="px-2 py-1 text-xs font-semibold text-blue-800 bg-blue-100 rounded-full">
              免费
            </span>
          )}
        </div>

        <div className="p-6">
          <div className="mb-4">
            <h3 className="text-xl font-bold text-gray-900 mb-2 pr-16">
              {set.title}
            </h3>
            <p className="text-gray-600 text-sm line-clamp-2 h-10 overflow-hidden">
              {set.description}
            </p>
          </div>

          <div className="flex flex-col space-y-3">
            <div className="flex items-center text-gray-500 text-sm">
              <svg className="h-4 w-4 mr-1" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8.228 9c.549-1.165 2.03-2 3.772-2 2.21 0 4 1.343 4 3 0 1.4-1.278 2.575-3.006 2.907-.542.104-.994.54-.994 1.093m0 3h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
              </svg>
              <span>
                题目数量: {set.questionCount || '未知'} 道
              </span>
            </div>

            {stats && (
      <div className="mt-2">
        <div className="flex justify-between text-sm text-gray-600">
          <span>完成进度: {Math.round(progress)}%</span>
          <span>正确率: {Math.round(accuracy)}%</span>
        </div>
        <div className="w-full bg-gray-200 rounded-full h-2 mt-1">
          <div
            className="bg-blue-600 h-2 rounded-full"
            style={{ width: `${progress}%` }}
          />
        </div>
      </div>
            )}

            {renderProgressBar(set)}

          <button
              onClick={() => onStartQuiz(set)}
              className={`mt-2 w-full py-2.5 px-4 rounded-md text-white font-medium flex items-center justify-center ${
                set.accessType === 'expired'
                  ? 'bg-gray-400 cursor-not-allowed'
                  : set.accessType === 'trial' && set.isPaid
                  ? 'bg-yellow-500 hover:bg-yellow-600'
                  : 'bg-blue-600 hover:bg-blue-700'
              } transition-colors duration-200`}
              disabled={set.accessType === 'expired'}
            >
              {set.accessType === 'expired' ? (
                '题库已过期'
              ) : set.accessType === 'trial' && set.isPaid ? (
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

  const handleCategoryChange = (category: string) => {
    setActiveCategory(category);
  };

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

      {/* 如果有横幅图片，则显示 */}
      {homeContent.bannerImage && (
        <div className="w-full h-40 md:h-60 bg-cover bg-center mb-6" style={{ backgroundImage: `url(${homeContent.bannerImage})` }}>
          <div className="bg-black bg-opacity-40 w-full h-full flex items-center justify-center">
            <h1 className="text-4xl font-bold text-white">{homeContent.welcomeTitle || defaultHomeContent.welcomeTitle}</h1>
          </div>
        </div>
      )}
      
      <div className="relative py-3 sm:max-w-4xl sm:mx-auto">
        <div className="max-w-4xl mx-auto">
          <div className="text-center mb-10">
            {!homeContent.bannerImage && (
              <h1 className={`text-3xl font-bold ${homeContent.theme === 'dark' ? 'text-white' : 'text-gray-900'} md:text-4xl`}>
                {homeContent.welcomeTitle || defaultHomeContent.welcomeTitle}
              </h1>
            )}
            <p className={`mt-3 text-base ${homeContent.theme === 'dark' ? 'text-gray-300' : 'text-gray-500'} sm:mt-5 sm:text-lg sm:max-w-xl sm:mx-auto md:mt-5`}>
              {homeContent.welcomeDescription || defaultHomeContent.welcomeDescription}
            </p>
            
            {/* 公告信息 */}
            {homeContent.announcements && (
              <div className={`mt-6 ${homeContent.theme === 'dark' ? 'bg-gray-700' : 'bg-yellow-50'} border ${homeContent.theme === 'dark' ? 'border-gray-600' : 'border-yellow-100'} rounded-lg p-4 mx-auto max-w-2xl`}>
                <p className={`text-sm ${homeContent.theme === 'dark' ? 'text-yellow-300' : 'text-yellow-700'}`}>
                  📢 {homeContent.announcements}
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
          </div>

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
          
          {/* 题库列表 */}
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
              {getFilteredQuestionSets().map(set => (
                <BaseCard
                  key={set.id}
                  set={set}
                  onStartQuiz={handleStartQuiz}
                />
              ))}
                      </div>
                      </div>
      </div>
    </div>
  );
};

export default HomePage;