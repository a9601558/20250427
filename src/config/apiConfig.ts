// Configuration for API endpoints

// Determine if we're in development or production
const isDevelopment = process.env.NODE_ENV === 'development';

// Base URL for API requests
export const API_BASE_URL = isDevelopment 
  ? 'http://localhost:5000'  // Development server URL
  : window.location.origin;  // Production URL (same origin)

// API endpoints
export const API_ENDPOINTS = {
  // Question sets
  QUESTION_SETS: `${API_BASE_URL}/api/question-sets`,
  QUESTION_SET_BY_ID: (id: string) => `${API_BASE_URL}/api/question-sets/${id}`,
  
  // Questions
  QUESTIONS: `${API_BASE_URL}/api/questions`,
  QUESTION_COUNT: (questionSetId: string) => `${API_BASE_URL}/api/questions/count/${questionSetId}`,
  BATCH_UPLOAD_QUESTIONS: (questionSetId: string) => `${API_BASE_URL}/api/questions/batch-upload/${questionSetId}`,
  
  // Users
  USERS: `${API_BASE_URL}/api/users`,
  LOGIN: `${API_BASE_URL}/api/users/login`,
  REGISTER: `${API_BASE_URL}/api/users/register`,
  
  // Other endpoints
  HOMEPAGE: `${API_BASE_URL}/api/homepage`,
};

export default API_ENDPOINTS; 