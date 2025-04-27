// @ts-nocheck - 禁用 TypeScript 未使用变量检查
import { User, Purchase, RedeemCode, QuestionSet } from '../types';
import { logger } from './logger';

// API基础URL，可以从环境变量读取
export const API_BASE_URL = '/api';  // Using the /api prefix to match Vite proxy

interface ApiResponse<T> {
  success: boolean;
  data?: T;
  message?: string;
  error?: string;
}

// 辅助函数：带授权token的fetch请求
export async function fetchWithAuth<T>(
  endpoint: string, 
  options: RequestInit = {}
): Promise<ApiResponse<T>> {
  const token = localStorage.getItem('token');
  
  const headers = {
    'Content-Type': 'application/json',
    ...(token ? { 'Authorization': `Bearer ${token}` } : {}),
    ...options.headers,
  };

  try {
    const response = await fetch(`${API_BASE_URL}${endpoint}`, {
      ...options,
      headers,
    });

    const responseData = await response.json();
    
    if (!response.ok) {
      return {
        success: false,
        error: responseData.message || responseData.error || 'Unknown error occurred',
      };
    }

    // 检查响应格式，确保我们正确处理不同的API响应结构
    let data;
    if (responseData.data !== undefined) {
      // 如果响应格式是 { data: ... }
      data = responseData.data;
    } else if (responseData.success !== undefined && responseData.data !== undefined) {
      // 如果响应格式是 { success: true, data: ... }
      data = responseData.data;
    } else {
      // 如果整个响应就是我们需要的数据
      data = responseData;
    }

    return {
      success: true,
      data: data as T,
      message: responseData.message,
    };
  } catch (error) {
    logger.error('API request failed', error);
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error occurred',
    };
  }
}

// User related API calls
export const userApi = {
  login: async (username: string, password: string): Promise<ApiResponse<{ user: User; token: string }>> => {
    return fetchWithAuth<{ user: User; token: string }>('/users/login', {
      method: 'POST',
      body: JSON.stringify({ username, password }),
    });
  },

  register: async (userData: Partial<User>): Promise<ApiResponse<{ user: User; token: string }>> => {
    return fetchWithAuth<{ user: User; token: string }>('/users', {
      method: 'POST',
      body: JSON.stringify(userData),
    });
  },

  getCurrentUser: async (): Promise<ApiResponse<User>> => {
    return fetchWithAuth<User>('/users/profile');
  },

  updateUser: async (userId: string, userData: Partial<User>): Promise<ApiResponse<User>> => {
    return fetchWithAuth<User>(`/users/${userId}`, {
      method: 'PUT',
      body: JSON.stringify(userData),
    });
  },

  getAllUsers: async (): Promise<ApiResponse<User[]>> => {
    return fetchWithAuth<User[]>('/users');
  },

  deleteUser: async (userId: string): Promise<ApiResponse<void>> => {
    return fetchWithAuth<void>(`/users/${userId}`, {
      method: 'DELETE',
    });
  },
};

// Question set related API calls
export const questionSetApi = {
  getAllQuestionSets: async (): Promise<ApiResponse<QuestionSet[]>> => {
    return fetchWithAuth<QuestionSet[]>('/question-sets');
  },

  getQuestionSetById: async (questionSetId: string): Promise<ApiResponse<QuestionSet>> => {
    return fetchWithAuth<QuestionSet>(`/question-sets/${questionSetId}`);
  },
  
  createQuestionSet: async (questionSetData: Partial<QuestionSet>): Promise<ApiResponse<QuestionSet>> => {
    return fetchWithAuth<QuestionSet>('/question-sets', {
      method: 'POST',
      body: JSON.stringify(questionSetData),
    });
  },
  
  updateQuestionSet: async (questionSetId: string, questionSetData: Partial<QuestionSet>): Promise<ApiResponse<QuestionSet>> => {
    return fetchWithAuth<QuestionSet>(`/question-sets/${questionSetId}`, {
      method: 'PUT',
      body: JSON.stringify(questionSetData),
    });
  },
  
  deleteQuestionSet: async (questionSetId: string): Promise<ApiResponse<void>> => {
    return fetchWithAuth<void>(`/question-sets/${questionSetId}`, {
      method: 'DELETE',
    });
  },
  
  uploadQuestionSets: async (questionSets: Partial<QuestionSet>[]): Promise<ApiResponse<any>> => {
    return fetchWithAuth<any>('/question-sets/upload', {
      method: 'POST',
      body: JSON.stringify({ questionSets }),
    });
  }
};

// Purchase related API calls
export const purchaseApi = {
  createPurchase: async (purchaseData: Partial<Purchase>): Promise<ApiResponse<Purchase>> => {
    return fetchWithAuth<Purchase>('/purchases', {
      method: 'POST',
      body: JSON.stringify(purchaseData),
    });
  },

  getUserPurchases: async (): Promise<ApiResponse<Purchase[]>> => {
    return fetchWithAuth<Purchase[]>('/purchases/user');
  },
};

// Redeem code related API calls
export const redeemCodeApi = {
  redeemCode: async (code: string): Promise<ApiResponse<{ purchase: Purchase }>> => {
    return fetchWithAuth<{ purchase: Purchase }>('/redeem-codes/redeem', {
      method: 'POST',
      body: JSON.stringify({ code }),
    });
  },

  generateRedeemCodes: async (
    questionSetId: string,
    validityDays: number,
    quantity: number
  ): Promise<ApiResponse<RedeemCode[]>> => {
    return fetchWithAuth<RedeemCode[]>('/redeem-codes/generate', {
      method: 'POST',
      body: JSON.stringify({ 
        questionSetId, 
        validityDays, 
        quantity 
      }),
      headers: {
        'Content-Type': 'application/json'
      }
    });
  },

  getAllRedeemCodes: async (): Promise<ApiResponse<RedeemCode[]>> => {
    return fetchWithAuth<RedeemCode[]>('/redeem-codes');
  },

  deleteRedeemCode: async (codeId: string): Promise<ApiResponse<void>> => {
    return fetchWithAuth<void>(`/redeem-codes/${codeId}`, {
      method: 'DELETE',
    });
  },
}; 