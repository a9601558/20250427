import axios, { AxiosRequestConfig, AxiosResponse, AxiosError } from 'axios';
import { Question, User, QuestionSet, Purchase, RedeemCode, UserProgress, Option } from '../types';
import { AccessCheckResult } from './purchaseService';

// API基础URL
export const API_BASE_URL = '/api';

// 请求缓存
interface CacheItem {
  data: any;
  timestamp: number;
}

// 请求节流
interface ThrottleItem {
  timestamp: number;
  count: number;
}

// 高级API客户端
export class ApiClient {
  private baseURL: string;
  private cache: Map<string, CacheItem> = new Map();
  private throttleMap: Map<string, ThrottleItem> = new Map();
  private defaultCacheDuration = 60000; // 默认缓存1分钟
  private defaultThrottleTime = 2000; // 默认2秒内不重复请求
  private defaultRetries = 2; // 默认重试次数
  
  constructor(baseURL: string = '') {
    this.baseURL = baseURL || '';
    
    // 定期清理过期缓存，防止内存泄漏
    setInterval(() => this.cleanCache(), 300000); // 每5分钟清理一次
  }
  
  private getCacheKey(endpoint: string, params?: any): string {
    return `${endpoint}:${params ? JSON.stringify(params) : 'no-params'}`;
  }
  
  private cleanCache() {
    const now = Date.now();
    const expiredKeys: string[] = [];
    
    this.cache.forEach((item, key) => {
      if (now - item.timestamp > this.defaultCacheDuration * 2) {
        expiredKeys.push(key);
      }
    });
    
    expiredKeys.forEach(key => this.cache.delete(key));
    
    // 同时清理节流记录
    const expiredThrottleKeys: string[] = [];
    this.throttleMap.forEach((item, key) => {
      if (now - item.timestamp > this.defaultThrottleTime * 5) {
        expiredThrottleKeys.push(key);
      }
    });
    
    expiredThrottleKeys.forEach(key => this.throttleMap.delete(key));
    
    console.log(`[API] 清理了 ${expiredKeys.length} 个过期缓存和 ${expiredThrottleKeys.length} 个节流记录`);
  }
  
  private shouldThrottle(key: string, throttleTime: number = this.defaultThrottleTime): boolean {
    const now = Date.now();
    const throttleItem = this.throttleMap.get(key);
    
    if (!throttleItem) {
      this.throttleMap.set(key, { timestamp: now, count: 1 });
      return false;
    }
    
    // 检查是否在节流时间内
    if (now - throttleItem.timestamp < throttleTime) {
      // 在节流时间内，检查频率
      throttleItem.count++;
      if (throttleItem.count > 2) {
        // 短时间内请求超过2次，应该节流
        return true;
      }
    } else {
      // 更新时间戳和计数
      throttleItem.timestamp = now;
      throttleItem.count = 1;
    }
    
    return false;
  }
  
  private withAuthHeader(config: AxiosRequestConfig = {}): AxiosRequestConfig {
    const token = localStorage.getItem('token');
    
    if (!token) return config;
    
    return {
      ...config,
      headers: {
        ...config.headers,
        Authorization: `Bearer ${token}`
      }
    };
  }
  
  // 高级请求方法，支持缓存、节流和重试
  async request<T = any>(
    method: string, 
    endpoint: string, 
    data?: any, 
    options: {
      cacheDuration?: number; // 缓存持续时间（毫秒），0表示不缓存
      throttleTime?: number; // 节流时间（毫秒），0表示不节流
      retries?: number; // 重试次数
      retryDelay?: number; // 重试延迟（毫秒）
      bypassCache?: boolean; // 是否绕过缓存
    } = {}
  ): Promise<{success: boolean, data?: T, message?: string}> {
    const { 
      cacheDuration = this.defaultCacheDuration,
      throttleTime = this.defaultThrottleTime,
      retries = this.defaultRetries,
      retryDelay = 1000,
      bypassCache = false
    } = options;
    
    const url = `${this.baseURL}${endpoint}`;
    const cacheKey = this.getCacheKey(endpoint, data);
    const throttleKey = `${method}:${cacheKey}`;
    
    // 对GET请求使用缓存
    if (method === 'GET' && cacheDuration > 0 && !bypassCache) {
      const cachedItem = this.cache.get(cacheKey);
      if (cachedItem && (Date.now() - cachedItem.timestamp < cacheDuration)) {
        console.log(`[API] 使用缓存: ${endpoint}`);
        return {
          success: true,
          data: cachedItem.data
        };
      }
    }
    
    // 对所有请求进行节流
    if (throttleTime > 0 && this.shouldThrottle(throttleKey, throttleTime)) {
      console.log(`[API] 请求被节流: ${endpoint}`);
      
      // 如果有缓存，即使过期也返回
      const cachedItem = this.cache.get(cacheKey);
      if (cachedItem) {
        console.log(`[API] 请求被节流，返回过期缓存: ${endpoint}`);
        return {
          success: true,
          data: cachedItem.data
        };
      }
      
      return {
        success: false,
        message: '请求频率过高，请稍后再试'
      };
    }
    
    let attempt = 0;
    let lastError: any;
    
    while (attempt <= retries) {
      try {
        const config = this.withAuthHeader({
          method,
          url,
          ...(method === 'GET' 
            ? { params: data } 
            : { data }
          )
        });
        
        const response: AxiosResponse = await axios(config);
        
        // 缓存响应数据
        if (method === 'GET' && cacheDuration > 0) {
          this.cache.set(cacheKey, {
            data: response.data,
            timestamp: Date.now()
          });
        }
        
        return {
          success: true,
          data: response.data
        };
      } catch (error: any) {
        lastError = error;
        attempt++;
        
        // 对特定错误进行重试，比如网络错误或429
        const status = error.response?.status;
        const isNetworkError = !error.response;
        const isRateLimitError = status === 429;
        const isServerError = status >= 500;
        
        if ((isNetworkError || isRateLimitError || isServerError) && attempt <= retries) {
          // 指数退避重试
          const delay = retryDelay * Math.pow(2, attempt - 1);
          console.log(`[API] 请求失败 (${method} ${endpoint})，第 ${attempt} 次重试，等待 ${delay}ms...`);
          await new Promise(resolve => setTimeout(resolve, delay));
          continue;
        }
        
        // 连续遇到429，说明可能存在频率问题，增加节流
        if (isRateLimitError) {
          const throttleItem = this.throttleMap.get(throttleKey) || { timestamp: Date.now(), count: 0 };
          throttleItem.count += 2; // 增加计数，强制节流
          this.throttleMap.set(throttleKey, throttleItem);
        }
        
        break;
      }
    }
    
    // 所有重试都失败
    console.error(`[API] 请求失败 (${method} ${endpoint})，已重试 ${attempt} 次`, lastError);
    
    return {
      success: false,
      message: lastError.response?.data?.message || lastError.message || '请求失败，请稍后再试'
    };
  }
  
  async get<T = any>(endpoint: string, params?: any, options = {}) {
    return this.request<T>('GET', endpoint, params, options);
  }
  
  async post<T = any>(endpoint: string, data?: any, options = {}) {
    return this.request<T>('POST', endpoint, data, options);
  }
  
  async put<T = any>(endpoint: string, data?: any, options = {}) {
    return this.request<T>('PUT', endpoint, data, options);
  }
  
  async delete<T = any>(endpoint: string, params?: any, options = {}) {
    return this.request<T>('DELETE', endpoint, params, options);
  }
  
  async patch<T = any>(endpoint: string, data?: any, options = {}) {
    return this.request<T>('PATCH', endpoint, data, options);
  }
}

// 创建API客户端实例
export const apiClient = new ApiClient();

// API响应接口
interface ApiResponse<T> {
  success: boolean;
  data?: T;
  message?: string;
  error?: string;
}

// 处理API响应
const handleResponse = <T>(response: any): ApiResponse<T> => {
  return response.data as ApiResponse<T>;
};

// 用户API服务
export const userService = {
  // 用户登录
  async login(username: string, password: string): Promise<ApiResponse<{ user: User; token: string }>> {
    try {
      const response = await apiClient.post('/users/login', { username, password });
      return handleResponse<{ user: User; token: string }>(response);
    } catch (error: any) {
      return {
        success: false,
        message: error.message,
        error: error.error
      };
    }
  },

  // 用户注册
  async register(userData: Partial<User>): Promise<ApiResponse<{ user: User; token: string }>> {
    try {
      const response = await apiClient.post('/users/register', userData);
      return handleResponse<{ user: User; token: string }>(response);
    } catch (error: any) {
      return {
        success: false,
        message: error.message,
        error: error.error
      };
    }
  },

  // 获取当前用户信息
  async getCurrentUser(): Promise<ApiResponse<User>> {
    try {
      const response = await apiClient.get('/users/profile');
      return handleResponse<User>(response);
    } catch (error: any) {
      return {
        success: false,
        message: error.message,
        error: error.error
      };
    }
  },

  // 更新用户信息
  async updateUser(userId: string, userData: Partial<User>): Promise<ApiResponse<User>> {
    try {
      const response = await apiClient.put(`/users/${userId}`, userData);
      return handleResponse<User>(response);
    } catch (error: any) {
      return {
        success: false,
        message: error.message,
        error: error.error
      };
    }
  },

  // 获取所有用户 (仅管理员)
  async getAllUsers(): Promise<ApiResponse<User[]>> {
    try {
      const response = await apiClient.get('/users');
      return handleResponse<User[]>(response);
    } catch (error: any) {
      return {
        success: false,
        message: error.message,
        error: error.error
      };
    }
  },

  // 删除用户 (仅管理员)
  async deleteUser(userId: string): Promise<ApiResponse<void>> {
    try {
      const response = await apiClient.delete(`/users/${userId}`);
      return handleResponse<void>(response);
    } catch (error: any) {
      return {
        success: false,
        message: error.message,
        error: error.error
      };
    }
  },
  
  // 更新用户角色 (仅管理员)
  async updateUserRole(userId: string, isAdmin: boolean): Promise<ApiResponse<User>> {
    try {
      const response = await apiClient.put(`/users/${userId}/role`, { isAdmin });
      return handleResponse<User>(response);
    } catch (error: any) {
      return {
        success: false,
        message: error.message,
        error: error.error
      };
    }
  }
};

// 题库API服务
export const questionSetService = {
  // 获取所有题库
  async getAllQuestionSets(): Promise<ApiResponse<QuestionSet[]>> {
    try {
      const response = await apiClient.get('/question-sets');
      return handleResponse<QuestionSet[]>(response);
    } catch (error: any) {
      return {
        success: false,
        message: error.message,
        error: error.error
      };
    }
  },

  // 按分类获取题库
  async getQuestionSetsByCategory(category: string): Promise<ApiResponse<QuestionSet[]>> {
    try {
      const response = await apiClient.get(`/question-sets/by-category/${category}`);
      return handleResponse<QuestionSet[]>(response);
    } catch (error: any) {
      return {
        success: false,
        message: error.message,
        error: error.error
      };
    }
  },

  // 获取所有分类
  async getAllCategories(): Promise<ApiResponse<string[]>> {
    try {
      const response = await apiClient.get('/question-sets/categories');
      return handleResponse<string[]>(response);
    } catch (error: any) {
      return {
        success: false,
        message: error.message,
        error: error.error
      };
    }
  },

  // 获取单个题库详情
  async getQuestionSetById(id: string): Promise<ApiResponse<QuestionSet>> {
    try {
      const response = await apiClient.get(`/question-sets/${id}`);
      return handleResponse<QuestionSet>(response);
    } catch (error: any) {
      return {
        success: false,
        message: error.message,
        error: error.error
      };
    }
  },
  
  // 创建题库 (仅管理员)
  async createQuestionSet(questionSetData: Partial<QuestionSet>): Promise<ApiResponse<QuestionSet>> {
    try {
      const response = await apiClient.post('/question-sets', questionSetData);
      return handleResponse<QuestionSet>(response);
    } catch (error: any) {
      return {
        success: false,
        message: error.message,
        error: error.error
      };
    }
  },
  
  // 更新题库 (仅管理员)
  async updateQuestionSet(id: string, questionSetData: Partial<QuestionSet>): Promise<ApiResponse<QuestionSet>> {
    try {
      const response = await apiClient.put(`/question-sets/${id}`, questionSetData);
      return handleResponse<QuestionSet>(response);
    } catch (error: any) {
      return {
        success: false,
        message: error.message,
        error: error.error
      };
    }
  },
  
  // 删除题库 (仅管理员)
  async deleteQuestionSet(id: string): Promise<ApiResponse<void>> {
    try {
      const response = await apiClient.delete(`/question-sets/${id}`);
      return handleResponse<void>(response);
    } catch (error: any) {
      return {
        success: false,
        message: error.message,
        error: error.error
      };
    }
  },
  
  // 批量上传题库 (仅管理员)
  async uploadQuestionSets(questionSets: Partial<QuestionSet>[]): Promise<ApiResponse<QuestionSet[]>> {
    try {
      const response = await apiClient.post('/question-sets/upload', { questionSets });
      return handleResponse<QuestionSet[]>(response);
    } catch (error: any) {
      return {
        success: false,
        message: error.message,
        error: error.error
      };
    }
  },
  
  // 获取精选题库
  async getFeaturedQuestionSets(): Promise<ApiResponse<QuestionSet[]>> {
    try {
      const response = await apiClient.get('/question-sets/featured');
      return handleResponse<QuestionSet[]>(response);
    } catch (error: any) {
      return {
        success: false,
        message: error.message,
        error: error.error
      };
    }
  },
  
  // 设置精选题库 (仅管理员)
  async setFeaturedQuestionSet(id: string, isFeatured: boolean, featuredCategory?: string): Promise<ApiResponse<QuestionSet>> {
    try {
      const response = await apiClient.put(`/question-sets/${id}/featured`, { isFeatured, featuredCategory });
      return handleResponse<QuestionSet>(response);
    } catch (error: any) {
      return {
        success: false,
        message: error.message,
        error: error.error
      };
    }
  },

  // 获取用户进度
  async getUserProgress(): Promise<ApiResponse<Record<string, UserProgress>>> {
    try {
      const response = await apiClient.get('/user-progress/stats');
      const data = response.data.data;
      
      // 转换数据格式，添加数据校验
      const formattedData: Record<string, UserProgress> = {};
      data.forEach((progress: any) => {
        // 数据校验
        if (!progress.questionSetId || !progress.questionSet) {
          console.warn('Invalid progress data:', progress);
          return;
        }
        
        formattedData[progress.questionSetId] = {
          id: progress.id,
          userId: progress.userId,
          questionSetId: progress.questionSetId,
          questionId: progress.questionId,
          isCorrect: progress.isCorrect,
          timeSpent: progress.timeSpent || 0,
          completedQuestions: progress.completedQuestions || 0,
          totalQuestions: progress.totalQuestions || 0,
          correctAnswers: progress.correctAnswers || 0,
          lastAccessed: progress.lastAccessed || new Date(0).toISOString(),
          title: progress.questionSet?.title,
          totalTimeSpent: progress.totalTimeSpent || 0,
          averageTimeSpent: progress.averageTimeSpent || 0,
          accuracy: progress.accuracy || 0
        };
      });
      
      return {
        success: true,
        data: formattedData
      };
    } catch (error: any) {
      return {
        success: false,
        message: error.message,
        error: error.error
      };
    }
  }
};

// 题目API服务
export const questionService = {
  // 获取题库中的所有题目
  async getQuestionsByQuestionSetId(questionSetId: string): Promise<ApiResponse<Question[]>> {
    try {
      const response = await apiClient.get(`/questions?questionSetId=${questionSetId}&include=options`);
      return handleResponse<Question[]>(response);
    } catch (error: any) {
      return {
        success: false,
        message: error.message,
        error: error.error
      };
    }
  },
  
  // 添加题目到题库 (仅管理员)
  async addQuestion(questionSetId: string, question: Partial<Question>): Promise<ApiResponse<Question>> {
    try {
      const response = await apiClient.post('/questions', { ...question, questionSetId });
      return handleResponse<Question>(response);
    } catch (error: any) {
      return {
        success: false,
        message: error.message,
        error: error.error
      };
    }
  },
  
  // 更新题目 (仅管理员)
  async updateQuestion(questionId: string, question: Partial<Question>): Promise<ApiResponse<Question>> {
    try {
      const response = await apiClient.put(`/questions/${questionId}`, question);
      return handleResponse<Question>(response);
    } catch (error: any) {
      return {
        success: false,
        message: error.message,
        error: error.error
      };
    }
  },
  
  // 删除题目 (仅管理员)
  async deleteQuestion(questionId: string): Promise<ApiResponse<void>> {
    try {
      const response = await apiClient.delete(`/questions/${questionId}`);
      return handleResponse<void>(response);
    } catch (error: any) {
      return {
        success: false,
        message: error.message,
        error: error.error
      };
    }
  },
  
  // 批量上传题目 (仅管理员)
  async uploadQuestions(questionSetId: string, questions: Partial<Question>[]): Promise<ApiResponse<Question[]>> {
    try {
      const response = await apiClient.post('/questions/upload', { questionSetId, questions });
      return handleResponse<Question[]>(response);
    } catch (error: any) {
      return {
        success: false,
        message: error.message,
        error: error.error
      };
    }
  },
  
  // 添加选项
  async addOption(questionId: string, optionData: Partial<Option>): Promise<ApiResponse<Option>> {
    try {
      const response = await apiClient.post(`/questions/${questionId}/options`, optionData);
      return handleResponse<Option>(response);
    } catch (error: any) {
      return {
        success: false,
        message: error.message,
        error: error.error
      };
    }
  },
  
  // 更新选项
  async updateOption(optionId: string, optionData: Partial<Option>): Promise<ApiResponse<Option>> {
    try {
      const response = await apiClient.put(`/options/${optionId}`, optionData);
      return handleResponse<Option>(response);
    } catch (error: any) {
      return {
        success: false,
        message: error.message,
        error: error.error
      };
    }
  },
  
  // 删除选项
  async deleteOption(optionId: string): Promise<ApiResponse<void>> {
    try {
      const response = await apiClient.delete(`/options/${optionId}`);
      return handleResponse<void>(response);
    } catch (error: any) {
      return {
        success: false,
        message: error.message,
        error: error.error
      };
    }
  },
  
  // 批量添加选项
  async bulkAddOptions(questionId: string, options: Partial<Option>[]): Promise<ApiResponse<Option[]>> {
    try {
      const response = await apiClient.post(`/questions/${questionId}/options/bulk`, { options });
      return handleResponse<Option[]>(response);
    } catch (error: any) {
      return {
        success: false,
        message: error.message,
        error: error.error
      };
    }
  }
};

// 用户进度API服务
export const userProgressService = {
  // 获取用户的进度数据
  getUserProgress: async () => {
    try {
      const response = await apiClient.get('/user-progress');
      return response.data;
    } catch (error) {
      console.error('获取用户进度失败:', error);
      return { success: false, message: '获取用户进度失败' };
    }
  },
  
  // 获取用户的所有进度记录
  getUserProgressRecords: async () => {
    try {
      const response = await apiClient.get('/user-progress/records');
      return response.data;
    } catch (error) {
      console.error('获取用户进度记录失败:', error);
      return { success: false, message: '获取用户进度记录失败' };
    }
  },
  
  // 获取用户的历史记录
  getUserHistory: async () => {
    try {
      const response = await apiClient.get('/user-progress/history');
      return response.data;
    } catch (error) {
      console.error('获取用户历史记录失败:', error);
      return { success: false, message: '获取用户历史记录失败' };
    }
  },
  
  // 获取用户的统计数据
  getUserStats: async () => {
    try {
      const response = await apiClient.get('/user-progress/stats');
      return response.data;
    } catch (error) {
      console.error('获取用户统计数据失败:', error);
      return { success: false, message: '获取用户统计数据失败' };
    }
  },
  
  // 根据题库ID获取进度
  getProgressByQuestionSetId: async (questionSetId: string) => {
    try {
      const response = await apiClient.get(`/user-progress/${questionSetId}`);
      return response.data;
    } catch (error) {
      console.error(`获取题库${questionSetId}的进度失败:`, error);
      return { success: false, message: '获取题库进度失败' };
    }
  },
  
  // 更新进度
  updateProgress: async (progress: Partial<UserProgress>) => {
    try {
      const response = await apiClient.post('/user-progress/update', progress);
      return response.data;
    } catch (error) {
      console.error('更新进度失败:', error);
      return { success: false, message: '更新进度失败' };
    }
  },

  // 保存答题进度
  saveProgress: async (data: {
    questionId: string;
    questionSetId: string;
    selectedOption: string | string[];
    isCorrect: boolean;
    timeSpent: number;
  }) => {
    try {
      const response = await apiClient.post('/user-progress/save', data);
      return response.data;
    } catch (error) {
      console.error('保存答题进度失败:', error);
      return { success: false, message: '保存答题进度失败' };
    }
  }
};

// 购买API服务
export const purchaseService = {
  // 创建购买
  async createPurchase(questionSetId: string, paymentMethod: string, amount: number): Promise<ApiResponse<Purchase>> {
    try {
      const response = await apiClient.post('/purchases', { questionSetId, paymentMethod, amount });
      const purchase = response.data.data;
      // 确保返回的数据使用正确的属性名
      if (purchase.questionSet) {
        purchase.purchaseQuestionSet = purchase.questionSet;
        delete purchase.questionSet;
      }
      return {
        success: true,
        data: purchase
      };
    } catch (error: any) {
      return {
        success: false,
        message: error.message,
        error: error.error
      };
    }
  },
  
  // 获取用户的所有购买
  async getUserPurchases(): Promise<ApiResponse<Purchase[]>> {
    try {
      const response = await apiClient.get('/purchases');
      const purchases = response.data.data;
      // 确保返回的数据使用正确的属性名
      purchases.forEach((purchase: any) => {
        if (purchase.questionSet) {
          purchase.purchaseQuestionSet = purchase.questionSet;
          delete purchase.questionSet;
        }
      });
      return {
        success: true,
        data: purchases
      };
    } catch (error: any) {
      return {
        success: false,
        message: error.message,
        error: error.error
      };
    }
  },
  
  // 检查用户是否有权限访问题库
  async checkAccess(questionSetId: string): Promise<ApiResponse<AccessCheckResult>> {
    try {
      const response = await apiClient.get(`/purchases/check/${questionSetId}`);
      return handleResponse<AccessCheckResult>(response);
    } catch (error: any) {
      return {
        success: false,
        message: error.message,
        error: error.error
      };
    }
  },

  // 获取购买详情
  async getPurchaseById(purchaseId: string): Promise<ApiResponse<Purchase>> {
    try {
      const response = await apiClient.get(`/purchases/${purchaseId}`);
      return handleResponse<Purchase>(response);
    } catch (error: any) {
      return {
        success: false,
        message: error.message,
        error: error.error
      };
    }
  },

  // 取消购买
  async cancelPurchase(purchaseId: string): Promise<ApiResponse<Purchase>> {
    try {
      const response = await apiClient.post(`/purchases/${purchaseId}/cancel`);
      return handleResponse<Purchase>(response);
    } catch (error: any) {
      return {
        success: false,
        message: error.message,
        error: error.error
      };
    }
  },

  // 延长购买有效期
  async extendPurchase(purchaseId: string, months: number): Promise<ApiResponse<Purchase>> {
    try {
      const response = await apiClient.post(`/purchases/${purchaseId}/extend`, { months });
      return handleResponse<Purchase>(response);
    } catch (error: any) {
      return {
        success: false,
        message: error.message,
        error: error.error
      };
    }
  },
  
  // 获取用户已兑换的题库记录
  async getUserRedeemCodes(): Promise<ApiResponse<RedeemCode[]>> {
    try {
      const response = await apiClient.get('/redeem-codes/user');
      const redeemCodes = response.data.data;
      // 确保返回的数据使用正确的属性名
      redeemCodes.forEach((code: any) => {
        if (code.questionSet) {
          code.redeemQuestionSet = code.questionSet;
          delete code.questionSet;
        }
      });
      return {
        success: true,
        data: redeemCodes
      };
    } catch (error: any) {
      return {
        success: false,
        message: error.message,
        error: error.error
      };
    }
  }
};

// 兑换码API服务
export const redeemCodeService = {
  // 兑换代码
  async redeemCode(code: string): Promise<ApiResponse<{purchase: Purchase; questionSet: QuestionSet}>> {
    try {
      const response = await apiClient.post('/redeem-codes/redeem', { code });
      return handleResponse<{purchase: Purchase; questionSet: QuestionSet}>(response);
    } catch (error: any) {
      return {
        success: false,
        message: error.message,
        error: error.error
      };
    }
  },
  
  // 生成兑换码 (仅管理员)
  async generateRedeemCodes(questionSetId: string, validityDays: number, quantity: number): Promise<ApiResponse<RedeemCode[]>> {
    try {
      const response = await apiClient.post('/redeem-codes/generate', { questionSetId, validityDays, quantity });
      return handleResponse<RedeemCode[]>(response);
    } catch (error: any) {
      return {
        success: false,
        message: error.message,
        error: error.error
      };
    }
  },
  
  // 获取所有兑换码 (仅管理员)
  async getAllRedeemCodes(): Promise<ApiResponse<RedeemCode[]>> {
    try {
      const response = await apiClient.get('/redeem-codes');
      return handleResponse<RedeemCode[]>(response);
    } catch (error: any) {
      return {
        success: false,
        message: error.message,
        error: error.error
      };
    }
  },
  
  // 删除兑换码 (仅管理员)
  async deleteRedeemCode(codeId: string): Promise<ApiResponse<void>> {
    try {
      const response = await apiClient.delete(`/redeem-codes/${codeId}`);
      return handleResponse<void>(response);
    } catch (error: any) {
      return {
        success: false,
        message: error.message,
        error: error.error
      };
    }
  }
};

// 首页内容API服务
export const homepageService = {
  // 获取首页内容
  async getHomeContent(): Promise<ApiResponse<any>> {
    try {
      const response = await apiClient.get('/homepage/content');
      return handleResponse<any>(response);
    } catch (error: any) {
      return {
        success: false,
        message: error.message,
        error: error.error
      };
    }
  },
  
  // 更新首页内容 (仅管理员)
  async updateHomeContent(content: any): Promise<ApiResponse<any>> {
    try {
      const response = await apiClient.put('/homepage/content', content);
      return handleResponse<any>(response);
    } catch (error: any) {
      return {
        success: false,
        message: error.message,
        error: error.error
      };
    }
  },
  
  // 获取精选分类
  async getFeaturedCategories(): Promise<ApiResponse<string[]>> {
    try {
      const response = await apiClient.get('/homepage/featured-categories');
      return handleResponse<string[]>(response);
    } catch (error: any) {
      return {
        success: false,
        message: error.message,
        error: error.error
      };
    }
  },
  
  // 更新精选分类 (仅管理员)
  async updateFeaturedCategories(featuredCategories: string[]): Promise<ApiResponse<any>> {
    try {
      const response = await apiClient.put('/homepage/featured-categories', { featuredCategories });
      return handleResponse<any>(response);
    } catch (error: any) {
      return {
        success: false,
        message: error.message,
        error: error.error
      };
    }
  }
};

// 错题集服务
export const wrongAnswerService = {
  // 获取用户的所有错题
  getWrongAnswers: async () => {
    try {
      const response = await apiClient.get('/wrong-answers');
      return response.data;
    } catch (error) {
      console.error('获取错题集失败:', error);
      return { success: false, message: '获取错题集失败' };
    }
  },

  // 保存错题
  saveWrongAnswer: async (wrongAnswer: {
    questionId: string;
    questionSetId: string;
    question: string;
    questionType: string;
    options: any[];
    selectedOption?: string;
    selectedOptions?: string[];
    correctOption?: string;
    correctOptions?: string[];
    explanation?: string;
  }) => {
    try {
      const response = await apiClient.post('/wrong-answers', wrongAnswer);
      return response.data;
    } catch (error) {
      console.error('保存错题失败:', error);
      return { success: false, message: '保存错题失败' };
    }
  },

  // 删除错题
  deleteWrongAnswer: async (id: string) => {
    try {
      const response = await apiClient.delete(`/wrong-answers/${id}`);
      return response.data;
    } catch (error) {
      console.error('删除错题失败:', error);
      return { success: false, message: '删除错题失败' };
    }
  },

  // 更新错题备注
  updateMemo: async (id: string, memo: string) => {
    try {
      const response = await apiClient.patch(`/wrong-answers/${id}`, { memo });
      return response.data;
    } catch (error) {
      console.error('更新错题备注失败:', error);
      return { success: false, message: '更新错题备注失败' };
    }
  },

  // 标记错题为已掌握（删除）
  markAsMastered: async (id: string) => {
    try {
      const response = await apiClient.post(`/wrong-answers/${id}/mastered`);
      return response.data;
    } catch (error) {
      console.error('标记错题为已掌握失败:', error);
      return { success: false, message: '标记错题为已掌握失败' };
    }
  }
};

// 导出所有服务
export default {
  userService,
  questionSetService,
  questionService,
  userProgressService,
  purchaseService,
  redeemCodeService,
  homepageService,
  wrongAnswerService
}; 