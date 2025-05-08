/**
 * 时间和格式化相关工具函数库
 */

/**
 * 格式化时间显示
 * @param seconds 秒数
 * @returns 格式化的时间字符串 (HH:MM:SS 或 MM:SS)
 */
export const formatTime = (seconds: number): string => {
  const hours = Math.floor(seconds / 3600);
  const minutes = Math.floor((seconds % 3600) / 60);
  const secs = Math.floor(seconds % 60);
  
  if (hours > 0) {
    return `${hours}:${minutes.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
  }
  return `${minutes}:${secs.toString().padStart(2, '0')}`;
};

/**
 * 计算剩余天数
 * @param expiryDate 过期日期字符串
 * @returns 剩余天数
 */
export const calculateRemainingDays = (expiryDate: string): number => {
  const expiry = new Date(expiryDate);
  const now = new Date();
  return Math.max(0, Math.ceil((expiry.getTime() - now.getTime()) / (1000 * 60 * 60 * 24)));
};

/**
 * 格式化日期显示
 * @param dateString 日期字符串
 * @returns 本地化格式的日期字符串
 */
export const formatDate = (dateString: string): string => {
  try {
    return new Date(dateString).toLocaleDateString();
  } catch (e) {
    console.error('[timeUtils] 日期格式化失败:', e);
    return dateString;
  }
};

/**
 * 获取未来日期
 * @param days 天数
 * @returns ISO格式的日期字符串
 */
export const getFutureDate = (days: number): string => {
  const date = new Date();
  date.setDate(date.getDate() + days);
  return date.toISOString();
}; 