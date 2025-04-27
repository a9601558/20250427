import { Option } from '../types';

export async function addOption(questionId: string, optionData: Partial<Option>): Promise<Option> {
  try {
    const response = await fetch(`/api/questions/${questionId}/options`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(optionData),
    });
    
    if (!response.ok) {
      throw new Error('Failed to add option');
    }
    
    return await response.json();
  } catch (error) {
    console.error('Error adding option:', error);
    throw error;
  }
}

export async function updateOption(optionId: string, optionData: Partial<Option>): Promise<Option> {
  try {
    const response = await fetch(`/api/options/${optionId}`, {
      method: 'PUT',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(optionData),
    });
    
    if (!response.ok) {
      throw new Error('Failed to update option');
    }
    
    return await response.json();
  } catch (error) {
    console.error('Error updating option:', error);
    throw error;
  }
}

export async function deleteOption(optionId: string): Promise<void> {
  try {
    const response = await fetch(`/api/options/${optionId}`, {
      method: 'DELETE',
    });
    
    if (!response.ok) {
      throw new Error('Failed to delete option');
    }
  } catch (error) {
    console.error('Error deleting option:', error);
    throw error;
  }
}

export async function bulkAddOptions(questionId: string, options: Partial<Option>[]): Promise<Option[]> {
  try {
    const response = await fetch(`/api/questions/${questionId}/options/bulk`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ options }),
    });
    
    if (!response.ok) {
      throw new Error('Failed to bulk add options');
    }
    
    return await response.json();
  } catch (error) {
    console.error('Error bulk adding options:', error);
    throw error;
  }
} 