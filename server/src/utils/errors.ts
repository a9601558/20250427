/**
 * 自定义错误类，用于处理API的错误信息和状态码
 */
export class CustomError extends Error {
  statusCode: number;
  
  constructor(message: string, statusCode: number = 500) {
    super(message);
    this.statusCode = statusCode;
    this.name = 'CustomError';
    
    // 正确捕获堆栈跟踪
    if (Error.captureStackTrace) {
      Error.captureStackTrace(this, CustomError);
    }
  }
}

/**
 * 未授权错误
 */
export class UnauthorizedError extends CustomError {
  constructor(message: string = 'Unauthorized access') {
    super(message, 401);
    this.name = 'UnauthorizedError';
  }
}

/**
 * 禁止访问错误
 */
export class ForbiddenError extends CustomError {
  constructor(message: string = 'Access forbidden') {
    super(message, 403);
    this.name = 'ForbiddenError';
  }
}

/**
 * 资源未找到错误
 */
export class NotFoundError extends CustomError {
  constructor(message: string = 'Resource not found') {
    super(message, 404);
    this.name = 'NotFoundError';
  }
}

/**
 * 创建包含状态码的错误响应
 */
export const createErrorResponse = (error: Error | CustomError, defaultMessage: string = 'Internal server error') => {
  const statusCode = (error as CustomError).statusCode || 500;
  const message = error.message || defaultMessage;
  
  return {
    success: false,
    statusCode,
    message
  };
}; 