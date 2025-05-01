import apiClient from '../utils/api-client';
import { userService } from './api';

interface SaveProgressParams {
  questionId: string;
  questionSetId: string;
  selectedOption: string | string[];
  isCorrect: boolean;
  timeSpent: number;
  lastQuestionIndex?: number;
}

interface ProgressStats {
  questionSetId: string;
  completedQuestions: number;
  totalQuestions: number;
  correctAnswers: number;
  totalTimeSpent: number;
  averageTimeSpent: number;
  accuracy: number;
  lastAccessed: string;
}

interface ApiResponse<T> {
  success: boolean;
  data?: T;
  message?: string;
}

class UserProgressService {
  private baseUrl = '/api/user-progress';
  private cachedUserId: string | null = null;

  private getAuthHeader() {
    const token = localStorage.getItem('token');
    return token ? { Authorization: `Bearer ${token}` } : {};
  }

  async saveProgress(params: SaveProgressParams): Promise<ApiResponse<void>> {
    try {
      // 确保所有参数都有有效值，防止发送无效数据到服务器
      const validatedParams = {
        ...params,
        questionId: params.questionId || '',
        questionSetId: params.questionSetId || '',
        selectedOption: Array.isArray(params.selectedOption) 
          ? params.selectedOption 
          : [params.selectedOption].filter(Boolean),
        isCorrect: Boolean(params.isCorrect),
        timeSpent: Number(params.timeSpent) || 0
      };

      // 验证参数完整性
      if (!validatedParams.questionId || !validatedParams.questionSetId) {
        console.error('保存进度参数无效:', validatedParams);
        return { 
          success: false, 
          message: '问题ID或题库ID无效' 
        };
      }
      
      // 使用apiClient的post方法
      const response = await apiClient.post(
        `${this.baseUrl}/save`, 
        validatedParams, 
        {
          retries: 3,
          retryDelay: 500
        }
      );
      
      return response;
    } catch (error: any) {
      console.error('保存进度失败:', error?.response?.data || error.message);
      return { success: false, message: error?.response?.data?.message || '保存进度失败' };
    }
  }

  async getUserProgress(questionSetId?: string): Promise<ApiResponse<Record<string, ProgressStats>>> {
    try {
      // 优先使用缓存的用户ID，避免不必要的请求
      let userId = this.cachedUserId;
      
      // 如果没有缓存的用户ID，就获取当前用户
      if (!userId) {
        const currentUser = await userService.getCurrentUser();
        if (!currentUser.success || !currentUser.data) {
          throw new Error('无法获取当前用户信息');
        }
        userId = currentUser.data.id;
        this.cachedUserId = userId;
      }

      const url = questionSetId 
        ? `${this.baseUrl}/stats/${userId}?questionSetId=${questionSetId}`
        : `${this.baseUrl}/stats/${userId}`;

      console.log("获取用户进度，用户ID:", userId);

      // 使用apiClient的get方法，添加缓存和重试
      const response = await apiClient.get(url, undefined, {
        cacheDuration: 30000, // 缓存30秒
        retries: 2,
        retryDelay: 400
      });

      if (response.success && response.data) {
        // 确保每个进度记录都有lastAccessed字段，使用更严格的检查和默认值
        const processedData = Object.entries(response.data).reduce((acc, [key, value]) => {
          // 首先确保value是非空对象
          if (!value || typeof value !== 'object') {
            acc[key] = {
              questionSetId: key,
              completedQuestions: 0,
              totalQuestions: 0,
              correctAnswers: 0,
              totalTimeSpent: 0,
              averageTimeSpent: 0,
              accuracy: 0,
              lastAccessed: new Date().toISOString()
            } as ProgressStats;
            return acc;
          }
          
          const progressStats = value as ProgressStats;
          acc[key] = {
            ...progressStats,
            // 确保所有必要的字段都有默认值
            questionSetId: key,
            completedQuestions: progressStats.completedQuestions || 0,
            totalQuestions: progressStats.totalQuestions || 0,
            correctAnswers: progressStats.correctAnswers || 0,
            totalTimeSpent: progressStats.totalTimeSpent || 0,
            averageTimeSpent: progressStats.averageTimeSpent || 0,
            accuracy: progressStats.accuracy || 0,
            lastAccessed: progressStats.lastAccessed ? progressStats.lastAccessed : new Date().toISOString()
          };
          return acc;
        }, {} as Record<string, ProgressStats>);

        console.log("处理后的进度数据:", processedData);

        return {
          success: true,
          data: processedData
        };
      }

      return response;
    } catch (error: any) {
      console.error('获取用户进度失败:', error?.response?.data || error.message);
      return { success: false, message: error?.response?.data?.message || '获取用户进度失败' };
    }
  }

  async getUserProgressRecords(
    questionSetId?: string
  ): Promise<ApiResponse<any[]>> {
    try {
      const url = questionSetId 
        ? `${this.baseUrl}/records?questionSetId=${questionSetId}`
        : `${this.baseUrl}/records`;
      
      // 使用apiClient的get方法
      const response = await apiClient.get(url, undefined, {
        cacheDuration: 60000, // 缓存1分钟
        retries: 2
      });

      // 确保返回数据的安全性和一致性
      if (response.success && Array.isArray(response.data)) {
        // 确保每条记录都有必要的字段
        const processedRecords = response.data.map((record: any) => {
          return {
            ...record,
            questionId: record.questionId || '',
            questionSetId: record.questionSetId || '',
            selectedOption: record.selectedOption || [],
            isCorrect: Boolean(record.isCorrect),
            timeSpent: record.timeSpent || 0,
            createdAt: record.createdAt || new Date().toISOString(),
            updatedAt: record.updatedAt || new Date().toISOString()
          };
        });
        
        return {
          success: true,
          data: processedRecords
        };
      }
      
      return response.success 
        ? response 
        : { success: false, message: response.message || '获取记录失败', data: [] };
    } catch (error: any) {
      console.error('获取用户进度记录失败:', error?.response?.data || error.message);
      return { 
        success: false, 
        message: error?.response?.data?.message || '获取用户进度记录失败',
        data: [] // 返回空数组而不是 undefined
      };
    }
  }
  
  // 清除用户ID缓存，在用户登出时调用
  clearCachedUserId() {
    this.cachedUserId = null;
  }
}

export const userProgressService = new UserProgressService(); 