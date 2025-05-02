import React, { useState, useEffect } from 'react';
import { useUser } from '../../contexts/UserContext';
import { homepageService, questionSetService } from '../../services/api';
import { logger } from '../../utils/logger';

const AdminFeaturedCategories: React.FC = () => {
  const { isAdmin } = useUser();
  const [featuredCategories, setFeaturedCategories] = useState<string[]>([]);
  const [loading, setLoading] = useState<boolean>(true);
  const [error, setError] = useState<string | null>(null);
  const [message, setMessage] = useState<{ type: 'success' | 'error', text: string } | null>(null);
  const [newCategory, setNewCategory] = useState<string>('');
  const [isSaving, setIsSaving] = useState<boolean>(false);
  const [inUseCategories, setInUseCategories] = useState<{[key: string]: number}>({});

  // 加载精选分类
  useEffect(() => {
    const loadCategories = async () => {
      setLoading(true);
      try {
        // 获取精选分类
        const response = await homepageService.getFeaturedCategories();
        
        // 同时获取所有题库的分类使用情况
        const qsResponse = await questionSetService.getAllQuestionSets();
        
        if (response.success && response.data) {
          logger.info('成功获取精选分类:', response.data);
          setFeaturedCategories(response.data || []);
          
          // 检查每个分类被哪些题库使用
          if (qsResponse.success && qsResponse.data) {
            const inUseCount: {[key: string]: number} = {};
            
            qsResponse.data.forEach((qs) => {
              if (qs.featuredCategory && response.data && response.data.includes(qs.featuredCategory)) {
                inUseCount[qs.featuredCategory] = (inUseCount[qs.featuredCategory] || 0) + 1;
              }
            });
            
            setInUseCategories(inUseCount);
            logger.info('分类使用情况:', inUseCount);
          }
        } else {
          const errorMsg = response.message || '加载精选分类失败';
          logger.error('获取精选分类失败:', errorMsg);
          setError(errorMsg);
        }
      } catch (err) {
        const errorMsg = err instanceof Error ? err.message : '加载数据时发生错误';
        logger.error('获取精选分类时发生异常:', errorMsg);
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

    if (featuredCategories.includes(newCategory.trim())) {
      setMessage({ type: 'error', text: '分类已存在' });
      return;
    }

    try {
      setIsSaving(true);
      const updatedCategories = [...featuredCategories, newCategory.trim()];
      const response = await homepageService.updateFeaturedCategories(updatedCategories);

      if (response.success) {
        setFeaturedCategories(updatedCategories);
        setNewCategory('');
        setMessage({ type: 'success', text: '分类添加成功' });
        
        // 添加分类后重置使用计数
        setInUseCategories((prev) => ({
          ...prev,
          [newCategory.trim()]: 0,
        }));
      } else {
        logger.error('添加分类失败:', response.message);
        setMessage({ type: 'error', text: response.message || '添加分类失败' });
      }
    } catch (err) {
      logger.error('添加分类过程中发生错误:', err);
      setMessage({ type: 'error', text: '添加分类时发生错误' });
    } finally {
      setIsSaving(false);
      
      // 3秒后清除消息
      setTimeout(() => setMessage(null), 3000);
    }
  };

  // 删除精选分类
  const handleDeleteCategory = async (category: string) => {
    // 检查分类是否被使用
    if (inUseCategories[category] && inUseCategories[category] > 0) {
      const confirmation = window.confirm(
        `此分类正在被 ${inUseCategories[category]} 个题库使用。删除此分类会影响这些题库在首页的显示方式。确定要删除吗？`
      );
      
      if (!confirmation) {
        return;
      }
    }
    
    try {
      setIsSaving(true);
      const updatedCategories = featuredCategories.filter((c) => c !== category);
      const response = await homepageService.updateFeaturedCategories(updatedCategories);

      if (response.success) {
        setFeaturedCategories(updatedCategories);
        // 更新使用计数
        const newInUseCategories = { ...inUseCategories };
        delete newInUseCategories[category];
        setInUseCategories(newInUseCategories);
        
        setMessage({ type: 'success', text: '分类删除成功' });
      } else {
        logger.error('删除分类失败:', response.message);
        setMessage({ type: 'error', text: response.message || '删除分类失败' });
      }
    } catch (err) {
      logger.error('删除分类过程中发生错误:', err);
      setMessage({ type: 'error', text: '删除分类时发生错误' });
    } finally {
      setIsSaving(false);
      
      // 3秒后清除消息
      setTimeout(() => setMessage(null), 3000);
    }
  };

  // 更新分类名称
  const handleUpdateCategory = async (oldCategory: string, newCategoryName: string) => {
    if (!newCategoryName.trim()) {
      setMessage({ type: 'error', text: '分类名称不能为空' });
      return;
    }
    
    if (oldCategory === newCategoryName.trim()) {
      return; // 名称没有变化，不需要更新
    }
    
    if (featuredCategories.includes(newCategoryName.trim())) {
      setMessage({ type: 'error', text: '已存在同名分类' });
      return;
    }
    
    try {
      setIsSaving(true);
      // 替换分类名称
      const updatedCategories = featuredCategories.map((c) => 
        c === oldCategory ? newCategoryName.trim() : c
      );
      
      const response = await homepageService.updateFeaturedCategories(updatedCategories);

      if (response.success) {
        setFeaturedCategories(updatedCategories);
        
        // 更新使用计数
        const useCount = inUseCategories[oldCategory] || 0;
        const newInUseCategories = { ...inUseCategories };
        delete newInUseCategories[oldCategory];
        newInUseCategories[newCategoryName.trim()] = useCount;
        setInUseCategories(newInUseCategories);
        
        setMessage({ type: 'success', text: '分类名称更新成功' });
      } else {
        logger.error('更新分类名称失败:', response.message);
        setMessage({ type: 'error', text: response.message || '更新分类名称失败' });
      }
    } catch (err) {
      logger.error('更新分类名称过程中发生错误:', err);
      setMessage({ type: 'error', text: '更新分类名称时发生错误' });
    } finally {
      setIsSaving(false);
      
      // 3秒后清除消息
      setTimeout(() => setMessage(null), 3000);
    }
  };
  
  if (loading) {
    return (
      <div className="flex justify-center items-center p-8">
        <div className="animate-spin rounded-full h-12 w-12 border-t-2 border-b-2 border-blue-500"></div>
        <span className="ml-3 text-lg">正在加载...</span>
      </div>
    );
  }

  if (error) {
    return (
      <div className="p-6 bg-red-50 border-l-4 border-red-500 text-red-700">
        <h3 className="text-lg font-medium mb-2">加载失败</h3>
        <p>{error}</p>
        <button 
          onClick={() => window.location.reload()}
          className="mt-4 px-4 py-2 bg-red-600 text-white rounded hover:bg-red-700"
        >
          重新加载
        </button>
      </div>
    );
  }

  return (
    <div className="p-6">
      <h2 className="text-2xl font-semibold mb-4">精选分类管理</h2>
      
      {message && (
        <div className={`p-4 mb-6 rounded-lg ${message.type === 'success' ? 'bg-green-100 text-green-800' : 'bg-red-100 text-red-800'}`}>
          {message.text}
        </div>
      )}

      <div className="bg-blue-50 p-4 rounded-lg mb-6 text-blue-700">
        <h3 className="font-medium mb-2">使用说明</h3>
        <ul className="list-disc pl-5 text-sm space-y-1">
          <li>精选分类决定了题库在首页上的分组方式</li>
          <li>需要先在此处添加分类，然后在<strong>精选题库管理</strong>中为题库分配分类</li>
          <li>删除分类不会删除题库，但会影响题库在首页的显示</li>
          <li>修改分类名称后，使用该分类的题库将自动更新</li>
        </ul>
      </div>

      <div className="bg-white shadow overflow-hidden sm:rounded-lg mb-6">
        <div className="p-6 border-b border-gray-200">
          <h3 className="text-lg font-medium mb-4">添加新分类</h3>
          <div className="flex">
            <input
              type="text"
              value={newCategory}
              onChange={(e) => setNewCategory(e.target.value)}
              placeholder="输入新分类名称"
              className="flex-1 border border-gray-300 rounded-l-lg px-4 py-2 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
            />
            <button
              onClick={handleAddCategory}
              disabled={isSaving || !newCategory.trim()}
              className="bg-blue-600 text-white px-6 py-2 rounded-r-lg hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2 disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {isSaving ? '添加中...' : '添加分类'}
            </button>
          </div>
        </div>
      </div>

      <div className="bg-white shadow overflow-hidden sm:rounded-lg">
        <div className="px-4 py-5 sm:px-6 border-b border-gray-200">
          <h3 className="text-lg font-medium">当前分类列表</h3>
          <p className="mt-1 text-sm text-gray-500">共 {featuredCategories.length} 个精选分类</p>
        </div>
        
        <div className="p-0">
          {featuredCategories.length > 0 ? (
            <div className="divide-y divide-gray-200">
              {featuredCategories.map((category, index) => {
                const useCount = inUseCategories[category] || 0;
                return (
                  <div key={index} className="p-4 hover:bg-gray-50">
                    <div className="flex items-center justify-between">
                      <div className="flex-1 mr-4">
                        <div className="flex items-center">
                          <input
                            type="text"
                            defaultValue={category}
                            onBlur={(e) => handleUpdateCategory(category, e.target.value)}
                            className="w-full p-2 border border-gray-300 rounded focus:ring-blue-500 focus:border-blue-500"
                          />
                        </div>
                      </div>
                      <div className="flex items-center space-x-3">
                        <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${
                          useCount > 0 ? 'bg-green-100 text-green-800' : 'bg-gray-100 text-gray-800'
                        }`}>
                          {useCount > 0 ? `${useCount} 个题库使用中` : '未使用'}
                        </span>
                        <button
                          onClick={() => handleDeleteCategory(category)}
                          disabled={isSaving}
                          className="p-1 rounded-full text-red-600 hover:bg-red-50 focus:outline-none focus:ring-2 focus:ring-red-500"
                          title="删除分类"
                        >
                          <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                          </svg>
                        </button>
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          ) : (
            <div className="text-center py-12">
              <svg className="mx-auto h-12 w-12 text-gray-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1} d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2" />
              </svg>
              <h3 className="mt-2 text-sm font-medium text-gray-900">暂无精选分类</h3>
              <p className="mt-1 text-sm text-gray-500">点击上方"添加分类"按钮创建您的第一个精选分类</p>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

export default AdminFeaturedCategories; 
