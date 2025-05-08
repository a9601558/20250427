import React, { useState, useEffect } from 'react';
import { useUser } from '../../contexts/UserContext';
import { homepageService, questionSetService } from '../../services/api';
import { QuestionSet } from '../../types';

interface FeaturedQuestionSet extends QuestionSet {
  isFeatured: boolean;
  featuredCategory?: string;
}

const AdminFeaturedManagement: React.FC = () => {
  const { isAdmin } = useUser();
  
  // Common states
  const [loading, setLoading] = useState<boolean>(true);
  const [error, setError] = useState<string | null>(null);
  const [message, setMessage] = useState<{ type: 'success' | 'error', text: string } | null>(null);
  const [activeTab, setActiveTab] = useState<'categories' | 'questionSets'>('categories');
  
  // Category management states
  const [featuredCategories, setFeaturedCategories] = useState<string[]>([]);
  const [newCategory, setNewCategory] = useState<string>('');
  const [isSaving, setIsSaving] = useState<boolean>(false);
  const [inUseCategories, setInUseCategories] = useState<{[key: string]: number}>({});
  const [editingCategory, setEditingCategory] = useState<{index: number, value: string} | null>(null);
  
  // Question set management states
  const [questionSets, setQuestionSets] = useState<FeaturedQuestionSet[]>([]);
  const [categoryFilter, setCategoryFilter] = useState<string>('all');
  const [searchTerm, setSearchTerm] = useState<string>('');

  // Load data on component mount
  useEffect(() => {
    if (isAdmin()) {
      loadData();
    }
  }, [isAdmin]);

  // Load all necessary data
  const loadData = async () => {
    setLoading(true);
    try {
      // Get featured categories
      const fcResponse = await homepageService.getFeaturedCategories();
      
      // Get all question sets
      const qsResponse = await questionSetService.getAllQuestionSets();
      
      if (fcResponse.success && fcResponse.data) {
        setFeaturedCategories(fcResponse.data);
      } else {
        console.error('获取精选分类失败:', fcResponse.message);
      }
      
      if (qsResponse.success && qsResponse.data) {
        setQuestionSets(qsResponse.data as FeaturedQuestionSet[]);
        
        // Calculate which categories are in use
        if (fcResponse.success && fcResponse.data) {
          const categories = fcResponse.data; // Store in local variable
          const inUseCount: {[key: string]: number} = {};
          
          qsResponse.data.forEach(qs => {
            if (qs.featuredCategory && categories.includes(qs.featuredCategory)) {
              inUseCount[qs.featuredCategory] = (inUseCount[qs.featuredCategory] || 0) + 1;
            }
          });
          
          setInUseCategories(inUseCount);
        }
      } else {
        const errorMsg = qsResponse.error || '加载题库失败';
        console.error('获取题库失败:', errorMsg);
        setError(errorMsg);
      }
    } catch (err) {
      const errorMsg = err instanceof Error ? err.message : '加载数据时发生错误';
      console.error('加载数据时发生错误:', errorMsg);
      setError(errorMsg);
    } finally {
      setLoading(false);
    }
  };

  // Display message with auto-dismiss
  const showMessage = (type: 'success' | 'error', text: string) => {
    setMessage({ type, text });
    setTimeout(() => setMessage(null), 3000);
  };

  // ===== Category Management Functions =====
  
  // Add new category
  const handleAddCategory = async () => {
    if (!newCategory.trim()) {
      showMessage('error', '分类名称不能为空');
      return;
    }

    if (featuredCategories.includes(newCategory.trim())) {
      showMessage('error', '分类已存在');
      return;
    }

    try {
      setIsSaving(true);
      const updatedCategories = [...featuredCategories, newCategory.trim()];
      const response = await homepageService.updateFeaturedCategories(updatedCategories);

      if (response.success) {
        setFeaturedCategories(updatedCategories);
        setNewCategory('');
        showMessage('success', '分类添加成功');
        
        // Initialize usage count for the new category
        setInUseCategories(prev => ({
          ...prev,
          [newCategory.trim()]: 0
        }));
      } else {
        console.error('添加分类失败:', response.message);
        showMessage('error', response.message || '添加分类失败');
      }
    } catch (err) {
      console.error('添加分类时发生错误:', err);
      showMessage('error', '添加分类时发生错误');
    } finally {
      setIsSaving(false);
    }
  };

  // Delete category
  const handleDeleteCategory = async (category: string) => {
    // Check if category is in use
    if (inUseCategories[category] && inUseCategories[category] > 0) {
      const confirmation = window.confirm(
        `此分类正在被 ${inUseCategories[category]} 个题库使用。删除此分类会影响这些题库的分类设置。确定要删除吗？`
      );
      
      if (!confirmation) {
        return;
      }
      
      // If confirmed, clear category from all question sets
      try {
        const affectedQuestionSets = questionSets.filter(qs => qs.featuredCategory === category);
        
        for (const qs of affectedQuestionSets) {
          await questionSetService.setFeaturedQuestionSet(qs.id, qs.isFeatured, '');
        }
        
        // Update local state
        setQuestionSets(prevSets => 
          prevSets.map(qs => 
            qs.featuredCategory === category ? { ...qs, featuredCategory: '' } : qs
          )
        );
      } catch (err) {
        console.error('清除题库分类时发生错误:', err);
        showMessage('error', '清除题库分类时发生错误');
        return;
      }
    }
    
    try {
      setIsSaving(true);
      const updatedCategories = featuredCategories.filter(c => c !== category);
      const response = await homepageService.updateFeaturedCategories(updatedCategories);

      if (response.success) {
        setFeaturedCategories(updatedCategories);
        // Update usage counts
        const newInUseCategories = {...inUseCategories};
        delete newInUseCategories[category];
        setInUseCategories(newInUseCategories);
        
        showMessage('success', '分类删除成功');
      } else {
        console.error('删除分类失败:', response.message);
        showMessage('error', response.message || '删除分类失败');
      }
    } catch (err) {
      console.error('删除分类时发生错误:', err);
      showMessage('error', '删除分类时发生错误');
    } finally {
      setIsSaving(false);
    }
  };

  // Update category name
  const handleUpdateCategory = async (oldCategory: string, newCategoryName: string) => {
    // Cancel editing state
    setEditingCategory(null);
    
    if (!newCategoryName.trim()) {
      showMessage('error', '分类名称不能为空');
      return;
    }
    
    if (oldCategory === newCategoryName.trim()) {
      return; // No change needed
    }
    
    if (featuredCategories.includes(newCategoryName.trim())) {
      showMessage('error', '已存在同名分类');
      return;
    }
    
    try {
      setIsSaving(true);
      // Update category in array
      const updatedCategories = featuredCategories.map(c => 
        c === oldCategory ? newCategoryName.trim() : c
      );
      
      const response = await homepageService.updateFeaturedCategories(updatedCategories);

      if (response.success) {
        setFeaturedCategories(updatedCategories);
        
        // Update category usage counts
        const useCount = inUseCategories[oldCategory] || 0;
        const newInUseCategories = {...inUseCategories};
        delete newInUseCategories[oldCategory];
        newInUseCategories[newCategoryName.trim()] = useCount;
        setInUseCategories(newInUseCategories);
        
        // Update category in question sets
        const updatedQuestionSets = await Promise.all(
          questionSets
            .filter(qs => qs.featuredCategory === oldCategory)
            .map(async (qs) => {
              await questionSetService.setFeaturedQuestionSet(
                qs.id, 
                qs.isFeatured, 
                newCategoryName.trim()
              );
              return {
                ...qs,
                featuredCategory: newCategoryName.trim()
              };
            })
        );
        
        // Update question sets state
        if (updatedQuestionSets.length > 0) {
          setQuestionSets(prev => 
            prev.map(qs => {
              const updated = updatedQuestionSets.find(u => u.id === qs.id);
              return updated || qs;
            })
          );
        }
        
        showMessage('success', '分类更新成功');
      } else {
        console.error('更新分类失败:', response.message);
        showMessage('error', response.message || '更新分类失败');
      }
    } catch (err) {
      console.error('更新分类时发生错误:', err);
      showMessage('error', '更新分类时发生错误');
    } finally {
      setIsSaving(false);
    }
  };

  // ===== Question Set Management Functions =====
  
  // Update featured status
  const handleFeaturedStatusChange = async (id: string, isFeatured: boolean) => {
    try {
      const currentSet = questionSets.find(qs => qs.id === id);
      if (!currentSet) {
        showMessage('error', '找不到指定题库');
        return;
      }

      const response = await questionSetService.setFeaturedQuestionSet(
        id, 
        isFeatured,
        currentSet.featuredCategory
      );

      if (response.success) {
        // Update local state
        setQuestionSets(prev => 
          prev.map(qs => 
            qs.id === id ? { ...qs, isFeatured } : qs
          )
        );
        
        showMessage('success', `题库已${isFeatured ? '标记为' : '取消'}精选`);
      } else {
        console.error(`更新精选状态失败:`, response.error);
        showMessage('error', response.error || '更新失败');
      }
    } catch (err) {
      console.error(`更新精选状态时发生错误:`, err);
      showMessage('error', '更新过程中发生错误');
    }
  };

  // Update featured category
  const handleFeaturedCategoryChange = async (id: string, featuredCategory: string) => {
    try {
      const currentSet = questionSets.find(qs => qs.id === id);
      if (!currentSet) {
        showMessage('error', '找不到指定题库');
        return;
      }

      // Update old category counts
      if (currentSet.featuredCategory && inUseCategories[currentSet.featuredCategory]) {
        setInUseCategories(prev => ({
          ...prev,
          [currentSet.featuredCategory!]: Math.max(0, (prev[currentSet.featuredCategory!] || 0) - 1)
        }));
      }
      
      // Update new category counts
      if (featuredCategory) {
        setInUseCategories(prev => ({
          ...prev,
          [featuredCategory]: (prev[featuredCategory] || 0) + 1
        }));
      }

      const response = await questionSetService.setFeaturedQuestionSet(
        id, 
        currentSet.isFeatured, 
        featuredCategory
      );

      if (response.success) {
        // Update local state
        setQuestionSets(prev => 
          prev.map(qs => 
            qs.id === id ? { ...qs, featuredCategory } : qs
          )
        );
        
        showMessage('success', '精选分类已更新');
      } else {
        console.error('更新精选分类失败:', response.error);
        showMessage('error', response.error || '更新失败');
      }
    } catch (err) {
      console.error('更新精选分类时发生错误:', err);
      showMessage('error', '更新过程中发生错误');
    }
  };

  // Filter and search question sets
  const getFilteredQuestionSets = () => {
    let filtered = questionSets;
    
    // Apply category filter
    if (categoryFilter !== 'all') {
      filtered = filtered.filter(qs => 
        categoryFilter === 'uncategorized' 
          ? !qs.featuredCategory 
          : qs.featuredCategory === categoryFilter
      );
    }
    
    // Apply search filter
    if (searchTerm.trim()) {
      const term = searchTerm.toLowerCase().trim();
      filtered = filtered.filter(qs => 
        qs.title.toLowerCase().includes(term) || 
        qs.description.toLowerCase().includes(term) ||
        qs.category.toLowerCase().includes(term)
      );
    }
    
    return filtered;
  };

  // Loading indicator
  if (loading) {
    return (
      <div className="flex justify-center items-center p-8">
        <div className="animate-spin rounded-full h-12 w-12 border-t-2 border-b-2 border-blue-500"></div>
        <span className="ml-3 text-lg">正在加载...</span>
      </div>
    );
  }

  // Error message
  if (error) {
    return (
      <div className="p-6 bg-red-50 border-l-4 border-red-500 text-red-700">
        <h3 className="text-lg font-medium mb-2">加载失败</h3>
        <p>{error}</p>
        <button 
          onClick={() => loadData()}
          className="mt-4 px-4 py-2 bg-red-600 text-white rounded hover:bg-red-700"
        >
          重新加载
        </button>
      </div>
    );
  }

  return (
    <div className="p-6">
      <h2 className="text-2xl font-semibold mb-6">精选内容管理</h2>
      
      {/* Status message */}
      {message && (
        <div className={`p-4 mb-6 rounded-lg ${message.type === 'success' ? 'bg-green-100 text-green-800' : 'bg-red-100 text-red-800'}`}>
          {message.text}
        </div>
      )}

      {/* Tabs */}
      <div className="border-b border-gray-200 mb-6">
        <div className="flex -mb-px">
          <button
            className={`py-4 px-6 font-medium text-sm ${
              activeTab === 'categories'
                ? 'border-b-2 border-blue-500 text-blue-600'
                : 'text-gray-500 hover:text-gray-700 hover:border-gray-300'
            }`}
            onClick={() => setActiveTab('categories')}
          >
            精选分类管理
          </button>
          <button
            className={`py-4 px-6 font-medium text-sm ${
              activeTab === 'questionSets'
                ? 'border-b-2 border-blue-500 text-blue-600'
                : 'text-gray-500 hover:text-gray-700 hover:border-gray-300'
            }`}
            onClick={() => setActiveTab('questionSets')}
          >
            精选题库管理
          </button>
        </div>
      </div>

      {/* Instructions */}
      <div className="bg-blue-50 p-4 rounded-lg mb-6 text-blue-700">
        <h3 className="font-medium mb-2">使用说明</h3>
        <ul className="list-disc pl-5 text-sm space-y-1">
          <li>在"精选分类管理"中创建和管理显示在首页的分类</li>
          <li>在"精选题库管理"中为题库分配分类并标记为精选</li>
          <li>被标记为精选的题库和分配了精选分类的题库会在首页推荐区域显示</li>
          <li>精选分类决定了题库在首页上的分组方式</li>
        </ul>
      </div>

      {/* Category Management Tab */}
      {activeTab === 'categories' && (
        <div>
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
                  disabled={isSaving}
                  className={`px-4 py-2 bg-blue-600 text-white rounded-r-lg hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2 ${isSaving ? 'opacity-50 cursor-not-allowed' : ''}`}
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
                    const isEditing = editingCategory?.index === index;
                    
                    return (
                      <div key={index} className="p-4 hover:bg-gray-50">
                        <div className="flex items-center justify-between">
                          <div className="flex-1 mr-4">
                            {isEditing ? (
                              <input
                                type="text"
                                value={editingCategory.value}
                                onChange={(e) => setEditingCategory({...editingCategory, value: e.target.value})}
                                onBlur={() => handleUpdateCategory(category, editingCategory.value)}
                                onKeyDown={(e) => {
                                  if (e.key === 'Enter') {
                                    handleUpdateCategory(category, editingCategory.value);
                                  } else if (e.key === 'Escape') {
                                    setEditingCategory(null);
                                  }
                                }}
                                autoFocus
                                className="w-full p-2 border border-gray-300 rounded focus:ring-blue-500 focus:border-blue-500"
                              />
                            ) : (
                              <div 
                                className="font-medium text-gray-900 cursor-pointer hover:text-blue-600"
                                onClick={() => setEditingCategory({index, value: category})}
                              >
                                {category}
                              </div>
                            )}
                          </div>
                          
                          <div className="flex items-center">
                            <span className={`px-2.5 py-0.5 rounded-full text-xs font-medium ${
                              useCount > 0 ? 'bg-green-100 text-green-800' : 'bg-gray-100 text-gray-800'
                            } mr-3`}>
                              {useCount} 个题库使用中
                            </span>
                            
                            <button
                              onClick={() => handleDeleteCategory(category)}
                              disabled={isSaving}
                              className="text-red-600 hover:text-red-900 focus:outline-none"
                            >
                              <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" viewBox="0 0 20 20" fill="currentColor">
                                <path fillRule="evenodd" d="M9 2a1 1 0 00-.894.553L7.382 4H4a1 1 0 000 2v10a2 2 0 002 2h8a2 2 0 002-2V6a1 1 0 100-2h-3.382l-.724-1.447A1 1 0 0011 2H9zM7 8a1 1 0 012 0v6a1 1 0 11-2 0V8zm5-1a1 1 0 00-1 1v6a1 1 0 102 0V8a1 1 0 00-1-1z" clipRule="evenodd" />
                              </svg>
                            </button>
                          </div>
                        </div>
                      </div>
                    );
                  })}
                </div>
              ) : (
                <div className="p-6 text-center text-gray-500">
                  <p>暂无精选分类</p>
                </div>
              )}
            </div>
          </div>
        </div>
      )}

      {/* Question Set Management Tab */}
      {activeTab === 'questionSets' && (
        <div>
          {/* Search and filter */}
          <div className="bg-white shadow rounded-lg p-6 mb-6">
            <div className="sm:flex sm:justify-between sm:items-center mb-4">
              <h3 className="text-lg font-medium mb-2 sm:mb-0">题库过滤</h3>
              
              <div className="flex flex-col sm:flex-row sm:items-center sm:space-x-4">
                <div className="flex items-center mb-2 sm:mb-0">
                  <span className="text-sm font-medium text-gray-700 mr-2">分类筛选:</span>
                  <select
                    value={categoryFilter}
                    onChange={(e) => setCategoryFilter(e.target.value)}
                    className="block w-full sm:w-auto rounded-md border-gray-300 shadow-sm focus:border-blue-500 focus:ring-blue-500 sm:text-sm"
                  >
                    <option value="all">全部分类</option>
                    <option value="uncategorized">未分类</option>
                    {featuredCategories.map((category, index) => (
                      <option key={index} value={category}>{category}</option>
                    ))}
                  </select>
                </div>
                
                <div className="relative">
                  <input
                    type="text"
                    placeholder="搜索题库..."
                    value={searchTerm}
                    onChange={(e) => setSearchTerm(e.target.value)}
                    className="block w-full rounded-md border-gray-300 shadow-sm focus:border-blue-500 focus:ring-blue-500 sm:text-sm pl-10"
                  />
                  <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                    <svg className="h-5 w-5 text-gray-400" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20" fill="currentColor">
                      <path fillRule="evenodd" d="M8 4a4 4 0 100 8 4 4 0 000-8zM2 8a6 6 0 1110.89 3.476l4.817 4.817a1 1 0 01-1.414 1.414l-4.816-4.816A6 6 0 012 8z" clipRule="evenodd" />
                    </svg>
                  </div>
                </div>
              </div>
            </div>
            
            <div className="text-sm text-gray-500">
              提示: 先在"精选分类管理"中创建分类，然后在这里为题库分配分类。
            </div>
          </div>

          {/* Question Sets Table */}
          <div className="bg-white shadow rounded-lg overflow-hidden">
            <div className="px-4 py-5 sm:px-6 border-b border-gray-200">
              <h3 className="text-lg font-medium">题库列表</h3>
              <p className="mt-1 text-sm text-gray-500">
                共 {questionSets.length} 个题库，当前筛选显示 {getFilteredQuestionSets().length} 个
              </p>
            </div>
            
            <div className="overflow-x-auto">
              <table className="min-w-full divide-y divide-gray-200">
                <thead className="bg-gray-50">
                  <tr>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">题库信息</th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">分类</th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">设为精选</th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">精选分类</th>
                  </tr>
                </thead>
                <tbody className="bg-white divide-y divide-gray-200">
                  {getFilteredQuestionSets().map((qs) => (
                    <tr key={qs.id} className="hover:bg-gray-50">
                      <td className="px-6 py-4 whitespace-nowrap">
                        <div className="flex items-center">
                          <div className="text-2xl mr-3">{qs.icon || '📚'}</div>
                          <div>
                            <div className="text-sm font-medium text-gray-900">{qs.title}</div>
                            <div className="text-sm text-gray-500">{qs.questionCount || qs.questions?.length || 0} 个问题</div>
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
                          value={qs.featuredCategory || ''}
                          onChange={(e) => handleFeaturedCategoryChange(qs.id, e.target.value)}
                          className="block w-full rounded-md border-gray-300 shadow-sm focus:border-blue-500 focus:ring-blue-500 sm:text-sm"
                        >
                          <option value="">无分类</option>
                          {featuredCategories.map((category, index) => (
                            <option key={index} value={category}>{category}</option>
                          ))}
                        </select>
                      </td>
                    </tr>
                  ))}
                  
                  {getFilteredQuestionSets().length === 0 && (
                    <tr>
                      <td colSpan={4} className="px-6 py-10 text-center text-gray-500">
                        没有找到符合条件的题库
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default AdminFeaturedManagement; 