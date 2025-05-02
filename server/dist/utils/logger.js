"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.consoleLogger = exports.logger = void 0;
const winston_1 = __importDefault(require("winston"));
const path_1 = __importDefault(require("path"));
const fs_1 = __importDefault(require("fs"));
// 确保日志目录存在
const logDir = path_1.default.join(process.cwd(), 'logs');
if (!fs_1.default.existsSync(logDir)) {
    fs_1.default.mkdirSync(logDir, { recursive: true });
}
// 定义日志格式
const logFormat = winston_1.default.format.combine(winston_1.default.format.timestamp({ format: 'YYYY-MM-DD HH:mm:ss' }), winston_1.default.format.errors({ stack: true }), winston_1.default.format.splat(), winston_1.default.format.json());
// 创建格式化输出
const consoleFormat = winston_1.default.format.combine(winston_1.default.format.colorize(), winston_1.default.format.timestamp({ format: 'YYYY-MM-DD HH:mm:ss' }), winston_1.default.format.printf(({ level, message, timestamp, ...meta }) => {
    return `${timestamp} ${level}: ${message} ${Object.keys(meta).length ? JSON.stringify(meta, null, 2) : ''}`;
}));
// 创建日志记录器
exports.logger = winston_1.default.createLogger({
    level: process.env.LOG_LEVEL || 'info',
    format: logFormat,
    defaultMeta: { service: 'exam-server' },
    transports: [
        // 写入所有日志到 combined.log
        new winston_1.default.transports.File({
            filename: path_1.default.join(logDir, 'combined.log'),
            maxsize: 5242880, // 5MB
            maxFiles: 5,
        }),
        // 写入所有错误到 error.log
        new winston_1.default.transports.File({
            filename: path_1.default.join(logDir, 'error.log'),
            level: 'error',
            maxsize: 5242880, // 5MB
            maxFiles: 5,
        }),
        // 开发环境下输出到控制台
        new winston_1.default.transports.Console({
            format: consoleFormat,
        }),
    ],
});
// 如果我们不在生产环境，添加更多详细的控制台输出
if (process.env.NODE_ENV !== 'production') {
    exports.logger.add(new winston_1.default.transports.Console({
        format: consoleFormat,
    }));
}
// 提供一个与console兼容的接口
exports.consoleLogger = {
    log: (message, ...args) => exports.logger.info(message, ...args),
    info: (message, ...args) => exports.logger.info(message, ...args),
    warn: (message, ...args) => exports.logger.warn(message, ...args),
    error: (message, ...args) => exports.logger.error(message, ...args),
    debug: (message, ...args) => exports.logger.debug(message, ...args),
};
// 为了向后兼容
exports.default = exports.logger;
