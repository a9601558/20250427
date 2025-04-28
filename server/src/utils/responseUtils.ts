import { Response } from 'express';

interface ResponseData<T = any> {
  success: boolean;
  data?: T;
  message?: string;
}

export const sendResponse = <T = any>(
  res: Response,
  statusCode: number,
  message?: string,
  data?: T
): Response => {
  const response: ResponseData<T> = {
    success: true,
  };

  if (message) {
    response.message = message;
  }

  if (data !== undefined) {
    response.data = data;
  }

  return res.status(statusCode).json(response);
};

export const sendError = (
  res: Response,
  statusCode: number,
  message: string,
  error?: any
): Response => {
  return res.status(statusCode).json({
    success: false,
    message,
    error: error?.message || error,
  });
}; 