import { IUser } from '../types/index';

export const getCurrentUser = async (): Promise<IUser | null> => {
  try {
    const token = localStorage.getItem('token');
    if (!token) {
      console.log('No token found');
      return null;
    }

    const response = await fetch('/api/users/me', {
      headers: {
        'Authorization': `Bearer ${token}`
      }
    });

    if (!response.ok) {
      console.error('Failed to get current user:', response.statusText);
      return null;
    }

    const data = await response.json();
    if (data.success && data.data) {
      return data.data;
    }

    return null;
  } catch (error) {
    console.error('Error getting current user:', error);
    return null;
  }
};
 