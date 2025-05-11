import apiClient from '../utils/api-client';

// Base API URL for direct API calls
export const API_BASE_URL = process.env.NODE_ENV === 'production' 
  ? 'https://api.exam7.com' // Replace with your production API URL
  : 'http://localhost:3001'; // Replace with your local development API URL

// Homepage Service
export const homepageService = {
  // Get all home content
  getHomeContent: async (params?: any) => {
    return apiClient.get('/api/homepage/content', params);
  },
  
  // Get featured categories
  getFeaturedCategories: async () => {
    return apiClient.get('/api/home-content/featured-categories');
  },
  
  // Update featured categories
  updateFeaturedCategories: async (categories: string[]) => {
    return apiClient.post('/api/home-content/featured-categories', { categories });
  },
  
  // Update home content
  updateHomeContent: async (content: any) => {
    return apiClient.post('/api/home-content', content);
  }
};

// Question Set Service
export const questionSetService = {
  // Get all question sets
  getAll: async (params?: any) => {
    return apiClient.get('/api/question-sets', params);
  },
  
  // Get a single question set by ID
  getById: async (id: string) => {
    return apiClient.get(`/api/question-sets/${id}`);
  },
  
  // Create a new question set
  create: async (data: any) => {
    return apiClient.post('/api/question-sets', data);
  },
  
  // Update an existing question set
  update: async (id: string, data: any) => {
    return apiClient.put(`/api/question-sets/${id}`, data);
  },
  
  // Delete a question set
  delete: async (id: string) => {
    return apiClient.delete(`/api/question-sets/${id}`);
  }
};

// Question Service
export const questionService = {
  // Get questions for a question set
  getQuestions: async (questionSetId: string, params?: any) => {
    return apiClient.get(`/api/questions/${questionSetId}`, params);
  },
  
  // Create a new question
  create: async (data: any) => {
    return apiClient.post('/api/questions', data);
  },
  
  // Update an existing question
  update: async (id: string, data: any) => {
    return apiClient.put(`/api/questions/${id}`, data);
  },
  
  // Delete a question
  delete: async (id: string) => {
    return apiClient.delete(`/api/questions/${id}`);
  }
};

// User Service
export const userService = {
  // Get user profile
  getProfile: async () => {
    return apiClient.get('/api/users/profile');
  },
  
  // Update user profile
  updateProfile: async (data: any) => {
    return apiClient.put('/api/users/profile', data);
  },
  
  // Change password
  changePassword: async (data: {currentPassword: string, newPassword: string}) => {
    return apiClient.post('/api/users/change-password', data);
  }
};

// User Progress Service
export const userProgressService = {
  // Get user progress
  getUserProgress: async (userId?: string) => {
    return apiClient.get('/api/user-progress', { userId });
  },
  
  // Save user progress
  saveProgress: async (data: any) => {
    return apiClient.post('/api/user-progress', data);
  }
};

// Wrong Answer Service
export const wrongAnswerService = {
  // Get wrong answers for a user
  getWrongAnswers: async (userId?: string) => {
    return apiClient.get('/api/wrong-answers', { userId });
  },
  
  // Save wrong answer
  saveWrongAnswer: async (data: any) => {
    return apiClient.post('/api/wrong-answers', data);
  }
};

// Purchase Service
export const purchaseService = {
  // Create a purchase
  createPurchase: async (data: any) => {
    return apiClient.post('/api/purchases', data);
  },
  
  // Get purchases for a user
  getUserPurchases: async (userId?: string) => {
    return apiClient.get('/api/purchases', { userId });
  },
  
  // Verify payment status
  verifyPayment: async (paymentId: string) => {
    return apiClient.get(`/api/payments/verify/${paymentId}`);
  }
};

// Redeem Code Service
export const redeemCodeService = {
  // Redeem a code
  redeemCode: async (code: string) => {
    return apiClient.post('/api/redeem-codes/redeem', { code });
  },
  
  // Generate redeem codes (admin)
  generateCodes: async (data: {questionSetId: string, count: number, expiryDate?: string}) => {
    return apiClient.post('/api/redeem-codes/generate', data);
  },
  
  // Get redeem codes (admin)
  getCodes: async (params?: any) => {
    return apiClient.get('/api/redeem-codes', params);
  }
}; 