import React, { useState, useEffect } from 'react';
import { loadStripe } from '@stripe/stripe-js';
import { Elements, CardElement, useStripe, useElements } from '@stripe/react-stripe-js';
import { processPayment, verifyPaymentStatus } from '../utils/paymentUtils';
import { useUser } from '../contexts/UserContext';

// Use the provided public key
const STRIPE_PUBLIC_KEY = 'pk_test_51RHMVW4ec3wxfwe9vME773VFyquoIP1bVWbsCDZgrgerfzp8YMs0rLS4ZSleICEcIf9gmLIEftwXvPygbLp1LEkv00r5M3rCIV';
const stripePromise = loadStripe(STRIPE_PUBLIC_KEY);

const CheckoutForm = () => {
  const { user } = useUser();
  const stripe = useStripe();
  const elements = useElements();
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<boolean>(false);
  const [processing, setProcessing] = useState<boolean>(false);
  const [clientSecret, setClientSecret] = useState<string>('');
  const [paymentIntentId, setPaymentIntentId] = useState<string>('');
  const [amount, setAmount] = useState<number>(10);
  const [debug, setDebug] = useState<string>('');

  useEffect(() => {
    // Only create intent when stripe is ready
    if (!stripe || !user) return;

    const createPaymentIntent = async () => {
      try {
        setDebug(prev => prev + `\n创建支付意向, 金额: ${amount}元`);
        
        const intentData = await processPayment(
          amount,
          'cny',
          {
            userId: user?.id || 'anonymous',
            description: 'Stripe支付测试'
          }
        );

        if (intentData && intentData.clientSecret) {
          setClientSecret(intentData.clientSecret);
          setPaymentIntentId(intentData.id);
          setDebug(prev => prev + `\n支付意向创建成功, ID: ${intentData.id}`);
        } else {
          setError('创建支付意向失败');
        }
      } catch (err: any) {
        console.error('创建支付意向错误:', err);
        setError(err.message || '创建支付意向失败');
        setDebug(prev => prev + `\n错误: ${err.message || '创建支付意向失败'}`);
      }
    };

    createPaymentIntent();
  }, [stripe, amount, user]);

  const handleSubmit = async (event: React.FormEvent) => {
    event.preventDefault();

    if (!stripe || !elements) {
      setError('Stripe未初始化');
      return;
    }

    const cardElement = elements.getElement(CardElement);
    if (!cardElement) {
      setError('卡元素未找到');
      return;
    }

    setProcessing(true);
    setError(null);
    setDebug(prev => prev + `\n开始处理支付...`);

    try {
      // 确认支付
      const result = await stripe.confirmCardPayment(clientSecret, {
        payment_method: {
          card: cardElement,
          billing_details: {
            name: user?.username || '测试用户',
          },
        }
      });

      if (result.error) {
        setError(result.error.message || '支付失败');
        setDebug(prev => prev + `\n支付错误: ${result.error.message}`);
      } else if (result.paymentIntent && result.paymentIntent.status === 'succeeded') {
        setSuccess(true);
        setDebug(prev => prev + `\n支付成功! ID: ${result.paymentIntent.id}`);
        
        // 验证支付
        try {
          const verifyResult = await verifyPaymentStatus(result.paymentIntent.id);
          setDebug(prev => prev + `\n支付验证成功: ${JSON.stringify(verifyResult)}`);
        } catch (err: any) {
          setDebug(prev => prev + `\n支付验证错误: ${err.message}`);
        }
      } else {
        setError(`支付状态: ${result.paymentIntent?.status || '未知'}`);
        setDebug(prev => prev + `\n未完成支付, 状态: ${result.paymentIntent?.status || '未知'}`);
      }
    } catch (err: any) {
      setError(err.message || '处理支付时发生错误');
      setDebug(prev => prev + `\n异常: ${err.message}`);
    }

    setProcessing(false);
  };

  // 复制日志到剪贴板
  const copyDebugLog = () => {
    navigator.clipboard.writeText(debug).then(() => {
      alert('调试日志已复制到剪贴板');
    });
  };

  return (
    <div className="max-w-md mx-auto p-4 mb-8">
      <form onSubmit={handleSubmit} className="bg-white rounded-lg shadow-md p-6 mb-6">
        <div className="mb-4">
          <label className="block text-gray-700 text-sm font-bold mb-2">
            测试卡信息
          </label>
          <ul className="text-sm text-gray-600 mb-4 pl-5 list-disc">
            <li>卡号: 4242 4242 4242 4242</li>
            <li>有效期: 任意未来日期 (如: 12/25)</li>
            <li>CVC: 任意3位数 (如: 123)</li>
            <li>邮编: 任意5位数 (如: 12345)</li>
          </ul>

          <label className="block text-gray-700 text-sm font-bold mb-2">
            支付金额 (元)
          </label>
          <input
            type="number"
            value={amount}
            onChange={(e) => setAmount(Number(e.target.value))}
            className="shadow appearance-none border rounded w-full py-2 px-3 text-gray-700 mb-3"
            min="1"
            max="1000"
          />
        </div>

        <div className="mb-4">
          <label className="block text-gray-700 text-sm font-bold mb-2">
            卡信息
          </label>
          <div className="border rounded p-3">
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
              }}
            />
          </div>
        </div>

        {error && (
          <div className="mb-4 p-3 bg-red-100 border border-red-400 text-red-700 rounded">
            {error}
          </div>
        )}

        {success && (
          <div className="mb-4 p-3 bg-green-100 border border-green-400 text-green-700 rounded">
            支付成功!
          </div>
        )}

        <button
          type="submit"
          disabled={!stripe || processing || success || !clientSecret}
          className={`w-full py-2 px-4 rounded font-bold ${
            !stripe || processing || !clientSecret
              ? 'bg-gray-400 cursor-not-allowed'
              : 'bg-blue-500 hover:bg-blue-700 text-white'
          }`}
        >
          {processing ? '处理中...' : clientSecret ? `支付 ¥${amount}` : '正在准备支付...'}
        </button>
      </form>

      <div className="bg-gray-50 rounded-lg p-4">
        <div className="flex justify-between items-center mb-2">
          <h3 className="font-bold">调试日志</h3>
          <button 
            onClick={copyDebugLog}
            className="text-xs bg-gray-200 hover:bg-gray-300 px-2 py-1 rounded"
          >
            复制日志
          </button>
        </div>
        <pre className="text-xs overflow-auto max-h-40 bg-gray-100 p-2 rounded">
          {debug || '等待操作...'}
        </pre>
      </div>
    </div>
  );
};

const TestPayment = () => {
  return (
    <div className="container mx-auto py-8 px-4">
      <h1 className="text-2xl font-bold text-center mb-8">Stripe支付测试</h1>
      <p className="text-center mb-8 max-w-lg mx-auto">
        本页面用于测试Stripe支付功能。使用提供的测试卡信息完成支付流程，验证支付系统是否正常工作。
      </p>
      
      <Elements stripe={stripePromise}>
        <CheckoutForm />
      </Elements>
    </div>
  );
};

export default TestPayment; 