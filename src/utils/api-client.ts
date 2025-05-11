import { monitorHttpRequest } from './loopPrevention';
import axios, { AxiosRequestConfig, AxiosError } from 'axios';

/**
 * 先进的API客户端，提供：
 * 1. 基于内存的请求缓存
 * 2. 请求去重（相同URL的并发请求合并）
 * 3. 指数退避和重试机制
 * 4. 请求速率限制
 */

interface CacheItem<T = any> {
  data: T;
  timestamp: number;
  expiresAt: number;
}

interface PendingRequest<T = any> {
  promise: Promise<T>;
  controller: AbortController;
  timestamp: number;
}

interface ApiOptions {
  cacheDuration?: number; // 以毫秒为单位的缓存时间
  headers?: Record<string, string>;
  retries?: number; // 失败后的重试次数
}

interface ApiResponse<T = any> {
  success: boolean;
  data?: T;
  message?: string;
  status?: number;
  [key: string]: any;
}

class ApiClient {
  private cache: Map<string, CacheItem> = new Map();
  private pendingRequests: Map<string, PendingRequest> = new Map();
  private requestsPerMinute: Map<string, number[]> = new Map();
  private maxRequestsPerMinute = 50; // 每分钟最大请求数
  private defaultCacheDuration = 60000; // 默认缓存1分钟
  private currentUserId: string | null = null; // 当前用户ID
  private defaultTimeout = 15000; // 默认请求超时时间：15秒
  private maxRetries = 5; // 最大重试次数上限
  private pendingReuseWindow = 10000; // 复用进行中请求的时间窗口（毫秒）

  /**
   * 生成请求的缓存键
   */
  private getCacheKey(url: string, config?: AxiosRequestConfig): string {
    const method = config?.method?.toUpperCase() || 'GET';
    
    // 对params进行排序后再序列化，避免因参数顺序不同导致缓存失效
    const params = config?.params 
      ? JSON.stringify(Object.fromEntries(Object.entries(config.params).sort()))
      : '';
      
    const data = config?.data ? JSON.stringify(config.data) : '';
    // 在缓存键中包含当前用户ID
    const userId = this.currentUserId ? `user:${this.currentUserId}:` : '';
    return `${userId}${method}:${url}:${params}:${data}`;
  }

  /**
   * 检查请求速率限制
   */
  private checkRateLimit(url: string): boolean {
    const now = Date.now();
    const oneMinuteAgo = now - 60000;
    
    // 初始化或清理过期的请求计数
    if (!this.requestsPerMinute.has(url)) {
      this.requestsPerMinute.set(url, []);
    }
    
    // 只保留一分钟内的请求
    const requests = this.requestsPerMinute.get(url)!.filter(time => time > oneMinuteAgo);
    this.requestsPerMinute.set(url, requests);
    
    // 检查是否达到限制
    if (requests.length >= this.maxRequestsPerMinute) {
      console.warn(`Rate limit reached for ${url}: ${requests.length} requests in the last minute`);
      return false;
    }
    
    // 添加当前请求时间戳
    requests.push(now);
    return true;
  }

  /**
   * 执行HTTP请求，带缓存、重试和速率限制
   */
  public async request<T = any>(
    url: string, 
    config?: AxiosRequestConfig,
    options?: {
      cacheDuration?: number;   // 缓存持续时间（毫秒）
      skipCache?: boolean;      // 是否跳过缓存
      retries?: number;         // 重试次数
      retryDelay?: number;      // 初始重试延迟（毫秒）
      forceRefresh?: boolean;   // 强制刷新缓存
    }
  ): Promise<T> {
    // 默认选项
    const {
      cacheDuration = this.defaultCacheDuration,
      skipCache: originalSkipCache = false,
      retries: originalRetries = 3,
      retryDelay = 300,
      forceRefresh = false
    } = options || {};
    
    // 限制最大重试次数
    const retries = Math.min(originalRetries, this.maxRetries);
    
    // 根据请求方法决定是否跳过缓存 - 只有GET方法可以使用缓存
    const method = config?.method?.toUpperCase() || 'GET';
    let skipCache = originalSkipCache || method !== 'GET';
    
    // 生成缓存键
    const cacheKey = this.getCacheKey(url, config);
    
    // 检查速率限制
    if (!this.checkRateLimit(url)) {
      // 如果有缓存，返回缓存数据
      const cached = this.cache.get(cacheKey);
      if (cached) {
        console.log(`[API] Rate limited, returning cached data for: ${url}`);
        return cached.data;
      }
      
      // 否则等待一秒再重试
      await new Promise(resolve => setTimeout(resolve, 1000));
    }

    // 1. 先检查缓存（除非指定跳过）
    if (!skipCache && !forceRefresh) {
      const cached = this.cache.get(cacheKey);
      const now = Date.now();
      
      if (cached && cached.expiresAt > now) {
        console.log(`[API] Cache hit for: ${url}`);
        return cached.data;
      }
    }

    // 2. 检查是否有相同的请求正在进行中
    if (this.pendingRequests.has(cacheKey)) {
      const pendingRequest = this.pendingRequests.get(cacheKey)!;
      // 使用可配置的时间窗口判断是否复用
      if (Date.now() - pendingRequest.timestamp < this.pendingReuseWindow) {
        console.log(`[API] Reusing pending request for: ${url}`);
        return pendingRequest.promise;
      } else {
        // 清理超时的请求
        pendingRequest.controller.abort();
        this.pendingRequests.delete(cacheKey);
      }
    }

    // 3. 创建新请求
    const controller = new AbortController();
    
    // 设置请求超时
    const timeoutId = setTimeout(() => {
      controller.abort(new Error('Request timeout'));
    }, this.defaultTimeout);
    
    const executeRequest = async (attempt: number = 0): Promise<T> => {
      try {
        // 请求前通过monitorHttpRequest检查是否允许发送请求
        if (!monitorHttpRequest(url)) {
          const error = new Error('请求过于频繁，被 limiter 拦截');
          // 检查是否有可用缓存
          const cached = this.cache.get(cacheKey);
          if (cached) {
            console.log(`[API] Request limited, returning cached data for: ${url}`);
            return cached.data;
          }
          throw error;
        }
        
        const axiosConfig: AxiosRequestConfig = {
          ...config,
          signal: controller.signal,
          url,
        };
        
        console.log(`[API] Request ${attempt > 0 ? `(attempt ${attempt+1})` : ''} for: ${url}`);
        const response = await axios.request<T>(axiosConfig);
        
        // 请求成功，清除超时计时器
        clearTimeout(timeoutId);
        
        // 缓存响应
        if (!skipCache) {
          this.cache.set(cacheKey, {
            data: response.data,
            timestamp: Date.now(),
            expiresAt: Date.now() + cacheDuration
          });
        }
        
        return response.data;
      } catch (error: any) {
        // 清除超时计时器
        clearTimeout(timeoutId);
        
        // 如果是被我们的控制器中止的请求，不进行重试
        if (error.name === 'CanceledError' || error.name === 'AbortError') {
          throw error;
        }
        
        // 如果是429错误，延长重试时间
        const retryAfter = error.response?.headers?.['retry-after'];
        const isTooManyRequestsError = error.response?.status === 429;
        
        // 安全解析retry-after头部值
        const retryDelaySeconds = Number(retryAfter);
        
        // 如果还有重试次数，并且错误是可以重试的
        if (attempt < retries && (error.response?.status >= 500 || isTooManyRequestsError)) {
          // 计算重试延迟（指数退避）- 增强了retry-after头部的处理
          const delay = isTooManyRequestsError && Number.isFinite(retryDelaySeconds)
            ? retryDelaySeconds * 1000
            : Math.min(retryDelay * Math.pow(2, attempt), 30000); // 最大延迟30秒
            
          console.log(`[API] Retrying ${url} after ${delay}ms (${attempt+1}/${retries})`);
          await new Promise(resolve => setTimeout(resolve, delay));
          return executeRequest(attempt + 1);
        }
        
        // 没有重试次数了，抛出错误
        throw error;
      }
    };

    // 记录正在进行的请求
    const requestPromise = executeRequest().finally(() => {
      this.pendingRequests.delete(cacheKey);
      clearTimeout(timeoutId);
    });
    
    this.pendingRequests.set(cacheKey, {
      promise: requestPromise,
      controller,
      timestamp: Date.now()
    });

    return requestPromise;
  }

  /**
   * 执行GET请求
   */
  public async get<T = any>(
    url: string, 
    params?: any, 
    options?: any
  ): Promise<T> {
    return this.request<T>(url, { method: 'GET', params }, options);
  }

  /**
   * 执行POST请求
   */
  public async post<T = any>(
    url: string, 
    data?: any, 
    options?: any
  ): Promise<T> {
    return this.request<T>(url, { method: 'POST', data }, { ...options, skipCache: true });
  }

  /**
   * 执行PUT请求
   */
  public async put<T = any>(
    url: string, 
    data?: any, 
    options?: any
  ): Promise<T> {
    return this.request<T>(url, { method: 'PUT', data }, { ...options, skipCache: true });
  }

  /**
   * 执行DELETE请求
   */
  public async delete<T = any>(
    url: string, 
    options?: any
  ): Promise<T> {
    return this.request<T>(url, { method: 'DELETE' }, { ...options, skipCache: true });
  }

  /**
   * 清除所有缓存
   */
  public clearCache(): void {
    this.cache.clear();
  }

  /**
   * 清除特定URL的缓存
   */
  public clearCacheFor(url: string, config?: AxiosRequestConfig): void {
    const cacheKey = this.getCacheKey(url, config);
    this.cache.delete(cacheKey);
  }

  /**
   * 设置请求头，如添加认证token
   */
  public setAuthHeader(token: string | null): void {
    if (token) {
      axios.defaults.headers.common['Authorization'] = `Bearer ${token}`;
    } else {
      delete axios.defaults.headers.common['Authorization'];
    }
  }

  /**
   * 增加API请求拦截器
   */
  public addRequestInterceptor(): void {
    axios.interceptors.request.use(
      (config) => {
        // 从localStorage获取token并添加到请求头
        const token = localStorage.getItem('token');
        if (token && config.headers) {
          config.headers['Authorization'] = `Bearer ${token}`;
        }
        return config;
      },
      (error) => {
        return Promise.reject(error);
      }
    );
  }

  /**
   * 增加响应拦截器，统一处理错误
   */
  public addResponseInterceptor(): void {
    axios.interceptors.response.use(
      (response) => {
        return response;
      },
      (error: AxiosError) => {
        // 统一错误处理
        if (error.response?.status === 401) {
          // 401错误，清除token并可能跳转到登录页
          localStorage.removeItem('token');
          console.log('会话已过期，请重新登录');
          // 如果需要自动跳转到登录页
          // window.location.href = '/login';
        } else if (error.response?.status === 429) {
          console.warn('请求过于频繁，请稍后再试');
        }
        
        return Promise.reject(error);
      }
    );
  }

  /**
   * 设置当前用户ID，用于区分不同用户的缓存和请求
   */
  public setUserId(userId: string | null): void {
    if (this.currentUserId !== userId) {
      console.log(`[ApiClient] 设置当前用户ID: ${userId || '无'}`);
      this.currentUserId = userId;
      // 更换用户ID时清除缓存，确保不会使用上一个用户的数据
      this.clearCache();
    }
  }

  /**
   * 获取当前用户ID
   */
  public getCurrentUserId(): string | null {
    return this.currentUserId;
  }
}

// 创建单例实例
const apiClient = new ApiClient();

// 添加拦截器
apiClient.addRequestInterceptor();
apiClient.addResponseInterceptor();

/**
 * 使用统一的类实例处理所有请求，不再使用独立的缓存
 */
const apiClientMethods = {
  /**
   * 发送GET请求
   * @param url 请求URL
   * @param params URL参数
   * @param options 请求选项
   */
  get: <T = any>(url: string, params?: Record<string, any>, options?: ApiOptions) =>
    apiClient.get<T>(url, params || {}, options || {}),

  /**
   * 发送POST请求
   * @param url 请求URL
   * @param data 请求体数据
   * @param options 请求选项
   */
  post: <T = any>(url: string, data?: Record<string, any>, options?: ApiOptions) =>
    apiClient.post<T>(url, data || {}, options || {}),

  /**
   * 发送PUT请求
   * @param url 请求URL
   * @param data 请求体数据
   * @param options 请求选项
   */
  put: <T = any>(url: string, data?: Record<string, any>, options?: ApiOptions) =>
    apiClient.put<T>(url, data || {}, options || {}),

  /**
   * 发送DELETE请求
   * @param url 请求URL
   * @param options 请求选项
   */
  delete: <T = any>(url: string, options?: ApiOptions) =>
    apiClient.delete<T>(url, options || {}),

  /**
   * 清除所有缓存
   */
  clearCache: () => apiClient.clearCache(),

  /**
   * 清除特定URL的缓存
   * @param url 要清除缓存的URL
   */
  clearCacheForUrl: (url: string) => apiClient.clearCacheFor(url),
  
  /**
   * 设置认证令牌头部
   * @param token 认证令牌，传入null则清除认证头
   */
  setAuthHeader: (token: string | null) => apiClient.setAuthHeader(token),
  
  /**
   * 设置当前用户ID
   * @param userId 用户ID，传入null则清除
   */
  setUserId: (userId: string | null) => apiClient.setUserId(userId)
};

export default apiClientMethods; 