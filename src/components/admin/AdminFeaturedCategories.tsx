import React, { useState, useEffect } from 'react';
import { useUser } from '../../contexts/UserContext';
import { homepageService } from '../../services/api';
import { logger } from '../../utils/logger';

const AdminFeaturedCategories: React.FC = () => {
  const { isAdmin } = useUser();
  const [featuredCategories, setFeaturedCategories] = useState<string[]>([]);
  const [loading, setLoading] = useState<boolean>(true);
  const [error, setError] = useState<string | null>(null);
  const [message, setMessage] = useState<{ type: 'success' | 'error', text: string } | null>(null);
  const [newCategory, setNewCategory] = useState<string>('');

  // 加载精选分类
  useEffect(() => {
    const loadCategories = async () => {
      setLoading(true);
      try {
        // 获取精选分类
        const response = await homepageService.getFeaturedCategories();
        
        if (response.success && response.data) {
          setFeaturedCategories(response.data);
        } else {
          const errorMsg = response.error || '加载精选分类失败';
          logger.error('Failed to load featured categories:', errorMsg);
          setError(errorMsg);
        }
      } catch (err) {
        const errorMsg = err instanceof Error ? err.message : '加载数据时发生错误';
        logger.error('Exception while loading featured categories:', errorMsg);
        setError(errorMsg);
      } finally {
        setLoading(false);
      }
    };

    if (isAdmin()) {
      loadCategories();
    }
  }, [isAdmin]);

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
    <div className="p-4">
      <h2 className="text-lg font-medium mb-4">精选分类管理</h2>
      
      {message && (
        <div className={`p-4 mb-4 ${message.type === 'success' ? 'bg-green-100 text-green-700' : 'bg-red-100 text-red-700'} rounded-md`}>
          {message.text}
        </div>
      )}

      <div className="bg-white shadow overflow-hidden sm:rounded-lg">
        <div className="p-4 border-b border-gray-200">
          <h3 className="text-lg font-medium">添加新分类</h3>
          <div className="mt-2 flex">
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
        </div>

        <div className="p-4">
          <h3 className="text-lg font-medium mb-3">当前分类</h3>
          
          {featuredCategories.length > 0 ? (
            <div className="space-y-2">
              {featuredCategories.map(category => (
                <div key={category} className="flex justify-between items-center p-3 bg-gray-50 rounded border">
                  <span className="font-medium">{category}</span>
                  <button
                    onClick={() => handleDeleteCategory(category)}
                    className="text-red-600 hover:text-red-800 px-3 py-1 border border-red-300 rounded-md hover:bg-red-50"
                  >
                    删除
                  </button>
                </div>
              ))}
            </div>
          ) : (
            <p className="text-gray-500 text-center py-6">暂无精选分类</p>
          )}
        </div>
      </div>
    </div>
  );
};

export default AdminFeaturedCategories; 