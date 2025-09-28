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
}

interface ApiResponse<T> {
  success: boolean;
  data?: T;
  message?: string;
}

class UserProgressService {
  private baseUrl = '/api/user-progress';

  async saveProgress(params: SaveProgressParams): Promise<ApiResponse<void>> {
    try {
      const response = await axios.post(`${this.baseUrl}/save`, params);
      return response.data;
    } catch (error: any) {
      console.error('進捗の保存に失敗:', error?.response?.data || error.message);
      return { success: false, message: error?.response?.data?.message || '進捗の保存に失敗しました' };
    }
  }

  async getUserProgress(questionSetId?: string): Promise<ApiResponse<Record<string, ProgressStats>>> {
    try {
      const url = questionSetId 
        ? `${this.baseUrl}/stats?questionSetId=${questionSetId}`
        : `${this.baseUrl}/stats`;
      const response = await axios.get(url);
      return response.data;
    } catch (error: any) {
      console.error('ユーザー進捗の取得に失敗:', error?.response?.data || error.message);
      return { success: false, message: error?.response?.data?.message || 'ユーザー進捗の取得に失敗しました' };
    }
  }
}

export const userProgressService = new UserProgressService(); 