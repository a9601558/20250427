import React, { useState, useEffect, useCallback } from 'react';
import { Link } from 'react-router-dom';
import axios from 'axios';
import { QuestionSet } from '../types';
import UserMenu from './UserMenu';
import { useUser } from '../contexts/UserContext';
import UserProgressDisplay from './UserProgressDisplay';
import RecentlyStudiedQuestionSets from './RecentlyStudiedQuestionSets';
import StudySuggestions from './StudySuggestions';
import SocketTest from './SocketTest';

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

const HomePage: React.FC = () => {
  const { user, isAdmin, getRemainingAccessDays } = useUser();
  const [questionSets, setQuestionSets] = useState<QuestionSet[]>([]);
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

  // 获取首页设置、分类和题库列表
  useEffect(() => {
    const fetchData = async () => {
      try {
        setLoading(true);
        setErrorMessage(null);

        // 获取所有题库列表
        const quizResponse = await axios.get('/api/question-sets');
        if (quizResponse.data && quizResponse.data.success && quizResponse.data.data) {
          const questionSetsData = quizResponse.data.data;
          console.log('获取到题库列表:', questionSetsData.length);
          setQuestionSets(questionSetsData);
          
          // 为每个题库获取题目
          for (const set of questionSetsData) {
            try {
              const questionsResponse = await axios.get(`/api/questions?questionSetId=${set.id}&include=options`);
              if (questionsResponse.data && questionsResponse.data.success) {
                console.log(`题库 ${set.id} 包含 ${questionsResponse.data.data.length} 个题目`);
                // 更新题库中的题目数据
                set.questions = questionsResponse.data.data;
              }
            } catch (err) {
              console.warn(`获取题库 ${set.id} 的题目失败:`, err);
            }
          }
          
          // 使用更新后的题库数据
          setQuestionSets([...questionSetsData]);
        } else {
          setErrorMessage('获取题库列表失败');
        }

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

  // 切换分类
  const handleCategoryChange = useCallback(async (category: string) => {
    setActiveCategory(category);
    
    try {
      setCategoryLoading(true);
      let response;
      
      // 获取题库数据
      if (category === 'all') {
        // 获取所有题库
        response = await axios.get('/api/question-sets');
      } else {
        // 获取特定分类的题库
        const encodedCategory = encodeURIComponent(category);
        response = await axios.get(`/api/question-sets/by-category/${encodedCategory}`);
      }
      
      if (response.data && response.data.success && response.data.data) {
        const questionSetsData = response.data.data;
        
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
        
        setQuestionSets(questionSetsData);
      } else {
        setErrorMessage('获取题库数据失败');
      }
    } catch (error) {
      console.error(`获取分类 ${category} 的题库失败:`, error);
      setErrorMessage('获取分类题库失败');
    } finally {
      setCategoryLoading(false);
    }
  }, []);

  // 获取剩余天数的文字描述
  const calculateRemainingDaysText = (days: number | null): string => {
    if (days === null) return '';
    if (days <= 0) return '已过期';
    if (days === 1) return '剩余1天';
    return `剩余${days}天`;
  };

  // 根据主题设置页面背景色
  const bgClass = homeContent.theme === 'dark' 
    ? 'min-h-screen bg-gray-800 py-6 flex flex-col justify-center sm:py-12 text-white' 
    : 'min-h-screen bg-gray-50 py-6 flex flex-col justify-center sm:py-12';

  // 获取要显示的题库
  const getFilteredQuestionSets = (): QuestionSet[] => {
    if (!questionSets || questionSets.length === 0) {
      return [];
    }
    
    // 如果有精选分类，优先显示精选分类的题库
    if (homeContent.featuredCategories && homeContent.featuredCategories.length > 0) {
      return questionSets.filter(set => 
        homeContent.featuredCategories.includes(set.category)
      );
    }
    
    // 否则显示所有题库
    return questionSets;
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
                  <UserProgressDisplay
                    questionSets={questionSets}
                    limit={3}
                    className={homeContent.theme === 'dark' ? 'bg-gray-700 text-white border-gray-600' : 'bg-white'}
                  />
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
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6 px-2">
              {getFilteredQuestionSets().map(questionSet => (
                <div 
                  key={questionSet.id}
                  className={`border ${homeContent.theme === 'dark' ? 'bg-gray-700 border-gray-600' : 'bg-white border-gray-200'} rounded-lg shadow-md overflow-hidden transition-transform hover:shadow-lg hover:-translate-y-1`}
                >
                  <div className="p-5">
                    <div className="flex items-center mb-3">
                      <div className={`w-10 h-10 rounded-full flex items-center justify-center ${homeContent.theme === 'dark' ? 'bg-gray-600' : 'bg-blue-100'}`}>
                        <span className={`text-xl ${homeContent.theme === 'dark' ? 'text-blue-300' : 'text-blue-600'}`}>
                          {questionSet.icon || '📚'}
                        </span>
                      </div>
                      <div className="flex-1 ml-3">
                        <div className="flex items-center justify-between">
                          <h3 className={`text-lg font-medium ${homeContent.theme === 'dark' ? 'text-white' : 'text-gray-900'} truncate`}>
                            {questionSet.title}
                          </h3>
                          {questionSet.isPaid ? (
                            <span className={`ml-2 px-2 py-1 text-xs rounded-full ${homeContent.theme === 'dark' ? 'bg-yellow-800 text-yellow-200' : 'bg-yellow-100 text-yellow-800'}`}>
                              ¥{questionSet.price}
                            </span>
                          ) : (
                            <span className={`ml-2 px-2 py-1 text-xs rounded-full ${homeContent.theme === 'dark' ? 'bg-green-800 text-green-200' : 'bg-green-100 text-green-800'}`}>
                              免费
                            </span>
                          )}
                        </div>
                      </div>
                    </div>
                    
                    <p className={`text-sm ${homeContent.theme === 'dark' ? 'text-gray-300' : 'text-gray-500'} mb-4 line-clamp-2`}>
                      {questionSet.description}
                    </p>
                    
                    <div className="flex items-center justify-between mb-4">
                      <span className={`text-xs px-2.5 py-0.5 rounded-full ${homeContent.theme === 'dark' ? 'bg-gray-600 text-gray-300' : 'bg-blue-50 text-blue-600'}`}>
                        {questionSet.category}
                      </span>
                      
                      <span className={`text-xs px-2.5 py-0.5 rounded-full ${homeContent.theme === 'dark' ? 'bg-gray-600 text-gray-300' : 'bg-green-50 text-green-600'}`}>
                        {questionSet.questions ? `${questionSet.questions.length} 题` : `${questionSet.questionCount || 0} 题`}
                      </span>
                      
                      {user && questionSet.isPaid && (
                        <span className={`text-xs px-2.5 py-0.5 rounded-full ${
                          user.purchases?.some(p => p.questionSetId === questionSet.id)
                            ? `${homeContent.theme === 'dark' ? 'bg-green-900 text-green-300' : 'bg-green-50 text-green-600'}`
                            : `${homeContent.theme === 'dark' ? 'bg-yellow-900 text-yellow-300' : 'bg-yellow-50 text-yellow-600'}`
                        }`}>
                          {user.purchases?.some(p => p.questionSetId === questionSet.id) 
                            ? `已购买 ${calculateRemainingDaysText(getRemainingAccessDays(questionSet.id))}`
                            : `¥${questionSet.price || 0}`}
                        </span>
                      )}
                    </div>
                    
                    {/* 用户进度指示器 */}
                    {user && user.progress && user.progress[questionSet.id] && (
                      <div className="mb-4">
                        <div className="flex justify-between text-xs text-gray-500 mb-1">
                          <span>完成进度</span>
                          <span>
                            {Math.round((user.progress[questionSet.id].completedQuestions / user.progress[questionSet.id].totalQuestions) * 100)}%
                          </span>
                        </div>
                        <div className="w-full bg-gray-200 rounded-full h-1.5">
                          <div 
                            className="bg-blue-600 h-1.5 rounded-full" 
                            style={{ width: `${(user.progress[questionSet.id].completedQuestions / user.progress[questionSet.id].totalQuestions) * 100}%` }}
                          />
                        </div>
                        <div className="flex justify-between text-xs mt-1">
                          <span className={`${homeContent.theme === 'dark' ? 'text-gray-400' : 'text-gray-500'}`}>
                            {user.progress[questionSet.id].completedQuestions}/{user.progress[questionSet.id].totalQuestions} 题
                          </span>
                          {user.progress[questionSet.id].correctAnswers > 0 && (
                            <span className={`font-medium ${homeContent.theme === 'dark' ? 'text-green-400' : 'text-green-600'}`}>
                              正确率: {Math.round((user.progress[questionSet.id].correctAnswers / user.progress[questionSet.id].completedQuestions) * 100)}%
                            </span>
                          )}
                        </div>
                      </div>
                    )}
                    
                    <Link 
                      to={`/quiz/${questionSet.id}`}
                      className={`block w-full px-4 py-2 text-center rounded-md text-white font-medium ${
                        homeContent.theme === 'dark'
                          ? 'bg-blue-600 hover:bg-blue-700'
                          : 'bg-blue-600 hover:bg-blue-700'
                      }`}
                    >
                      {user && user.progress && user.progress[questionSet.id] ? '继续练习' : '开始练习'}
                    </Link>
                  </div>
                </div>
              ))}
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