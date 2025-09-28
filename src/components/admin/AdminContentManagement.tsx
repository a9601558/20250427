import React, { useState, useEffect } from 'react';
import { useUser } from '../../contexts/UserContext';
import { useNavigate } from 'react-router-dom';
import { homepageService, questionSetService } from '../../services/api';
import { QuestionSet } from '../../types';
import { useSocket } from '../../contexts/SocketContext';

// 类型定义
interface FeaturedQuestionSet extends QuestionSet {
  isFeatured: boolean;
  featuredCategory?: string;
}

interface HomeContentData {
  title: string;
  subtitle: string;
  featuredCategories: string[];
  bannerImageUrl?: string;
}

const AdminContentManagement: React.FC = () => {
  const { isAdmin } = useUser();
  const { socket } = useSocket();
  const navigate = useNavigate();
  
  // 通用状态
  const [loading, setLoading] = useState<boolean>(true);
  const [message, setMessage] = useState<{ type: 'success' | 'error', text: string } | null>(null);
  const [activeTab, setActiveTab] = useState<'home' | 'categories' | 'questionSets'>('home');
  const [isSaving, setIsSaving] = useState<boolean>(false);
  
  // 首页内容管理状态
  const [homeContent, setHomeContent] = useState<HomeContentData>({
    title: '在线题库练习平台',
    subtitle: '提供优质的题库练习服务',
    featuredCategories: [],
    bannerImageUrl: ''
  });
  const [hasUnsavedChanges, setHasUnsavedChanges] = useState(false);
  
  // 精选分类管理状态
  const [featuredCategories, setFeaturedCategories] = useState<string[]>([]);
  const [newCategory, setNewCategory] = useState<string>('');
  const [inUseCategories, setInUseCategories] = useState<{[key: string]: number}>({});
  const [editingCategory, setEditingCategory] = useState<{index: number, value: string} | null>(null);
  
  // 题库管理状态
  const [questionSets, setQuestionSets] = useState<FeaturedQuestionSet[]>([]);
  const [categoryFilter, setCategoryFilter] = useState<string>('all');
  const [searchTerm, setSearchTerm] = useState<string>('');

  // 管理员检查
  useEffect(() => {
    if (!isAdmin()) {
      navigate('/');
    }
  }, [isAdmin, navigate]);

  // 加载数据
  useEffect(() => {
    if (isAdmin()) {
      loadData();
    }
  }, [isAdmin]);

  const loadData = async () => {
    setLoading(true);
    try {
      await Promise.all([
        loadHomeContent(),
        loadFeaturedCategories(),
        loadQuestionSets()
      ]);
    } catch (error) {
      console.error('加载数据失败:', error);
      showMessage('error', '加载数据失败');
    } finally {
      setLoading(false);
    }
  };

  // 加载首页内容
  const loadHomeContent = async () => {
    try {
      const response = await homepageService.getHomeContent();
      if (response.success && response.data) {
        setHomeContent(response.data);
      }
    } catch (error) {
      console.error('加载首页内容失败:', error);
    }
  };

  // 加载精选分类
  const loadFeaturedCategories = async () => {
    try {
      const response = await homepageService.getFeaturedCategories();
      if (response.success && response.data) {
        setFeaturedCategories(response.data);
        setHomeContent(prev => ({ ...prev, featuredCategories: response.data || [] }));
      }
    } catch (error) {
      console.error('加载精选分类失败:', error);
    }
  };

  // 加载题库数据
  const loadQuestionSets = async () => {
    try {
      const response = await questionSetService.getAllQuestionSets();
      if (response.success && response.data) {
        const setsWithFeatured = response.data.map((set: QuestionSet) => ({
          ...set,
          isFeatured: set.isFeatured || false,
          featuredCategory: set.featuredCategory || '',
          // 修复题目数量计算
          questionCount: getCorrectQuestionCount(set)
        }));
        setQuestionSets(setsWithFeatured);
        
        // 计算分类使用情况
        const categoryUsage: {[key: string]: number} = {};
        setsWithFeatured.forEach((set: FeaturedQuestionSet) => {
          if (set.isFeatured && set.featuredCategory) {
            categoryUsage[set.featuredCategory] = (categoryUsage[set.featuredCategory] || 0) + 1;
          }
        });
        setInUseCategories(categoryUsage);
      }
    } catch (error) {
      console.error('加载题库数据失败:', error);
    }
  };

  // 修复题目数量计算函数
  const getCorrectQuestionCount = (set: any): number => {
    // 优先使用API返回的questionCount
    if (typeof set.questionCount === 'number' && set.questionCount >= 0) {
      return set.questionCount;
    }
    
    // 其次使用questionSetQuestions数组（从API获取的原始数据）
    if (set.questionSetQuestions && Array.isArray(set.questionSetQuestions)) {
      return set.questionSetQuestions.length;
    }
    
    // 最后使用questions数组
    if (set.questions && Array.isArray(set.questions)) {
      return set.questions.length;
    }
    
    return 0;
  };

  // 保存首页内容
  const saveHomeContent = async () => {
    setIsSaving(true);
    try {
      const response = await homepageService.updateHomeContent(homeContent);
      if (response.success) {
        showMessage('success', '首页内容保存成功！');
        setHasUnsavedChanges(false);
        
        // 触发首页更新事件
        if (socket) {
          socket.emit('homepage:content:updated', homeContent);
        }
      } else {
        throw new Error(response.error || '保存失败');
      }
    } catch (error) {
      console.error('保存首页内容失败:', error);
      showMessage('error', '保存首页内容失败');
    } finally {
      setIsSaving(false);
    }
  };

  // 保存精选分类
  const saveFeaturedCategories = async () => {
    setIsSaving(true);
    try {
      const response = await homepageService.updateFeaturedCategories(featuredCategories);
      if (response.success) {
        showMessage('success', '精选分类保存成功！');
        setHomeContent(prev => ({ ...prev, featuredCategories }));
        
        // 触发分类更新事件
        if (socket) {
          socket.emit('homepage:categories:updated', featuredCategories);
        }
      } else {
        throw new Error(response.error || '保存失败');
      }
    } catch (error) {
      console.error('保存精选分类失败:', error);
      showMessage('error', '保存精选分类失败');
    } finally {
      setIsSaving(false);
    }
  };

  // 添加分类
  const addCategory = () => {
    if (newCategory.trim() && !featuredCategories.includes(newCategory.trim())) {
      const updatedCategories = [...featuredCategories, newCategory.trim()];
      setFeaturedCategories(updatedCategories);
      setNewCategory('');
    }
  };

  // 删除分类
  const deleteCategory = (index: number) => {
    const categoryToDelete = featuredCategories[index];
    if (inUseCategories[categoryToDelete] > 0) {
      if (!confirm(`カテゴリ "${categoryToDelete}" は ${inUseCategories[categoryToDelete]} 個の問題集で使用されています。削除しますか？`)) {
        return;
      }
    }
    
    const updatedCategories = featuredCategories.filter((_, i) => i !== index);
    setFeaturedCategories(updatedCategories);
  };

  // 编辑分类
  const startEditCategory = (index: number) => {
    setEditingCategory({ index, value: featuredCategories[index] });
  };

  const saveEditCategory = () => {
    if (editingCategory && editingCategory.value.trim()) {
      const updatedCategories = [...featuredCategories];
      updatedCategories[editingCategory.index] = editingCategory.value.trim();
      setFeaturedCategories(updatedCategories);
      setEditingCategory(null);
    }
  };

  // 更新题库精选状态
  const updateQuestionSetFeatured = async (setId: string, isFeatured: boolean, category?: string) => {
    try {
      const response = await questionSetService.setFeaturedQuestionSet(setId, isFeatured, category);
      if (response.success) {
        setQuestionSets(prev => prev.map(set => 
          set.id === setId 
            ? { ...set, isFeatured, featuredCategory: category || '' }
            : set
        ));
        showMessage('success', `题库${isFeatured ? '设为' : '取消'}精选成功！`);
        await loadQuestionSets(); // 重新加载数据
      } else {
        throw new Error(response.error || '更新失败');
      }
    } catch (error) {
      console.error('更新题库精选状态失败:', error);
      showMessage('error', '更新题库精选状态失败');
    }
  };

  // 显示消息
  const showMessage = (type: 'success' | 'error', text: string) => {
    setMessage({ type, text });
    setTimeout(() => setMessage(null), 3000);
  };

  // 过滤题库
  const filteredQuestionSets = questionSets.filter(set => {
    const matchesSearch = set.title.toLowerCase().includes(searchTerm.toLowerCase());
    const matchesCategory = categoryFilter === 'all' || 
      (categoryFilter === 'featured' && set.isFeatured) ||
      (categoryFilter === 'unfeatured' && !set.isFeatured) ||
      set.featuredCategory === categoryFilter;
    return matchesSearch && matchesCategory;
  });

  if (loading) {
    return (
      <div className="flex justify-center items-center min-h-screen">
        <div className="text-lg">加载中...</div>
      </div>
    );
  }

  return (
    <div className="container mx-auto px-4 py-6">
      <div className="bg-white rounded-lg shadow-md">
        {/* 标题栏 */}
        <div className="border-b border-gray-200 px-6 py-4">
          <h1 className="text-2xl font-bold text-gray-900">内容管理</h1>
          <p className="text-gray-600 mt-1">管理首页内容、精选分类和题库设置</p>
        </div>

        {/* 消息提示 */}
        {message && (
          <div className={`mx-6 mt-4 p-4 rounded-md ${
            message.type === 'success' ? 'bg-green-50 border border-green-200 text-green-800' : 
            'bg-red-50 border border-red-200 text-red-800'
          }`}>
            {message.text}
          </div>
        )}

        {/* 选项卡 */}
        <div className="border-b border-gray-200">
          <nav className="flex space-x-8 px-6">
            {[
              { key: 'home', label: '首页内容', icon: '🏠' },
              { key: 'categories', label: '精选分类', icon: '📁' },
              { key: 'questionSets', label: '题库管理', icon: '📚' }
            ].map(tab => (
              <button
                key={tab.key}
                onClick={() => setActiveTab(tab.key as any)}
                className={`py-4 px-1 inline-flex items-center border-b-2 font-medium text-sm ${
                  activeTab === tab.key
                    ? 'border-blue-500 text-blue-600'
                    : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
                }`}
              >
                <span className="mr-2">{tab.icon}</span>
                {tab.label}
              </button>
            ))}
          </nav>
        </div>

        {/* 内容区域 */}
        <div className="p-6">
          {/* 首页内容管理 */}
          {activeTab === 'home' && (
            <div className="space-y-6">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  网站标题
                </label>
                <input
                  type="text"
                  value={homeContent.title}
                  onChange={(e) => {
                    setHomeContent(prev => ({ ...prev, title: e.target.value }));
                    setHasUnsavedChanges(true);
                  }}
                  className="w-full p-3 border border-gray-300 rounded-md focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                  placeholder="请输入网站标题"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  网站副标题
                </label>
                <textarea
                  value={homeContent.subtitle}
                  onChange={(e) => {
                    setHomeContent(prev => ({ ...prev, subtitle: e.target.value }));
                    setHasUnsavedChanges(true);
                  }}
                  rows={3}
                  className="w-full p-3 border border-gray-300 rounded-md focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                  placeholder="请输入网站副标题"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  横幅图片URL（可选）
                </label>
                <input
                  type="url"
                  value={homeContent.bannerImageUrl || ''}
                  onChange={(e) => {
                    setHomeContent(prev => ({ ...prev, bannerImageUrl: e.target.value }));
                    setHasUnsavedChanges(true);
                  }}
                  className="w-full p-3 border border-gray-300 rounded-md focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                  placeholder="https://example.com/banner.jpg"
                />
              </div>

              <div className="flex justify-end">
                <button
                  onClick={saveHomeContent}
                  disabled={isSaving || !hasUnsavedChanges}
                  className={`px-6 py-2 rounded-md font-medium ${
                    isSaving || !hasUnsavedChanges
                      ? 'bg-gray-300 text-gray-500 cursor-not-allowed'
                      : 'bg-blue-600 text-white hover:bg-blue-700'
                  }`}
                >
                  {isSaving ? '保存中...' : '保存首页内容'}
                </button>
              </div>
            </div>
          )}

          {/* 精选分类管理 */}
          {activeTab === 'categories' && (
            <div className="space-y-6">
              {/* 添加分类 */}
              <div className="flex gap-3">
                <input
                  type="text"
                  value={newCategory}
                  onChange={(e) => setNewCategory(e.target.value)}
                  onKeyPress={(e) => e.key === 'Enter' && addCategory()}
                  className="flex-1 p-3 border border-gray-300 rounded-md focus:ring-2 focus:ring-blue-500"
                  placeholder="输入新分类名称"
                />
                <button
                  onClick={addCategory}
                  disabled={!newCategory.trim()}
                  className="px-6 py-3 bg-blue-600 text-white rounded-md hover:bg-blue-700 disabled:bg-gray-300"
                >
                  添加分类
                </button>
              </div>

              {/* 分类列表 */}
              <div className="bg-gray-50 rounded-lg p-4">
                <h3 className="text-lg font-medium mb-4">精选分类列表</h3>
                {featuredCategories.length === 0 ? (
                  <p className="text-gray-500 text-center py-8">暂无精选分类</p>
                ) : (
                  <div className="grid gap-3">
                    {featuredCategories.map((category, index) => (
                      <div key={index} className="flex items-center justify-between bg-white p-3 rounded-md border">
                        <div className="flex items-center">
                          {editingCategory?.index === index ? (
                            <input
                              type="text"
                              value={editingCategory.value}
                              onChange={(e) => setEditingCategory({ ...editingCategory, value: e.target.value })}
                              onKeyPress={(e) => e.key === 'Enter' && saveEditCategory()}
                              className="mr-3 p-2 border rounded"
                              autoFocus
                            />
                          ) : (
                            <span className="font-medium">{category}</span>
                          )}
                          {inUseCategories[category] > 0 && (
                            <span className="ml-3 px-2 py-1 bg-blue-100 text-blue-800 text-xs rounded-full">
                              {inUseCategories[category]} 个题库使用
                            </span>
                          )}
                        </div>
                        <div className="flex gap-2">
                          {editingCategory?.index === index ? (
                            <>
                              <button
                                onClick={saveEditCategory}
                                className="px-3 py-1 bg-green-600 text-white text-sm rounded hover:bg-green-700"
                              >
                                保存
                              </button>
                              <button
                                onClick={() => setEditingCategory(null)}
                                className="px-3 py-1 bg-gray-600 text-white text-sm rounded hover:bg-gray-700"
                              >
                                取消
                              </button>
                            </>
                          ) : (
                            <>
                              <button
                                onClick={() => startEditCategory(index)}
                                className="px-3 py-1 bg-yellow-600 text-white text-sm rounded hover:bg-yellow-700"
                              >
                                编辑
                              </button>
                              <button
                                onClick={() => deleteCategory(index)}
                                className="px-3 py-1 bg-red-600 text-white text-sm rounded hover:bg-red-700"
                              >
                                删除
                              </button>
                            </>
                          )}
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>

              <div className="flex justify-end">
                <button
                  onClick={saveFeaturedCategories}
                  disabled={isSaving}
                  className={`px-6 py-2 rounded-md font-medium ${
                    isSaving
                      ? 'bg-gray-300 text-gray-500 cursor-not-allowed'
                      : 'bg-blue-600 text-white hover:bg-blue-700'
                  }`}
                >
                  {isSaving ? '保存中...' : '保存分类设置'}
                </button>
              </div>
            </div>
          )}

          {/* 题库管理 */}
          {activeTab === 'questionSets' && (
            <div className="space-y-6">
              {/* 筛选和搜索 */}
              <div className="flex gap-4">
                <div className="flex-1">
                  <input
                    type="text"
                    value={searchTerm}
                    onChange={(e) => setSearchTerm(e.target.value)}
                    className="w-full p-3 border border-gray-300 rounded-md focus:ring-2 focus:ring-blue-500"
                    placeholder="搜索题库..."
                  />
                </div>
                <select
                  value={categoryFilter}
                  onChange={(e) => setCategoryFilter(e.target.value)}
                  className="p-3 border border-gray-300 rounded-md focus:ring-2 focus:ring-blue-500"
                >
                  <option value="all">全ての問題集</option>
                  <option value="featured">已精选</option>
                  <option value="unfeatured">未精选</option>
                  {featuredCategories.map(category => (
                    <option key={category} value={category}>{category}</option>
                  ))}
                </select>
              </div>

              {/* 题库列表 */}
              <div className="bg-gray-50 rounded-lg p-4">
                <h3 className="text-lg font-medium mb-4">题库列表 ({filteredQuestionSets.length})</h3>
                {filteredQuestionSets.length === 0 ? (
                  <p className="text-gray-500 text-center py-8">没有找到匹配的题库</p>
                ) : (
                  <div className="grid gap-4">
                    {filteredQuestionSets.map((set) => (
                      <div key={set.id} className="bg-white p-4 rounded-md border">
                        <div className="flex items-center justify-between">
                          <div className="flex-1">
                            <h4 className="font-medium text-lg">{set.title}</h4>
                            <p className="text-gray-600 text-sm mt-1">{set.description}</p>
                            <div className="flex items-center gap-4 mt-2 text-sm text-gray-500">
                              <span>分类: {set.category}</span>
                              <span>题目数量: {getCorrectQuestionCount(set)}</span>
                              <span>価格: {set.isPaid ? `¥${set.price}` : '免费'}</span>
                            </div>
                            {set.isFeatured && (
                              <div className="mt-2">
                                <span className="px-2 py-1 bg-yellow-100 text-yellow-800 text-xs rounded-full">
                                  精选 - {set.featuredCategory}
                                </span>
                              </div>
                            )}
                          </div>
                          <div className="flex flex-col gap-2">
                            {set.isFeatured ? (
                              <button
                                onClick={() => updateQuestionSetFeatured(set.id, false)}
                                className="px-4 py-2 bg-red-600 text-white text-sm rounded hover:bg-red-700"
                              >
                                おすすめ解除
                              </button>
                            ) : (
                              <select
                                onChange={(e) => {
                                  if (e.target.value) {
                                    updateQuestionSetFeatured(set.id, true, e.target.value);
                                  }
                                }}
                                className="px-4 py-2 border border-gray-300 rounded text-sm"
                                defaultValue=""
                              >
                                <option value="">设为精选</option>
                                {featuredCategories.map(category => (
                                  <option key={category} value={category}>{category}</option>
                                ))}
                              </select>
                            )}
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

export default AdminContentManagement;