import { Response } from 'express';

interface ResponseData<T = any> {
  success: boolean;
  data?: T;
  message?: string;
  [key: string]: any; // 添加额外字段支持
}

export const sendResponse = <T = any>(
  res: Response,
  statusCode: number,
  messageOrData?: string | any,
  data?: T
): Response => {
  const response: ResponseData<T> = {
    success: true,
  };

  // 支持两种调用方式：
  // 1. sendResponse(res, 200, "消息", data)
  // 2. sendResponse(res, 200, { message: "消息", ...otherFields })
  if (typeof messageOrData === 'string') {
    response.message = messageOrData;
    if (data !== undefined) {
      response.data = data;
    }
  } else if (typeof messageOrData === 'object' && messageOrData !== null) {
    // 将整个对象合并到响应中
    Object.assign(response, messageOrData);
  }

  return res.status(statusCode).json(response);
};

export const sendError = (
  res: Response,
  statusCode: number,
  message: string,
  error?: any
): Response => {
  const isProduction = process.env.NODE_ENV === 'production';
  
  // 基本错误对象，包含在所有环境中可显示的信息
  const errorResponse = {
    success: false,
    message,
    timestamp: new Date().toISOString()
  };
  
  // 只在非生产环境中添加详细错误信息
  if (!isProduction && error) {
    if (error instanceof Error) {
      // 如果是Error对象，提取相关属性
      return res.status(statusCode).json({
        ...errorResponse,
        error: {
          message: error.message,
          name: error.name,
          stack: error.stack,
        }
      });
    } else {
      // 如果是其他类型的错误，直接添加
      return res.status(statusCode).json({
        ...errorResponse,
        error
      });
    }
  }
  
  // 在生产环境中不返回详细错误信息
  return res.status(statusCode).json(errorResponse);
}; 