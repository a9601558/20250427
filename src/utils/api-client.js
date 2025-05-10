// Import the HTTP limiter
import { httpLimiter, monitorHttpRequest } from './loopPrevention';

// 添加全局请求计数和限制
let requestsInLastMinute = 0;
let lastRequestTimeResetAt = Date.now();

// Add retry and backoff configuration
const MAX_RETRIES = 3;
const RETRY_DELAY = 1000; // Initial retry delay in ms

// Get base API URL from environment or use default
const API_BASE_URL = process.env.REACT_APP_API_BASE_URL || '';

// 添加缓存系统
const requestCache = {};

// 清理过期缓存的定时器
setInterval(() => {
  const now = Date.now();
  Object.keys(requestCache).forEach(key => {
    if (requestCache[key].expiresAt < now) {
      delete requestCache[key];
    }
  });
}, 60000); // 每分钟清理一次

/**
 * 控制请求频率，避免429错误
 * @returns {boolean} 是否允许发送请求
 */
function canMakeRequest() {
  // 重置计数器（如果超过1分钟）
  const now = Date.now();
  if (now - lastRequestTimeResetAt > 60000) {
    requestsInLastMinute = 0;
    lastRequestTimeResetAt = now;
  }
  
  // 检查是否超过限制
  if (requestsInLastMinute >= 60) { // 每分钟最多60个请求
    console.warn('[API-Client] 请求频率过高，限制请求');
    return false;
  }
  
  // 增加计数
  requestsInLastMinute++;
  return true;
}

/**
 * 添加指数退避重试逻辑
 * @param {Function} fn 需要重试的函数
 * @param {number} retries 重试次数
 * @param {number} delay 延迟时间 (ms)
 * @returns {Promise} 函数执行结果
 */
async function retryWithBackoff(fn, retries = MAX_RETRIES, delay = RETRY_DELAY) {
  try {
    return await fn();
  } catch (error) {
    // 如果是429错误，使用服务器返回的Retry-After头信息
    if (error.status === 429 && error.headers && error.headers['retry-after']) {
      const retryAfter = parseInt(error.headers['retry-after'], 10) || 10;
      console.warn(`[API-Client] 收到429错误，等待${retryAfter}秒后重试`);
      await new Promise(resolve => setTimeout(resolve, retryAfter * 1000));
      return retryWithBackoff(fn, retries, delay * 2);
    }
    
    // 如果没有重试次数或不是网络错误，直接抛出
    if (retries <= 0 || 
       (error.status && error.status !== 408 && error.status !== 429 && error.status !== 503 && error.status !== 504)) {
      throw error;
    }
    
    // 否则等待后重试，并增加等待时间（指数退避）
    await new Promise(resolve => setTimeout(resolve, delay));
    return retryWithBackoff(fn, retries - 1, delay * 2);
  }
}

/**
 * API客户端
 */
const apiClient = {
  /**
   * 发送GET请求
   * @param {string} endpoint API端点
   * @param {Object} params URL参数
   * @param {Object} options 请求选项
   * @returns {Promise} 请求结果
   */
  async get(endpoint, params = {}, options = {}) {
    // 检查请求限制
    if (!httpLimiter.canMakeRequest() && !options.bypassRateLimit) {
      console.warn(`[API-Client] 请求被限制: ${endpoint}`);
      return { success: false, message: '请求过于频繁，请稍后再试' };
    }
    
    // 构建缓存键
    const cacheKey = `GET:${endpoint}:${JSON.stringify(params)}`;
    
    // 如果启用缓存并且缓存中有数据，直接返回
    const cacheDuration = options.cacheDuration !== undefined ? options.cacheDuration : 30000; // 默认30秒
    if (cacheDuration > 0 && requestCache[cacheKey] && requestCache[cacheKey].expiresAt > Date.now()) {
      console.log(`[API-Client] 使用缓存数据: ${endpoint}`);
      return requestCache[cacheKey].data;
    }
    
    // 构建URL
    let url = `${API_BASE_URL}${endpoint}`;
    
    // 如果有查询参数，添加到URL
    if (Object.keys(params).length > 0) {
      const queryString = Object.keys(params)
        .map(key => `${encodeURIComponent(key)}=${encodeURIComponent(params[key])}`)
        .join('&');
      url = `${url}?${queryString}`;
    }
    
    // 通过重试逻辑执行请求
    return retryWithBackoff(async () => {
      try {
        const response = await fetch(url, {
          method: 'GET',
          headers: {
            'Content-Type': 'application/json',
            'Accept': 'application/json',
            ...options.headers,
          },
          ...options.fetchOptions,
        });
        
        // 处理响应
        let data;
        try {
          data = await response.json();
        } catch (e) {
          data = { success: false, message: '无效的JSON响应' };
        }
        
        // 如果响应不成功，抛出错误
        if (!response.ok) {
          const error = new Error(data.message || `请求失败: ${response.status}`);
          error.status = response.status;
          error.headers = Object.fromEntries(response.headers.entries());
          error.data = data;
          throw error;
        }
        
        // 缓存结果
        if (cacheDuration > 0) {
          requestCache[cacheKey] = {
            data,
            expiresAt: Date.now() + cacheDuration
          };
        }
        
        return data;
      } catch (error) {
        console.error(`[API-Client] 请求失败: ${endpoint}`, error);
        throw error;
      }
    });
  },
  
  /**
   * 发送POST请求
   * @param {string} endpoint API端点
   * @param {Object} data 请求体数据
   * @param {Object} options 请求选项
   * @returns {Promise} 请求结果
   */
  async post(endpoint, data = {}, options = {}) {
    // 检查请求限制 - POST请求更可能修改数据，应该更严格控制
    if (!httpLimiter.canMakeRequest() && !options.bypassRateLimit) {
      console.warn(`[API-Client] 请求被限制: ${endpoint}`);
      return { success: false, message: '请求过于频繁，请稍后再试' };
    }
    
    // 构建URL
    const url = `${API_BASE_URL}${endpoint}`;
    
    // 通过重试逻辑执行请求
    return retryWithBackoff(async () => {
      try {
        const response = await fetch(url, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'Accept': 'application/json',
            ...options.headers,
          },
          body: JSON.stringify(data),
          ...options.fetchOptions,
        });
        
        // 处理响应
        let responseData;
        try {
          responseData = await response.json();
        } catch (e) {
          responseData = { success: false, message: '无效的JSON响应' };
        }
        
        // 如果响应不成功，抛出错误
        if (!response.ok) {
          const error = new Error(responseData.message || `请求失败: ${response.status}`);
          error.status = response.status;
          error.headers = Object.fromEntries(response.headers.entries());
          error.data = responseData;
          throw error;
        }
        
        return responseData;
      } catch (error) {
        console.error(`[API-Client] 请求失败: ${endpoint}`, error);
        throw error;
      }
    });
  },
  
  // 添加PUT, DELETE, PATCH等其他HTTP方法...
  
  /**
   * 清除特定缓存
   * @param {string} endpoint API端点
   * @param {Object} params URL参数
   */
  clearCache(endpoint, params = {}) {
    const cacheKey = `GET:${endpoint}:${JSON.stringify(params)}`;
    if (requestCache[cacheKey]) {
      delete requestCache[cacheKey];
      console.log(`[API-Client] 已清除缓存: ${endpoint}`);
    }
  },
  
  /**
   * 清除所有缓存
   */
  clearAllCache() {
    Object.keys(requestCache).forEach(key => delete requestCache[key]);
    console.log('[API-Client] 已清除所有缓存');
  }
};

export default apiClient; 