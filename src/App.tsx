import React, { useEffect } from 'react';
import { BrowserRouter as Router, Routes, Route, Navigate } from 'react-router-dom';
import './App.css';
import Layout from './components/Layout';
import HomePage from './components/HomePage';
import QuizPage from './components/QuizPage';
import ProfilePage from './components/ProfilePage';
import ProtectedRoute from './components/ProtectedRoute';
import AdminRoute from './components/AdminRoute';
import { UserProvider, useUser } from './contexts/UserContext';
import AdminPage from './components/AdminPage';
import RedeemCodeAdmin from './components/RedeemCodeAdmin';
import { SocketProvider } from './contexts/SocketContext';
import { ToastContainer } from 'react-toastify';
import { UserProgressProvider } from './contexts/UserProgressContext';
import { isTokenExpired, performAutoLogin } from './utils/authUtils';
import { toast } from 'react-toastify';
import QuestionSetSearchPage from './components/QuestionSetSearchPage';

// 创建一个内部组件处理认证逻辑
const AuthManager: React.FC = () => {
  const { user, logout } = useUser();
  
  useEffect(() => {
    // 检查令牌是否过期
    const checkTokenExpiry = async () => {
      // 如果用户已登录且令牌过期，自动登出
      if (user && isTokenExpired()) {
        console.log('令牌已过期，自动登出');
        toast.info('登录已过期，请重新登录', {
          autoClose: 3000
        });
        logout();
      }
    };
    
    // 初始检查
    checkTokenExpiry();
    
    // 设置定期检查
    const tokenCheckInterval = setInterval(checkTokenExpiry, 60 * 1000); // 每分钟检查一次
    
    return () => {
      clearInterval(tokenCheckInterval);
    };
  }, [user, logout]);
  
  return null;
};

const App: React.FC = () => {
  // 应用启动时尝试自动登录
  useEffect(() => {
    const tryAutoLogin = async () => {
      // 只有在没有token的情况下才尝试自动登录
      if (!localStorage.getItem('token')) {
        const success = await performAutoLogin();
        if (success) {
          toast.success('自动登录成功', {
            autoClose: 2000
          });
        }
      }
    };
    
    tryAutoLogin();
  }, []);
  
  return (
    <UserProvider>
      <SocketProvider>
        <UserProgressProvider>
          <Router>
            <Layout>
              <Routes>
                <Route path="/" element={<HomePage />} />
                <Route path="/profile" element={
                  <ProtectedRoute>
                    <ProfilePage />
                  </ProtectedRoute>
                } />
                <Route path="/admin" element={
                  <AdminRoute>
                    <AdminPage />
                  </AdminRoute>
                } />
                <Route path="/admin/redeem-codes" element={
                  <AdminRoute>
                    <RedeemCodeAdmin />
                  </AdminRoute>
                } />
                <Route path="/quiz/:questionSetId" element={<QuizPage />} />
                <Route path="/payment/:id" element={<Navigate to="/" replace />} />
                <Route path="/question-sets" element={<QuestionSetSearchPage />} />
              </Routes>
            </Layout>
          </Router>
          <AuthManager />
          <ToastContainer 
            position="top-right"
            autoClose={5000}
            hideProgressBar={false}
            newestOnTop
            closeOnClick
            rtl={false}
            pauseOnFocusLoss
            draggable
            pauseOnHover
            icon={false}
          />
        </UserProgressProvider>
      </SocketProvider>
    </UserProvider>
  );
};

export default App;
