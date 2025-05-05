"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
/**
 * Global error handling middleware
 * Catches any errors thrown in the application and returns a standardized response
 */
const errorMiddleware = (err, req, res, next) => {
    console.error('Error in middleware:', err.stack || err);
    // Determine status code (default to 500)
    const statusCode = err.statusCode || 500;
    // Construct error response
    const errorResponse = {
        success: false,
        message: err.message || '服务器内部错误',
        error: process.env.NODE_ENV === 'development' ? {
            stack: err.stack,
            detail: err.detail || err.details || err.original?.message || null
        } : undefined,
        path: req.path,
        timestamp: new Date().toISOString()
    };
    // Send response
    res.status(statusCode).json(errorResponse);
};
exports.default = errorMiddleware;
