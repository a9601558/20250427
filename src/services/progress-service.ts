import { UserProgress } from '../types';

// Using an interface that matches the ApiResponse in api.ts
interface ApiResponse<T> {
  success: boolean;
  data?: T;
  message?: string;
  error?: string;
}

// Progress API service
export const progressService = {
  // Get all user progress
  async getUserProgress(): Promise<ApiResponse<Record<string, UserProgress>>> {
    try {
      // Import the services from api.ts to avoid circular dependencies
      const { userProgressService } = await import('./api');
      return userProgressService.getUserProgress();
    } catch (error) {
      return { success: false, error: (error as Error).message };
    }
  },
  
  // Get progress for a specific question set
  async getProgressByQuestionSetId(questionSetId: string): Promise<ApiResponse<UserProgress>> {
    try {
      const { userProgressService } = await import('./api');
      return userProgressService.getProgressByQuestionSetId(questionSetId);
    } catch (error) {
      return { success: false, error: (error as Error).message };
    }
  },
  
  // Update user progress
  async updateProgress(progress: Partial<UserProgress>): Promise<ApiResponse<UserProgress>> {
    try {
      // Ensure questionSetId exists in the request body
      if (!progress.questionSetId) {
        return {
          success: false,
          error: 'Question set ID (questionSetId) cannot be empty',
        };
      }
      
      const { userProgressService } = await import('./api');
      return userProgressService.updateProgress(progress);
    } catch (error) {
      return { success: false, error: (error as Error).message };
    }
  },
}; 