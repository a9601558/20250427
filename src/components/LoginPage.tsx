import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useUser } from '../contexts/UserContext';

enum AuthMode {
  LOGIN = 'login',
  REGISTER = 'register'
}

const LoginPage: React.FC = () => {
  const [mode, setMode] = useState<AuthMode>(AuthMode.LOGIN);
  const [username, setUsername] = useState('');
  const [email, setEmail] = useState('');
  const [usernameOrEmail, setUsernameOrEmail] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [error, setError] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  
  const { login, register, error: contextError } = useUser();
  const navigate = useNavigate();
  
  const toggleMode = () => {
    setMode(mode === AuthMode.LOGIN ? AuthMode.REGISTER : AuthMode.LOGIN);
    setError('');
    // 重置表单
    setUsername('');
    setEmail('');
    setUsernameOrEmail('');
    setPassword('');
    setConfirmPassword('');
  };
  
  const validateForm = (): boolean => {
    setError('');
    
    if (mode === AuthMode.LOGIN) {
      // 登录模式验证
      if (!usernameOrEmail.trim()) {
        setError('用户名或邮箱不能为空');
        return false;
      }
    } else {
      // 注册模式验证
      if (!username.trim()) {
        setError('用户名不能为空');
        return false;
      }
      
      if (!email.trim()) {
        setError('邮箱不能为空');
        return false;
      }
      
      // 简单的邮箱格式验证
      const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
      if (!emailRegex.test(email)) {
        setError('请输入有效的邮箱地址');
        return false;
      }
      
      if (password !== confirmPassword) {
        setError('两次输入的密码不一致');
        return false;
      }
    }
    
    if (!password) {
      setError('密码不能为空');
      return false;
    }
    
    if (mode === AuthMode.REGISTER && password.length < 6) {
      setError('密码长度至少为6个字符');
      return false;
    }
    
    return true;
  };
  
  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!validateForm()) return;
    
    setIsLoading(true);
    
    try {
      let success = false;
      
      if (mode === AuthMode.LOGIN) {
        success = await login(usernameOrEmail, password);
        if (!success) {
          setError('用户名/邮箱或密码错误');
        }
      } else {
        // 创建用户数据对象
        const userData = {
          username,
          email,
          password
        };
        
        success = await register(userData);
        if (!success) {
          setError('该用户名或邮箱已被注册');
        }
      }
      
      if (success) {
        navigate('/');
      } else if (contextError) {
        // 如果上下文中有错误信息，则显示
        setError(contextError);
      }
    } catch (error) {
      setError('登录/注册时发生错误');
      console.error(error);
    } finally {
      setIsLoading(false);
    }
  };
  
  return (
    <div className="min-h-screen bg-gray-100 flex flex-col justify-center py-12 sm:px-6 lg:px-8">
      <div className="sm:mx-auto sm:w-full sm:max-w-md">
        <h2 className="mt-6 text-center text-3xl font-extrabold text-gray-900">
          {mode === AuthMode.LOGIN ? '登录您的账号' : '创建新账号'}
        </h2>
      </div>

      <div className="mt-8 sm:mx-auto sm:w-full sm:max-w-md">
        <div className="bg-white py-8 px-4 shadow sm:rounded-lg sm:px-10">
          {error && (
            <div className="mb-4 bg-red-50 border-l-4 border-red-500 p-4">
              <div className="flex">
                <div className="flex-shrink-0">
                  <svg className="h-5 w-5 text-red-500" fill="currentColor" viewBox="0 0 20 20">
                    <path fillRule="evenodd" d="M18 10a8 8 0 11-16 0 8 8 0 0116 0zm-7 4a1 1 0 11-2 0 1 1 0 012 0zm-1-9a1 1 0 00-1 1v4a1 1 0 102 0V6a1 1 0 00-1-1z" clipRule="evenodd" />
                  </svg>
                </div>
                <div className="ml-3">
                  <p className="text-sm text-red-700">{error}</p>
                </div>
              </div>
            </div>
          )}

          <form className="space-y-6" onSubmit={handleSubmit}>
            {mode === AuthMode.LOGIN ? (
              // 登录模式：显示用户名或邮箱输入框
              <div>
                <label htmlFor="usernameOrEmail" className="block text-sm font-medium text-gray-700">
                  用户名或邮箱
                </label>
                <div className="mt-1">
                  <input
                    id="usernameOrEmail"
                    name="usernameOrEmail"
                    type="text"
                    autoComplete="username email"
                    value={usernameOrEmail}
                    onChange={(e) => setUsernameOrEmail(e.target.value)}
                    required
                    className="appearance-none block w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm placeholder-gray-400 focus:outline-none focus:ring-blue-500 focus:border-blue-500 sm:text-sm"
                    placeholder="请输入用户名或邮箱"
                  />
                </div>
              </div>
            ) : (
              // 注册模式：显示分开的用户名和邮箱字段
              <>
                <div>
                  <label htmlFor="username" className="block text-sm font-medium text-gray-700">
                    用户名
                  </label>
                  <div className="mt-1">
                    <input
                      id="username"
                      name="username"
                      type="text"
                      value={username}
                      onChange={(e) => setUsername(e.target.value)}
                      required
                      className="appearance-none block w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm placeholder-gray-400 focus:outline-none focus:ring-blue-500 focus:border-blue-500 sm:text-sm"
                      placeholder="请输入用户名"
                    />
                  </div>
                </div>

                <div>
                  <label htmlFor="email" className="block text-sm font-medium text-gray-700">
                    电子邮箱
                  </label>
                  <div className="mt-1">
                    <input
                      id="email"
                      name="email"
                      type="email"
                      autoComplete="email"
                      value={email}
                      onChange={(e) => setEmail(e.target.value)}
                      required
                      className="appearance-none block w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm placeholder-gray-400 focus:outline-none focus:ring-blue-500 focus:border-blue-500 sm:text-sm"
                      placeholder="请输入电子邮箱"
                    />
                  </div>
                </div>
              </>
            )}

            <div>
              <label htmlFor="password" className="block text-sm font-medium text-gray-700">
                密码
              </label>
              <div className="mt-1">
                <input
                  id="password"
                  name="password"
                  type="password"
                  autoComplete={mode === AuthMode.LOGIN ? 'current-password' : 'new-password'}
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  required
                  className="appearance-none block w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm placeholder-gray-400 focus:outline-none focus:ring-blue-500 focus:border-blue-500 sm:text-sm"
                  placeholder="请输入密码"
                />
              </div>
            </div>

            {mode === AuthMode.REGISTER && (
              <div>
                <label htmlFor="confirmPassword" className="block text-sm font-medium text-gray-700">
                  确认密码
                </label>
                <div className="mt-1">
                  <input
                    id="confirmPassword"
                    name="confirmPassword"
                    type="password"
                    value={confirmPassword}
                    onChange={(e) => setConfirmPassword(e.target.value)}
                    required
                    className="appearance-none block w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm placeholder-gray-400 focus:outline-none focus:ring-blue-500 focus:border-blue-500 sm:text-sm"
                    placeholder="请再次输入密码"
                  />
                </div>
              </div>
            )}

            <div>
              <button
                type="submit"
                disabled={isLoading}
                className={`w-full flex justify-center py-2 px-4 border border-transparent rounded-md shadow-sm text-sm font-medium text-white bg-blue-600 hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500 ${isLoading ? 'opacity-70 cursor-not-allowed' : ''}`}
              >
                {isLoading ? (
                  <svg className="animate-spin -ml-1 mr-3 h-5 w-5 text-white" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                    <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                    <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                  </svg>
                ) : null}
                {mode === AuthMode.LOGIN ? '登录' : '注册'}
              </button>
            </div>
          </form>

          <div className="mt-6">
            <button
              onClick={toggleMode}
              className="w-full flex justify-center text-sm text-blue-600 hover:text-blue-500"
            >
              {mode === AuthMode.LOGIN ? '还没有账号？点击注册' : '已有账号？点击登录'}
            </button>
          </div>

          {mode === AuthMode.LOGIN && (
            <div className="mt-4 border-t border-gray-200 pt-4">
              <div className="text-sm text-gray-600">
                <p>测试账号：</p>
                <p>用户名：demo</p>
                <p>邮箱：demo@example.com</p>
                <p>密码：password</p>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

export default LoginPage; 