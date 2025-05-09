import React, { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import SocketStatus from './SocketStatus';
import LoginModal from './LoginModal';
import UserMenu from './UserMenu';
import { useUser } from '../contexts/UserContext';
import { homepageService } from '../services/api';
import { HomeContent } from '../types';
import { useSocket } from '../contexts/SocketContext';

interface LayoutProps {
  children: React.ReactNode;
}

const Layout: React.FC<LayoutProps> = ({ children }) => {
  const [isLoginModalOpen, setIsLoginModalOpen] = useState(false);
  const { user } = useUser();
  const [footerText, setFooterText] = useState<string>("");
  const { socket } = useSocket();
  
  // 获取页脚文本
  const fetchFooterText = async () => {
    try {
      console.log('[Layout] 获取页脚文本');
      const response = await homepageService.getHomeContent();
      if (response.success && response.data) {
        console.log('[Layout] 页脚文本获取成功:', response.data.footerText);
        setFooterText(response.data.footerText);
      }
    } catch (error) {
      console.error('[Layout] 获取页脚文本失败:', error);
      // 设置默认页脚文本作为备用
      setFooterText(`© ${new Date().getFullYear()} ExamTopics 在线题库系统 保留所有权利`);
    }
  };
  
  useEffect(() => {
    fetchFooterText();
  }, []);
  
  // 监听Socket事件，当接收到管理员更新首页内容的事件时刷新页脚文本
  useEffect(() => {
    if (!socket) return;
    
    console.log('[Layout] 设置Socket事件监听，接收页脚文本更新');
    
    const handleHomeContentUpdated = () => {
      console.log('[Layout] 接收到管理员首页内容更新事件，刷新页脚文本');
      fetchFooterText();
    };
    
    // 添加Socket监听
    socket.on('admin:homeContent:updated', handleHomeContentUpdated);
    
    // 清理函数
    return () => {
      socket.off('admin:homeContent:updated', handleHomeContentUpdated);
    };
  }, [socket]);

  return (
    <div className="flex flex-col min-h-screen bg-gray-50">
      <header className="bg-white shadow-sm sticky top-0 z-30">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-4 flex justify-between items-center">
          <Link to="/" className="flex items-center">
            <div className="text-2xl font-bold text-blue-600">ExamTopics</div>
          </Link>
          
          <div className="flex items-center space-x-4">
            {user ? (
              <UserMenu />
            ) : (
              <button
                onClick={() => setIsLoginModalOpen(true)}
                className="inline-flex items-center px-4 py-2 border border-transparent text-sm font-medium rounded-md text-white bg-blue-600 hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500"
              >
                登录/注册
              </button>
            )}
          </div>
        </div>
      </header>

      <main className="flex-grow relative">
        {children}
      </main>

      {/* Socket连接状态指示器 */}
      <SocketStatus />

      <footer className="bg-white border-t border-gray-200 py-4">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="text-center text-gray-500 text-sm" 
               dangerouslySetInnerHTML={{ __html: footerText }} />
        </div>
      </footer>

      {/* 登录弹窗 */}
      <LoginModal 
        isOpen={isLoginModalOpen} 
        onClose={() => setIsLoginModalOpen(false)} 
      />
    </div>
  );
};

export default Layout; 