import React, { useState, useEffect, useRef, useCallback } from 'react';
import { useUser } from '../contexts/UserContext';
import { QuestionSet } from '../types';
import { useSocket } from '../contexts/SocketContext';
import { toast } from 'react-toastify';
import { processPayment, verifyPaymentStatus, refreshUserPurchases } from '../utils/paymentUtils';
import { questionSetApi } from '../utils/api';
import axios from 'axios';
import { API_BASE_URL } from '../services/api';
import { loadStripe } from '@stripe/stripe-js';
import { Elements, CardElement, useStripe, useElements } from '@stripe/react-stripe-js';

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

// Initialize Stripe promise
const stripePromise = loadStripe(STRIPE_PUBLIC_KEY);

interface StripePaymentFormProps {
  amount: number;
  onSubmit: (paymentInfo: {
    paymentIntentId: string;
    paymentMethodId: string | null;
    amount: number;
    status: string;
  }) => void;
  onCancel: () => void;
  isProcessing: boolean;
}

const StripePaymentForm: React.FC<StripePaymentFormProps> = ({ amount, onSubmit, onCancel, isProcessing }) => {
  const stripe = useStripe();
  const elements = useElements();
  const { user } = useUser();
  const [error, setError] = useState<string | null>(null);
  const [clientSecret, setClientSecret] = useState<string>('');
  const [paymentIntentId, setPaymentIntentId] = useState<string>('');
  const [isLoading, setIsLoading] = useState(false);

  useEffect(() => {
    const initializePayment = async () => {
      if (!amount || amount <= 0) {
        console.error('[StripePaymentForm] Invalid amount:', amount);
        setError('Invalid payment amount');
        return;
      }

      setIsLoading(true);
      try {
        console.log(`[StripePaymentForm] Creating payment intent for amount: ${amount}`);
        
        const intentData = await processPayment(
          amount,
          'cny',
          {
            userId: user?.id || 'anonymous',
            description: '题库购买'
          }
        );

        if (intentData && intentData.clientSecret) {
          console.log('[StripePaymentForm] Payment intent created successfully');
          setClientSecret(intentData.clientSecret);
          setPaymentIntentId(intentData.id);
          setError(null);
        } else {
          console.error('[StripePaymentForm] No client secret in response');
          setError('Could not initialize payment. Please try again.');
        }
      } catch (err) {
        console.error('[StripePaymentForm] Error creating payment intent:', err);
        setError('Failed to connect to payment service.');
      } finally {
        setIsLoading(false);
      }
    };

    initializePayment();
  }, [amount, user?.id]);

  const handleSubmit = async (event: React.FormEvent) => {
    event.preventDefault();
    
    if (!stripe || !elements) {
      setError('Payment system is not ready yet. Please try again.');
      return;
    }
    
    if (!clientSecret) {
      setError('Payment system is not ready yet. Please try again.');
      return;
    }

    setIsLoading(true);
    try {
      const result = await stripe.confirmCardPayment(clientSecret, {
        payment_method: {
          card: elements.getElement(CardElement)!,
          billing_details: {
            name: user?.username || 'Anonymous Customer',
            email: user?.email
          },
        }
      });

      if (result.error) {
        setError(result.error.message || 'Payment failed');
      } else {
        if (result.paymentIntent && result.paymentIntent.status === 'succeeded') {
          const paymentMethodId = typeof result.paymentIntent.payment_method === 'string' 
            ? result.paymentIntent.payment_method 
            : result.paymentIntent.payment_method?.id || null;

          onSubmit({
            paymentIntentId: paymentIntentId || result.paymentIntent.id,
            paymentMethodId,
            amount: amount,
            status: 'succeeded'
          });
        } else {
          setError(`Payment status: ${result.paymentIntent?.status || 'unknown'}. Please try again.`);
        }
      }
    } catch (err) {
      console.error('[StripePaymentForm] Payment confirmation error:', err);
      setError('An error occurred while processing your payment. Please try again.');
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="p-6">
      <div className="flex justify-between items-center mb-4">
        <h2 className="text-xl font-bold text-gray-800">支付方式</h2>
        <button
          onClick={onCancel}
          className="text-gray-400 hover:text-gray-600"
          disabled={isProcessing || isLoading}
        >
          <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M6 18L18 6M6 6l12 12"></path>
          </svg>
        </button>
      </div>
      
      {error && (
        <div className="mb-4 p-3 bg-red-100 text-red-700 rounded">
          {error}
        </div>
      )}
      
      <form onSubmit={handleSubmit} className="space-y-6">
        <div className="bg-gray-50 p-4 rounded-lg border border-gray-200">
          <p className="text-sm text-gray-600 mb-3">请输入信用卡信息完成支付：</p>
          <div className="p-3 bg-white rounded-md border border-gray-300 focus-within:border-blue-500 focus-within:ring-1 focus-within:ring-blue-500">
            <CardElement
              options={{
                style: {
                  base: {
                    fontSize: '16px',
                    color: '#424770',
                    '::placeholder': {
                      color: '#aab7c4',
                    },
                  },
                  invalid: {
                    color: '#9e2146',
                  },
                },
                hidePostalCode: true,
              }}
            />
          </div>
          <p className="mt-2 text-xs text-gray-500">
            测试卡号：4242 4242 4242 4242，有效期：任意未来日期，CVV：任意3位数
          </p>
        </div>
        
        <div className="bg-gray-50 p-4 rounded-lg border border-gray-200">
          <div className="flex justify-between items-center text-lg">
            <span className="text-gray-700">总金额:</span>
            <span className="font-bold text-green-600">¥{amount.toFixed(2)}</span>
          </div>
        </div>
        
        <div className="flex justify-end space-x-4">
          <button
            type="button"
            onClick={onCancel}
            className="px-4 py-2 bg-gray-200 text-gray-800 rounded hover:bg-gray-300"
            disabled={isProcessing || isLoading}
          >
            取消
          </button>
          <button
            type="submit"
            disabled={!stripe || isProcessing || isLoading || !clientSecret}
            className={`px-4 py-2 bg-blue-500 text-white rounded hover:bg-blue-600 ${
              (!stripe || isProcessing || isLoading || !clientSecret) ? 'opacity-50 cursor-not-allowed' : ''
            }`}
          >
            {isProcessing || isLoading ? (
              <div className="flex items-center">
                <svg className="animate-spin -ml-1 mr-2 h-4 w-4 text-white" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                  <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                  <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                </svg>
                处理中...
              </div>
            ) : (
              `确认支付 ¥${amount.toFixed(2)}`
            )}
          </button>
        </div>
      </form>
    </div>
  );
};

const PaymentModal: React.FC<PaymentModalProps> = ({ isOpen = true, onClose, questionSet: propQuestionSet, questionSetId, onSuccess }) => {
  const { user, addPurchase, refreshPurchases } = useUser();
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
  const [alreadyPurchased, setAlreadyPurchased] = useState(false);
  const [showStripeForm, setShowStripeForm] = useState(false);

  // 检查是否已购买
  useEffect(() => {
    const checkIfAlreadyPurchased = async () => {
      if (!user || !questionSet?.id) return;
      
      try {
        // 刷新购买记录
        const purchases = await refreshPurchases();
        
        // 查找匹配的购买记录
        const existingPurchase = purchases.find((p: any) => 
          p.questionSetId === String(questionSet.id).trim() && 
          (p.status === 'active' || p.status === 'completed')
        );
        
        if (existingPurchase) {
          console.log(`[支付] 用户已购买此题库，关闭支付窗口`);
          setAlreadyPurchased(true);
          
          // 自动关闭弹窗并调用成功回调
          setTimeout(() => {
            if (onSuccess) {
              const now = new Date();
              const expiryDate = existingPurchase.expiryDate ? new Date(existingPurchase.expiryDate) : null;
              const remainingDays = expiryDate ? 
                Math.max(0, Math.ceil((expiryDate.getTime() - now.getTime()) / (1000 * 60 * 60 * 24))) : 
                180;
              
              onSuccess({
                questionSetId: existingPurchase.questionSetId,
                remainingDays
              });
            }
            onClose();
          }, 500);
        }
      } catch (error) {
        console.error('[支付] 检查购买状态失败:', error);
      }
    };
    
    checkIfAlreadyPurchased();
  }, [user, questionSet, refreshPurchases, onSuccess, onClose]);

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

    // 验证题库和价格
    if (!questionSet || !questionSet.id) {
      setError('题库信息未加载，请刷新页面重试');
      return;
    }

    const price = parseFloat(String(questionSet.price));
    if (isNaN(price) || price <= 0) {
      setError('题库价格无效，请联系管理员');
      return;
    }

    console.log(`[支付] 开始处理支付, 题库ID: ${questionSet.id}, 价格: ${price}`);
    setIsProcessing(true);
    setError('');

    try {
      // 使用真实Stripe支付
      await handleStripePayment();
    } catch (err: any) {
      console.error('[支付错误]:', err);
      setError(err.message || '支付处理过程中发生错误，请重试');
      setIsProcessing(false);
    }
  };

  // 真实Stripe支付流程
  const handleStripePayment = async () => {
    try {
      // 确保价格是有效的数字
      const price = parseFloat(String(questionSet?.price || 0));
      if (isNaN(price) || price <= 0) {
        throw new Error('题库价格无效');
      }

      console.log(`[支付] 处理付款，金额: ${price}`);

      // 1. 创建支付Intent - 将价格转换为分
      const intentData = await processPayment(
        price, 
        'cny',
        {
          userId: user?.id || 'anonymous',
          questionSetId: String(questionSet?.id || '').trim(),
          questionSetTitle: questionSet?.title ?? '未知题库'
        }
      );
      
      if (!intentData || !intentData.clientSecret) {
        throw new Error('创建支付意向失败');
      }

      console.log(`[支付] 支付意向创建成功，准备确认支付`);

      // 2. 确认支付
      const { paymentIntent, error } = await stripe.confirmCardPayment(intentData.clientSecret, {
        payment_method: {
          card: cardElement,
          billing_details: {
            name: user?.username || '用户',
            email: user?.email || undefined
          }
        }
      });

      if (error) {
        // 支付失败
        console.error('[支付] 支付确认失败:', error);
        throw new Error(error.message || '支付确认失败');
      }

      if (paymentIntent.status === 'succeeded') {
        // 支付成功
        console.log('[支付] 支付成功:', paymentIntent);
        
        // 计算过期时间（6个月后）
        const now = new Date();
        const expiryDate = new Date(now);
        expiryDate.setMonth(expiryDate.getMonth() + 6);
        
        // 验证支付状态并确保服务器端已处理
        await verifyPaymentStatus(paymentIntent.id);
        
        // 完成后续处理
        await finalizePurchase({
          transactionId: paymentIntent.id,
          expiryDate: expiryDate.toISOString(),
          paymentMethod: 'card'
        });
      } else {
        // 支付状态不是成功
        console.error(`[支付] 支付未完成，状态: ${paymentIntent.status}`);
        throw new Error(`支付未完成，状态: ${paymentIntent.status}`);
      }
    } catch (error: any) {
      console.error('[支付] Stripe支付错误:', error);
      throw new Error(error.message || '支付处理失败');
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
      console.log(`[支付] 支付成功，开始处理购买记录，交易ID: ${transactionId}`);
      
      // 刷新用户购买列表
      const purchases = await refreshPurchases();
      console.log(`[支付] 用户购买列表已刷新，共 ${purchases.length} 条记录`);
      
      // 查找与当前题库匹配的购买记录
      const matchingPurchase = purchases.find((p: any) => 
        p.questionSetId === String(questionSet?.id).trim() && 
        p.status === 'active'
      );
      
      let purchase;
      
      if (matchingPurchase) {
        console.log(`[支付] 找到与当前题库匹配的购买记录:`, matchingPurchase);
        purchase = matchingPurchase;
      } else {
        // 如果未找到匹配记录，创建本地购买记录（应急情况）
        console.log(`[支付] 未找到匹配的购买记录，创建本地记录`);
        purchase = {
          id: `purchase_${Math.random().toString(36).substring(2, 12)}`,
          userId: user.id,
          questionSetId: String(questionSet?.id).trim(),
          purchaseDate: new Date().toISOString(),
          expiryDate: expiryDate,
          transactionId: transactionId,
          paymentMethod: paymentMethod,
          status: 'active',
          amount: questionSet?.price || 0
        };
        
        // 添加购买记录到用户状态
        await addPurchase(purchase);
      }

      console.log(`[支付] 使用购买记录:`, purchase);
      
      // 通过socket发送实时通知
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
      
      // 显示成功消息
      setSuccessMessage(`支付成功！您现在可以访问《${questionSet?.title}》题库的所有内容，有效期至 ${new Date(expiryDate).toLocaleDateString()}`);
      
      // 保存访问记录到localStorage
      try {
        // 获取现有的访问权限
        const accessRightsStr = localStorage.getItem('quizAccessRights');
        let accessRights: {[key: string]: boolean} = {};
        
        if (accessRightsStr) {
          accessRights = JSON.parse(accessRightsStr);
        }
        
        // 更新访问权限
        accessRights[String(questionSet?.id).trim()] = true;
        
        // 保存回localStorage
        localStorage.setItem('quizAccessRights', JSON.stringify(accessRights));
        console.log(`[支付] 已保存题库访问权限到localStorage`);
      } catch (e) {
        console.error('[支付] 保存访问权限到localStorage失败', e);
      }
      
      // 触发全局事件通知其他组件
      window.dispatchEvent(new CustomEvent('accessRights:updated', { 
        detail: { 
          userId: user.id,
          questionSetId: purchase.questionSetId,
          hasAccess: true,
          source: 'payment'
        } 
      }));
      
      // 如果提供了成功回调，延迟调用确保状态已更新
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
          
          // 强制关闭支付弹窗
          setTimeout(() => {
            onClose();
          }, 1000);
        }, 300);
      }
      
      // 重置处理状态
      setIsProcessing(false);
    } catch (err) {
      console.error('[支付] 完成购买后处理失败:', err);
      throw err;
    }
  };

  // 如果已购买，直接显示成功消息
  if (alreadyPurchased) {
    return (
      <div className="fixed inset-0 bg-gray-600 bg-opacity-75 backdrop-blur-sm overflow-y-auto h-full w-full z-50 flex items-center justify-center">
        <div className="relative mx-auto p-5 border w-full max-w-md shadow-xl rounded-lg bg-white animate-fadeIn">
          <div className="mb-6 text-center">
            <div className="bg-green-50 p-4 rounded-md mb-6">
              <div className="flex justify-center">
                <div className="flex-shrink-0">
                  <svg className="h-5 w-5 text-green-400" fill="currentColor" viewBox="0 0 20 20">
                    <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z" clipRule="evenodd" />
                  </svg>
                </div>
                <div className="ml-3">
                  <p className="text-sm font-medium text-green-800">
                    您已经购买了这个题库，无需重复购买。
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
          </div>
        </div>
      </div>
    );
  }

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
        
        {!showStripeForm ? (
          // 初始确认页面
          <div className="p-6">
            <div className="flex justify-between items-center mb-4">
              <h2 className="text-xl font-bold text-gray-800">购买确认</h2>
              <button
                onClick={onClose}
                className="text-gray-400 hover:text-gray-600"
                disabled={isProcessing}
              >
                <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M6 18L18 6M6 6l12 12"></path>
                </svg>
              </button>
            </div>
            
            {error && (
              <div className="mb-4 p-3 bg-red-100 text-red-700 rounded">
                {error}
              </div>
            )}
            
            <div className="mb-6">
              <h3 className="font-bold text-lg mb-2">{questionSet?.title}</h3>
              <p className="text-gray-600 mb-4">{questionSet?.description}</p>
              <div className="flex justify-between items-center text-lg border-t pt-4">
                <span>价格:</span>
                <span className="font-bold text-green-600">¥{questionSet?.price || 0}</span>
              </div>
            </div>
            
            <div className="flex justify-end space-x-4">
              <button
                onClick={onClose}
                className="px-4 py-2 bg-gray-200 text-gray-800 rounded hover:bg-gray-300"
                disabled={isProcessing}
              >
                取消
              </button>
              <button
                onClick={() => setShowStripeForm(true)}
                className={`px-4 py-2 bg-blue-500 text-white rounded hover:bg-blue-600 ${
                  isProcessing ? 'opacity-50 cursor-not-allowed' : ''
                }`}
                disabled={isProcessing}
              >
                {isProcessing ? '处理中...' : '继续支付'}
              </button>
            </div>
          </div>
        ) : (
          <Elements stripe={stripePromise}>
            <StripePaymentForm
              amount={parseFloat(String(questionSet?.price || 0))}
              onSubmit={async (paymentInfo) => {
                try {
                  // 计算过期时间（6个月后）
                  const now = new Date();
                  const expiryDate = new Date(now);
                  expiryDate.setMonth(expiryDate.getMonth() + 6);
                  
                  // 验证支付状态
                  await verifyPaymentStatus(paymentInfo.paymentIntentId);
                  
                  // 完成购买流程
                  await finalizePurchase({
                    transactionId: paymentInfo.paymentIntentId,
                    expiryDate: expiryDate.toISOString(),
                    paymentMethod: 'card'
                  });
                } catch (error) {
                  console.error('[PaymentModal] 处理支付失败:', error);
                  throw error;
                }
              }}
              onCancel={() => {
                setShowStripeForm(false);
                onClose();
              }}
              isProcessing={isProcessing}
            />
          </Elements>
        )}
      </div>
    </div>
  );
};

export default PaymentModal; 