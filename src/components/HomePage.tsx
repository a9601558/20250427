import React, { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import axios from 'axios';
import { QuestionSet } from '../data/questionSets';
import UserMenu from './UserMenu';
import { useUser } from '../contexts/UserContext';
import LoginModal from './LoginModal';

// 首页内容接口
interface HomeContent {
  welcomeTitle: string;
  welcomeDescription: string;
  featuredCategories: string[];
  announcements: string;
  footerText: string;
  bannerImage?: string;
  theme?: 'light' | 'dark' | 'auto';
}

// 默认首页内容
const defaultHomeContent: HomeContent = {
  welcomeTitle: "ExamTopics 模拟练习",
  welcomeDescription: "选择以下任一题库开始练习，测试您的知识水平",
  featuredCategories: ["网络协议", "编程语言", "计算机基础"],
  announcements: "欢迎使用在线题库系统，新增题库将定期更新，请持续关注！",
  footerText: "© 2023 ExamTopics 在线题库系统 保留所有权利",
  bannerImage: "https://via.placeholder.com/1500x500/4F46E5/FFFFFF?text=考试练习系统",
  theme: 'light'
};

const HomePage: React.FC = () => {
  const { user, isAdmin, getPurchaseExpiry } = useUser();
  const [questionSets, setQuestionSets] = useState<QuestionSet[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [welcomeData, setWelcomeData] = useState({
    title: '在线题库练习系统',
    description: '选择以下任一题库开始练习，测试您的知识水平'
  });
  const homeContent = useState<HomeContent>(defaultHomeContent)[0];
  const [isLoginModalOpen, setIsLoginModalOpen] = useState(false);
  const [showUserInfo, setShowUserInfo] = useState(false);

  // 获取首页设置和题库列表
  useEffect(() => {
    const fetchData = async () => {
      try {
        setLoading(true);
        setError(null);

        // 不再单独检查API服务器健康状态
        // 直接尝试获取题库列表，如果成功则表示服务器在线
        try {
          // 获取题库列表
          const quizResponse = await axios.get('/api/question-sets');
          setQuestionSets(Array.isArray(quizResponse.data) ? quizResponse.data : []);
          
          // 如果题库列表获取成功，继续获取首页设置
          try {
            const settingsResponse = await axios.get('/api/homepage/content');
            if (settingsResponse.data && settingsResponse.data.success && settingsResponse.data.data) {
              // 确保使用从API返回的data字段中的数据
              const contentData = settingsResponse.data.data;
              setWelcomeData({
                title: contentData.welcomeTitle || defaultHomeContent.welcomeTitle,
                description: contentData.welcomeDescription || defaultHomeContent.welcomeDescription
              });
              
              // 更新其他首页内容
              // 这里我们不能直接修改homeContent，因为它是一个useState，而且传入了defaultHomeContent
              // 如果需要完整替换，应该使用useState的第二个返回值，如setHomeContent(contentData)
            }
          } catch (err) {
            console.error('获取首页设置失败:', err);
            // 使用默认设置，不显示错误
          }
        } catch (err) {
          console.error('获取题库列表失败:', err);
          setError('无法连接到服务器，请确保后端服务正在运行');
          // 确保即使请求失败，questionSets也是一个空数组
          setQuestionSets([]);
        }
      } catch (err) {
        console.error('加载过程发生错误:', err);
        setError('加载数据时发生错误，请稍后重试');
        setQuestionSets([]);
      } finally {
        setLoading(false);
      }
    };

    fetchData();
  }, []);

  // 按类别分组题库 - 确保questionSets是数组
  const groupedSets = (Array.isArray(questionSets) ? questionSets : []).reduce((acc, set) => {
    if (!acc[set.category]) {
      acc[set.category] = [];
    }
    acc[set.category].push(set);
    return acc;
  }, {} as Record<string, QuestionSet[]>);

  // 格式化到期日期为用户友好的格式
  const formatExpiryDate = (dateInput: Date | string | null) => {
    if (!dateInput) return '';
    
    const date = dateInput instanceof Date ? dateInput : new Date(dateInput);
    return date.toLocaleDateString();
  };

  // 计算剩余天数
  const calculateRemainingDays = (dateInput: Date | string | null) => {
    if (!dateInput) return 0;
    
    const expiryDate = dateInput instanceof Date ? dateInput : new Date(dateInput);
    const today = new Date();
    const diffTime = expiryDate.getTime() - today.getTime();
    const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));
    
    return diffDays > 0 ? diffDays : 0;
  };

  // 根据主题设置页面背景色
  const bgClass = homeContent.theme === 'dark' 
    ? 'min-h-screen bg-gray-800 py-6 flex flex-col justify-center sm:py-12 text-white' 
    : 'min-h-screen bg-gray-50 py-6 flex flex-col justify-center sm:py-12';

  // 获取要显示的分类
  const displayCategories = (): string[] => {
    // 如果有精选分类，先显示精选分类，然后是其他分类
    if (homeContent.featuredCategories?.length > 0) {
      return [...new Set([...homeContent.featuredCategories, ...Object.keys(groupedSets)])];
    }
    return Object.keys(groupedSets);
  };

  // 按分类或精选分类获取题库
  const getQuestionSetsByCategory = (category: string): QuestionSet[] => {
    // 首先检查是否是精选分类
    const featuredInCategory = questionSets.filter(
      set => set.isFeatured && set.featuredCategory === category
    );
    
    // 如果是精选分类且有题库，返回这些题库
    if (featuredInCategory.length > 0) {
      return featuredInCategory;
    }
    
    // 否则返回普通分类下的题库
    return questionSets.filter(set => set.category === category);
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
            
            {!user && (
              <div className={`mt-6 ${homeContent.theme === 'dark' ? 'bg-blue-900' : 'bg-gradient-to-r from-blue-50 to-indigo-50'} border ${homeContent.theme === 'dark' ? 'border-blue-800' : 'border-blue-100'} rounded-lg p-6 mx-auto max-w-2xl shadow-sm`}>
                <h3 className={`text-lg font-medium ${homeContent.theme === 'dark' ? 'text-blue-300' : 'text-blue-800'} mb-2`}>随时开始，无需登录</h3>
                <p className={`text-sm ${homeContent.theme === 'dark' ? 'text-blue-200' : 'text-blue-600'} mb-4`}>
                  您可以直接开始答题，但登录后可以保存答题进度、查看错题记录，以及收藏喜欢的题库。
                </p>
                <button 
                  onClick={() => setIsLoginModalOpen(true)}
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

          {/* 错误消息 */}
          {error && (
            <div className="bg-red-100 border border-red-400 text-red-700 px-4 py-3 rounded mb-6">
              {error}
            </div>
          )}
          
          {/* 题库列表 */}
          {!loading && Object.keys(groupedSets).length === 0 && (
            <div className="text-center py-12 bg-white rounded-lg shadow">
              <p className="text-gray-500">暂无题库</p>
            </div>
          )}
          
          {/* 分类显示 - 按照精选分类优先排序 */}
          <div className="space-y-8">
            {displayCategories().map(category => (
              <div key={category} className={`${homeContent.theme === 'dark' ? 'bg-gray-700' : 'bg-white'} overflow-hidden shadow-md rounded-lg`}>
                <div className={`${homeContent.theme === 'dark' ? 'bg-gray-800' : 'bg-gray-50'} px-4 py-3 border-b ${homeContent.theme === 'dark' ? 'border-gray-600' : 'border-gray-200'}`}>
                  <h2 className={`text-xl font-semibold ${homeContent.theme === 'dark' ? 'text-white' : 'text-gray-800'}`}>{category}</h2>
                </div>
                <div className="grid grid-cols-1 gap-4 p-4 sm:grid-cols-2 md:grid-cols-3">
                  {getQuestionSetsByCategory(category).map(set => {
                    // 检查用户是否购买了此题库，以及获取过期时间
                    const isPaid = set.isPaid;
                    const expiry = user && isPaid ? getPurchaseExpiry(set.id) : null;
                    const hasPaid = user && isPaid && expiry !== null;
                    const remainingDays = calculateRemainingDays(expiry);

                    return (
                      <Link
                        to={`/quiz/${set.id}`}
                        key={set.id}
                        className={`block relative p-4 ${homeContent.theme === 'dark' ? 'bg-gray-600 hover:bg-gray-500' : 'bg-white hover:bg-gray-50'} border ${homeContent.theme === 'dark' ? 'border-gray-500' : 'border-gray-200'} rounded-lg transition-transform transform hover:scale-105 hover:shadow-lg`}
                      >
                        {/* 付费标识 */}
                        {isPaid && (
                          <div className="absolute top-2 right-2">
                            {hasPaid ? (
                              <span className="px-2 py-1 bg-green-100 text-green-800 text-xs font-medium rounded-full">
                                已购买 · 剩余 {remainingDays} 天
                              </span>
                            ) : (
                              <span className="px-2 py-1 bg-yellow-100 text-yellow-800 text-xs font-medium rounded-full">
                                付费 · ¥{set.price}
                              </span>
                            )}
                          </div>
                        )}

                        {/* 精选标识 */}
                        {set.isFeatured && (
                          <div className="absolute top-2 left-2">
                            <span className="px-2 py-1 bg-blue-100 text-blue-800 text-xs font-medium rounded-full">
                              精选
                            </span>
                          </div>
                        )}

                        <div className="flex items-center">
                          <div className="flex-shrink-0 text-3xl mr-3">{set.icon}</div>
                          <div>
                            <h3 className={`text-lg font-semibold ${homeContent.theme === 'dark' ? 'text-white' : 'text-gray-800'}`}>{set.title}</h3>
                            <p className={`mt-1 text-sm ${homeContent.theme === 'dark' ? 'text-gray-300' : 'text-gray-500'}`}>{set.description}</p>
                            <div className="mt-2 flex items-center justify-between">
                              <span className={`text-xs ${homeContent.theme === 'dark' ? 'text-gray-400' : 'text-gray-400'}`}>{set.questions?.length || 0} 个问题</span>
                              {isPaid && hasPaid && (
                                <span className={`text-xs ${homeContent.theme === 'dark' ? 'text-blue-300' : 'text-blue-600'}`}>
                                  到期日期: {formatExpiryDate(expiry)}
                                </span>
                              )}
                              {isPaid && set.trialQuestions && set.trialQuestions > 0 && !hasPaid && (
                                <span className={`text-xs ${homeContent.theme === 'dark' ? 'text-blue-300' : 'text-blue-600'}`}>
                                  免费试用 {set.trialQuestions} 题
                                </span>
                              )}
                            </div>
                          </div>
                        </div>
                      </Link>
                    );
                  })}
                </div>
              </div>
            ))}
          </div>
          
          {/* 页脚 */}
          {homeContent.footerText && (
            <div className={`mt-8 text-center ${homeContent.theme === 'dark' ? 'text-gray-400' : 'text-gray-500'} text-sm`}>
              {homeContent.footerText}
            </div>
          )}
        </div>
      </div>
      
      {/* 登录弹窗 */}
      <LoginModal isOpen={isLoginModalOpen} onClose={() => setIsLoginModalOpen(false)} />
    </div>
  );
};

export default HomePage; 