import React, { useState, useEffect } from 'react';
import { useUser } from '../contexts/UserContext';
import { QuestionSet } from '../types';
import { toast } from 'react-toastify';
import { loadStripe } from '@stripe/stripe-js';
import { Elements, CardElement, useStripe, useElements, PaymentRequestButtonElement } from '@stripe/react-stripe-js';
import axios from 'axios';
import { API_BASE_URL } from '../services/api';
import './payment-styles.css';

// Stripe公開可能キー - 環境変数から読み込み（.envファイルに設定）
const STRIPE_PUBLIC_KEY = import.meta.env.VITE_STRIPE_PUBLIC_KEY;

if (!STRIPE_PUBLIC_KEY) {
  console.error('VITE_STRIPE_PUBLIC_KEY が設定されていません。.envファイルを確認してください。');
}

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
  const [paymentRequest, setPaymentRequest] = useState<any>(null);

  // 创建支付意图
  useEffect(() => {
    const createPaymentIntent = async () => {
      try {
        const response = await axios.post(`${API_BASE_URL}/api/payments/create-intent`, {
          amount: Math.round(amount), // JPYは円単位そのまま（100倍しない）
          currency: 'jpy'
        }, {
          headers: {
            'Authorization': `Bearer ${localStorage.getItem('authToken')}`
          }
        });

        if (response.data.clientSecret) {
          setClientSecret(response.data.clientSecret);
        }
      } catch (err: any) {
        console.error('支払いIntent作成失敗:', err);
        
        // テストモード/本番モード切り替え後のエラーをチェック
        const errorMessage = err.response?.data?.error?.message || err.message || '';
        if (errorMessage.includes('test mode') || errorMessage.includes('live mode')) {
          setError('決済システムの設定が更新されました。ページを更新してもう一度お試しください。');
          setTimeout(() => {
            window.location.reload();
          }, 3000);
        } else {
          setError('お支払いの作成に失敗しました。再試行してください');
        }
      }
    };

    if (amount > 0) {
      createPaymentIntent();
    }
  }, [amount]);

  // Apple Pay / Google Pay サポートの設定
  useEffect(() => {
    if (!stripe || amount <= 0) {
      return;
    }

    const pr = stripe.paymentRequest({
      country: 'JP',
      currency: 'jpy',
      total: {
        label: '問題集購入',
        amount: Math.round(amount),
      },
      requestPayerName: true,
      requestPayerEmail: true,
    });

    // 利用可能性をチェック
    pr.canMakePayment().then(result => {
      if (result) {
        setPaymentRequest(pr);
      }
    });

    // 支払いが承認された時の処理
    pr.on('paymentmethod', async (ev) => {
      if (!clientSecret) {
        ev.complete('fail');
        return;
      }

      try {
        const { error: confirmError, paymentIntent } = await stripe.confirmCardPayment(
          clientSecret,
          { payment_method: ev.paymentMethod.id },
          { handleActions: false }
        );

        if (confirmError) {
          ev.complete('fail');
          setError(confirmError.message || 'お支払いに失敗しました');
        } else {
          ev.complete('success');
          if (paymentIntent.status === 'requires_action') {
            const { error } = await stripe.confirmCardPayment(clientSecret);
            if (error) {
              setError(error.message || 'お支払いに失敗しました');
            } else {
              onSuccess({
                paymentIntentId: paymentIntent.id,
                amount: amount
              });
            }
          } else {
            onSuccess({
              paymentIntentId: paymentIntent.id,
              amount: amount
            });
          }
        }
      } catch (err: any) {
        ev.complete('fail');
        setError(err.message || 'お支払い処理中にエラーが発生しました');
      }
    });
  }, [stripe, amount, clientSecret, onSuccess]);

  // 处理支付提交
  const handleSubmit = async (event: React.FormEvent) => {
    event.preventDefault();

    if (!stripe || !elements || !clientSecret) {
      setError('決済システムの準備ができていません。しばらく後に再試行してください');
      return;
    }

    setIsProcessing(true);
    setError('');

    try {
      const cardElement = elements.getElement(CardElement);
      if (!cardElement) {
        throw new Error('カード情報を取得できません');
      }

      const result = await stripe.confirmCardPayment(clientSecret, {
        payment_method: {
          card: cardElement,
        }
      });

      if (result.error) {
        // テストモードに関する情報を削除
        let errorMessage = result.error.message || 'お支払いに失敗しました';
        
        // テストモード関連のエラーをチェック
        if (errorMessage.includes('test') || errorMessage.includes('テスト')) {
          errorMessage = 'カードが拒否されました。別のカードをお試しいただくか、カード発行会社にお問い合わせください。';
        }
        // テストモードのpayment_intentを本番モードで使用しようとした場合
        else if (errorMessage.includes('test mode') || errorMessage.includes('live mode key')) {
          errorMessage = '決済情報が古くなっています。ページを更新してもう一度お試しください。';
          // 3秒後に自動的にページをリロード
          setTimeout(() => {
            window.location.reload();
          }, 3000);
        }
        
        setError(errorMessage);
      } else if (result.paymentIntent?.status === 'succeeded') {
        /* toast.success('お支払いが完了しました！'); */
        onSuccess({
          paymentIntentId: result.paymentIntent.id,
          amount: amount
        });
      }
    } catch (err: any) {
      setError(err.message || 'お支払い処理中にエラーが発生しました');
    } finally {
      setIsProcessing(false);
    }
  };

  return (
    <form onSubmit={handleSubmit} className="space-y-6">
      {/* 专业的支付说明 */}
      <div className="bg-gradient-to-r from-blue-50 to-indigo-50 border border-blue-200 rounded-xl p-4 mb-6">
        <div className="flex items-start space-x-3">
          <div className="flex-shrink-0">
            <svg className="w-6 h-6 text-blue-600" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m5.618-4.016A11.955 11.955 0 0112 2.944a11.955 11.955 0 01-8.618 3.04A12.02 12.02 0 003 9c0 5.591 3.824 10.29 9 11.622 5.176-1.332 9-6.03 9-11.622 0-1.042-.133-2.052-.382-3.016z" />
            </svg>
          </div>
          <div className="flex-1">
            <h3 className="text-sm font-semibold text-gray-800 mb-1">安全な決済</h3>
            <p className="text-xs text-gray-600 leading-relaxed">
              お支払い情報はStripeによって暗号化され、安全に処理されます。カード情報は当社のサーバーに保存されません。
            </p>
          </div>
        </div>
      </div>

      {/* Apple Pay / Google Pay ボタン */}
      {paymentRequest && (
        <div className="space-y-3">
          <div className="relative">
            <div className="absolute inset-0 flex items-center">
              <div className="w-full border-t border-gray-300"></div>
            </div>
            <div className="relative flex justify-center text-sm">
              <span className="px-4 bg-white text-gray-500 font-medium">エクスプレス決済</span>
            </div>
          </div>
          
          <div className="payment-request-button-container">
            <PaymentRequestButtonElement 
              options={{ 
                paymentRequest,
                style: {
                  paymentRequestButton: {
                    type: 'default',
                    theme: 'dark',
                    height: '48px',
                  },
                },
              }} 
            />
          </div>

          <div className="relative">
            <div className="absolute inset-0 flex items-center">
              <div className="w-full border-t border-gray-300"></div>
            </div>
            <div className="relative flex justify-center text-sm">
              <span className="px-4 bg-white text-gray-500 font-medium">またはカードで支払う</span>
            </div>
          </div>
        </div>
      )}

      {/* カード入力エリア */}
      <div className="space-y-2">
        <label className="block text-sm font-semibold text-gray-700 mb-2">
          クレジットカード情報
        </label>
        <div className="relative">
          <div className="p-4 border-2 border-gray-300 rounded-xl stripe-card-element-container hover:border-blue-400 focus-within:border-blue-500 focus-within:ring-4 focus-within:ring-blue-100 transition-all duration-200 bg-white shadow-sm">
            <CardElement
              options={{
                style: {
                  base: {
                    fontSize: '16px',
                    color: '#1f2937',
                    fontFamily: '-apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif',
                    fontSmoothing: 'antialiased',
                    '::placeholder': {
                      color: '#9ca3af',
                    },
                    iconColor: '#6b7280',
                  },
                  invalid: {
                    color: '#ef4444',
                    iconColor: '#ef4444',
                  },
                },
                hideIcon: false,
                iconStyle: 'default',
              }}
            />
          </div>
          {/* 安全アイコン */}
          <div className="absolute -bottom-8 right-0 flex items-center space-x-2 text-xs text-gray-500">
            <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z" />
            </svg>
            <span>SSL暗号化通信</span>
          </div>
        </div>
      </div>

      {/* エラーメッセージ */}
      {error && (
        <div className="rounded-xl bg-red-50 border-2 border-red-200 p-4 animate-shake">
          <div className="flex items-start">
            <div className="flex-shrink-0">
              <svg className="w-5 h-5 text-red-600" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
              </svg>
            </div>
            <div className="ml-3">
              <p className="text-sm font-medium text-red-800">{error}</p>
            </div>
          </div>
        </div>
      )}

      {/* 支払い概要 */}
      <div className="bg-gray-50 rounded-xl p-5 border border-gray-200 space-y-3">
        <div className="flex justify-between items-center text-sm">
          <span className="text-gray-600">商品価格</span>
          <span className="font-medium text-gray-900">¥{amount.toLocaleString()}</span>
        </div>
        <div className="flex justify-between items-center text-sm">
          <span className="text-gray-600">消費税</span>
          <span className="font-medium text-gray-900">税込み</span>
        </div>
        <div className="border-t border-gray-300 pt-3 flex justify-between items-center">
          <span className="text-base font-semibold text-gray-800">合計金額</span>
          <span className="text-2xl font-bold text-blue-600">¥{amount.toLocaleString()}</span>
        </div>
      </div>

      {/* ボタンエリア */}
      <div className="flex space-x-3 pt-4">
        <button
          type="button"
          onClick={onCancel}
          disabled={isProcessing}
          className="flex-1 px-6 py-3.5 bg-white border-2 border-gray-300 text-gray-700 rounded-xl font-semibold hover:bg-gray-50 hover:border-gray-400 disabled:opacity-50 disabled:cursor-not-allowed transition-all duration-200 shadow-sm"
        >
          キャンセル
        </button>
        <button
          type="submit"
          disabled={!stripe || isProcessing || !clientSecret}
          className="flex-1 px-6 py-3.5 bg-gradient-to-r from-blue-600 to-indigo-600 text-white rounded-xl font-semibold hover:from-blue-700 hover:to-indigo-700 disabled:from-gray-400 disabled:to-gray-400 disabled:cursor-not-allowed transition-all duration-200 shadow-lg hover:shadow-xl transform hover:-translate-y-0.5 disabled:transform-none flex items-center justify-center space-x-2"
        >
          {isProcessing ? (
            <>
              <svg className="animate-spin h-5 w-5 text-white" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
              </svg>
              <span>処理中...</span>
            </>
          ) : (
            <>
              <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
              </svg>
              <span>¥{amount.toLocaleString()} を支払う</span>
            </>
          )}
        </button>
      </div>

      {/* 信頼バッジ */}
      <div className="flex items-center justify-center space-x-6 pt-4 border-t border-gray-200">
        <div className="flex items-center space-x-2 text-xs text-gray-500">
          <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z" />
          </svg>
          <span className="font-medium">256bit SSL</span>
        </div>
        <div className="flex items-center space-x-2 text-xs text-gray-500">
          <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m5.618-4.016A11.955 11.955 0 0112 2.944a11.955 11.955 0 01-8.618 3.04A12.02 12.02 0 003 9c0 5.591 3.824 10.29 9 11.622 5.176-1.332 9-6.03 9-11.622 0-1.042-.133-2.052-.382-3.016z" />
          </svg>
          <span className="font-medium">PCI DSS準拠</span>
        </div>
        <div className="flex items-center space-x-2 text-xs text-gray-500">
          <div className="flex items-center">
            <span className="font-semibold text-blue-600" style={{ fontFamily: 'system-ui' }}>Stripe</span>
          </div>
          <span>決済</span>
        </div>
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
          /* toast.info('この問題集は既に購入済みです'); */
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
      /* toast.error('購入確認に失敗しました。カスタマーサポートにお問い合わせください'); */
    }
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 bg-black bg-opacity-60 backdrop-blur-sm z-50 flex items-center justify-center p-4 animate-fadeIn">
      <div className="bg-white rounded-2xl max-w-lg w-full shadow-2xl transform transition-all duration-300 animate-slideUp">
        {showSuccess ? (
          // 成功ページ - より華やかに
          <div className="p-10 text-center" style={{ animation: 'celebration 0.6s ease-out' }}>
            <div className="relative inline-block mb-6">
              <div className="absolute inset-0 bg-green-100 rounded-full animate-ping opacity-75"></div>
              <div className="relative text-7xl">🎉</div>
            </div>
            <h3 className="text-2xl font-bold text-gray-800 mb-3">
              お支払いが完了しました！
            </h3>
            <div className="bg-gradient-to-r from-green-50 to-emerald-50 border-2 border-green-200 rounded-xl p-4 mb-6">
              <p className="text-gray-700 font-medium mb-1">
                {questionSet.title}
              </p>
              <p className="text-sm text-gray-600">
                問題集への完全アクセスが有効になりました
              </p>
            </div>
            <div className="flex items-center justify-center space-x-2 text-sm text-gray-500">
              <svg className="animate-spin h-4 w-4" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
              </svg>
              <span>問題集ページに移動しています...</span>
            </div>
            <style>{`
              @keyframes celebration {
                0% { transform: scale(0.8); opacity: 0; }
                50% { transform: scale(1.05); opacity: 1; }
                100% { transform: scale(1); opacity: 1; }
              }
              @keyframes fadeIn {
                from { opacity: 0; }
                to { opacity: 1; }
              }
              @keyframes slideUp {
                from { 
                  opacity: 0;
                  transform: translateY(20px);
                }
                to { 
                  opacity: 1;
                  transform: translateY(0);
                }
              }
              .animate-fadeIn {
                animation: fadeIn 0.3s ease-out;
              }
              .animate-slideUp {
                animation: slideUp 0.3s ease-out;
              }
            `}</style>
          </div>
        ) : (
          // 支払いページ - プロフェッショナルなデザイン
          <>
            {/* ヘッダー */}
            <div className="bg-gradient-to-r from-blue-600 to-indigo-600 rounded-t-2xl px-8 py-6 relative overflow-hidden">
              <div className="absolute inset-0 bg-white opacity-10" style={{ 
                backgroundImage: 'radial-gradient(circle, rgba(255,255,255,0.3) 1px, transparent 1px)',
                backgroundSize: '20px 20px'
              }}></div>
              <div className="relative flex justify-between items-start">
                <div className="flex-1">
                  <div className="flex items-center space-x-2 mb-2">
                    <svg className="w-6 h-6 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 10h18M7 15h1m4 0h1m-7 4h12a3 3 0 003-3V8a3 3 0 00-3-3H6a3 3 0 00-3 3v8a3 3 0 003 3z" />
                    </svg>
                    <h3 className="text-xl font-bold text-white">セキュア決済</h3>
                  </div>
                  <p className="text-blue-100 text-sm">
                    Stripe セキュア決済システム
                  </p>
                </div>
                <button
                  onClick={onClose}
                  className="text-white hover:bg-white hover:bg-opacity-20 rounded-full p-2 transition-all duration-200"
                >
                  <svg className="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                  </svg>
                </button>
              </div>
            </div>

            {/* コンテンツ */}
            <div className="px-8 py-6">
              {/* 商品情報 */}
              <div className="mb-6 bg-gradient-to-br from-gray-50 to-blue-50 rounded-xl p-5 border border-gray-200">
                <div className="flex items-start space-x-4">
                  <div className="flex-shrink-0 w-12 h-12 bg-blue-100 rounded-xl flex items-center justify-center">
                    <svg className="w-7 h-7 text-blue-600" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 6.253v13m0-13C10.832 5.477 9.246 5 7.5 5S4.168 5.477 3 6.253v13C4.168 18.477 5.754 18 7.5 18s3.332.477 4.5 1.253m0-13C13.168 5.477 14.754 5 16.5 5c1.747 0 3.332.477 4.5 1.253v13C19.832 18.477 18.247 18 16.5 18c-1.746 0-3.332.477-4.5 1.253" />
                    </svg>
                  </div>
                  <div className="flex-1 min-w-0">
                    <h4 className="font-bold text-gray-900 mb-1 text-lg">{questionSet.title}</h4>
                    <p className="text-gray-600 text-sm leading-relaxed line-clamp-2">
                      {questionSet.description}
                    </p>
                  </div>
                </div>
              </div>

              {/* 支払いフォーム */}
              <Elements stripe={stripePromise}>
                <PaymentForm
                  amount={questionSet.price || 0}
                  onSuccess={handlePaymentSuccess}
                  onCancel={onClose}
                />
              </Elements>
            </div>

            {/* フッター - 返金保証など */}
            <div className="bg-gray-50 rounded-b-2xl px-8 py-5 border-t border-gray-200">
              <div className="flex items-center justify-center space-x-8 text-xs text-gray-600">
                <div className="flex items-center space-x-2">
                  <svg className="w-4 h-4 text-green-600" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
                  </svg>
                  <span>即時アクセス</span>
                </div>
                <div className="flex items-center space-x-2">
                  <svg className="w-4 h-4 text-green-600" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
                  </svg>
                  <span>30日間保証</span>
                </div>
                <div className="flex items-center space-x-2">
                  <svg className="w-4 h-4 text-green-600" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
                  </svg>
                  <span>無制限学習</span>
                </div>
              </div>
            </div>
          </>
        )}
      </div>
    </div>
  );
};

export default PaymentModal;