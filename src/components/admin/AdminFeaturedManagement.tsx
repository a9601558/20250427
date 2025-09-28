import React, { useState, useEffect } from 'react';
import { useUser } from '../../contexts/UserContext';
import { homepageService, questionSetService } from '../../services/api';
import { QuestionSet } from '../../types';
import { useSocket } from '../../contexts/SocketContext';

interface FeaturedQuestionSet extends QuestionSet {
  isFeatured: boolean;
  featuredCategory?: string;
  questionSetQuestions?: { id: string }[];
}

const AdminFeaturedManagement: React.FC = () => {
  const { isAdmin } = useUser();
  const { socket } = useSocket();
  
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

  // 保存分类到localStorage
  const saveCategoryToLocalStorage = (categories: string[]) => {
    try {
      localStorage.setItem('featuredCategories', JSON.stringify(categories));
      console.log("精选分类保存済み到localStorage:", categories);
    } catch (e) {
      console.error("保存分类到localStorage失败:", e);
    }
  };

  // Load all necessary data
  const loadData = async () => {
    setLoading(true);
    setError(null); // Clear previous errors
    
    try {
      console.log("开始加载精选内容管理数据...");
      
      // Get featured categories
      console.log("正在获取精选分类...");
      const fcResponse = await homepageService.getFeaturedCategories();
      
      // Get all question sets
      console.log("正在获取所有题库...");
      const qsResponse = await questionSetService.getAllQuestionSets();
      
      if (fcResponse.success && fcResponse.data) {
        console.log("成功加载精选分类，原始数据:", fcResponse.data);
        
        // 确保数据是数组格式
        const categories = Array.isArray(fcResponse.data) 
          ? fcResponse.data 
          : (typeof fcResponse.data === 'string' ? JSON.parse(fcResponse.data) : []);
        
        setFeaturedCategories(categories);
        console.log("分类数据已设置到state，分类数量:", categories.length);
        
        // 保存到localStorage为后备数据
        saveCategoryToLocalStorage(categories);
      } else {
        console.error('获取精选分类失败:', fcResponse.message || '未知错误', '响应数据:', fcResponse);
        setError('获取精选分类失败: ' + (fcResponse.message || '未知错误'));
        
        // 尝试从localStorage中恢复数据作为后备
        try {
          const storedCategories = localStorage.getItem('featuredCategories');
          if (storedCategories) {
            const parsedCategories = JSON.parse(storedCategories);
            if (Array.isArray(parsedCategories) && parsedCategories.length > 0) {
              console.log("从localStorage恢复精选分类:", parsedCategories);
              setFeaturedCategories(parsedCategories);
            }
          }
        } catch (e) {
          console.error("无法从localStorage恢复分类:", e);
        }
      }
      
      if (qsResponse.success && qsResponse.data) {
        console.log("成功获取题库数据，题库数量:", qsResponse.data.length);
        
        // 确保每个题库都有正确的問題计数
        const questionSetsWithVerifiedCounts = await Promise.all(
          (qsResponse.data as FeaturedQuestionSet[]).map(async (set) => {
            // 如果questionCount为空或0，尝试从questions或questionSetQuestions数组中获取
            let questionCount = set.questionCount || 0;
            
            if ((!questionCount || questionCount === 0) && 
               ((set.questions && set.questions.length > 0) || 
                (set.questionSetQuestions && set.questionSetQuestions.length > 0))) {
              
              questionCount = set.questions?.length || set.questionSetQuestions?.length || 0;
              console.log(`从本地数据计算题库 "${set.title}" 的题目数: ${questionCount}`);
            }
            
            // 如果本地计算的数量仍为0，尝试从API获取准确计数
            if (questionCount === 0) {
              try {
                console.log(`尝试从API获取题库 "${set.title}" 的题目数...`);
                // 使用fetch直接调用API获取题目数
                const response = await fetch(`/api/questions/count/${set.id}`);
                if (response.ok) {
                  const data = await response.json();
                  questionCount = data.count || 0;
                  console.log(`从API获取题库 "${set.title}" 的题目数: ${questionCount}`);
                } else {
                  console.warn(`无法从API获取题库 "${set.title}" 的题目数:`, await response.text());
                }
              } catch (err) {
                console.error(`获取题库 "${set.title}" 题目数失败:`, err);
              }
            }
            
            // 确保isFeatured和featuredCategory字段有正确的值
            const isFeatured = set.isFeatured === true;
            console.log(`题库 "${set.title}" 精选状态:`, isFeatured, ', 精选分类:', set.featuredCategory || '无');
            
            return {
              ...set,
              questionCount,
              isFeatured: isFeatured,
              featuredCategory: set.featuredCategory || ''
            } as FeaturedQuestionSet;
          })
        );
        
        console.log("处理完毕的题库数据:", questionSetsWithVerifiedCounts.length);
        
        // 检查数据中的精选状态
        const featuredSets = questionSetsWithVerifiedCounts.filter(set => set.isFeatured);
        console.log(`其中精选题库数量: ${featuredSets.length}，分别是:`, 
          featuredSets.map(set => ({ id: set.id, title: set.title, category: set.featuredCategory }))
        );
        
        setQuestionSets(questionSetsWithVerifiedCounts);
        
        // Calculate which categories are in use
        if (fcResponse.success && fcResponse.data) {
          const categories = Array.isArray(fcResponse.data) 
            ? fcResponse.data 
            : (typeof fcResponse.data === 'string' ? JSON.parse(fcResponse.data) : []);
            
          const inUseCount: {[key: string]: number} = {};
          
          questionSetsWithVerifiedCounts.forEach(qs => {
            if (qs.featuredCategory && categories.includes(qs.featuredCategory)) {
              inUseCount[qs.featuredCategory] = (inUseCount[qs.featuredCategory] || 0) + 1;
            }
          });
          
          console.log("分类使用情况:", inUseCount);
          setInUseCategories(inUseCount);
        }
      } else {
        const errorMsg = qsResponse.error || qsResponse.message || '加载题库失败';
        console.error('获取题库失败:', errorMsg);
        setError(errorMsg);
      }
    } catch (err) {
      const errorMsg = err instanceof Error ? err.message : '加载数据时发生错误';
      console.error('加载数据时发生错误:', err);
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
        
        // 保存到localStorage
        saveCategoryToLocalStorage(updatedCategories);
        
        // Initialize usage count for the new category
        setInUseCategories(prev => ({
          ...prev,
          [newCategory.trim()]: 0
        }));
        
        // 通知所有客户端更新
        notifyClientsOfCategoryChange('added', newCategory.trim());
        
        // 刷新所有数据，确保UI显示最新状态
        await loadData();
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
        `このカテゴリは ${inUseCategories[category]} 個の問題集で使用されています。このカテゴリを削除すると、これらの問題集のカテゴリ設定に影響します。削除しますか？`
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
        // 保存到localStorage
        saveCategoryToLocalStorage(updatedCategories);
        
        // Update usage counts
        const newInUseCategories = {...inUseCategories};
        delete newInUseCategories[category];
        setInUseCategories(newInUseCategories);
        
        showMessage('success', '分类删除成功');
        
        // 通知所有客户端更新
        notifyClientsOfCategoryChange('deleted', category);
        
        // 刷新所有数据，确保UI显示最新状态
        await loadData();
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
        // 保存到localStorage
        saveCategoryToLocalStorage(updatedCategories);
        
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
        
        // 通知所有客户端更新
        notifyClientsOfCategoryChange('updated', newCategoryName.trim(), oldCategory);
        
        // 刷新所有数据，确保UI显示最新状态
        await loadData();
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

  // 通知所有客户端分类变更
  const notifyClientsOfCategoryChange = (action: 'added' | 'deleted' | 'updated', category: string, oldCategory?: string) => {
    if (!socket) {
      console.log("Socket未连接，无法发送通知");
      return;
    }
    
      try {
      console.log(`通知所有客户端分类变更: ${action} ${category}`);
      
      // 发送websocket事件
      socket.emit('admin:homeContent:updated', {
        type: 'featuredCategories',
          action,
          category,
        oldCategory,
        timestamp: Date.now()
        });
      
      // 使用localStorage强制刷新
      localStorage.setItem('home_content_updated', Date.now().toString());
      localStorage.setItem('home_content_force_reload', Date.now().toString());
      
      // 使用自定义事件通知页面刷新
      const customEvent = new CustomEvent('homeContent:updated', {
        detail: {
          type: 'featuredCategories',
          action,
          category,
          oldCategory,
          timestamp: Date.now()
        }
      });
      
      window.dispatchEvent(customEvent);
      
      // 显示额外确认消息
      showMessage('success', `通知已发送，所有客户端将刷新分类（${action}: ${category}）`);
      } catch (err) {
      console.error("发送通知失败:", err);
    }
  };

  // 通知所有客户端题库精选状态变更
  const notifyClientsOfQuestionSetChange = (id: string, isFeatured: boolean, featuredCategory?: string) => {
    if (!socket) {
      console.log("Socket未连接，无法发送通知");
      return;
    }
    
    try {
      console.log(`通知所有客户端题库精选状态变更: ${id}, isFeatured=${isFeatured}, category=${featuredCategory || 'none'}`);
      
      // 查找题库获取更多信息
      const set = questionSets.find(qs => qs.id === id);
      const title = set ? set.title : id;
      
      // 发送websocket事件
      socket.emit('admin:homeContent:updated', {
        type: 'featuredQuestionSet',
        action: isFeatured ? 'featured' : 'unfeatured',
        questionSetId: id,
        title,
          featuredCategory,
          timestamp: Date.now()
        });
        
      // 使用localStorage强制刷新
      localStorage.setItem('home_content_updated', Date.now().toString());
      localStorage.setItem('home_content_force_reload', Date.now().toString());
      
      // 使用自定义事件通知页面刷新
      const customEvent = new CustomEvent('homeContent:updated', {
          detail: {
            type: 'featuredQuestionSet',
          action: isFeatured ? 'featured' : 'unfeatured',
          questionSetId: id,
          title,
          featuredCategory,
            timestamp: Date.now()
          }
      });
      
      window.dispatchEvent(customEvent);
        
      // 显示额外确认消息
      showMessage('success', `通知已发送，所有客户端将刷新题库状态（${title}）`);
      } catch (err) {
      console.error("发送通知失败:", err);
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
        
        // 同步本地题库数据，确保前端显示正确
        if (response.data) {
          // 确保响应数据包含正确的题目计数
          const updatedSet = {
            ...response.data,
            questionCount: currentSet.questionCount || 0,
            isFeatured
          } as FeaturedQuestionSet;

          // 更新本地状态，保留题目计数
          setQuestionSets(prev => 
            prev.map(qs => qs.id === id ? updatedSet : qs)
          );
        }
        
        // 通知所有客户端更新
        notifyClientsOfQuestionSetChange(id, isFeatured, currentSet.featuredCategory);
        
        // 刷新所有数据，确保UI显示最新状态
        await loadData();
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
        // 保存更新后的题库
        const updatedSet = {
          ...currentSet,
          featuredCategory,
          // 保留题目计数
          questionCount: currentSet.questionCount || 0
        };
        
        // Update local state
        setQuestionSets(prev => 
          prev.map(qs => 
            qs.id === id ? updatedSet : qs
          )
        );
        
        showMessage('success', '精选分类已更新');
        
        // 通知所有客户端更新
        notifyClientsOfQuestionSetChange(id, currentSet.isFeatured, featuredCategory);
        
        // 刷新所有数据，确保UI显示最新状态
        await loadData();
      } else {
        console.error('更新精选分类失败:', response.error);
        showMessage('error', response.error || '更新失败');
        
        // 恢复原始计数，因为更新失败
        if (currentSet.featuredCategory) {
          setInUseCategories(prev => ({
            ...prev,
            [currentSet.featuredCategory!]: (prev[currentSet.featuredCategory!] || 0) + 1
          }));
        }
        
        if (featuredCategory) {
          setInUseCategories(prev => ({
            ...prev,
            [featuredCategory]: Math.max(0, (prev[featuredCategory] || 0) - 1)
          }));
        }
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
        <div className="flex justify-between">
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
          <button
            onClick={loadData}
            className="px-4 py-2 bg-green-600 text-white rounded hover:bg-green-700 transition-colors flex items-center"
            disabled={loading}
          >
            {loading ? (
              <div className="animate-spin h-5 w-5 border-2 border-white border-t-transparent rounded-full mr-1"></div>
            ) : (
              <svg className="h-5 w-5 mr-1" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
              </svg>
            )}
            {loading ? '加载中...' : '刷新数据'}
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
          <li>所有更改都会通过服务器实时同步到所有用户的首页</li>
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
                    <option value="all">全カテゴリ</option>
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
                            <div className="text-sm text-gray-500">
                              {qs.questionCount || qs.questions?.length || qs.questionSetQuestions?.length || 0} 个問題
                              {qs.questionCount === 0 && (
                                <span className="text-red-500 ml-2">(需要更新题目计数)</span>
                              )}
                            </div>
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