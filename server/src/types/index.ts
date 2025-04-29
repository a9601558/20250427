export interface IUserProgress {
  completedQuestions: number;
  totalQuestions: number;
  correctAnswers: number;
  lastAccessed: Date | null;
}

export interface IPurchase {
  id: string;
  userId: string;
  questionSetId: string;
  purchaseDate: Date;
  expiryDate: Date;
  amount: number;
  status: string;
  paymentMethod?: string;
  transactionId?: string;
  createdAt: Date;
  updatedAt: Date;
}

export interface IRedeemCode {
  id: string;
  code: string;
  questionSetId: string;
  validUntil: Date;
  isUsed: boolean;
  usedBy?: string;
  createdAt: Date;
  updatedAt: Date;
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
    [questionSetId: string]: IUserProgress;
  };
  socket_id?: string | null;
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