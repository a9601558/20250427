import axios, { AxiosError } from 'axios';
import { API_BASE_URL } from './api';

// API响应接口
interface ApiResponse<T> {
  success: boolean;
  data?: T;
  message?: string;
  error?: string;
}

// 购买记录接口
export interface Purchase {
  id: string;
  userId: string;
  questionSetId: string;
  purchaseDate: string;
  expiryDate: string;
  transactionId: string;
  amount: number;
  paymentMethod: string;
  status: 'pending' | 'completed' | 'failed' | 'refunded';
  questionSet?: {
    id: string;
    title: string;
    category: string;
    icon: string;
  };
}

// 访问权限检查结果接口
export interface AccessCheckResult {
  hasAccess: boolean;
  isPaid: boolean;
  price?: number;
  expiryDate?: string;
  remainingDays?: number;
}

// 创建购买
export const createPurchase = async (questionSetId: string, paymentMethod: string, amount: number): Promise<
Purchase> => {
  try {
    const response = await axios.post<ApiResponse<Purchase>>(`${API_BASE_URL}/purchases`, {
      questionSetId,
      paymentMethod,
      amount,
    });
    return response.data.data!;
  } catch (error) {
    const axiosError = error as AxiosError<ApiResponse<Purchase>>;
    throw new Error(axiosError.response?.data?.message || '创建购买失败');
  }
};

// 获取用户的购买记录
export const getUserPurchases = async (): Promise<Purchase[]> => {
  try {
    const response = await axios.get<ApiResponse<Purchase[]>>(`${API_BASE_URL}/purchases`);
    return response.data.data!;
  } catch (error) {
    const axiosError = error as AxiosError<ApiResponse<Purchase[]>>;
    throw new Error(axiosError.response?.data?.message || '获取购买记录失败');
  }
};

// 检查对题库的访问权限
export const checkAccess = async (questionSetId: string): Promise<AccessCheckResult> => {
  try {
    const response = await axios.get<ApiResponse<AccessCheckResult>>(`${API_BASE_URL}/purchases/check/${questionSetId}`);
    return response.data.data!;
  } catch (error) {
    const axiosError = error as AxiosError<ApiResponse<AccessCheckResult>>;
    throw new Error(axiosError.response?.data?.message || '检查访问权限失败');
  }
};

// 获取购买详情
export const getPurchaseById = async (purchaseId: string): Promise<Purchase> => {
  try {
    const response = await axios.get<ApiResponse<Purchase>>(`${API_BASE_URL}/purchases/${purchaseId}`);
    return response.data.data!;
  } catch (error) {
    const axiosError = error as AxiosError<ApiResponse<Purchase>>;
    throw new Error(axiosError.response?.data?.message || '获取购买详情失败');
  }
};

// 取消购买
export const cancelPurchase = async (purchaseId: string): Promise<Purchase> => {
  try {
    const response = await axios.post<ApiResponse<Purchase>>(`${API_BASE_URL}/purchases/${purchaseId}/cancel`);
    return response.data.data!;
  } catch (error) {
    const axiosError = error as AxiosError<ApiResponse<Purchase>>;
    throw new Error(axiosError.response?.data?.message || '取消购买失败');
  }
};

// 延长购买有效期
export const extendPurchase = async (purchaseId: string, months: number): Promise<Purchase> => {
  try {
    const response = await axios.post<ApiResponse<Purchase>>(`${API_BASE_URL}/purchases/${purchaseId}/extend`, { months });
    return response.data.data!;
  } catch (error) {
    const axiosError = error as AxiosError<ApiResponse<Purchase>>;
    throw new Error(axiosError.response?.data?.message || '延长有效期失败');
  }
}; 