import { Purchase } from '../types/purchase';
import logger from '../utils/logger';
import { CustomError, NotFoundError } from '../utils/errors';
import PurchaseModel from '../models/Purchase';
import { Op } from 'sequelize';

/**
 * 获取用户的活跃购买记录
 */
export const getActivePurchasesByUserId = async (userId: string): Promise<Purchase[]> => {
  try {
    logger.info(`获取用户 ${userId} 的活跃购买记录`);
    
    // 获取当前日期
    const now = new Date();
    
    // 使用Sequelize模型查询数据库，使用类型断言绕过TypeScript类型检查
    const whereClause = {
      userId: userId,
      [Op.or]: [
        {
          // 有效期未过期
          expiryDate: { [Op.gt]: now },
          status: { [Op.in]: ['active', 'completed'] }
        },
        {
          // 无过期时间，使用null
          expiryDate: null,
          status: { [Op.in]: ['active', 'completed'] }
        }
      ]
    } as any; // 使用类型断言
    
    const purchases = await PurchaseModel.findAll({
      where: whereClause,
      // 添加详细日志以帮助调试
      logging: (sql) => {
        logger.debug(`[PurchaseService] SQL查询: ${sql}`);
      }
    });
    
    // 检查是否有结果
    if (!purchases || purchases.length === 0) {
      logger.warn(`用户 ${userId} 没有活跃的购买记录`);
      return [];
    }
    
    // 转换为标准格式并记录
    const results = purchases.map(p => {
      // 将数据库模型转换为纯对象
      const purchase = p.get({ plain: true });
      
      // 创建标准格式的Purchase对象
      const formattedPurchase = {
        id: purchase.id,
        userId: purchase.userId,
        questionSetId: purchase.questionSetId,
        purchaseDate: purchase.purchaseDate,
        expiryDate: purchase.expiryDate,
        status: purchase.status as 'active' | 'completed' | 'cancelled' | 'expired' | 'pending',
        amount: purchase.amount,
        transactionId: purchase.transactionId,
        paymentMethod: purchase.paymentMethod || 'unknown',
        price: 0, // 默认值
        currency: 'CNY', // 默认值
        createdAt: purchase.createdAt || new Date(),
        updatedAt: purchase.updatedAt || new Date()
      } as Purchase;
      
      return formattedPurchase;
    });
    
    logger.info(`已找到用户 ${userId} 的 ${results.length} 条活跃购买记录`);
    
    return results;
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
    
    // 获取当前日期
    const now = new Date();
    
    // 使用类型断言绕过TypeScript类型检查
    const whereClause = {
      userId: userId,
      questionSetId: questionSetId,
      [Op.or]: [
        {
          // 有效期未过期
          expiryDate: { [Op.gt]: now },
          status: { [Op.in]: ['active', 'completed'] }
        },
        {
          // 无过期时间
          expiryDate: null,
          status: { [Op.in]: ['active', 'completed'] }
        }
      ]
    } as any;
    
    // 直接查询数据库，检查是否有有效的购买记录
    const purchase = await PurchaseModel.findOne({
      where: whereClause
    });
    
    // 如果找到有效购买记录，则有访问权限
    const hasAccess = !!purchase;
    logger.info(`用户 ${userId} 对题库 ${questionSetId} 的访问权限: ${hasAccess}`);
    
    return hasAccess;
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
    
    // 直接查询数据库，获取最新的购买记录
    const purchase = await PurchaseModel.findOne({
      where: {
        userId: userId,
        questionSetId: questionSetId
      },
      order: [['purchaseDate', 'DESC']] // 按购买日期降序排序，获取最新的
    });
    
    if (!purchase) {
      logger.warn(`用户 ${userId} 没有题库 ${questionSetId} 的购买记录`);
      return null;
    }
    
    // 转换为标准格式
    const result = {
      id: purchase.id,
      userId: purchase.userId,
      questionSetId: purchase.questionSetId,
      purchaseDate: purchase.purchaseDate,
      expiryDate: purchase.expiryDate,
      status: purchase.status as 'active' | 'completed' | 'cancelled' | 'expired' | 'pending',
      amount: purchase.amount,
      transactionId: purchase.transactionId,
      paymentMethod: purchase.paymentMethod || 'unknown',
      price: 0, // 默认值
      currency: 'CNY', // 默认值
      createdAt: purchase.createdAt || new Date(),
      updatedAt: purchase.updatedAt || new Date()
    } as Purchase;
    
    logger.info(`已找到用户 ${userId} 的题库 ${questionSetId} 的最新购买记录，日期: ${result.purchaseDate}`);
    
    return result;
  } catch (error) {
    logger.error(`获取最新购买记录出错:`, error);
    return null;
  }
}; 