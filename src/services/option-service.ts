import { Option } from '../types';
import { logger } from '../utils/logger';

// Using an interface that matches the ApiResponse in api.ts
interface ApiResponse<T> {
  success: boolean;
  data?: T;
  message?: string;
  error?: string;
}

// Option API service
export const optionService = {
  // Add a new option to a question
  async addOption(questionId: string, optionData: Partial<Option>): Promise<ApiResponse<Option>> {
    try {
      const { questionService } = await import('./api');
      return questionService.addOption(questionId, optionData);
    } catch (error) {
      return { success: false, error: (error as Error).message };
    }
  },
  
  // Update an existing option
  async updateOption(optionId: string, optionData: Partial<Option>): Promise<ApiResponse<Option>> {
    try {
      const { questionService } = await import('./api');
      return questionService.updateOption(optionId, optionData);
    } catch (error) {
      return { success: false, error: (error as Error).message };
    }
  },
  
  // Delete an option
  async deleteOption(optionId: string): Promise<ApiResponse<void>> {
    try {
      const { questionService } = await import('./api');
      return questionService.deleteOption(optionId);
    } catch (error) {
      return { success: false, error: (error as Error).message };
    }
  },
  
  // Bulk add options to a question
  async bulkAddOptions(questionId: string, options: Partial<Option>[]): Promise<ApiResponse<Option[]>> {
    try {
      const { questionService } = await import('./api');
      return questionService.bulkAddOptions(questionId, options);
    } catch (error) {
      logger.error('Error bulk adding options:', error);
      return { success: false, error: 'Failed to bulk add options' };
    }
  },
}; 
