/**
 * 循环预防和请求限制工具
 * 
 * 这个工具文件包含防止API请求过多导致429错误的各种工具函数
 */

// 用于跟踪特定模块的请求频率，防止无限循环
const loopPreventionMap = new Map<string, { count: number, timestamp: number }>();
const blockedModules = new Map<string, number>(); // 模块ID => 阻止到的时间戳

// 全局请求次数追踪和限制
interface HttpLimiter {
  canMakeRequest: () => boolean;
  recordRequest: () => void;
}

// 导出一个全局的HTTP限制器
export const httpLimiter: HttpLimiter = {
  canMakeRequest: () => true, // 默认实现，允许所有请求
  recordRequest: () => {} // 默认空实现
};

// 用于设置全局HTTP限制器
export const setHttpLimiter = (newLimiter: HttpLimiter): void => {
  httpLimiter.canMakeRequest = newLimiter.canMakeRequest;
  httpLimiter.recordRequest = newLimiter.recordRequest;
};

/**
 * 检测潜在的无限循环
 * @param moduleId 模块ID
 * @param maxCount 最大允许请求次数
 * @param timeWindowMs 时间窗口 (ms)
 * @returns 如果检测到潜在循环则返回true
 */
export const detectLoop = (moduleId: string, maxCount: number, timeWindowMs: number): boolean => {
  const now = Date.now();
  const data = loopPreventionMap.get(moduleId) || { count: 0, timestamp: now };
  
  // 检查是否已被阻止
  if (isBlocked(moduleId)) {
    return true;
  }
  
  // 检查是否需要重置计数器
  if (now - data.timestamp > timeWindowMs) {
    // 重置计数器
    loopPreventionMap.set(moduleId, { count: 1, timestamp: now });
    return false;
  }
  
  // 递增计数器
  const newCount = data.count + 1;
  loopPreventionMap.set(moduleId, { count: newCount, timestamp: data.timestamp });
  
  // 检查是否超过限制
  if (newCount > maxCount) {
    console.warn(`[loopPrevention] 检测到可能的无限循环: ${moduleId} 在 ${timeWindowMs}ms 内请求了 ${newCount} 次`);
    
    // 阻止该模块30秒
    blockedModules.set(moduleId, now + 30000);
    return true;
  }
  
  return false;
};

/**
 * 检查模块是否被阻止
 * @param moduleId 模块ID
 * @returns 如果模块被阻止则返回true
 */
export const isBlocked = (moduleId: string): boolean => {
  const blockedUntil = blockedModules.get(moduleId);
  if (!blockedUntil) return false;
  
  const now = Date.now();
  
  // 如果阻止时间已过，解除阻止
  if (now > blockedUntil) {
    blockedModules.delete(moduleId);
    return false;
  }
  
  return true;
};

// 节流函数: 一个有冷却时间的函数调用控制器
const throttleMap = new Map<string, number>();

/**
 * 节流函数 - 在指定时间内最多执行一次
 * @param id 唯一标识
 * @param cooldownMs 冷却时间 (ms)
 * @returns 是否允许执行
 */
export const throttleContentFetch = (id: string, cooldownMs: number): boolean => {
  const now = Date.now();
  const lastCall = throttleMap.get(id) || 0;
  
  // 检查是否在冷却期内
  if (now - lastCall < cooldownMs) {
    return false;
  }
  
  // 更新最后调用时间
  throttleMap.set(id, now);
  return true;
};

/**
 * 去抖动函数 - 在指定时间内的多次调用仅执行最后一次
 * @param func 需要防抖的函数
 * @param wait 等待时间(毫秒)
 */
export function debounce<T extends (...args: any[]) => any>(
  func: T, 
  wait: number = 300
): (...args: Parameters<T>) => void {
  let timeout: ReturnType<typeof setTimeout> | null = null;
  
  return function(this: any, ...args: Parameters<T>): void {
    const context = this;
    
    if (timeout !== null) {
      clearTimeout(timeout);
    }
    
    timeout = setTimeout(() => {
      func.apply(context, args);
    }, wait);
  };
}

/**
 * HTTP请求监控和拦截
 * 可以在axios或fetch请求中使用
 */
export function monitorHttpRequest(url: string): boolean {
  // 忽略静态资源请求
  if (url.match(/\.(css|js|png|jpg|jpeg|gif|svg|woff|woff2|ttf|eot)$/i)) {
    return true;
  }
  
  return httpLimiter.canMakeRequest();
}

// 导出一个简单的API客户端
export const apiClient = {
  get: async (url: string, params?: Record<string, any>, options?: Record<string, any>) => {
    // 实现HTTP请求的获取逻辑
    return { success: true, data: {} };
  },
  post: async (url: string, data?: Record<string, any>, options?: Record<string, any>) => {
    // 实现HTTP请求的提交逻辑
    return { success: true, data: {} };
  }
}; 