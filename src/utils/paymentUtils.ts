import axios from 'axios';
import { API_BASE_URL } from '../services/api';

// 获取API基础URL
const BASE_URL = API_BASE_URL || 'http://localhost:3000/api';

// 支付相关工具函数

/**
 * 创建模拟支付意向
 * 用于开发环境中测试支付流程
 */
export const createMockPaymentIntent = async (params: {
  amount: number;
  currency: string;
  metadata?: Record<string, string>;
}): Promise<{
  id: string;
  client_secret: string;
  amount: number;
  currency: string;
  metadata?: Record<string, string>;
}> => {
  // 模拟API请求延迟
  await new Promise(resolve => setTimeout(resolve, 800));
  
  // 生成随机ID和密钥
  const id = `pi_mock_${Math.random().toString(36).substring(2, 15)}`;
  const clientSecret = `${id}_secret_${Math.random().toString(36).substring(2, 15)}`;
  
  // 返回模拟的支付意向对象
  return {
    id,
    client_secret: clientSecret,
    amount: params.amount,
    currency: params.currency,
    metadata: params.metadata
  };
};

/**
 * 确认模拟支付
 * 用于开发环境中测试支付确认流程
 */
export const confirmMockPayment = async (clientSecret: string, paymentData: any): Promise<{
  id: string;
  status: 'succeeded' | 'failed';
  error?: { message: string };
}> => {
  // 模拟API请求延迟
  await new Promise(resolve => setTimeout(resolve, 1200));
  
  // 从client_secret中提取支付意向ID
  const idMatch = clientSecret.match(/^(pi_mock_[a-z0-9]+)_secret/);
  const id = idMatch ? idMatch[1] : `pi_mock_${Math.random().toString(36).substring(2, 15)}`;
  
  // 95%的成功率，模拟一些随机失败
  const isSuccessful = Math.random() > 0.05;
  
  if (isSuccessful) {
    return {
      id,
      status: 'succeeded'
    };
  } else {
    return {
      id,
      status: 'failed',
      error: {
        message: '模拟支付失败 - 随机错误'
      }
    };
  }
};

/**
 * 处理支付流程
 * 根据环境决定使用真实Stripe API还是模拟API
 */
export const processPayment = async (
  amount: number,
  currency: string = 'cny',
  metadata?: Record<string, string>
) => {
  console.log(`[支付] 创建支付意向: 金额=${amount}, 货币=${currency}`);
  
  try {
    // 从localStorage获取token
    const token = localStorage.getItem('token');
    if (!token) {
      throw new Error('未找到认证信息，请重新登录');
    }
    
    // 根据环境决定使用真实支付还是模拟支付
    if (import.meta.env.MODE === 'development' || import.meta.env.VITE_USE_MOCK_PAYMENT === 'true') {
      console.log('[支付] 使用模拟支付流程');
      return createMockPaymentIntent({ amount, currency, metadata });
    }
    
    // 真实Stripe支付流程
    console.log('[支付] 使用真实Stripe支付流程');
    try {
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
    } catch (error: any) {
      // 检查是否是404错误（API端点不存在）
      if (error.response && error.response.status === 404) {
        console.log('[支付] 支付API不可用 (404)，自动切换到模拟支付');
        return createMockPaymentIntent({ amount, currency, metadata });
      }
      // 其他错误继续抛出
      throw error;
    }
  } catch (error: any) {
    console.error('[支付] 创建支付意向失败:', error);
    
    // 如果是404错误，也使用模拟支付作为回退
    if (error.response && error.response.status === 404) {
      console.log('[支付] 支付API不可用 (404)，自动切换到模拟支付');
      return createMockPaymentIntent({ amount, currency, metadata });
    }
    
    // 如果后端报错但仍希望继续，可以使用模拟支付作为回退
    if (import.meta.env.VITE_ENABLE_FALLBACK === 'true') {
      console.log('[支付] 后端创建支付意向失败，使用模拟支付作为回退');
      return createMockPaymentIntent({ amount, currency, metadata });
    }
    throw new Error(error.response?.data?.message || error.message || '创建支付意向失败');
  }
};

// 直接创建购买记录 - 绕过支付流程（用于测试和调试）
export async function createDirectPurchase(
  questionSetId: string,
  price: number = 0
) {
  console.log(`[支付] 创建直接购买: 题库=${questionSetId}, 价格=${price}`);
  
  try {
    // 从localStorage获取token
    const token = localStorage.getItem('token');
    if (!token) {
      throw new Error('未找到认证信息，请重新登录');
    }
    
    const response = await axios.post(
      `${BASE_URL}/purchases/force-create`,
      {
        questionSetId,
        paymentMethod: 'direct',
        price,
        forceBuy: true  // 标记为强制购买，跳过isPaid验证
      },
      {
        headers: {
          Authorization: `Bearer ${token}`,
          'Content-Type': 'application/json'
        }
      }
    );
    
    if (response.data && response.data.success) {
      console.log('[支付] 成功创建直接购买:', response.data.data);
      return response.data.data;
    } else {
      throw new Error(response.data?.message || '直接购买失败');
    }
  } catch (error: any) {
    console.error('[支付] 直接购买失败:', error);
    
    // 如果API失败，使用模拟数据作为回退
    console.log('[支付] API购买失败，使用本地模拟购买数据');
    
    // 创建模拟购买数据
    return {
      id: `local_purchase_${Math.random().toString(36).substring(2, 10)}`,
      questionSetId,
      purchaseDate: new Date().toISOString(),
      expiryDate: new Date(Date.now() + 180 * 24 * 60 * 60 * 1000).toISOString(), // 6个月
      status: 'active',
      paymentMethod: 'direct',
      transactionId: `tr_local_${Math.random().toString(36).substring(2, 10)}`,
      amount: price,
      isForced: true
    };
  }
}

// 验证题库是否为付费题库
export async function validatePaidQuizStatus(questionSetId: string) {
  console.log(`[支付] 验证题库付费状态: ${questionSetId}`);
  
  try {
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
  } catch (error) {
    console.error('[支付] 验证题库付费状态失败:', error);
    // 验证失败时，默认认为是付费题库（宁可错误提示付费，也不能错误提示免费）
    return { isPaid: true, price: 0, title: '未知题库', rawData: null, error };
  }
}

// 通用的isPaidQuiz工具函数，确保全应用一致性
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
      isPaidRaw: quizData.isPaid, // 原始数据的isPaid
      isPaidType: typeof dataToCheck.isPaid,
      price: dataToCheck.price,
      priceType: typeof dataToCheck.price,
      stringifiedIsPaid: String(dataToCheck.isPaid),
      booleanCheck: dataToCheck.isPaid === true,
      numberCheck: typeof dataToCheck.isPaid === 'number' && dataToCheck.isPaid === 1,
      stringCheck: String(dataToCheck.isPaid) === '1',
      priceCheck: dataToCheck.price && parseFloat(dataToCheck.price) > 0,
      dataField: quizData.data ? '存在' : '不存在'
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
  
  // 如果所有检查都失败，日志所有值以便调试
  if (debug) {
    console.log('[isPaidQuiz] Quiz is NOT paid. Raw data:', {
      id: dataToCheck.id || 'undefined',
      isPaid: dataToCheck.isPaid,
      isPaidType: typeof dataToCheck.isPaid,
      isPaidValue: String(dataToCheck.isPaid),
      price: dataToCheck.price,
      priceType: typeof dataToCheck.price,
      priceValue: String(dataToCheck.price)
    });
  }
  
  // 默认认为非付费
  return false;
} 