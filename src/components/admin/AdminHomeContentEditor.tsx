import React, { useState, useEffect } from 'react';

// 定义首页内容接口
interface HomeContent {
  title: string;
  description: string;
  welcomeMessage: string;
  footerText: string;
}

// 假设这个函数从API或localStorage获取首页内容
const getHomeContent = (): HomeContent => {
  const defaultContent: HomeContent = {
    title: "在线题库系统",
    description: "提供多种类别的题库，帮助用户进行学习和测试",
    welcomeMessage: "欢迎使用在线题库系统",
    footerText: "© 2023 在线题库系统 保留所有权利"
  };
  
  const savedContent = localStorage.getItem('homeContent');
  return savedContent ? JSON.parse(savedContent) : defaultContent;
};

// 假设这个函数保存首页内容到API或localStorage
const saveHomeContent = (content: HomeContent): boolean => {
  try {
    localStorage.setItem('homeContent', JSON.stringify(content));
    return true;
  } catch (error) {
    console.error('保存首页内容失败:', error);
    return false;
  }
};

const AdminHomeContentEditor: React.FC = () => {
  const [content, setContent] = useState<HomeContent>(getHomeContent());
  const [isSaving, setIsSaving] = useState(false);
  const [saveSuccess, setSaveSuccess] = useState<boolean | null>(null);
  
  useEffect(() => {
    // 加载首页内容
    setContent(getHomeContent());
  }, []);
  
  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) => {
    const { name, value } = e.target;
    setContent(prev => ({
      ...prev,
      [name]: value
    }));
  };
  
  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsSaving(true);
    setSaveSuccess(null);
    
    try {
      const success = saveHomeContent(content);
      setSaveSuccess(success);
    } catch (error) {
      console.error('保存时出错:', error);
      setSaveSuccess(false);
    } finally {
      setIsSaving(false);
      
      // 3秒后清除提示信息
      setTimeout(() => {
        setSaveSuccess(null);
      }, 3000);
    }
  };
  
  return (
    <div className="px-4 py-5 sm:p-6 bg-white shadow sm:rounded-lg">
      <h2 className="text-lg leading-6 font-medium text-gray-900 mb-4">首页内容编辑</h2>
      
      <form onSubmit={handleSubmit}>
        <div className="space-y-6">
          <div>
            <label htmlFor="title" className="block text-sm font-medium text-gray-700">
              网站标题
            </label>
            <input
              type="text"
              name="title"
              id="title"
              className="mt-1 block w-full border border-gray-300 rounded-md shadow-sm py-2 px-3 focus:outline-none focus:ring-indigo-500 focus:border-indigo-500 sm:text-sm"
              value={content.title}
              onChange={handleInputChange}
              required
            />
          </div>
          
          <div>
            <label htmlFor="description" className="block text-sm font-medium text-gray-700">
              网站描述
            </label>
            <textarea
              name="description"
              id="description"
              rows={3}
              className="mt-1 block w-full border border-gray-300 rounded-md shadow-sm py-2 px-3 focus:outline-none focus:ring-indigo-500 focus:border-indigo-500 sm:text-sm"
              value={content.description}
              onChange={handleInputChange}
              required
            />
          </div>
          
          <div>
            <label htmlFor="welcomeMessage" className="block text-sm font-medium text-gray-700">
              欢迎消息
            </label>
            <input
              type="text"
              name="welcomeMessage"
              id="welcomeMessage"
              className="mt-1 block w-full border border-gray-300 rounded-md shadow-sm py-2 px-3 focus:outline-none focus:ring-indigo-500 focus:border-indigo-500 sm:text-sm"
              value={content.welcomeMessage}
              onChange={handleInputChange}
              required
            />
          </div>
          
          <div>
            <label htmlFor="footerText" className="block text-sm font-medium text-gray-700">
              页脚文本
            </label>
            <input
              type="text"
              name="footerText"
              id="footerText"
              className="mt-1 block w-full border border-gray-300 rounded-md shadow-sm py-2 px-3 focus:outline-none focus:ring-indigo-500 focus:border-indigo-500 sm:text-sm"
              value={content.footerText}
              onChange={handleInputChange}
              required
            />
          </div>
          
          <div>
            <button
              type="submit"
              disabled={isSaving}
              className={`inline-flex justify-center py-2 px-4 border border-transparent shadow-sm text-sm font-medium rounded-md text-white ${
                isSaving ? 'bg-indigo-400' : 'bg-indigo-600 hover:bg-indigo-700'
              } focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-indigo-500`}
            >
              {isSaving ? '保存中...' : '保存更改'}
            </button>
            
            {saveSuccess === true && (
              <span className="ml-3 text-sm text-green-600">保存成功!</span>
            )}
            
            {saveSuccess === false && (
              <span className="ml-3 text-sm text-red-600">保存失败，请重试!</span>
            )}
          </div>
        </div>
      </form>
      
      <div className="mt-8 border-t border-gray-200 pt-6">
        <h3 className="text-md font-medium text-gray-900 mb-2">预览</h3>
        <div className="bg-gray-50 p-4 rounded-md">
          <h1 className="text-xl font-bold text-gray-900">{content.title}</h1>
          <p className="mt-2 text-sm text-gray-600">{content.description}</p>
          <p className="mt-4 text-md font-semibold text-indigo-600">{content.welcomeMessage}</p>
          <p className="mt-6 text-xs text-gray-500">{content.footerText}</p>
        </div>
      </div>
    </div>
  );
};

export default AdminHomeContentEditor; 