export interface QuestionOption {
  id: string;
  text: string;
  isCorrect: boolean;
}

export interface Question {
  id: string;
  text: string;
  explanation?: string;
  questionType: 'single' | 'multiple';
  options: QuestionOption[];
} 