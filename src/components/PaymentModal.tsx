import React, { useState, useEffect } from 'react';
import { useUser } from '../contexts/UserContext';
import { QuestionSet } from '../data/questionSets';

interface PaymentModalProps {
  isOpen: boolean;
  onClose: () => void;
  questionSet: QuestionSet;
  onSuccess?: () => void;
}

// Stripe公钥 - 在生产环境应该使用环境变量
// 理想情况下，应该使用import.meta.env.VITE_STRIPE_PUBLIC_KEY等环境变量
const STRIPE_PUBLIC_KEY = import.meta.env.VITE_STRIPE_PUBLIC_KEY || 
  'pk_test_51RHMVW4ec3wxfwe9vME773VFyquoIP1bVWbsCDZgrgerfzp8YMs0rLS4ZSleICEcIf9gmLIEftwXvPygbLp1LEkv00r5M3rCIV';

const PaymentModal: React.FC<PaymentModalProps> = ({ isOpen, onClose, questionSet, onSuccess }) => {
  const { user, addPurchase } = useUser();
  const [isProcessing, setIsProcessing] = useState(false);
  const [error, setError] = useState('');
  const [successMessage, setSuccessMessage] = useState('');
  const [stripeLoaded, setStripeLoaded] = useState(false);
  const [stripe, setStripe] = useState<any>(null);
  const [cardElement, setCardElement] = useState<any>(null);

  // 加载Stripe
  useEffect(() => {
    if (!isOpen) return;

    // 动态加载Stripe.js
    const script = document.createElement('script');
    script.src = 'https://js.stripe.com/v3/';
    script.async = true;
    script.onload = () => {
      setStripeLoaded(true);
    };
    document.body.appendChild(script);

    return () => {
      // 清理
      document.body.removeChild(script);
    };
  }, [isOpen]);

  // 初始化Stripe
  useEffect(() => {
    if (!stripeLoaded || !isOpen) return;

    const stripeInstance = (window as any).Stripe(STRIPE_PUBLIC_KEY);
    setStripe(stripeInstance);

    const elements = stripeInstance.elements();
    const card = elements.create('card', {
      style: {
        base: {
          fontSize: '16px',
          color: '#32325d',
          fontFamily: '"Helvetica Neue", Helvetica, sans-serif',
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

    // 等待下一个渲染周期挂载DOM
    setTimeout(() => {
      const cardContainer = document.getElementById('card-element');
      if (cardContainer) {
        card.mount('#card-element');
        setCardElement(card);
      }
    }, 100);

    return () => {
      if (card) {
        card.unmount();
      }
    };
  }, [stripeLoaded, isOpen]);

  // 处理支付提交
  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!stripe || !cardElement || !user) {
      return;
    }

    setIsProcessing(true);
    setError('');

    try {
      // 在实际应用中，这里应该向服务器发送请求创建支付意向
      // 为了演示，我们模拟一个成功的支付过程

      // 模拟支付处理延迟
      await new Promise(resolve => setTimeout(resolve, 1500));

      // 模拟交易ID
      const transactionId = `tr_${Math.random().toString(36).substring(2, 12)}`;
      
      // 计算过期时间（6个月后）
      const now = new Date();
      const expiryDate = new Date(now);
      expiryDate.setMonth(expiryDate.getMonth() + 6);
      
      // 创建购买记录
      const purchase = {
        quizId: questionSet.id,
        purchaseDate: now.toISOString(),
        expiryDate: expiryDate.toISOString(),
        transactionId: transactionId,
        amount: questionSet.price || 0
      };
      
      // 添加购买记录
      addPurchase(purchase);
      
      // 总是显示成功消息
      setSuccessMessage(`支付成功！您现在可以访问《${questionSet.title}》题库的所有内容，有效期至 ${expiryDate.toLocaleDateString()}`);
      
      // 如果提供了成功回调，则立即调用而不是延迟
      if (onSuccess) {
        onSuccess();
      }
    } catch (err) {
      setError('支付处理过程中发生错误，请重试');
      // 在生产环境中应使用适当的错误记录服务
      // console.error('支付错误:', err);
    } finally {
      setIsProcessing(false);
    }
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 bg-gray-600 bg-opacity-50 overflow-y-auto h-full w-full z-50 flex items-center justify-center">
      <div className="relative mx-auto p-5 border w-full max-w-md shadow-lg rounded-lg bg-white animate-fadeIn">
        <div className="flex justify-between items-center mb-6">
          <h3 className="text-xl font-semibold text-gray-900">
            购买题库
          </h3>
          <button 
            onClick={onClose}
            className="text-gray-400 hover:text-gray-500"
            disabled={isProcessing}
          >
            <svg className="h-6 w-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>
        
        <div className="mb-6">
          <h4 className="font-medium text-lg mb-2">{questionSet.title}</h4>
          <p className="text-gray-600 mb-3">{questionSet.description}</p>
          <div className="flex items-center justify-between bg-gray-50 p-3 rounded-md">
            <span className="text-gray-700">付费内容</span>
            <span className="font-medium text-lg text-green-600">¥{questionSet.price}</span>
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
            {stripeLoaded && (
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
                <p className="mt-1 text-xs text-gray-500">
                  这是一个测试环境，您可以使用测试卡号：4242 4242 4242 4242，有效期：任意未来日期，CVV：任意3位数
                </p>
              </div>
            )}
            
            {error && (
              <div className="bg-red-50 p-4 rounded-md">
                <div className="flex">
                  <div className="flex-shrink-0">
                    <svg className="h-5 w-5 text-red-400" fill="currentColor" viewBox="0 0 20 20">
                      <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zM8.707 7.293a1 1 0 00-1.414 1.414L8.586 10l-1.293 1.293a1 1 0 101.414 1.414L10 11.414l1.293 1.293a1 1 0 001.414-1.414L11.414 10l1.293-1.293a1 1 0 00-1.414-1.414L10 8.586 8.707 7.293z" clipRule="evenodd" />
                    </svg>
                  </div>
                  <div className="ml-3">
                    <p className="text-sm font-medium text-red-800">
                      {error}
                    </p>
                  </div>
                </div>
              </div>
            )}
            
            <button
              type="submit"
              disabled={isProcessing || !stripeLoaded}
              className={`w-full flex justify-center py-2 px-4 border border-transparent rounded-md shadow-sm text-sm font-medium text-white bg-blue-600 hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500 ${isProcessing ? 'opacity-70 cursor-not-allowed' : ''}`}
            >
              {isProcessing ? (
                <svg className="animate-spin -ml-1 mr-3 h-5 w-5 text-white" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                  <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                  <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                </svg>
              ) : null}
              {isProcessing ? '处理中...' : `支付 ¥${questionSet.price}`}
            </button>
          </form>
        )}
      </div>
    </div>
  );
};

export default PaymentModal; 