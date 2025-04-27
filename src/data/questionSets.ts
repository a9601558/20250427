import { Question } from './questions';

export interface QuestionSet {
  id: string;
  title: string;
  description: string;
  category: string;
  icon: string;
  isPaid: boolean;
  price?: number;
  trialQuestions?: number;
  questions?: Question[];
  questionCount?: number;
  isFeatured?: boolean;
  createdAt?: string;
  updatedAt?: string;
}

// 添加更多问题集相关接口... 