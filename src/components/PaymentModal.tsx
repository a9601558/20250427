import React, { useState, useEffect, useRef } from 'react';
import { useUser } from '../contexts/UserContext';
import { QuestionSet } from '../types';
import { useSocket } from '../contexts/SocketContext';
import { toast } from 'react-toastify';
import { createMockPaymentIntent, confirmMockPayment, processPayment } from '../utils/paymentUtils';
import { questionSetApi } from '../utils/api';
import { saveAccessToLocalStorage } from '../utils/accessUtils';
import { formatDate, getFutureDate } from '../utils/timeUtils';

interface PaymentModalProps {
  isOpen?: boolean;
  onClose: () => void;
  questionSet?: QuestionSet;
  questionSetId?: string;
  onSuccess: (purchaseInfo: {
    questionSetId: string;
    remainingDays: number;
  }) => void;
}

// Stripe公钥从环境变量获取
const STRIPE_PUBLIC_KEY = import.meta.env.VITE_STRIPE_PUBLIC_KEY || 
  'pk_test_51RHMVW4ec3wxfwe9vME773VFyquoIP1bVWbsCDZgrgerfzp8YMs0rLS4ZSleICEcIf9gmLIEftwXvPygbLp1LEkv00r5M3rCIV';

const PaymentModal: React.FC<PaymentModalProps> = ({ isOpen = true, onClose, questionSet: propQuestionSet, questionSetId, onSuccess }) => {
  const { user, addPurchase } = useUser();
  const { socket } = useSocket();
  const [isProcessing, setIsProcessing] = useState(false);
  const [error, setError] = useState('');
  const [successMessage, setSuccessMessage] = useState('');
  const [stripeLoaded, setStripeLoaded] = useState(false);
  const [stripe, setStripe] = useState<any>(null);
  const [cardElement, setCardElement] = useState<any>(null);
  const [paymentMethod, setPaymentMethod] = useState<string>('');
  const scriptRef = useRef<HTMLScriptElement | null>(null);
  const cardRef = useRef<any>(null);
  const [questionSet, setQuestionSet] = useState<QuestionSet | undefined>(propQuestionSet);
  const [isLoading, setIsLoading] = useState(!!questionSetId && !propQuestionSet);

  // 如果提供了questionSetId但没有questionSet，则加载questionSet
  useEffect(() => {
    if (questionSetId && !propQuestionSet) {
      const fetchQuestionSet = async () => {
        setIsLoading(true);
        try {
          const response = await questionSetApi.getQuestionSetById(questionSetId);
          if (response.success && response.data) {
            setQuestionSet(response.data);
          } else {
            setError('无法加载题库信息，请刷新页面重试');
          }
        } catch (error) {
          console.error('加载题库失败:', error);
          setError('加载题库信息出错，请刷新页面重试');
        } finally {
          setIsLoading(false);
        }
      };
      
      fetchQuestionSet();
    } else if (propQuestionSet) {
      setQuestionSet(propQuestionSet);
    }
  }, [questionSetId, propQuestionSet]);

  // 加载Stripe
  useEffect(() => {
    if (!isOpen) return;

    // 动态加载Stripe.js，避免重复加载
    if (!scriptRef.current) {
      console.log('[支付] 加载Stripe.js脚本');
      const script = document.createElement('script');
      script.src = 'https://js.stripe.com/v3/';
      script.async = true;
      script.onload = () => {
        console.log('[支付] Stripe.js脚本加载完成');
        setStripeLoaded(true);
      };
      document.body.appendChild(script);
      scriptRef.current = script;
    } else if (!stripeLoaded) {
      setStripeLoaded(true);
    }

    return () => {
      // 组件卸载时不移除脚本，允许它缓存
    };
  }, [isOpen]);

  // 初始化Stripe
  useEffect(() => {
    if (!stripeLoaded || !isOpen) return;

    try {
      console.log('[支付] 初始化Stripe实例');
      const stripeInstance = (window as any).Stripe(STRIPE_PUBLIC_KEY);
      setStripe(stripeInstance);

      // 创建Stripe元素
      const elements = stripeInstance.elements();
      
      // 如果已经有卡元素，先销毁
      if (cardRef.current) {
        cardRef.current.unmount();
      }
      
      const card = elements.create('card', {
        style: {
          base: {
            fontSize: '16px',
            color: '#32325d',
            fontFamily: '-apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif',
            fontSmoothing: 'antialiased',
            '::placeholder': {
              color: '#aab7c4'
            }
          },
          invalid: {
            color: '#fa755a',
            iconColor: '#fa755a'
          }
        }
      });

      // 保存卡元素的引用
      cardRef.current = card;
      setCardElement(card);

      // 监听卡元素的变化
      card.on('change', (event: any) => {
        // 清除之前的错误信息
        setError('');
        
        if (event.error) {
          setError(event.error.message);
        }
      });

      // 等待DOM挂载后再挂载卡元素
      const timer = setTimeout(() => {
        const cardContainer = document.getElementById('card-element');
        if (cardContainer) {
          console.log('[支付] 挂载卡元素到DOM');
          card.mount('#card-element');
        }
      }, 100);

      return () => {
        clearTimeout(timer);
      };
    } catch (err) {
      console.error('[支付] 初始化Stripe失败:', err);
      setError('初始化支付系统失败，请刷新页面重试');
    }
  }, [stripeLoaded, isOpen]);

  // 清理卡元素
  useEffect(() => {
    return () => {
      if (cardRef.current) {
        console.log('[支付] 清理卡元素');
        cardRef.current.unmount();
      }
    };
  }, []);

  // 处理支付提交
  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!stripe || !cardElement || !user) {
      setError('支付系统未准备好，请刷新页面重试');
      return;
    }

    setIsProcessing(true);
    setError('');

    try {
      // 判断是使用模拟支付还是真实支付
      if (import.meta.env.MODE === 'development' || import.meta.env.VITE_USE_MOCK_PAYMENT === 'true') {
        // 使用模拟支付流程
        await handleMockPayment();
      } else {
        // 使用真实Stripe支付
        await handleStripePayment();
      }
    } catch (err: any) {
      console.error('[支付错误]:', err);
      setError(err.message || '支付处理过程中发生错误，请重试');
      setIsProcessing(false);
    }
  };

  // 模拟支付流程
  const handleMockPayment = async () => {
    console.log('[支付] 使用模拟支付流程');
    
    // 模拟支付处理延迟
    await new Promise(resolve => setTimeout(resolve, 1500));

    // 模拟交易ID
    const transactionId = `tr_${Math.random().toString(36).substring(2, 12)}`;
    
    // 计算过期时间（6个月后）
    const expiryDate = getFutureDate(180); // 6个月约等于180天
    
    // 完成后续处理
    await finalizePurchase({
      transactionId,
      expiryDate,
      paymentMethod: 'mock'
    });
  };

  // 真实Stripe支付流程
  const handleStripePayment = async () => {
    try {
      // 1. 创建支付Intent - 根据环境使用真实或模拟API
      const intentData = await processPayment(
        questionSet?.price || 0, 
        'cny',
        {
          userId: user?.id || 'anonymous',
          questionSetId: String(questionSet?.id || '').trim(),
          questionSetTitle: questionSet?.title ?? '未知题库'
        }
      );
      
      if (!intentData || !intentData.client_secret) {
        throw new Error('创建支付意向失败');
      }

      // 2. 确认支付
      let paymentResult;
      
      // 检查是否是模拟支付intent (ID以pi_mock_开头)
      const isMockPayment = intentData.id && intentData.id.startsWith('pi_mock_');
      
      if (isMockPayment) {
        // 对模拟支付，始终使用模拟确认方法
        console.log('[支付] 检测到模拟支付ID, 使用模拟支付确认流程');
        paymentResult = await confirmMockPayment(intentData.client_secret, {
          card: cardElement,
          billing_details: {
            name: user?.username || '用户',
            email: user?.email || undefined
          }
        });
      } else {
        // 对真实支付，使用Stripe.js确认
        if (!stripe) {
          throw new Error('Stripe未初始化');
        }
        
        console.log('[支付] 使用真实Stripe支付确认');
        const result = await stripe.confirmCardPayment(intentData.client_secret, {
          payment_method: {
            card: cardElement,
            billing_details: {
              name: user?.username || '用户',
              email: user?.email || undefined
            }
          }
        });
        
        paymentResult = result.paymentIntent || result.error || null;
      }

      // 3. 处理支付结果
      if (!paymentResult) {
        throw new Error('支付确认失败或返回空结果');
      }
      
      if (paymentResult.status === 'succeeded') {
        // 计算过期时间（6个月后）
        const expiryDate = getFutureDate(180); // 6个月约等于180天
        
        await finalizePurchase({
          transactionId: paymentResult.id || intentData.id,
          expiryDate,
          paymentMethod: 'card'
        });
      } else {
        throw new Error(paymentResult.error?.message || `支付未完成，状态: ${paymentResult.status || '未知'}`);
      }
    } catch (err: any) {
      console.error('[Stripe支付错误]:', err);
      throw new Error(err.message || '支付处理失败，请重试');
    }
  };

  // 完成购买后的处理
  const finalizePurchase = async ({
    transactionId,
    expiryDate,
    paymentMethod
  }: {
    transactionId: string;
    expiryDate: string;
    paymentMethod: string;
  }) => {
    if (!user) {
      throw new Error('用户未登录');
    }

    try {
      // 创建购买记录
      const purchase = {
        id: `purchase_${Math.random().toString(36).substring(2, 12)}`, // 确保有唯一ID
        userId: user.id,
        questionSetId: String(questionSet?.id).trim(), // 确保ID格式一致
        purchaseDate: new Date().toISOString(),
        expiryDate: expiryDate,
        transactionId: transactionId,
        paymentMethod: paymentMethod,
        status: 'active', // 确保状态是active
        amount: questionSet?.price || 0
      };

      console.log(`[支付] 创建购买记录:`, purchase);
      
      // 标记是否已保存到数据库
      let savedToDatabase = false;
      
      // 1. 尝试通过多种API端点保存购买记录到数据库
      try {
        console.log(`[支付] 开始尝试多种方式保存购买记录`);
        
        // 获取token
        const token = localStorage.getItem('token');
        if (!token) {
          throw new Error('未找到认证信息');
        }
        
        // 尝试方式1: 标准购买API
        try {
          console.log(`[支付] 尝试方式1: 标准purchases API`);
          const standardResponse = await fetch('/api/purchases', {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
              'Authorization': `Bearer ${token}`
            },
            body: JSON.stringify(purchase)
          });
          
          if (standardResponse.ok) {
            const result = await standardResponse.json();
            console.log(`[支付] 标准API保存成功:`, result);
            savedToDatabase = true;
          } else {
            console.warn('[支付] 标准API保存失败:', await standardResponse.text());
          }
        } catch (standardError) {
          console.warn('[支付] 标准API出错:', standardError);
        }
        
        // 如果第一种方式失败，尝试方式2: 强制创建购买API
        if (!savedToDatabase) {
          try {
            console.log(`[支付] 尝试方式2: force-create API`);
            const forceResponse = await fetch('/api/purchases/force-create', {
              method: 'POST',
              headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${token}`
              },
              body: JSON.stringify({
                ...purchase,
                forceBuy: true
              })
            });
            
            if (forceResponse.ok) {
              const result = await forceResponse.json();
              console.log(`[支付] force-create API保存成功:`, result);
              savedToDatabase = true;
            } else {
              console.warn('[支付] force-create API保存失败:', await forceResponse.text());
            }
          } catch (forceError) {
            console.warn('[支付] force-create API出错:', forceError);
          }
        }
        
        // 如果前两种方式都失败，尝试方式3: 更新用户API
        if (!savedToDatabase) {
          try {
            console.log(`[支付] 尝试方式3: 用户更新API`);
            const userUpdateResponse = await fetch(`/api/users/${user.id}`, {
              method: 'PUT',
              headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${token}`
              },
              body: JSON.stringify({
                purchases: [...(user.purchases || []), purchase]
              })
            });
            
            if (userUpdateResponse.ok) {
              const result = await userUpdateResponse.json();
              console.log(`[支付] 用户更新API保存成功:`, result);
              savedToDatabase = true;
            } else {
              console.warn('[支付] 用户更新API保存失败:', await userUpdateResponse.text());
            }
          } catch (updateError) {
            console.warn('[支付] 用户更新API出错:', updateError);
          }
        }
        
        // 如果所有API方式都失败，尝试update-access端点
        if (!savedToDatabase) {
          try {
            console.log(`[支付] 尝试方式4: update-access API`);
            const accessUpdateResponse = await fetch('/api/purchases/update-access', {
              method: 'POST',
              headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${token}`
              },
              body: JSON.stringify({
                userId: user.id,
                questionSetId: purchase.questionSetId,
                hasAccess: true,
                purchase: purchase
              })
            });
            
            if (accessUpdateResponse.ok) {
              const result = await accessUpdateResponse.json();
              console.log(`[支付] update-access API保存成功:`, result);
              savedToDatabase = true;
            } else {
              console.warn('[支付] update-access API保存失败:', await accessUpdateResponse.text());
            }
          } catch (accessError) {
            console.warn('[支付] update-access API出错:', accessError);
          }
        }
      } catch (apiError) {
        console.error('[支付] API保存尝试过程中发生错误:', apiError);
        // 继续流程，通过其他方式确保用户能访问
      }
      
      // 如果API保存成功，记录日志
      if (savedToDatabase) {
        console.log(`[支付] 已成功通过API将购买记录保存到数据库`);
      } else {
        console.warn(`[支付] 所有API保存方法都失败，将依赖用户上下文和本地存储`);
      }
      
      // 2. 添加购买记录到用户本地状态
      try {
        console.log(`[支付] 添加购买记录到用户状态`);
        await addPurchase(purchase);
        console.log(`[支付] 购买记录已添加到用户状态`);
      } catch (stateError) {
        console.error('[支付] 添加购买记录到用户状态失败:', stateError);
        // 继续流程，不中断支付成功处理
      }
      
      // 3. 通过socket发送实时通知
      try {
        if (socket) {
          console.log(`[支付] 通过socket发送购买成功通知`);
          // 发送购买成功事件
          socket.emit('purchase:success', {
            userId: user.id,
            questionSetId: purchase.questionSetId,
            purchaseId: purchase.id,
            expiryDate: purchase.expiryDate
          });
          
          // 发送访问权限更新事件
          socket.emit('questionSet:accessUpdate', {
            userId: user.id,
            questionSetId: purchase.questionSetId,
            hasAccess: true,
            source: 'payment'
          });
        }
      } catch (socketError) {
        console.error('[支付] socket通知发送失败:', socketError);
        // 继续流程，不中断支付成功处理
      }
      
      // 4. 保存访问记录到localStorage
      try {
        console.log(`[支付] 保存访问记录到localStorage`);
        saveAccessToLocalStorage(String(questionSet?.id).trim(), true);
        
        // 额外保存购买记录到localStorage
        try {
          const purchased = localStorage.getItem('purchasedQuestionSets') || '[]';
          const purchasedSets = JSON.parse(purchased);
          
          if (!purchasedSets.includes(purchase.questionSetId)) {
            purchasedSets.push(purchase.questionSetId);
            localStorage.setItem('purchasedQuestionSets', JSON.stringify(purchasedSets));
            console.log(`[支付] 题库ID已添加到本地购买记录`);
          }
        } catch (localError) {
          console.error('[支付] 保存购买记录到localStorage失败:', localError);
        }
      } catch (localStorageError) {
        console.error('[支付] 本地存储访问记录失败:', localStorageError);
        // 继续流程，不中断支付成功处理
      }
      
      // 5. 触发全局事件通知其他组件
      try {
        console.log(`[支付] 触发全局访问权限更新事件`);
        window.dispatchEvent(new CustomEvent('accessRights:updated', { 
          detail: { 
            userId: user.id,
            questionSetId: purchase.questionSetId,
            hasAccess: true,
            source: 'payment'
          } 
        }));
      } catch (eventError) {
        console.error('[支付] 触发全局事件失败:', eventError);
        // 继续流程，不中断支付成功处理
      }
      
      // 6. 显示成功消息
      setSuccessMessage(`支付成功！您现在可以访问《${questionSet?.title}》题库的所有内容，有效期至 ${formatDate(expiryDate)}`);
      
      // 7. 如果提供了成功回调，延迟调用确保状态已更新
      if (onSuccess) {
        console.log(`[支付] 调用onSuccess回调`);
        setTimeout(() => {
          const purchaseInfo = {
            questionSetId: purchase.questionSetId,
            remainingDays: Math.ceil((new Date(expiryDate).getTime() - new Date().getTime()) / (1000 * 60 * 60 * 24))
          };
          onSuccess(purchaseInfo);
          
          // 显示全局提示
          toast.success('题库购买成功！您现在可以访问完整内容了', {
            autoClose: 5000,
            position: 'top-center'
          });
        }, 300);
      }
      
      // 重置处理状态
      setIsProcessing(false);
    } catch (err) {
      console.error('[支付] 完成购买后处理失败:', err);
      throw err;
    }
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 bg-gray-600 bg-opacity-75 backdrop-blur-sm overflow-y-auto h-full w-full z-50 flex items-center justify-center">
      <div className="relative mx-auto p-5 border w-full max-w-md shadow-xl rounded-lg bg-white animate-fadeIn">
        <div className="flex justify-between items-center mb-6">
          <h3 className="text-xl font-semibold text-gray-900">
            购买题库
          </h3>
          <button 
            onClick={onClose}
            className="text-gray-400 hover:text-gray-500"
            disabled={isProcessing}
            aria-label="关闭"
          >
            <svg className="h-6 w-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>
        
        <div className="mb-6">
          <h4 className="font-medium text-lg mb-2">
            {questionSet?.title || '未知题库'}
          </h4>
          <p className="text-gray-600 mb-3">
            {questionSet?.description || '无描述信息'}
          </p>
          <div className="flex items-center justify-between bg-gray-50 p-3 rounded-md">
            <span className="text-gray-700">付费内容</span>
            <span className="font-medium text-lg text-green-600">
              ¥{questionSet?.price ?? '未定价'}
            </span>
          </div>
          <p className="text-sm text-gray-500 mt-2">购买后有效期为6个月</p>
        </div>
        
        {successMessage ? (
          <div className="bg-green-50 p-4 rounded-md mb-6">
            <div className="flex">
              <div className="flex-shrink-0">
                <svg className="h-5 w-5 text-green-400" fill="currentColor" viewBox="0 0 20 20">
                  <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z" clipRule="evenodd" />
                </svg>
              </div>
              <div className="ml-3">
                <p className="text-sm font-medium text-green-800">
                  {successMessage}
                </p>
              </div>
            </div>
            <div className="mt-4 flex justify-center">
              <button
                onClick={onClose}
                className="inline-flex justify-center py-2 px-4 border border-transparent text-sm font-medium rounded-md text-white bg-green-600 hover:bg-green-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-green-500"
              >
                关闭并继续使用
              </button>
            </div>
          </div>
        ) : (
          <form onSubmit={handleSubmit} className="space-y-4">
            {stripeLoaded ? (
              <div className="mb-4">
                <label htmlFor="card-element" className="block text-sm font-medium text-gray-700 mb-2">
                  信用卡信息
                </label>
                <div 
                  id="card-element" 
                  className="p-3 border border-gray-300 rounded-md shadow-sm"
                >
                  {/* Stripe 卡元素将挂载在这里 */}
                </div>
                {error && (
                  <div className="mt-2 text-sm text-red-600">
                    {error}
                  </div>
                )}
                <p className="mt-1 text-xs text-gray-500">
                  这是一个测试环境，您可以使用测试卡号：4242 4242 4242 4242，有效期：任意未来日期，CVV：任意3位数
                </p>
              </div>
            ) : (
              <div className="flex justify-center p-6">
                <div className="animate-spin rounded-full h-8 w-8 border-t-2 border-b-2 border-blue-500"></div>
                <span className="ml-2 text-gray-600">加载支付系统...</span>
              </div>
            )}
            
            <div className="flex items-center justify-between mt-6">
              <button
                type="button"
                onClick={onClose}
                className="inline-flex justify-center py-2 px-4 border border-gray-300 shadow-sm text-sm font-medium rounded-md text-gray-700 bg-white hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500"
                disabled={isProcessing}
              >
                取消
              </button>
              <button
                type="submit"
                className={`inline-flex justify-center py-2 px-4 border border-transparent shadow-sm text-sm font-medium rounded-md text-white ${
                  isProcessing ? 'bg-blue-400' : 'bg-blue-600 hover:bg-blue-700'
                } focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500`}
                disabled={isProcessing}
              >
                {isProcessing ? (
                  <div className="flex items-center">
                    <div className="animate-spin rounded-full h-4 w-4 border-t-2 border-b-2 border-white mr-2"></div>
                    处理中...
                  </div>
                ) : (
                  '确认支付'
                )}
              </button>
            </div>
          </form>
        )}
      </div>
    </div>
  );
};

export default PaymentModal; 