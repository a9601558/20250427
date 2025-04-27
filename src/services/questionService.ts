import { Question, Option } from '../types';

export async function fetchQuestions(questionSetId: string): Promise<Question[]> {
  try {
    const response = await fetch(`/api/question-sets/${questionSetId}/questions`);
    
    if (!response.ok) {
      throw new Error('Failed to fetch questions');
    }
    
    return await response.json();
  } catch (error) {
    console.error('Error fetching questions:', error);
    throw error;
  }
}

export async function getQuestionById(questionId: string): Promise<Question> {
  try {
    const response = await fetch(`/api/questions/${questionId}`);
    
    if (!response.ok) {
      throw new Error('Failed to fetch question');
    }
    
    return await response.json();
  } catch (error) {
    console.error('Error fetching question:', error);
    throw error;
  }
}

export async function createQuestion(questionSetId: string, questionData: { 
  text: string, 
  options: Partial<Option>[] 
}): Promise<Question> {
  try {
    const response = await fetch(`/api/question-sets/${questionSetId}/questions`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(questionData),
    });
    
    if (!response.ok) {
      throw new Error('Failed to create question');
    }
    
    return await response.json();
  } catch (error) {
    console.error('Error creating question:', error);
    throw error;
  }
}

export async function updateQuestion(questionId: string, questionData: { 
  text?: string, 
  options?: Partial<Option>[] 
}): Promise<Question> {
  try {
    const response = await fetch(`/api/questions/${questionId}`, {
      method: 'PUT',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(questionData),
    });
    
    if (!response.ok) {
      throw new Error('Failed to update question');
    }
    
    return await response.json();
  } catch (error) {
    console.error('Error updating question:', error);
    throw error;
  }
}

export async function deleteQuestion(questionId: string): Promise<void> {
  try {
    const response = await fetch(`/api/questions/${questionId}`, {
      method: 'DELETE',
    });
    
    if (!response.ok) {
      throw new Error('Failed to delete question');
    }
  } catch (error) {
    console.error('Error deleting question:', error);
    throw error;
  }
} 