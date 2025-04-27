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
  completedQuestions: number;
  totalQuestions: number;
  correctAnswers: number;
  lastAccessed: string;
}

export interface QuestionSet {
  id: string;
  title: string;
  description: string;
  category: string;
  icon: string;
  questions: Question[];
  isPaid?: boolean;
  price?: number;
  trialQuestions?: number;
}

export interface Question {
  id: string;
  text: string;
  options: Option[];
  explanation: string;
  questionType?: 'single' | 'multiple';
  correctAnswer?: string | string[];
}

export interface Option {
  id: string;
  text: string;
  isCorrect: boolean;
}

export interface Purchase {
  quizId: string;
  purchaseDate: string;
  expiryDate: string;
  transactionId: string;
  amount: number;
}

export interface RedeemCode {
  code: string;
  questionSetId: string;
  validityDays: number;
  createdAt: string;
  usedBy?: string;
  usedAt?: string;
}

export interface HomeContent {
  welcomeTitle: string;
  welcomeDescription: string;
  featuredCategories: string[];
  announcements: Announcement[];
  footerText: string;
}

export interface Announcement {
  id: string;
  title: string;
  content: string;
  date: string;
} 