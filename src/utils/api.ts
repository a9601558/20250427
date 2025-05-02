// Replace @ts-nocheck with more specific typing
import { User, Purchase, RedeemCode, QuestionSet } from '../types';
import { logger } from './logger';

// 导入服务
import {
  userService,
  questionSetService,
  questionService,
  userProgressService,
  purchaseService,
  redeemCodeService,
  homepageService,
} from '../services/api';

// 导出API服务
export const API_BASE_URL = '/api';

// 导出服务
export const userApi = userService;
export const questionSetApi = questionSetService;
export const questionApi = questionService;
export const userProgressApi = userProgressService;
export const purchaseApi = purchaseService;
export const redeemCodeApi = redeemCodeService;
export const homepageApi = homepageService;

// Define proper types for API responses
interface ApiResponse<T = any> {
  success: boolean;
  data?: T;
  message?: string;
  error?: string;
}

// 为了向后兼容，导出fetchWithAuth函数 - 恢复泛型支持
export async function fetchWithAuth<T>(endpoint: string, options: RequestInit = {}): Promise<ApiResponse<T>> {
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

    return {
      success: true,
      data: responseData.data !== undefined ? responseData.data : responseData,
      message: responseData.message,
    };
  } catch (error) {
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error occurred',
    };
  }
} 
