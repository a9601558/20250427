import axios from 'axios';
import { userService } from './api';

interface SaveProgressParams {
  questionId: string;
  questionSetId: string;
  selectedOption: string | string[];
  isCorrect: boolean;
  timeSpent: number;
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

      const response = await axios.post(`${this.baseUrl}/save`, validatedParams, {
        headers: this.getAuthHeader()
      });
      return response.data;
    } catch (error: any) {
      console.error('保存进度失败:', error?.response?.data || error.message);
      return { success: false, message: error?.response?.data?.message || '保存进度失败' };
    }
  }

  async getUserProgress(questionSetId?: string): Promise<ApiResponse<Record<string, ProgressStats>>> {
    try {
      const currentUser = await userService.getCurrentUser();
      if (!currentUser.success || !currentUser.data) {
        throw new Error('无法获取当前用户信息');
      }

      const url = questionSetId 
        ? `${this.baseUrl}/stats/${currentUser.data.id}?questionSetId=${questionSetId}`
        : `${this.baseUrl}/stats/${currentUser.data.id}`;

      console.log("获取用户进度，用户ID:", currentUser.data.id); // 添加日志

      const response = await axios.get(url, {
        headers: this.getAuthHeader()
      });

      if (response.data.success && response.data.data) {
        // 确保每个进度记录都有lastAccessed字段，使用更严格的检查和默认值
        const processedData = Object.entries(response.data.data).reduce((acc, [key, value]) => {
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

        console.log("处理后的进度数据:", processedData); // 添加日志

        return {
          success: true,
          data: processedData
        };
      }

      return response.data;
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
      
      const response = await axios.get(url, {
        headers: this.getAuthHeader()
      });

      // 确保返回数据的安全性和一致性
      if (response.data.success && Array.isArray(response.data.data)) {
        // 确保每条记录都有必要的字段
        const processedRecords = response.data.data.map((record: any) => {
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
      
      return response.data.success 
        ? response.data 
        : { success: false, message: response.data.message || '获取记录失败', data: [] };
    } catch (error: any) {
      console.error('获取用户进度记录失败:', error?.response?.data || error.message);
      return { 
        success: false, 
        message: error?.response?.data?.message || '获取用户进度记录失败',
        data: [] // 返回空数组而不是 undefined
      };
    }
  }
}

export const userProgressService = new UserProgressService(); 