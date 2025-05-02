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
  lastAccessed: Date | null;
  createdAt: Date;
  updatedAt: Date;
  progressQuestionSet?: IQuestionSet;
  progressQuestion?: IQuestion;
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
  purchaseQuestionSet?: IQuestionSet;
  purchaseUser?: IUser;
}

export interface IRedeemCode {
  id: string;
  code: string;
  questionSetId: string;
  validityDays: number;
  expiryDate: Date;
  isUsed: boolean;
  usedBy?: string;
  usedAt?: Date;
  createdBy: string;
  createdAt: Date;
  updatedAt: Date;
  redeemQuestionSet?: IQuestionSet;
  redeemUser?: IUser;
  redeemCreator?: IUser;
}

export interface IProgressSummary {
  completedQuestions: number;
  totalQuestions: number;
  correctAnswers: number;
  lastAccessed: Date;
}

export interface IUser {
  id: string;
  username: string;
  email: string;
  password: string;
  isAdmin: boolean;
  purchases: IPurchase[];
  redeemCodes?: IRedeemCode[];
  progress?: {
    [questionSetId: string]: IProgressSummary;
  };
  socket_id?: string | null;
  examCountdowns?: string | any[];
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
  price?: number;
  isFeatured?: boolean;
  featuredCategory?: string;
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
