import axios, { AxiosInstance, AxiosResponse } from 'axios';

interface ApiResponse<T> {
  success: boolean;
  data?: T;
  message?: string;
}

interface CacheOptions {
  cacheDuration?: number; // 缓存持续时间(毫秒)
  cacheKey?: string;     // 自定义缓存键
}

// 内存缓存存储
interface CacheItem {
  data: any;
  timestamp: number;
  expiresAt: number;
}

class ApiClient {
  private client: AxiosInstance;
  private cache: Map<string, CacheItem> = new Map();
  
  constructor(baseURL = '/api') {
    this.client = axios.create({
      baseURL,
      timeout: 15000,
      headers: {
        'Content-Type': 'application/json'
      }
    });
    
    // 添加请求拦截器
    this.client.interceptors.request.use((config) => {
      // 获取token并添加到请求头
      const token = localStorage.getItem('token');
      if (token) {
        config.headers.Authorization = `Bearer ${token}`;
      }
      return config;
    });
    
    // 添加响应拦截器
    this.client.interceptors.response.use(
      (response) => response,
      (error) => {
        // 处理token过期等错误
        if (error.response && error.response.status === 401) {
          localStorage.removeItem('token');
          // 可以在这里触发登出事件或重定向到登录页
        }
        return Promise.reject(error);
      }
    );
    
    // 定期清理过期缓存
    setInterval(() => this.cleanExpiredCache(), 60000); // 每分钟清理一次
  }
  
  // 生成缓存键
  private generateCacheKey(path: string, params?: any, options?: CacheOptions): string {
    if (options?.cacheKey) return options.cacheKey;
    const paramsString = params ? JSON.stringify(params) : '';
    return `${path}:${paramsString}`;
  }
  
  // 设置缓存
  private setCache(key: string, data: any, duration: number): void {
    const now = Date.now();
    this.cache.set(key, {
      data,
      timestamp: now,
      expiresAt: now + duration
    });
  }
  
  // 获取缓存
  private getCache(key: string): any | null {
    const cached = this.cache.get(key);
    if (!cached) return null;
    
    const now = Date.now();
    if (now > cached.expiresAt) {
      this.cache.delete(key);
      return null;
    }
    
    return cached.data;
  }
  
  // 清理过期缓存
  private cleanExpiredCache(): void {
    const now = Date.now();
    for (const [key, item] of this.cache.entries()) {
      if (now > item.expiresAt) {
        this.cache.delete(key);
      }
    }
  }
  
  // GET请求
  async get<T>(path: string, params?: any, options?: CacheOptions): Promise<ApiResponse<T>> {
    try {
      const cacheKey = this.generateCacheKey(path, params, options);
      
      // 检查缓存
      if (options?.cacheDuration) {
        const cached = this.getCache(cacheKey);
        if (cached) {
          console.log(`[ApiClient] 使用缓存数据: ${path}`);
          return cached;
        }
      }
      
      // 发送请求
      const response: AxiosResponse<ApiResponse<T>> = await this.client.get(path, { params });
      
      // 缓存响应
      if (options?.cacheDuration && response.data.success) {
        this.setCache(cacheKey, response.data, options.cacheDuration);
      }
      
      return response.data;
    } catch (error) {
      console.error(`[ApiClient] GET请求错误: ${path}`, error);
      return {
        success: false,
        message: error instanceof Error ? error.message : '请求失败'
      };
    }
  }
  
  // POST请求
  async post<T>(path: string, data?: any): Promise<ApiResponse<T>> {
    try {
      const response: AxiosResponse<ApiResponse<T>> = await this.client.post(path, data);
      return response.data;
    } catch (error) {
      console.error(`[ApiClient] POST请求错误: ${path}`, error);
      return {
        success: false,
        message: error instanceof Error ? error.message : '请求失败'
      };
    }
  }
  
  // PUT请求
  async put<T>(path: string, data?: any): Promise<ApiResponse<T>> {
    try {
      const response: AxiosResponse<ApiResponse<T>> = await this.client.put(path, data);
      return response.data;
    } catch (error) {
      console.error(`[ApiClient] PUT请求错误: ${path}`, error);
      return {
        success: false,
        message: error instanceof Error ? error.message : '请求失败'
      };
    }
  }
  
  // DELETE请求
  async delete<T>(path: string, params?: any): Promise<ApiResponse<T>> {
    try {
      const response: AxiosResponse<ApiResponse<T>> = await this.client.delete(path, { params });
      return response.data;
    } catch (error) {
      console.error(`[ApiClient] DELETE请求错误: ${path}`, error);
      return {
        success: false,
        message: error instanceof Error ? error.message : '请求失败'
      };
    }
  }
  
  // 清除所有缓存
  clearCache(): void {
    this.cache.clear();
    console.log('[ApiClient] 清除所有缓存');
  }
  
  // 清除特定路径的缓存
  clearPathCache(path: string): void {
    for (const key of this.cache.keys()) {
      if (key.startsWith(`${path}:`)) {
        this.cache.delete(key);
      }
    }
    console.log(`[ApiClient] 清除路径缓存: ${path}`);
  }
}

// 创建一个单例实例
const apiClient = new ApiClient();
export default apiClient; 