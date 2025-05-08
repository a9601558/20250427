import React, { useState, useEffect } from 'react';
import { useUser } from '../contexts/UserContext';
import { getSavedAccounts } from '../utils/authUtils';
import { toast } from 'react-toastify';

enum AuthMode {
  LOGIN = 'login',
  REGISTER = 'register'
}

interface LoginModalProps {
  isOpen?: boolean;
  onClose: () => void;
}

const LoginModal: React.FC<LoginModalProps> = ({ isOpen = true, onClose }) => {
  const { login, register, loading, error: contextError, switchAccount } = useUser();
  const [mode, setMode] = useState<AuthMode>(AuthMode.LOGIN);
  const [formData, setFormData] = useState({
    usernameOrEmail: '',
    username: '',
    password: '',
    email: '',
    confirmPassword: ''
  });
  const [formError, setFormError] = useState<string | null>(null);
  const [savedAccounts, setSavedAccounts] = useState<Array<{
    userId: string;
    username: string;
    lastLogin: string;
    autoLogin: boolean;
  }>>([]);
  
  // 加载已保存的账号列表
  useEffect(() => {
    if (mode === AuthMode.LOGIN) {
      const accounts = getSavedAccounts();
      // 按最后登录时间排序，最近的在前面
      const sorted = [...accounts].sort((a, b) => 
        new Date(b.lastLogin).getTime() - new Date(a.lastLogin).getTime()
      );
      setSavedAccounts(sorted);
    }
  }, [mode]);
  
  const toggleMode = () => {
    setMode(mode === AuthMode.LOGIN ? AuthMode.REGISTER : AuthMode.LOGIN);
    setFormError('');
    // 重置表单
    setFormData({
      usernameOrEmail: '',
      username: '',
      password: '',
      email: '',
      confirmPassword: ''
    });
  };
  
  const validateForm = (): boolean => {
    setFormError('');
    
    if (mode === AuthMode.LOGIN) {
      // 登录模式验证
      if (!formData.usernameOrEmail.trim()) {
        setFormError('用户名或邮箱不能为空');
        return false;
      }
    } else {
      // 注册模式验证
      if (!formData.username.trim()) {
        setFormError('用户名不能为空');
        return false;
      }
      
      if (!formData.email.trim()) {
        setFormError('邮箱不能为空');
        return false;
      }
      
      // 简单的邮箱格式验证
      const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
      if (!emailRegex.test(formData.email)) {
        setFormError('请输入有效的邮箱地址');
        return false;
      }
      
      if (formData.password !== formData.confirmPassword) {
        setFormError('两次输入的密码不一致');
        return false;
      }
    }
    
    if (!formData.password) {
      setFormError('密码不能为空');
      return false;
    }
    
    if (mode === AuthMode.REGISTER && formData.password.length < 6) {
      setFormError('密码长度至少为6个字符');
      return false;
    }
    
    return true;
  };
  
  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!validateForm()) return;
    
    try {
      let success = false;
      
      if (mode === AuthMode.LOGIN) {
        success = await login(formData.usernameOrEmail, formData.password);
        if (!success) {
          setFormError('用户名/邮箱或密码错误');
        }
      } else {
        // 创建用户数据对象
        const userData = {
          username: formData.username,
          email: formData.email,
          password: formData.password
        };
        
        success = await register(userData);
        if (!success) {
          setFormError('该用户名或邮箱已被注册');
        }
      }
      
      if (success) {
        onClose(); // 登录/注册成功后关闭弹窗
      } else if (contextError) {
        // 如果上下文中有错误信息，则显示
        setFormError(contextError);
      }
    } catch (error) {
      setFormError('登录/注册时发生错误');
      console.error(error);
    }
  };
  
  // 添加通过已保存账号登录的函数
  const handleQuickLogin = async (userId: string) => {
    try {
      const success = await switchAccount(userId);
      
      if (success) {
        onClose();
        toast.success('账号切换成功');
      } else {
        toast.error('账号切换失败，请使用用户名密码登录');
      }
    } catch (error) {
      console.error('[LoginModal] 快速登录出错:', error);
      toast.error('快速登录失败');
    }
  };
  
  if (!isOpen) return null;
  
  return (
    <div className={`fixed inset-0 z-50 flex items-center justify-center ${isOpen ? 'block' : 'hidden'}`}>
      <div className="fixed inset-0 bg-black opacity-50" onClick={onClose}></div>
      <div className="bg-white rounded-lg p-8 max-w-md w-full relative z-10">
        <div className="flex justify-between items-center mb-6">
          <h3 className="text-xl font-semibold text-gray-900">
            {mode === AuthMode.LOGIN ? '登录您的账号' : '创建新账号'}
          </h3>
          <button 
            onClick={onClose}
            className="text-gray-400 hover:text-gray-500"
          >
            <svg className="h-6 w-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>
        
        {formError && (
          <div className="mb-4 bg-red-50 border-l-4 border-red-500 p-4">
            <div className="flex">
              <div className="flex-shrink-0">
                <svg className="h-5 w-5 text-red-500" fill="currentColor" viewBox="0 0 20 20">
                  <path fillRule="evenodd" d="M18 10a8 8 0 11-16 0 8 8 0 0116 0zm-7 4a1 1 0 11-2 0 1 1 0 012 0zm-1-9a1 1 0 00-1 1v4a1 1 0 102 0V6a1 1 0 00-1-1z" clipRule="evenodd" />
                </svg>
              </div>
              <div className="ml-3">
                <p className="text-sm text-red-700">{formError}</p>
              </div>
            </div>
          </div>
        )}

        <form className="space-y-4" onSubmit={handleSubmit}>
          {mode === AuthMode.LOGIN ? (
            // 登录模式显示用户名/邮箱输入框
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
                  value={formData.usernameOrEmail}
                  onChange={(e) => setFormData({ ...formData, usernameOrEmail: e.target.value })}
                  required
                  className="appearance-none block w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm placeholder-gray-400 focus:outline-none focus:ring-blue-500 focus:border-blue-500 sm:text-sm"
                  placeholder="请输入用户名或邮箱"
                />
              </div>
            </div>
          ) : (
            // 注册模式显示用户名和邮箱输入框
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
                    autoComplete="username"
                    value={formData.username}
                    onChange={(e) => setFormData({ ...formData, username: e.target.value })}
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
                    value={formData.email}
                    onChange={(e) => setFormData({ ...formData, email: e.target.value })}
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
                value={formData.password}
                onChange={(e) => setFormData({ ...formData, password: e.target.value })}
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
                  value={formData.confirmPassword}
                  onChange={(e) => setFormData({ ...formData, confirmPassword: e.target.value })}
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
              disabled={loading}
              className={`w-full flex justify-center py-2 px-4 border border-transparent rounded-md shadow-sm text-sm font-medium text-white bg-blue-600 hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500 ${loading ? 'opacity-70 cursor-not-allowed' : ''}`}
            >
              {loading ? (
                <svg className="animate-spin -ml-1 mr-3 h-5 w-5 text-white" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                  <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                  <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                </svg>
              ) : null}
              {mode === AuthMode.LOGIN ? '登录' : '注册'}
            </button>
          </div>
        </form>

        <div className="mt-4 flex justify-center">
          <button
            onClick={toggleMode}
            className="text-sm text-blue-600 hover:text-blue-500"
          >
            {mode === AuthMode.LOGIN ? '还没有账号？点击注册' : '已有账号？点击登录'}
          </button>
        </div>

        {mode === AuthMode.LOGIN && savedAccounts.length > 0 && (
          <div className="mb-6">
            <h3 className="text-sm font-medium text-gray-700 mb-2">快速登录</h3>
            <div className="space-y-2 max-h-40 overflow-y-auto">
              {savedAccounts.map(account => (
                <div
                  key={account.userId}
                  className="border border-gray-200 rounded p-2 flex justify-between items-center hover:bg-gray-50 cursor-pointer"
                  onClick={() => handleQuickLogin(account.userId)}
                >
                  <div>
                    <div className="font-medium">{account.username}</div>
                    <div className="text-xs text-gray-500">
                      上次登录: {new Date(account.lastLogin).toLocaleString('zh-CN', {
                        month: 'short',
                        day: 'numeric',
                        hour: 'numeric',
                        minute: 'numeric'
                      })}
                    </div>
                  </div>
                  <button className="text-xs px-2 py-1 bg-blue-100 text-blue-700 rounded">
                    选择
                  </button>
                </div>
              ))}
            </div>
          </div>
        )}
      </div>
    </div>
  );
};

export default LoginModal; 