import { Response } from 'express';

interface ResponseData {
  success: boolean;
  message: string;
  data?: any;
}

export const sendResponse = (
  res: Response,
  statusCode: number,
  message: string,
  data?: any
) => {
  const response: ResponseData = {
    success: true,
    message,
  };

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
) => {
  const response: ResponseData = {
    success: false,
    message,
  };

  if (error && process.env.NODE_ENV === 'development') {
    response.data = error;
  }

  return res.status(statusCode).json(response);
}; 