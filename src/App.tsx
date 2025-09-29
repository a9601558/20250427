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
import { OIDCUserProvider, useOIDCUser } from './contexts/OIDCUserContext';
import AdminPage from './components/AdminPage';
import RedeemCodeAdmin from './components/RedeemCodeAdmin';
import { SocketProvider } from './contexts/SocketContext';
import { ToastContainer } from 'react-toastify';
import { UserProgressProvider } from './contexts/UserProgressContext';
import { toast } from 'react-toastify';
import QuestionSetSearchPage from './components/QuestionSetSearchPage';
import { httpRateLimiter } from './utils/loopPrevention';
import { useAuth } from "react-oidc-context";

// 创建一个内部组件处理认证逻辑
const AuthManager: React.FC = () => {
  const { user, logout } = useUser();
  const auth = useAuth();
  const oidcUser = useOIDCUser();
  
  useEffect(() => {
    // 监听 OIDC 认证状态变化
    if (auth.isAuthenticated && auth.user && !oidcUser.user) {
      console.log('[AuthManager] OIDC 认证成功，刷新用户信息');
      oidcUser.refreshOIDCUser();
    }
    
    // 检查 token 过期（如果 OIDC 用户已过期）
    const checkTokenExpiry = () => {
      if (auth.user?.expired) {
        console.log('[AuthManager] OIDC token 已过期，自动登出');
        toast.info('ログインが期限切れです。再度ログインしてください', {
          autoClose: 3000
        });
        oidcUser.oidcLogout();
      }
    };
    
    // 初始检查
    if (auth.isAuthenticated) {
      checkTokenExpiry();
    }
    
    // 设置定期检查
    const tokenCheckInterval = setInterval(checkTokenExpiry, 60 * 1000); // 每分钟检查一次
    
    return () => {
      clearInterval(tokenCheckInterval);
    };
  }, [user, logout, auth.isAuthenticated, auth.user, oidcUser]);
  
  return null;
};

const App: React.FC = () => {
  // 页面刷新防护
  useEffect(() => {
    const refreshCount = parseInt(sessionStorage.getItem('appRefreshCount') || '0');
    const lastRefreshTime = parseInt(sessionStorage.getItem('lastAppRefreshTime') || '0');
    const now = Date.now();
    
    // 如果在30秒内刷新超过3次，显示警告
    if (refreshCount >= 3 && (now - lastRefreshTime) < 30000) {
      console.warn('[App] 检测到频繁刷新，可能存在无限循环問題');
      toast.warning('ページが頻繁に更新されています。ネットワーク接続を確認するか、技術サポートにお問い合わせください', {
        autoClose: 5000,
        toastId: 'refresh-warning'
      });
      sessionStorage.setItem('appRefreshCount', '0'); // 重置计数
    } else if ((now - lastRefreshTime) > 30000) {
      // 超过30秒，重置计数
      sessionStorage.setItem('appRefreshCount', '1');
    } else {
      // 增加计数
      sessionStorage.setItem('appRefreshCount', (refreshCount + 1).toString());
    }
    
    sessionStorage.setItem('lastAppRefreshTime', now.toString());
  }, []);

  // 应用启动时处理OIDC认证回调
  useEffect(() => {
    const handleOIDCCallback = () => {
      // 检查URL是否包含OIDC回调参数
      const urlParams = new URLSearchParams(window.location.search);
      const code = urlParams.get('code');
      const state = urlParams.get('state');
      
      if (code && state) {
        console.log('[App] 检测到OIDC认证回调');
        toast.info('認証を処理中...', {
          autoClose: 3000
        });
      }
    };
    
    handleOIDCCallback();
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
      if (!httpRateLimiter.canMakeRequest()) {
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
    <OIDCUserProvider>
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
    </OIDCUserProvider>
  );
};

export default App;
