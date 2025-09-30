import React, { useEffect } from 'react';
import { BrowserRouter as Router, Routes, Route, Navigate } from 'react-router-dom';
import './App.css';
import Layout from './components/Layout';
import HomePage from './components/HomePage';
import QuizPage from './components/QuizPage';
import ProfilePage from './components/ProfilePage';
import ProtectedRoute from './components/ProtectedRoute';
import AdminRoute from './components/AdminRoute';
import { UserProvider } from './contexts/UserContext';
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
  const auth = useAuth();
  const oidcUser = useOIDCUser();
  
  useEffect(() => {
    // 监听 OIDC 认证状态变化，但不触发额外的刷新
    // 移除可能导致循环的refreshOIDCUser调用
    
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
  }, [auth.isAuthenticated, auth.user?.expired, oidcUser.oidcLogout]); // 精简依赖项
  
  return null;
};

const App: React.FC = () => {
  // 页面刷新防护 - 调整为更宽松的条件
  useEffect(() => {
    const refreshCount = parseInt(sessionStorage.getItem('appRefreshCount') || '0');
    const lastRefreshTime = parseInt(sessionStorage.getItem('lastAppRefreshTime') || '0');
    const now = Date.now();
    
    // 检查是否是OIDC认证回调，如果是则不计入刷新次数
    const urlParams = new URLSearchParams(window.location.search);
    const isOIDCCallback = urlParams.has('code') && urlParams.has('state');
    
    if (isOIDCCallback) {
      console.log('[App] 检测到OIDC认证回调，跳过刷新计数');
      return;
    }
    
    // 如果在60秒内刷新超过5次，显示警告 (放宽条件)
    if (refreshCount >= 5 && (now - lastRefreshTime) < 60000) {
      console.warn('[App] 检测到频繁刷新，可能存在无限循环問題');
      toast.warning('ページが頻繁に更新されています。OIDC認証が完了するまでお待ちください', {
        autoClose: 5000,
        toastId: 'refresh-warning'
      });
      sessionStorage.setItem('appRefreshCount', '0'); // 重置计数
    } else if ((now - lastRefreshTime) > 60000) {
      // 超过60秒，重置计数
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
      const error = urlParams.get('error');
      const errorDescription = urlParams.get('error_description');
      
      if (error) {
        console.error('[App] OIDC認証エラーを検出:', { error, errorDescription });
        toast.error(`認証エラー: ${errorDescription || error}`);
        
        // 清理URL参数并重定向到首页
        window.history.replaceState({}, document.title, window.location.pathname);
        return;
      }
      
      if (code && state) {
        console.log('[App] 检测到OIDC认证回调');
        toast.info('認証を処理中...', {
          autoClose: 3000
        });
        
        // 检查认证状态管理
        const checkAuthState = () => {
          // 检查localStorage中是否有任何oidc用户状态
          let hasOidcState = false;
          try {
            Object.keys(localStorage).forEach(key => {
              if (key.includes('oidc.user:')) {
                hasOidcState = true;
              }
            });
          } catch (e) {
            console.warn('[App] localStorage検查中にエラー:', e);
          }
          
          if (!hasOidcState) {
            console.warn('[App] 認証状態が見つかりません。状態をリセットします。');
            // 清理URL参数
            window.history.replaceState({}, document.title, window.location.pathname);
          }
        };
        
        // 延迟检查认证状态，给OIDC库时间处理
        setTimeout(checkAuthState, 1000);
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
                  <Route path="/signup" element={<Navigate to="/" replace />} />
                  <Route path="/login" element={<Navigate to="/" replace />} />
                  <Route path="/register" element={<Navigate to="/" replace />} />
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
