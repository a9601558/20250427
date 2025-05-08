import axios from 'axios';
import { API_BASE_URL } from '../services/api';

// 获取API基础URL
const BASE_URL = API_BASE_URL || 'http://localhost:3000/api';

/**
 * 处理支付流程 - 只使用真实支付API
 */
export const processPayment = async (
  amount: number,
  currency: string = 'cny',
  metadata?: Record<string, string>
) => {
  console.log(`[支付] 创建支付意向: 金额=${amount}, 货币=${currency}`);
  
  // 从localStorage获取token
  const token = localStorage.getItem('token');
  if (!token) {
    throw new Error('未找到认证信息，请重新登录');
  }
  
  // 真实支付流程
  console.log('[支付] 使用真实支付流程');
  const response = await axios.post(
    `${BASE_URL}/payments/create-intent`,
    {
      amount,
      currency, 
      metadata
    },
    {
      headers: {
        Authorization: `Bearer ${token}`,
        'Content-Type': 'application/json'
      }
    }
  );
  
  if (response.data && response.data.success) {
    console.log('[支付] 成功创建支付意向:', response.data.data.id);
    return response.data.data;
  } else {
    throw new Error(response.data?.message || '创建支付意向失败');
  }
};

/**
 * 创建购买记录 - 只使用真实API
 */
export async function createDirectPurchase(
  questionSetId: string,
  price: any = 0
) {
  // 确保价格是一个有效的数字
  const numericPrice = typeof price === 'number' ? price : 
                       (typeof price === 'string' && !isNaN(parseFloat(price)) ? parseFloat(price) : 0);
  
  console.log(`[支付] 创建购买: 题库=${questionSetId}, 价格=${numericPrice}`);
  
  // 从localStorage获取token
  const token = localStorage.getItem('token');
  if (!token) {
    throw new Error('未找到认证信息，请重新登录');
  }
  
  // 创建购买记录
  const response = await axios.post(
    `${BASE_URL}/purchases/force-create`,
    {
      questionSetId,
      paymentMethod: 'direct',
      price: numericPrice,
      forceBuy: true
    },
    {
      headers: {
        Authorization: `Bearer ${token}`,
        'Content-Type': 'application/json'
      }
    }
  );
  
  // 检查是否成功
  if (!response.data || !response.data.success) {
    throw new Error(response.data?.message || '购买失败');
  }
  
  console.log('[支付] 成功创建购买:', response.data.data);
  
  // 获取购买记录
  const purchaseData = response.data.data;
  
  // 调用update-access接口确保访问权限更新
  try {
    await axios.post(
      `${BASE_URL}/purchases/update-access`,
      {
        questionSetId,
        purchaseId: purchaseData.id
      },
      {
        headers: {
          Authorization: `Bearer ${token}`,
          'Content-Type': 'application/json'
        }
      }
    );
  } catch (updateError) {
    console.warn('[支付] 更新访问权限失败，但购买已创建');
    // 继续流程，不中断
  }
  
  return purchaseData;
}

/**
 * 验证题库是否为付费题库
 */
export async function validatePaidQuizStatus(questionSetId: string) {
  console.log(`[支付] 验证题库付费状态: ${questionSetId}`);
  
  // 从localStorage获取token
  const token = localStorage.getItem('token');
  
  // 添加时间戳参数防止缓存
  const timestamp = Date.now();
  
  const response = await axios.get(
    `${BASE_URL}/question-sets/${questionSetId}?t=${timestamp}`,
    {
      headers: token ? {
        Authorization: `Bearer ${token}`,
        'Cache-Control': 'no-cache, no-store'
      } : {
        'Cache-Control': 'no-cache, no-store'
      }
    }
  );
  
  if (response.data && (response.data.data || response.data)) {
    const quizData = response.data.data || response.data;
    
    // 使用isPaidQuiz通用函数检查题库状态
    const isPaid = isPaidQuiz(quizData);
    console.log(`[支付] 题库${questionSetId}付费状态: ${isPaid}`);
    
    return {
      isPaid,
      price: quizData.price || 0,
      title: quizData.title || '未知题库',
      rawData: quizData
    };
  }
  
  return { isPaid: false, price: 0, title: '未知题库', rawData: null };
}

/**
 * 通用的isPaidQuiz工具函数，确保全应用一致性
 */
export function isPaidQuiz(quizData: any, debug = false): boolean {
  if (!quizData) {
    if (debug) console.log('[isPaidQuiz] quizData is null or undefined');
    return false;
  }
  
  // 处理可能的嵌套结构 - 服务器响应可能包含data字段
  const dataToCheck = quizData.data ? quizData.data : quizData;
  
  if (debug) {
    console.log('[isPaidQuiz] DEBUGGING DATA:', {
      original: quizData,
      dataToCheck: dataToCheck,
      id: dataToCheck.id,
      isPaid: dataToCheck.isPaid,
      isPaidRaw: quizData.isPaid,
      isPaidType: typeof dataToCheck.isPaid,
      price: dataToCheck.price,
      priceType: typeof dataToCheck.price
    });
  }
  
  // 处理所有可能的情况
  if (dataToCheck.isPaid === true) {
    if (debug) console.log('[isPaidQuiz] true because isPaid === true');
    return true;
  }
  
  if (typeof dataToCheck.isPaid === 'number' && dataToCheck.isPaid === 1) {
    if (debug) console.log('[isPaidQuiz] true because isPaid === 1 (number)');
    return true;
  }
  
  if (String(dataToCheck.isPaid) === '1') {
    if (debug) console.log('[isPaidQuiz] true because String(isPaid) === "1"');
    return true;
  }
  
  // 检查JSON字符串，有时数据可能被序列化
  if (typeof dataToCheck.isPaid === 'string' && 
     (dataToCheck.isPaid.toLowerCase() === 'true' || dataToCheck.isPaid === '1')) {
    if (debug) console.log('[isPaidQuiz] true because isPaid string is "true" or "1"');
    return true;
  }
  
  // 仅在API的意外行为时才依赖价格：如果价格是正数，很可能是付费题库
  if (dataToCheck.price && parseFloat(dataToCheck.price) > 0) {
    if (debug) console.log('[isPaidQuiz] true because price > 0:', dataToCheck.price);
    return true;
  }
  
  return false;
} 