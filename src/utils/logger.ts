/**
 * 统一的日志工具
 * 
 * 使用示例:
 * import { logger } from '../utils/logger';
 * logger.info('用户登录成功', { userId: '123' });
 * logger.error('请求失败', error);
 */

// 定义日志级别
export enum LogLevel {
  Debug,
  Info,
  Warn,
  Error,
}

// 定义当前环境
const isDevelopment = process.env.NODE_ENV !== 'production';

// 设置默认日志级别
const currentLogLevel = isDevelopment ? LogLevel.Debug : LogLevel.Info;

// 添加时间戳和格式化输出
const formatMessage = (level: string, message: string, ...args: any[]): string => {
  const timestamp = new Date().toISOString();
  return `[${timestamp}] [${level}] ${message}`;
};

// 创建日志对象
export const logger = {
  /**
   * 调试日志，仅在开发环境可见
   */
  debug: (message: string, ...args: any[]): void => {
    if (currentLogLevel <= LogLevel.Debug) {
      console.debug(formatMessage('DEBUG', message), ...args);
    }
  },

  /**
   * 信息日志
   */
  info: (message: string, ...args: any[]): void => {
    if (currentLogLevel <= LogLevel.Info) {
      console.info(formatMessage('INFO', message), ...args);
    }
  },

  /**
   * 警告日志
   */
  warn: (message: string, ...args: any[]): void => {
    if (currentLogLevel <= LogLevel.Warn) {
      console.warn(formatMessage('WARN', message), ...args);
    }
  },

  /**
   * 错误日志
   */
  error: (message: string, ...args: any[]): void => {
    if (currentLogLevel <= LogLevel.Error) {
      console.error(formatMessage('ERROR', message), ...args);
    }
  },

  /**
   * 向后兼容 - 同 info
   */
  log: (message: string, ...args: any[]): void => {
    logger.info(message, ...args);
  }
}; 