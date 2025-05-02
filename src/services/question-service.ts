import { Question } from '../types';

// Using an interface that matches the ApiResponse in api.ts
interface ApiResponse<T> {
  success: boolean;
  data?: T;
  message?: string;
  error?: string;
}

// Question API service
export const questionService = {
  // Get questions by question set ID
  async getQuestionsBySetId(questionSetId: string): Promise<ApiResponse<Question[]>> {
    try {
      const { questionService } = await import('./api');
      return questionService.getQuestionsByQuestionSetId(questionSetId);
    } catch (error) {
      return { success: false, error: (error as Error).message };
    }
  },
  
  // Get a single question by ID
  async getQuestionById(questionId: string): Promise<ApiResponse<Question>> {
    try {
      const response = await fetch(`/api/questions/${questionId}`, {
        method: 'GET',
        headers: {
          'Authorization': `Bearer ${localStorage.getItem('token')}`,
        },
      });
      
      const data = await response.json();
      return data;
    } catch (error) {
      return { success: false, error: (error as Error).message };
    }
  },
  
  // Add a new question to a question set
  async addQuestion(questionSetId: string, questionData: Partial<Question>): Promise<ApiResponse<Question>> {
    try {
      const { questionService } = await import('./api');
      return questionService.addQuestion(questionSetId, questionData);
    } catch (error) {
      return { success: false, error: (error as Error).message };
    }
  },
  
  // Update an existing question
  async updateQuestion(questionId: string, questionData: Partial<Question>): Promise<ApiResponse<Question>> {
    try {
      const { questionService } = await import('./api');
      return questionService.updateQuestion(questionId, questionData);
    } catch (error) {
      return { success: false, error: (error as Error).message };
    }
  },
  
  // Delete a question
  async deleteQuestion(questionId: string): Promise<ApiResponse<void>> {
    try {
      const { questionService } = await import('./api');
      return questionService.deleteQuestion(questionId);
    } catch (error) {
      return { success: false, error: (error as Error).message };
    }
  },
  
  // Upload multiple questions at once
  async uploadQuestions(questionSetId: string, questions: Partial<Question>[]): Promise<ApiResponse<Question[]>> {
    try {
      const { questionService } = await import('./api');
      return questionService.uploadQuestions(questionSetId, questions);
    } catch (error) {
      return { success: false, error: (error as Error).message };
    }
  },
}; 