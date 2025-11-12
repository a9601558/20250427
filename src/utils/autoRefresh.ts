/**
 * 智能自动刷新功能
 * 
 * 特点：
 * - 只在用户无活动时才刷新
 * - 检测用户交互（点击、滚动、键盘、触摸等）
 * - 保护答题过程不被打断
 */

let lastActivityTime = Date.now();
let refreshTimer: ReturnType<typeof setTimeout> | null = null;
let activityListeners: Array<() => void> = [];
let isQuizActive = false; // 答题保护标志

// 更新最后活动时间
const updateActivity = () => {
  lastActivityTime = Date.now();
  console.log('[AutoRefresh] 用户活动已更新，重置刷新计时器');
};

// 检查是否需要刷新
const checkAndRefresh = (maxInactiveTime: number) => {
  const now = Date.now();
  const timeSinceLastActivity = now - lastActivityTime;
  
  // 🔒 答题保护：如果正在答题，跳过刷新
  if (isQuizActive) {
    console.log('[AutoRefresh] 答题保护启用中，跳过刷新检查');
    refreshTimer = setTimeout(() => checkAndRefresh(maxInactiveTime), 60000);
    return;
  }
  
  if (timeSinceLastActivity >= maxInactiveTime) {
    console.log(`[AutoRefresh] 用户已无活动 ${Math.round(timeSinceLastActivity / 1000)} 秒，执行刷新`);
    window.location.reload();
  } else {
    const remainingTime = maxInactiveTime - timeSinceLastActivity;
    console.log(`[AutoRefresh] 用户活跃中，${Math.round(remainingTime / 1000)} 秒后再次检查`);
    
    // 设置下次检查（每分钟检查一次）
    refreshTimer = setTimeout(() => checkAndRefresh(maxInactiveTime), 60000);
  }
};

export const initAutoRefresh = (intervalMs: number) => {
  console.log(`[AutoRefresh] 初始化智能刷新，最大无活动时间: ${Math.round(intervalMs / 1000)} 秒`);
  
  // 重置最后活动时间
  lastActivityTime = Date.now();
  
  // 清理旧的监听器
  stopAutoRefresh();
  
  // 添加用户活动监听器
  const events = ['mousedown', 'mousemove', 'keypress', 'scroll', 'touchstart', 'click'];
  
  events.forEach(eventType => {
    const listener = () => updateActivity();
    window.addEventListener(eventType, listener, { passive: true });
    activityListeners.push(() => window.removeEventListener(eventType, listener));
  });
  
  // 开始定时检查
  refreshTimer = setTimeout(() => checkAndRefresh(intervalMs), 60000);
  
  console.log('[AutoRefresh] 用户活动监听已启动，将在有活动时保持页面不刷新');
};

/**
 * 停止自动刷新功能
 */
export const stopAutoRefresh = () => {
  // 清理定时器
  if (refreshTimer) {
    clearTimeout(refreshTimer);
    refreshTimer = null;
  }
  
  // 清理事件监听器
  activityListeners.forEach(cleanup => cleanup());
  activityListeners = [];
  
  console.log('[AutoRefresh] 自动刷新已停止');
};

/**
 * 手动重置活动时间（用于特殊场景，如答题时）
 */
export const resetActivityTime = () => {
  lastActivityTime = Date.now();
  console.log('[AutoRefresh] 活动时间已手动重置');
};

/**
 * 启动答题保护（防止答题期间刷新页面）
 */
export const trackQuizActivity = () => {
  isQuizActive = true;
  lastActivityTime = Date.now();
  console.log('[AutoRefresh] 答题活动追踪已启动，防止答题期间页面刷新');
};

/**
 * 停止答题保护
 */
export const stopQuizActivity = () => {
  isQuizActive = false;
  lastActivityTime = Date.now();
  console.log('[AutoRefresh] 答题活动已结束，恢复正常刷新检查');
};