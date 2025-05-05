"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.createErrorResponse = exports.NotFoundError = exports.ForbiddenError = exports.UnauthorizedError = exports.CustomError = void 0;
/**
 * 自定义错误类，用于处理API的错误信息和状态码
 */
class CustomError extends Error {
    statusCode;
    constructor(message, statusCode = 500) {
        super(message);
        this.statusCode = statusCode;
        this.name = 'CustomError';
        // 正确捕获堆栈跟踪
        if (Error.captureStackTrace) {
            Error.captureStackTrace(this, CustomError);
        }
    }
}
exports.CustomError = CustomError;
/**
 * 未授权错误
 */
class UnauthorizedError extends CustomError {
    constructor(message = 'Unauthorized access') {
        super(message, 401);
        this.name = 'UnauthorizedError';
    }
}
exports.UnauthorizedError = UnauthorizedError;
/**
 * 禁止访问错误
 */
class ForbiddenError extends CustomError {
    constructor(message = 'Access forbidden') {
        super(message, 403);
        this.name = 'ForbiddenError';
    }
}
exports.ForbiddenError = ForbiddenError;
/**
 * 资源未找到错误
 */
class NotFoundError extends CustomError {
    constructor(message = 'Resource not found') {
        super(message, 404);
        this.name = 'NotFoundError';
    }
}
exports.NotFoundError = NotFoundError;
/**
 * 创建包含状态码的错误响应
 */
const createErrorResponse = (error, defaultMessage = 'Internal server error') => {
    const statusCode = error.statusCode || 500;
    const message = error.message || defaultMessage;
    return {
        success: false,
        statusCode,
        message
    };
};
exports.createErrorResponse = createErrorResponse;
