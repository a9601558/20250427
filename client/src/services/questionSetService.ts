import { QuestionSet } from '../types';

export const fetchQuestionSets = async (): Promise<QuestionSet[]> => {
  const response = await fetch('/api/question-sets');
  if (!response.ok) {
    throw new Error('Failed to fetch question sets');
  }
  return response.json();
};

export const createQuestionSet = async (data: Omit<QuestionSet, 'id' | 'createdAt' | 'updatedAt'>): Promise<QuestionSet> => {
  const response = await fetch('/api/question-sets', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
    },
    body: JSON.stringify(data),
  });
  if (!response.ok) {
    throw new Error('Failed to create question set');
  }
  return response.json();
};

export const updateQuestionCount = async (questionSetId: string, count: number): Promise<void> => {
  const response = await fetch(`/api/question-sets/${questionSetId}/count`, {
    method: 'PUT',
    headers: {
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({ count }),
  });
  if (!response.ok) {
    throw new Error('Failed to update question count');
  }
}; 