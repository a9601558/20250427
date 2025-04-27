import React, { useState, useEffect } from 'react';
import { useUser } from '../../contexts/UserContext';
import { useNavigate } from 'react-router-dom';
import { fetchWithAuth } from '../../utils/api';

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
  welcomeTitle: "ExamTopics 模拟练习",
  welcomeDescription: "选择以下任一题库开始练习，测试您的知识水平",
  featuredCategories: ["网络协议", "编程语言", "计算机基础"],
  announcements: "欢迎使用在线题库系统，新增题库将定期更新，请持续关注！",
  footerText: "© 2023 ExamTopics 在线题库系统 保留所有权利",
  bannerImage: "/images/banner.jpg",
  theme: 'light'
};

const AdminHomeContent: React.FC = () => {
  const { isAdmin } = useUser();
  const navigate = useNavigate();
  const [homeContent, setHomeContent] = useState<HomeContent>(defaultHomeContent);
  const [loading, setLoading] = useState<boolean>(true);
  const [error, setError] = useState<string | null>(null);
  const [message, setMessage] = useState<{ type: 'success' | 'error', text: string } | null>(null);
  const [newCategory, setNewCategory] = useState<string>('');

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
        const response = await fetchWithAuth<HomeContent>('/homepage/content');
        if (response.success && response.data) {
          setHomeContent(response.data);
        } else {
          setError(response.error || '加载首页内容失败');
        }
      } catch (err) {
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
    setHomeContent(prev => ({
      ...prev,
      [name]: value
    }));
  };

  // 添加新分类
  const handleAddCategory = () => {
    if (newCategory.trim()) {
      setHomeContent(prev => ({
        ...prev,
        featuredCategories: [...prev.featuredCategories, newCategory.trim()]
      }));
      setNewCategory('');
    }
  };

  // 删除分类
  const handleRemoveCategory = (index: number) => {
    setHomeContent(prev => ({
      ...prev,
      featuredCategories: prev.featuredCategories.filter((_, i) => i !== index)
    }));
  };

  // 更新分类
  const handleUpdateCategory = (index: number, value: string) => {
    const updatedCategories = [...homeContent.featuredCategories];
    updatedCategories[index] = value;
    setHomeContent(prev => ({
      ...prev,
      featuredCategories: updatedCategories
    }));
  };

  // 保存首页内容
  const handleSave = async () => {
    try {
      const response = await fetchWithAuth('/homepage/content', {
        method: 'PUT',
        body: JSON.stringify(homeContent)
      });

      if (response.success) {
        setMessage({ type: 'success', text: '首页内容保存成功！' });
      } else {
        setMessage({ type: 'error', text: response.error || '保存失败' });
      }
    } catch (err) {
      setMessage({ type: 'error', text: '保存过程中发生错误' });
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
      <h2 className="text-2xl font-semibold mb-6 pb-2 border-b">首页内容管理</h2>
      
      {message && (
        <div className={`p-4 mb-4 rounded ${message.type === 'success' ? 'bg-green-100 text-green-800' : 'bg-red-100 text-red-800'}`}>
          {message.text}
        </div>
      )}

      <div className="space-y-4">
        {/* 欢迎标题 */}
        <div>
          <label className="block mb-1 font-medium">欢迎标题</label>
          <input
            type="text"
            name="welcomeTitle"
            value={homeContent.welcomeTitle}
            onChange={handleInputChange}
            className="w-full p-2 border rounded"
          />
        </div>

        {/* 欢迎描述 */}
        <div>
          <label className="block mb-1 font-medium">欢迎描述</label>
          <textarea
            name="welcomeDescription"
            value={homeContent.welcomeDescription}
            onChange={handleInputChange}
            className="w-full p-2 border rounded h-24"
          />
        </div>

        {/* 页脚文本 */}
        <div>
          <label className="block mb-1 font-medium">页脚文本</label>
          <input
            type="text"
            name="footerText"
            value={homeContent.footerText}
            onChange={handleInputChange}
            className="w-full p-2 border rounded"
          />
        </div>

        {/* 公告 */}
        <div>
          <label className="block mb-1 font-medium">公告</label>
          <textarea
            name="announcements"
            value={homeContent.announcements}
            onChange={handleInputChange}
            className="w-full p-2 border rounded h-24"
          />
        </div>

        {/* 横幅图片 */}
        <div>
          <label className="block mb-1 font-medium">横幅图片URL</label>
          <input
            type="text"
            name="bannerImage"
            value={homeContent.bannerImage || ''}
            onChange={handleInputChange}
            className="w-full p-2 border rounded"
            placeholder="/images/banner.jpg"
          />
          {homeContent.bannerImage && (
            <div className="mt-2">
              <div className="flex items-center">
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
          <label className="block mb-1 font-medium">主题</label>
          <select
            name="theme"
            value={homeContent.theme || 'light'}
            onChange={handleInputChange}
            className="w-full p-2 border rounded"
          >
            <option value="light">浅色</option>
            <option value="dark">深色</option>
            <option value="auto">自动（跟随系统）</option>
          </select>
        </div>

        {/* 精选分类管理 */}
        <div className="mt-6">
          <h3 className="font-medium text-lg mb-3">精选分类管理</h3>
          <p className="text-sm text-gray-500 mb-2">精选分类将显示在首页，作为题库的主要分组方式。</p>
          
          <div className="mb-4 flex">
            <input
              type="text"
              value={newCategory}
              onChange={(e) => setNewCategory(e.target.value)}
              className="flex-1 p-2 border rounded-l"
              placeholder="输入新分类名称"
            />
            <button
              onClick={handleAddCategory}
              className="bg-blue-600 text-white px-4 py-2 rounded-r hover:bg-blue-700"
            >
              添加分类
            </button>
          </div>

          <div className="space-y-2">
            {homeContent.featuredCategories.map((category, index) => (
              <div key={index} className="flex items-center">
                <input
                  type="text"
                  value={category}
                  onChange={(e) => handleUpdateCategory(index, e.target.value)}
                  className="flex-1 p-2 border rounded-l"
                />
                <button
                  onClick={() => handleRemoveCategory(index)}
                  className="bg-red-600 text-white px-3 py-2 rounded-r hover:bg-red-700"
                >
                  删除
                </button>
              </div>
            ))}
          </div>
        </div>

        {/* 保存按钮 */}
        <div className="mt-6">
          <button
            onClick={handleSave}
            className="bg-green-600 text-white px-6 py-2 rounded hover:bg-green-700"
          >
            保存首页内容
          </button>
        </div>
      </div>
    </div>
  );
};

export default AdminHomeContent; 