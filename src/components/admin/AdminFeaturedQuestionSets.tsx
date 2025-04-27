import React, { useState, useEffect } from 'react';
import { useUser } from '../../contexts/UserContext';
import { homepageService, questionSetService } from '../../services/api';
import { QuestionSet } from '../../types';
import { logger } from '../../utils/logger';

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

  // 加载题库和精选分类
  useEffect(() => {
    const loadData = async () => {
      setLoading(true);
      try {
        // 获取所有题库
        const qsResponse = await questionSetService.getAllQuestionSets();
        
        // 获取精选分类
        const fcResponse = await homepageService.getFeaturedCategories();
        
        if (qsResponse.success && qsResponse.data) {
          setQuestionSets(qsResponse.data as FeaturedQuestionSet[]);
        } else {
          const errorMsg = qsResponse.error || '加载题库失败';
          logger.error('Failed to load question sets:', errorMsg);
          setError(errorMsg);
        }
        
        if (fcResponse.success && fcResponse.data) {
          setFeaturedCategories(fcResponse.data);
        } else if (!fcResponse.success) {
          logger.warn('Failed to load featured categories:', fcResponse.error);
        }
      } catch (err) {
        const errorMsg = err instanceof Error ? err.message : '加载数据时发生错误';
        logger.error('Exception while loading data:', errorMsg);
        setError(errorMsg);
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
    try {
      const response = await questionSetService.setFeaturedQuestionSet(id, isFeatured);

      if (response.success) {
        // 更新本地状态
        setQuestionSets(prev => 
          prev.map(qs => 
            qs.id === id ? { ...qs, isFeatured } : qs
          )
        );
        
        setMessage({ 
          type: 'success', 
          text: `题库已${isFeatured ? '添加到' : '从'}首页${isFeatured ? '' : '移除'}` 
        });
      } else {
        const errorMsg = response.error || '更新失败';
        logger.error(`Failed to update featured status for question set ${id}:`, errorMsg);
        setMessage({ type: 'error', text: errorMsg });
      }
    } catch (err) {
      const errorMsg = err instanceof Error ? err.message : '更新过程中发生错误';
      logger.error(`Exception while updating featured status for question set ${id}:`, errorMsg);
      setMessage({ type: 'error', text: errorMsg });
    }
    
    // 3秒后清除消息
    setTimeout(() => setMessage(null), 3000);
  };

  // 更新题库的精选分类
  const handleFeaturedCategoryChange = async (id: string, featuredCategory: string) => {
    try {
      // 首先获取当前题库的状态
      const currentSet = questionSets.find(qs => qs.id === id);
      if (!currentSet) {
        setMessage({ type: 'error', text: '找不到指定题库' });
        return;
      }

      const response = await questionSetService.setFeaturedQuestionSet(
        id, 
        currentSet.isFeatured, 
        featuredCategory
      );

      if (response.success) {
        // 更新本地状态
        setQuestionSets(prev => 
          prev.map(qs => 
            qs.id === id ? { ...qs, featuredCategory } : qs
          )
        );
        
        setMessage({ type: 'success', text: '精选分类已更新' });
      } else {
        const errorMsg = response.error || '更新失败';
        logger.error(`Failed to update featured category for question set ${id}:`, errorMsg);
        setMessage({ type: 'error', text: errorMsg });
      }
    } catch (err) {
      const errorMsg = err instanceof Error ? err.message : '更新过程中发生错误';
      logger.error(`Exception while updating featured category for question set ${id}:`, errorMsg);
      setMessage({ type: 'error', text: errorMsg });
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

    try {
      const updatedCategories = [...featuredCategories, newCategory];
      const response = await homepageService.updateFeaturedCategories(updatedCategories);

      if (response.success) {
        setFeaturedCategories(updatedCategories);
        setNewCategory('');
        setMessage({ type: 'success', text: '分类添加成功' });
      } else {
        const errorMsg = response.error || '添加分类失败';
        logger.error('Failed to add category:', errorMsg);
        setMessage({ type: 'error', text: errorMsg });
      }
    } catch (err) {
      const errorMsg = err instanceof Error ? err.message : '添加分类时发生错误';
      logger.error('Exception while adding category:', errorMsg);
      setMessage({ type: 'error', text: errorMsg });
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
        await Promise.all(
          questionSets
            .filter(qs => qs.featuredCategory === category)
            .map(async (qs) => {
              await questionSetService.setFeaturedQuestionSet(qs.id, qs.isFeatured, '');
            })
        );
        
        // 更新本地状态
        setQuestionSets(prev => 
          prev.map(qs => 
            qs.featuredCategory === category ? { ...qs, featuredCategory: '' } : qs
          )
        );
      }

      const updatedCategories = featuredCategories.filter(c => c !== category);
      const response = await homepageService.updateFeaturedCategories(updatedCategories);

      if (response.success) {
        setFeaturedCategories(updatedCategories);
        setMessage({ type: 'success', text: '分类删除成功' });
      } else {
        const errorMsg = response.error || '删除分类失败';
        logger.error('Failed to delete category:', errorMsg);
        setMessage({ type: 'error', text: errorMsg });
      }
    } catch (err) {
      const errorMsg = err instanceof Error ? err.message : '删除分类时发生错误';
      logger.error('Exception while deleting category:', errorMsg);
      setMessage({ type: 'error', text: errorMsg });
    }
  };

  if (loading) {
    return <div className="p-4">正在加载...</div>;
  }

  if (error) {
    return <div className="p-4 text-red-500">{error}</div>;
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
          className="mb-4 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-blue-500"
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
                className="flex-1 border rounded-l-lg px-3 py-2 focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
              <button
                onClick={handleAddCategory}
                className="bg-blue-600 text-white px-4 py-2 rounded-r-lg hover:bg-blue-700"
              >
                添加
              </button>
            </div>

            <div className="space-y-2">
              {featuredCategories.map(category => (
                <div key={category} className="flex justify-between items-center p-2 bg-white rounded border">
                  <span>{category}</span>
                  <button
                    onClick={() => handleDeleteCategory(category)}
                    className="text-red-600 hover:text-red-800"
                  >
                    删除
                  </button>
                </div>
              ))}
              {featuredCategories.length === 0 && (
                <p className="text-gray-500 text-center py-2">暂无精选分类</p>
              )}
            </div>
          </div>
        )}
      </div>

      <div className="overflow-x-auto">
        <table className="min-w-full divide-y divide-gray-200">
          <thead className="bg-gray-50">
            <tr>
              <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                题库名称
              </th>
              <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                分类
              </th>
              <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                显示在首页
              </th>
              <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                精选分类
              </th>
            </tr>
          </thead>
          <tbody className="bg-white divide-y divide-gray-200">
            {questionSets.map((qs) => (
              <tr key={qs.id}>
                <td className="px-6 py-4 whitespace-nowrap">
                  <div className="flex items-center">
                    <div className="text-2xl mr-3">{qs.icon}</div>
                    <div>
                      <div className="text-sm font-medium text-gray-900">{qs.title}</div>
                      <div className="text-sm text-gray-500">{qs.questions?.length || 0} 个问题</div>
                    </div>
                  </div>
                </td>
                <td className="px-6 py-4 whitespace-nowrap">
                  <span className="px-2 inline-flex text-xs leading-5 font-semibold rounded-full bg-blue-100 text-blue-800">
                    {qs.category}
                  </span>
                </td>
                <td className="px-6 py-4 whitespace-nowrap">
                  <label className="inline-flex items-center">
                    <input 
                      type="checkbox" 
                      checked={qs.isFeatured || false}
                      onChange={() => handleFeaturedStatusChange(qs.id, !qs.isFeatured)}
                      className="form-checkbox h-5 w-5 text-blue-600"
                    />
                  </label>
                </td>
                <td className="px-6 py-4 whitespace-nowrap">
                  <select
                    disabled={!qs.isFeatured}
                    value={qs.featuredCategory || ''}
                    onChange={(e) => handleFeaturedCategoryChange(qs.id, e.target.value)}
                    className={`block w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:outline-none sm:text-sm ${!qs.isFeatured ? 'opacity-50 cursor-not-allowed' : 'focus:ring-blue-500 focus:border-blue-500'}`}
                  >
                    <option value="">--选择精选分类--</option>
                    {featuredCategories.map((category) => (
                      <option key={category} value={category}>
                        {category}
                      </option>
                    ))}
                  </select>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
};

export default AdminFeaturedQuestionSets; 