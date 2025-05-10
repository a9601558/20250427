import React, { useState, useEffect, useRef, useCallback } from 'react';
import { useUser } from '../contexts/UserContext';
import { QuestionSet } from '../types';
import { useSocket } from '../contexts/SocketContext';
import { toast } from 'react-toastify';
import { processPayment, verifyPaymentStatus, refreshUserPurchases, completeStripePurchase } from '../utils/paymentUtils';
import { questionSetApi } from '../utils/api';
import axios from 'axios';
import { API_BASE_URL } from '../services/api';
import { loadStripe } from '@stripe/stripe-js';
import { Elements, CardElement, useStripe, useElements } from '@stripe/react-stripe-js';
import './payment-styles.css'; // 添加样式引用

// 新增：导入React Spring用于动画效果
import { useSpring, animated } from 'react-spring';

// 定义庆祝组件接口
interface CelebrationPopupProps {
  isVisible: boolean;
  onClose: () => void;
  title: string;
  message: string;
}

// 新增：庆祝组件
const CelebrationPopup: React.FC<CelebrationPopupProps> = ({ isVisible, onClose, title, message }) => {
  const [confetti, setConfetti] = useState<{ x: number; y: number; color: string; size: number; }[]>([]);
  
  // 动画效果
  const animation = useSpring({
    transform: isVisible ? 'scale(1)' : 'scale(0.8)',
    opacity: isVisible ? 1 : 0,
    config: { tension: 300, friction: 20 }
  });
  
  // 生成彩色纸屑效果
  useEffect(() => {
    if (isVisible) {
      // 创建彩色纸屑
      const colors = ['#FF5252', '#4CAF50', '#2196F3', '#FFC107', '#9C27B0', '#3F51B5'];
      const newConfetti = Array.from({ length: 100 }, () => ({
        x: Math.random() * 100,
        y: Math.random() * 100,
        color: colors[Math.floor(Math.random() * colors.length)],
        size: Math.random() * 8 + 4
      }));
      setConfetti(newConfetti);
      
      // 3秒后自动关闭
      const timer = setTimeout(() => {
        onClose();
      }, 6000);
      
      return () => clearTimeout(timer);
    }
  }, [isVisible, onClose]);
  
  if (!isVisible) return null;
  
  return (
    <div className="fixed inset-0 flex items-center justify-center z-50">
      <div className="absolute inset-0 bg-black bg-opacity-50 backdrop-blur-sm" onClick={onClose}></div>
      
      {/* 彩色纸屑 */}
      <div className="absolute inset-0 overflow-hidden pointer-events-none">
        {confetti.map((item, index) => (
          <div 
            key={index}
            className="absolute animate-confetti"
            style={{
              left: `${item.x}%`,
              top: `${item.y}%`,
              backgroundColor: item.color,
              width: `${item.size}px`,
              height: `${item.size}px`,
              borderRadius: '2px',
              animationDelay: `${Math.random() * 3}s`,
              animationDuration: `${Math.random() * 2 + 2}s`
            }}
          />
        ))}
      </div>
      
      <animated.div 
        style={animation}
        className="bg-gradient-to-br from-blue-500 to-indigo-600 p-8 rounded-2xl shadow-2xl text-white max-w-md relative z-10"
      >
        <div className="absolute -top-12 left-1/2 transform -translate-x-1/2">
          <div className="bg-yellow-400 w-24 h-24 rounded-full flex items-center justify-center shadow-lg border-4 border-white">
            <svg className="w-12 h-12 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
            </svg>
          </div>
        </div>
        
        <div className="text-center mt-14 mb-6">
          <h2 className="text-2xl font-bold mb-4">{title}</h2>
          <p className="text-blue-100">{message}</p>
        </div>
        
        <div className="mt-6 text-center">
          <button
            onClick={onClose}
            className="px-6 py-2 bg-white text-indigo-600 rounded-lg font-medium shadow-md hover:shadow-lg transition-all transform hover:-translate-y-1"
          >
            开始使用
          </button>
        </div>
      </animated.div>
    </div>
  );
};

interface PaymentModalProps {
  isOpen?: boolean;
  onClose: () => void;
  questionSet: QuestionSet;
  onSuccess: (data: {
    questionSetId: string;
    purchaseId?: string;
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
  const [error, setError] = useState<string | null>(null);
  const [clientSecret, setClientSecret] = useState<string>('');
  const [paymentIntentId, setPaymentIntentId] = useState<string>('');
  const [isLoading, setIsLoading] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const submitButtonRef = useRef<HTMLButtonElement>(null);

  useEffect(() => {
    // Create a payment intent when the form loads
    const createPaymentIntent = async () => {
      try {
        if (!amount || amount <= 0) {
          console.error('[StripePaymentForm] Invalid amount:', amount);
          setError('Invalid payment amount');
          return;
        }

        setIsLoading(true);
        // 不要转换为分，直接使用原始金额，因为后端会进行转换
        const amountToSend = Math.round(amount);
        console.log(`[StripePaymentForm] Creating payment intent for amount: ${amount} (sending ${amountToSend})`);
        
        const response = await axios.post(
          `${API_BASE_URL}/payments/create-intent`,
          {
            amount: amountToSend,
            currency: 'cny'
          },
          {
            headers: {
              'Authorization': `Bearer ${localStorage.getItem('token')}`
            }
          }
        );

        if (response.data.success) {
          console.log('[StripePaymentForm] Payment intent created:', response.data);
          setClientSecret(response.data.clientSecret);
          setPaymentIntentId(response.data.paymentIntentId);
        } else {
          throw new Error(response.data.message || 'Failed to create payment intent');
        }
      } catch (error) {
        console.error('[StripePaymentForm] Error creating payment intent:', error);
        setError(error instanceof Error ? error.message : 'Failed to create payment intent');
      } finally {
        setIsLoading(false);
      }
    };

    createPaymentIntent();
  }, [amount]);

  const handleSubmit = async (event: React.FormEvent) => {
    event.preventDefault();
    
    // 防止重复提交 - 更严格的检查
    if (isSubmitting || isProcessing || isLoading || !stripe || !elements) {
      console.log('[StripePaymentForm] Preventing duplicate submission:', { 
        isSubmitting, isProcessing, isLoading, hasStripe: !!stripe, hasElements: !!elements 
      });
      return;
    }
    
    // 立即设置提交中状态，防止重复点击
    setIsSubmitting(true);
    setIsLoading(true);
    
    // 禁用提交按钮 DOM 元素
    if (submitButtonRef.current) {
      submitButtonRef.current.disabled = true;
      submitButtonRef.current.setAttribute('data-processing', 'true');
    }
    
    setError(null);
    
    if (!clientSecret) {
      setError('Payment system is not ready yet. Please try again.');
      setIsSubmitting(false);
      setIsLoading(false);
      if (submitButtonRef.current) {
        submitButtonRef.current.disabled = false;
        submitButtonRef.current.removeAttribute('data-processing');
      }
      return;
    }
    
    try {
      console.log('[StripePaymentForm] Processing payment submission...');
      
      // Confirm the card payment
      const result = await stripe.confirmCardPayment(clientSecret, {
        payment_method: {
          card: elements.getElement(CardElement)!,
          billing_details: {
            name: 'Anonymous Customer',
          },
        }
      });

      if (result.error) {
        console.error('[StripePaymentForm] Payment confirmation error:', result.error);
        setError(result.error.message || 'Payment failed');
      } else {
        if (result.paymentIntent && result.paymentIntent.status === 'succeeded') {
          console.log('[StripePaymentForm] Payment succeeded:', result.paymentIntent);
          const paymentMethodId = typeof result.paymentIntent.payment_method === 'string' 
            ? result.paymentIntent.payment_method 
            : null;

          onSubmit({
            paymentIntentId: paymentIntentId || result.paymentIntent.id,
            paymentMethodId,
            amount: amount,
            status: 'succeeded'
          });
        } else {
          console.warn('[StripePaymentForm] Payment not succeeded:', result.paymentIntent);
          setError(`Payment status: ${result.paymentIntent?.status || 'unknown'}. Please try again.`);
        }
      }
    } catch (error) {
      console.error('[StripePaymentForm] Payment confirmation error:', error);
      setError('An error occurred while processing your payment. Please try again.');
    } finally {
      setIsLoading(false);
      
      // 长时间禁用按钮，确保不会发生重复提交
      setTimeout(() => {
        setIsSubmitting(false);
        if (submitButtonRef.current) {
          submitButtonRef.current.disabled = false;
          submitButtonRef.current.removeAttribute('data-processing');
        }
      }, 3000); // 延长到3秒，确保有足够时间完成操作
    }
  };

  return (
    <div className="p-8 rounded-2xl bg-gradient-to-br from-gray-900 to-indigo-900 text-white">
      <form onSubmit={handleSubmit} className="space-y-6">
        {/* 支付标题 */}
        <div className="text-center mb-6">
          <div className="inline-flex items-center justify-center w-16 h-16 bg-gradient-to-br from-blue-400 to-indigo-600 rounded-2xl shadow-lg mb-4">
            <svg className="w-8 h-8 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 10h18M7 15h1m4 0h1m-7 4h12a3 3 0 003-3V8a3 3 0 00-3-3H6a3 3 0 00-3 3v8a3 3 0 003 3z" />
            </svg>
          </div>
          <h3 className="text-2xl font-bold mb-2">安全支付</h3>
          <p className="text-blue-200 text-sm">使用Stripe提供的安全支付服务</p>
      </div>

        {/* 支付金额 */}
        <div className="bg-white bg-opacity-10 backdrop-filter backdrop-blur-md rounded-xl p-5 border border-white border-opacity-20">
          <div className="flex justify-between items-center">
            <span className="text-gray-200">支付金额</span>
            <span className="text-3xl font-bold bg-clip-text text-transparent bg-gradient-to-r from-blue-400 to-purple-500">¥{amount}</span>
          </div>
        </div>

        {/* 卡号信息 */}
        <div className="space-y-2">
          <label className="block text-sm font-medium text-gray-200 mb-1">
            银行卡信息
        </label>
          <div className="p-4 border border-gray-500 rounded-xl bg-black bg-opacity-20 backdrop-filter backdrop-blur-md shadow-inner">
          <CardElement
            options={{
              style: {
                base: {
                  fontSize: '16px',
                    color: '#ffffff',
                  '::placeholder': {
                    color: '#aab7c4',
                  },
                    iconColor: '#ffffff',
                },
                invalid: {
                    color: '#ef4444',
                    iconColor: '#ef4444',
                },
              },
            }}
          />
        </div>
          
          {/* 安全标识 */}
          <div className="flex items-center mt-1">
            <svg className="w-4 h-4 mr-1 text-green-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z" />
            </svg>
            <span className="text-xs text-gray-400">端到端加密，确保您的支付数据安全</span>
        </div>
      </div>

      {error && (
          <div className="p-4 rounded-xl bg-red-900 bg-opacity-30 border border-red-500 text-red-200">
            <div className="flex items-start">
              <svg className="w-5 h-5 mr-2 mt-0.5 flex-shrink-0 text-red-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
              </svg>
              <span>{error}</span>
            </div>
        </div>
      )}

        {/* 支付卡图标 */}
        <div className="flex items-center justify-center space-x-3 py-2">
          <div className="w-10 h-7 bg-gray-700 rounded-md opacity-70"></div>
          <div className="w-10 h-7 bg-gray-700 rounded-md opacity-70"></div>
          <div className="w-10 h-7 bg-gray-700 rounded-md opacity-70"></div>
        </div>

        {/* 按钮组 */}
        <div className="flex space-x-4 pt-2">
        <button
          type="button"
          onClick={onCancel}
            className="flex-1 py-3 rounded-xl bg-gray-800 hover:bg-gray-700 text-gray-300 font-medium transition-all focus:outline-none focus:ring-2 focus:ring-gray-400 focus:ring-offset-2 focus:ring-offset-gray-900"
            disabled={isProcessing || isLoading || isSubmitting}
        >
          取消
        </button>
        <button
            ref={submitButtonRef}
          type="submit"
            disabled={!stripe || !elements || isProcessing || isLoading || isSubmitting}
            className={`
              flex-1 py-3 rounded-xl font-medium flex items-center justify-center
              ${(isProcessing || isLoading || isSubmitting || !stripe || !elements) 
                ? 'bg-blue-700 bg-opacity-50 cursor-not-allowed' 
                : 'bg-gradient-to-r from-blue-500 to-indigo-600 hover:from-blue-600 hover:to-indigo-700'
              }
              transition-all duration-200 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2 focus:ring-offset-gray-900
            `}
          >
            {isProcessing || isLoading || isSubmitting ? (
              <>
                <svg className="animate-spin -ml-1 mr-2 h-5 w-5 text-white" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                  <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                  <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                </svg>
                处理中...
              </>
            ) : '确认支付'}
        </button>
      </div>
    </form>
    </div>
  );
};

const PaymentModal: React.FC<PaymentModalProps> = ({ isOpen = true, onClose, questionSet: propQuestionSet, onSuccess }) => {
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
  const [isPayButtonDisabled, setIsPayButtonDisabled] = useState(false);
  const submitButtonRef = useRef<HTMLButtonElement>(null);
  const stripeProcessing = useRef<boolean>(false);
  
  const [questionSet, setQuestionSet] = useState<QuestionSet>(propQuestionSet);
  const [alreadyPurchased, setAlreadyPurchased] = useState(false);
  const [showStripeForm, setShowStripeForm] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  
  // 新增：庆祝组件状态
  const [showCelebration, setShowCelebration] = useState(false);
  const [celebrationTitle, setCelebrationTitle] = useState('');
  const [celebrationMessage, setCelebrationMessage] = useState('');

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
                purchaseId: existingPurchase.id,
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

  // 如果提供了questionSet但没有questionSet，则加载questionSet
  useEffect(() => {
    if (propQuestionSet && !questionSet) {
      const fetchQuestionSet = async () => {
        setIsLoading(true);
        try {
          const response = await questionSetApi.getQuestionSetById(propQuestionSet.id);
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
  }, [propQuestionSet, questionSet]);

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

  // 用于处理支付表单提交的函数
  const handlePaymentSubmit = async (paymentInfo: {
    paymentIntentId: string;
    paymentMethodId: string | null;
    amount: number;
    status: string;
  }) => {
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
  };

  // 处理表单提交
  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    // 防止重复提交
    if (isProcessing || isPayButtonDisabled || stripeProcessing.current) {
      console.log('[支付] 正在处理中，忽略重复提交', { 
        isProcessing, isPayButtonDisabled, stripeProcessing: stripeProcessing.current 
      });
      return;
    }

    // 立即禁用按钮
    setIsPayButtonDisabled(true);
    
    // 如果用户未登录，提示错误
    if (!user) {
      setError('请先登录');
      setIsPayButtonDisabled(false);
      return;
    }

    // 获取题库价格，并检查是否有效
    const price = parseFloat(String(questionSet?.price || 0));
    if (isNaN(price) || price <= 0) {
      setError('题库价格无效');
      setIsPayButtonDisabled(false);
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
    } finally {
      setIsProcessing(false);
      // 延迟重置按钮状态，防止意外的快速点击
      setTimeout(() => {
        setIsPayButtonDisabled(false);
      }, 3000); // 延长到3秒
    }
  };

  // 真实Stripe支付流程
  const handleStripePayment = async () => {
    // 防止重复调用
    if (stripeProcessing.current) {
      console.log('[支付] 正在处理中，忽略重复调用');
      return;
    }
    
    stripeProcessing.current = true;
    
    // 禁用按钮
    if (submitButtonRef.current) {
      submitButtonRef.current.disabled = true;
    }
    
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

      console.log(`[支付] 支付意向创建成功，准备确认支付, clientSecret 长度: ${intentData.clientSecret.length}`);

      // 禁用支付按钮，防止重复点击
      setIsPayButtonDisabled(true);
      
      // 创建一个标记，防止重复处理
      const paymentKey = `payment_processing_${intentData.clientSecret.substring(0, 20) || 'unknown'}`;
      localStorage.setItem(paymentKey, 'true');
      
      try {
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
      } finally {
        // 清除处理标记
        localStorage.removeItem(paymentKey);
      }
    } catch (error: any) {
      console.error('[支付] Stripe支付错误:', error);
      throw new Error(error.message || '支付处理失败');
    } finally {
      // 延迟重置处理状态，防止意外的快速点击
      setTimeout(() => {
        stripeProcessing.current = false;
        setIsPayButtonDisabled(false);
        if (submitButtonRef.current) {
          submitButtonRef.current.disabled = false;
        }
      }, 3000); // 3秒延迟，确保有足够时间完成和恢复
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

    // 创建一个完成购买的标志，防止重复操作
    const purchaseKey = `${transactionId}_${user.id}`;
    const processingKey = `purchase_processing_${purchaseKey}`;
    
    // 检查是否已经在处理这个购买
    if (localStorage.getItem(processingKey)) {
      console.log(`[支付] 购买已在处理中: ${purchaseKey}`);
      return;
    }
    
    // 标记为正在处理
    localStorage.setItem(processingKey, 'true');

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
      
      // 设置成功消息
      const successMsg = `支付成功！您现在可以访问《${questionSet?.title}》题库的所有内容，有效期至 ${new Date(expiryDate).toLocaleDateString()}`;
      setSuccessMessage(successMsg);
      
      // 显示庆祝弹窗
      setCelebrationTitle('购买成功！');
      setCelebrationMessage(`恭喜您已成功购买《${questionSet?.title}》题库！\n立即开始您的学习之旅吧！`);
      setShowCelebration(true);
      
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
            purchaseId: purchase.id,
            remainingDays: Math.ceil((new Date(expiryDate).getTime() - new Date().getTime()) / (1000 * 60 * 60 * 24))
          };
          onSuccess(purchaseInfo);
          
          // 显示全局提示
          toast.success('题库购买成功！您现在可以访问完整内容了', {
            autoClose: 5000,
            position: 'top-center'
          });
          
          // 强制关闭支付弹窗 - 延长关闭时间，让用户看到庆祝弹窗
          setTimeout(() => {
            // 只有当庆祝弹窗被关闭时才关闭支付弹窗
            if (!showCelebration) {
              onClose();
            }
          }, 3000);
        }, 300);
      }
      
      // 重置处理状态
      setIsProcessing(false);
    } catch (err) {
      console.error('[支付] 完成购买后处理失败:', err);
      throw err;
    } finally {
      // 清除处理标记
      localStorage.removeItem(processingKey);
    }
  };

  // 处理关闭庆祝弹窗
  const handleCloseCelebration = () => {
    setShowCelebration(false);
    // 关闭庆祝弹窗后关闭支付弹窗
    setTimeout(() => {
      onClose();
    }, 500);
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

  // 注入全局样式用于纸屑动画
  const injectStyles = () => {
    const styleId = 'celebration-styles';
    
    // 如果已经存在样式，则不重复添加
    if (document.getElementById(styleId)) {
      return;
    }
    
    const style = document.createElement('style');
    style.id = styleId;
    style.innerHTML = `
      @keyframes confetti-fall {
        0% {
          transform: translateY(-10px) rotate(0deg);
          opacity: 1;
        }
        100% {
          transform: translateY(100vh) rotate(360deg);
          opacity: 0;
        }
      }
      
      @keyframes confetti-sway {
        0% {
          transform: translateX(0px);
        }
        33% {
          transform: translateX(100px);
        }
        66% {
          transform: translateX(-100px);
        }
        100% {
          transform: translateX(0px);
        }
      }
      
      .animate-confetti {
        position: absolute;
        will-change: transform;
        animation: confetti-fall 5s linear forwards, confetti-sway 3s ease-in-out infinite alternate;
      }
    `;
    document.head.appendChild(style);
  };

  // 初始化全局样式
  useEffect(() => {
    injectStyles();
  }, []);

  return (
    <div className={`${isOpen ? 'fixed' : 'hidden'} inset-0 bg-black bg-opacity-75 z-50 flex items-center justify-center p-4 backdrop-filter backdrop-blur-sm`}>
      {/* 庆祝弹窗 */}
      <CelebrationPopup
        isVisible={showCelebration}
        onClose={handleCloseCelebration}
        title={celebrationTitle}
        message={celebrationMessage}
      />

      <div className="max-w-xl w-full relative">
        {/* 装饰元素 */}
        <div className="absolute -top-20 -right-20 w-64 h-64 rounded-full bg-blue-500 bg-opacity-10 filter blur-3xl"></div>
        <div className="absolute -bottom-20 -left-20 w-64 h-64 rounded-full bg-purple-500 bg-opacity-10 filter blur-3xl"></div>
        
        {/* 主卡片容器 */}
        <div className="relative bg-gradient-to-br from-gray-900 to-indigo-900 rounded-2xl overflow-hidden shadow-2xl border border-indigo-500 border-opacity-20">
          {/* 头部标题区域 */}
          <div className="relative">
            {/* 网格背景 */}
            <div className="absolute inset-0 bg-gradient-to-r from-blue-500 to-indigo-600 opacity-90">
              <div className="absolute inset-0 bg-grid-white/[0.05]" style={{ backgroundSize: '10px 10px' }}></div>
            </div>
            
            {/* 标题内容 */}
            <div className="relative py-6 px-8 flex justify-between items-center">
              <h2 className="text-xl font-bold text-white flex items-center">
                <svg className="w-6 h-6 mr-2 text-blue-200" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z" />
                </svg>
                支付中心
              </h2>
          <button 
            onClick={onClose}
                className="text-gray-200 hover:text-white bg-black bg-opacity-20 rounded-full p-1.5 transition-all hover:bg-opacity-30"
            disabled={isProcessing}
          >
                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
            </div>
        </div>
        
          {/* 主内容区域 */}
          <div className="p-6">
            {/* 题库信息 */}
            {questionSet && (
              <div className="mb-6 bg-white bg-opacity-5 rounded-xl p-5 border border-white border-opacity-10 transform transition-transform hover:scale-[1.01]">
                <div className="flex justify-between items-start">
                  <div>
                    <h3 className="text-lg font-bold text-white mb-1 flex items-center">
                      <span className="inline-block w-2 h-2 bg-green-400 rounded-full mr-2 animate-pulse"></span>
                      {questionSet.title}
                    </h3>
                    <p className="text-gray-300 text-sm">{questionSet.description || '无描述'}</p>
          </div>
                  <div className="bg-indigo-600 bg-opacity-30 rounded-lg px-3 py-1 text-blue-200 text-sm">
                    {questionSet.questionCount} 题
                  </div>
        </div>
        
                <div className="mt-4 flex justify-between items-center">
                  <div className="flex items-baseline">
                    <span className="text-2xl font-bold bg-clip-text text-transparent bg-gradient-to-r from-blue-400 to-purple-500">¥{questionSet.price}</span>
                    <span className="text-gray-400 text-xs ml-2">一次付费，永久使用</span>
            </div>
                </div>
              </div>
            )}
            
            {/* 已购买提示 */}
            {alreadyPurchased && (
              <div className="bg-green-900 bg-opacity-20 text-green-200 p-5 rounded-xl border border-green-500 border-opacity-30 mb-4">
                <div className="flex items-start">
                  <svg className="w-5 h-5 mr-2 mt-0.5 text-green-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
                  </svg>
                  <div>
                    <p className="font-medium">您已成功购买此题库</p>
                    <p className="text-sm text-green-300 mt-1">系统将在3秒后自动关闭此窗口</p>
                  </div>
                </div>
              </div>
            )}
            
            {/* 成功消息 */}
            {successMessage && (
              <div className="bg-green-900 bg-opacity-20 text-green-200 p-5 rounded-xl border border-green-500 border-opacity-30 mb-4">
                <div className="flex items-start">
                  <svg className="w-5 h-5 mr-2 mt-0.5 text-green-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
                  </svg>
                  <div>
                    <p className="font-medium">{successMessage}</p>
                    <p className="text-sm text-green-300 mt-1">系统将在3秒后自动关闭此窗口</p>
              </div>
            </div>
              </div>
            )}
            
            {/* 错误消息 */}
            {error && (
              <div className="bg-red-900 bg-opacity-20 text-red-200 p-5 rounded-xl border border-red-500 border-opacity-30 mb-4">
                <div className="flex items-start">
                  <svg className="w-5 h-5 mr-2 mt-0.5 text-red-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                  </svg>
                  <div>
                    <p className="font-medium">支付过程中出现错误</p>
                    <p className="text-sm mt-1">{error}</p>
            </div>
          </div>
              </div>
            )}
            
            {/* Stripe支付表单 */}
            {isOpen && !alreadyPurchased && !successMessage && (
          <Elements stripe={stripePromise}>
            <StripePaymentForm
                  amount={questionSet?.price || 0}
                  onSubmit={handlePaymentSubmit}
                  onCancel={onClose}
              isProcessing={isProcessing}
            />
          </Elements>
        )}
          </div>
          
          {/* 底部支付安全信息 */}
          <div className="bg-black bg-opacity-20 p-4 border-t border-white border-opacity-5">
            <div className="flex items-center justify-center text-xs text-gray-400">
              <svg className="w-4 h-4 mr-1 text-green-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m5.618-4.016A11.955 11.955 0 0112 2.944a11.955 11.955 0 01-8.618 3.04A12.02 12.02 0 003 9c0 5.591 3.824 10.29 9 11.622 5.176-1.332 9-6.03 9-11.622 0-1.042-.133-2.052-.382-3.016z" />
              </svg>
              所有支付数据经过加密处理，我们不会存储您的完整卡号信息
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default PaymentModal; 