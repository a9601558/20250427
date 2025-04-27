import React, { useState } from 'react';
import { useUser } from '../contexts/UserContext';
import LoginModal from './LoginModal';

interface ProtectedRouteProps {
  children: React.ReactNode;
}

const ProtectedRoute: React.FC<ProtectedRouteProps> = ({ children }) => {
  const { user, loading } = useUser();
  const [isLoginModalOpen, setIsLoginModalOpen] = useState(false);

  // 如果用户数据正在加载中，显示加载状态
  if (loading) {
    return (
      <div className="flex justify-center items-center min-h-screen">
        <div className="animate-spin rounded-full h-12 w-12 border-t-2 border-b-2 border-blue-500"></div>
      </div>
    );
  }

  // 如果用户未登录，显示登录弹窗
  if (!user) {
    return (
      <>
        <div className="flex flex-col items-center justify-center min-h-screen bg-gray-100 p-4">
          <div className="bg-white rounded-lg shadow-md p-8 max-w-md w-full text-center">
            <svg className="w-16 h-16 text-blue-500 mx-auto mb-4" fill="none" stroke="currentColor" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z"></path>
            </svg>
            <h2 className="text-2xl font-bold text-gray-800 mb-2">需要登录</h2>
            <p className="text-gray-600 mb-6">您需要登录才能访问此页面</p>
            <button
              onClick={() => setIsLoginModalOpen(true)}
              className="bg-blue-600 text-white py-2 px-6 rounded-lg font-medium hover:bg-blue-700 transition-colors w-full"
            >
              登录
            </button>
            <button
              onClick={() => window.location.href = '/'}
              className="mt-4 text-blue-600 hover:text-blue-800 font-medium"
            >
              返回首页
            </button>
          </div>
        </div>
        <LoginModal isOpen={isLoginModalOpen} onClose={() => setIsLoginModalOpen(false)} />
      </>
    );
  }

  // 用户已登录，显示子组件
  return <>{children}</>;
};

export default ProtectedRoute; 