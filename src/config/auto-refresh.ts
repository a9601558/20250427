/**
 * 页面自动刷新配置
 * 
 * 该模块提供延长页面自动刷新时间间隔的功能
 */

// 默认刷新间隔（毫秒）
const DEFAULT_REFRESH_INTERVAL = 1800000; // 30分钟

// 最后活动时间
let lastActivityTime = Date.now();

// 刷新定时器
let refreshTimer: ReturnType<typeof setTimeout> | null = null;

/**
 * 初始化页面自动刷新功能
 * @param customInterval 可选的自定义刷新间隔（毫秒）
 */
export const initAutoRefresh = (customInterval?: number): void => {
  const interval = customInterval || DEFAULT_REFRESH_INTERVAL;
  
  // 更新最后活动时间的事件
  const updateLastActivityTime = () => {
    lastActivityTime = Date.now();
    console.log('用户活动已更新，重置刷新计时器');
  };
  
  // 为用户交互事件添加监听器
  window.addEventListener('mousemove', updateLastActivityTime);
  window.addEventListener('keydown', updateLastActivityTime);
  window.addEventListener('click', updateLastActivityTime);
  window.addEventListener('scroll', updateLastActivityTime);
  window.addEventListener('touchstart', updateLastActivityTime);
  
  // 设置定时器检查是否需要刷新
  const checkAndRefresh = () => {
    const now = Date.now();
    const timeSinceLastActivity = now - lastActivityTime;
    
    if (timeSinceLastActivity >= interval) {
      console.log(`页面已无活动 ${timeSinceLastActivity/1000} 秒，准备刷新`);
      // 页面刷新前执行一些清理工作
      localStorage.setItem('lastRefreshTime', now.toString());
      
      // 执行页面刷新
      window.location.reload();
    } else {
      // 尚未达到刷新条件，继续检查
      console.log(`页面活动检测: 上次活动距今 ${Math.round(timeSinceLastActivity/1000)} 秒，${Math.round((interval - timeSinceLastActivity)/1000)} 秒后可能刷新`);
      
      // 再次设置定时器
      if (refreshTimer) {
        clearTimeout(refreshTimer);
      }
      refreshTimer = setTimeout(checkAndRefresh, 60000); // 每分钟检查一次
    }
  };
  
  // 启动定时器
  refreshTimer = setTimeout(checkAndRefresh, 60000);
  
  console.log(`自动刷新功能已初始化，间隔设置为 ${interval/1000} 秒`);
};

/**
 * 停止自动刷新功能
 */
export const stopAutoRefresh = (): void => {
  if (refreshTimer) {
    clearTimeout(refreshTimer);
    refreshTimer = null;
  }
  
  // 移除事件监听器
  window.removeEventListener('mousemove', () => {});
  window.removeEventListener('keydown', () => {});
  window.removeEventListener('click', () => {});
  window.removeEventListener('scroll', () => {});
  window.removeEventListener('touchstart', () => {});
  
  console.log('自动刷新功能已停止');
};

export default {
  initAutoRefresh,
  stopAutoRefresh,
}; 
