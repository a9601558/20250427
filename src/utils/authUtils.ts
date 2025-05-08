import { userApi } from './api';

/**
 * 检查令牌是否过期
 * @returns 如果令牌已过期或无效，返回true
 */
export const isTokenExpired = (): boolean => {
  try {
    // 检查是否有token
    const token = localStorage.getItem('token');
    if (!token) return true;
    
    // 获取当前登录的用户ID
    const activeUserId = localStorage.getItem('activeUserId');
    if (!activeUserId) return true;
    
    // 检查该用户的令牌过期时间
    const userPrefix = `user_${activeUserId}_`;
    const expiryDateStr = localStorage.getItem(`${userPrefix}token_expiry`);
    
    if (!expiryDateStr) return false; // 如果未设置过期时间，视为不过期
    
    // 比较当前时间和过期时间
    const expiryDate = new Date(expiryDateStr);
    const now = new Date();
    
    return now >= expiryDate;
  } catch (error) {
    console.error('[authUtils] 检查令牌过期出错:', error);
    return true; // 出错时视为已过期
  }
};

/**
 * 执行自动登录
 * @returns 自动登录是否成功
 */
export const performAutoLogin = async (): Promise<boolean> => {
  try {
    // 检查是否设置了自动登录
    const autoLoginUserId = localStorage.getItem('auto_login_user');
    if (!autoLoginUserId) return false;
    
    // 获取该用户的存储令牌
    const userPrefix = `user_${autoLoginUserId}_`;
    const userToken = localStorage.getItem(`${userPrefix}token`);
    
    if (!userToken) return false;
    
    // 检查令牌是否过期
    const expiryDateStr = localStorage.getItem(`${userPrefix}token_expiry`);
    if (expiryDateStr) {
      const expiryDate = new Date(expiryDateStr);
      const now = new Date();
      
      if (now >= expiryDate) {
        console.log('[authUtils] 自动登录失败: 令牌已过期');
        return false;
      }
    }
    
    // 设置为当前令牌
    localStorage.setItem('token', userToken);
    localStorage.setItem('activeUserId', autoLoginUserId);
    
    // 验证令牌有效性
    const response = await userApi.getCurrentUser();
    
    if (response.success && response.data) {
      console.log('[authUtils] 自动登录成功');
      return true;
    } else {
      // 清除无效的自动登录设置
      localStorage.removeItem('auto_login_user');
      
      console.log('[authUtils] 自动登录失败: 令牌无效');
      return false;
    }
  } catch (error) {
    console.error('[authUtils] 自动登录过程中发生错误:', error);
    return false;
  }
};

/**
 * 刷新用户的令牌过期时间
 * @param userId 用户ID
 */
export const refreshTokenExpiry = (userId: string): void => {
  try {
    const expiryDays = localStorage.getItem('token_expiry_days') || '30';
    const days = parseInt(expiryDays, 10);
    
    const userPrefix = `user_${userId}_`;
    const now = new Date();
    const expiryDate = new Date(now.getTime() + days * 24 * 60 * 60 * 1000);
    
    localStorage.setItem(`${userPrefix}token_expiry`, expiryDate.toISOString());
    console.log(`[authUtils] 令牌过期时间已更新为 ${expiryDate.toLocaleString()}`);
  } catch (error) {
    console.error('[authUtils] 更新令牌过期时间出错:', error);
  }
};

/**
 * 获取所有已保存的账号
 */
export const getSavedAccounts = (): Array<{
  userId: string;
  username: string;
  lastLogin: string;
  autoLogin: boolean;
}> => {
  try {
    const accountsData = localStorage.getItem('stored_accounts') || '[]';
    return JSON.parse(accountsData);
  } catch (error) {
    console.error('[authUtils] 获取保存的账号出错:', error);
    return [];
  }
}; 