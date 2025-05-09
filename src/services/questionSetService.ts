import { QuestionSet } from '../types';

// Using an interface that matches the ApiResponse in api.ts
interface ApiResponse<T> {
  success: boolean;
  data?: T;
  message?: string;
  error?: string;
}

// Interface for batch upload results
interface BatchUploadResult {
  success: number;
  failed: number;
  errors?: string[];
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
  },
  
  // Batch add questions to an existing question set (admin only)
  async batchAddQuestions(formData: FormData, onProgress?: (progress: number) => void): Promise<ApiResponse<BatchUploadResult>> {
    try {
      const token = localStorage.getItem('token');
      if (!token) {
        return { success: false, error: 'Authentication required' };
      }
      
      // Create a mock progress simulation if real progress tracking isn't available
      let progressInterval: number | null = null;
      let mockProgress = 0;
      
      if (onProgress) {
        // Start with a progress value of 10%
        onProgress(10);
        
        // Simulate progress updates
        progressInterval = window.setInterval(() => {
          mockProgress += 5;
          // Cap at 90% - we'll set it to 100% when the request completes
          if (mockProgress < 90) {
            onProgress(mockProgress);
          }
        }, 500) as unknown as number;
      }
      
      // Extract the questionSetId from the formData
      const questionSetId = formData.get('questionSetId') as string;
      if (!questionSetId) {
        return { success: false, error: 'No questionSetId provided' };
      }
      
      // Make the actual request - use the existing API endpoint for questions
      const response = await fetch(`/api/questions/batch-upload/${questionSetId}`, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${token}`
        },
        body: formData
      });
      
      // Clear the progress interval if it was set
      if (progressInterval !== null) {
        clearInterval(progressInterval);
      }
      
      // Set progress to 100% on completion
      if (onProgress) {
        onProgress(100);
      }
      
      const data = await response.json();
      
      if (!response.ok) {
        return { 
          success: false, 
          error: data.message || `Server returned ${response.status}` 
        };
      }
      
      // Update the question count after adding questions
      this.updateQuestionCount(questionSetId).catch(err => 
        console.error(`Failed to update question count for ${questionSetId}:`, err)
      );
      
      return {
        success: true,
        data: {
          success: data.successCount || 0,
          failed: data.failedCount || 0,
          errors: data.errors || []
        },
        message: data.message || 'Questions added successfully'
      };
    } catch (error) {
      return { success: false, error: (error as Error).message };
    }
  }
};

export default questionSetService; 