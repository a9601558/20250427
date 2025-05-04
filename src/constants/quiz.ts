// Local storage keys
export const STORAGE_KEYS = {
  // Access related
  ACCESS_RIGHTS: 'quizAccessRights',
  REDEEMED_SETS: 'redeemedQuestionSetIds',
  ACCESS_CACHE: 'questionSetAccessCache',
  REMAINING_DAYS: (id: string) => `quiz_remaining_days_${id}`,
  
  // Progress related
  PROGRESS: (id: string) => `quiz_progress_${id}`,
  COMPLETED: (id: string) => `quiz_completed_${id}`,
  QUIZ_STATE: (id: string) => `quiz_state_${id}`,
  LAST_QUESTION: (id: string) => `last_question_${id}`,
  ANSWERED_QUESTIONS: (id: string) => `answered_questions_${id}`,
  QUESTION_STATE: (setId: string, questionId: string) => `quiz_state_${setId}_${questionId}`,
  
  // Device related
  DEVICE_ID: 'deviceId',
  RESET_REQUIRED: 'quiz_reset_required',
};

// Socket event names
export const SOCKET_EVENTS = {
  // Access related
  ACCESS_UPDATE: 'questionSet:accessUpdate',
  CHECK_ACCESS: 'questionSet:checkAccess',
  
  // Purchase related
  PURCHASE_SUCCESS: 'purchase:success',
  
  // Progress related
  PROGRESS_UPDATE: 'progress:update',
  PROGRESS_GET: 'progress:get',
  PROGRESS_DATA: 'progress:data',
  PROGRESS_RESET: 'progress:reset',
  PROGRESS_RESET_RESULT: 'progress:reset:result',
  
  // Question set related
  QUESTION_SET_UPDATE: 'questionSet:update',
  
  // Quiz completion
  QUIZ_COMPLETE: 'quiz:complete',
  
  // Device sync
  DEVICE_SYNC: 'user:deviceSync',
  REQUEST_DEVICE_SYNC: 'user:requestDeviceSync',
};

// URL modes
export const URL_MODES = {
  WRONG_ANSWERS: 'wrong-answers',
};

// URL parameters
export const URL_PARAMS = {
  MODE: 'mode',
  QUESTIONS: 'questions',
  START: 'start',
  LAST_QUESTION: 'lastQuestion',
  RESET: 'reset',
  TIMESTAMP: 't',
};

// Time constants (in milliseconds)
export const TIME = {
  ONE_SECOND: 1000,
  ONE_MINUTE: 60 * 1000,
  FIVE_MINUTES: 5 * 60 * 1000,
  ONE_HOUR: 60 * 60 * 1000,
  ONE_DAY: 24 * 60 * 60 * 1000,
  SYNC_THROTTLE: 10 * 1000, // 10 seconds
  SYNC_TIMEOUT: 5 * 1000, // 5 seconds
  RESET_TIMEOUT: 5 * 1000, // 5 seconds
  SYNC_INTERVAL: 5 * 60 * 1000, // 5 minutes
};

// Common messages
export const MESSAGES = {
  UNSAVED_PROGRESS: 'You have unsaved progress. Are you sure you want to leave?',
  RESET_CONFIRMATION: 'Are you sure you want to clear your current progress? This will reset all answered questions, but won\'t affect already synced data on the server.',
  RESET_SUCCESS: 'Progress has been reset',
  SYNC_ERROR: 'Failed to sync progress. Will try again later.',
};

// Quiz status
export enum QuizStatus {
  LOADING = 'loading',
  ERROR = 'error',
  ACTIVE = 'active',
  PURCHASE_REQUIRED = 'purchase_required',
  COMPLETED = 'completed',
}; 