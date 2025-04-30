import React, { useState, useEffect } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import axios from 'axios';
import { QuestionSet, UserProgress } from '../types';
import UserMenu from './UserMenu';
import { useUser } from '../contexts/UserContext';
import RecentlyStudiedQuestionSets from './RecentlyStudiedQuestionSets';
import StudySuggestions from './StudySuggestions';
import SocketTest from './SocketTest';
import { useSocket } from '../contexts/SocketContext';
import { userProgressService } from '../services/api';

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

interface ProgressStats {
  totalQuestions: number;
  completedQuestions: number;
  correctAnswers: number;
  totalTimeSpent: number;
  averageTimeSpent: number;
  accuracy: number;
}

const HomePage: React.FC = () => {
  const { user, isAdmin } = useUser();
  const { socket } = useSocket();
  const [questionSets, setQuestionSets] = useState<QuestionSet[]>([]);
  const [userProgressRecords, setUserProgressRecords] = useState<UserProgress[]>([]);
  const [userProgressStats, setUserProgressStats] = useState<Record<string, ProgressStats>>({});
  const [activeCategory, setActiveCategory] = useState<string>('all');
  const [loading, setLoading] = useState(true);
  const [categoryLoading, setCategoryLoading] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [welcomeData, setWelcomeData] = useState({
    title: '在线题库练习系统',
    description: '选择以下任一题库开始练习，测试您的知识水平'
  });
  const [homeContent, setHomeContent] = useState<HomeContentData>(defaultHomeContent);
  const [showUserInfo, setShowUserInfo] = useState(false);
  const navigate = useNavigate();

  // 添加 Socket 监听
  useEffect(() => {
    if (!socket) return;

    // 监听题库更新事件
    const handleQuestionSetUpdate = (updatedQuestionSet: QuestionSet) => {
      setQuestionSets(prevSets => {
        const index = prevSets.findIndex(set => set.id === updatedQuestionSet.id);
        if (index === -1) return prevSets;
        
        const newSets = [...prevSets];
        newSets[index] = {
          ...newSets[index],
          isFeatured: updatedQuestionSet.isFeatured,
          isPaid: updatedQuestionSet.isPaid,
          price: updatedQuestionSet.price
        };
        return newSets;
      });
    };

    // 监听题库访问状态更新
    const handleQuestionSetAccessUpdate = (data: { 
      questionSetId: string;
      hasAccess: boolean;
      remainingDays: number | null;
    }) => {
      setQuestionSets(prevSets => {
        const index = prevSets.findIndex(set => set.id === data.questionSetId);
        if (index === -1) return prevSets;
        
        const newSets = [...prevSets];
        newSets[index] = {
          ...newSets[index],
          hasAccess: data.hasAccess,
          remainingDays: data.remainingDays
        };
        return newSets;
      });
    };

    // 监听购买成功事件
    const handlePurchaseSuccess = (data: {
      questionSetId: string;
      purchaseId: string;
      expiryDate: string;
    }) => {
      setQuestionSets(prevSets => {
        const index = prevSets.findIndex(set => set.id === data.questionSetId);
        if (index === -1) return prevSets;
        
        const newSets = [...prevSets];
        newSets[index] = {
          ...newSets[index],
          hasAccess: true,
          remainingDays: Math.ceil((new Date(data.expiryDate).getTime() - new Date().getTime()) / (1000 * 60 * 60 * 24))
        };
        return newSets;
      });
    };

    socket.on('questionSet:update', handleQuestionSetUpdate);
    socket.on('questionSet:accessUpdate', handleQuestionSetAccessUpdate);
    socket.on('purchase:success', handlePurchaseSuccess);

    return () => {
      socket.off('questionSet:update', handleQuestionSetUpdate);
      socket.off('questionSet:accessUpdate', handleQuestionSetAccessUpdate);
      socket.off('purchase:success', handlePurchaseSuccess);
    };
  }, [socket]);

  // 检查题库访问权限
  const checkQuestionSetAccess = (questionSetId: string) => {
    if (!socket || !user) return;
    
    socket.emit('questionSet:checkAccess', {
      userId: user.id,
      questionSetId
    });
  };

  // 在获取题库列表后检查访问权限
  useEffect(() => {
    if (user && questionSets.length > 0) {
      questionSets.forEach(set => {
        if (set.isPaid) {
          checkQuestionSetAccess(set.id);
        }
      });
    }
  }, [user, questionSets]);

  // 获取首页设置、分类和题库列表
  useEffect(() => {
    const fetchData = async () => {
      try {
        setLoading(true);
        setErrorMessage(null);

        await fetchQuestionSets();

        // 获取首页设置
        const settingsResponse = await axios.get('/api/homepage/content');
        if (settingsResponse.data && settingsResponse.data.success && settingsResponse.data.data) {
          const contentData = settingsResponse.data.data;
          setWelcomeData({
            title: contentData.welcomeTitle || defaultHomeContent.welcomeTitle,
            description: contentData.welcomeDescription || defaultHomeContent.welcomeDescription
          });
          setHomeContent(contentData);
        }

        // 获取精选分类
        const categoriesResponse = await axios.get('/api/homepage/featured-categories');
        if (categoriesResponse.data && categoriesResponse.data.success && categoriesResponse.data.data) {
          setHomeContent(prev => ({
            ...prev,
            featuredCategories: categoriesResponse.data.data
          }));
        }
      } catch (error) {
        console.error('获取数据失败:', error);
        setErrorMessage('获取数据失败，请稍后重试');
      } finally {
        setLoading(false);
      }
    };

    fetchData();

    // 设置定时刷新，每30秒更新一次题库数据
    const intervalId = setInterval(fetchData, 30000);

    // 组件卸载时清除定时器
    return () => clearInterval(intervalId);
  }, []);

  // 根据主题设置页面背景色
  const bgClass = homeContent.theme === 'dark' 
    ? 'min-h-screen bg-gray-800 py-6 flex flex-col justify-center sm:py-12 text-white' 
    : 'min-h-screen bg-gray-50 py-6 flex flex-col justify-center sm:py-12';

  // 修改获取题库列表的函数
  const fetchQuestionSets = async () => {
    try {
      const response = await axios.get('/api/question-sets');
      if (response.data && response.data.success && response.data.data) {
        const questionSetsData = response.data.data;
        setQuestionSets(questionSetsData);
        
        // 为每个题库获取题目
        for (const set of questionSetsData) {
          try {
            const questionsResponse = await axios.get(`/api/questions?questionSetId=${set.id}&include=options`);
            if (questionsResponse.data && questionsResponse.data.success) {
              set.questions = questionsResponse.data.data;
            }
          } catch (err) {
            console.warn(`获取题库 ${set.id} 的题目失败:`, err);
          }
        }
        
        setQuestionSets([...questionSetsData]);
      }
    } catch (error) {
      console.error('获取题库列表失败:', error);
      setErrorMessage('获取题库列表失败，请稍后重试');
    }
  };

  // 修改获取要显示的题库的函数
  const getFilteredQuestionSets = (): QuestionSet[] => {
    if (!questionSets || questionSets.length === 0) {
      return [];
    }
    
    // 如果有精选分类，优先显示精选分类的题库
    if (homeContent.featuredCategories && homeContent.featuredCategories.length > 0) {
      return questionSets.filter(set => 
        homeContent.featuredCategories.includes(set.category) || set.isFeatured
      );
    }
    
    // 否则显示所有题库
    return questionSets;
  };

  // 获取题库访问状态
  const getQuestionSetAccessStatus = (questionSet: QuestionSet) => {
    // 如果是免费题库，直接返回有访问权限
    if (!questionSet.isPaid) {
      return { hasAccess: true, remainingDays: null };
    }
    
    // 如果用户未登录，返回无访问权限
    if (!user) {
      return { hasAccess: false, remainingDays: null };
    }
    
    // 查找用户的购买记录
    const purchase = user.purchases?.find(p => p.questionSetId === questionSet.id);
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

  // 处理开始答题
  const handleStartQuiz = (questionSet: QuestionSet) => {
    if (!questionSet.isPaid) {
      navigate(`/quiz/${questionSet.id}`);
      return;
    }
    
    if (!user) {
      navigate('/login');
      return;
    }
    
    const { hasAccess } = getQuestionSetAccessStatus(questionSet);
    if (hasAccess) {
      navigate(`/quiz/${questionSet.id}`);
    } else {
      // 显示购买提示
      alert('您需要购买此题库才能访问完整内容');
    }
  };

  // 处理分类切换
  const handleCategoryChange = async (category: string) => {
    setActiveCategory(category);
    setCategoryLoading(true);
    
    try {
      const response = await axios.get(`/api/question-sets?category=${category}`);
      if (response.data.success) {
        setQuestionSets(response.data.data);
      }
    } catch (error) {
      console.error('获取分类题库失败:', error);
    } finally {
      setCategoryLoading(false);
    }
  };

  // 获取用户进度记录
  const fetchUserProgress = async () => {
    try {
      const response = await userProgressService.getUserProgress();
      if (response.success && response.data) {
        setUserProgressStats(response.data);
        
        // 打印调试信息
        console.log('前端渲染数据', {
          userProgressStats: response.data,
          questionSets
        });
        
        // 检查是否有不匹配的题库
        Object.keys(response.data).forEach(questionSetId => {
          if (!questionSets.find(q => q.id === questionSetId)) {
            console.warn('找不到匹配的题库:', questionSetId);
          }
        });
      }
    } catch (error) {
      console.error('获取用户进度失败:', error);
    }
  };

  // 修改 useEffect 依赖
  useEffect(() => {
    if (user) {
      // 确保题库加载完成后再获取进度
      if (questionSets.length > 0) {
        fetchUserProgress();
      }
    }
  }, [user, questionSets.length]);

  // 修改 socket 事件处理
  useEffect(() => {
    if (!socket) return;

    socket.on('progress:update', (updatedProgress: UserProgress) => {
      // 使用函数式更新确保使用最新状态
      setUserProgressStats(prevStats => {
        const newStats = { ...prevStats };
        const questionSetId = updatedProgress.questionSetId;
        
        if (!newStats[questionSetId]) {
          newStats[questionSetId] = {
            ...updatedProgress,
            completedQuestions: 0,
            totalQuestions: 0,
            correctAnswers: 0,
            totalTimeSpent: 0,
            averageTimeSpent: 0,
            accuracy: 0
          };
        }
        
        // 更新统计信息
        const stats = newStats[questionSetId];
        stats.completedQuestions++;
        if (updatedProgress.isCorrect) stats.correctAnswers++;
        stats.totalTimeSpent += updatedProgress.timeSpent;
        stats.averageTimeSpent = stats.totalTimeSpent / stats.completedQuestions;
        stats.accuracy = (stats.correctAnswers / stats.completedQuestions) * 100;
        
        return newStats;
      });
    });

    return () => {
      socket.off('progress:update');
    };
  }, [socket]);

  // 修改显示进度的部分
  const renderProgressBar = (questionSet: QuestionSet) => {
    const stats = userProgressStats[questionSet.id];
    if (!stats) return null;

    const progress = (stats.completedQuestions / stats.totalQuestions) * 100;
    const accuracy = stats.accuracy;

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

  // 在题库卡片中添加进度显示
  const renderQuestionSetCard = (questionSet: QuestionSet) => {
    const { hasAccess, remainingDays } = getQuestionSetAccessStatus(questionSet);
    
    return (
      <div key={questionSet.id} className="bg-white rounded-lg shadow-md p-4">
        <h3 className="text-lg font-semibold">{questionSet.title}</h3>
        <p className="text-gray-600 mt-1">{questionSet.description}</p>
        {renderProgressBar(questionSet)}
        <div className="mt-4 flex justify-between items-center">
          <span className="text-sm text-gray-500">
            {hasAccess ? `剩余 ${remainingDays} 天` : '需要购买'}
          </span>
          <button
            onClick={() => handleStartQuiz(questionSet)}
            className={`px-4 py-2 rounded-md ${
              hasAccess ? 'bg-blue-600 text-white' : 'bg-gray-300 text-gray-500'
            }`}
            disabled={!hasAccess}
          >
            开始练习
          </button>
        </div>
      </div>
    );
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
            <h1 className="text-4xl font-bold text-white">{welcomeData.title}</h1>
          </div>
        </div>
      )}
      
      <div className="relative py-3 sm:max-w-4xl sm:mx-auto">
        {/* 用户菜单 - 右上角 */}
        <div className="absolute top-0 right-0 mt-4 mr-4 z-10">
          <UserMenu />
        </div>
        
        <div className="max-w-4xl mx-auto">
          <div className="text-center mb-10">
            {!homeContent.bannerImage && (
              <h1 className={`text-3xl font-bold ${homeContent.theme === 'dark' ? 'text-white' : 'text-gray-900'} md:text-4xl`}>
                {welcomeData.title}
              </h1>
            )}
            <p className={`mt-3 text-base ${homeContent.theme === 'dark' ? 'text-gray-300' : 'text-gray-500'} sm:mt-5 sm:text-lg sm:max-w-xl sm:mx-auto md:mt-5`}>
              {welcomeData.description}
            </p>
            
            {/* 公告信息 */}
            {homeContent.announcements && (
              <div className={`mt-6 ${homeContent.theme === 'dark' ? 'bg-gray-700' : 'bg-yellow-50'} border ${homeContent.theme === 'dark' ? 'border-gray-600' : 'border-yellow-100'} rounded-lg p-4 mx-auto max-w-2xl`}>
                <p className={`text-sm ${homeContent.theme === 'dark' ? 'text-yellow-300' : 'text-yellow-700'}`}>
                  📢 {homeContent.announcements}
                </p>
              </div>
            )}
            
            {user && (
              <div className={`mt-6 ${homeContent.theme === 'dark' ? 'bg-green-900' : 'bg-gradient-to-r from-green-50 to-teal-50'} border ${homeContent.theme === 'dark' ? 'border-green-800' : 'border-green-100'} rounded-lg p-6 mx-auto max-w-2xl shadow-sm`}>
                <div className="flex justify-between items-center">
                  <h3 className={`text-lg font-medium ${homeContent.theme === 'dark' ? 'text-green-300' : 'text-green-800'}`}>欢迎回来，{user.username}！</h3>
                  <button
                    onClick={() => setShowUserInfo(!showUserInfo)}
                    className="inline-flex items-center px-3 py-1 border border-transparent rounded-md shadow-sm text-sm font-medium text-white bg-green-600 hover:bg-green-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-green-500"
                  >
                    {showUserInfo ? '隐藏详情' : '查看详情'}
                  </button>
                </div>
                
                {showUserInfo && (
                  <div className={`mt-3 text-sm ${homeContent.theme === 'dark' ? 'text-green-200' : 'text-green-700'}`}>
                    <p><strong>用户ID:</strong> {user.id}</p>
                    <p><strong>邮箱:</strong> {user.email}</p>
                    <p><strong>管理员权限:</strong> {user.isAdmin ? '是' : '否'}</p>
                    <p><strong>已完成题目数:</strong> {Object.values(user.progress || {}).reduce((acc, curr) => acc + curr.completedQuestions, 0)}</p>
                    <p><strong>已购买题库数:</strong> {user.purchases?.length || 0}</p>
                  </div>
                )}
              </div>
            )}
            
            {/* 添加用户进度展示组件和最近学习题库组件 */}
            {user && questionSets.length > 0 && (
              <>
                <div className="mt-6 mx-auto max-w-2xl grid md:grid-cols-2 gap-4">
                  <RecentlyStudiedQuestionSets
                    questionSets={questionSets}
                    limit={4}
                    theme={homeContent.theme === 'dark' ? 'dark' : 'light'}
                  />
                </div>
                
                {/* 添加学习建议组件 */}
                <div className="mt-4 mx-auto max-w-2xl">
                  <StudySuggestions
                    questionSets={questionSets}
                    theme={homeContent.theme === 'dark' ? 'dark' : 'light'}
                  />
                </div>
              </>
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
          
          {/* 显示题库列表 */}
          {categoryLoading ? (
            <div className="text-center py-8">
              <svg className="animate-spin h-8 w-8 mx-auto text-blue-500" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
              </svg>
              <p className="mt-2 text-sm text-gray-500">加载中...</p>
            </div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
              {getFilteredQuestionSets().map(questionSet => {
                const { hasAccess, remainingDays } = getQuestionSetAccessStatus(questionSet);
                const isPaid = questionSet.isPaid;
                
                return (
                  <div 
                    key={questionSet.id}
                    className={`bg-white rounded-lg shadow-md overflow-hidden ${
                      !hasAccess && isPaid ? 'opacity-75' : ''
                    }`}
                  >
                    <div className="p-6">
                      <div className="flex justify-between items-start mb-4">
                        <h3 className="text-xl font-semibold text-gray-900">
                          {questionSet.title}
                        </h3>
                        {isPaid && (
                          <span className="px-2 py-1 text-sm font-medium text-yellow-800 bg-yellow-100 rounded-full">
                            ¥{questionSet.price}
                          </span>
                        )}
                      </div>
                      
                      <p className="text-gray-600 mb-4">{questionSet.description}</p>
                      
                      <div className="flex items-center justify-between mb-4">
                        <span className="text-sm text-gray-500">
                          {questionSet.questions?.length || 0} 道题目
                        </span>
                        {isPaid && user && hasAccess && remainingDays !== null && (
                          <span className="text-sm text-green-600">
                            剩余 {remainingDays} 天
                          </span>
                        )}
                      </div>
                      
                      {/* 用户进度指示器 */}
                      {renderProgressBar(questionSet)}
                      
                      <button
                        onClick={() => handleStartQuiz(questionSet)}
                        className={`w-full py-2 px-4 rounded-md text-white font-medium ${
                          !hasAccess && isPaid
                            ? 'bg-gray-400 cursor-not-allowed'
                            : 'bg-blue-600 hover:bg-blue-700'
                        }`}
                        disabled={!hasAccess && isPaid}
                      >
                        {!hasAccess && isPaid
                          ? '需要购买'
                          : user && user.progress && user.progress[questionSet.id]
                            ? '继续练习'
                            : '开始练习'}
                      </button>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
          
          {/* 错误消息显示 */}
          {errorMessage && (
            <div className="max-w-4xl mx-auto mb-6 bg-red-100 border border-red-400 text-red-700 px-4 py-3 rounded">
              <p>{errorMessage}</p>
            </div>
          )}
        </div>
      </div>

      <div className="mt-10 max-w-4xl mx-auto px-4 sm:px-6 lg:px-8">
        {isAdmin() && (
          <div className="mb-10">
            <h2 className="text-xl font-bold mb-4">管理员工具</h2>
            <SocketTest />
          </div>
        )}
      </div>
    </div>
  );
};

export default HomePage;