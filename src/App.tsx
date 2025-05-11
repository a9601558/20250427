import React, { useEffect } from 'react';
import { BrowserRouter as Router, Routes, Route, Navigate, useParams } from 'react-router-dom';
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
import { httpLimiter } from './utils/loopPrevention';

// 创建一个重定向组件，从/practice/:id 重定向到 /quiz/:id
const PracticeToQuizRedirect: React.FC = () => {
  const { id } = useParams<{ id: string }>();
  return <Navigate to={`/quiz/${id}`} replace />;
};

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
  
  // 添加全局fetch拦截器，控制请求频率
  useEffect(() => {
    const originalFetch = window.fetch;
    
    window.fetch = async function(input, init) {
      // 忽略静态资源请求
      const url = typeof input === 'string' ? input : input instanceof URL ? input.href : input.url;
      if (url.match(/\.(css|js|png|jpg|jpeg|gif|svg|woff|woff2|ttf|eot)$/i)) {
        return originalFetch(input, init);
      }
      
      // 检查请求频率限制
      if (!httpLimiter.canMakeRequest()) {
        console.warn(`[App] 请求被限制: ${url}`);
        // 返回模拟的429响应
        return new Response(JSON.stringify({
          error: '请求频率过高',
          message: '请求被限制，请稍后再试'
        }), {
          status: 429,
          headers: {
            'Content-Type': 'application/json',
            'Retry-After': '5'
          }
        });
      }
      
      // 正常发送请求
      return originalFetch(input, init);
    };
    
    // 恢复原始fetch
    return () => {
      window.fetch = originalFetch;
    };
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
                <Route path="/practice/:id" element={<PracticeToQuizRedirect />} />
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
