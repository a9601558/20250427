import React, { useState, useEffect } from 'react';
import { useUser } from '../../contexts/UserContext';
import { useNavigate } from 'react-router-dom';
import { homepageService } from '../../services/api';

// 首页内容接口
interface HomeContent {
  welcomeTitle: string;
  welcomeDescription: string;
  featuredCategories: string[];
  announcements: string;
  footerText: string;
  bannerImage?: string;
  theme?: 'light' | 'dark' | 'auto';
}

// 默认首页内容
const defaultHomeContent: HomeContent = {
  welcomeTitle: 'ExamTopics 模拟练习',
  welcomeDescription: '选择以下任一题库开始练习，测试您的知识水平',
  featuredCategories: ['网络协议', '编程语言', '计算机基础'],
  announcements: '欢迎使用在线题库系统，新增题库将定期更新，请持续关注！',
  footerText: '© 2023 ExamTopics 在线题库系统 保留所有权利',
  bannerImage: '/images/banner.jpg',
  theme: 'light',
};

const AdminHomeContent: React.FC = () => {
  const { isAdmin } = useUser();
  const navigate = useNavigate();
  const [homeContent, setHomeContent] = useState<HomeContent>(defaultHomeContent);
  const [loading, setLoading] = useState<boolean>(true);
  const [error, setError] = useState<string | null>(null);
  const [message, setMessage] = useState<{ type: 'success' | 'error', text: string } | null>(null);
  const [newCategory, setNewCategory] = useState<string>('');
  const [isSaving, setIsSaving] = useState<boolean>(false);

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
          console.log('加载首页内容成功:', response.data);
          setHomeContent(response.data);
        } else {
          console.error('加载首页内容失败:', response.message);
          setError(response.message || '加载首页内容失败');
        }
      } catch (err) {
        console.error('加载首页内容时发生错误:', err);
        setError('加载首页内容时发生错误');
      } finally {
        setLoading(false);
      }
    };

    loadHomeContent();
  }, []);

  // 处理输入变化
  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement>) => {
    const { name, value } = e.target;
    setHomeContent((prev) => ({
      ...prev,
      [name]: value,
    }));
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
        setHomeContent((prev) => ({
          ...prev,
          featuredCategories: updatedCategories,
        }));
        setNewCategory('');
        setMessage({ type: 'success', text: '分类添加成功' });
      } else {
        console.error('添加分类失败:', response.message);
        setMessage({ type: 'error', text: response.message || '添加分类失败' });
      }
    } catch (err) {
      console.error('添加分类时发生错误:', err);
      setMessage({ type: 'error', text: '添加分类时发生错误' });
    } finally {
      setIsSaving(false);
    }
  };

  // 删除分类
  const handleRemoveCategory = async (index: number) => {
    const updatedCategories = homeContent.featuredCategories.filter((_, i) => i !== index);
    try {
      setIsSaving(true);
      const response = await homepageService.updateFeaturedCategories(updatedCategories);

      if (response.success) {
        setHomeContent((prev) => ({
          ...prev,
          featuredCategories: updatedCategories,
        }));
        setMessage({ type: 'success', text: '分类删除成功' });
      } else {
        console.error('删除分类失败:', response.message);
        setMessage({ type: 'error', text: response.message || '删除分类失败' });
      }
    } catch (err) {
      console.error('删除分类时发生错误:', err);
      setMessage({ type: 'error', text: '删除分类时发生错误' });
    } finally {
      setIsSaving(false);
    }
  };

  // 更新分类
  const handleUpdateCategory = async (index: number, value: string) => {
    if (!value.trim()) {
      setMessage({ type: 'error', text: '分类名称不能为空' });
      return;
    }

    const updatedCategories = [...homeContent.featuredCategories];
    updatedCategories[index] = value.trim();
    
    try {
      setIsSaving(true);
      const response = await homepageService.updateFeaturedCategories(updatedCategories);

      if (response.success) {
        setHomeContent((prev) => ({
          ...prev,
          featuredCategories: updatedCategories,
        }));
        setMessage({ type: 'success', text: '分类更新成功' });
      } else {
        console.error('更新分类失败:', response.message);
        setMessage({ type: 'error', text: response.message || '更新分类失败' });
      }
    } catch (err) {
      console.error('更新分类时发生错误:', err);
      setMessage({ type: 'error', text: '更新分类时发生错误' });
    } finally {
      setIsSaving(false);
    }
  };

  // 保存首页内容
  const handleSave = async () => {
    try {
      setIsSaving(true);
      const response = await homepageService.updateHomeContent(homeContent);

      if (response.success) {
        setMessage({ type: 'success', text: '首页内容保存成功！' });
        console.log('首页内容保存成功');
      } else {
        console.error('保存首页内容失败:', response.message);
        setMessage({ type: 'error', text: response.message || '保存失败' });
      }
    } catch (err) {
      console.error('保存过程中发生错误:', err);
      setMessage({ type: 'error', text: '保存过程中发生错误' });
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
      <h2 className="text-2xl font-semibold mb-6 pb-2 border-b">首页内容管理</h2>
      
      {message && (
        <div className={`p-4 mb-6 rounded-lg ${message.type === 'success' ? 'bg-green-100 text-green-800' : 'bg-red-100 text-red-800'}`}>
          {message.text}
        </div>
      )}

      <div className="space-y-6">
        {/* 欢迎标题 */}
        <div>
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
        <div>
          <label className="block mb-2 font-medium text-gray-700">欢迎描述</label>
          <textarea
            name="welcomeDescription"
            value={homeContent.welcomeDescription}
            onChange={handleInputChange}
            className="w-full p-2 border border-gray-300 rounded-md h-24 focus:ring-blue-500 focus:border-blue-500"
          />
          <p className="mt-1 text-sm text-gray-500">显示在标题下方的简短介绍</p>
        </div>

        {/* 页脚文本 */}
        <div>
          <label className="block mb-2 font-medium text-gray-700">页脚文本</label>
          <input
            type="text"
            name="footerText"
            value={homeContent.footerText}
            onChange={handleInputChange}
            className="w-full p-2 border border-gray-300 rounded-md focus:ring-blue-500 focus:border-blue-500"
          />
          <p className="mt-1 text-sm text-gray-500">页面底部显示的版权信息</p>
        </div>

        {/* 公告 */}
        <div>
          <label className="block mb-2 font-medium text-gray-700">公告</label>
          <textarea
            name="announcements"
            value={homeContent.announcements}
            onChange={handleInputChange}
            className="w-full p-2 border border-gray-300 rounded-md h-24 focus:ring-blue-500 focus:border-blue-500"
          />
          <p className="mt-1 text-sm text-gray-500">首页显示的公告信息</p>
        </div>

        {/* 横幅图片 */}
        <div>
          <label className="block mb-2 font-medium text-gray-700">横幅图片URL</label>
          <input
            type="text"
            name="bannerImage"
            value={homeContent.bannerImage || ''}
            onChange={handleInputChange}
            className="w-full p-2 border border-gray-300 rounded-md focus:ring-blue-500 focus:border-blue-500"
            placeholder="/images/banner.jpg"
          />
          <p className="mt-1 text-sm text-gray-500">首页顶部的背景图片，推荐尺寸1500x500</p>
          
          {homeContent.bannerImage && (
            <div className="mt-4 border border-gray-200 p-2 rounded-lg">
              <h4 className="font-medium mb-2">图片预览</h4>
              <div className="relative">
                <img 
                  src={homeContent.bannerImage} 
                  alt="Banner preview" 
                  className="w-full h-32 object-cover border rounded" 
                  onError={(e) => {
                    e.currentTarget.style.display = 'none';
                    document.getElementById('banner-error')?.removeAttribute('hidden');
                  }}
                />
                <div 
                  id="banner-error" 
                  className="w-full p-4 mt-2 bg-yellow-100 text-yellow-800 rounded" 
                  hidden
                >
                  <p className="font-medium">警告：无法加载横幅图片</p>
                  <p className="text-sm">请确保图片文件已上传到服务器的正确位置。图片应存放在服务器的 <code>public/images/</code> 目录中。</p>
                  <p className="text-sm mt-2">处理方法：</p>
                  <ol className="list-decimal list-inside text-sm">
                    <li>确认图片文件存在</li>
                    <li>检查URL路径是否正确</li>
                    <li>上传新图片到服务器</li>
                  </ol>
                </div>
              </div>
            </div>
          )}
        </div>

        {/* 主题选择 */}
        <div>
          <label className="block mb-2 font-medium text-gray-700">主题</label>
          <select
            name="theme"
            value={homeContent.theme || 'light'}
            onChange={handleInputChange}
            className="w-full p-2 border border-gray-300 rounded-md focus:ring-blue-500 focus:border-blue-500"
          >
            <option value="light">浅色</option>
            <option value="dark">深色</option>
            <option value="auto">自动（跟随系统）</option>
          </select>
          <p className="mt-1 text-sm text-gray-500">选择网站的颜色主题</p>
        </div>

        <div className="border-t border-gray-200 pt-6 mt-8">
          <h3 className="font-medium text-lg mb-4">精选分类管理</h3>
          <p className="text-sm text-gray-600 mb-4">精选分类将显示在首页，作为题库的主要分组方式。</p>
          
          <div className="mb-6 flex">
            <input
              type="text"
              value={newCategory}
              onChange={(e) => setNewCategory(e.target.value)}
              className="flex-1 p-2 border border-gray-300 rounded-l-md focus:ring-blue-500 focus:border-blue-500"
              placeholder="输入新分类名称"
            />
            <button
              onClick={handleAddCategory}
              className="bg-blue-600 text-white px-4 py-2 rounded-r-md hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed"
              disabled={isSaving || !newCategory.trim()}
            >
              {isSaving ? '添加中...' : '添加分类'}
            </button>
          </div>

          <div className="space-y-3 max-h-60 overflow-y-auto p-2 border rounded-md">
            {homeContent.featuredCategories.length > 0 ? (
              homeContent.featuredCategories.map((category, index) => (
                <div key={index} className="flex items-center space-x-2">
                  <input
                    type="text"
                    value={category}
                    onChange={(e) => handleUpdateCategory(index, e.target.value)}
                    className="flex-1 p-2 border border-gray-300 rounded-l-md focus:ring-blue-500 focus:border-blue-500"
                  />
                  <button
                    onClick={() => handleRemoveCategory(index)}
                    className="bg-red-600 text-white px-3 py-2 rounded-r-md hover:bg-red-700 disabled:opacity-50"
                    disabled={isSaving}
                  >
                    {isSaving ? '删除中...' : '删除'}
                  </button>
                </div>
              ))
            ) : (
              <div className="text-center py-4 text-gray-500">暂无精选分类</div>
            )}
          </div>
        </div>

        {/* 保存按钮 */}
        <div className="pt-6 border-t border-gray-200">
          <button
            onClick={handleSave}
            className="bg-green-600 text-white px-6 py-3 rounded-md hover:bg-green-700 focus:outline-none focus:ring-2 focus:ring-green-500 focus:ring-offset-2 disabled:opacity-50 disabled:cursor-not-allowed"
            disabled={isSaving}
          >
            {isSaving ? (
              <span className="flex items-center">
                <svg className="animate-spin -ml-1 mr-2 h-4 w-4 text-white" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                  <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                  <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                </svg>
                保存中...
              </span>
            ) : '保存首页内容'}
          </button>
        </div>
      </div>
    </div>
  );
};

export default AdminHomeContent; 
