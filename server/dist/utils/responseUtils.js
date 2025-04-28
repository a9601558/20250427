"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.sendError = exports.sendResponse = void 0;
const sendResponse = (res, statusCode, message, data) => {
    const response = {
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
exports.sendResponse = sendResponse;
const sendError = (res, statusCode, message, error) => {
    return res.status(statusCode).json({
        success: false,
        message,
        error: error?.message || error,
    });
};
exports.sendError = sendError;
