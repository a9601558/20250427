import { Purchase } from '../types/purchase';
import logger from '../utils/logger';
import { CustomError, NotFoundError } from '../utils/errors';

/**
 * 获取用户的活跃购买记录
 */
export const getActivePurchasesByUserId = async (userId: string): Promise<Purchase[]> => {
  try {
    logger.info(`获取用户 ${userId} 的活跃购买记录`);
    
    // 模拟从数据库获取购买记录
    // 实际实现中应该使用真实的数据库查询
    const purchases: Purchase[] = [
      // 示例数据，真实环境需替换为数据库查询
    ];
    
    // 过滤出活跃的记录
    const now = new Date();
    const activePurchases = purchases.filter(purchase => {
      const expiryDate = purchase.expiryDate ? new Date(purchase.expiryDate) : null;
      const isExpired = expiryDate && expiryDate <= now;
      const isActive = purchase.status === 'active' || purchase.status === 'completed';
      
      return !isExpired && isActive;
    });
    
    return activePurchases;
  } catch (error) {
    logger.error('获取活跃购买记录出错:', error);
    throw new CustomError('获取活跃购买记录失败', 500);
  }
};

/**
 * 检查用户是否有访问题库的权限
 */
export const hasAccessToQuestionSet = async (userId: string, questionSetId: string): Promise<boolean> => {
  try {
    logger.info(`检查用户 ${userId} 对题库 ${questionSetId} 的访问权限`);
    
    // 获取用户最新的购买记录
    const purchases = await getActivePurchasesByUserId(userId);
    
    // 检查购买记录中是否包含此题库
    const purchase = purchases.find(p => p.questionSetId === questionSetId);
    if (!purchase) {
      return false;
    }
    
    // 检查购买记录是否有效
    const now = new Date();
    const expiryDate = purchase.expiryDate ? new Date(purchase.expiryDate) : null;
    const isExpired = expiryDate && expiryDate <= now;
    const isActive = purchase.status === 'active' || purchase.status === 'completed';
    
    return !isExpired && isActive;
  } catch (error) {
    logger.error(`检查题库访问权限出错:`, error);
    return false;
  }
};

/**
 * 获取用户对特定题库的最新购买记录
 */
export const getLatestPurchaseForQuestionSet = async (userId: string, questionSetId: string): Promise<Purchase | null> => {
  try {
    logger.info(`获取用户 ${userId} 对题库 ${questionSetId} 的最新购买记录`);
    
    // 获取用户所有的购买记录
    const purchases = await getActivePurchasesByUserId(userId);
    
    // 找出最新的购买记录
    const questionSetPurchases = purchases
      .filter(p => p.questionSetId === questionSetId)
      .sort((a, b) => {
        const dateA = new Date(a.purchaseDate).getTime();
        const dateB = new Date(b.purchaseDate).getTime();
        return dateB - dateA; // 降序，最新的在前
      });
    
    return questionSetPurchases.length > 0 ? questionSetPurchases[0] : null;
  } catch (error) {
    logger.error(`获取最新购买记录出错:`, error);
    return null;
  }
}; 