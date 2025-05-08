import axios from 'axios';
import { Question, User, QuestionSet, Purchase, RedeemCode, UserProgress, Option } from '../types';
import { AccessCheckResult } from './purchaseService';

// API基础URL
export const API_BASE_URL = '/api';

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
    return response;
  },
  error => {
    if (error.response) {
      // 服务器返回了错误状态码
      const { status, data } = error.response;
      const errorMessage = data?.message || '请求失败';
      
      // 处理特定状态码
      if (status === 401) {
        // 未授权，清除token并跳转到登录页
        localStorage.removeItem('token');
        window.location.href = '/login';
      }
      
      return Promise.reject({
        success: false,
        message: errorMessage,
        error: data?.error
      });
    } else if (error.request) {
      // 请求发送成功，但没有收到响应
      return Promise.reject({
        success: false,
        message: '服务器未响应，请检查网络连接'
      });
    } else {
      // 请求设置过程中发生错误
      return Promise.reject({
        success: false,
        message: error.message || '请求配置错误'
      });
    }
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
  return response.data as ApiResponse<T>;
};

// 用户API服务
export const userService = {
  // 用户登录
  async login(username: string, password: string): Promise<ApiResponse<{ user: User; token: string }>> {
    try {
      const response = await api.post('/users/login', { username, password });
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
      const response = await api.post('/users/register', userData);
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
      const response = await api.get('/users/profile');
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
      const response = await api.put(`/users/${userId}`, userData);
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
      const response = await api.get('/users');
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
      const response = await api.delete(`/users/${userId}`);
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
      const response = await api.put(`/users/${userId}/role`, { isAdmin });
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
      const response = await api.get('/question-sets');
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
      const response = await api.get(`/question-sets/by-category/${category}`);
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
      const response = await api.get('/question-sets/categories');
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
      const response = await api.get(`/question-sets/${id}`);
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
      const response = await api.post('/question-sets', questionSetData);
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
      const response = await api.put(`/question-sets/${id}`, questionSetData);
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
      const response = await api.delete(`/question-sets/${id}`);
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
      const response = await api.post('/question-sets/upload', { questionSets });
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
      const response = await api.get('/question-sets/featured');
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
      const response = await api.put(`/question-sets/${id}/featured`, { isFeatured, featuredCategory });
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
      const response = await api.get('/user-progress/stats');
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
      const response = await api.get(`/questions?questionSetId=${questionSetId}&include=options&limit=1000`);
      
      if (response.data.success) {
        return { success: true, data: response.data.data };
      } else {
        return { success: false, message: response.data.message || '获取题目失败' };
      }
    } catch (error: any) {
      console.error('API Error - getQuestionsByQuestionSetId:', error);
      return { 
        success: false, 
        message: error.response?.data?.message || '获取题目列表失败，请检查网络连接'
      };
    }
  },
  
  // 添加题目到题库 (仅管理员)
  async addQuestion(questionSetId: string, question: Partial<Question>): Promise<ApiResponse<Question>> {
    try {
      const response = await api.post('/questions', { ...question, questionSetId });
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
      const response = await api.put(`/questions/${questionId}`, question);
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
      const response = await api.delete(`/questions/${questionId}`);
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
      const response = await api.post('/questions/upload', { questionSetId, questions });
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
      const response = await api.post(`/questions/${questionId}/options`, optionData);
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
      const response = await api.put(`/options/${optionId}`, optionData);
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
      const response = await api.delete(`/options/${optionId}`);
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
      const response = await api.post(`/questions/${questionId}/options/bulk`, { options });
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
      const response = await api.get('/user-progress');
      return response.data;
    } catch (error) {
      console.error('获取用户进度失败:', error);
      return { success: false, message: '获取用户进度失败' };
    }
  },
  
  // 获取用户的所有进度记录
  getUserProgressRecords: async () => {
    try {
      const response = await api.get('/user-progress/records');
      return response.data;
    } catch (error) {
      console.error('获取用户进度记录失败:', error);
      return { success: false, message: '获取用户进度记录失败' };
    }
  },
  
  // 获取用户的历史记录
  getUserHistory: async () => {
    try {
      const response = await api.get('/user-progress/history');
      return response.data;
    } catch (error) {
      console.error('获取用户历史记录失败:', error);
      return { success: false, message: '获取用户历史记录失败' };
    }
  },
  
  // 获取用户的统计数据
  getUserStats: async () => {
    try {
      const response = await api.get('/user-progress/stats');
      return response.data;
    } catch (error) {
      console.error('获取用户统计数据失败:', error);
      return { success: false, message: '获取用户统计数据失败' };
    }
  },
  
  // 根据题库ID获取进度
  getProgressByQuestionSetId: async (questionSetId: string) => {
    try {
      const response = await api.get(`/user-progress/${questionSetId}`);
      return response.data;
    } catch (error) {
      console.error(`获取题库${questionSetId}的进度失败:`, error);
      return { success: false, message: '获取题库进度失败' };
    }
  },
  
  // 删除特定题库的进度数据
  deleteProgressByQuestionSet: async (questionSetId: string) => {
    try {
      const response = await api.delete(`/user-progress/${questionSetId}`);
      return response.data;
    } catch (error) {
      console.error(`删除题库${questionSetId}的进度失败:`, error);
      return { success: false, message: '删除题库进度失败' };
    }
  },
  
  // 更新进度
  updateProgress: async (progress: Partial<UserProgress>) => {
    try {
      const response = await api.post('/user-progress/update', progress);
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
      const response = await api.post('/user-progress/save', data);
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
      const response = await api.post('/purchases', { questionSetId, paymentMethod, amount });
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
      console.log('[API] 开始请求获取用户购买记录');
      const response = await api.get('/purchases');
      console.log('[API] 购买记录API响应:', response.status);
      
      // 检查响应数据是否存在并有效
      if (!response.data || !response.data.data) {
        console.error('[API] 购买记录API响应无效:', response.data);
        return {
          success: false,
          message: '服务器返回数据无效',
          data: []
        };
      }
      
      const purchases = response.data.data;
      console.log(`[API] 获取到 ${purchases.length} 条购买记录`);
      
      // 确保所有购买记录都有正确的属性格式
      const formattedPurchases = purchases.map((purchase: any) => {
        try {
          // 确保题库数据的一致性
          let questionSetData = null;
          if (purchase.purchaseQuestionSet) {
            questionSetData = purchase.purchaseQuestionSet;
          } else if (purchase.questionSet) {
            questionSetData = purchase.questionSet;
          }
          
          // 创建一个新的规范化的购买记录对象
          return {
            id: purchase.id || '',
            userId: purchase.userId,
            questionSetId: purchase.questionSetId,
            purchaseDate: purchase.purchaseDate || new Date().toISOString(),
            expiryDate: purchase.expiryDate || new Date(Date.now() + 30*24*60*60*1000).toISOString(),
            amount: typeof purchase.amount === 'string' ? parseFloat(purchase.amount) : (purchase.amount || 0),
            status: purchase.status || 'active',
            paymentMethod: purchase.paymentMethod || 'direct',
            transactionId: purchase.transactionId || '',
            purchaseQuestionSet: questionSetData,
            remainingDays: purchase.remainingDays || 0,
            hasAccess: purchase.hasAccess !== undefined ? purchase.hasAccess : true
          };
        } catch (error) {
          console.error('[API] 处理购买记录时出错:', error, purchase);
          // 返回基本信息，避免单条记录错误影响整个列表
          return {
            id: purchase.id || '',
            questionSetId: purchase.questionSetId || '',
            purchaseDate: new Date().toISOString(),
            expiryDate: new Date(Date.now() + 30*24*60*60*1000).toISOString(),
            amount: 0,
            status: 'unknown',
            paymentMethod: 'unknown',
            transactionId: ''
          };
        }
      });
      
      // 过滤掉没有题库ID的无效记录
      const validPurchases = formattedPurchases.filter((p: any) => p && p.questionSetId);
      console.log(`[API] 返回 ${validPurchases.length} 条有效购买记录`);
      
      return {
        success: true,
        data: validPurchases
      };
    } catch (error: any) {
      console.error('[API] 获取购买记录失败:', error);
      return {
        success: false,
        message: error.message || '获取购买记录失败',
        error: error.toString(),
        data: []
      };
    }
  },
  
  // 检查用户是否有权限访问题库
  async checkAccess(questionSetId: string): Promise<ApiResponse<AccessCheckResult>> {
    try {
      const response = await api.get(`/purchases/check/${questionSetId}`);
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
      const response = await api.get(`/purchases/${purchaseId}`);
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
      const response = await api.post(`/purchases/${purchaseId}/cancel`);
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
      const response = await api.post(`/purchases/${purchaseId}/extend`, { months });
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
      console.log('[API] 开始获取用户兑换码列表');
      const response = await api.get('/redeem-codes/user');
      
      console.log('[API] 兑换码API响应状态:', response.status);
      
      if (!response.data) {
        console.error('[API] 兑换码 API 响应缺少数据字段');
        return {
          success: false,
          message: '服务器返回数据格式错误',
          error: '响应中缺少数据字段'
        };
      }
      
      if (!response.data.success) {
        console.error('[API] 兑换码 API 返回失败状态:', response.data.message);
        return {
          success: false,
          message: response.data.message || '获取兑换码列表失败',
          error: response.data.error
        };
      }
      
      if (!Array.isArray(response.data.data)) {
        console.error('[API] 兑换码 API 返回的数据不是数组:', response.data.data);
        return {
          success: false,
          message: '服务器返回数据格式错误',
          error: '预期数组但获得了不同类型'
        };
      }
      
      const redeemCodes = response.data.data;
      console.log('[API] 成功获取兑换码数据, 数量:', redeemCodes.length);
      
      // 确保返回的数据使用正确的属性名
      redeemCodes.forEach((code: any) => {
        if (!code.id && code.code) {
          // 如果没有ID但有code，使用code作为ID
          code.id = code.code;
        }
        
        if (code.questionSet) {
          code.redeemQuestionSet = code.questionSet;
          delete code.questionSet;
        }
        
        // 确保有效的questionSetId
        if (!code.questionSetId && code.redeemQuestionSet?.id) {
          code.questionSetId = code.redeemQuestionSet.id;
        }
      });
      
      return {
        success: true,
        data: redeemCodes
      };
    } catch (error: any) {
      console.error('[API] 获取兑换码列表出错:', error);
      console.error('[API] 错误详情:', error.response?.data || error.message);
      
      return {
        success: false,
        message: error.response?.data?.message || error.message || '获取兑换码列表时发生网络错误',
        error: error.error || error.toString()
      };
    }
  }
};

// 兑换码API服务
export const redeemCodeService = {
  // 兑换代码
  async redeemCode(code: string): Promise<ApiResponse<{purchase: Purchase; questionSet: QuestionSet}>> {
    try {
      const response = await api.post('/redeem-codes/redeem', { code });
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
      const response = await api.post('/redeem-codes/generate', { questionSetId, validityDays, quantity });
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
      const response = await api.get('/redeem-codes');
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
      const response = await api.delete(`/redeem-codes/${codeId}`);
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
      const response = await api.get('/homepage/content');
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
      const response = await api.put('/homepage/content', content);
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
      const response = await api.get('/homepage/featured-categories');
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
      const response = await api.put('/homepage/featured-categories', { featuredCategories });
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
      const response = await api.get('/wrong-answers');
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
      const response = await api.post('/wrong-answers', wrongAnswer);
      return response.data;
    } catch (error) {
      console.error('保存错题失败:', error);
      return { success: false, message: '保存错题失败' };
    }
  },

  // 删除错题
  deleteWrongAnswer: async (id: string) => {
    try {
      const response = await api.delete(`/wrong-answers/${id}`);
      return response.data;
    } catch (error) {
      console.error('删除错题失败:', error);
      return { success: false, message: '删除错题失败' };
    }
  },

  // 更新错题备注
  updateMemo: async (id: string, memo: string) => {
    try {
      const response = await api.patch(`/wrong-answers/${id}`, { memo });
      return response.data;
    } catch (error) {
      console.error('更新错题备注失败:', error);
      return { success: false, message: '更新错题备注失败' };
    }
  },

  // 标记错题为已掌握（删除）
  markAsMastered: async (id: string) => {
    try {
      const response = await api.post(`/wrong-answers/${id}/mastered`);
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