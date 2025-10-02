import axios, { AxiosInstance, AxiosRequestConfig } from 'axios';
import { ApiResponse, BatchCountResponse } from '../types';

/**
 * 统一的HTTP客户端实现
 * 集成了缓存、重试、速率限制、请求去重等功能
 * 替代之前分散的多个API客户端实现
 */

interface CacheItem<T = any> {
  data: T;
  timestamp: number;
  expiresAt: number;
}

interface PendingRequest<T = any> {
  promise: Promise<T>;
  timestamp: number;
  controller: AbortController;
}

interface RequestOptions {
  cacheDuration?: number;   // 缓存持续时间（毫秒）
  skipCache?: boolean;      // 是否跳过缓存
  retries?: number;         // 重试次数
  retryDelay?: number;      // 初始重试延迟（毫秒）
  forceRefresh?: boolean;   // 强制刷新缓存
}

class UnifiedApiClient {
  private client: AxiosInstance;
  private cache: Map<string, CacheItem> = new Map();
  private pendingRequests: Map<string, PendingRequest> = new Map();
  private requestsPerMinute: Map<string, number[]> = new Map();
  private readonly maxRequestsPerMinute = 1600; // 每分钟最大请求数
  private readonly defaultCacheDuration = 30000; // 默认缓存30秒
  private currentUserId: string | null = null;

  constructor(baseURL = '/api') {
    this.client = axios.create({
      baseURL,
      timeout: 15000,
      headers: {
        'Content-Type': 'application/json'
      }
    });

    this.setupInterceptors();
    this.startCacheCleanup();
  }

  /**
   * 设置请求和响应拦截器
   */
  private setupInterceptors(): void {
    // 请求拦截器
    this.client.interceptors.request.use(
      (config) => {
        const token = localStorage.getItem('token');
        if (token && config.headers) {
          config.headers['Authorization'] = `Bearer ${token}`;
        }
        return config;
      },
      (error) => Promise.reject(error)
    );

    // 响应拦截器
    this.client.interceptors.response.use(
      (response) => response,
      (error) => {
        // 统一错误处理
        if (error.response?.status === 401) {
          // 清除认证信息
          localStorage.removeItem('token');
          localStorage.removeItem('activeUserId');
          
          // 清除API客户端的认证头
          this.setAuthHeader(null);
          this.setUserId(null);
          
          console.log('セッションが期限切れです。再度ログインしてください');
          
          // 触发全局认证过期事件，通知其他组件
          window.dispatchEvent(new CustomEvent('auth:expired', {
            detail: { reason: 'token_expired', timestamp: Date.now() }
          }));
          
        } else if (error.response?.status === 429) {
          console.warn('リクエストが多すぎます。しばらくお待ちください');
        } else if (error.response?.status === 502) {
          console.warn('[API] サーバーが一時的に利用できません (502 Bad Gateway)');
        } else if (error.response?.status >= 500) {
          console.warn('[API] サーバーエラーが発生しました:', error.response?.status);
        }
        return Promise.reject(error);
      }
    );
  }

  /**
   * 定期清理过期缓存
   */
  private startCacheCleanup(): void {
    setInterval(() => {
      const now = Date.now();
      for (const [key, item] of this.cache.entries()) {
        if (now > item.expiresAt) {
          this.cache.delete(key);
        }
      }
    }, 60000); // 每分钟清理一次
  }

  /**
   * 生成请求的缓存键
   */
  private getCacheKey(url: string, config?: AxiosRequestConfig): string {
    const method = config?.method || 'GET';
    const params = JSON.stringify(config?.params || {});
    const data = JSON.stringify(config?.data || {});
    const userId = this.currentUserId || 'anonymous';
    return `${userId}:${method}:${url}:${params}:${data}`;
  }

  /**
   * 检查请求速率限制
   */
  private checkRateLimit(url: string): boolean {
    const now = Date.now();
    const windowStart = now - 60000; // 1分钟窗口
    
    if (!this.requestsPerMinute.has(url)) {
      this.requestsPerMinute.set(url, []);
    }
    
    const requests = this.requestsPerMinute.get(url)!;
    
    // 移除超过1分钟的请求记录
    const recentRequests = requests.filter(time => time > windowStart);
    this.requestsPerMinute.set(url, recentRequests);
    
    // 检查是否超过限制
    if (recentRequests.length >= this.maxRequestsPerMinute) {
      console.warn(`[API] Rate limit exceeded for ${url}`);
      return false;
    }
    
    // 记录当前请求
    recentRequests.push(now);
    return true;
  }

  /**
   * 核心请求方法，带缓存、重试和速率限制
   */
  public async request<T = any>(
    url: string, 
    config?: AxiosRequestConfig,
    options?: RequestOptions
  ): Promise<T> {
    const {
      cacheDuration = this.defaultCacheDuration,
      skipCache = false,
      retries = 3,
      retryDelay = 300,
      forceRefresh = false
    } = options || {};
    
    const cacheKey = this.getCacheKey(url, config);
    const method = config?.method || 'GET';
    
    // 1. 检查缓存（仅对GET请求）
    if (method === 'GET' && !skipCache && !forceRefresh) {
      const cached = this.cache.get(cacheKey);
      if (cached && Date.now() < cached.expiresAt) {
        console.log(`[API] Cache hit for: ${url}`);
        return cached.data;
      }
    }

    // 2. 检查是否有相同的请求正在进行中
    if (this.pendingRequests.has(cacheKey)) {
      const pendingRequest = this.pendingRequests.get(cacheKey)!;
      if (Date.now() - pendingRequest.timestamp < 10000) {
        console.log(`[API] Reusing pending request for: ${url}`);
        return pendingRequest.promise;
      } else {
        pendingRequest.controller.abort();
        this.pendingRequests.delete(cacheKey);
      }
    }

    // 3. 检查速率限制
    if (!this.checkRateLimit(url)) {
      throw new Error('Rate limit exceeded');
    }

    // 4. 创建新请求
    const controller = new AbortController();
    
    const executeRequest = async (attempt: number = 0): Promise<T> => {
      try {
        const axiosConfig: AxiosRequestConfig = {
          ...config,
          signal: controller.signal,
          url,
        };
        
        console.log(`[API] Request ${attempt > 0 ? `(attempt ${attempt+1})` : ''} for: ${url}`);
        const response = await this.client.request<T>(axiosConfig);
        
        // 缓存响应（仅对GET请求）
        if (method === 'GET' && !skipCache) {
          this.cache.set(cacheKey, {
            data: response.data,
            timestamp: Date.now(),
            expiresAt: Date.now() + cacheDuration
          });
        }
        
        return response.data;
      } catch (error: any) {
        if (error.name === 'CanceledError' || error.name === 'AbortError') {
          throw error;
        }
        
        const isTooManyRequestsError = error.response?.status === 429;
        const isServerError = error.response?.status >= 500;
        const isBadGateway = error.response?.status === 502;
        
        // 对502错误减少重试次数，避免无效重试
        const maxRetries = isBadGateway ? Math.min(1, retries) : retries;
        const shouldRetry = (isTooManyRequestsError || isServerError) && attempt < maxRetries;
        
        if (shouldRetry) {
          const delay = isTooManyRequestsError 
            ? (error.response?.headers?.['retry-after'] * 1000 || 5000)
            : isBadGateway 
              ? Math.min(retryDelay * Math.pow(2, attempt), 5000) // 502错误限制最大延迟
              : retryDelay * Math.pow(2, attempt); // 指数退避
          
          console.log(`[API] Retrying ${url} after ${delay}ms (${attempt + 1}/${maxRetries})`);
          await new Promise(resolve => setTimeout(resolve, delay));
          return executeRequest(attempt + 1);
        }
        
        throw error;
      }
    };

    const requestPromise = executeRequest();
    
    // 记录正在进行的请求
    this.pendingRequests.set(cacheKey, {
      promise: requestPromise,
      timestamp: Date.now(),
      controller
    });

    try {
      const result = await requestPromise;
      this.pendingRequests.delete(cacheKey);
      return result;
    } catch (error) {
      this.pendingRequests.delete(cacheKey);
      throw error;
    }
  }

  /**
   * GET请求
   */
  public async get<T = any>(url: string, params?: any, options?: RequestOptions): Promise<T> {
    return this.request<T>(url, { method: 'GET', params }, options);
  }

  /**
   * POST请求
   */
  public async post<T = any>(url: string, data?: any, options?: RequestOptions): Promise<T> {
    return this.request<T>(url, { method: 'POST', data }, { ...options, skipCache: true });
  }

  /**
   * PUT请求
   */
  public async put<T = any>(url: string, data?: any, options?: RequestOptions): Promise<T> {
    return this.request<T>(url, { method: 'PUT', data }, { ...options, skipCache: true });
  }

  /**
   * DELETE请求
   */
  public async delete<T = any>(url: string, options?: RequestOptions): Promise<T> {
    return this.request<T>(url, { method: 'DELETE' }, { ...options, skipCache: true });
  }

  /**
   * 批量获取题目数量（解决性能问题）
   */
  public async getBatchQuestionCounts(questionSetIds: string[]): Promise<BatchCountResponse> {
    if (!Array.isArray(questionSetIds) || questionSetIds.length === 0) {
      return {
        success: false,
        data: {},
        error: '题库ID列表不能为空'
      };
    }

    try {
      const response = await this.post<BatchCountResponse>('/questions/batch-count', {
        questionSetIds
      }, {
        cacheDuration: 60000 // 批量查询结果缓存1分钟
      });

      return response;
    } catch (error: any) {
      console.error('[API] Batch count request failed:', error);
      return {
        success: false,
        data: {},
        error: error.message || '批量获取题目数量失败'
      };
    }
  }

  /**
   * 设置当前用户ID（用于缓存键的用户隔离）
   */
  public setUserId(userId: string | null): void {
    this.currentUserId = userId;
  }

  /**
   * 设置认证头
   */
  public setAuthHeader(token: string | null): void {
    if (token) {
      this.client.defaults.headers.common['Authorization'] = `Bearer ${token}`;
    } else {
      delete this.client.defaults.headers.common['Authorization'];
    }
  }

  /**
   * 清除所有缓存
   */
  public clearCache(): void {
    this.cache.clear();
    console.log('[API] All cache cleared');
  }

  /**
   * 清除特定URL的缓存
   */
  public clearCacheFor(url: string, config?: AxiosRequestConfig): void {
    const cacheKey = this.getCacheKey(url, config);
    this.cache.delete(cacheKey);
    console.log(`[API] Cache cleared for: ${url}`);
  }

  /**
   * 清除所有正在进行的请求
   */
  public abortAllRequests(): void {
    for (const [key, request] of this.pendingRequests.entries()) {
      request.controller.abort();
      this.pendingRequests.delete(key);
    }
    console.log('[API] All pending requests aborted');
  }

  /**
   * 获取缓存统计信息
   */
  public getCacheStats(): { size: number; keys: string[] } {
    return {
      size: this.cache.size,
      keys: Array.from(this.cache.keys())
    };
  }
}

// 创建单例实例
const apiClient = new UnifiedApiClient();

export default apiClient;
export { UnifiedApiClient };
export type { RequestOptions, ApiResponse, BatchCountResponse };