export interface IUserProgress {
  id: string;
  userId: string;
  questionSetId: string;
  questionId: string;
  isCorrect: boolean;
  timeSpent: number;
  totalQuestions: number;
  correctAnswers: number;
  totalTimeSpent: number;
  averageTimeSpent: number;
  accuracy: number;
  title?: string;
  createdAt: Date;
  updatedAt: Date;
}

export interface QuestionSet {
  id: string;
  title: string;
  description: string;
  category: string;
  icon: string;
  isPaid: boolean;
  price: number;
  isFeatured: boolean;
  featuredCategory?: string;
  hasAccess: boolean;
  remainingDays?: number | null;
  trialQuestions?: number;
  createdAt: Date;
  updatedAt: Date;
}

export interface IQuestion {
  id: string;
  questionSetId: string;
  text: string;
  questionType: string;
  explanation: string;
  orderIndex: number;
  createdAt: Date;
  updatedAt: Date;
}

export interface IUser {
  id: string;
  username: string;
  email: string;
  password: string;
  isAdmin: boolean;
  createdAt: Date;
  updatedAt: Date;
}

export interface IPurchase {
  id: string;
  userId: string;
  questionSetId: string;
  amount: number;
  status: string;
  paymentMethod?: string;
  transactionId?: string;
  purchaseDate: Date;
  expiryDate: Date;
  createdAt: Date;
  updatedAt: Date;
}

export interface IRedeemCode {
  id: string;
  code: string;
  questionSetId: string;
  validityDays: number;
  usedBy?: string;
  usedAt?: Date;
  createdAt: Date;
  updatedAt: Date;
}

export interface IOption {
  id: string;
  questionId: string;
  text: string;
  isCorrect: boolean;
  orderIndex: number;
  createdAt: Date;
  updatedAt: Date;
} 