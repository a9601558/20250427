import React, { useState, useEffect } from 'react';
import { fetchWithAuth } from '../utils/api';
import { QuestionSet } from '../types';

interface FeaturedQuestionSet extends QuestionSet {
  isFeatured: boolean;
  featuredCategory?: string;
}

interface FeaturedCategoriesProps {
  onCategoriesUpdated?: () => void;
}

const FeaturedCategories: React.FC<FeaturedCategoriesProps> = ({ onCategoriesUpdated }) => {
  const [questionSets, setQuestionSets] = useState<FeaturedQuestionSet[]>([]);
  const [isLoading, setIsLoading] = useState<boolean>(true);
  const [error, setError] = useState<string | null>(null);
  const [message, setMessage] = useState<{ type: 'success' | 'error', text: string } | null>(null);
  const [featuredCategories, setFeaturedCategories] = useState<string[]>([]);
  const [newCategory, setNewCategory] = useState<string>('');
  const [showCategoryManagement, setShowCategoryManagement] = useState<boolean>(true);
  
  // 加载题库和精选分类
  useEffect(() => {
    loadData();
  }, []);

  // 加载数据
  const loadData = async () => {
    setIsLoading(true);
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
      setIsLoading(false);
    }
  };

  // 添加新分类
  const handleAddCategory = async () => {
    if (!newCategory.trim()) {
      setMessage({ type: 'error', text: '分类名称不能为空' });
      return;
    }

    // 检查分类是否已存在
    if (featuredCategories.includes(newCategory.trim())) {
      setMessage({ type: 'error', text: '该分类已存在' });
      return;
    }

    try {
      const updatedCategories = [...featuredCategories, newCategory.trim()];
      const response = await fetchWithAuth('/homepage/featured-categories', {
        method: 'PUT',
        body: JSON.stringify({ featuredCategories: updatedCategories }),
      });

      if (response.success) {
        setFeaturedCategories(updatedCategories);
        setNewCategory('');
        setMessage({ type: 'success', text: '分类添加成功' });
        if (onCategoriesUpdated) {
          onCategoriesUpdated();
        }
      } else {
        setMessage({ type: 'error', text: response.error || '添加分类失败' });
      }
    } catch (err) {
      setMessage({ type: 'error', text: '添加分类时发生错误' });
    }
  };

  // 删除精选分类
  const handleDeleteCategory = async (category: string) => {
    try {
      // 检查是否有题库使用该分类
      const hasQuestionSets = questionSets.some((qs) => qs.featuredCategory === category);
      if (hasQuestionSets) {
        // 提示用户有题库使用该分类
        if (!window.confirm('有题库正在使用该分类，删除将会清除这些题库的分类设置。确定删除？')) {
          return;
        }

        // 清除使用该分类的题库分类设置
        const updatedQuestionSets = questionSets.map((qs) => 
          qs.featuredCategory === category ? { ...qs, featuredCategory: '' } : qs
        );
        setQuestionSets(updatedQuestionSets);
      }

      const updatedCategories = featuredCategories.filter((c) => c !== category);
      const response = await fetchWithAuth('/homepage/featured-categories', {
        method: 'PUT',
        body: JSON.stringify({ featuredCategories: updatedCategories }),
      });

      if (response.success) {
        setFeaturedCategories(updatedCategories);
        setMessage({ type: 'success', text: '分类删除成功' });
        if (onCategoriesUpdated) {
          onCategoriesUpdated();
        }
      } else {
        setMessage({ type: 'error', text: response.error || '删除分类失败' });
      }
    } catch (err) {
      setMessage({ type: 'error', text: '删除分类时发生错误' });
    }
  };

  if (isLoading) {
    return <div className="p-4">正在加载...</div>;
  }

  if (error) {
    return <div className="p-4 text-red-500">{error}</div>;
  }

  return (
    <div className="bg-white rounded-lg shadow p-6">
      <div className="flex justify-between items-center mb-6">
        <h2 className="text-xl font-semibold text-gray-800">精选分类管理</h2>
        <button
          onClick={() => setShowCategoryManagement(!showCategoryManagement)}
          className="px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700 focus:outline-none"
        >
          {showCategoryManagement ? '收起' : '展开'}
        </button>
      </div>

      {message && (
        <div className={`mb-4 p-3 rounded ${message.type === 'success' ? 'bg-green-100 text-green-800' : 'bg-red-100 text-red-800'}`}>
          {message.text}
        </div>
      )}

      {showCategoryManagement && (
        <div className="space-y-4">
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
            <h3 className="text-lg font-medium mb-3">当前分类列表</h3>
            {featuredCategories.length > 0 ? (
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
                {featuredCategories.map((category) => (
                  <div key={category} className="flex justify-between items-center p-3 bg-gray-50 rounded border">
                    <span className="font-medium text-gray-700">{category}</span>
                    <button
                      onClick={() => handleDeleteCategory(category)}
                      className="text-red-600 hover:text-red-800 p-1"
                    >
                      <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                      </svg>
                    </button>
                  </div>
                ))}
              </div>
            ) : (
              <p className="text-gray-500 text-center py-4 bg-gray-50 rounded border">暂无精选分类</p>
            )}
          </div>
        </div>
      )}
    </div>
  );
};

export default FeaturedCategories; 
