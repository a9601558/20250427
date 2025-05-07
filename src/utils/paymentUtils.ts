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
  // 检查是否使用模拟支付
  const useMockPayment = import.meta.env.MODE === 'development' || 
                           import.meta.env.VITE_USE_MOCK_PAYMENT === 'true';
  
  if (useMockPayment) {
    console.log('[支付] 使用模拟支付API');
    return createMockPaymentIntent({ amount, currency, metadata });
  } else {
    // 使用真实API
    console.log('[支付] 使用真实Stripe API');
    
    try {
      const response = await fetch('/api/payment/create-intent', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          amount: Math.round(amount * 100), // 转换为分
          currency,
          metadata
        }),
      });
      
      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.message || '创建支付意向失败');
      }
      
      const data = await response.json();
      return {
        id: data.paymentIntentId,
        client_secret: data.clientSecret,
        amount,
        currency,
        metadata
      };
    } catch (err) {
      console.error('[支付] 创建支付Intent失败:', err);
      throw err;
    }
  }
}; 