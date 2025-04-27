export interface Question {
  id: string;
  questionSetId: string;
  text: string;
  type: 'single' | 'multiple';
  points: number;
  createdAt: Date;
  updatedAt: Date;
}

export interface Option {
  id: string;
  questionId: string;
  text: string;
  isCorrect: boolean;
  createdAt: Date;
  updatedAt: Date;
}

export interface QuestionSet {
  id: string;
  title: string;
  description: string;
  questionCount: number;
  createdAt: Date;
  updatedAt: Date;
} 