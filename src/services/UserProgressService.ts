import axios from 'axios';

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
      const response = await axios.post(`${this.baseUrl}/save`, params, {
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
      const url = questionSetId 
        ? `${this.baseUrl}/stats?questionSetId=${questionSetId}`
        : `${this.baseUrl}/stats`;
      const response = await axios.get(url, {
        headers: this.getAuthHeader()
      });
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
      return response.data;
    } catch (error: any) {
      console.error('获取用户进度记录失败:', error?.response?.data || error.message);
      return { 
        success: false, 
        message: error?.response?.data?.message || '获取用户进度记录失败' 
      };
    }
  }
}

export const userProgressService = new UserProgressService(); 