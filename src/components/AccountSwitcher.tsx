import React, { useState, useEffect, useCallback } from 'react';
import { useUser } from '../contexts/UserContext';
import { toast } from 'react-toastify';

interface StoredAccount {
  userId: string;
  username: string;
  lastLogin: string;
  autoLogin: boolean;
}

interface AccountSwitcherProps {
  onClose?: () => void;
}

const AccountSwitcher: React.FC<AccountSwitcherProps> = ({ onClose }) => {
  const { user, switchAccount, logout } = useUser();
  const [accounts, setAccounts] = useState<StoredAccount[]>([]);
  const [loading, setLoading] = useState(false);
  const [autoLoginEnabled, setAutoLoginEnabled] = useState(false);
  const [tokenExpiryDays, setTokenExpiryDays] = useState(30);
  
  // 获取存储的账号列表
  const loadStoredAccounts = useCallback(() => {
    try {
      // 从localStorage获取所有存储的账号信息
      const accountsData = localStorage.getItem('stored_accounts') || '[]';
      const parsedAccounts: StoredAccount[] = JSON.parse(accountsData);
      
      // 如果当前用户已登录且不在列表中，添加到列表
      if (user && user.id && !parsedAccounts.some(acc => acc.userId === user.id)) {
        const newAccount: StoredAccount = {
          userId: user.id,
          username: user.username || '未命名用户',
          lastLogin: new Date().toISOString(),
          autoLogin: false
        };
        
        parsedAccounts.push(newAccount);
        localStorage.setItem('stored_accounts', JSON.stringify(parsedAccounts));
      }
      
      // 如果当前用户在列表中，更新最后登录时间
      if (user && user.id) {
        const updatedAccounts = parsedAccounts.map(acc => 
          acc.userId === user.id 
            ? { ...acc, lastLogin: new Date().toISOString() } 
            : acc
        );
        localStorage.setItem('stored_accounts', JSON.stringify(updatedAccounts));
        
        // 获取当前用户的自动登录设置
        const currentUserAccount = updatedAccounts.find(acc => acc.userId === user.id);
        setAutoLoginEnabled(currentUserAccount?.autoLogin || false);
      }
      
      // 按最后登录时间排序，最近登录的排在前面
      const sortedAccounts = [...parsedAccounts].sort((a, b) => 
        new Date(b.lastLogin).getTime() - new Date(a.lastLogin).getTime()
      );
      
      setAccounts(sortedAccounts);
    } catch (error) {
      console.error('[AccountSwitcher] 加载账号数据出错:', error);
      toast.error('加载账号列表失败');
    }
  }, [user]);
  
  // 读取令牌过期设置
  const loadTokenSettings = useCallback(() => {
    try {
      const savedExpiry = localStorage.getItem('token_expiry_days');
      if (savedExpiry) {
        setTokenExpiryDays(parseInt(savedExpiry, 10));
      }
    } catch (error) {
      console.error('[AccountSwitcher] 加载令牌设置出错:', error);
    }
  }, []);
  
  // 组件加载时获取账号列表
  useEffect(() => {
    loadStoredAccounts();
    loadTokenSettings();
  }, [loadStoredAccounts, loadTokenSettings]);
  
  // 切换到选择的账号
  const handleSwitchAccount = async (userId: string) => {
    if (userId === user?.id) {
      toast.info('您已经登录此账号');
      return;
    }
    
    setLoading(true);
    try {
      const success = await switchAccount(userId);
      if (success) {
        toast.success('账号切换成功');
        loadStoredAccounts(); // 重新加载账号列表
        if (onClose) onClose();
      } else {
        toast.error('账号切换失败，请重新登录该账号');
      }
    } catch (error) {
      console.error('[AccountSwitcher] 切换账号出错:', error);
      toast.error('账号切换过程中发生错误');
    } finally {
      setLoading(false);
    }
  };
  
  // 清除指定账号的数据
  const handleClearAccountData = (userId: string) => {
    if (window.confirm('确定要清除此账号的所有本地数据吗？这将删除所有缓存的状态和设置。')) {
      try {
        // 如果正在清除当前登录的账号，先登出
        if (userId === user?.id) {
          logout();
        }
        
        // 删除该用户的所有本地存储项
        const userPrefix = `user_${userId}_`;
        const keysToRemove = [];
        
        for (let i = 0; i < localStorage.length; i++) {
          const key = localStorage.key(i);
          if (key && key.startsWith(userPrefix)) {
            keysToRemove.push(key);
          }
        }
        
        // 批量删除存储项
        keysToRemove.forEach(key => localStorage.removeItem(key));
        
        // 从账号列表中移除
        const updatedAccounts = accounts.filter(acc => acc.userId !== userId);
        localStorage.setItem('stored_accounts', JSON.stringify(updatedAccounts));
        setAccounts(updatedAccounts);
        
        toast.success('账号数据已清除');
      } catch (error) {
        console.error('[AccountSwitcher] 清除账号数据出错:', error);
        toast.error('清除账号数据失败');
      }
    }
  };
  
  // 设置账号自动登录
  const handleToggleAutoLogin = () => {
    if (!user) return;
    
    try {
      const newValue = !autoLoginEnabled;
      setAutoLoginEnabled(newValue);
      
      // 更新账号列表中的设置
      const updatedAccounts = accounts.map(acc => 
        acc.userId === user.id 
          ? { ...acc, autoLogin: newValue } 
          : acc
      );
      
      localStorage.setItem('stored_accounts', JSON.stringify(updatedAccounts));
      setAccounts(updatedAccounts);
      
      // 如果启用自动登录，保存一个标记
      if (newValue) {
        localStorage.setItem('auto_login_user', user.id);
      } else if (localStorage.getItem('auto_login_user') === user.id) {
        localStorage.removeItem('auto_login_user');
      }
      
      toast.success(`自动登录已${newValue ? '启用' : '禁用'}`);
    } catch (error) {
      console.error('[AccountSwitcher] 设置自动登录出错:', error);
      toast.error('设置自动登录失败');
    }
  };
  
  // 设置令牌过期时间
  const handleSetTokenExpiry = (days: number) => {
    try {
      setTokenExpiryDays(days);
      localStorage.setItem('token_expiry_days', days.toString());
      
      // 为当前用户设置令牌过期时间
      if (user && user.id) {
        const userPrefix = `user_${user.id}_`;
        const now = new Date();
        const expiryDate = new Date(now.getTime() + days * 24 * 60 * 60 * 1000);
        
        localStorage.setItem(`${userPrefix}token_expiry`, expiryDate.toISOString());
      }
      
      toast.success(`令牌过期时间已设置为${days}天`);
    } catch (error) {
      console.error('[AccountSwitcher] 设置令牌过期时间出错:', error);
      toast.error('设置令牌过期时间失败');
    }
  };
  
  // 格式化最后登录时间
  const formatLastLogin = (dateString: string) => {
    try {
      const date = new Date(dateString);
      return date.toLocaleString('zh-CN', { 
        year: 'numeric', 
        month: '2-digit', 
        day: '2-digit',
        hour: '2-digit',
        minute: '2-digit'
      });
    } catch (error) {
      return '未知时间';
    }
  };
  
  return (
    <div className="bg-white rounded-lg shadow-lg p-6 w-full max-h-[90vh] overflow-y-auto">
      <div className="flex justify-between items-center mb-4 border-b pb-3">
        <h2 className="text-xl font-bold text-gray-800">账号管理</h2>
        {onClose && (
          <button 
            onClick={onClose}
            className="text-gray-500 hover:text-gray-700 p-1 rounded-full hover:bg-gray-100 transition-colors"
            aria-label="关闭"
          >
            <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M6 18L18 6M6 6l12 12"></path>
            </svg>
          </button>
        )}
      </div>
      
      {/* 账号列表 */}
      <div className="mb-6">
        <h3 className="text-lg font-medium mb-3 text-gray-700">已登录账号</h3>
        {accounts.length === 0 ? (
          <div className="bg-gray-50 border border-gray-200 rounded-lg p-4 text-gray-500 text-center">
            没有保存的账号
          </div>
        ) : (
          <div className="space-y-3 max-h-60 overflow-y-auto pr-1">
            {accounts.map(account => (
              <div 
                key={account.userId}
                className={`border rounded-lg p-3 ${account.userId === user?.id ? 'border-blue-500 bg-blue-50' : 'border-gray-200 hover:border-gray-300 hover:bg-gray-50'} transition-all`}
              >
                <div className="flex justify-between items-start">
                  <div>
                    <div className="font-medium text-gray-800">{account.username}</div>
                    <div className="text-xs text-gray-500 mt-1">
                      上次登录: {formatLastLogin(account.lastLogin)}
                    </div>
                    {account.autoLogin && (
                      <div className="mt-1 inline-flex items-center px-2 py-0.5 rounded text-xs font-medium bg-green-100 text-green-800">
                        <svg className="w-3 h-3 mr-1" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M5 13l4 4L19 7" />
                        </svg>
                        自动登录
                      </div>
                    )}
                  </div>
                  <div className="flex space-x-2">
                    {account.userId !== user?.id && (
                      <button
                        onClick={() => handleSwitchAccount(account.userId)}
                        disabled={loading}
                        className="text-blue-600 hover:text-blue-800 hover:bg-blue-50 p-1.5 rounded transition-colors"
                        title="切换到此账号"
                      >
                        <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M13 7l5 5m0 0l-5 5m5-5H6" />
                        </svg>
                      </button>
                    )}
                    <button
                      onClick={() => handleClearAccountData(account.userId)}
                      className="text-red-600 hover:text-red-800 hover:bg-red-50 p-1.5 rounded transition-colors"
                      title="清除此账号数据"
                    >
                      <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                      </svg>
                    </button>
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
      
      {/* 当前账号设置 */}
      {user && (
        <div className="mb-6 bg-gray-50 p-4 rounded-lg border border-gray-200">
          <h3 className="text-lg font-medium mb-3 text-gray-700">当前账号设置</h3>
          
          {/* 自动登录设置 */}
          <div className="mb-4">
            <div className="flex items-center justify-between">
              <label className="flex items-center cursor-pointer">
                <div className="mr-3">
                  <span className="block text-sm font-medium text-gray-700">自动登录</span>
                  <span className="block text-xs text-gray-500 mt-1">下次打开应用时自动使用此账号</span>
                </div>
                <div className="relative">
                  <input
                    type="checkbox"
                    className="sr-only"
                    checked={autoLoginEnabled}
                    onChange={handleToggleAutoLogin}
                  />
                  <div className={`block w-10 h-6 rounded-full transition-colors ${autoLoginEnabled ? 'bg-blue-600' : 'bg-gray-300'}`}></div>
                  <div className={`absolute left-1 top-1 bg-white w-4 h-4 rounded-full transition transform ${autoLoginEnabled ? 'translate-x-4' : ''}`}></div>
                </div>
              </label>
            </div>
          </div>
          
          {/* 令牌过期设置 */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">令牌过期时间</label>
            <div className="flex items-center space-x-2">
              {[7, 15, 30, 60, 90].map(days => (
                <button
                  key={days}
                  onClick={() => handleSetTokenExpiry(days)}
                  className={`px-3 py-1.5 text-sm rounded-full ${
                    tokenExpiryDays === days
                      ? 'bg-blue-600 text-white'
                      : 'bg-white border border-gray-300 text-gray-700 hover:bg-gray-50'
                  } transition-colors`}
                >
                  {days}天
                </button>
              ))}
            </div>
            <p className="text-xs text-gray-500 mt-2">当前设置: {tokenExpiryDays}天后令牌过期</p>
          </div>
        </div>
      )}
      
      {/* 底部按钮 */}
      <div className="flex justify-end space-x-3 pt-3 border-t">
        {onClose && (
          <button
            onClick={onClose}
            className="px-4 py-2 text-sm font-medium text-gray-700 bg-gray-100 hover:bg-gray-200 rounded-lg transition-colors"
          >
            关闭
          </button>
        )}
      </div>
    </div>
  );
};

export default AccountSwitcher;

// 添加切换器的CSS
const style = document.createElement('style');
style.textContent = `
  .toggle-checkbox:checked {
    right: 0;
    border-color: #3b82f6;
  }
  .toggle-checkbox:checked + .toggle-label {
    background-color: #3b82f6;
  }
  .toggle-label {
    transition: background-color 0.2s ease;
  }
`;
document.head.appendChild(style); 