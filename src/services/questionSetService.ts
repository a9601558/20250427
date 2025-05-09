import { QuestionSet } from '../types';

// Using an interface that matches the ApiResponse in api.ts
interface ApiResponse<T> {
  success: boolean;
  data?: T;
  message?: string;
  error?: string;
}

// Question Set API service
export const questionSetService = {
  // Get all question sets
  async getAllQuestionSets(): Promise<ApiResponse<QuestionSet[]>> {
    try {
      const { questionSetService } = await import('./api');
      const response = await questionSetService.getAllQuestionSets();
      
      if (response.success && response.data) {
        // Get question counts for each question set
        const questionSetsWithCounts = await Promise.all(
          response.data.map(async (set) => {
            const count = await this.getQuestionCount(set.id);
            return {
              ...set,
              questionCount: count
            };
          })
        );
        
        return {
          success: true,
          data: questionSetsWithCounts
        };
      }
      
      return response;
    } catch (error) {
      return { success: false, error: (error as Error).message };
    }
  },
  
  // Get question sets by category
  async getQuestionSetsByCategory(category: string): Promise<ApiResponse<QuestionSet[]>> {
    try {
      const { questionSetService } = await import('./api');
      return questionSetService.getQuestionSetsByCategory(category);
    } catch (error) {
      return { success: false, error: (error as Error).message };
    }
  },
  
  // Get all categories
  async getAllCategories(): Promise<ApiResponse<string[]>> {
    try {
      const { questionSetService } = await import('./api');
      return questionSetService.getAllCategories();
    } catch (error) {
      return { success: false, error: (error as Error).message };
    }
  },
  
  // Get question set by ID
  async getQuestionSetById(id: string): Promise<ApiResponse<QuestionSet>> {
    try {
      const { questionSetService } = await import('./api');
      return questionSetService.getQuestionSetById(id);
    } catch (error) {
      return { success: false, error: (error as Error).message };
    }
  },
  
  // Create a new question set (admin only)
  async createQuestionSet(questionSetData: Partial<QuestionSet>): Promise<ApiResponse<QuestionSet>> {
    try {
      const { questionSetService } = await import('./api');
      return questionSetService.createQuestionSet(questionSetData);
    } catch (error) {
      return { success: false, error: (error as Error).message };
    }
  },
  
  // Update a question set (admin only)
  async updateQuestionSet(id: string, questionSetData: Partial<QuestionSet>): Promise<ApiResponse<QuestionSet>> {
    try {
      const { questionSetService } = await import('./api');
      return questionSetService.updateQuestionSet(id, questionSetData);
    } catch (error) {
      return { success: false, error: (error as Error).message };
    }
  },
  
  // Delete a question set (admin only)
  async deleteQuestionSet(id: string): Promise<ApiResponse<void>> {
    try {
      const { questionSetService } = await import('./api');
      return questionSetService.deleteQuestionSet(id);
    } catch (error) {
      return { success: false, error: (error as Error).message };
    }
  },
  
  // Update the question count for a question set
  async updateQuestionCount(questionSetId: string): Promise<ApiResponse<QuestionSet>> {
    try {
      const response = await fetch(`/api/question-sets/${questionSetId}/count`, {
        method: 'PUT',
        headers: {
          'Authorization': `Bearer ${localStorage.getItem('token')}`
        }
      });
      
      const data = await response.json();
      return data;
    } catch (error) {
      return { success: false, error: (error as Error).message };
    }
  },

  // Get question count for a question set
  async getQuestionCount(questionSetId: string): Promise<number> {
    try {
      const response = await fetch(`/api/questions/count/${questionSetId}`);
      if (!response.ok) {
        console.error(`Error fetching question count: API returned ${response.status}`);
        return 0;
      }
      
      const data = await response.json();
      console.log(`Question count response for ${questionSetId}:`, data);
      
      return data.count || 0;
    } catch (error) {
      console.error('Error getting question count:', error);
      return 0;
    }
  }
};

export default questionSetService; 