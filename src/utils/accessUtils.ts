/**
 * 访问权限相关工具函数库
 */
import { isPaidQuiz } from './paymentUtils';

/**
 * 保存题库访问权限到本地存储
 * @param questionSetId 题库ID
 * @param hasAccess 是否有权限
 */
export const saveAccessToLocalStorage = (questionSetId: string, hasAccess: boolean): void => {
  if (!questionSetId) return;
  
  try {
    const normalizedId = String(questionSetId).trim();
    console.log(`[accessUtils] 保存题库 ${normalizedId} 的访问权限: ${hasAccess}`);
    
    // 获取当前访问权限列表
    const accessRightsStr = localStorage.getItem('quizAccessRights');
    let accessRights: Record<string, boolean | number> = {};
    
    if (accessRightsStr) {
      try {
        const parsed = JSON.parse(accessRightsStr);
        if (parsed && typeof parsed === 'object') {
          accessRights = parsed;
        } else {
          console.error('[accessUtils] 访问权限记录格式错误，重新创建');
        }
      } catch (e) {
        console.error('[accessUtils] 解析访问权限记录失败，将创建新记录', e);
      }
    }
    
    // 更新访问权限 - 使用精确ID匹配
    accessRights[normalizedId] = hasAccess;
    
    // 记录修改时间，便于后续清理过期数据
    const timestamp = Date.now();
    const accessRightsWithMeta = {
      ...accessRights,
      [`${normalizedId}_timestamp`]: timestamp
    };
    
    // 保存回localStorage
    localStorage.setItem('quizAccessRights', JSON.stringify(accessRightsWithMeta));
    console.log(`[accessUtils] 已保存题库 ${normalizedId} 的访问权限: ${hasAccess}`);
    
    // 记录检查日志，便于调试
    const accessLog = localStorage.getItem('accessRightsLog') || '[]';
    try {
      const logEntries = JSON.parse(accessLog);
      logEntries.push({
        id: normalizedId,
        access: hasAccess,
        timestamp
      });
      // 只保留最近50条记录
      const recentEntries = logEntries.slice(-50);
      localStorage.setItem('accessRightsLog', JSON.stringify(recentEntries));
    } catch (e) {
      console.error('[accessUtils] 保存访问日志失败', e);
    }
  } catch (e) {
    console.error('[accessUtils] 保存访问权限失败', e);
  }
};

/**
 * 从本地存储获取题库访问权限
 * @param questionSetId 题库ID
 * @returns 是否有访问权限
 */
export const getAccessFromLocalStorage = (questionSetId: string): boolean => {
  if (!questionSetId) return false;
  
  try {
    const normalizedId = String(questionSetId).trim();
    
    const accessRightsStr = localStorage.getItem('quizAccessRights');
    if (!accessRightsStr) return false;
    
    const accessRights = JSON.parse(accessRightsStr) as Record<string, boolean | number>;
    const hasAccess = !!accessRights[normalizedId];
    
    return hasAccess;
  } catch (e) {
    console.error('[accessUtils] 获取访问权限失败', e);
    return false;
  }
};

/**
 * 保存已兑换的题库ID到localStorage
 * @param questionSetId 题库ID
 */
export const saveRedeemedQuestionSetId = (questionSetId: string): void => {
  if (!questionSetId) return;
  
  try {
    const normalizedId = String(questionSetId).trim();
    
    // 获取现有的已兑换题库IDs
    const redeemedQuestionSetIds = localStorage.getItem('redeemedQuestionSetIds');
    
    let newList = '';
    
    if (redeemedQuestionSetIds) {
      try {
        const parsed = JSON.parse(redeemedQuestionSetIds);
        
        // 检查是否已存在
        if (Array.isArray(parsed) && !parsed.includes(normalizedId)) {
          parsed.push(normalizedId);
          newList = JSON.stringify(parsed);
        } else if (typeof parsed === 'string' && parsed !== normalizedId) {
          newList = JSON.stringify([parsed, normalizedId]);
        } else {
          newList = JSON.stringify([normalizedId]);
        }
      } catch (error) {
        console.error('[accessUtils] 解析已兑换题库IDs失败:', error);
        newList = JSON.stringify([normalizedId]);
      }
    } else {
      newList = JSON.stringify([normalizedId]);
    }
    
    localStorage.setItem('redeemedQuestionSetIds', newList);
  } catch (error) {
    console.error('[accessUtils] 保存已兑换题库ID失败:', error);
  }
};

/**
 * 全面检查题库访问权限（从所有可能的来源）
 * @param questionSet 题库对象
 * @param user 用户对象
 * @returns 是否有访问权限
 */
export const checkFullAccessFromAllSources = (
  questionSet: any, 
  user: any, 
  hasRedeemed: boolean = false
): boolean => {
  if (!questionSet || !questionSet.id) {
    return false;
  }
  
  // 标准化当前题库ID，确保精确匹配
  const questionSetId = String(questionSet.id).trim();
  
  // 步骤1：免费题库检查（最高优先级）
  if (!isPaidQuiz(questionSet)) {
    return true;
  }
  
  // 步骤2：检查用户购买记录
  if (user && user.purchases && Array.isArray(user.purchases)) {
    // 严格匹配购买记录中的题库ID
    const purchase = user.purchases.find((p: any) => {
      // 确保有效的questionSetId
      if (!p.questionSetId) return false;
      
      // 严格匹配，不允许部分匹配
      const purchaseId = String(p.questionSetId).trim();
      const isExactMatch = purchaseId === questionSetId;
      
      return isExactMatch;
    });
    
    if (purchase) {
      // 检查购买记录是否有效（未过期且状态正确）
      const now = new Date();
      const expiryDate = purchase.expiryDate ? new Date(purchase.expiryDate) : null;
      const isExpired = expiryDate && expiryDate <= now;
      
      // 仅接受明确的active或completed状态
      const validStates = ['active', 'completed', 'success'];
      const isActive = validStates.includes(purchase.status || '');
      
      const purchaseHasAccess = !isExpired && isActive;
      
      if (purchaseHasAccess) {
        return true;
      }
    }
  }
  
  // 步骤3：检查本地存储的兑换记录
  try {
    const redeemedStr = localStorage.getItem('redeemedQuestionSetIds');
    if (redeemedStr) {
      const redeemedIds = JSON.parse(redeemedStr);
      
      if (Array.isArray(redeemedIds)) {
        // 只检查完全匹配，不再支持部分匹配
        const isRedeemed = redeemedIds.some(id => String(id || '').trim() === questionSetId);
        
        if (isRedeemed) {
          return true;
        }
      }
    }
  } catch (e) {
    console.error('[accessUtils] 检查兑换记录出错:', e);
  }
  
  // 步骤4：检查本地存储的访问权限记录
  try {
    const accessRightsStr = localStorage.getItem('quizAccessRights');
    if (accessRightsStr) {
      const accessRights = JSON.parse(accessRightsStr);
      
      // 确保只检查精确匹配的权限
      if (accessRights && accessRights[questionSetId] === true) {
        return true;
      }
    }
  } catch (e) {
    console.error('[accessUtils] 检查本地访问权限出错:', e);
  }
  
  // 步骤5：检查其他状态变量
  if (hasRedeemed) {
    return true;
  }
  
  // 步骤6：如果所有检查都未通过，返回false
  return false;
}; 