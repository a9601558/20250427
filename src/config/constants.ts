// API endpoints and configuration
const getApiBaseUrl = () => {
  // In production (exam7.jp), use the same origin as the frontend
  if (window.location.hostname !== 'localhost' && window.location.hostname !== '127.0.0.1') {
    return window.location.origin;
  }
  
  // In development, use the local server
  return process.env.REACT_APP_API_URL || 'http://localhost:5000';
};

export const API_BASE_URL = getApiBaseUrl(); 