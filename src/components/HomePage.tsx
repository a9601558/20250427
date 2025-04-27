import React, { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import axios from 'axios';
import { QuestionSet } from '../types';
import UserMenu from './UserMenu';
import { useUser } from '../contexts/UserContext';
import LoginModal from './LoginModal';

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
  const { user, isAdmin } = useUser();
  const [questionSets, setQuestionSets] = useState<QuestionSet[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [welcomeData, setWelcomeData] = useState({
    title: '在线题库练习系统',
    description: '选择以下任一题库开始练习，测试您的知识水平'
  });
  // 使用完整的状态管理
  const [homeContent, setHomeContent] = useState<HomeContentData>(defaultHomeContent);
  const [isLoginModalOpen, setIsLoginModalOpen] = useState(false);
  const [showUserInfo, setShowUserInfo] = useState(false);

  // 获取首页设置和题库列表
  useEffect(() => {
    const fetchData = async () => {
      try {
        setLoading(true);
        setError(null);

        try {
          // 获取首页设置
          const settingsResponse = await axios.get('/api/homepage/content');
          let contentData;
          if (settingsResponse.data && settingsResponse.data.success && settingsResponse.data.data) {
            // 获取首页设置
            contentData = settingsResponse.data.data;
            // 更新欢迎信息
            setWelcomeData({
              title: contentData.welcomeTitle || defaultHomeContent.welcomeTitle,
              description: contentData.welcomeDescription || defaultHomeContent.welcomeDescription
            });
            // 更新整个首页内容
            setHomeContent(contentData);
          }
          
          // 获取精选题库列表
          const featuredResponse = await axios.get('/api/homepage/featured-question-sets');
          if (featuredResponse.data && featuredResponse.data.success && featuredResponse.data.data) {
            // 确保获取到的是数组且有数据
            const featuredQuestionSets = Array.isArray(featuredResponse.data.data) ? featuredResponse.data.data : [];
            
            if (featuredQuestionSets.length > 0) {
              setQuestionSets(featuredQuestionSets);
            } else {
              // 如果没有精选题库，获取所有题库列表
              const quizResponse = await axios.get('/api/question-sets');
              if (quizResponse.data && quizResponse.data.success && quizResponse.data.data) {
                setQuestionSets(Array.isArray(quizResponse.data.data) ? quizResponse.data.data : []);
              } else {
                setQuestionSets([]);
              }
            }
          } else {
            // 如果精选接口请求失败，获取所有题库列表
            const quizResponse = await axios.get('/api/question-sets');
            if (quizResponse.data && quizResponse.data.success && quizResponse.data.data) {
              setQuestionSets(Array.isArray(quizResponse.data.data) ? quizResponse.data.data : []);
            } else {
              setQuestionSets([]);
            }
          }
        } catch (err) {
          console.error('获取数据失败:', err);
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

  // 根据主题设置页面背景色
  const bgClass = homeContent.theme === 'dark' 
    ? 'min-h-screen bg-gray-800 py-6 flex flex-col justify-center sm:py-12 text-white' 
    : 'min-h-screen bg-gray-50 py-6 flex flex-col justify-center sm:py-12';

  // 获取要显示的分类
  const displayCategories = (): string[] => {
    // 首先创建普通分类列表（包含题库的分类）
    const regularCategories = Object.keys(groupedSets);
    
    // 如果有精选分类，检查哪些分类包含精选题库
    if (homeContent.featuredCategories?.length > 0) {
      // 找出所有包含精选题库的分类
      const featuredCategories = homeContent.featuredCategories.filter(category => 
        questionSets.some(set => set.isFeatured && set.featuredCategory === category)
      );
      
      // 如果有包含精选题库的分类，优先显示这些分类，然后是其他普通分类
      if (featuredCategories.length > 0) {
        // 合并并去重分类列表
        return [...new Set([...featuredCategories, ...regularCategories])];
      }
    }
    
    // 如果没有精选分类，或者精选分类中没有题库，则返回所有普通分类
    return regularCategories;
  };

  // 按分类或精选分类获取题库
  const getQuestionSetsByCategory = (category: string): QuestionSet[] => {
    // 如果是精选分类，优先返回这个分类的精选题库
    if (homeContent.featuredCategories?.includes(category)) {
      const featuredInCategory = questionSets.filter(
        set => set.isFeatured && set.featuredCategory === category
      );
      
      // 如果有精选题库，返回这些题库
      if (featuredInCategory.length > 0) {
        return featuredInCategory;
      }
    }
    
    // 如果不是精选分类，或者精选分类没有精选题库，返回普通分类下的题库
    return questionSets.filter(set => set.category === category);
  };

  // 检查当前获取的题库数据是否完整
  useEffect(() => {
    // 如果有题库但没有题目，打印日志帮助调试
    if (questionSets.length > 0) {
      console.log(`共加载了 ${questionSets.length} 个题库`);
      
      // 打印每个题库的题目数量
      questionSets.forEach(set => {
        // 由于API返回的是questionCount而不是questions数组
        console.log(`题库 ${set.title} 包含 ${set.questionCount || 0} 题`);
      });
    }
  }, [questionSets]);

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
          
          {/* 显示题库分类列表 */}
          <div className="grid grid-cols-1 gap-6 mt-8">
            {displayCategories().map(category => (
              <div key={category} className="bg-white shadow-md rounded-lg p-4">
                <h3 className={`text-xl font-bold mb-4 ${homeContent.theme === 'dark' ? 'text-blue-300' : 'text-blue-700'}`}>
                  {category}
                </h3>
                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
                  {getQuestionSetsByCategory(category).map((set) => (
                    <div 
                      key={set.id} 
                      className={`border rounded-lg p-4 transition duration-300 ease-in-out transform hover:scale-105 hover:shadow-lg ${homeContent.theme === 'dark' ? 'border-gray-700 bg-gray-700 text-white' : 'border-gray-200 bg-white'}`}
                    >
                      <div className="flex justify-between items-start">
                        <h4 className="text-lg font-semibold mb-2">{set.title}</h4>
                        {set.isFeatured && (
                          <span className="bg-yellow-100 text-yellow-800 text-xs font-medium mr-2 px-2.5 py-0.5 rounded">
                            精选
                          </span>
                        )}
                      </div>
                      <p className={`text-sm mb-3 h-12 overflow-hidden ${homeContent.theme === 'dark' ? 'text-gray-300' : 'text-gray-600'}`}>
                        {set.description.length > 60 ? set.description.substring(0, 60) + '...' : set.description}
                      </p>
                      
                      {/* 题库信息 */}
                      <div className={`flex items-center justify-between mb-4 text-sm ${homeContent.theme === 'dark' ? 'text-gray-300' : 'text-gray-600'}`}>
                        <span>
                          <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4 inline mr-1" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8.228 9c.549-1.165 2.03-2 3.772-2 2.21 0 4 1.343 4 3 0 1.4-1.278 2.575-3.006 2.907-.542.104-.994.54-.994 1.093m0 3h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                          </svg>
                          {/* 如果questions不存在，则使用questionCount */}
                          {set.questions?.length || set.questionCount || 0} 题
                        </span>
                        {set.isPaid && (
                          <span className="bg-red-100 text-red-800 text-xs font-medium px-2.5 py-0.5 rounded">
                            ¥{set.price}
                          </span>
                        )}
                      </div>
                      
                      <Link
                        to={`/practice/${set.id}`}
                        className={`block w-full text-center py-2 rounded font-medium transition duration-300 ${
                          homeContent.theme === 'dark' 
                            ? 'bg-blue-600 text-white hover:bg-blue-700' 
                            : 'bg-blue-500 text-white hover:bg-blue-600'
                        }`}
                      >
                        开始练习
                      </Link>
                    </div>
                  ))}
                </div>
              </div>
            ))}
            
            {displayCategories().length === 0 && (
              <div className="text-center py-8">
                <p className={`text-lg ${homeContent.theme === 'dark' ? 'text-gray-300' : 'text-gray-600'}`}>
                  暂无题库可用，请稍后再试。
                </p>
              </div>
            )}
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