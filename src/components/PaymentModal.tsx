import React, { useState, useEffect } from 'react';
import { useUser } from '../contexts/UserContext';
import { QuestionSet } from '../types';
import { toast } from 'react-toastify';
import { loadStripe } from '@stripe/stripe-js';
import { Elements, CardElement, useStripe, useElements } from '@stripe/react-stripe-js';
import axios from 'axios';
import { API_BASE_URL } from '../services/api';

// Stripe公钥
const STRIPE_PUBLIC_KEY = import.meta.env.VITE_STRIPE_PUBLIC_KEY || 
  'pk_test_51RHMVW4ec3wxfwe9vME773VFyquoIP1bVWbsCDZgrgerfzp8YMs0rLS4ZSleICEcIf9gmLIEftwXvPygbLp1LEkv00r5M3rCIV';

const stripePromise = loadStripe(STRIPE_PUBLIC_KEY);

// 支付表单组件
const PaymentForm: React.FC<{
  amount: number;
  onSuccess: (data: any) => void;
  onCancel: () => void;
}> = ({ amount, onSuccess, onCancel }) => {
  const stripe = useStripe();
  const elements = useElements();
  const [isProcessing, setIsProcessing] = useState(false);
  const [error, setError] = useState<string>('');
  const [clientSecret, setClientSecret] = useState<string>('');

  // 创建支付意图
  useEffect(() => {
    const createPaymentIntent = async () => {
      try {
        const response = await axios.post(`${API_BASE_URL}/api/payments/create-intent`, {
          amount: amount,
          currency: 'cny'
        }, {
          headers: {
            'Authorization': `Bearer ${localStorage.getItem('authToken')}`
          }
        });

        if (response.data.clientSecret) {
          setClientSecret(response.data.clientSecret);
        }
      } catch (err: any) {
        setError('创建支付失败，请重试');
        console.error('创建支付意图失败:', err);
      }
    };

    if (amount > 0) {
      createPaymentIntent();
    }
  }, [amount]);

  // 处理支付提交
  const handleSubmit = async (event: React.FormEvent) => {
    event.preventDefault();

    if (!stripe || !elements || !clientSecret) {
      setError('支付系统未就绪，请稍后重试');
      return;
    }

    setIsProcessing(true);
    setError('');

    try {
      const cardElement = elements.getElement(CardElement);
      if (!cardElement) {
        throw new Error('无法获取卡片信息');
      }

      const result = await stripe.confirmCardPayment(clientSecret, {
        payment_method: {
          card: cardElement,
        }
      });

      if (result.error) {
        setError(result.error.message || '支付失败');
      } else if (result.paymentIntent?.status === 'succeeded') {
        toast.success('支付成功！');
        onSuccess({
          paymentIntentId: result.paymentIntent.id,
          amount: amount
        });
      }
    } catch (err: any) {
      setError(err.message || '支付过程中发生错误');
    } finally {
      setIsProcessing(false);
    }
  };

  return (
    <form onSubmit={handleSubmit} className="space-y-6">
      <div className="p-4 border border-gray-300 rounded-lg">
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
            },
          }}
        />
      </div>

      {error && (
        <div className="p-3 bg-red-100 border border-red-400 text-red-700 rounded">
          {error}
        </div>
      )}

      <div className="flex space-x-3">
        <button
          type="submit"
          disabled={!stripe || isProcessing}
          className="flex-1 bg-blue-600 text-white py-3 px-4 rounded-lg font-medium hover:bg-blue-700 disabled:bg-gray-400 disabled:cursor-not-allowed"
        >
          {isProcessing ? '处理中...' : `支付 ¥${amount}`}
        </button>
        <button
          type="button"
          onClick={onCancel}
          className="px-6 py-3 bg-gray-500 text-white rounded-lg font-medium hover:bg-gray-600"
        >
          取消
        </button>
      </div>
    </form>
  );
};

// 主支付弹窗组件
interface PaymentModalProps {
  isOpen: boolean;
  onClose: () => void;
  questionSet: QuestionSet;
  onSuccess: (data: {
    questionSetId: string;
    purchaseId?: string;
    remainingDays: number;
  }) => void;
}

const PaymentModal: React.FC<PaymentModalProps> = ({
  isOpen,
  onClose,
  questionSet,
  onSuccess
}) => {
  const { user, addPurchase, refreshPurchases } = useUser();
  const [showSuccess, setShowSuccess] = useState(false);

  // 检查是否已购买
  useEffect(() => {
    const checkPurchased = async () => {
      if (!user || !questionSet?.id) return;

      try {
        await refreshPurchases();
        const hasPurchased = user.purchases?.some(
          p => p.questionSetId === questionSet.id && p.status === 'active'
        );

        if (hasPurchased) {
          toast.info('您已购买过此题库');
          onSuccess({
            questionSetId: questionSet.id,
            remainingDays: 30
          });
          onClose();
        }
      } catch (error) {
        console.error('检查购买状态失败:', error);
      }
    };

    if (isOpen) {
      checkPurchased();
    }
  }, [isOpen, user, questionSet, refreshPurchases, onSuccess, onClose]);

  // 处理支付成功
  const handlePaymentSuccess = async (paymentData: any) => {
    try {
      // 完成购买流程
      const response = await axios.post(`${API_BASE_URL}/api/payments/complete`, {
        paymentIntentId: paymentData.paymentIntentId,
        questionSetId: questionSet.id,
        amount: paymentData.amount
      }, {
        headers: {
          'Authorization': `Bearer ${localStorage.getItem('authToken')}`
        }
      });

      if (response.data.success) {
        // 添加到用户购买记录
        const purchase = {
          id: response.data.purchaseId,
          userId: user!.id,
          questionSetId: questionSet.id,
          amount: paymentData.amount,
          status: 'active' as const,
          transactionId: paymentData.paymentIntentId,
          paymentMethod: 'stripe',
          purchaseDate: new Date().toISOString(),
          expiryDate: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString(),
          createdAt: new Date().toISOString(),
          updatedAt: new Date().toISOString()
        };

        addPurchase(purchase);
        setShowSuccess(true);

        // 3秒后关闭弹窗
        setTimeout(() => {
          onSuccess({
            questionSetId: questionSet.id,
            purchaseId: response.data.purchaseId,
            remainingDays: 30
          });
          onClose();
        }, 3000);
      }
    } catch (error: any) {
      console.error('完成购买失败:', error);
      toast.error('购买确认失败，请联系客服');
    }
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 z-50 flex items-center justify-center p-4">
      <div className="bg-white rounded-lg max-w-md w-full p-6">
        {showSuccess ? (
          // 成功页面
          <div className="text-center" style={{ animation: 'celebration 0.6s ease-out' }}>
            <div className="text-6xl mb-4">🎉</div>
            <h3 className="text-xl font-bold text-green-600 mb-2">购买成功！</h3>
            <p className="text-gray-600 mb-4">
              您已成功购买《{questionSet.title}》题库
            </p>
            <p className="text-sm text-gray-500">
              正在跳转到题库页面...
            </p>
            <style>{`
              @keyframes celebration {
                0% { transform: scale(0.8); opacity: 0; }
                50% { transform: scale(1.1); opacity: 1; }
                100% { transform: scale(1); opacity: 1; }
              }
            `}</style>
          </div>
        ) : (
          // 支付页面
          <>
            <div className="flex justify-between items-center mb-6">
              <h3 className="text-xl font-bold">购买题库</h3>
              <button
                onClick={onClose}
                className="text-gray-400 hover:text-gray-600"
              >
                ✕
              </button>
            </div>

            <div className="mb-6">
              <h4 className="font-medium mb-2">{questionSet.title}</h4>
              <p className="text-gray-600 text-sm mb-4">{questionSet.description}</p>
              <div className="flex justify-between items-center p-4 bg-gray-50 rounded-lg">
                <span>价格:</span>
                <span className="text-xl font-bold text-blue-600">
                  ¥{questionSet.price}
                </span>
              </div>
            </div>

            <Elements stripe={stripePromise}>
              <PaymentForm
                amount={questionSet.price || 0}
                onSuccess={handlePaymentSuccess}
                onCancel={onClose}
              />
            </Elements>
          </>
        )}
      </div>
    </div>
  );
};

export default PaymentModal;