import { QuestionSet } from '../types';

export async function fetchQuestionSets(): Promise<QuestionSet[]> {
  try {
    const response = await fetch('/api/question-sets');
    if (!response.ok) {
      throw new Error('Failed to fetch question sets');
    }
    return await response.json();
  } catch (error) {
    console.error('Error fetching question sets:', error);
    throw error;
  }
}

export async function updateQuestionCount(questionSetId: string, count: number): Promise<QuestionSet> {
  try {
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

    return await response.json();
  } catch (error) {
    console.error('Error updating question count:', error);
    throw error;
  }
}

export async function createQuestionSet(questionSetData: Partial<QuestionSet>): Promise<QuestionSet> {
  try {
    const response = await fetch('/api/question-sets', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(questionSetData),
    });

    if (!response.ok) {
      throw new Error('Failed to create question set');
    }

    return await response.json();
  } catch (error) {
    console.error('Error creating question set:', error);
    throw error;
  }
} 