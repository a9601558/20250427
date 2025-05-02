import axios, { AxiosRequestConfig, AxiosError } from 'axios';
import { logger } from './logger';

/**
 * 先进的API客户端，提供：
 * 1. 基于内存的请求缓存
 * 2. 请求去重（相同URL的并发请求合并）
 * 3. 指数退避和重试机制
 * 4. 请求速率限制
 */

interface CacheItem<T> {
  data: T;
  timestamp: number;
  expiresAt: number;
}

interface PendingRequest<T> {
  promise: Promise<T>;
  controller: AbortController;
  timestamp: number;
}

interface RequestOptions {
  cacheDuration?: number;   // 缓存持续时间（毫秒）
  skipCache?: boolean;      // 是否跳过缓存
  retries?: number;         // 重试次数
  retryDelay?: number;      // 初始重试延迟（毫秒）
  forceRefresh?: boolean;   // 强制刷新缓存
}

interface ApiClientParams {
  [key: string]: string | number | boolean | null | undefined;
}

class ApiClient {
  private cache = new Map<string, CacheItem<unknown>>();
  private pendingRequests = new Map<string, PendingRequest<unknown>>();
  private requestsPerMinute = new Map<string, number[]>();
  private maxRequestsPerMinute = 50; // 每分钟最大请求数
  private defaultCacheDuration = 60000; // 默认缓存1分钟

  /**
   * 生成请求的缓存键
   */
  private getCacheKey(url: string, config?: AxiosRequestConfig): string {
    const method = config?.method?.toUpperCase() || 'GET';
    const params = config?.params ? JSON.stringify(config.params) : '';
    const data = config?.data ? JSON.stringify(config.data) : '';
    return `${method}:${url}:${params}:${data}`;
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
    const requests = this.requestsPerMinute.get(url)!.filter((time) => time > oneMinuteAgo);
    this.requestsPerMinute.set(url, requests);
    
    // 检查是否达到限制
    if (requests.length >= this.maxRequestsPerMinute) {
      logger.warn(`Rate limit reached for ${url}: ${requests.length} requests in the last minute`);
      return false;
    }
    
    // 添加当前请求时间戳
    requests.push(now);
    return true;
  }

  /**
   * 执行HTTP请求，带缓存、重试和速率限制
   */
  public async request<T>(
    url: string, 
    config?: AxiosRequestConfig,
    options?: RequestOptions
  ): Promise<T> {
    // 默认选项
    const {
      cacheDuration = this.defaultCacheDuration,
      skipCache = false,
      retries = 3,
      retryDelay = 300,
      forceRefresh = false,
    } = options || {};
    
    // 生成缓存键
    const cacheKey = this.getCacheKey(url, config);
    
    // 检查速率限制
    if (!this.checkRateLimit(url)) {
      // 如果有缓存，返回缓存数据
      const cached = this.cache.get(cacheKey);
      if (cached) {
        logger.info(`[API] Rate limited, returning cached data for: ${url}`);
        return cached.data as T;
      }
      
      // 否则等待一秒再重试
      await new Promise((resolve) => setTimeout(resolve, 1000));
    }

    // 1. 先检查缓存（除非指定跳过）
    if (!skipCache && !forceRefresh) {
      const cached = this.cache.get(cacheKey);
      const now = Date.now();
      
      if (cached && cached.expiresAt > now) {
        logger.info(`[API] Cache hit for: ${url}`);
        return cached.data as T;
      }
    }

    // 2. 检查是否有相同的请求正在进行中
    if (this.pendingRequests.has(cacheKey)) {
      const pendingRequest = this.pendingRequests.get(cacheKey)!;
      // 如果请求不超过10秒，复用正在进行的请求
      if (Date.now() - pendingRequest.timestamp < 10000) {
        logger.info(`[API] Reusing pending request for: ${url}`);
        return pendingRequest.promise as Promise<T>;
      } else {
        // 清理超时的请求
        pendingRequest.controller.abort();
        this.pendingRequests.delete(cacheKey);
      }
    }

    // 3. 创建新请求
    const controller = new AbortController();
    
    const executeRequest = async (attempt: number = 0): Promise<T> => {
      try {
        const axiosConfig: AxiosRequestConfig = {
          ...config,
          signal: controller.signal,
          url,
        };
        
        logger.info(`[API] Request ${attempt > 0 ? `(attempt ${attempt+1})` : ''} for: ${url}`);
        const response = await axios.request<T>(axiosConfig);
        
        // 缓存响应
        if (!skipCache) {
          this.cache.set(cacheKey, {
            data: response.data,
            timestamp: Date.now(),
            expiresAt: Date.now() + cacheDuration,
          });
        }
        
        return response.data;
      } catch (error) {
        const err = error as Error | AxiosError;
        // 如果是被我们的控制器中止的请求，不进行重试
        if (err.name === 'CanceledError' || err.name === 'AbortError') {
          throw err;
        }
        
        // 检查是否是 AxiosError
        const axiosError = error as AxiosError;
        // 如果是429错误，延长重试时间
        const retryAfter = axiosError.response?.headers?.['retry-after'];
        const isTooManyRequestsError = axiosError.response?.status === 429;
        
        // 如果还有重试次数，并且错误是可以重试的
        if (attempt < retries && (axiosError.response?.status === undefined || 
            axiosError.response?.status >= 500 || 
            isTooManyRequestsError)) {
          // 计算重试延迟（指数退避）
          const delay = isTooManyRequestsError && retryAfter
            ? parseInt(retryAfter, 10) * 1000
            : Math.min(retryDelay * Math.pow(2, attempt), 30000); // 最大延迟30秒
            
          logger.info(`[API] Retrying ${url} after ${delay}ms (${attempt+1}/${retries})`);
          await new Promise((resolve) => setTimeout(resolve, delay));
          return executeRequest(attempt + 1);
        }
        
        // 没有重试次数了，抛出错误
        throw err;
      }
    };

    // 记录正在进行的请求
    const requestPromise = executeRequest().finally(() => {
      this.pendingRequests.delete(cacheKey);
    });
    
    this.pendingRequests.set(cacheKey, {
      promise: requestPromise,
      controller,
      timestamp: Date.now(),
    });

    return requestPromise;
  }

  /**
   * 执行GET请求
   */
  public async get<T>(
    url: string, 
    params?: Record<string, ApiClientParams>, 
    options?: RequestOptions
  ): Promise<T> {
    return this.request<T>(url, { method: 'GET', params }, options);
  }

  /**
   * 执行POST请求
   */
  public async post<T>(
    url: string, 
    data?: Record<string, unknown>, 
    options?: RequestOptions
  ): Promise<T> {
    return this.request<T>(url, { method: 'POST', data }, { ...options, skipCache: true });
  }

  /**
   * 执行PUT请求
   */
  public async put<T>(
    url: string, 
    data?: Record<string, unknown>, 
    options?: RequestOptions
  ): Promise<T> {
    return this.request<T>(url, { method: 'PUT', data }, { ...options, skipCache: true });
  }

  /**
   * 执行DELETE请求
   */
  public async delete<T>(
    url: string, 
    options?: RequestOptions
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
          logger.warn('会话已过期，请重新登录');
          // 如果需要自动跳转到登录页
          // window.location.href = '/login';
        } else if (error.response?.status === 429) {
          logger.warn('请求过于频繁，请稍后再试');
        }
        
        return Promise.reject(error);
      }
    );
  }
}

// 创建单例实例
const apiClient = new ApiClient();

// 添加拦截器
apiClient.addRequestInterceptor();
apiClient.addResponseInterceptor();

export default apiClient; 
