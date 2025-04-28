import axios from 'axios';
import { Question, User, QuestionSet, Purchase, RedeemCode, UserProgress, Option } from '../types';

// API基础URL - 确保这里指向了正确的后端服务地址
const API_BASE_URL = '/api';

// 创建axios实例
const api = axios.create({
  baseURL: API_BASE_URL,
  headers: {
    'Content-Type': 'application/json',
  },
  // 添加超时设置
  timeout: 10000,
  // 添加凭证配置
  withCredentials: true,
});

// 请求拦截器 - 添加令牌
api.interceptors.request.use(
  config => {
    const token = localStorage.getItem('token');
    if (token) {
      config.headers.Authorization = `Bearer ${token}`;
    }
    // 添加调试日志
    console.log(`发送请求 ${config.method?.toUpperCase()}: ${config.url}`, config.data);
    return config;
  },
  error => {
    console.error('请求拦截器错误:', error);
    return Promise.reject(error);
  }
);

// 响应拦截器 - 统一处理错误
api.interceptors.response.use(
  response => {
    console.log(`接收响应 ${response.status}: ${response.config.url}`, response.data);
    return response;
  },
  error => {
    if (error.response) {
      // 服务器返回了错误状态码
      console.error('API错误响应:', {
        url: error.config?.url,
        status: error.response.status,
        data: error.response.data
      });
    } else if (error.request) {
      // 请求发送成功，但没有收到响应
      console.error('API请求无响应:', {
        url: error.config?.url,
        method: error.config?.method,
        message: error.message
      });
    } else {
      // 请求设置过程中发生错误
      console.error('API请求配置错误:', error.message);
    }
    return Promise.reject(error);
  }
);

// API响应接口
interface ApiResponse<T> {
  success: boolean;
  data?: T;
  message?: string;
  error?: string;
}

// 处理API响应
const handleResponse = <T>(response: any): ApiResponse<T> => {
  if (response.data.success !== undefined) {
    return response.data as ApiResponse<T>;
  }
  
  return {
    success: true,
    data: response.data as T,
  };
};

// 用户API服务
export const userService = {
  // 用户登录
  async login(username: string, password: string): Promise<ApiResponse<{ user: User; token: string }>> {
    try {
      // 修正路径，移除了多余的 /api 前缀，因为 axios 实例已经配置了 baseURL
      const response = await api.post('/users/login', { username, password });
      return handleResponse<{ user: User; token: string }>(response);
    } catch (error: any) {
      // 增强错误处理，提供更具体的错误消息
      let errorMessage = '登录失败';
      
      if (error.response) {
        // 服务器返回了具体错误信息
        errorMessage = error.response.data?.message || errorMessage;
      } else if (error.request) {
        // 请求发送了但没有收到响应
        errorMessage = '服务器未响应，请检查网络连接';
      } else {
        // 发送请求时出错
        errorMessage = error.message || errorMessage;
      }
      
      return { 
        success: false, 
        error: errorMessage,
        message: errorMessage 
      };
    }
  },

  // 用户注册
  async register(userData: Partial<User>): Promise<ApiResponse<{ user: User; token: string }>> {
    try {
      const response = await api.post('/users', userData);
      return handleResponse<{ user: User; token: string }>(response);
    } catch (error: any) {
      let errorMessage = '注册失败';
      
      if (error.response) {
        errorMessage = error.response.data?.message || errorMessage;
      } else if (error.request) {
        errorMessage = '服务器未响应，请检查网络连接';
      } else {
        errorMessage = error.message || errorMessage;
      }
      
      return { 
        success: false, 
        error: errorMessage,
        message: errorMessage 
      };
    }
  },

  // 获取当前用户信息
  async getCurrentUser(): Promise<ApiResponse<User>> {
    try {
      const response = await api.get('/users/profile');
      return handleResponse<User>(response);
    } catch (error: any) {
      let errorMessage = '获取用户信息失败';
      
      if (error.response) {
        errorMessage = error.response.data?.message || errorMessage;
      } else if (error.request) {
        errorMessage = '服务器未响应，请检查网络连接';
      } else {
        errorMessage = error.message || errorMessage;
      }
      
      return { 
        success: false, 
        error: errorMessage,
        message: errorMessage 
      };
    }
  },

  // 更新用户信息
  async updateUser(userId: string, userData: Partial<User>): Promise<ApiResponse<User>> {
    try {
      const response = await api.put(`/users/${userId}`, userData);
      return handleResponse<User>(response);
    } catch (error) {
      return { success: false, error: (error as Error).message };
    }
  },

  // 获取所有用户 (仅管理员)
  async getAllUsers(): Promise<ApiResponse<User[]>> {
    try {
      const response = await api.get('/users');
      return handleResponse<User[]>(response);
    } catch (error) {
      return { success: false, error: (error as Error).message };
    }
  },

  // 删除用户 (仅管理员)
  async deleteUser(userId: string): Promise<ApiResponse<void>> {
    try {
      const response = await api.delete(`/users/${userId}`);
      return handleResponse<void>(response);
    } catch (error) {
      return { success: false, error: (error as Error).message };
    }
  },
  
  // 更新用户角色 (仅管理员)
  async updateUserRole(userId: string, isAdmin: boolean): Promise<ApiResponse<User>> {
    try {
      const response = await api.put(`/users/${userId}/role`, { isAdmin });
      return handleResponse<User>(response);
    } catch (error) {
      return { success: false, error: (error as Error).message };
    }
  }
};

// 题库API服务
export const questionSetService = {
  // 获取所有题库
  async getAllQuestionSets(): Promise<ApiResponse<QuestionSet[]>> {
    try {
      const response = await api.get('/question-sets');
      return handleResponse<QuestionSet[]>(response);
    } catch (error) {
      return { success: false, error: (error as Error).message };
    }
  },

  // 按分类获取题库
  async getQuestionSetsByCategory(category: string): Promise<ApiResponse<QuestionSet[]>> {
    try {
      const response = await api.get(`/question-sets/by-category/${category}`);
      return handleResponse<QuestionSet[]>(response);
    } catch (error) {
      return { success: false, error: (error as Error).message };
    }
  },

  // 获取所有分类
  async getAllCategories(): Promise<ApiResponse<string[]>> {
    try {
      const response = await api.get('/question-sets/categories');
      return handleResponse<string[]>(response);
    } catch (error) {
      return { success: false, error: (error as Error).message };
    }
  },

  // 获取单个题库详情
  async getQuestionSetById(id: string): Promise<ApiResponse<QuestionSet>> {
    try {
      const response = await api.get(`/question-sets/${id}`);
      return handleResponse<QuestionSet>(response);
    } catch (error) {
      return { success: false, error: (error as Error).message };
    }
  },
  
  // 创建题库 (仅管理员)
  async createQuestionSet(questionSetData: Partial<QuestionSet>): Promise<ApiResponse<QuestionSet>> {
    try {
      const response = await api.post('/question-sets', questionSetData);
      return handleResponse<QuestionSet>(response);
    } catch (error) {
      return { success: false, error: (error as Error).message };
    }
  },
  
  // 更新题库 (仅管理员)
  async updateQuestionSet(id: string, questionSetData: Partial<QuestionSet>): Promise<ApiResponse<QuestionSet>> {
    try {
      const response = await api.put(`/question-sets/${id}`, questionSetData);
      return handleResponse<QuestionSet>(response);
    } catch (error) {
      return { success: false, error: (error as Error).message };
    }
  },
  
  // 删除题库 (仅管理员)
  async deleteQuestionSet(id: string): Promise<ApiResponse<void>> {
    try {
      const response = await api.delete(`/question-sets/${id}`);
      return handleResponse<void>(response);
    } catch (error) {
      return { success: false, error: (error as Error).message };
    }
  },
  
  // 批量上传题库 (仅管理员)
  async uploadQuestionSets(questionSets: Partial<QuestionSet>[]): Promise<ApiResponse<QuestionSet[]>> {
    try {
      const response = await api.post('/question-sets/upload', { questionSets });
      return handleResponse<QuestionSet[]>(response);
    } catch (error) {
      return { success: false, error: (error as Error).message };
    }
  },
  
  // 获取精选题库
  async getFeaturedQuestionSets(): Promise<ApiResponse<QuestionSet[]>> {
    try {
      const response = await api.get('/question-sets/featured');
      return handleResponse<QuestionSet[]>(response);
    } catch (error) {
      return { success: false, error: (error as Error).message };
    }
  },
  
  // 设置精选题库 (仅管理员)
  async setFeaturedQuestionSet(id: string, isFeatured: boolean, featuredCategory?: string): Promise<ApiResponse<QuestionSet>> {
    try {
      const response = await api.put(`/question-sets/${id}/featured`, { isFeatured, featuredCategory });
      return handleResponse<QuestionSet>(response);
    } catch (error) {
      return { success: false, error: (error as Error).message };
    }
  }
};

// 题目API服务
export const questionService = {
  // 获取题库中的所有题目
  async getQuestionsByQuestionSetId(questionSetId: string): Promise<ApiResponse<Question[]>> {
    try {
      const response = await api.get(`/questions?questionSetId=${questionSetId}`);
      return handleResponse<Question[]>(response);
    } catch (error) {
      return { success: false, error: (error as Error).message };
    }
  },
  
  // 添加题目到题库 (仅管理员)
  async addQuestion(questionSetId: string, question: Partial<Question>): Promise<ApiResponse<Question>> {
    try {
      const response = await api.post('/questions', { ...question, questionSetId });
      return handleResponse<Question>(response);
    } catch (error) {
      return { success: false, error: (error as Error).message };
    }
  },
  
  // 更新题目 (仅管理员)
  async updateQuestion(questionId: string, question: Partial<Question>): Promise<ApiResponse<Question>> {
    try {
      const response = await api.put(`/questions/${questionId}`, question);
      return handleResponse<Question>(response);
    } catch (error) {
      return { success: false, error: (error as Error).message };
    }
  },
  
  // 删除题目 (仅管理员)
  async deleteQuestion(questionId: string): Promise<ApiResponse<void>> {
    try {
      const response = await api.delete(`/questions/${questionId}`);
      return handleResponse<void>(response);
    } catch (error) {
      return { success: false, error: (error as Error).message };
    }
  },
  
  // 批量上传题目 (仅管理员)
  async uploadQuestions(questionSetId: string, questions: Partial<Question>[]): Promise<ApiResponse<Question[]>> {
    try {
      const response = await api.post('/questions/upload', { questionSetId, questions });
      return handleResponse<Question[]>(response);
    } catch (error) {
      return { success: false, error: (error as Error).message };
    }
  },
  
  // Add a new option to a question
  async addOption(questionId: string, optionData: Partial<Option>): Promise<ApiResponse<Option>> {
    try {
      const response = await api.post(`/questions/${questionId}/options`, optionData);
      return handleResponse<Option>(response);
    } catch (error) {
      return { success: false, error: (error as Error).message };
    }
  },
  
  // Update an existing option
  async updateOption(optionId: string, optionData: Partial<Option>): Promise<ApiResponse<Option>> {
    try {
      const response = await api.put(`/options/${optionId}`, optionData);
      return handleResponse<Option>(response);
    } catch (error) {
      return { success: false, error: (error as Error).message };
    }
  },
  
  // Delete an option
  async deleteOption(optionId: string): Promise<ApiResponse<void>> {
    try {
      const response = await api.delete(`/options/${optionId}`);
      return handleResponse<void>(response);
    } catch (error) {
      return { success: false, error: (error as Error).message };
    }
  },
  
  // Bulk add options to a question
  async bulkAddOptions(questionId: string, options: Partial<Option>[]): Promise<ApiResponse<Option[]>> {
    try {
      const response = await api.post(`/questions/${questionId}/options/bulk`, { options });
      return handleResponse<Option[]>(response);
    } catch (error) {
      return { success: false, error: (error as Error).message };
    }
  }
};

// 用户进度API服务
export const userProgressService = {
  // 获取用户的所有进度
  async getUserProgress(): Promise<ApiResponse<Record<string, UserProgress>>> {
    try {
      const response = await api.get('/user-progress');
      return handleResponse<Record<string, UserProgress>>(response);
    } catch (error) {
      return { success: false, error: (error as Error).message };
    }
  },
  
  // 获取特定题库的进度
  async getProgressByQuestionSetId(questionSetId: string): Promise<ApiResponse<UserProgress>> {
    try {
      const response = await api.get(`/user-progress/${questionSetId}`);
      return handleResponse<UserProgress>(response);
    } catch (error) {
      return { success: false, error: (error as Error).message };
    }
  },
  
  // 更新用户进度
  async updateProgress(progress: Partial<UserProgress>): Promise<ApiResponse<UserProgress>> {
    try {
      // 确保questionSetId存在于请求体中
      if (!progress.questionSetId) {
        return {
          success: false,
          error: '题库ID (questionSetId) 不能为空'
        };
      }
      
      // 使用POST请求发送进度更新
      const response = await api.post('/user-progress', progress);
      return handleResponse<UserProgress>(response);
    } catch (error) {
      return { success: false, error: (error as Error).message };
    }
  }
};

// 购买API服务
export const purchaseService = {
  // 创建购买
  async createPurchase(purchase: Partial<Purchase>): Promise<ApiResponse<Purchase>> {
    try {
      const response = await api.post('/purchases', purchase);
      return handleResponse<Purchase>(response);
    } catch (error) {
      return { success: false, error: (error as Error).message };
    }
  },
  
  // 获取用户的所有购买
  async getUserPurchases(): Promise<ApiResponse<Purchase[]>> {
    try {
      const response = await api.get('/purchases/user');
      return handleResponse<Purchase[]>(response);
    } catch (error) {
      return { success: false, error: (error as Error).message };
    }
  },
  
  // 检查用户是否有权限访问题库
  async checkAccess(questionSetId: string): Promise<ApiResponse<{hasAccess: boolean, expiryDate?: string, remainingDays?: number}>> {
    try {
      const response = await api.get(`/purchases/check/${questionSetId}`);
      return handleResponse<{hasAccess: boolean, expiryDate?: string, remainingDays?: number}>(response);
    } catch (error) {
      return { success: false, error: (error as Error).message };
    }
  }
};

// 兑换码API服务
export const redeemCodeService = {
  // 兑换代码
  async redeemCode(code: string): Promise<ApiResponse<{purchase: Purchase}>> {
    try {
      const response = await api.post('/redeem-codes/redeem', { code });
      return handleResponse<{purchase: Purchase}>(response);
    } catch (error) {
      return { success: false, error: (error as Error).message };
    }
  },
  
  // 生成兑换码 (仅管理员)
  async generateRedeemCodes(questionSetId: string, validityDays: number, quantity: number): Promise<ApiResponse<RedeemCode[]>> {
    try {
      const response = await api.post('/redeem-codes/generate', { questionSetId, validityDays, quantity });
      return handleResponse<RedeemCode[]>(response);
    } catch (error) {
      return { success: false, error: (error as Error).message };
    }
  },
  
  // 获取所有兑换码 (仅管理员)
  async getAllRedeemCodes(): Promise<ApiResponse<RedeemCode[]>> {
    try {
      const response = await api.get('/redeem-codes');
      return handleResponse<RedeemCode[]>(response);
    } catch (error) {
      return { success: false, error: (error as Error).message };
    }
  },
  
  // 删除兑换码 (仅管理员)
  async deleteRedeemCode(codeId: string): Promise<ApiResponse<void>> {
    try {
      const response = await api.delete(`/redeem-codes/${codeId}`);
      return handleResponse<void>(response);
    } catch (error) {
      return { success: false, error: (error as Error).message };
    }
  }
};

// 首页内容API服务
export const homepageService = {
  // 获取首页内容
  async getHomeContent(): Promise<ApiResponse<any>> {
    try {
      const response = await api.get('/homepage/content');
      return handleResponse<any>(response);
    } catch (error) {
      return { success: false, error: (error as Error).message };
    }
  },
  
  // 更新首页内容 (仅管理员)
  async updateHomeContent(content: any): Promise<ApiResponse<any>> {
    try {
      const response = await api.put('/homepage/content', content);
      return handleResponse<any>(response);
    } catch (error) {
      return { success: false, error: (error as Error).message };
    }
  },
  
  // 获取精选分类
  async getFeaturedCategories(): Promise<ApiResponse<string[]>> {
    try {
      const response = await api.get('/homepage/featured-categories');
      return handleResponse<string[]>(response);
    } catch (error) {
      return { success: false, error: (error as Error).message };
    }
  },
  
  // 更新精选分类 (仅管理员)
  async updateFeaturedCategories(featuredCategories: string[]): Promise<ApiResponse<any>> {
    try {
      const response = await api.put('/homepage/featured-categories', { featuredCategories });
      return handleResponse<any>(response);
    } catch (error) {
      return { success: false, error: (error as Error).message };
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
  homepageService
}; 