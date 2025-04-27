import { Question, Option } from '../types';

export const fetchQuestions = async (questionSetId: string): Promise<Question[]> => {
  const response = await fetch(`/api/question-sets/${questionSetId}/questions`);
  if (!response.ok) {
    throw new Error('Failed to fetch questions');
  }
  return response.json();
};

export const createQuestion = async (questionSetId: string, question: Omit<Question, 'id' | 'questionSetId'>): Promise<Question> => {
  const response = await fetch(`/api/question-sets/${questionSetId}/questions`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
    },
    body: JSON.stringify(question),
  });
  if (!response.ok) {
    throw new Error('Failed to create question');
  }
  return response.json();
};

export const updateQuestion = async (questionId: string, question: Partial<Question>): Promise<Question> => {
  const response = await fetch(`/api/questions/${questionId}`, {
    method: 'PUT',
    headers: {
      'Content-Type': 'application/json',
    },
    body: JSON.stringify(question),
  });
  if (!response.ok) {
    throw new Error('Failed to update question');
  }
  return response.json();
};

export const deleteQuestion = async (questionId: string): Promise<void> => {
  const response = await fetch(`/api/questions/${questionId}`, {
    method: 'DELETE',
  });
  if (!response.ok) {
    throw new Error('Failed to delete question');
  }
};

export const createOption = async (questionId: string, option: Omit<Option, 'id' | 'questionId'>): Promise<Option> => {
  const response = await fetch(`/api/questions/${questionId}/options`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
    },
    body: JSON.stringify(option),
  });
  if (!response.ok) {
    throw new Error('Failed to create option');
  }
  return response.json();
};

export const updateOption = async (optionId: string, option: Partial<Option>): Promise<Option> => {
  const response = await fetch(`/api/options/${optionId}`, {
    method: 'PUT',
    headers: {
      'Content-Type': 'application/json',
    },
    body: JSON.stringify(option),
  });
  if (!response.ok) {
    throw new Error('Failed to update option');
  }
  return response.json();
};

export const deleteOption = async (optionId: string): Promise<void> => {
  const response = await fetch(`/api/options/${optionId}`, {
    method: 'DELETE',
  });
  if (!response.ok) {
    throw new Error('Failed to delete option');
  }
}; 