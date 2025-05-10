/**
 * 循环预防和请求限制工具
 * 
 * 这个工具文件包含防止API请求过多导致429错误的各种工具函数
 */

// 存储各种请求的计数和时间戳
const requestCounts: {[key: string]: number[]} = {};
const blockedUntil: {[key: string]: number} = {};

/**
 * 检测是否有潜在的循环请求
 * @param key 请求的唯一标识
 * @param maxCount 在时间窗口内允许的最大请求数
 * @param timeWindow 时间窗口(毫秒)
 * @returns 如果检测到潜在循环返回true
 */
export function detectLoop(key: string, maxCount: number = 5, timeWindow: number = 5000): boolean {
  const now = Date.now();
  
  // 初始化
  if (!requestCounts[key]) {
    requestCounts[key] = [];
  }
  
  // 清理旧请求
  requestCounts[key] = requestCounts[key].filter(time => now - time < timeWindow);
  
  // 添加当前请求
  requestCounts[key].push(now);
  
  // 检测是否超过阈值
  if (requestCounts[key].length > maxCount) {
    console.warn(`[LoopPrevention] 可能存在循环请求: ${key}, ${requestCounts[key].length} 次请求在 ${timeWindow/1000} 秒内`);
    
    // 设置阻塞
    const blockDuration = 30000; // 30秒阻塞
    blockedUntil[key] = now + blockDuration;
    
    // 清空请求计数，避免多次触发
    requestCounts[key] = [];
    
    return true;
  }
  
  return false;
}

/**
 * 检查给定类型的请求是否被阻塞
 * @param key 请求类型
 * @returns 如果被阻塞返回true
 */
export function isBlocked(key: string): boolean {
  const now = Date.now();
  if (blockedUntil[key] && blockedUntil[key] > now) {
    console.log(`[LoopPrevention] 请求被阻塞: ${key}, 还剩 ${Math.ceil((blockedUntil[key] - now)/1000)} 秒`);
    return true;
  }
  return false;
}

/**
 * 节流函数 - 确保特定类型的请求在给定的时间窗口内只能执行一次
 * @param key 请求类型
 * @param cooldownPeriod 冷却时间(毫秒)
 * @returns 如果允许请求返回true，否则false
 */
export function throttleContentFetch(key: string, cooldownPeriod: number = 3000): boolean {
  // 检查是否在阻塞期
  if (isBlocked(key)) {
    return false;
  }
  
  const now = Date.now();
  const lastRequestTime = requestCounts[`${key}_last`] ? requestCounts[`${key}_last`][0] : 0;
  
  // 检查是否在冷却期
  if (now - lastRequestTime < cooldownPeriod) {
    console.log(`[LoopPrevention] 请求被节流: ${key}, 冷却中 ${Math.ceil((cooldownPeriod - (now - lastRequestTime))/1000)} 秒`);
    return false;
  }
  
  // 更新最后请求时间
  requestCounts[`${key}_last`] = [now];
  return true;
}

/**
 * HTTP限流计数器 - 用于整体限制HTTP请求频率
 */
const httpRateLimiter = {
  requests: [] as number[],
  maxRequests: 60, // 每分钟最大请求数
  timeWindow: 60000, // 1分钟窗口
  
  /**
   * 检查是否允许新的HTTP请求
   * @returns 允许请求则返回true
   */
  canMakeRequest(): boolean {
    const now = Date.now();
    
    // 清理旧请求
    this.requests = this.requests.filter(time => now - time < this.timeWindow);
    
    // 检查是否超过限制
    if (this.requests.length >= this.maxRequests) {
      console.warn(`[HTTP限流] 请求频率过高: ${this.requests.length}/${this.maxRequests} 在${this.timeWindow/1000}秒内`);
      return false;
    }
    
    // 记录这次请求
    this.requests.push(now);
    return true;
  },
  
  /**
   * 重置计数器
   */
  reset(): void {
    this.requests = [];
  }
};

export const httpLimiter = httpRateLimiter;

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

/**
 * 创建一个防抖函数
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