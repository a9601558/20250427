import { useCallback } from 'react';
import { BaseQuestionSet, AccessType } from '../types/questionSet';
import apiClient from '../utils/api-client';

interface AccessCacheData {
  hasAccess: boolean;
  remainingDays: number | null;
  paymentMethod?: string;
  accessType?: string;
  timestamp: number;
}

export interface UseAccessManagementProps {
  userId?: string;
}

export function useAccessManagement({ userId }: UseAccessManagementProps = {}) {
  // 获取本地存储的访问信息缓存
  const getLocalAccessCache = useCallback(() => {
    try {
      const cachedData = localStorage.getItem('question_set_access');
      if (cachedData) {
        return JSON.parse(cachedData) || {};
      }
    } catch (error) {
      console.error('[useAccessManagement] 读取本地缓存失败', error);
    }
    return {};
  }, []);

  // 保存访问信息到本地存储
  const saveAccessToLocalStorage = useCallback((
    questionSetId: string, 
    hasAccess: boolean, 
    remainingDays: number | null, 
    paymentMethod?: string,
    accessType?: string
  ) => {
    if (!userId) return;
    
    try {
      const cache = getLocalAccessCache();
      
      // 确保用户ID索引存在
      if (!cache[userId]) {
        cache[userId] = {};
      }
      
      // 更新题库的访问信息
      cache[userId][questionSetId] = {
        hasAccess,
        remainingDays,
        paymentMethod,
        accessType,
        timestamp: Date.now()
      };
      
      // 保存回本地存储
      localStorage.setItem('question_set_access', JSON.stringify(cache));
    } catch (error) {
      console.error('[useAccessManagement] 保存本地缓存失败', error);
    }
  }, [userId, getLocalAccessCache]);
  
  // 从本地缓存获取访问状态
  const getAccessFromLocalCache = useCallback((questionSetId: string, currentUserId?: string) => {
    if (!questionSetId || !currentUserId) return null;
    
    try {
      const cache = getLocalAccessCache();
      if (cache[currentUserId] && cache[currentUserId][questionSetId]) {
        return cache[currentUserId][questionSetId] as AccessCacheData;
      }
    } catch (e) {
      console.error('[useAccessManagement] 读取本地缓存失败:', e);
    }
    return null;
  }, [getLocalAccessCache]);
  
  // 请求数据库直接检查权限
  const hasAccessInDatabase = useCallback(async (questionSetId: string): Promise<boolean> => {
    if (!userId) return false;
    
    try {
      console.log(`[useAccessManagement] 直接向数据库请求题库 ${questionSetId} 的访问权限`);
      
      // 添加时间戳防止缓存，将缓存时间设为0
      const response = await apiClient.get(`/api/purchases/check/${questionSetId}`, {
        userId: userId,
        _t: Date.now() // 防止缓存
      }, { 
        cacheDuration: 0 // 禁用缓存，确保每次都获取最新数据
      });
      
      const hasAccess = response?.success && response?.data?.hasAccess === true;
      console.log(`[useAccessManagement] 数据库权限检查结果: ${hasAccess ? '有权限' : '无权限'}`);
      
      return hasAccess;
    } catch (error) {
      console.error('[useAccessManagement] 检查数据库权限失败:', error);
      return false;
    }
  }, [userId]);

  // 确定访问状态的函数
  const determineAccessStatus = useCallback((
    set: BaseQuestionSet,
    hasAccessValue: boolean,
    remainingDays: number | null,
    paymentMethod?: string
  ) => {
    // 如果是免费题库，始终可访问且类型为trial
    if (!set.isPaid) {
      console.log(`[determineAccessStatus] 题库ID=${set.id} 免费题库，自动授予访问权限`);
      return {
        hasAccess: true,
        accessType: 'trial' as AccessType,
        remainingDays: null
      };
    }
    
    // 优化访问类型判断逻辑
    let accessType: AccessType;
    let finalHasAccess = hasAccessValue;
    
    // 根据支付方式优先判断
    if (paymentMethod === 'redeem') {
      accessType = 'redeemed';
    } else if (remainingDays !== null && remainingDays <= 0) {
      accessType = 'expired';
      finalHasAccess = false;
    } else if (hasAccessValue) {
      accessType = 'paid';
    } else {
      // 重要：付费题库未购买时，accessType不应该是'trial'，应该是'paid'但hasAccess为false
      // 这样避免在UI上显示"免费"标签
      accessType = 'paid';
      finalHasAccess = false;
    }
    
    console.log(`[determineAccessStatus] 题库ID=${set.id}, 标题="${set.title}" - 付费=${set.isPaid}, 有权限=${finalHasAccess}, 类型=${accessType}, 支付方式=${paymentMethod || '未知'}, 剩余天数=${remainingDays}`);
    
    return {
      hasAccess: finalHasAccess,
      accessType,
      remainingDays
    };
  }, []);

  // 清理过期的访问权限缓存
  const cleanupExpiredCache = useCallback(() => {
    if (!userId) return;
    
    console.log('[useAccessManagement] 清除本地过期缓存');
    
    try {
      const cacheKey = 'question_set_access';
      const cache = localStorage.getItem(cacheKey);
      
      if (cache) {
        const cacheData = JSON.parse(cache);
        let hasUpdates = false;
        
        // 遍历用户的缓存
        if (cacheData[userId]) {
          const userCache = cacheData[userId];
          
          // 遍历该用户的所有题库缓存
          Object.keys(userCache).forEach(qsId => {
            const record = userCache[qsId];
            const cacheAge = Date.now() - (record.timestamp || 0);
            
            // 缓存超过24小时视为过期，确保从服务器获取最新状态
            if (cacheAge > 86400000) { // 24小时 = 86400000毫秒
              console.log(`[useAccessManagement] 清除过期缓存: ${qsId}，缓存时间: ${cacheAge/1000/60}分钟`);
              delete userCache[qsId];
              hasUpdates = true;
            }
          });
          
          // 如果有更新，保存回localStorage
          if (hasUpdates) {
            localStorage.setItem(cacheKey, JSON.stringify(cacheData));
            console.log('[useAccessManagement] 已清理过期缓存');
          }
        }
      }
    } catch (error) {
      console.error('[useAccessManagement] 清除缓存失败:', error);
    }
  }, [userId]);

  return {
    getLocalAccessCache,
    saveAccessToLocalStorage,
    getAccessFromLocalCache,
    hasAccessInDatabase,
    determineAccessStatus,
    cleanupExpiredCache
  };
}

export default useAccessManagement; 