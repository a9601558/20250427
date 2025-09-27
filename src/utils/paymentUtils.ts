import axios from 'axios';
import { toast } from 'react-toastify';
import { API_BASE_URL } from '../services/api';

// 获取API基础URL，确保末尾没有斜杠
const BASE_URL = API_BASE_URL.endsWith('/') ? API_BASE_URL.slice(0, -1) : API_BASE_URL;

// 防抖函数 - 防止连续快速调用
export function debounce<F extends (...args: any[]) => any>(func: F, waitFor: number) {
  let timeout: ReturnType<typeof setTimeout> | null = null;
  
  return function(...args: Parameters<F>) {
    if (timeout !== null) {
      clearTimeout(timeout);
    }
    timeout = setTimeout(() => func(...args), waitFor);
  };
}

// 支付信息接口
interface PaymentMetadata {
  userId: string;
  questionSetId: string;
  questionSetTitle: string;
}

// 支付结果接口
interface PaymentResult {
  clientSecret: string;
  paymentIntentId: string;
}

// 安全的token验证函数
function validateToken(): string {
  const token = localStorage.getItem('token');
  if (!token || token.trim() === '') {
    throw new Error('认证信息已过期，请重新登录');
  }
  
  try {
    // 简单的JWT格式验证
    const parts = token.split('.');
    if (parts.length !== 3) {
      throw new Error('无效的认证信息格式');
    }
    
    // 解码payload检查过期时间
    const payload = JSON.parse(atob(parts[1]));
    if (payload.exp && payload.exp < Date.now() / 1000) {
      localStorage.removeItem('token'); // 清除过期token
      throw new Error('认证信息已过期，请重新登录');
    }
  } catch (e) {
    console.warn('[PaymentUtils] Token validation failed:', e);
    // 如果无法解码，仍然返回token，让后端验证
  }
  
  return token;
}

// 支付金额验证函数
function validateAmount(amount: number): number {
  if (typeof amount !== 'number' || isNaN(amount) || amount <= 0) {
    throw new Error('支付金额必须为正数');
  }
  
  if (amount > 100000) { // 限制最大金额
    throw new Error('支付金额超出限制（最大100,000元）');
  }
  
  if (amount < 0.01) { // 限制最小金额
    throw new Error('支付金额不能小于0.01元');
  }
  
  return Math.round(amount * 100) / 100; // 保留两位小数
}

// 重试配置
const RETRY_CONFIG = {
  maxRetries: 3,
  retryDelay: 1000, // 1秒
  backoffMultiplier: 2 // 指数退避
};

// 重试函数
async function retryWithBackoff<T>(
  fn: () => Promise<T>,
  retries = RETRY_CONFIG.maxRetries
): Promise<T> {
  try {
    return await fn();
  } catch (error: any) {
    if (retries > 0 && shouldRetry(error)) {
      const delay = RETRY_CONFIG.retryDelay * Math.pow(RETRY_CONFIG.backoffMultiplier, RETRY_CONFIG.maxRetries - retries);
      console.log(`[PaymentUtils] Retrying in ${delay}ms, ${retries} attempts remaining`);
      
      await new Promise(resolve => setTimeout(resolve, delay));
      return retryWithBackoff(fn, retries - 1);
    }
    throw error;
  }
}

// 判断是否应该重试
function shouldRetry(error: any): boolean {
  // 网络错误或服务器错误可以重试
  if (error.code === 'ECONNABORTED' || error.message?.includes('timeout')) {
    return true;
  }
  
  if (error.response) {
    const status = error.response.status;
    // 5xx 服务器错误或 429 限流可以重试
    return status >= 500 || status === 429;
  }
  
  return false;
}

/**
 * 处理支付流程 - 创建支付意向
 * 按照 Stripe 官方最佳实践实现
 */
export const processPayment = async (
  amount: number,
  currency: string = 'cny',
  metadata: PaymentMetadata
): Promise<PaymentResult> => {
  console.log(`[PaymentUtils] 创建支付意向，金额: ${amount} ${currency}`, metadata);
  
  try {
    // 验证输入参数
    const validatedAmount = validateAmount(amount);
    const token = validateToken();
    
    // 验证metadata
    if (!metadata.userId || !metadata.questionSetId) {
      throw new Error('缺少必要的支付信息');
    }
    
    // 转换为分（Stripe要求）
    const amountInCents = Math.round(validatedAmount * 100);
    
    // 创建支付意向（带重试）
    const response = await retryWithBackoff(async () => {
      return axios.post(
        `${BASE_URL}/payments/create-intent`,
        {
          amount: amountInCents,
          currency: currency.toLowerCase(),
          metadata: {
            ...metadata,
            // 添加安全信息
            clientTimestamp: Date.now(),
            userAgent: navigator.userAgent.substring(0, 100) // 限制长度
          }
        },
        {
          headers: {
            'Authorization': `Bearer ${token}`,
            'Content-Type': 'application/json',
            'X-Client-Version': '1.0.0' // 客户端版本
          },
          timeout: 15000 // 15秒超时
        }
      );
    });
    
    // 验证响应
    if (!response.data || !response.data.success) {
      const errorMsg = response.data?.message || '创建支付意向失败';
      throw new Error(errorMsg);
    }
    
    // 验证返回数据
    const { clientSecret, paymentIntentId } = response.data;
    if (!clientSecret || !paymentIntentId) {
      throw new Error('服务器返回数据不完整');
    }
    
    // 记录成功日志
    console.log(`[PaymentUtils] 支付意向创建成功: ${paymentIntentId}`);
    
    return {
      clientSecret,
      paymentIntentId
    };
  } catch (error: any) {
    console.error('[PaymentUtils] 创建支付意向错误:', error);
    
    // 更精确的错误处理
    let errorMessage = '支付初始化失败';
    
    if (error.response) {
      const status = error.response.status;
      const data = error.response.data;
      
      switch (status) {
        case 401:
        case 403:
          errorMessage = '认证失败，请重新登录';
          break;
        case 400:
          errorMessage = data?.message || '请求参数错误';
          break;
        case 429:
          errorMessage = '请求过于频繁，请稍后再试';
          break;
        case 500:
        case 502:
        case 503:
          errorMessage = '服务器暂时不可用，请稍后重试';
          break;
        default:
          errorMessage = data?.message || `服务器错误 (${status})`;
      }
    } else if (error.code === 'ECONNABORTED' || error.message?.includes('timeout')) {
      errorMessage = '网络连接超时，请检查网络后重试';
    } else {
      errorMessage = error.message || '未知错误';
    }
    
    // 显示用户友好的错误信息
    toast.error(errorMessage, {
      position: 'top-center',
      autoClose: 5000
    });
    
    throw new Error(errorMessage);
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

/**
 * 验证支付状态并同步购买记录
 */
export const verifyPaymentStatus = async (paymentIntentId: string): Promise<boolean> => {
  console.log(`[PaymentUtils] 验证支付状态，支付ID: ${paymentIntentId}`);
  
  try {
  const token = localStorage.getItem('token');
  if (!token) {
      throw new Error('需要登录才能验证支付');
  }
  
    // 修正API端点
    const response = await axios.post(
      `${BASE_URL}/payments/verify-payment`,
      { paymentIntentId },
      {
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json'
        }
      }
    );
    
    if (!response.data || !response.data.success) {
      throw new Error(response.data?.message || '支付验证失败');
    }
    
    return true;
  } catch (error: any) {
    console.error('[PaymentUtils] 支付验证错误:', error);
    return false;
  }
};

/**
 * 完成Stripe支付购买
 * @param questionSetId 题库ID
 * @param paymentIntentId 支付意向ID
 * @param amount 支付金额
 * @returns 购买结果
 */
export const completeStripePurchase = async (
  questionSetId: string,
  paymentIntentId: string,
  amount: number
): Promise<any> => {
  console.log(`[PaymentUtils] 完成Stripe购买，题库ID: ${questionSetId}, 支付ID: ${paymentIntentId}`);
  
  try {
    const token = localStorage.getItem('token');
    if (!token) {
      throw new Error('需要登录才能完成购买');
    }
    
    // 修正API端点
    const response = await axios.post(
      `${BASE_URL}/payments/complete-purchase`,
      {
        questionSetId,
        paymentIntentId,
        amount: Math.round(amount * 100) // 转换为分
      },
      {
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json'
        }
      }
    );
    
    if (!response.data || !response.data.success) {
      throw new Error(response.data?.message || '完成购买失败');
  }
    
    return response.data;
  } catch (error: any) {
    console.error('[PaymentUtils] 完成购买错误:', error);
    throw error;
  }
};

/**
 * 刷新用户购买记录
 * @returns 用户的购买记录列表
 */
export const refreshUserPurchases = async (): Promise<any[]> => {
  console.log('[PaymentUtils] 刷新用户购买记录');
  
  try {
  const token = localStorage.getItem('token');
  if (!token) {
    return [];
  }
  
    const response = await axios.get(
      `${BASE_URL}/purchases`,
      {
        headers: {
          'Authorization': `Bearer ${token}`
        }
      }
    );
    
    if (!response.data || !response.data.success) {
      throw new Error(response.data?.message || '获取购买记录失败');
    }
    
    return response.data.purchases || [];
  } catch (error: any) {
    console.error('[PaymentUtils] 获取购买记录错误:', error);
    return [];
  }
}; 