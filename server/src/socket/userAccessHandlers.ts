import { Socket, Server } from 'socket.io';
import { CustomError } from '../utils/errors';
import * as purchaseService from '../services/purchaseService';
import * as userService from '../services/userService';
import logger from '../utils/logger';
import { Purchase } from '../types/purchase';

/**
 * 用户访问权限相关的socket处理器，处理用户跨设备同步
 */
export const registerUserAccessHandlers = (socket: Socket, io: Server) => {
  const userId = socket.data.userId;
  
  // 用户请求同步跨设备访问权限，从数据库加载最新权限
  socket.on('user:syncAccessRights', async (data: { userId: string; forceRefresh?: boolean }) => {
    try {
      if (!userId || userId !== data.userId) {
        throw new CustomError('Unauthorized access', 403);
      }
      
      logger.info(`[Socket] 用户 ${userId} 请求同步访问权限`);
      
      // 获取用户的最新购买记录
      const user = await userService.getUserById(userId);
      if (!user) {
        throw new CustomError('User not found', 404);
      }
      
      // 获取有效的购买记录
      const purchases = await purchaseService.getActivePurchasesByUserId(userId);
      
      if (!purchases || purchases.length === 0) {
        logger.info(`[Socket] 用户 ${userId} 没有有效的购买记录`);
        return;
      }
      
      logger.info(`[Socket] 用户 ${userId} 有 ${purchases.length} 条有效购买记录`);
      
      // 计算每个题库的剩余天数并发送给客户端
      const now = new Date();
      
      // 处理每个有效的购买记录
      for (const purchase of purchases) {
        if (!purchase.questionSetId) continue;
        
        const expiryDate = purchase.expiryDate ? new Date(purchase.expiryDate) : null;
        const isExpired = expiryDate && expiryDate <= now;
        
        if (!isExpired) {
          // 计算剩余天数
          let remainingDays = null;
          if (expiryDate) {
            const diffTime = expiryDate.getTime() - now.getTime();
            remainingDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));
          }
          
          // 发送访问权限更新给客户端
          socket.emit('questionSet:accessUpdate', {
            userId,
            questionSetId: purchase.questionSetId,
            hasAccess: true,
            remainingDays,
            source: 'db_sync'
          });
        }
      }
      
      // 通知客户端同步完成
      socket.emit('user:syncComplete', {
        userId,
        timestamp: Date.now(),
        totalSynced: purchases.length
      });
      
    } catch (error: any) {
      logger.error(`[Socket] 同步用户访问权限错误:`, error);
      socket.emit('error', {
        message: error instanceof CustomError ? error.message : '同步访问权限失败',
        code: error instanceof CustomError ? error.statusCode : 500
      });
    }
  });
  
  // 设备同步事件，允许一个设备通知其他设备进行更新
  socket.on('user:deviceSync', async (data: { userId: string; type: string; timestamp: number }) => {
    try {
      if (!userId || userId !== data.userId) {
        throw new CustomError('Unauthorized access', 403);
      }
      
      logger.info(`[Socket] 用户 ${userId} 请求设备同步，类型: ${data.type}`);
      
      // 广播给该用户的其他设备（除了当前socket）
      socket.to(userId).emit('user:deviceSync', {
        userId,
        type: data.type,
        timestamp: data.timestamp || Date.now(),
        sourceDevice: socket.id
      });
      
    } catch (error: any) {
      logger.error(`[Socket] 设备同步错误:`, error);
      socket.emit('error', {
        message: error instanceof CustomError ? error.message : '设备同步失败',
        code: error instanceof CustomError ? error.statusCode : 500
      });
    }
  });
  
  // 获取题库访问权限并同步到所有设备
  socket.on('questionSet:checkAccess', async (data: { userId: string; questionSetId: string }) => {
    try {
      if (!userId || userId !== data.userId) {
        throw new CustomError('Unauthorized access', 403);
      }
      
      const { questionSetId } = data;
      if (!questionSetId) {
        throw new CustomError('Question set ID is required', 400);
      }
      
      // 获取题库访问权限
      const hasAccess = await purchaseService.hasAccessToQuestionSet(userId, questionSetId);
      
      // 获取额外信息
      let remainingDays = null;
      if (hasAccess) {
        const purchase = await purchaseService.getLatestPurchaseForQuestionSet(userId, questionSetId);
        if (purchase && purchase.expiryDate) {
          const now = new Date();
          const expiryDate = new Date(purchase.expiryDate);
          const diffTime = expiryDate.getTime() - now.getTime();
          remainingDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));
        }
      }
      
      // 响应检查结果
      socket.emit('questionSet:accessResult', {
        userId,
        questionSetId,
        hasAccess,
        remainingDays,
        timestamp: Date.now()
      });
      
    } catch (error: any) {
      logger.error(`[Socket] 检查题库访问权限错误:`, error);
      socket.emit('error', {
        message: error instanceof CustomError ? error.message : '检查题库访问权限失败',
        code: error instanceof CustomError ? error.statusCode : 500
      });
    }
  });
  
  // 批量检查题库访问权限
  socket.on('questionSet:checkAccessBatch', async (data: { userId: string; questionSetIds: string[]; source?: string }) => {
    try {
      if (!userId || userId !== data.userId) {
        throw new CustomError('Unauthorized access', 403);
      }
      
      const { questionSetIds } = data;
      if (!questionSetIds || !Array.isArray(questionSetIds) || questionSetIds.length === 0) {
        throw new CustomError('Question set IDs are required', 400);
      }
      
      logger.info(`[Socket] 用户 ${userId} 批量检查 ${questionSetIds.length} 个题库的访问权限, 来源: ${data.source || 'unknown'}`);
      
      // 获取最新购买记录，添加更详细的错误处理
      try {
        var purchases = await purchaseService.getActivePurchasesByUserId(userId);
        logger.info(`[Socket] 用户 ${userId} 有 ${purchases.length} 条有效购买记录`);
        
        // 如果找到的购买记录为空，尝试直接查询数据库
        if (!purchases || purchases.length === 0) {
          logger.warn(`[Socket] 通过服务发现用户 ${userId} 没有购买记录，尝试直接查询数据库`);
          
          // 直接从数据库获取购买记录，确保数据完整性
          const user = await userService.getUserById(userId, { 
            includeAssociations: true, 
            log: true 
          });
          
          if (user && user.userPurchases && user.userPurchases.length > 0) {
            logger.info(`[Socket] 直接查询数据库发现用户 ${userId} 有 ${user.userPurchases.length} 条购买记录`);
            // 类型转换，确保满足Purchase类型的要求
            purchases = user.userPurchases.map(p => ({
              ...p,
              // 确保包含必需字段
              id: p.id,
              userId: p.userId,
              questionSetId: p.questionSetId,
              purchaseDate: p.purchaseDate,
              expiryDate: p.expiryDate,
              status: p.status as any,
              amount: p.amount,
              // 添加缺失字段的默认值
              price: 0,
              currency: 'CNY'
            }));
          }
        }
      } catch (purchaseError) {
        logger.error(`[Socket] 获取用户购买记录错误:`, purchaseError);
        // 即使获取购买记录失败，我们仍然继续处理，假设没有购买记录
        purchases = [];
      }
      
      const purchaseMap = new Map<string, Purchase>();
      
      // 建立题库ID与购买记录的映射
      purchases.forEach(purchase => {
        if (purchase.questionSetId) {
          purchaseMap.set(purchase.questionSetId, purchase);
          logger.debug(`[Socket] 用户 ${userId} 购买了题库 ${purchase.questionSetId}, 到期日: ${purchase.expiryDate}`);
        }
      });
      
      // 检查每个题库的访问权限
      const now = new Date();
      const results = questionSetIds.map(questionSetId => {
        const purchase = purchaseMap.get(questionSetId);
        let hasAccess = false;
        let remainingDays = null;
        
        if (purchase) {
          const expiryDate = purchase.expiryDate ? new Date(purchase.expiryDate) : null;
          hasAccess = !expiryDate || expiryDate > now;
          
          if (hasAccess && expiryDate) {
            const diffTime = expiryDate.getTime() - now.getTime();
            remainingDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));
          }
          
          logger.debug(`[Socket] 题库 ${questionSetId} 检查结果: 访问权限=${hasAccess}, 剩余天数=${remainingDays}, 支付方式=${purchase.paymentMethod || 'unknown'}`);
        }
        
        return {
          questionSetId,
          hasAccess,
          remainingDays
        };
      });
      
      // 发送批量结果
      socket.emit('questionSet:batchAccessResult', {
        userId,
        results,
        timestamp: Date.now(),
        source: data.source || 'batch_check'
      });
      
      // 单独发送每个题库的结果，以便客户端可以更新本地缓存
      results.forEach(result => {
        socket.emit('questionSet:accessResult', {
          userId,
          questionSetId: result.questionSetId,
          hasAccess: result.hasAccess,
          remainingDays: result.remainingDays,
          paymentMethod: purchaseMap.get(result.questionSetId)?.paymentMethod || 'unknown',
          timestamp: Date.now()
        });
      });
      
    } catch (error: any) {
      logger.error(`[Socket] 批量检查题库访问权限错误:`, error);
      socket.emit('error', {
        message: error instanceof CustomError ? error.message : '批量检查题库访问权限失败',
        code: error instanceof CustomError ? error.statusCode : 500
      });
    }
  });
  
  // 处理客户端主动同步的访问权限更新
  socket.on('questionSet:accessUpdate', (data: { 
    userId: string; 
    questionSetId: string; 
    hasAccess: boolean; 
    remainingDays?: number | null;
    source?: string 
  }) => {
    try {
      if (!userId || userId !== data.userId) {
        throw new CustomError('Unauthorized access', 403);
      }
      
      const { questionSetId, hasAccess, remainingDays, source } = data;
      
      logger.info(`[Socket] 用户 ${userId} 更新题库 ${questionSetId} 的访问权限: ${hasAccess ? '有权限' : '无权限'}, 来源: ${source || '未知'}`);
      
      // 广播给该用户的其他设备（除了当前socket）
      socket.to(userId).emit('questionSet:accessUpdate', {
        userId,
        questionSetId,
        hasAccess,
        remainingDays,
        timestamp: Date.now(),
        source: 'user_sync',
        sourceDevice: socket.id
      });
      
    } catch (error: any) {
      logger.error(`[Socket] 更新题库访问权限错误:`, error);
      socket.emit('error', {
        message: error instanceof CustomError ? error.message : '更新题库访问权限失败',
        code: error instanceof CustomError ? error.statusCode : 500
      });
    }
  });
}; 