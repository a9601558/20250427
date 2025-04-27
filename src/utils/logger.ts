/**
 * 日志工具 - 集中式日志记录
 * 
 * 使用方法:
 * import { logger } from '../utils/logger';
 * 
 * logger.info('用户登录成功', { userId: '123' });
 * logger.error('请求失败', error);
 */

// 日志级别
export enum LogLevel {
  DEBUG = 'debug',
  INFO = 'info',
  WARN = 'warn',
  ERROR = 'error'
}

// 当前应用环境
const isProduction = import.meta.env.PROD === true;

/**
 * 集中式日志记录工具
 * 在开发环境中输出到控制台
 * 在生产环境中可以配置为发送到远程日志服务
 */
class Logger {
  private shouldLog(level: LogLevel): boolean {
    // 在生产环境中不输出DEBUG级别的日志
    if (isProduction && level === LogLevel.DEBUG) {
      return false;
    }
    return true;
  }

  /**
   * 发送日志到远程服务
   * 在生产环境中可以实现此方法，连接到Sentry、LogRocket等服务
   */
  private sendToRemoteService(_level: LogLevel, _message: string, _data?: any): void {
    // 生产环境中实现对接远程日志服务
    // 目前未实现，参数前加下划线表示暂时未使用
    // 实际实现时可能类似：Sentry.captureMessage(_message, { level: _level, extra: _data });
  }

  /**
   * 记录日志
   */
  private log(level: LogLevel, message: string, data?: any): void {
    if (!this.shouldLog(level)) return;

    const timestamp = new Date().toISOString();
    
    // 构建日志条目 - 实际实现时可用于持久化存储或监控系统
    // const logEntry = {
    //   timestamp,
    //   level,
    //   message,
    //   data
    // };

    // 开发环境: 输出到控制台
    if (!isProduction) {
      switch (level) {
        case LogLevel.DEBUG:
          console.debug(`[${timestamp}] [${level}]`, message, data);
          break;
        case LogLevel.INFO:
          console.info(`[${timestamp}] [${level}]`, message, data);
          break;
        case LogLevel.WARN:
          console.warn(`[${timestamp}] [${level}]`, message, data);
          break;
        case LogLevel.ERROR:
          console.error(`[${timestamp}] [${level}]`, message, data);
          break;
      }
    } else {
      // 生产环境: 发送到远程服务
      this.sendToRemoteService(level, message, data);
    }
  }

  /**
   * 调试级别日志 - 仅开发环境
   */
  debug(message: string, data?: any): void {
    this.log(LogLevel.DEBUG, message, data);
  }

  /**
   * 信息级别日志
   */
  info(message: string, data?: any): void {
    this.log(LogLevel.INFO, message, data);
  }

  /**
   * 警告级别日志
   */
  warn(message: string, data?: any): void {
    this.log(LogLevel.WARN, message, data);
  }

  /**
   * 错误级别日志
   */
  error(message: string, error?: any): void {
    this.log(LogLevel.ERROR, message, error);
  }
}

// 导出单例
export const logger = new Logger(); 