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
  
  // 保存されたアカウントリストを取得
  const loadStoredAccounts = useCallback(() => {
    try {
      // localStorageから全ての保存されたアカウント情報を取得
      const accountsData = localStorage.getItem('stored_accounts') || '[]';
      const parsedAccounts: StoredAccount[] = JSON.parse(accountsData);
      
      // 現在のユーザーがログイン済みでリストにない場合、リストに追加
      if (user && user.id && !parsedAccounts.some(acc => acc.userId === user.id)) {
        const newAccount: StoredAccount = {
          userId: user.id,
          username: user.username || '名前未設定',
          lastLogin: new Date().toISOString(),
          autoLogin: false
        };
        
        parsedAccounts.push(newAccount);
        localStorage.setItem('stored_accounts', JSON.stringify(parsedAccounts));
      }
      
      // 現在のユーザーがリストにある場合、最終ログイン時刻を更新
      if (user && user.id) {
        const updatedAccounts = parsedAccounts.map(acc => 
          acc.userId === user.id 
            ? { ...acc, lastLogin: new Date().toISOString() } 
            : acc
        );
        localStorage.setItem('stored_accounts', JSON.stringify(updatedAccounts));
        
        // 現在のユーザーの自動ログイン設定を取得
        const currentUserAccount = updatedAccounts.find(acc => acc.userId === user.id);
        setAutoLoginEnabled(currentUserAccount?.autoLogin || false);
      }
      
      // 最終ログイン時刻でソート、最近ログインしたものが前に
      const sortedAccounts = [...parsedAccounts].sort((a, b) => 
        new Date(b.lastLogin).getTime() - new Date(a.lastLogin).getTime()
      );
      
      setAccounts(sortedAccounts);
    } catch (error) {
      console.error('[AccountSwitcher] アカウントデータの読み込みエラー:', error);
      }
  }, [user]);
  
  // トークン有効期限設定を読み込み
  const loadTokenSettings = useCallback(() => {
    try {
      const savedExpiry = localStorage.getItem('token_expiry_days');
      if (savedExpiry) {
        setTokenExpiryDays(parseInt(savedExpiry, 10));
      }
    } catch (error) {
      console.error('[AccountSwitcher] トークン設定の読み込みエラー:', error);
    }
  }, []);
  
  // コンポーネント読み込み時にアカウントリストを取得
  useEffect(() => {
    loadStoredAccounts();
    loadTokenSettings();
  }, [loadStoredAccounts, loadTokenSettings]);
  
  // 選択したアカウントに切り替え
  const handleSwitchAccount = async (userId: string) => {
    if (userId === user?.id) {
      return;
    }
    
    setLoading(true);
    try {
      const success = await switchAccount(userId);
      if (success) {
        loadStoredAccounts(); // 重新加载账号列表
        if (onClose) onClose();
      } else {
        }
    } catch (error) {
      console.error('[AccountSwitcher] アカウント切り替えエラー:', error);
      } finally {
      setLoading(false);
    }
  };
  
  // 指定したアカウントのデータをクリア
  const handleClearAccountData = (userId: string) => {
    if (window.confirm('このアカウントのすべてのローカルデータをクリアしますか？すべてのキャッシュされた状態と設定が削除されます。')) {
      try {
        // 現在ログイン中のアカウントをクリアする場合は、先にログアウト
        if (userId === user?.id) {
          logout();
        }
        
        // このユーザーのすべてのローカルストレージ項目を削除
        const userPrefix = `user_${userId}_`;
        const keysToRemove = [];
        
        for (let i = 0; i < localStorage.length; i++) {
          const key = localStorage.key(i);
          if (key && key.startsWith(userPrefix)) {
            keysToRemove.push(key);
          }
        }
        
        // 一括でストレージ項目を削除
        keysToRemove.forEach(key => localStorage.removeItem(key));
        
        // アカウントリストから削除
        const updatedAccounts = accounts.filter(acc => acc.userId !== userId);
        localStorage.setItem('stored_accounts', JSON.stringify(updatedAccounts));
        setAccounts(updatedAccounts);
        
        } catch (error) {
        console.error('[AccountSwitcher] アカウントデータのクリアエラー:', error);
        }
    }
  };
  
  // アカウントの自動ログインを設定
  const handleToggleAutoLogin = () => {
    if (!user) return;
    
    try {
      const newValue = !autoLoginEnabled;
      setAutoLoginEnabled(newValue);
      
      // アカウントリストの設定を更新
      const updatedAccounts = accounts.map(acc => 
        acc.userId === user.id 
          ? { ...acc, autoLogin: newValue } 
          : acc
      );
      
      localStorage.setItem('stored_accounts', JSON.stringify(updatedAccounts));
      setAccounts(updatedAccounts);
      
      // 自動ログインが有効な場合、マーカーを保存
      if (newValue) {
        localStorage.setItem('auto_login_user', user.id);
      } else if (localStorage.getItem('auto_login_user') === user.id) {
        localStorage.removeItem('auto_login_user');
      }
      
      } catch (error) {
      console.error('[AccountSwitcher] 自動ログイン設定エラー:', error);
      }
  };
  
  // トークンの有効期限を設定
  const handleSetTokenExpiry = (days: number) => {
    try {
      setTokenExpiryDays(days);
      localStorage.setItem('token_expiry_days', days.toString());
      
      // 現在のユーザーのトークン有効期限を設定
      if (user && user.id) {
        const userPrefix = `user_${user.id}_`;
        const now = new Date();
        const expiryDate = new Date(now.getTime() + days * 24 * 60 * 60 * 1000);
        
        localStorage.setItem(`${userPrefix}token_expiry`, expiryDate.toISOString());
      }
      
      } catch (error) {
      console.error('[AccountSwitcher] トークン有効期限設定エラー:', error);
      }
  };
  
  // 最終ログイン時刻をフォーマット
  const formatLastLogin = (dateString: string) => {
    try {
      const date = new Date(dateString);
      return date.toLocaleString('ja-JP', { 
        year: 'numeric', 
        month: '2-digit', 
        day: '2-digit',
        hour: '2-digit',
        minute: '2-digit'
      });
    } catch (error) {
      return '不明な時刻';
    }
  };
  
  return (
    <div className="bg-white rounded-lg shadow-lg p-6 w-full max-h-[90vh] overflow-y-auto">
      <div className="flex justify-between items-center mb-4 border-b pb-3">
        <h2 className="text-xl font-bold text-gray-800">アカウント管理</h2>
        {onClose && (
          <button 
            onClick={onClose}
            className="text-gray-500 hover:text-gray-700 p-1 rounded-full hover:bg-gray-100 transition-colors"
            aria-label="閉じる"
          >
            <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M6 18L18 6M6 6l12 12"></path>
            </svg>
          </button>
        )}
      </div>
      
      {/* アカウントリスト */}
      <div className="mb-6">
        <h3 className="text-lg font-medium mb-3 text-gray-700">ログイン済みアカウント</h3>
        {accounts.length === 0 ? (
          <div className="bg-gray-50 border border-gray-200 rounded-lg p-4 text-gray-500 text-center">
            保存されたアカウントがありません
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
                      最終ログイン: {formatLastLogin(account.lastLogin)}
                    </div>
                    {account.autoLogin && (
                      <div className="mt-1 inline-flex items-center px-2 py-0.5 rounded text-xs font-medium bg-green-100 text-green-800">
                        <svg className="w-3 h-3 mr-1" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M5 13l4 4L19 7" />
                        </svg>
                        自動ログイン
                      </div>
                    )}
                  </div>
                  <div className="flex space-x-2">
                    {account.userId !== user?.id && (
                      <button
                        onClick={() => handleSwitchAccount(account.userId)}
                        disabled={loading}
                        className="text-blue-600 hover:text-blue-800 hover:bg-blue-50 p-1.5 rounded transition-colors"
                        title="このアカウントに切り替える"
                      >
                        <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M13 7l5 5m0 0l-5 5m5-5H6" />
                        </svg>
                      </button>
                    )}
                    <button
                      onClick={() => handleClearAccountData(account.userId)}
                      className="text-red-600 hover:text-red-800 hover:bg-red-50 p-1.5 rounded transition-colors"
                      title="このアカウントのデータをクリア"
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
      
        {/* 現在のアカウント設定 */}
        {user && (
          <div className="border-t border-gray-200 pt-4">
            <h3 className="text-sm font-semibold text-gray-700 mb-3">現在のアカウント設定</h3>
            
            {/* 自動ログイン設定 */}
          <div className="mb-4">
            <div className="flex items-center justify-between">
              <label className="flex items-center cursor-pointer">
                <div className="mr-3">
                  <span className="block text-sm font-medium text-gray-700">自動ログイン</span>
                  <span className="block text-xs text-gray-500 mt-1">次回アプリを開いたときにこのアカウントを自動的に使用</span>
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
          
          {/* トークン有効期限設定 */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">トークンの有効期限</label>
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
                  {days}日
                </button>
              ))}
            </div>
            <p className="text-xs text-gray-500 mt-2">現在の設定: {tokenExpiryDays}日後にトークンが期限切れ</p>
          </div>
        </div>
      )}
      
      {/* ボタン */}
      <div className="flex justify-end space-x-3 pt-3 border-t">
        {onClose && (
          <button
            onClick={onClose}
            className="px-4 py-2 text-sm font-medium text-gray-700 bg-gray-100 hover:bg-gray-200 rounded-lg transition-colors"
          >
            閉じる
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