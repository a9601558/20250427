import React, { useState, useEffect, useCallback } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { useUser } from '../contexts/UserContext';
import { homepageService } from '../services/api';
import apiClient from '../utils/api-client';
import { toast } from 'react-toastify';

// 复用HomePage.tsx中的类型定义
type AccessType = 'trial' | 'paid' | 'expired' | 'redeemed';

interface QuestionSet {
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
  featuredCategory?: string;
  createdAt: Date;
  updatedAt: Date;
  hasAccess?: boolean;
  remainingDays?: number | null;
  paymentMethod?: string;
  questions?: { id: string }[];
  questionSetQuestions?: { id: string }[];
  validityPeriod?: number;
  accessType?: AccessType;
}

interface HomeContentData {
  featuredCategories: string[];
}

const QuestionSetSearchPage: React.FC = () => {
  const { user } = useUser();
  const navigate = useNavigate();
  const [questionSets, setQuestionSets] = useState<QuestionSet[]>([]);
  const [filteredSets, setFilteredSets] = useState<QuestionSet[]>([]);
  const [categories, setCategories] = useState<string[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedCategory, setSelectedCategory] = useState<string>('all');
  const [selectedStatus, setSelectedStatus] = useState<string>('all');
  const [homeContent, setHomeContent] = useState<HomeContentData>({ featuredCategories: [] });
  const [view, setView] = useState<'grid' | 'list'>('list');
  const [sortOption, setSortOption] = useState<string>('newest');
  const [showFilters, setShowFilters] = useState(false);

  // 获取题库列表
  const fetchQuestionSets = useCallback(async () => {
    try {
      setLoading(true);
      
      const response = await apiClient.get('/api/question-sets', 
        user?.id ? { userId: user.id, _t: Date.now() } : { _t: Date.now() }
      );
      
      if (response && response.success && response.data) {
        // 处理返回的数据，确保日期格式正确
        const processedData = (response.data as QuestionSet[]).map((set: QuestionSet) => ({
          ...set,
          // 确保createdAt和updatedAt是有效的日期格式
          createdAt: set.createdAt || new Date().toISOString(),
          updatedAt: set.updatedAt || new Date().toISOString(),
          // 确保questionCount存在
          questionCount: typeof set.questionCount === 'number' ? set.questionCount : 
                         (set.questionSetQuestions?.length || set.questions?.length || 0)
        }));
        
        setQuestionSets(processedData);
        
        // 提取所有唯一分类
        const uniqueCategories: string[] = Array.from(
          new Set(processedData.map((item: QuestionSet) => item.category))
        ).sort();
        
        setCategories(uniqueCategories);
        
        // 初始化过滤结果
        setFilteredSets(processedData);
      }
    } catch (error) {
      console.error('获取题库列表失败:', error);
      toast.error('获取题库列表失败');
    } finally {
      setLoading(false);
    }
  }, [user?.id]);

  // 获取首页内容（用于获取精选分类）
  const fetchHomeContent = useCallback(async () => {
    try {
      const response = await homepageService.getHomeContent();
      if (response.success && response.data) {
        setHomeContent(response.data);
      }
    } catch (error) {
      console.error('获取首页内容失败:', error);
    }
  }, []);

  // 初始加载
  useEffect(() => {
    fetchQuestionSets();
    fetchHomeContent();
  }, [fetchQuestionSets, fetchHomeContent]);

  // 根据搜索、分类和状态筛选题库
  useEffect(() => {
    if (!questionSets.length) return;

    // 应用筛选器
    let results = [...questionSets];
    
    // 搜索筛选
    if (searchTerm) {
      const term = searchTerm.toLowerCase();
      results = results.filter(
        set => 
          set.title.toLowerCase().includes(term) || 
          set.description.toLowerCase().includes(term) || 
          set.category.toLowerCase().includes(term)
      );
    }
    
    // 分类筛选
    if (selectedCategory && selectedCategory !== 'all') {
      results = results.filter(set => set.category === selectedCategory);
    }
    
    // 状态筛选
    if (selectedStatus !== 'all') {
      switch (selectedStatus) {
        case 'free':
          results = results.filter(set => !set.isPaid);
          break;
        case 'paid':
          results = results.filter(set => set.isPaid && !set.hasAccess);
          break;
        case 'purchased':
          results = results.filter(set => set.hasAccess && set.accessType !== 'expired');
          break;
        case 'expired':
          results = results.filter(set => set.accessType === 'expired');
          break;
        case 'featured':
          results = results.filter(set => set.isFeatured);
          break;
      }
    }
    
    // 应用排序
    switch (sortOption) {
      case 'newest':
        results.sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());
        break;
      case 'oldest':
        results.sort((a, b) => new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime());
        break;
      case 'nameAsc':
        results.sort((a, b) => a.title.localeCompare(b.title));
        break;
      case 'nameDesc':
        results.sort((a, b) => b.title.localeCompare(a.title));
        break;
      case 'priceAsc':
        results.sort((a, b) => (a.price || 0) - (b.price || 0));
        break;
      case 'priceDesc':
        results.sort((a, b) => (b.price || 0) - (a.price || 0));
        break;
    }
    
    setFilteredSets(results);
  }, [questionSets, searchTerm, selectedCategory, selectedStatus, sortOption]);

  // 处理题库点击
  const handleQuestionSetClick = (id: string) => {
    navigate(`/quiz/${id}`);
  };

  // 重置所有过滤器
  const handleResetFilters = () => {
    setSearchTerm('');
    setSelectedCategory('all');
    setSelectedStatus('all');
    setSortOption('newest');
  };

  // 获取题目数量
  const getQuestionCount = (set: QuestionSet): number => {
    // 直接使用questionCount属性 (如果存在且为数字)
    if (typeof set.questionCount === 'number' && set.questionCount > 0) {
      return set.questionCount;
    }
    
    // 从questionSetQuestions数组计算数量
    if (set.questionSetQuestions && Array.isArray(set.questionSetQuestions)) {
      return set.questionSetQuestions.length;
    }
    
    // 从questions数组计算数量
    if (set.questions && Array.isArray(set.questions)) {
      return set.questions.length;
    }
    
    // 默认返回0
    return 0;
  };

  // 添加日期格式化函数
  const formatDate = (dateString: string | Date | undefined): string => {
    if (!dateString) return '未知日期';
    
    try {
      const date = new Date(dateString);
      // 检查是否为有效日期
      if (isNaN(date.getTime())) {
        return '未知日期';
      }
      return date.toLocaleDateString('zh-CN', {
        year: 'numeric',
        month: '2-digit',
        day: '2-digit'
      });
    } catch (error) {
      console.error('日期格式化错误:', error);
      return '未知日期';
    }
  };

  // 获取访问状态标签
  const getAccessLabel = (set: QuestionSet): JSX.Element => {
    if (!set.isPaid) {
      return <span className="px-2 py-1 text-xs bg-blue-100 text-blue-800 rounded-full">免费</span>;
    }
    
    if (set.hasAccess) {
      if (set.accessType === 'expired') {
        return <span className="px-2 py-1 text-xs bg-red-100 text-red-800 rounded-full">已过期</span>;
      }
      if (set.accessType === 'redeemed') {
        return <span className="px-2 py-1 text-xs bg-purple-100 text-purple-800 rounded-full">已兑换</span>;
      }
      return <span className="px-2 py-1 text-xs bg-green-100 text-green-800 rounded-full">已购买</span>;
    }
    
    return <span className="px-2 py-1 text-xs bg-yellow-100 text-yellow-800 rounded-full">付费</span>;
  };

  const renderGridView = () => (
    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
      {filteredSets.map(set => (
        <div 
          key={set.id}
          onClick={() => handleQuestionSetClick(set.id)}
          className="bg-white dark:bg-gray-800 rounded-xl shadow-lg hover:shadow-xl transition-all duration-300 transform hover:-translate-y-1 cursor-pointer overflow-hidden group"
        >
          <div className="p-6 relative">
            {/* 科技感背景装饰 */}
            <div className="absolute -right-4 -top-4 w-24 h-24 bg-blue-500 opacity-10 rounded-full blur-lg group-hover:bg-indigo-600 group-hover:opacity-20 transition-all"></div>
            <div className="absolute -left-6 -bottom-6 w-32 h-32 bg-purple-500 opacity-5 rounded-full blur-xl group-hover:opacity-10 transition-all"></div>
            
            <div className="flex justify-between items-start mb-3">
              <h3 className="text-lg font-semibold dark:text-white group-hover:text-blue-600 dark:group-hover:text-blue-400 transition-colors">{set.title}</h3>
              {getAccessLabel(set)}
            </div>
            
            <p className="text-sm text-gray-600 dark:text-gray-300 mb-4 line-clamp-2">{set.description}</p>
            
            <div className="flex items-center justify-between text-xs text-gray-500 dark:text-gray-400 mb-4">
              <div className="flex items-center">
                <svg className="w-4 h-4 mr-1" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8.228 9c.549-1.165 2.03-2 3.772-2 2.21 0 4 1.343 4 3 0 1.4-1.278 2.575-3.006 2.907-.542.104-.994.54-.994 1.093m0 3h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                </svg>
                <span>{getQuestionCount(set)}题</span>
              </div>
              <div className="flex items-center">
                <svg className="w-4 h-4 mr-1" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M7 7h.01M7 3h5c.512 0 1.024.195 1.414.586l7 7a2 2 0 010 2.828l-7 7a2 2 0 01-2.828 0l-7-7A1.994 1.994 0 013 12V7a4 4 0 014-4z" />
                </svg>
                <span>{set.category}</span>
              </div>
            </div>
            
            {set.isPaid && !set.hasAccess && (
              <div className="flex items-baseline">
                <span className="text-lg font-bold text-blue-600">¥{set.price}</span>
                {set.trialQuestions && (
                  <span className="ml-2 text-xs text-gray-500">可试用{set.trialQuestions}题</span>
                )}
              </div>
            )}
          </div>
          
          {/* 闪光效果 */}
          <div className="absolute inset-0 bg-gradient-to-r from-transparent via-white to-transparent opacity-0 group-hover:opacity-10 dark:group-hover:opacity-5 transform -translate-x-full group-hover:translate-x-full transition-all duration-1000 ease-in-out"></div>
        </div>
      ))}
    </div>
  );

  const renderListView = () => (
    <div className="overflow-hidden">
      <table className="min-w-full divide-y divide-gray-200 dark:divide-gray-700">
        <thead className="bg-gray-50 dark:bg-gray-800">
          <tr>
            <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">题库名称</th>
            <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">分类</th>
            <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">题目数量</th>
            <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">状态</th>
            <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">更新时间</th>
            <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">操作</th>
          </tr>
        </thead>
        <tbody className="bg-white dark:bg-gray-900 divide-y divide-gray-200 dark:divide-gray-800">
          {filteredSets.map((set, idx) => (
            <tr 
              key={set.id} 
              className={`hover:bg-gray-50 dark:hover:bg-gray-800 transition-colors ${idx % 2 === 0 ? 'bg-white dark:bg-gray-900' : 'bg-gray-50 dark:bg-gray-800/50'}`}
            >
              <td className="px-6 py-4 whitespace-nowrap">
                <div className="flex items-center">
                  <div>
                    <div className="text-sm font-medium text-gray-900 dark:text-white">{set.title}</div>
                    <div className="text-sm text-gray-500 dark:text-gray-400 line-clamp-1">{set.description}</div>
                  </div>
                </div>
              </td>
              <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500 dark:text-gray-400">{set.category}</td>
              <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500 dark:text-gray-400">{getQuestionCount(set)}</td>
              <td className="px-6 py-4 whitespace-nowrap">{getAccessLabel(set)}</td>
              <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500 dark:text-gray-400">
                {formatDate(set.updatedAt)}
              </td>
              <td className="px-6 py-4 whitespace-nowrap text-right text-sm font-medium">
                <button
                  onClick={() => handleQuestionSetClick(set.id)}
                  className="text-indigo-600 hover:text-indigo-900 dark:text-indigo-400 dark:hover:text-indigo-300"
                >
                  开始学习
                </button>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );

  return (
    <div className="min-h-screen bg-gray-50 dark:bg-gray-900 pt-16 pb-12">
      {/* 高科技感的顶部区域 */}
      <div className="relative bg-gradient-to-r from-blue-900 via-indigo-900 to-purple-900 py-20 mb-8">
        {/* 科技背景元素 */}
        <div className="absolute inset-0 z-0 overflow-hidden">
          <div className="absolute top-0 right-0 w-96 h-96 bg-purple-500 rounded-full opacity-10 blur-3xl"></div>
          <div className="absolute bottom-0 left-0 w-96 h-96 bg-blue-500 rounded-full opacity-10 blur-3xl"></div>
          
          {/* 线条网格 */}
          <div className="absolute inset-0 bg-[url('data:image/svg+xml;base64,PHN2ZyB3aWR0aD0iNjAiIGhlaWdodD0iNjAiIHZpZXdCb3g9IjAgMCA2MCA2MCIgeG1sbnM9Imh0dHA6Ly93d3cudzMub3JnLzIwMDAvc3ZnIj48ZyBmaWxsPSJub25lIiBmaWxsLXJ1bGU9ImV2ZW5vZGQiPjxnIHN0cm9rZT0iIzMzMzMzMyIgc3Ryb2tlLXdpZHRoPSIwLjIiPjxwYXRoIGQ9Ik0zMCAzMGgzMHYzMGgtMzB6Ii8+PHBhdGggZD0iTTMwIDMwaC0zMHYzMGgzMHoiLz48cGF0aCBkPSJNMzAgMzB2LTMwaDMwdjMweiIvPjxwYXRoIGQ9Ik0zMCAzMHYtMzBoLTMwdjMweiIvPjwvZz48L2c+PC9zdmc+')] opacity-10"></div>
        </div>
        
        <div className="container mx-auto px-4 relative z-10">
          <div className="text-center mb-12">
            <h1 className="text-4xl md:text-5xl font-bold text-white mb-4">题库搜索</h1>
            <p className="text-xl text-blue-200 max-w-3xl mx-auto">
              浏览所有可用题库，找到最适合你的学习资源
            </p>
          </div>
          
          {/* 搜索栏 */}
          <div className="max-w-4xl mx-auto">
            <div className="flex flex-col md:flex-row md:items-center gap-4">
              <div className="relative flex-grow bg-white/10 backdrop-blur rounded-xl overflow-hidden border border-white/20">
                <input
                  type="text"
                  placeholder="搜索题库名称、描述或分类..."
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                  className="w-full px-12 py-4 bg-transparent border-none focus:outline-none focus:ring-0 text-white placeholder-blue-300"
                />
                <div className="absolute inset-y-0 left-0 pl-4 flex items-center pointer-events-none">
                  <svg className="h-5 w-5 text-blue-300" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20" fill="currentColor">
                    <path fillRule="evenodd" d="M8 4a4 4 0 100 8 4 4 0 000-8zM2 8a6 6 0 1110.89 3.476l4.817 4.817a1 1 0 01-1.414 1.414l-4.816-4.816A6 6 0 012 8z" clipRule="evenodd" />
                  </svg>
                </div>
                
                {searchTerm && (
                  <button
                    onClick={() => setSearchTerm('')}
                    className="absolute inset-y-0 right-0 pr-4 flex items-center text-blue-300 hover:text-white"
                  >
                    <svg className="h-5 w-5" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20" fill="currentColor">
                      <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zM8.707 7.293a1 1 0 00-1.414 1.414L8.586 10l-1.293 1.293a1 1 0 101.414 1.414L10 11.414l1.293 1.293a1 1 0 001.414-1.414L11.414 10l1.293-1.293a1 1 0 00-1.414-1.414L10 8.586 8.707 7.293z" clipRule="evenodd" />
                    </svg>
                  </button>
                )}
              </div>
              
              <button 
                onClick={() => setShowFilters(!showFilters)}
                className="px-5 py-4 bg-indigo-600 hover:bg-indigo-700 text-white rounded-xl flex items-center justify-center min-w-[120px] transition-colors"
              >
                <svg className="h-5 w-5 mr-2" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 4a1 1 0 011-1h16a1 1 0 011 1v2.586a1 1 0 01-.293.707l-6.414 6.414a1 1 0 00-.293.707V17l-4 4v-6.586a1 1 0 00-.293-.707L3.293 7.293A1 1 0 013 6.586V4z" />
                </svg>
                {showFilters ? "隐藏筛选" : "显示筛选"}
              </button>
              
              <div className="flex border border-white/20 rounded-xl overflow-hidden">
                <button 
                  onClick={() => setView('grid')}
                  className={`px-4 py-3 flex items-center justify-center ${view === 'grid' ? 'bg-white/20 text-white' : 'bg-transparent text-blue-300 hover:bg-white/10'}`}
                >
                  <svg className="h-5 w-5" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 6a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2H6a2 2 0 01-2-2V6zM14 6a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2h-2a2 2 0 01-2-2V6zM4 16a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2H6a2 2 0 01-2-2v-2zM14 16a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2h-2a2 2 0 01-2-2v-2z" />
                  </svg>
                </button>
                <button 
                  onClick={() => setView('list')}
                  className={`px-4 py-3 flex items-center justify-center ${view === 'list' ? 'bg-white/20 text-white' : 'bg-transparent text-blue-300 hover:bg-white/10'}`}
                >
                  <svg className="h-5 w-5" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 6h16M4 10h16M4 14h16M4 18h16" />
                  </svg>
                </button>
              </div>
            </div>
            
            {/* 过滤条件面板 */}
            {showFilters && (
              <div className="mt-4 p-5 bg-white/10 backdrop-blur rounded-xl border border-white/20 transition-all duration-300">
                <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                  {/* 分类过滤 */}
                  <div>
                    <label className="block text-sm font-medium text-blue-200 mb-2">分类</label>
                    <select
                      value={selectedCategory}
                      onChange={(e) => setSelectedCategory(e.target.value)}
                      className="w-full px-3 py-2 bg-white/10 border border-white/20 rounded-lg text-white focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-transparent"
                    >
                      <option value="all">所有分类</option>
                      {categories.map(category => (
                        <option key={category} value={category}>{category}</option>
                      ))}
                    </select>
                  </div>
                  
                  {/* 状态过滤 */}
                  <div>
                    <label className="block text-sm font-medium text-blue-200 mb-2">状态</label>
                    <select
                      value={selectedStatus}
                      onChange={(e) => setSelectedStatus(e.target.value)}
                      className="w-full px-3 py-2 bg-white/10 border border-white/20 rounded-lg text-white focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-transparent"
                    >
                      <option value="all">所有状态</option>
                      <option value="free">免费题库</option>
                      <option value="paid">付费题库</option>
                      <option value="purchased">已购买/已兑换</option>
                      <option value="expired">已过期</option>
                      <option value="featured">精选题库</option>
                    </select>
                  </div>
                  
                  {/* 排序过滤 */}
                  <div>
                    <label className="block text-sm font-medium text-blue-200 mb-2">排序</label>
                    <select
                      value={sortOption}
                      onChange={(e) => setSortOption(e.target.value)}
                      className="w-full px-3 py-2 bg-white/10 border border-white/20 rounded-lg text-white focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-transparent"
                    >
                      <option value="newest">最新发布</option>
                      <option value="oldest">最早发布</option>
                      <option value="nameAsc">名称 (A-Z)</option>
                      <option value="nameDesc">名称 (Z-A)</option>
                      <option value="priceAsc">价格 (低-高)</option>
                      <option value="priceDesc">价格 (高-低)</option>
                    </select>
                  </div>
                </div>
                
                <div className="mt-4 flex justify-end">
                  <button
                    onClick={handleResetFilters}
                    className="px-4 py-2 bg-white/10 hover:bg-white/20 text-white rounded-lg flex items-center transition-colors"
                  >
                    <svg className="h-4 w-4 mr-1.5" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
                    </svg>
                    重置筛选
                  </button>
                </div>
              </div>
            )}
          </div>
        </div>
        
        {/* 波浪形分隔线 */}
        <div className="absolute -bottom-1 left-0 right-0">
          <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 1440 320" className="w-full">
            <path fill="rgb(249, 250, 251)" fillOpacity="1" d="M0,192L48,176C96,160,192,128,288,133.3C384,139,480,181,576,186.7C672,192,768,160,864,138.7C960,117,1056,107,1152,117.3C1248,128,1344,160,1392,176L1440,192L1440,320L1392,320C1344,320,1248,320,1152,320C1056,320,960,320,864,320C768,320,672,320,576,320C480,320,384,320,288,320C192,320,96,320,48,320L0,320Z"></path>
          </svg>
        </div>
      </div>
      
      {/* 内容区域 */}
      <div className="container mx-auto px-4">
        {/* 结果统计 */}
        <div className="mb-6 flex justify-between items-center">
          <div className="flex items-center">
            <h2 className="text-xl font-semibold text-gray-800 dark:text-white">
              搜索结果
            </h2>
            <div className="ml-2 bg-indigo-100 text-indigo-800 dark:bg-indigo-800 dark:text-indigo-200 text-sm px-2.5 py-0.5 rounded-full">
              {filteredSets.length}个题库
            </div>
          </div>
          
          <div className="flex items-center text-sm text-gray-500 dark:text-gray-400">
            <Link to="/" className="flex items-center hover:text-indigo-600 dark:hover:text-indigo-400 transition-colors">
              <svg className="h-5 w-5 mr-1" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 19l-7-7m0 0l7-7m-7 7h18" />
              </svg>
              返回首页
            </Link>
          </div>
        </div>
        
        {/* 加载状态 */}
        {loading ? (
          <div className="flex justify-center items-center py-20">
            <div className="animate-spin rounded-full h-12 w-12 border-t-2 border-b-2 border-indigo-500"></div>
            <span className="ml-3 text-lg text-gray-700 dark:text-gray-300">加载中...</span>
          </div>
        ) : filteredSets.length > 0 ? (
          <div className="bg-white dark:bg-gray-800 rounded-xl shadow-lg overflow-hidden p-4 sm:p-6">
            {view === 'grid' ? renderGridView() : renderListView()}
          </div>
        ) : (
          <div className="bg-white dark:bg-gray-800 rounded-xl shadow-lg p-8 text-center">
            <div className="flex flex-col items-center">
              <svg className="h-16 w-16 text-gray-400 dark:text-gray-600 mb-4" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M9.172 16.172a4 4 0 015.656 0M9 10h.01M15 10h.01M12 2C6.477 2 2 6.477 2 12s4.477 10 10 10 10-4.477 10-10S17.523 2 12 2z" />
              </svg>
              <h3 className="text-xl font-medium text-gray-900 dark:text-white mb-2">未找到匹配的题库</h3>
              <p className="text-gray-500 dark:text-gray-400 max-w-md">
                没有符合当前筛选条件的题库。请尝试修改搜索词或重置筛选条件。
              </p>
              <button
                onClick={handleResetFilters}
                className="mt-4 px-4 py-2 bg-indigo-600 hover:bg-indigo-700 text-white rounded-lg flex items-center transition-colors"
              >
                <svg className="h-4 w-4 mr-1.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
                </svg>
                重置筛选
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};

export default QuestionSetSearchPage; 