export interface User {
  id: string;
  username: string;
  password?: string; 
  email: string;
  isAdmin: boolean;
  progress: Record<string, UserProgress>;
  purchases?: Purchase[];
  redeemCodes?: RedeemCode[];
}

export interface UserProgress {
  id: string;
  userId: string;
  questionSetId: string;
  questionId: string;
  isCorrect: boolean;
  timeSpent: number;
  completedQuestions: number;
  totalQuestions: number;
  correctAnswers: number;
  totalTimeSpent: number;
  averageTimeSpent: number;
  accuracy: number;
  lastAccessed: string;
  createdAt: string;
  updatedAt: string;
  title?: string;
}

export interface QuestionSet {
  id: string;
  title: string;
  description: string;
  category: string;
  icon: string;
  isPaid: boolean;
  price?: number;
  trialQuestions?: number;
  isFeatured?: boolean;
  featuredCategory?: string;
  createdAt?: Date;
  updatedAt?: Date;
  questions?: Question[];
  // Runtime properties
  hasAccess?: boolean;
  remainingDays?: number | null;
}

export type QuestionType = 'single' | 'multiple';

export interface Question {
  id: string | number;
  text: string;
  question?: string; // 兼容旧代码，text和question都可以访问题目内容
  options: Option[];
  explanation: string;
  questionType?: QuestionType;
  correctAnswer?: string | string[];
}

export interface Option {
  id: string;
  text: string;
  isCorrect?: boolean;
  optionIndex?: string;
  label?: string;
}

export interface Purchase {
  id?: string;
  userId?: string;
  questionSetId: string;
  purchaseDate: string;
  expiryDate: string;
  transactionId: string;
  amount: number;
  status?: string;
  paymentMethod?: string;
  purchaseQuestionSet?: QuestionSet;
}

export interface RedeemCode {
  code: string;
  questionSetId: string;
  validityDays: number;
  createdAt: string;
  usedBy?: string;
  usedAt?: string;
  quizId?: string; // 兼容旧代码
  expiryDate?: string;
}

export interface HomeContent {
  welcomeTitle: string;
  welcomeDescription: string;
  featuredCategories: string[];
  announcements: Announcement[] | string;
  footerText: string;
  bannerImage?: string;
  theme?: 'light' | 'dark' | 'auto';
}

export interface Announcement {
  id: string;
  title: string;
  content: string;
  date: string;
} 