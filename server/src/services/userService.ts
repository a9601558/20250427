import logger from '../utils/logger';
import { CustomError, NotFoundError } from '../utils/errors';
import User from '../models/User';
import { IUser } from '../types';

interface GetUserOptions {
  includeAssociations?: boolean;
  log?: boolean;
}

/**
 * 根据用户ID获取用户信息
 */
export const getUserById = async (userId: string, options: GetUserOptions = {}): Promise<IUser | null> => {
  try {
    const { includeAssociations = false, log = false } = options;
    
    if (log) {
      logger.info(`获取用户信息: ${userId}, 包含关联: ${includeAssociations}`);
    }
    
    // 准备查询选项
    const queryOptions: any = {
      attributes: { exclude: ['password'] }
    };
    
    // 如果需要包含关联数据
    if (includeAssociations) {
      queryOptions.include = [
        { 
          association: 'userPurchases',
          attributes: ['id', 'questionSetId', 'purchaseDate', 'expiryDate', 'status', 'paymentMethod', 'amount', 'transactionId']
        },
        {
          association: 'userRedeemCodes'
        }
      ];
    }
    
    // 执行数据库查询
    const user = await User.findByPk(userId, queryOptions);
    
    if (!user) {
      if (log) {
        logger.warn(`未找到用户: ${userId}`);
      }
      return null;
    }
    
    if (log) {
      logger.info(`已找到用户: ${userId}, 包含购买记录: ${user.purchases?.length || 0} 条`);
    }
    
    // 返回用户数据
    return user;
  } catch (error) {
    logger.error(`获取用户信息失败:`, error);
    return null;
  }
};

/**
 * 获取用户的所有设备信息
 */
export const getUserDevices = async (userId: string): Promise<string[]> => {
  try {
    // 模拟从数据库获取用户设备
    // 实际实现中应该使用真实的数据库查询
    return ['device1', 'device2']; // 示例设备ID列表
  } catch (error) {
    logger.error(`获取用户设备失败:`, error);
    return [];
  }
};

/**
 * 注册用户的新设备
 */
export const registerUserDevice = async (userId: string, deviceId: string): Promise<boolean> => {
  try {
    logger.info(`注册用户设备: ${userId}, ${deviceId}`);
    
    // 模拟向数据库注册设备
    // 实际实现中应该使用真实的数据库操作
    return true;
  } catch (error) {
    logger.error(`注册用户设备失败:`, error);
    return false;
  }
};

/**
 * 更新用户的最后活动时间
 */
export const updateUserLastActive = async (userId: string): Promise<boolean> => {
  try {
    logger.info(`更新用户最后活动时间: ${userId}`);
    
    // 模拟更新用户活动时间
    // 实际实现中应该使用真实的数据库操作
    return true;
  } catch (error) {
    logger.error(`更新用户活动时间失败:`, error);
    return false;
  }
}; 