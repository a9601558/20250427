export interface IUserProgress {
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
  lastAccessed: Date;
  title?: string;
  createdAt: Date;
  updatedAt: Date;
}

export interface IQuestionSet {
  id: string;
  title: string;
  description: string;
  category: string;
  icon: string;
  isPaid: boolean;
  price: number;
  isFeatured: boolean;
  featuredCategory?: string;
  createdAt: Date;
  updatedAt: Date;
  progress?: {
    completedQuestions: number;
    totalQuestions: number;
    correctAnswers: number;
    lastAccessed: string;
  };
  questionCount?: number;
  trialQuestions?: number;
  questions?: Question[];
  hasAccess?: boolean;
}

export interface Question {
  id: string | number;
  text: string;
  question?: string;
  options: Option[];
  explanation: string;
  questionType?: 'single' | 'multiple';
  correctAnswer?: string | string[];
  orderIndex?: number;
}

export interface Option {
  id: string;
  text: string;
  isCorrect?: boolean;
  optionIndex?: string;
  label?: string;
  orderIndex?: number;
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
  socket_id?: string | null;
  purchases?: IPurchase[];
  redeemCodes?: IRedeemCode[];
  progress?: { [key: string]: any };
  examCountdowns?: string | any[];
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

export interface RedeemCode {
  id: string;
  code: string;
  questionSetId: string;
  validityDays: number;
  expiryDate?: string;
  isUsed: boolean;
  usedBy?: string;
  usedAt?: string;
  createdBy?: string;
  createdAt?: string;
  updatedAt?: string;
  redeemQuestionSet?: {
    id: string;
    title: string;
    description?: string;
    icon?: string;
    category?: string;
  };
  redeemUser?: {
    id: string;
    username: string;
    email?: string;
  };
  redeemCreator?: {
    id: string;
    username: string;
  };
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

export interface Purchase {
  id: string;
  userId: string;
  questionSetId: string;
  amount: number;
  currency: string;
  status: string;
  paymentMethod: string;
  expiryDate: string;
  createdAt: string;
  updatedAt: string;
  remainingDays?: number;
} 