"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.sendError = exports.sendResponse = void 0;
const sendResponse = (res, statusCode, message, data) => {
    const response = {
        success: true,
        message,
    };
    if (data !== undefined) {
        response.data = data;
    }
    return res.status(statusCode).json(response);
};
exports.sendResponse = sendResponse;
const sendError = (res, statusCode, message, error) => {
    const response = {
        success: false,
        message,
    };
    if (error && process.env.NODE_ENV === 'development') {
        response.data = error;
    }
    return res.status(statusCode).json(response);
};
exports.sendError = sendError;
