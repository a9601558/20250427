import React, { useState, useEffect, useCallback, useMemo, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { useUser } from '../contexts/UserContext';
import { toast } from 'react-toastify';
import LoadingSpinner from '../components/LoadingSpinner';
import BaseCard from './BaseCard';
import useQuestionSets from '../hooks/useQuestionSets';
import useHomeContent from '../hooks/useHomeContent';
import useRequestLimiter from '../hooks/useRequestLimiter';
import { debounce } from 'lodash';
import { PreparedQuestionSet } from '../types/questionSet';
import clsx from 'clsx';

// Question Set Section Component props interface
interface QuestionSetSectionProps {
  sets: PreparedQuestionSet[];
  title: string;
  emptyMessage: string;
  onStartQuiz: (set: PreparedQuestionSet) => void;
  allSetsInCategory: PreparedQuestionSet[];
  searchTerm: string;
  onRefresh: () => void;
  renderEmptyState: (message: string) => React.ReactNode;
}

const QuestionSetSection: React.FC<QuestionSetSectionProps> = ({ 
  sets, 
  title, 
  emptyMessage, 
  onStartQuiz, 
  allSetsInCategory,
  searchTerm,
  onRefresh,
  renderEmptyState 
}) => {
  if (sets.length === 0) {
    if (allSetsInCategory.length === 0 && searchTerm) {
      return renderEmptyState('没有找到匹配的题库');
    }
    
    if (allSetsInCategory.length === 0) {
      return renderEmptyState(emptyMessage);
    }
    
    return null;
  }
  
  return (
    <div className="mb-10">
      <h2 className="text-xl font-bold text-gray-800 mb-4">{title}</h2>
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
        {sets.map(set => (
          <BaseCard
            key={set.id}
            set={set}
            onStartQuiz={onStartQuiz}
          />
        ))}
      </div>
    </div>
  );
};

// Error UI Component props interface
interface ErrorDisplayProps {
  message: string;
  onRetry: () => void;
}

const ErrorDisplay: React.FC<ErrorDisplayProps> = ({ message, onRetry }) => {
  return (
    <div className="flex flex-col items-center justify-center p-8 bg-red-50 rounded-lg min-h-[200px] text-center mb-6">
      <svg className="w-12 h-12 text-red-500 mb-3" fill="none" viewBox="0 0 24 24" stroke="currentColor">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
      </svg>
      <p className="text-red-700 mb-4">{message}</p>
      <button
        onClick={onRetry}
        className="px-4 py-2 text-sm bg-red-600 text-white rounded-lg hover:bg-red-700 transition-colors"
      >
        重试
      </button>
    </div>
  );
};

const HomePage: React.FC = () => {
  const navigate = useNavigate();
  const { user } = useUser();
  const { canMakeRequest } = useRequestLimiter();
  
  // 使用自定义hooks管理题库和首页内容
  const { 
    questionSets, 
    filteredSets, 
    recommendedSets,
    loading: loadingQuestionSets, 
    activeCategory,
    searchTerm,
    setSearchTerm: setSearchTermOriginal,
    handleCategoryChange,
    getCategorizedQuestionSets,
    fetchQuestionSets,
    requestAccessStatusForAllQuestionSets,
    errorMessage
  } = useQuestionSets();
  
  const {
    homeContent,
    loading: loadingHomeContent,
    fetchLatestHomeContent
  } = useHomeContent();
  
  // 本地输入状态，解决受控组件同步问题
  const [localSearchTerm, setLocalSearchTerm] = useState<string>(searchTerm);
  
  // 状态变量
  const [showWelcome, setShowWelcome] = useState<boolean>(true);
  const [showAnnouncement, setShowAnnouncement] = useState<boolean>(true);
  const [showBackToTop, setShowBackToTop] = useState<boolean>(false);
  const isInitialRender = useRef<boolean>(true);
  
  // 获取分类后的题库列表 - 使用直接调用而非函数引用
  const categorizedSets = getCategorizedQuestionSets();
  const { purchased, free, paid, expired } = categorizedSets;
  
  // 同步外部searchTerm到本地状态
  useEffect(() => {
    setLocalSearchTerm(searchTerm);
  }, [searchTerm]);
  
  // 处理题库卡片点击，开始练习
  const handleStartQuiz = useCallback((set: PreparedQuestionSet) => {
    if (canMakeRequest()) {
      // 导航到练习页面
      navigate(`/practice/${set.id}`);
    } else {
      toast.warning('请求过于频繁，请稍后再试');
    }
  }, [navigate, canMakeRequest]);
  
  // 手动刷新题库数据
  const handleRefreshQuestionSets = useCallback(() => {
      if (!canMakeRequest()) {
      toast.warning('请求过于频繁，请稍后再试');
        return;
      }
      
    toast.info('正在刷新题库数据...');
    fetchQuestionSets({ forceFresh: true })
      .then(() => {
        requestAccessStatusForAllQuestionSets({ forceRefresh: true });
        toast.success('题库数据已刷新');
      })
      .catch(() => {
        toast.error('刷新题库数据失败');
      });
  }, [fetchQuestionSets, requestAccessStatusForAllQuestionSets, canMakeRequest]);
  
  // 获取当前分类的所有题库
  const allSetsInCategory = useMemo(() => {
    return [...purchased, ...free, ...paid, ...expired];
  }, [purchased, free, paid, expired]);
  
  // 增加防抖的搜索处理函数
  const setSearchTerm = useMemo(() => 
    debounce((term: string) => {
      setSearchTermOriginal(term);
    }, 300), 
    [setSearchTermOriginal]
  );
  
  // 清理防抖函数，避免内存泄露
  useEffect(() => {
    return () => {
      setSearchTerm.cancel();
    };
  }, [setSearchTerm]);
  
  // 处理返回顶部
  const handleBackToTop = useCallback(() => {
    window.scrollTo({ top: 0, behavior: 'smooth' });
  }, []);
  
  // 监听滚动以显示/隐藏返回顶部按钮
  useEffect(() => {
    const handleScroll = () => {
      setShowBackToTop(window.scrollY > 300);
    };
    
    window.addEventListener('scroll', handleScroll);
    return () => window.removeEventListener('scroll', handleScroll);
  }, []);
  
  // 首次渲染后，设置isInitialRender为false
  useEffect(() => {
    if (isInitialRender.current) {
      isInitialRender.current = false;
    }
  }, []);

  // 渲染加载指示器
  const renderLoading = () => {
    return (
      <div className="flex flex-col items-center justify-center min-h-[300px]">
        <LoadingSpinner size="lg" />
        <p className="mt-4 text-gray-600">正在加载题库...</p>
      </div>
    );
  };
  
  // 渲染空状态
  const renderEmptyState = (message: string) => {
    return (
      <div className="flex flex-col items-center justify-center p-8 bg-gray-50 rounded-lg min-h-[200px] text-center">
        <svg className="w-12 h-12 text-gray-400 mb-3" fill="none" viewBox="0 0 24 24" stroke="currentColor">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M9.172 16.172a4 4 0 015.656 0M9 10h.01M15 10h.01M12 16.5h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
        </svg>
        <p className="text-gray-600 mb-4">{message}</p>
        <button
          onClick={handleRefreshQuestionSets}
          className="px-4 py-2 text-sm bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors"
        >
          刷新题库
        </button>
      </div>
    );
  };
  
  // 渲染分类选择
  const renderCategorySelector = () => {
    const categories = ['all', ...homeContent.featuredCategories];
    
    return (
      <div className="flex flex-wrap gap-2 mb-6">
        {categories.map((category) => (
          <button 
            key={category}
            onClick={() => handleCategoryChange(category)}
            className={clsx(
              'px-3 py-1.5 text-sm rounded-full transition-colors',
              activeCategory === category
                ? 'bg-blue-600 text-white shadow-sm'
                : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
            )}
          >
            {category === 'all' ? '全部' : category}
          </button>
        ))}
      </div>
    );
  };
  
  // 渲染公告
  const renderAnnouncement = () => {
    if (!homeContent.announcements || !showAnnouncement) return null;
    
    return (
      <div className="mb-6 bg-amber-50 border border-amber-200 rounded-lg overflow-hidden shadow-sm">
        <div className="flex items-center justify-between bg-amber-100 px-4 py-2">
          <div className="flex items-center">
            <svg className="w-5 h-5 text-amber-500 mr-2" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11 5.882V19.24a1.76 1.76 0 01-3.417.592l-2.147-6.15M18 13a3 3 0 100-6M5.436 13.683A4.001 4.001 0 017 6h1.832c4.1 0 7.625-1.234 9.168-3v14c-1.543-1.766-5.067-3-9.168-3H7a3.988 3.988 0 01-1.564-.317z" />
            </svg>
            <h2 className="font-medium text-amber-800">公告</h2>
          </div>
          <button 
            onClick={() => setShowAnnouncement(false)}
            className="text-amber-500 hover:text-amber-700"
          >
            <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>
        <div className="p-4 text-sm text-amber-800" dangerouslySetInnerHTML={{ __html: homeContent.announcements }} />
      </div>
    );
  };
  
  // 渲染欢迎区域
  const renderWelcome = () => {
    if (!showWelcome) return null;
    
    return (
      <div className="mb-8 bg-gradient-to-r from-blue-500 to-indigo-600 rounded-xl text-white p-6 shadow-md relative overflow-hidden">
        {/* Background decoration */}
        <div className="absolute right-0 top-0 -mt-4 -mr-4 w-24 h-24 rounded-full bg-white opacity-10"></div>
        <div className="absolute left-0 bottom-0 -mb-8 -ml-8 w-32 h-32 rounded-full bg-white opacity-10"></div>
        
        <button 
          onClick={() => setShowWelcome(false)} 
          className="absolute top-2 right-2 text-white/80 hover:text-white"
        >
          <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
          </svg>
        </button>
            
        <div className="relative z-10">
          <h1 className="text-2xl font-bold mb-2">{homeContent.welcomeTitle}</h1>
          <p className="text-blue-100 max-w-2xl mb-4">{homeContent.welcomeDescription}</p>
          
          {recommendedSets.length > 0 && (
            <div>
              <h3 className="text-sm font-semibold text-blue-200 mb-3">精选题库</h3>
              <div className="flex flex-wrap gap-2">
                {recommendedSets.map(set => (
                  <button 
                    key={set.id}
                    onClick={() => handleStartQuiz(set)}
                    className="bg-white/20 hover:bg-white/30 text-white rounded-lg px-3 py-2 text-sm transition-colors"
                  >
                    {set.title}
                  </button>
                ))}
              </div>
            </div>
          )}
        </div>
      </div>
    );
  };
  
  // 主渲染函数
  return (
    <div className="container mx-auto px-4 py-6">
      {/* 搜索栏和刷新按钮 */}
      <div className="flex flex-col sm:flex-row justify-between items-center mb-8 gap-4">
        <div className="relative w-full sm:w-96">
          <input
            type="text"
            value={localSearchTerm}
            onChange={(e) => {
              setLocalSearchTerm(e.target.value);
              setSearchTerm(e.target.value);
            }}
            placeholder="搜索题库名称或分类..."
            className="w-full pl-10 pr-4 py-2 rounded-lg border border-gray-300 focus:border-blue-500 focus:ring-2 focus:ring-blue-200 transition-colors"
          />
          <svg
            className="absolute left-3 top-2.5 w-5 h-5 text-gray-400"
            fill="none"
            viewBox="0 0 24 24"
            stroke="currentColor"
          >
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeWidth={2}
              d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z"
            />
          </svg>
        </div>
        
        <button 
          onClick={handleRefreshQuestionSets}
          className="flex items-center px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors"
        >
          <svg className="w-5 h-5 mr-2" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeWidth={2}
              d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15"
            />
          </svg>
          刷新题库
        </button>
      </div>
      
      {/* 欢迎横幅 */}
      {renderWelcome()}
      
      {/* 公告区域 */}
      {renderAnnouncement()}
      
      {/* 错误界面 */}
      {errorMessage && (
        <ErrorDisplay 
          message={errorMessage}
          onRetry={handleRefreshQuestionSets}
        />
      )}
      
      {/* 类别选择器 */}
      {renderCategorySelector()}
      
      {/* 加载状态 */}
      {loadingQuestionSets && questionSets.length === 0 ? (
        renderLoading()
      ) : (
        <>
          {/* 使用抽离的Question Set Section组件 */}
          <QuestionSetSection
            sets={purchased}
            title="已购题库"
            emptyMessage="您尚未购买任何题库。选择下方的题库购买或开始免费练习。"
            onStartQuiz={handleStartQuiz}
            allSetsInCategory={allSetsInCategory}
            searchTerm={searchTerm}
            onRefresh={handleRefreshQuestionSets}
            renderEmptyState={renderEmptyState}
          />
          
          <QuestionSetSection
            sets={free}
            title="免费题库"
            emptyMessage="暂无免费题库，请查看付费题库。"
            onStartQuiz={handleStartQuiz}
            allSetsInCategory={allSetsInCategory}
            searchTerm={searchTerm}
            onRefresh={handleRefreshQuestionSets}
            renderEmptyState={renderEmptyState}
          />
          
          <QuestionSetSection
            sets={paid}
            title="付费题库"
            emptyMessage="暂无付费题库可供购买。"
            onStartQuiz={handleStartQuiz}
            allSetsInCategory={allSetsInCategory}
            searchTerm={searchTerm}
            onRefresh={handleRefreshQuestionSets}
            renderEmptyState={renderEmptyState}
          />
          
          {expired.length > 0 && (
            <QuestionSetSection
              sets={expired}
              title="已过期题库"
              emptyMessage=""
              onStartQuiz={handleStartQuiz}
              allSetsInCategory={allSetsInCategory}
              searchTerm={searchTerm}
              onRefresh={handleRefreshQuestionSets}
              renderEmptyState={renderEmptyState}
            />
          )}
        </>
      )}
      
      {/* 返回顶部按钮 - 添加过渡动画 */}
      <div 
        className={clsx(
          "fixed bottom-6 right-6 transition-all duration-300",
          showBackToTop ? "opacity-100 translate-y-0" : "opacity-0 translate-y-10 pointer-events-none"
        )}
      >
        <button 
          onClick={handleBackToTop}
          className="bg-blue-600 text-white p-3 rounded-full shadow-lg hover:bg-blue-700 transition-colors z-50"
          aria-label="返回顶部"
        >
          <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 10l7-7m0 0l7 7m-7-7v18" />
          </svg>
        </button>
      </div>
    </div>
  );
};

export default HomePage;