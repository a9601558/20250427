import { Question, User, QuestionSet, UserProgress, ApiResponse, AccessCheckResult } from '../types';
import apiClient from '../utils/unified-api-client';

// API基础URL
export const API_BASE_URL = '/api';

// =============================================================================
// 用户API服务 (User Service)
// =============================================================================
export const userService = {
  // 获取当前用户信息 (使用AWS Cognito认证)
  async getCurrentUser(): Promise<ApiResponse<User>> {
    try {
      return await apiClient.get<ApiResponse<User>>('/users/me');
    } catch (error: any) {
      console.error('获取用户信息失败:', error);
      return {
        success: false,
        message: 'ユーザー情報の取得に失敗しました',
        error: error.message
      };
    }
  },

  // 更新用户信息
  async updateUser(userId: string, userData: Partial<User>): Promise<ApiResponse<User>> {
    try {
      return await apiClient.put<ApiResponse<User>>(`/users/${userId}`, userData);
    } catch (error: any) {
      console.error('更新用户信息失败:', error);
      return {
        success: false,
        message: 'ユーザー情報の更新に失敗しました',
        error: error.message
      };
    }
  },

  // 获取所有用户 (管理员功能)
  async getAllUsers(): Promise<ApiResponse<User[]>> {
    try {
      return await apiClient.get<ApiResponse<User[]>>('/users');
    } catch (error: any) {
      console.error('获取用户列表失败:', error);
      return {
        success: false,
        message: 'ユーザーリストの取得に失敗しました',
        error: error.message
      };
    }
  },

  // 删除用户 (管理员功能)
  async deleteUser(userId: string): Promise<ApiResponse<void>> {
    try {
      return await apiClient.delete<ApiResponse<void>>(`/users/${userId}`);
    } catch (error: any) {
      console.error('删除用户失败:', error);
      return {
        success: false,
        message: 'ユーザーの削除に失敗しました',
        error: error.message
      };
    }
  },

  // 更新用户权限 (管理员功能)
  async updateUserRole(userId: string, isAdmin: boolean): Promise<ApiResponse<User>> {
    try {
      return await apiClient.put<ApiResponse<User>>(`/users/${userId}/role`, { isAdmin });
    } catch (error: any) {
      console.error('更新用户权限失败:', error);
      return {
        success: false,
        message: 'ユーザー権限の更新に失敗しました',
        error: error.message
      };
    }
  }
};

// =============================================================================
// 题库API服务 (Question Set Service) - 优化了批量查询
// =============================================================================
export const questionSetService = {
  // 获取所有题库 (使用批量查询优化)
  async getAllQuestionSets(): Promise<ApiResponse<QuestionSet[]>> {
    try {
      const response = await apiClient.get<ApiResponse<QuestionSet[]>>('/question-sets', null, {
        cacheDuration: 30000 // 缓存30秒
      });
      
      // 如果成功获取题库，批量查询题目数量
      if (response.success && response.data) {
        const questionSetIds = response.data.map(set => set.id);
        const countsResponse = await apiClient.getBatchQuestionCounts(questionSetIds);
        
        if (countsResponse.success) {
          // 将题目数量附加到题库数据中
          response.data = response.data.map(set => ({
            ...set,
            questionCount: countsResponse.data[set.id] || 0
          }));
        }
      }
      
      return response;
    } catch (error: any) {
      console.error('获取题库列表失败:', error);
      return {
        success: false,
        message: '題庫リストの取得に失敗しました',
        error: error.message
      };
    }
  },

  // 按分类获取题库
  async getQuestionSetsByCategory(category: string): Promise<ApiResponse<QuestionSet[]>> {
    try {
      const response = await apiClient.get<ApiResponse<QuestionSet[]>>(`/question-sets/by-category/${category}`, null, {
        cacheDuration: 30000
      });
      
      // 批量查询题目数量
      if (response.success && response.data) {
        const questionSetIds = response.data.map(set => set.id);
        const countsResponse = await apiClient.getBatchQuestionCounts(questionSetIds);
        
        if (countsResponse.success) {
          response.data = response.data.map(set => ({
            ...set,
            questionCount: countsResponse.data[set.id] || 0
          }));
        }
      }
      
      return response;
    } catch (error: any) {
      console.error('按分类获取题库失败:', error);
      return {
        success: false,
        message: 'カテゴリ別題庫の取得に失敗しました',
        error: error.message
      };
    }
  },

  // 获取所有分类
  async getAllCategories(): Promise<ApiResponse<string[]>> {
    try {
      return await apiClient.get<ApiResponse<string[]>>('/question-sets/categories', null, {
        cacheDuration: 300000 // 分类变化较少，缓存5分钟
      });
    } catch (error: any) {
      console.error('获取分类列表失败:', error);
      return {
        success: false,
        message: 'カテゴリリストの取得に失敗しました',
        error: error.message
      };
    }
  },

  // 获取题库详情
  async getQuestionSetById(id: string): Promise<ApiResponse<QuestionSet>> {
    try {
      const response = await apiClient.get<ApiResponse<QuestionSet>>(`/question-sets/${id}`, null, {
        cacheDuration: 60000 // 缓存1分钟
      });
      
      // 获取题目数量
      if (response.success && response.data) {
        const countsResponse = await apiClient.getBatchQuestionCounts([id]);
        if (countsResponse.success) {
          response.data.questionCount = countsResponse.data[id] || 0;
        }
      }
      
      return response;
    } catch (error: any) {
      console.error('获取题库详情失败:', error);
      return {
        success: false,
        message: '題庫詳細の取得に失敗しました',
        error: error.message
      };
    }
  },

  // 创建题库 (管理员功能)
  async createQuestionSet(questionSetData: Partial<QuestionSet>): Promise<ApiResponse<QuestionSet>> {
    try {
      const response = await apiClient.post<ApiResponse<QuestionSet>>('/question-sets', questionSetData);
      // 清除相关缓存
      apiClient.clearCacheFor('/question-sets');
      apiClient.clearCacheFor('/question-sets/categories');
      return response;
    } catch (error: any) {
      console.error('创建题库失败:', error);
      return {
        success: false,
        message: '題庫の作成に失敗しました',
        error: error.message
      };
    }
  },

  // 更新题库 (管理员功能)
  async updateQuestionSet(id: string, questionSetData: Partial<QuestionSet>): Promise<ApiResponse<QuestionSet>> {
    try {
      const response = await apiClient.put<ApiResponse<QuestionSet>>(`/question-sets/${id}`, questionSetData);
      // 清除相关缓存
      apiClient.clearCacheFor(`/question-sets/${id}`);
      apiClient.clearCacheFor('/question-sets');
      return response;
    } catch (error: any) {
      console.error('更新题库失败:', error);
      return {
        success: false,
        message: '題庫の更新に失敗しました',
        error: error.message
      };
    }
  },

  // 批量更新题库的题目
  async updateQuestionSetQuestions(id: string, data: { questions: any[] }): Promise<ApiResponse<QuestionSet>> {
    try {
      const response = await apiClient.put<ApiResponse<QuestionSet>>(`/question-sets/${id}/questions`, data);
      // 清除相关缓存
      apiClient.clearCacheFor(`/question-sets/${id}`);
      return response;
    } catch (error: any) {
      console.error('批量更新题目失败:', error);
      return {
        success: false,
        message: '問題の一括更新に失敗しました',
        error: error.message
      };
    }
  },

  // 删除题库 (管理员功能)
  async deleteQuestionSet(id: string): Promise<ApiResponse<void>> {
    try {
      const response = await apiClient.delete<ApiResponse<void>>(`/question-sets/${id}`);
      // 清除相关缓存
      apiClient.clearCacheFor(`/question-sets/${id}`);
      apiClient.clearCacheFor('/question-sets');
      return response;
    } catch (error: any) {
      console.error('删除题库失败:', error);
      return {
        success: false,
        message: '題庫の削除に失敗しました',
        error: error.message
      };
    }
  },

  // 批量上传题库
  async uploadQuestionSets(
    questionSets: Partial<QuestionSet>[]
  ): Promise<ApiResponse<QuestionSet[]>> {
    try {
      const response = await apiClient.post<ApiResponse<QuestionSet[]>>('/question-sets/upload', { questionSets });
      // 清除缓存
      apiClient.clearCacheFor('/question-sets');
      return response;
    } catch (error: any) {
      console.error('批量上传题库失败:', error);
      return {
        success: false,
        message: '題庫の一括アップロードに失敗しました',
        error: error.message
      };
    }
  },

  // 获取精选题库
  async getFeaturedQuestionSets(): Promise<ApiResponse<QuestionSet[]>> {
    try {
      const response = await apiClient.get<ApiResponse<QuestionSet[]>>('/question-sets/featured', null, {
        cacheDuration: 60000 // 缓存1分钟
      });
      
      // 批量查询题目数量
      if (response.success && response.data) {
        const questionSetIds = response.data.map(set => set.id);
        const countsResponse = await apiClient.getBatchQuestionCounts(questionSetIds);
        
        if (countsResponse.success) {
          response.data = response.data.map(set => ({
            ...set,
            questionCount: countsResponse.data[set.id] || 0
          }));
        }
      }
      
      return response;
    } catch (error: any) {
      console.error('获取精选题库失败:', error);
      return {
        success: false,
        message: '特集題庫の取得に失敗しました',
        error: error.message
      };
    }
  },

  // 设置题库精选状态 (管理员功能)
  async setFeaturedQuestionSet(id: string, isFeatured: boolean, featuredCategory?: string): Promise<ApiResponse<QuestionSet>> {
    try {
      const response = await apiClient.put<ApiResponse<QuestionSet>>(`/question-sets/${id}/featured`, {
        isFeatured,
        featuredCategory
      });
      // 清除相关缓存
      apiClient.clearCacheFor('/question-sets/featured');
      apiClient.clearCacheFor(`/question-sets/${id}`);
      return response;
    } catch (error: any) {
      console.error('设置精选状态失败:', error);
      return {
        success: false,
        message: '特集設定に失敗しました',
        error: error.message
      };
    }
  },

  // 获取题目数量 (已废弃，使用批量查询替代)
  async getQuestionCount(questionSetId: string): Promise<ApiResponse<{count: number}>> {
    console.warn('[API] getQuestionCount is deprecated, use getBatchQuestionCounts instead');
    try {
      const response = await apiClient.getBatchQuestionCounts([questionSetId]);
      if (response.success) {
        return {
          success: true,
          data: { count: response.data[questionSetId] || 0 }
        };
      } else {
        return {
          success: false,
          message: response.error || '题目数量获取失败'
        };
      }
    } catch (error: any) {
      console.error('获取题目数量失败:', error);
      return {
        success: false,
        message: '問題数の取得に失敗しました',
        error: error.message
      };
    }
  }
};

// =============================================================================
// 用户进度API服务 (User Progress Service)
// =============================================================================
export const userProgressService = {
  // 获取用户进度
  async getUserProgress(): Promise<ApiResponse<Record<string, UserProgress>>> {
    try {
      return await apiClient.get<ApiResponse<Record<string, UserProgress>>>('/user-progress/stats', null, {
        cacheDuration: 10000 // 进度数据缓存较短，10秒
      });
    } catch (error: any) {
      console.error('获取用户进度失败:', error);
      return {
        success: false,
        message: 'ユーザー進捗の取得に失敗しました',
        error: error.message
      };
    }
  },

  // 更新用户进度
  async updateProgress(progressData: Partial<UserProgress>): Promise<ApiResponse<UserProgress>> {
    try {
      const response = await apiClient.put<ApiResponse<UserProgress>>('/user-progress', progressData);
      // 清除进度相关缓存
      apiClient.clearCacheFor('/user-progress/stats');
      return response;
    } catch (error: any) {
      console.error('更新用户进度失败:', error);
      return {
        success: false,
        message: 'ユーザー進捗の更新に失敗しました',
        error: error.message
      };
    }
  },

  // 获取用户进度记录
  async getUserProgressRecords(questionSetId?: string): Promise<ApiResponse<any[]>> {
    try {
      const url = questionSetId 
        ? `/user-progress/records?questionSetId=${questionSetId}`
        : `/user-progress/records`;
      
      const response = await apiClient.get<ApiResponse<any[]>>(url, null, {
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
      console.error('获取用户进度记录失败:', error);
      return { 
        success: false, 
        message: 'ユーザー進捗記録の取得に失敗しました',
        data: [] // 返回空数组而不是 undefined
      };
    }
  }
};

// =============================================================================
// 题目API服务 (Question Service)
// =============================================================================
export const questionService = {
  // 获取题目列表
  async getQuestions(questionSetId: string, includeOptions = true): Promise<ApiResponse<Question[]>> {
    try {
      return await apiClient.get<ApiResponse<Question[]>>('/questions', {
        questionSetId,
        include: includeOptions ? 'options' : ''
      }, {
        cacheDuration: 60000 // 题目数据相对稳定，缓存1分钟
      });
    } catch (error: any) {
      console.error('获取题目列表失败:', error);
      return {
        success: false,
        message: '問題リストの取得に失敗しました',
        error: error.message
      };
    }
  },

  // 删除题目 (管理员功能)
  async deleteQuestion(questionSetId: string, questionId: string): Promise<ApiResponse<void>> {
    try {
      const response = await apiClient.delete<ApiResponse<void>>(`/questions/${questionId}`);
      
      if (response.success) {
        // 清除相关缓存
        apiClient.clearCacheFor(`/question-sets/${questionSetId}`);
        apiClient.clearCacheFor('/questions');
      }
      
      return response;
    } catch (error: any) {
      console.error('删除题目失败:', error);
      return {
        success: false,
        message: '問題の削除に失敗しました',
        error: error.message
      };
    }
  },

  // 创建题目 (管理员功能)
  async createQuestion(questionSetId: string, questionData: any): Promise<ApiResponse<any>> {
    try {
      const response = await apiClient.post<ApiResponse<any>>('/questions', {
        ...questionData,
        questionSetId
      });
      
      if (response.success) {
        // 清除相关缓存
        apiClient.clearCacheFor(`/question-sets/${questionSetId}`);
        apiClient.clearCacheFor('/questions');
      }
      
      return response;
    } catch (error: any) {
      console.error('创建题目失败:', error);
      return {
        success: false,
        message: '問題の作成に失敗しました',
        error: error.message
      };
    }
  },

  // 更新题目 (管理员功能)
  async updateQuestion(questionSetId: string, questionId: string, questionData: any): Promise<ApiResponse<any>> {
    try {
      const response = await apiClient.put<ApiResponse<any>>(`/questions/${questionId}`, questionData);
      
      if (response.success) {
        // 清除相关缓存
        apiClient.clearCacheFor(`/question-sets/${questionSetId}`);
        apiClient.clearCacheFor('/questions');
      }
      
      return response;
    } catch (error: any) {
      console.error('更新题目失败:', error);
      return {
        success: false,
        message: '問題の更新に失敗しました',
        error: error.message
      };
    }
  }
};

// =============================================================================
// 购买服务 (Purchase Service)
// =============================================================================
export const purchaseService = {
  // 检查访问权限
  async checkAccess(questionSetId: string): Promise<AccessCheckResult> {
    try {
      const response = await apiClient.get<ApiResponse<AccessCheckResult>>(`/purchases/check/${questionSetId}`, null, {
        cacheDuration: 30000 // 购买状态缓存30秒
      });
      
      if (response.success && response.data) {
        return response.data;
      } else {
        return {
          hasAccess: false,
          isPaid: false
        };
      }
    } catch (error: any) {
      console.error('检查访问权限失败:', error);
      return {
        hasAccess: false,
        isPaid: false
      };
    }
  },

  // 获取用户购买历史
  async getUserPurchases(): Promise<any> {
    try {
      const response = await apiClient.get<ApiResponse<any>>('/purchases', null, {
        cacheDuration: 60000 // 购买历史缓存1分钟
      });
      
      if (response.success) {
        return response;
      } else {
        throw new Error(response.message || '获取购买历史失败');
      }
    } catch (error: any) {
      console.error('获取购买历史失败:', error);
      throw error;
    }
  },

  // 获取用户兑换码历史
  async getUserRedeemCodes(): Promise<any> {
    try {
      const response = await apiClient.get<ApiResponse<any>>('/redeem-codes/user', null, {
        cacheDuration: 60000 // 兑换历史缓存1分钟
      });
      
      if (response.success) {
        return response;
      } else {
        throw new Error(response.message || '获取兑换历史失败');
      }
    } catch (error: any) {
      console.error('获取兑换历史失败:', error);
      throw error;
    }
  }
};

// =============================================================================
// 兑换码服务 (Redeem Code Service)
// =============================================================================
export const redeemCodeService = {
  // 使用兑换码
  async redeemCode(code: string): Promise<ApiResponse<any>> {
    try {
      return await apiClient.post<ApiResponse<any>>('/redeem-codes/redeem', { code });
    } catch (error: any) {
      console.error('兑换码使用失败:', error);
      return {
        success: false,
        message: '引換コードの使用に失敗しました',
        error: error.message
      };
    }
  },

  // 生成兑换码 (管理员功能)
  async generateRedeemCodes(questionSetId: string, validityDays: number, quantity: number): Promise<ApiResponse<any>> {
    try {
      return await apiClient.post<ApiResponse<any>>('/redeem-codes/generate', {
        questionSetId,
        validityDays,
        quantity
      });
    } catch (error: any) {
      console.error('生成兑换码失败:', error);
      return {
        success: false,
        message: '引換コードの生成に失敗しました',
        error: error.message
      };
    }
  },

  // 获取所有兑换码 (管理员功能)
  async getAllRedeemCodes(): Promise<ApiResponse<any[]>> {
    try {
      return await apiClient.get<ApiResponse<any[]>>('/redeem-codes', null, {
        cacheDuration: 30000 // 兑换码数据缓存30秒
      });
    } catch (error: any) {
      console.error('获取兑换码列表失败:', error);
      return {
        success: false,
        message: '引換コードリストの取得に失敗しました',
        error: error.message
      };
    }
  }
};

// =============================================================================
// 首页内容服务 (Homepage Service)
// =============================================================================
export const homepageService = {
  // 获取首页内容
  async getHomeContent(params?: any): Promise<ApiResponse<any>> {
    try {
      return await apiClient.get<ApiResponse<any>>('/homepage/content', params, {
        cacheDuration: 300000 // 首页内容变化较少，缓存5分钟
      });
    } catch (error: any) {
      console.error('获取首页内容失败:', error);
      return {
        success: false,
        message: 'ホームページコンテンツの取得に失敗しました',
        error: error.message
      };
    }
  },

  // 更新首页内容 (管理员功能)
  async updateHomeContent(contentData: any): Promise<ApiResponse<any>> {
    try {
      const response = await apiClient.put<ApiResponse<any>>('/homepage/content', contentData);
      // 清除首页内容相关缓存
      apiClient.clearCacheFor('/homepage/content');
      apiClient.clearCacheFor('/homepage/featured-categories');
      return response;
    } catch (error: any) {
      console.error('更新首页内容失败:', error);
      return {
        success: false,
        message: 'ホームページコンテンツの更新に失敗しました',
        error: error.message
      };
    }
  },

  // 获取精选分类
  async getFeaturedCategories(): Promise<ApiResponse<any>> {
    try {
      return await apiClient.get<ApiResponse<any>>('/homepage/featured-categories', null, {
        cacheDuration: 300000 // 精选分类变化较少，缓存5分钟
      });
    } catch (error: any) {
      console.error('获取精选分类失败:', error);
      return {
        success: false,
        message: '特集カテゴリの取得に失敗しました',
        error: error.message
      };
    }
  }
};

// =============================================================================
// 错题服务 (Wrong Answer Service)
// =============================================================================
export const wrongAnswerService = {
  // 获取错题列表
  async getWrongAnswers(): Promise<ApiResponse<any[]>> {
    try {
      return await apiClient.get<ApiResponse<any[]>>('/wrong-answers', null, {
        cacheDuration: 30000 // 错题数据缓存30秒
      });
    } catch (error: any) {
      console.error('获取错题列表失败:', error);
      return {
        success: false,
        message: '間違い問題リストの取得に失敗しました',
        error: error.message
      };
    }
  },

  // 删除错题
  async deleteWrongAnswer(wrongAnswerId: string): Promise<ApiResponse<any>> {
    try {
      const response = await apiClient.delete<ApiResponse<any>>(`/wrong-answers/${wrongAnswerId}`);
      
      if (response.success) {
        // 清除相关缓存
        apiClient.clearCacheFor('/wrong-answers');
      }
      
      return response;
    } catch (error: any) {
      console.error('删除错题失败:', error);
      return {
        success: false,
        message: '間違い問題の削除に失敗しました',
        error: error.message
      };
    }
  },

  // 更新错题备注
  async updateMemo(wrongAnswerId: string, memo: string): Promise<ApiResponse<any>> {
    try {
      const response = await apiClient.put<ApiResponse<any>>(`/wrong-answers/${wrongAnswerId}/memo`, { memo });
      
      if (response.success) {
        // 清除相关缓存
        apiClient.clearCacheFor('/wrong-answers');
      }
      
      return response;
    } catch (error: any) {
      console.error('更新备注失败:', error);
      return {
        success: false,
        message: 'メモの更新に失敗しました',
        error: error.message
      };
    }
  }
};

// =============================================================================
// 导出统一的API客户端实例 (供其他模块使用)
// =============================================================================
export { apiClient };

// 向后兼容性导出 (逐步迁移后可以移除)
export default {
  userService,
  questionSetService,
  questionService,
  userProgressService,
  purchaseService,
  redeemCodeService,
  homepageService,
  wrongAnswerService
};