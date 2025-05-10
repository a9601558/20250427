import { QuestionSet } from '../types';
import API_ENDPOINTS from '../config/apiConfig';
import { uploadFile } from '../utils/apiUtils';

// Define ApiResponse interface here
interface ApiResponse<T = any> {
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

// Progress callback type
type ProgressCallback = (progress: number) => void;

// Question Set API service
export const questionSetService = {
  // Get all question sets
  async getAllQuestionSets(): Promise<ApiResponse<QuestionSet[]>> {
    try {
      const { questionSetService } = await import('./api');
      const response = await questionSetService.getAllQuestionSets();
      
      if (response.success && response.data) {
        console.log(`[QuestionSetService] Fetched ${response.data.length} question sets, adding question counts...`);
        
        // Get question counts for each question set
        const questionSetsWithCounts = await Promise.all(
          response.data.map(async (set) => {
            try {
              // Use the dedicated method instead of direct fetch to ensure consistent handling
              const count = await this.getQuestionCount(set.id);
              
              // Log successful count fetching
              if (count > 0) {
                console.log(`[QuestionSetService] Successfully got count for "${set.title}": ${count}`);
                return {
                  ...set,
                  questionCount: count
                };
              } else {
                console.warn(`[QuestionSetService] Zero count for "${set.title}", checking for embedded counts...`);
                
                // Check if the question set already has questions data that we can count
                // Add more potential sources of question count data
                const questionsCount = Array.isArray(set.questions) ? set.questions.length : 0;
                const questionSetQuestionsCount = Array.isArray((set as any).questionSetQuestions) ? (set as any).questionSetQuestions.length : 0;
                const existingCount = typeof set.questionCount === 'number' ? set.questionCount : 0;
                
                // Use the highest count value available
                const bestCount = Math.max(questionsCount, questionSetQuestionsCount, existingCount);
                
                if (bestCount > 0) {
                  console.log(`[QuestionSetService] Using embedded count for "${set.title}": ${bestCount}`);
                  return {
                    ...set,
                    questionCount: bestCount
                  };
                }
                
                // If we still have no count, use 0 but log a warning
                console.warn(`[QuestionSetService] Unable to determine count for "${set.title}", using 0`);
                return {
                  ...set,
                  questionCount: 0
                };
              }
            } catch (countError) {
              console.error(`[QuestionSetService] Error getting count for "${set.title}" (${set.id}):`, countError);
              
              // On error, still try to use embedded counts if available
              const questionsCount = Array.isArray(set.questions) ? set.questions.length : 0;
              const questionSetQuestionsCount = Array.isArray((set as any).questionSetQuestions) ? (set as any).questionSetQuestions.length : 0;
              const existingCount = typeof set.questionCount === 'number' ? set.questionCount : 0;
              
              const fallbackCount = Math.max(questionsCount, questionSetQuestionsCount, existingCount);
              if (fallbackCount > 0) {
                console.log(`[QuestionSetService] Using fallback count for "${set.title}": ${fallbackCount}`);
                return {
                  ...set,
                  questionCount: fallbackCount
                };
              }
              
              // Return the set with a count of 0 in case of error
              return {
                ...set,
                questionCount: 0
              };
            }
          })
        );
        
        return {
          success: true,
          data: questionSetsWithCounts
        };
      }
      
      return response;
    } catch (error) {
      console.error('[QuestionSetService] Error in getAllQuestionSets:', error);
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
      // Using the existing GET endpoint instead of PUT to a non-existent endpoint
      console.log(`[QuestionSetService] Updating question count for ${questionSetId}`);
      
      if (!questionSetId) {
        console.error('[QuestionSetService] Invalid questionSetId provided to updateQuestionCount');
        return { success: false, error: 'Invalid question set ID' };
      }
      
      // Use the existing getQuestionCount method which calls the correct endpoint
      const count = await this.getQuestionCount(questionSetId);
      
      console.log(`[QuestionSetService] Successfully retrieved count for ${questionSetId}: ${count}`);
      
      return {
        success: true,
        data: { questionCount: count } as any, // Cast as any for compatibility
        message: `Updated question count: ${count}`
      };
    } catch (error) {
      console.error(`[QuestionSetService] Error updating question count for ${questionSetId}:`, error);
      return { success: false, error: (error as Error).message };
    }
  },

  // Get question count for a question set
  async getQuestionCount(questionSetId: string): Promise<number> {
    try {
      console.log(`[QuestionSetService] Getting question count for ${questionSetId}`);
      
      // Make sure we have a valid ID
      if (!questionSetId) {
        console.error('[QuestionSetService] Invalid questionSetId provided to getQuestionCount');
        return 0;
      }
      
      const response = await fetch(`/api/questions/count/${questionSetId}`);
      
      if (!response.ok) {
        console.error(`[QuestionSetService] Error fetching question count: API returned ${response.status}`);
        return 0;
      }
      
      const data = await response.json();
      console.log(`[QuestionSetService] Question count response for ${questionSetId}:`, data);
      
      // Handle different response formats to ensure we extract the count
      if (data && typeof data.count === 'number') {
        return data.count;
      } else if (data && data.data && typeof data.data.count === 'number') {
        return data.data.count;
      } else if (data && typeof data.data === 'number') {
        return data.data;
      }
      
      // Log if we couldn't find the count
      console.warn(`[QuestionSetService] Could not find count in response for ${questionSetId}:`, data);
      return 0;
    } catch (error) {
      console.error(`[QuestionSetService] Error getting question count for ${questionSetId}:`, error);
      return 0;
    }
  },
  
  // Batch add questions to an existing question set (admin only)
  async batchAddQuestions(formData: FormData, onProgress?: ProgressCallback): Promise<ApiResponse<BatchUploadResult>> {
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
      
      // Properly construct the URL using relative paths
      // This ensures it works regardless of the current domain
      const endpoint = `/api/questions/batch-upload/${questionSetId}`;
      console.log(`Sending batch upload request to: ${endpoint}`);
      
      // Make the actual request with relative path
      const response = await fetch(endpoint, {
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
        console.error(`Batch upload failed: ${response.status} ${response.statusText}`, data);
        return { 
          success: false, 
          error: data.message || `Server returned ${response.status}` 
        };
      }
      
      // Update the question count after adding questions
      try {
        console.log(`[QuestionSetService] Refreshing question count for set ${questionSetId}`);
        await this.updateQuestionCount(questionSetId);
        console.log(`[QuestionSetService] Successfully refreshed question count for set ${questionSetId}`);
      } catch (countError) {
        // Log the error but don't fail the entire operation
        console.error(`[QuestionSetService] Failed to update question count for ${questionSetId}:`, countError);
        // We'll continue despite this error
      }
      
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
      console.error('Batch upload error:', error);
      return { success: false, error: (error as Error).message };
    }
  },
  
  /**
   * Create a new question set with batch questions
   * @param formData FormData containing the file and question set data
   * @param onProgress Optional callback for progress updates
   * @returns ApiResponse with success/error information
   */
  batchCreateQuestionSet: async (formData: FormData, onProgress?: ProgressCallback): Promise<ApiResponse<any>> => {
    try {
      // Check if FormData contains required fields
      if (!formData.has('file') || !formData.has('title') || !formData.has('description') || !formData.has('category')) {
        console.error('[QuestionSetService] Missing required fields in FormData');
        return {
          success: false,
          message: '缺少必要的表单数据',
          error: 'Missing required fields: file, title, description, or category'
        };
      }
      
      console.log('[QuestionSetService] Sending batch create question set request');
      
      // Create XMLHttpRequest to support progress tracking
      return new Promise((resolve, reject) => {
        const xhr = new XMLHttpRequest();
        
        // Track upload progress if callback provided
        if (onProgress) {
          xhr.upload.addEventListener('progress', (event) => {
            if (event.lengthComputable) {
              const percentComplete = Math.round((event.loaded / event.total) * 100);
              onProgress(percentComplete);
            }
          });
        }
        
        // Handle response
        xhr.onload = function() {
          if (xhr.status >= 200 && xhr.status < 300) {
            try {
              const response = JSON.parse(xhr.responseText);
              resolve(response);
            } catch (error) {
              console.error('[QuestionSetService] Error parsing response:', error);
              reject({
                success: false,
                message: '解析响应失败',
                error: 'Error parsing response'
              });
            }
          } else {
            console.error('[QuestionSetService] Request failed:', xhr.statusText);
            reject({
              success: false,
              message: '请求失败',
              error: xhr.statusText
            });
          }
        };
        
        // Handle network errors
        xhr.onerror = function() {
          console.error('[QuestionSetService] Network error');
          reject({
            success: false,
            message: '网络错误',
            error: 'Network error'
          });
        };
        
        // Open and send request
        const apiUrl = '/api/question-sets/batch-create';
        xhr.open('POST', apiUrl);
        
        // Send FormData
        xhr.send(formData);
      });
    } catch (error) {
      console.error('[QuestionSetService] Batch create question set error:', error);
      return {
        success: false,
        message: '创建题库失败',
        error: error instanceof Error ? error.message : String(error)
      };
    }
  }
};

// Add a specialized function for refreshing question counts
export const refreshQuestionCounts = async (questionSets: QuestionSet[], forceAll = false): Promise<QuestionSet[]> => {
  console.log(`[QuestionSetService] Refreshing counts for ${questionSets.length} question sets (forceAll: ${forceAll})`);
  
  const results = await Promise.all(
    questionSets.map(async (set) => {
      try {
        // Skip refresh for sets without an ID
        if (!set.id) {
          console.warn('[QuestionSetService] Skipping count refresh for question set with no ID');
          return set;
        }
        
        // Skip sets that already have a count, unless forceAll is true
        const hasValidCount = typeof set.questionCount === 'number' && set.questionCount > 0;
        if (hasValidCount && !forceAll) {
          console.log(`[QuestionSetService] Skipping refresh for "${set.title}", already has count: ${set.questionCount}`);
          return set;
        }
        
        const count = await questionSetService.getQuestionCount(set.id);
        console.log(`[QuestionSetService] Refreshed count for "${set.title}": ${count}`);
        
        return {
          ...set,
          questionCount: count
        };
      } catch (error) {
        console.error(`[QuestionSetService] Error refreshing count for "${set.title}":`, error);
        // Keep the existing count if there was an error
        return set;
      }
    })
  );
  
  console.log(`[QuestionSetService] Successfully refreshed ${results.length} question set counts`);
  return results;
};

export default questionSetService; 