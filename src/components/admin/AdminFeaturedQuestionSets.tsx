import React, { useState, useEffect } from 'react';
import { useUser } from '../../contexts/UserContext';
import { fetchWithAuth } from '../../utils/api';
import { QuestionSet } from '../../types';

interface FeaturedQuestionSet extends QuestionSet {
  isFeatured: boolean;
  featuredCategory?: string;
}

const AdminFeaturedQuestionSets: React.FC = () => {
  const { isAdmin } = useUser();
  const [questionSets, setQuestionSets] = useState<FeaturedQuestionSet[]>([]);
  const [loading, setLoading] = useState<boolean>(true);
  const [error, setError] = useState<string | null>(null);
  const [message, setMessage] = useState<{ type: 'success' | 'error', text: string } | null>(null);
  const [featuredCategories, setFeaturedCategories] = useState<string[]>([]);
  const [newCategory, setNewCategory] = useState<string>('');
  const [showCategoryManagement, setShowCategoryManagement] = useState<boolean>(false);
  const [filterCategory, setFilterCategory] = useState<string>('all');
  const [sortBy, setSortBy] = useState<'title' | 'category' | 'featured'>('title');
  const [saveInProgress, setSaveInProgress] = useState<boolean>(false);
  const [categoryUpdateSuccess, setCategoryUpdateSuccess] = useState<boolean>(false);

  // 加载题库和精选分类
  useEffect(() => {
    const loadData = async () => {
      setLoading(true);
      try {
        // 获取所有题库
        const qsResponse = await fetchWithAuth<QuestionSet[]>('/question-sets');
        
        // 获取精选分类
        const fcResponse = await fetchWithAuth<string[]>('/homepage/featured-categories');
        
        if (qsResponse.success && qsResponse.data) {
          setQuestionSets(qsResponse.data as FeaturedQuestionSet[]);
        } else {
          setError(qsResponse.error || '加载题库失败');
        }
        
        if (fcResponse.success && fcResponse.data) {
          setFeaturedCategories(fcResponse.data);
        }
      } catch (err) {
        setError('加载数据时发生错误');
      } finally {
        setLoading(false);
      }
    };

    if (isAdmin()) {
      loadData();
    }
  }, [isAdmin]);

  // 更新题库的精选状态
  const handleFeaturedStatusChange = async (id: string, isFeatured: boolean) => {
    setSaveInProgress(true);
    try {
      const response = await fetchWithAuth(`/homepage/featured-question-sets/${id}`, {
        method: 'PUT',
        body: JSON.stringify({ isFeatured })
      });

      if (response.success) {
        // 更新本地状态
        setQuestionSets(prev => 
          prev.map(qs => 
            qs.id === id ? { ...qs, isFeatured } : qs
          )
        );
        
        setMessage({ 
          type: 'success', 
          text: `题库已${isFeatured ? '添加到' : '从'}精选列表${isFeatured ? '' : '移除'}` 
        });
      } else {
        setMessage({ type: 'error', text: response.error || '更新失败' });
      }
    } catch (err) {
      setMessage({ type: 'error', text: '更新过程中发生错误' });
    } finally {
      setSaveInProgress(false);
    }
    
    // 3秒后清除消息
    setTimeout(() => setMessage(null), 3000);
  };

  // 更新题库的精选分类
  const handleFeaturedCategoryChange = async (id: string, featuredCategory: string) => {
    setSaveInProgress(true);
    try {
      const response = await fetchWithAuth(`/homepage/featured-question-sets/${id}`, {
        method: 'PUT',
        body: JSON.stringify({ featuredCategory })
      });

      if (response.success) {
        // 更新本地状态
        setQuestionSets(prev => 
          prev.map(qs => 
            qs.id === id ? { ...qs, featuredCategory } : qs
          )
        );
        
        setMessage({ type: 'success', text: '精选分类已更新' });
      } else {
        setMessage({ type: 'error', text: response.error || '更新失败' });
      }
    } catch (err) {
      setMessage({ type: 'error', text: '更新过程中发生错误' });
    } finally {
      setSaveInProgress(false);
    }
    
    // 3秒后清除消息
    setTimeout(() => setMessage(null), 3000);
  };

  // 添加新的精选分类
  const handleAddCategory = async () => {
    if (!newCategory.trim()) {
      setMessage({ type: 'error', text: '分类名称不能为空' });
      return;
    }

    if (featuredCategories.includes(newCategory)) {
      setMessage({ type: 'error', text: '分类已存在' });
      return;
    }

    setSaveInProgress(true);
    try {
      const updatedCategories = [...featuredCategories, newCategory];
      const response = await fetchWithAuth('/homepage/featured-categories', {
        method: 'PUT',
        body: JSON.stringify({ featuredCategories: updatedCategories })
      });

      if (response.success) {
        setFeaturedCategories(updatedCategories);
        setNewCategory('');
        setMessage({ type: 'success', text: '分类添加成功' });
        setCategoryUpdateSuccess(true);
        // 2秒后重置成功状态
        setTimeout(() => setCategoryUpdateSuccess(false), 2000);
      } else {
        setMessage({ type: 'error', text: response.error || '添加分类失败' });
      }
    } catch (err) {
      setMessage({ type: 'error', text: '添加分类时发生错误' });
    } finally {
      setSaveInProgress(false);
    }
  };

  // 删除精选分类
  const handleDeleteCategory = async (category: string) => {
    try {
      // 检查是否有题库使用该分类
      const hasQuestionSets = questionSets.some(qs => qs.featuredCategory === category);
      if (hasQuestionSets) {
        // 提示用户有题库使用该分类
        if (!window.confirm(`有题库正在使用该分类，删除将会清除这些题库的分类设置。确定删除？`)) {
          return;
        }

        // 清除使用该分类的题库分类设置
        const updatedQuestionSets = questionSets.map(qs => 
          qs.featuredCategory === category ? { ...qs, featuredCategory: '' } : qs
        );
        setQuestionSets(updatedQuestionSets);
        
        // 同步更新后端数据
        updatedQuestionSets
          .filter(qs => qs.featuredCategory === '' && qs.isFeatured)
          .forEach(async (qs) => {
            await fetchWithAuth(`/homepage/featured-question-sets/${qs.id}`, {
              method: 'PUT',
              body: JSON.stringify({ featuredCategory: '' })
            });
          });
      }

      setSaveInProgress(true);
      const updatedCategories = featuredCategories.filter(c => c !== category);
      const response = await fetchWithAuth('/homepage/featured-categories', {
        method: 'PUT',
        body: JSON.stringify({ featuredCategories: updatedCategories })
      });

      if (response.success) {
        setFeaturedCategories(updatedCategories);
        setMessage({ type: 'success', text: '分类删除成功' });
        setCategoryUpdateSuccess(true);
        // 2秒后重置成功状态
        setTimeout(() => setCategoryUpdateSuccess(false), 2000);
      } else {
        setMessage({ type: 'error', text: response.error || '删除分类失败' });
      }
    } catch (err) {
      setMessage({ type: 'error', text: '删除分类时发生错误' });
    } finally {
      setSaveInProgress(false);
    }
  };

  // 根据当前筛选和排序获取题库列表
  const getFilteredQuestionSets = () => {
    let filteredSets = [...questionSets];
    
    // 应用分类筛选
    if (filterCategory !== 'all') {
      if (filterCategory === 'featured') {
        filteredSets = filteredSets.filter(qs => qs.isFeatured);
      } else if (filterCategory === 'not-featured') {
        filteredSets = filteredSets.filter(qs => !qs.isFeatured);
      } else {
        filteredSets = filteredSets.filter(qs => 
          qs.featuredCategory === filterCategory && qs.isFeatured
        );
      }
    }
    
    // 应用排序
    filteredSets.sort((a, b) => {
      if (sortBy === 'title') {
        return a.title.localeCompare(b.title);
      } else if (sortBy === 'category') {
        return a.category.localeCompare(b.category);
      } else if (sortBy === 'featured') {
        // 先按精选状态排序，再按分类排序
        const featuredComparison = (b.isFeatured ? 1 : 0) - (a.isFeatured ? 1 : 0);
        if (featuredComparison !== 0) return featuredComparison;
        
        // 如果精选状态相同，按照分类排序
        if (a.featuredCategory && b.featuredCategory) {
          return a.featuredCategory.localeCompare(b.featuredCategory);
        }
        return (b.featuredCategory ? 1 : 0) - (a.featuredCategory ? 1 : 0);
      }
      return 0;
    });
    
    return filteredSets;
  };

  if (loading) {
    return <div className="p-4 flex justify-center items-center h-64">
      <div className="animate-spin rounded-full h-12 w-12 border-t-2 border-b-2 border-blue-500"></div>
      <span className="ml-3">正在加载...</span>
    </div>;
  }

  if (error) {
    return <div className="p-4 text-red-500 bg-red-50 border border-red-100 rounded-lg">
      <h3 className="font-semibold">加载错误</h3>
      <p>{error}</p>
      <button 
        onClick={() => window.location.reload()}
        className="mt-2 px-4 py-2 bg-red-600 text-white rounded-lg hover:bg-red-700"
      >
        重试
      </button>
    </div>;
  }

  return (
    <div className="bg-white shadow-md rounded-lg p-6 max-w-4xl mx-auto my-8">
      <h2 className="text-2xl font-semibold mb-6 pb-2 border-b">题库精选管理</h2>
      
      {message && (
        <div className={`p-4 mb-4 rounded ${message.type === 'success' ? 'bg-green-100 text-green-800' : 'bg-red-100 text-red-800'}`}>
          {message.text}
        </div>
      )}

      <p className="mb-4 text-gray-600">
        选择要在首页展示的题库，并为它们分配精选分类。精选分类决定了题库在首页上的分组方式。
      </p>

      {/* 分类管理工具 */}
      <div className="mb-6">
        <button 
          onClick={() => setShowCategoryManagement(!showCategoryManagement)}
          className={`mb-4 px-4 py-2 text-white rounded-lg hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-blue-500 ${showCategoryManagement ? 'bg-blue-700' : 'bg-blue-600'}`}
        >
          {showCategoryManagement ? '隐藏分类管理' : '显示分类管理'}
        </button>

        {showCategoryManagement && (
          <div className="p-4 border rounded-lg bg-gray-50">
            <h3 className="text-lg font-medium mb-3">精选分类管理</h3>
            
            <div className="flex mb-4">
              <input
                type="text"
                value={newCategory}
                onChange={(e) => setNewCategory(e.target.value)}
                placeholder="输入新分类名称"
                className={`flex-1 border rounded-l-lg px-3 py-2 focus:outline-none focus:ring-2 focus:ring-blue-500 ${categoryUpdateSuccess ? 'border-green-500 bg-green-50' : ''}`}
              />
              <button
                onClick={handleAddCategory}
                disabled={saveInProgress}
                className={`text-white px-4 py-2 rounded-r-lg transition duration-200 ${saveInProgress 
                  ? 'bg-gray-400 cursor-not-allowed'
                  : categoryUpdateSuccess 
                    ? 'bg-green-600 hover:bg-green-700' 
                    : 'bg-blue-600 hover:bg-blue-700'
                }`}
              >
                {saveInProgress ? '处理中...' : categoryUpdateSuccess ? '添加成功！' : '添加'}
              </button>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-2">
              {featuredCategories.map(category => (
                <div key={category} className="flex justify-between items-center p-2 bg-white rounded border">
                  <span>{category}</span>
                  <button
                    onClick={() => handleDeleteCategory(category)}
                    disabled={saveInProgress}
                    className={`text-red-600 hover:text-red-800 ${saveInProgress ? 'opacity-50 cursor-not-allowed' : ''}`}
                  >
                    删除
                  </button>
                </div>
              ))}
              {featuredCategories.length === 0 && (
                <p className="text-gray-500 text-center py-2 col-span-full">暂无精选分类</p>
              )}
            </div>
          </div>
        )}
      </div>

      {/* 筛选和排序工具 */}
      <div className="mb-6 flex flex-col sm:flex-row gap-4">
        <div className="flex-1">
          <label className="block text-sm font-medium text-gray-700 mb-1">按分类筛选</label>
          <select 
            value={filterCategory}
            onChange={(e) => setFilterCategory(e.target.value)}
            className="block w-full p-2 border border-gray-300 rounded-md shadow-sm focus:ring-blue-500 focus:border-blue-500"
          >
            <option value="all">所有题库</option>
            <option value="featured">所有精选题库</option>
            <option value="not-featured">非精选题库</option>
            {featuredCategories.map(category => (
              <option key={category} value={category}>精选分类：{category}</option>
            ))}
          </select>
        </div>
        
        <div className="flex-1">
          <label className="block text-sm font-medium text-gray-700 mb-1">排序方式</label>
          <select 
            value={sortBy}
            onChange={(e) => setSortBy(e.target.value as 'title' | 'category' | 'featured')}
            className="block w-full p-2 border border-gray-300 rounded-md shadow-sm focus:ring-blue-500 focus:border-blue-500"
          >
            <option value="title">按题库名称</option>
            <option value="category">按普通分类</option>
            <option value="featured">按精选状态和分类</option>
          </select>
        </div>
      </div>

      <div className="overflow-x-auto">
        <table className="min-w-full divide-y divide-gray-200">
          <thead className="bg-gray-50">
            <tr>
              <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">题库名称</th>
              <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">分类</th>
              <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">精选状态</th>
              <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">精选分类</th>
              <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">操作</th>
            </tr>
          </thead>
          <tbody className="bg-white divide-y divide-gray-200">
            {getFilteredQuestionSets().map(questionSet => (
              <tr key={questionSet.id}>
                <td className="px-6 py-4 whitespace-nowrap text-sm font-medium text-gray-900">{questionSet.title}</td>
                <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">{questionSet.category}</td>
                <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                  <div className="flex items-center">
                    <label className="inline-flex items-center space-x-2 cursor-pointer">
                      <input
                        type="checkbox"
                        checked={questionSet.isFeatured}
                        onChange={() => handleFeaturedStatusChange(questionSet.id, !questionSet.isFeatured)}
                        disabled={saveInProgress}
                        className="h-4 w-4 text-blue-600 focus:ring-blue-500 border-gray-300 rounded transition"
                      />
                      <span className={questionSet.isFeatured ? 'text-blue-600 font-medium' : ''}>
                        {questionSet.isFeatured ? '精选' : '非精选'}
                      </span>
                    </label>
                  </div>
                </td>
                <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                  <select
                    value={questionSet.featuredCategory || ''}
                    onChange={(e) => handleFeaturedCategoryChange(questionSet.id, e.target.value)}
                    disabled={!questionSet.isFeatured || saveInProgress}
                    className={`border rounded p-1 ${!questionSet.isFeatured ? 'bg-gray-100 cursor-not-allowed' : ''}`}
                  >
                    <option value="">选择分类</option>
                    {featuredCategories.map(category => (
                      <option key={category} value={category}>{category}</option>
                    ))}
                  </select>
                </td>
                <td className="px-6 py-4 whitespace-nowrap text-right text-sm font-medium">
                  <a href={`/admin/question-sets/${questionSet.id}`} className="text-blue-600 hover:text-blue-900 mr-3">
                    编辑
                  </a>
                  <a href={`/practice/${questionSet.id}`} target="_blank" rel="noopener noreferrer" className="text-green-600 hover:text-green-900">
                    预览
                  </a>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
        
        {getFilteredQuestionSets().length === 0 && (
          <div className="text-center py-8 text-gray-500">
            没有找到符合条件的题库
          </div>
        )}
      </div>
    </div>
  );
};

export default AdminFeaturedQuestionSets; 