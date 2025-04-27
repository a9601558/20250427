export interface QuestionOption {
  id: string;
  text: string;
  isCorrect: boolean;
  optionIndex?: string;
}

export type QuestionType = 'single' | 'multiple';

export interface Question {
  id: string | number;
  text: string;
  explanation?: string;
  questionType: QuestionType;
  options: QuestionOption[];
  orderIndex?: number;
} 