import React, { useState, useEffect, useCallback, useRef } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { QuestionSet, UserProgress } from '../types';
import UserMenu from './UserMenu';
import { useUser } from '../contexts/UserContext';
import RecentlyStudiedQuestionSets from './RecentlyStudiedQuestionSets';
import StudySuggestions from './StudySuggestions';
import SocketTest from './SocketTest';
import { useSocket } from '../contexts/SocketContext';
import { userProgressService } from '../services/api';
import { useUserProgress } from '../contexts/UserProgressContext';
import apiClient from '../utils/api-client';
import PaymentModal from './PaymentModal';

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
const calculateQuestionCount = (set: QuestionSet): number => {
  if (typeof set.questionCount === 'number' && set.questionCount > 0) {
    return set.questionCount;
  }
  if (Array.isArray(set.questions) && set.questions.length > 0) {
    return set.questions.length;
  }
  if (typeof set.trialQuestions === 'number' && set.trialQuestions > 0) {
    return set.trialQuestions;
  }
  return 0; // 如果都没有，返回0
};

const HomePage: React.FC = () => {
  const { user, isAdmin } = useUser();
  const { socket } = useSocket();
  const { progressStats, fetchUserProgress } = useUserProgress();
  const [questionSets, setQuestionSets] = useState<QuestionSet[]>([]);
  const [activeCategory, setActiveCategory] = useState<string>('all');
  const [loading, setLoading] = useState(true);
  const [categoryLoading, setCategoryLoading] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [homeContent, setHomeContent] = useState<HomeContentData>(defaultHomeContent);
  const [showPaymentModal, setShowPaymentModal] = useState(false);
  const [selectedQuestionSet, setSelectedQuestionSet] = useState<QuestionSet | null>(null);
  const navigate = useNavigate();
  const [recentlyUpdatedSets, setRecentlyUpdatedSets] = useState<{[key: string]: number}>({});

  // 在获取题库列表后检查访问权限 - 只在首次加载和用户变化时执行
  useEffect(() => {
    // 如果没有用户或没有题库，不执行
    if (!user || !socket || questionSets.length === 0) return;
    
    // 首次检查 - 只查询付费题库的访问权限
    const paidQuestionSets = questionSets.filter(set => set.isPaid);
    
    // 没有付费题库，不需要检查
    if (paidQuestionSets.length === 0) return;
    
    console.log(`检查 ${paidQuestionSets.length} 个付费题库的访问权限`);
    
    // 一次性请求所有付费题库的权限，而不是逐个发送
    socket.emit('questionSet:checkAccessBatch', {
      userId: user.id,
      questionSetIds: paidQuestionSets.map(set => set.id)
    });
    
  }, [user?.id, socket, questionSets.length]); // 只在用户ID和题库数量变化时检查

  // 获取首页设置、分类和题库列表
  useEffect(() => {
    const fetchData = async () => {
      try {
        setLoading(true);
        setErrorMessage(null);

        // 并行请求首页数据，减少请求阻塞
        const [questionsetsData, settingsData, categoriesData] = await Promise.allSettled([
          // 获取题库列表 - 缓存时间延长到10分钟
          apiClient.get('/api/question-sets', undefined, { 
            cacheDuration: 600000, // 从2分钟增加到10分钟
            retries: 3 
          }),
          
          // 获取首页设置 - 缓存10分钟
          apiClient.get('/api/homepage/content', undefined, { 
            cacheDuration: 600000, // 从5分钟增加到10分钟
            retries: 2
          }),
          
          // 获取精选分类 - 缓存10分钟
          apiClient.get('/api/homepage/featured-categories', undefined, { 
            cacheDuration: 600000 // 从5分钟增加到10分钟
          })
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
    // 设置定时刷新，每2分钟更新一次题库数据（间隔从30秒改为2分钟减少请求次数）
    // const intervalId = setInterval(() => {
    //   // 清除所有过期缓存（超过cacheDuration的）
    //   fetchQuestionSets();
    // }, 120000); // 2分钟

    // // 组件卸载时清除定时器
    // return () => clearInterval(intervalId);
  }, []);

  // 异步处理题库列表数据 - 经过封装的函数
  const processQuestionSets = async (data: QuestionSet[]) => {
    if (!data || data.length === 0) return;
    
    // 避免重复状态更新导致频繁渲染
    const updatedData = data.map(set => ({
      ...set,
      // 使用统一的题目数量计算逻辑
      questionCount: calculateQuestionCount(set),
      // 设置默认图片
      icon: set.icon || `https://ui-avatars.com/api/?name=${encodeURIComponent(set.title)}&background=random&color=fff&size=64`
    }));
    
    // 一次性设置所有数据，减少重复渲染
    setQuestionSets(updatedData);
  };

  // Add helper functions for localStorage access status cache at the top of the component
  const saveAccessToLocalStorage = useCallback((questionSetId: string, hasAccess: boolean, remainingDays?: number | null) => {
    try {
      const accessCache = localStorage.getItem('questionSetAccessCache') || '{}';
      const cache = JSON.parse(accessCache);
      
      // Update the cache with fresh data
      cache[questionSetId] = {
        hasAccess,
        remainingDays,
        timestamp: Date.now()
      };
      
      // Save back to localStorage
      localStorage.setItem('questionSetAccessCache', JSON.stringify(cache));
      console.log(`[HomePage] 已保存题库 ${questionSetId} 的访问权限到缓存`);
    } catch (error) {
      console.error('[HomePage] 保存访问权限缓存失败:', error);
    }
  }, []);

  const getAccessFromLocalStorage = useCallback((questionSetId: string) => {
    try {
      const accessCache = localStorage.getItem('questionSetAccessCache') || '{}';
      const cache = JSON.parse(accessCache);
      
      // Check if we have cached data for this question set
      if (cache[questionSetId]) {
        const cacheAge = Date.now() - cache[questionSetId].timestamp;
        // Cache is valid for 24 hours (86400000 ms)
        if (cacheAge < 86400000) {
          console.log(`[HomePage] 从缓存读取题库 ${questionSetId} 的访问权限`);
          return cache[questionSetId];
        }
      }
      return null;
    } catch (error) {
      console.error('[HomePage] 读取访问权限缓存失败:', error);
      return null;
    }
  }, []);

  // Add useEffect to load cached access status when component mounts
  useEffect(() => {
    if (!questionSets.length) return;
    
    console.log('[HomePage] 检查缓存的题库访问权限');
    
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
  }, [questionSets.length, getAccessFromLocalStorage]);

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
      
      console.log('[HomePage] 收到批量题库访问状态更新:', data.updates);
      
      setQuestionSets(prevSets => {
        const newSets = [...prevSets];
        
        // 批量更新题库状态
        data.updates.forEach(update => {
          const index = newSets.findIndex(set => set.id === update.questionSetId);
          if (index !== -1) {
            newSets[index] = {
              ...newSets[index],
              hasAccess: update.hasAccess,
              remainingDays: update.remainingDays
            };
            
            // Save to localStorage cache
            saveAccessToLocalStorage(update.questionSetId, update.hasAccess, update.remainingDays);
          }
        });
        
        return newSets;
      });
    };

    // 只监听批量更新事件
    socket.on('questionSet:batchAccessUpdate', handleBatchAccessUpdate);
    
    // 监听单个题库访问状态更新（兼容现有API）
    const handleAccessUpdate = (data: { 
      questionSetId: string;
      hasAccess: boolean;
      remainingDays: number | null;
    }) => {
      console.log('[HomePage] 收到单个题库访问状态更新:', data);
      
      setQuestionSets(prevSets => {
        const index = prevSets.findIndex(set => set.id === data.questionSetId);
        if (index === -1) return prevSets;
        
        const newSets = [...prevSets];
        newSets[index] = {
          ...newSets[index],
          hasAccess: data.hasAccess,
          remainingDays: data.remainingDays
        };
        
        // Save to localStorage cache
        saveAccessToLocalStorage(data.questionSetId, data.hasAccess, data.remainingDays);
        
        return newSets;
      });
    };

    socket.on('questionSet:accessUpdate', handleAccessUpdate);

    return () => {
      socket.off('questionSet:batchAccessUpdate', handleBatchAccessUpdate);
      socket.off('questionSet:accessUpdate', handleAccessUpdate);
    };
  }, [socket]);

  // 监听全局兑换码成功事件
  useEffect(() => {
    const handleRedeemSuccess = (e: Event) => {
      const customEvent = e as CustomEvent;
      
      // 优先使用 questionSetId，兼容旧版本的 quizId
      const questionSetId = customEvent.detail?.questionSetId || customEvent.detail?.quizId;
      const remainingDays = customEvent.detail?.remainingDays ?? 180; // 默认180天
      
      console.log('[HomePage] 接收到兑换码成功事件:', { questionSetId, remainingDays });
      
      if (questionSetId) {
        setQuestionSets(prevSets => {
          return prevSets.map(set => {
            if (set.id === questionSetId) {
              console.log('[HomePage] 更新题库访问状态:', set.title);
              
              // Save to localStorage cache
              saveAccessToLocalStorage(questionSetId, true, remainingDays);
              
              // Add to recently updated sets for animation
              setRecentlyUpdatedSets(prev => ({
                ...prev,
                [questionSetId]: Date.now() 
              }));
              
              return {
                ...set,
                hasAccess: true,
                remainingDays
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
  }, []);

  // 修改获取题库列表的函数，减少不必要的刷新
  const fetchQuestionSets = async () => {
    try {
      // 使用我们新的apiClient
      const response = await apiClient.get('/api/question-sets', undefined, { 
        cacheDuration: 600000, // 10分钟缓存
        forceRefresh: false // 不强制刷新缓存
      });
      
      if (response && response.success) {
        await processQuestionSets(response.data);
      }
    } catch (error) {
      console.error('获取题库列表失败:', error);
      // 不显示错误提示，避免影响用户体验
      // setErrorMessage('获取题库列表失败，请稍后重试');
    }
  };

  // Optimize getFilteredQuestionSets to filter by category
  const getFilteredQuestionSets = useCallback((): QuestionSet[] => {
    if (!questionSets || questionSets.length === 0) {
      return [];
    }
    
    // If "all" is selected, show featured or all question sets
    if (activeCategory === 'all') {
      if (homeContent.featuredCategories && homeContent.featuredCategories.length > 0) {
        return questionSets.filter(set => 
          homeContent.featuredCategories.includes(set.category) || set.isFeatured
        );
      }
      return questionSets;
    }
    
    // Filter by selected category
    return questionSets.filter(set => set.category === activeCategory);
  }, [questionSets, activeCategory, homeContent.featuredCategories]);

  // Optimize handleCategoryChange to avoid API calls
  const handleCategoryChange = (category: string) => {
    setActiveCategory(category);
    // No API call - we'll filter the data client-side
  };

  // 修改显示进度的部分
  const renderProgressBar = (questionSet: QuestionSet) => {
    const stats = progressStats[questionSet.id];
    if (!stats) return null;

    const progress = stats.totalQuestions > 0 
      ? (stats.completedQuestions / stats.totalQuestions) * 100 
      : 0;
    const accuracy = stats.completedQuestions > 0 
      ? (stats.correctAnswers / stats.completedQuestions) * 100 
      : 0;

    return (
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
    );
  };

  // 根据主题设置页面背景色
  const bgClass = homeContent.theme === 'dark' 
    ? 'min-h-screen bg-gray-800 py-6 flex flex-col justify-center sm:py-12 text-white' 
    : 'min-h-screen bg-gray-50 py-6 flex flex-col justify-center sm:py-12';

  // Add back the handleStartQuiz function
  const handleStartQuiz = (questionSet: QuestionSet) => {
    // 免费题库，直接开始
    if (!questionSet.isPaid) {
      navigate(`/quiz/${questionSet.id}`);
      return;
    }
    
    // 未登录用户，重定向到登录页
    if (!user) {
      // 保存当前题库ID，以便登录后返回
      sessionStorage.setItem('redirectQuestionSetId', questionSet.id);
      navigate('/login');
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
  const getQuestionSetAccessStatus = (questionSet: QuestionSet) => {
    // 如果是免费题库，直接返回有访问权限
    if (!questionSet.isPaid) {
      return { hasAccess: true, remainingDays: null };
    }
    
    // 如果用户未登录，返回无访问权限
    if (!user) {
      return { hasAccess: false, remainingDays: null };
    }
    
    // 直接使用题库的hasAccess属性(通过socket实时更新)
    if (questionSet.hasAccess !== undefined) {
      return { 
        hasAccess: questionSet.hasAccess, 
        remainingDays: questionSet.remainingDays || null 
      };
    }
    
    // 查找用户的购买记录 - 增强兼容性处理
    const purchase = user.purchases?.find(p => 
      p.questionSetId === questionSet.id || 
      (p.purchaseQuestionSet && p.purchaseQuestionSet.id === questionSet.id)
    );
    
    if (!purchase) {
      return { hasAccess: false, remainingDays: null };
    }
    
    // 检查购买是否有效
    const expiryDate = new Date(purchase.expiryDate);
    const now = new Date();
    const remainingDays = Math.ceil((expiryDate.getTime() - now.getTime()) / (1000 * 60 * 60 * 24));
    
    return {
      hasAccess: expiryDate > now,
      remainingDays: remainingDays > 0 ? remainingDays : 0
    };
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
            
            
            {!user && (
              <div className={`mt-6 ${homeContent.theme === 'dark' ? 'bg-blue-900' : 'bg-gradient-to-r from-blue-50 to-indigo-50'} border ${homeContent.theme === 'dark' ? 'border-blue-800' : 'border-blue-100'} rounded-lg p-6 mx-auto max-w-2xl shadow-sm`}>
                <h3 className={`text-lg font-medium ${homeContent.theme === 'dark' ? 'text-blue-300' : 'text-blue-800'} mb-2`}>随时开始，无需登录</h3>
                <p className={`text-sm ${homeContent.theme === 'dark' ? 'text-blue-200' : 'text-blue-600'} mb-4`}>
                  您可以直接开始答题，但登录后可以保存答题进度、查看错题记录，以及收藏喜欢的题库。
                </p>
                <button 
                  onClick={() => window.location.href = "/login"}
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
            {getFilteredQuestionSets().map(questionSet => {
              const { hasAccess, remainingDays } = getQuestionSetAccessStatus(questionSet);
              const isPaid = questionSet.isPaid;
              
              return (
                <div 
                  key={questionSet.id}
                  className={`bg-white rounded-lg shadow-md overflow-hidden border relative ${
                    !hasAccess && isPaid 
                      ? 'border-yellow-200' 
                      : hasAccess && isPaid 
                        ? 'border-green-200' 
                        : 'border-gray-200'
                  } ${recentlyUpdatedSets[questionSet.id] && Date.now() - recentlyUpdatedSets[questionSet.id] < 5000 
                      ? 'animate-pulse ring-4 ring-green-400 ring-opacity-50' 
                      : ''
                  } hover:shadow-lg transition-shadow duration-300`}
                >
                  {/* 新购买/兑换的标记 */}
                  {recentlyUpdatedSets[questionSet.id] && Date.now() - recentlyUpdatedSets[questionSet.id] < 5000 && (
                    <div className="absolute top-0 right-0 bg-green-500 text-white px-3 py-1 transform rotate-45 translate-x-4 translate-y-1 shadow-md animate-bounce">
                      🎉 购买成功
                    </div>
                  )}
                  
                  {/* 付费/免费/已购买标记 */}
                  <div className="absolute top-3 left-3 flex gap-1">
                    {isPaid ? (
                      hasAccess ? (
                        <span className="px-2 py-1 text-xs font-semibold text-green-800 bg-green-100 rounded-full">
                          已购买
                        </span>
                      ) : (
                        <span className="px-2 py-1 text-xs font-semibold text-yellow-800 bg-yellow-100 rounded-full">
                          ¥{questionSet.price}
                        </span>
                      )
                    ) : (
                      <span className="px-2 py-1 text-xs font-semibold text-blue-800 bg-blue-100 rounded-full">
                        免费
                      </span>
                    )}
                    
                    {questionSet.trialQuestions && questionSet.trialQuestions > 0 && !hasAccess && isPaid && (
                      <span className="px-2 py-1 text-xs font-semibold text-orange-800 bg-orange-100 rounded-full">
                        试用{questionSet.trialQuestions}题
                      </span>
                    )}
                  </div>
                  
                  <div className="p-6">
                    <div className="mb-4">
                      <h3 className="text-xl font-bold text-gray-900 mb-2 pr-16">
                        {questionSet.title}
                      </h3>
                      <p className="text-gray-600 text-sm line-clamp-2 h-10 overflow-hidden">
                        {questionSet.description}
                      </p>
                    </div>
                    
                    <div className="flex flex-col space-y-3">
                      {/* 题目数量显示 */}
                      <div className="flex items-center text-gray-500 text-sm">
                        <svg className="h-4 w-4 mr-1" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8.228 9c.549-1.165 2.03-2 3.772-2 2.21 0 4 1.343 4 3 0 1.4-1.278 2.575-3.006 2.907-.542.104-.994.54-.994 1.093m0 3h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                        </svg>
                        <span>
                          题目数量: {questionSet.questionCount !== undefined ? questionSet.questionCount : '未知'} 道
                        </span>
                      </div>
                      
                      {/* 剩余有效期显示 */}
                      {isPaid && hasAccess && remainingDays !== null && (
                        <div className="flex items-center text-green-600 text-sm font-medium">
                          <svg className="h-4 w-4 mr-1" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
                          </svg>
                          <span>剩余 {remainingDays} 天</span>
                        </div>
                      )}
                      
                      {/* 进度条 */}
                      {renderProgressBar(questionSet)}
                      
                      {/* 操作按钮 */}
                      <button
                        onClick={() => handleStartQuiz(questionSet)}
                        className={`mt-2 w-full py-2.5 px-4 rounded-md text-white font-medium flex items-center justify-center ${
                          !hasAccess && isPaid
                            ? 'bg-yellow-500 hover:bg-yellow-600'
                            : 'bg-blue-600 hover:bg-blue-700'
                        } transition-colors duration-200`}
                        aria-label={`开始练习: ${questionSet.title}`}
                      >
                        {!hasAccess && isPaid ? (
                          questionSet.trialQuestions && questionSet.trialQuestions > 0 ? (
                            <>
                              <svg className="h-5 w-5 mr-1.5" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 15l-2 5L9 9l11 4-5 2zm0 0l5 5M7.188 2.239l.777 2.897M5.136 7.965l-2.898-.777M13.95 4.05l-2.122 2.122m-5.657 5.656l-2.12 2.122" />
                              </svg>
                              免费试用
                            </>
                          ) : (
                            <>
                              <svg className="h-5 w-5 mr-1.5" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 10h18M7 15h1m4 0h1m-7 4h12a3 3 0 003-3V8a3 3 0 00-3-3H6a3 3 0 00-3 3v8a3 3 0 003 3z" />
                              </svg>
                              立即购买
                            </>
                          )
                        ) : (
                          <>
                            <svg className="h-5 w-5 mr-1.5" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M14.752 11.168l-3.197-2.132A1 1 0 0010 9.87v4.263a1 1 0 001.555.832l3.197-2.132a1 1 0 000-1.664z" />
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                            </svg>
                            {user && progressStats && progressStats[questionSet.id] ? '继续练习' : '开始练习'}
                          </>
                        )}
                      </button>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      </div>
    </div>
  );
};

export default HomePage;