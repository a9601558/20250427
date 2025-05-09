import React, { useState, useEffect, useCallback } from 'react';
import { useUser } from '../../contexts/UserContext';
import { useNavigate } from 'react-router-dom';
import { homepageService } from '../../services/api';
import { toast } from 'react-toastify';
import { useSocket } from '../../contexts/SocketContext';
// 导入工具函数
import { 
  HomeContentData, 
  defaultHomeContent, 
  convertDbToFrontend, 
  saveHomeContentToLocalStorage,
  triggerHomeContentUpdateEvent
} from '../../utils/homeContentUtils';

// 题库访问类型定义开始...

const AdminHomeContent: React.FC = () => {
  const { isAdmin } = useUser();
  const { socket } = useSocket();
  const navigate = useNavigate();
  const [homeContent, setHomeContent] = useState<HomeContentData>(defaultHomeContent);
  const [loading, setLoading] = useState<boolean>(true);
  const [error, setError] = useState<string | null>(null);
  const [message, setMessage] = useState<{ type: 'success' | 'error', text: string } | null>(null);
  const [newCategory, setNewCategory] = useState<string>('');
  const [isSaving, setIsSaving] = useState<boolean>(false);
  const [editingCategoryIndex, setEditingCategoryIndex] = useState<number | null>(null);
  const [editingCategoryValue, setEditingCategoryValue] = useState<string>('');
  const [showPreviewButton, setShowPreviewButton] = useState(false);
  const [hasUnsavedChanges, setHasUnsavedChanges] = useState(false);

  // 管理员检查
  useEffect(() => {
    if (!isAdmin()) {
      navigate('/');
    }
  }, [isAdmin, navigate]);

  // 加载首页内容
  useEffect(() => {
    const loadHomeContent = async () => {
      setLoading(true);
      try {
        const response = await homepageService.getHomeContent();
        if (response.success && response.data) {
          console.log('[AdminHomeContent] 加载首页内容成功:', response.data);
          
          // 检查服务器返回数据格式，转换为前端格式
          let processedData;
          if ('welcome_title' in response.data) {
            // 数据库格式，转换为前端格式
            processedData = convertDbToFrontend(response.data);
            console.log('[AdminHomeContent] 已将数据库格式转换为前端格式');
          } else {
            // 已经是前端格式
            processedData = response.data;
          }
          
          setHomeContent(processedData);
        } else {
          console.error('[AdminHomeContent] 加载首页内容失败:', response.message);
          setError(response.message || '加载首页内容失败');
          
          // 尝试从localStorage加载作为备用
          try {
            const localContent = localStorage.getItem('home_content_data');
            if (localContent) {
              const parsedContent = JSON.parse(localContent);
              // 检查格式并转换
              if ('welcome_title' in parsedContent) {
                setHomeContent(convertDbToFrontend(parsedContent));
              } else {
                setHomeContent(parsedContent);
              }
              console.log('[AdminHomeContent] 从本地存储加载了首页内容');
              toast.warning('服务器连接失败，已加载缓存内容');
            }
          } catch (localErr) {
            console.error('[AdminHomeContent] 无法从本地存储加载:', localErr);
          }
        }
      } catch (err) {
        console.error('[AdminHomeContent] 加载首页内容时发生错误:', err);
        setError('加载首页内容时发生错误');
        
        // 尝试从localStorage加载作为备用
        try {
          const localContent = localStorage.getItem('home_content_data');
          if (localContent) {
            const parsedContent = JSON.parse(localContent);
            // 检查格式并转换
            if ('welcome_title' in parsedContent) {
              setHomeContent(convertDbToFrontend(parsedContent));
            } else {
              setHomeContent(parsedContent);
            }
            console.log('[AdminHomeContent] 从本地存储加载了首页内容');
            toast.warning('服务器连接失败，已加载缓存内容');
          }
        } catch (localErr) {
          console.error('[AdminHomeContent] 无法从本地存储加载:', localErr);
        }
      } finally {
        setLoading(false);
      }
    };

    loadHomeContent();
  }, []);

  // 处理输入变化
  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement>) => {
    const { name, value } = e.target;
    setHomeContent(prev => ({
      ...prev,
      [name]: value
    }));
    setHasUnsavedChanges(true);
    setShowPreviewButton(false);
  };

  // 开始编辑分类
  const handleEditCategory = (index: number) => {
    setEditingCategoryIndex(index);
    setEditingCategoryValue(homeContent.featuredCategories[index]);
  };

  // 取消编辑分类
  const handleCancelEditCategory = () => {
    setEditingCategoryIndex(null);
    setEditingCategoryValue('');
  };

  // 添加新分类
  const handleAddCategory = async () => {
    if (!newCategory.trim()) {
      setMessage({ type: 'error', text: '分类名称不能为空' });
      return;
    }
    
    if (homeContent.featuredCategories.includes(newCategory.trim())) {
      setMessage({ type: 'error', text: '分类已存在' });
      return;
    }

    const updatedCategories = [...homeContent.featuredCategories, newCategory.trim()];
    try {
      setIsSaving(true);
      const response = await homepageService.updateFeaturedCategories(updatedCategories);

      if (response.success) {
        // 更新本地状态
        const updatedHomeContent = {
          ...homeContent,
          featuredCategories: updatedCategories
        };
        
        setHomeContent(updatedHomeContent);
        setNewCategory('');
        setMessage({ type: 'success', text: '分类添加成功' });
        setHasUnsavedChanges(true);
        
        // 触发主页内容更新事件，确保首页获取最新分类
        window.dispatchEvent(new CustomEvent('homeContent:updated', {
          detail: {
            timestamp: Date.now(),
            source: 'admin',
            categories: updatedCategories
          }
        }));
        
        // 设置本地存储标记
        localStorage.setItem('home_content_updated', Date.now().toString());
        
        // 通过socket通知其他客户端
        try {
          if (socket) {
            socket.emit('admin:homeContent:updated', {
              timestamp: Date.now(),
              source: 'admin',
              categories: updatedCategories
            });
          }
        } catch (socketErr) {
          console.error('[AdminHomeContent] Socket notification failed:', socketErr);
        }
      } else {
        console.error('添加分类失败:', response.message);
        setMessage({ type: 'error', text: response.message || '添加分类失败' });
      }
    } catch (err) {
      console.error('添加分类时发生错误:', err);
      setMessage({ type: 'error', text: '添加分类时发生错误' });
    } finally {
      setIsSaving(false);
      
      // 3秒后清除消息
      setTimeout(() => setMessage(null), 3000);
    }
  };

  // 删除分类
  const handleRemoveCategory = async (index: number) => {
    const updatedCategories = homeContent.featuredCategories.filter((_, i) => i !== index);
    try {
      setIsSaving(true);
      const response = await homepageService.updateFeaturedCategories(updatedCategories);

      if (response.success) {
        // 更新本地状态
        const updatedHomeContent = {
          ...homeContent,
          featuredCategories: updatedCategories
        };
        
        setHomeContent(updatedHomeContent);
        setMessage({ type: 'success', text: '分类删除成功' });
        setHasUnsavedChanges(true);
        
        // 触发主页内容更新事件，确保首页获取最新分类
        window.dispatchEvent(new CustomEvent('homeContent:updated', {
          detail: {
            timestamp: Date.now(),
            source: 'admin',
            categories: updatedCategories
          }
        }));
        
        // 设置本地存储标记
        localStorage.setItem('home_content_updated', Date.now().toString());
        
        // 通过socket通知其他客户端
        try {
          if (socket) {
            socket.emit('admin:homeContent:updated', {
              timestamp: Date.now(),
              source: 'admin',
              categories: updatedCategories
            });
          }
        } catch (socketErr) {
          console.error('[AdminHomeContent] Socket notification failed:', socketErr);
        }
      } else {
        console.error('删除分类失败:', response.message);
        setMessage({ type: 'error', text: response.message || '删除分类失败' });
      }
    } catch (err) {
      console.error('删除分类时发生错误:', err);
      setMessage({ type: 'error', text: '删除分类时发生错误' });
    } finally {
      setIsSaving(false);
      
      // 3秒后清除消息
      setTimeout(() => setMessage(null), 3000);
    }
  };

  // 更新分类
  const handleUpdateCategory = async (index: number) => {
    if (!editingCategoryValue.trim()) {
      setMessage({ type: 'error', text: '分类名称不能为空' });
      return;
    }

    const updatedCategories = [...homeContent.featuredCategories];
    updatedCategories[index] = editingCategoryValue.trim();
    
    try {
      setIsSaving(true);
      const response = await homepageService.updateFeaturedCategories(updatedCategories);

      if (response.success) {
        // 更新本地状态
        const updatedHomeContent = {
          ...homeContent,
          featuredCategories: updatedCategories
        };
        
        setHomeContent(updatedHomeContent);
        setMessage({ type: 'success', text: '分类更新成功' });
        setEditingCategoryIndex(null);
        setEditingCategoryValue('');
        setHasUnsavedChanges(true);
        
        // 触发主页内容更新事件，确保首页获取最新分类
        window.dispatchEvent(new CustomEvent('homeContent:updated', {
          detail: {
            timestamp: Date.now(),
            source: 'admin',
            categories: updatedCategories
          }
        }));
        
        // 设置本地存储标记
        localStorage.setItem('home_content_updated', Date.now().toString());
        
        // 通过socket通知其他客户端
        try {
          if (socket) {
            socket.emit('admin:homeContent:updated', {
              timestamp: Date.now(),
              source: 'admin',
              categories: updatedCategories
            });
          }
        } catch (socketErr) {
          console.error('[AdminHomeContent] Socket notification failed:', socketErr);
        }
      } else {
        console.error('更新分类失败:', response.message);
        setMessage({ type: 'error', text: response.message || '更新分类失败' });
      }
    } catch (err) {
      console.error('更新分类时发生错误:', err);
      setMessage({ type: 'error', text: '更新分类时发生错误' });
    } finally {
      setIsSaving(false);
      
      // 3秒后清除消息
      setTimeout(() => setMessage(null), 3000);
    }
  };

  // 移动分类位置
  const handleMoveCategory = async (index: number, direction: 'up' | 'down') => {
    const newIndex = direction === 'up' ? index - 1 : index + 1;
    
    // 检查新索引是否在范围内
    if (newIndex < 0 || newIndex >= homeContent.featuredCategories.length) {
      return;
    }
    
    // 创建新数组并交换位置
    const updatedCategories = [...homeContent.featuredCategories];
    [updatedCategories[index], updatedCategories[newIndex]] = 
    [updatedCategories[newIndex], updatedCategories[index]];
    
    try {
      setIsSaving(true);
      const response = await homepageService.updateFeaturedCategories(updatedCategories);

      if (response.success) {
        // 更新本地状态
        const updatedHomeContent = {
          ...homeContent,
          featuredCategories: updatedCategories
        };
        
        setHomeContent(updatedHomeContent);
        setMessage({ type: 'success', text: '分类顺序更新成功' });
        setHasUnsavedChanges(true);
        
        // 触发主页内容更新事件，确保首页获取最新分类
        window.dispatchEvent(new CustomEvent('homeContent:updated', {
          detail: {
            timestamp: Date.now(),
            source: 'admin',
            categories: updatedCategories
          }
        }));
        
        // 设置本地存储标记
        localStorage.setItem('home_content_updated', Date.now().toString());
        
        // 通过socket通知其他客户端
        try {
          if (socket) {
            socket.emit('admin:homeContent:updated', {
              timestamp: Date.now(),
              source: 'admin',
              categories: updatedCategories
            });
          }
        } catch (socketErr) {
          console.error('[AdminHomeContent] Socket notification failed:', socketErr);
        }
      } else {
        console.error('更新分类顺序失败:', response.message);
        setMessage({ type: 'error', text: response.message || '更新分类顺序失败' });
      }
    } catch (err) {
      console.error('更新分类顺序时发生错误:', err);
      setMessage({ type: 'error', text: '更新分类顺序时发生错误' });
    } finally {
      setIsSaving(false);
      
      // 3秒后清除消息
      setTimeout(() => setMessage(null), 3000);
    }
  };

  // 保存首页内容
  const handleSaveContent = async () => {
    try {
      setIsSaving(true);
      console.log('[AdminHomeContent] Saving home content with categories:', homeContent.featuredCategories);
      
      // Always store content in client-side storage as fallback
      const contentToSave = {
        ...homeContent,
        _lastUpdated: Date.now(),
        _savedByAdmin: true
      };
      
      // 使用工具函数保存到localStorage
      saveHomeContentToLocalStorage(contentToSave, true);
      console.log('[AdminHomeContent] Saved content to localStorage as fallback');
      
      // Set stronger flags to force update on homepage
      sessionStorage.setItem('adminTriggeredUpdate', 'true');
      sessionStorage.setItem('forceFullContentRefresh', 'true');
      sessionStorage.setItem('adminSavedContentTimestamp', Date.now().toString());
      
      // Use a very distinct timestamp to ensure it's recognized as new
      const eventTimestamp = Date.now();
      localStorage.setItem('home_content_force_reload', eventTimestamp.toString());
      
      // Try server update
      let serverUpdateSuccess = false;
      try {
        const response = await homepageService.updateHomeContent(contentToSave);
        serverUpdateSuccess = response.success;
        
        if (response.success) {
          console.log('[AdminHomeContent] Server update successful');
        } else {
          console.error('[AdminHomeContent] Server update failed:', response.message);
        }
      } catch (serverError) {
        console.error('[AdminHomeContent] Server update error:', serverError);
      }
      
      // Show appropriate message based on server response
      if (serverUpdateSuccess) {
        toast.success('首页内容已更新并保存到服务器');
      } else {
        toast.warning('服务器连接错误，内容已保存到本地（刷新后仍有效）');
      }
      
      // 使用工具函数触发更新事件，传递完整内容
      triggerHomeContentUpdateEvent(contentToSave, 'admin_direct');
      
      // 通过socket通知所有打开的客户端
      try {
        if (socket) {
          socket.emit('admin:homeContent:updated', {
            timestamp: eventTimestamp,
            source: 'admin_direct',
            changeType: 'full_content_reload',
            categories: homeContent.featuredCategories,
            welcomeTitle: homeContent.welcomeTitle,
            footerUpdated: true,
            forceRefresh: true,
            data: contentToSave // Include full data in socket event
          });
        }
      } catch (socketErr) {
        console.error('[AdminHomeContent] Socket notification failed:', socketErr);
      }
      
      console.log('[AdminHomeContent] Successfully updated home content, dispatched update event');
      
      // Set a flag to indicate successful save for preview button
      setHasUnsavedChanges(false);
      setShowPreviewButton(true);
      
      // Clear the admin trigger flag after a delay
      setTimeout(() => {
        sessionStorage.removeItem('adminTriggeredUpdate');
        sessionStorage.removeItem('forceFullContentRefresh');
      }, 10000);
    } catch (error) {
      console.error('更新首页内容失败:', error);
      toast.error('更新失败，请重试');
    } finally {
      setIsSaving(false);
    }
  };

  // 重置为默认内容
  const handleReset = () => {
    if (window.confirm('确定要重置为默认内容吗？此操作不可撤销。')) {
      setHomeContent(defaultHomeContent);
    }
  };

  // Handle preview functionality
  const handlePreview = () => {
    // Open the homepage in a new tab
    window.open('/', '_blank');
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
      <div className="flex justify-between items-center">
      <h2 className="text-2xl font-semibold mb-6 pb-2 border-b">首页内容管理</h2>
        <div className="flex space-x-3">
          <button
            onClick={handleReset}
            className="px-4 py-2 bg-gray-200 text-gray-700 rounded hover:bg-gray-300 transition"
            disabled={isSaving}
          >
            重置为默认
          </button>
          <div className="space-x-4 mt-6 flex items-center">
            <button
              onClick={handleSaveContent}
              className="px-4 py-2 bg-blue-600 text-white rounded hover:bg-blue-700 transition flex items-center"
              disabled={isSaving}
            >
              {isSaving ? (
                <>
                  <svg className="animate-spin -ml-1 mr-2 h-4 w-4 text-white" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                    <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                    <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                  </svg>
                  保存中...
                </>
              ) : (
                <>
                  <svg className="w-4 h-4 mr-1" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                  </svg>
                  保存首页内容
                </>
              )}
            </button>
            
            {showPreviewButton && (
              <button
                onClick={handlePreview}
                className="px-4 py-2 bg-green-600 text-white rounded hover:bg-green-700 transition flex items-center"
              >
                <svg className="w-4 h-4 mr-1" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z" />
                </svg>
                预览变更
              </button>
            )}
            
            {hasUnsavedChanges && (
              <span className="text-yellow-600 text-sm">
                <svg className="w-4 h-4 inline mr-1" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
                </svg>
                有未保存的更改
              </span>
            )}
          </div>
        </div>
      </div>
      
      {message && (
        <div className={`p-4 mb-6 rounded-lg ${message.type === 'success' ? 'bg-green-100 text-green-800' : 'bg-red-100 text-red-800'}`}>
          {message.text}
        </div>
      )}

      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
      <div className="space-y-6">
        {/* 欢迎标题 */}
          <div className="bg-white p-6 rounded-lg shadow">
            <h3 className="text-lg font-medium mb-4 pb-2 border-b">基本设置</h3>
            <div className="mb-4">
          <label className="block mb-2 font-medium text-gray-700">欢迎标题</label>
          <input
            type="text"
            name="welcomeTitle"
            value={homeContent.welcomeTitle}
            onChange={handleInputChange}
            className="w-full p-2 border border-gray-300 rounded-md focus:ring-blue-500 focus:border-blue-500"
          />
          <p className="mt-1 text-sm text-gray-500">显示在首页顶部的主标题</p>
        </div>

        {/* 欢迎描述 */}
            <div className="mb-4">
          <label className="block mb-2 font-medium text-gray-700">欢迎描述</label>
          <textarea
            name="welcomeDescription"
            value={homeContent.welcomeDescription}
            onChange={handleInputChange}
            className="w-full p-2 border border-gray-300 rounded-md h-24 focus:ring-blue-500 focus:border-blue-500"
              ></textarea>
              <p className="mt-1 text-sm text-gray-500">显示在主标题下方的简短描述</p>
            </div>

            {/* 公告 */}
            <div className="mb-4">
              <label className="block mb-2 font-medium text-gray-700">网站公告</label>
              <textarea
                name="announcements"
                value={homeContent.announcements}
                onChange={handleInputChange}
                className="w-full p-2 border border-gray-300 rounded-md h-24 focus:ring-blue-500 focus:border-blue-500"
              ></textarea>
              <p className="mt-1 text-sm text-gray-500">显示在首页顶部的重要公告</p>
        </div>

        {/* 页脚文本 */}
            <div className="mb-4">
          <label className="block mb-2 font-medium text-gray-700">页脚文本</label>
          <input
            type="text"
            name="footerText"
            value={homeContent.footerText}
            onChange={handleInputChange}
            className="w-full p-2 border border-gray-300 rounded-md focus:ring-blue-500 focus:border-blue-500"
          />
              <p className="mt-1 text-sm text-gray-500">显示在页面底部的页脚文本</p>
        </div>

            {/* 主题设置 */}
            <div className="mb-4">
              <label className="block mb-2 font-medium text-gray-700">主题设置</label>
              <select 
                name="theme"
                value={homeContent.theme}
            onChange={handleInputChange}
                className="w-full p-2 border border-gray-300 rounded-md focus:ring-blue-500 focus:border-blue-500"
              >
                <option value="light">亮色主题</option>
                <option value="dark">暗色主题</option>
                <option value="auto">跟随系统设置</option>
              </select>
              <p className="mt-1 text-sm text-gray-500">设置网站的默认显示主题</p>
        </div>

            {/* Banner图片 */}
            <div className="mb-4">
              <label className="block mb-2 font-medium text-gray-700">Banner图片URL</label>
          <input
            type="text"
            name="bannerImage"
            value={homeContent.bannerImage || ''}
            onChange={handleInputChange}
            className="w-full p-2 border border-gray-300 rounded-md focus:ring-blue-500 focus:border-blue-500"
          />
              <p className="mt-1 text-sm text-gray-500">显示在首页顶部的大图片URL</p>
          {homeContent.bannerImage && (
                <div className="mt-2 relative">
                <img 
                  src={homeContent.bannerImage} 
                    alt="Banner预览" 
                    className="w-full h-auto rounded-md border border-gray-200"
                  onError={(e) => {
                      (e.target as HTMLImageElement).src = 'https://via.placeholder.com/800x200?text=图片加载失败';
                    }}
                  />
                  <div className="absolute inset-0 flex items-center justify-center bg-black bg-opacity-50 opacity-0 hover:opacity-100 transition-opacity rounded-md">
                    <span className="text-white text-sm">当前Banner预览</span>
                  </div>
                </div>
              )}
            </div>
        </div>
        </div>

        <div className="space-y-6">
          {/* 精选分类管理 */}
          <div className="bg-white p-6 rounded-lg shadow">
            <h3 className="text-lg font-medium mb-4 pb-2 border-b">精选分类管理</h3>
            <p className="text-sm text-gray-600 mb-4">
              精选分类将显示在首页顶部，用户可以快速筛选这些分类下的题库。
              只有题库的分类与这些精选分类匹配或题库被设置为精选时，才会显示在首页上。
            </p>

            {/* 添加新分类 */}
            <div className="flex mb-6">
            <input
              type="text"
                placeholder="输入新分类名称"
              value={newCategory}
              onChange={(e) => setNewCategory(e.target.value)}
                className="flex-grow p-2 border border-gray-300 rounded-l-md focus:ring-blue-500 focus:border-blue-500"
            />
            <button
              onClick={handleAddCategory}
              disabled={isSaving || !newCategory.trim()}
                className="px-4 py-2 bg-blue-600 text-white rounded-r-md hover:bg-blue-700 disabled:bg-blue-300"
            >
                {isSaving ? '添加中...' : '添加'}
            </button>
          </div>

            {/* 分类列表 */}
            <div className="space-y-3 max-h-96 overflow-y-auto pr-2">
              {homeContent.featuredCategories.length === 0 ? (
                <div className="text-center p-4 bg-gray-50 text-gray-500 rounded-md">
                  暂无精选分类，请添加
                </div>
              ) : (
              homeContent.featuredCategories.map((category, index) => (
                  <div key={index} className="flex items-center justify-between p-3 bg-gray-50 rounded-md group">
                    {editingCategoryIndex === index ? (
                      <div className="flex-grow flex">
                  <input
                    type="text"
                          value={editingCategoryValue}
                          onChange={(e) => setEditingCategoryValue(e.target.value)}
                          className="flex-grow p-1.5 border border-gray-300 rounded-md focus:ring-blue-500 focus:border-blue-500"
                          autoFocus
                        />
                        <div className="flex">
                          <button
                            onClick={() => handleUpdateCategory(index)}
                            className="ml-2 p-1.5 bg-green-600 text-white rounded-md hover:bg-green-700"
                          >
                            <svg className="h-4 w-4" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                            </svg>
                          </button>
                          <button
                            onClick={handleCancelEditCategory}
                            className="ml-2 p-1.5 bg-gray-500 text-white rounded-md hover:bg-gray-600"
                          >
                            <svg className="h-4 w-4" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                            </svg>
                          </button>
                        </div>
                      </div>
                    ) : (
                      <>
                        <span className="font-medium flex items-center">
                          <span className="inline-block w-6 h-6 flex items-center justify-center bg-blue-100 text-blue-800 rounded-full text-xs mr-2">
                            {index + 1}
                          </span>
                          {category}
                        </span>
                        <div className="opacity-0 group-hover:opacity-100 transition-opacity">
                          <button
                            onClick={() => handleEditCategory(index)}
                            className="p-1 text-blue-600 hover:text-blue-800"
                            title="编辑"
                          >
                            <svg className="h-4 w-4" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" />
                            </svg>
                          </button>
                  <button
                    onClick={() => handleRemoveCategory(index)}
                            className="p-1 text-red-600 hover:text-red-800"
                            title="删除"
                          >
                            <svg className="h-4 w-4" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                            </svg>
                          </button>
                          <button
                            onClick={() => handleMoveCategory(index, 'up')}
                            disabled={index === 0}
                            className={`p-1 ${index === 0 ? 'text-gray-400 cursor-not-allowed' : 'text-gray-600 hover:text-gray-800'}`}
                            title="上移"
                          >
                            <svg className="h-4 w-4" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 15l7-7 7 7" />
                            </svg>
                          </button>
                          <button
                            onClick={() => handleMoveCategory(index, 'down')}
                            disabled={index === homeContent.featuredCategories.length - 1}
                            className={`p-1 ${index === homeContent.featuredCategories.length - 1 ? 'text-gray-400 cursor-not-allowed' : 'text-gray-600 hover:text-gray-800'}`}
                            title="下移"
                          >
                            <svg className="h-4 w-4" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
                            </svg>
                  </button>
                        </div>
                      </>
                    )}
                </div>
              ))
            )}
          </div>
        </div>

          {/* 预览区域 */}
          <div className="bg-white p-6 rounded-lg shadow">
            <h3 className="text-lg font-medium mb-4 pb-2 border-b">首页预览</h3>
            <div className="bg-gray-100 p-4 rounded-md">
              <div className="font-bold text-xl mb-2">{homeContent.welcomeTitle}</div>
              <p className="text-gray-700 mb-4">{homeContent.welcomeDescription}</p>
              
              <div className="mb-4">
                <div className="font-semibold mb-2">精选分类:</div>
                <div className="flex flex-wrap gap-2">
                  {homeContent.featuredCategories.map((category, index) => (
                    <span key={index} className="px-3 py-1 bg-blue-100 text-blue-800 rounded-full text-sm">
                      {category}
                    </span>
                  ))}
                </div>
              </div>
              
              <div className="bg-blue-50 border-l-4 border-blue-500 p-3 text-blue-700 mb-4">
                <div className="font-semibold">公告:</div>
                <p>{homeContent.announcements}</p>
              </div>
              
              <div className="text-gray-600 text-sm border-t pt-2 mt-4">
                {homeContent.footerText}
              </div>
            </div>
            
            <div className="mt-4 text-center">
              <a 
                href="/" 
                target="_blank" 
                rel="noopener noreferrer"
                className="text-blue-600 hover:text-blue-800 flex items-center justify-center"
              >
                <svg className="h-4 w-4 mr-1" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 6H6a2 2 0 00-2 2v10a2 2 0 002 2h10a2 2 0 002-2v-4M14 4h6m0 0v6m0-6L10 14" />
                </svg>
                在新窗口查看实际效果
              </a>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default AdminHomeContent; 