export interface IUserProgress {
  completedQuestions: number;
  totalQuestions: number;
  correctAnswers: number;
  lastAccessed: Date | null;
}

export interface IPurchase {
  quizId: string;
  purchaseDate: Date;
  expiryDate: Date;
  transactionId: string;
  amount: number;
}

export interface IRedeemCode {
  code: string;
  questionSetId: string;
  validityDays: number;
  createdAt: Date;
  usedBy?: string;
  usedAt?: Date;
}

export interface IUser {
  id: string;
  username: string;
  email: string;
  password: string;
  isAdmin: boolean;
  progress: Record<string, IUserProgress>;
  purchases: IPurchase[];
  redeemCodes: IRedeemCode[];
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