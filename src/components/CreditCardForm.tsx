import React, { useState, useEffect } from 'react';
import { useUser } from '../contexts/UserContext';

interface CreditCardFormProps {
  amount: number;
  onSubmit: (cardDetails: CardDetails) => Promise<void>;
  onCancel: () => void;
  isProcessing: boolean;
}

export interface CardDetails {
  cardNumber: string;
  cardHolder: string;
  expiryDate: string;
  cvv: string;
}

// Credit card form enhancement styles
const cardFormStyles = `
  @keyframes gradient {
    0% { background-position: 0% 50%; }
    50% { background-position: 100% 50%; }
    100% { background-position: 0% 50%; }
  }
  
  .card-gradient {
    background: linear-gradient(-45deg, #3b82f6, #6366f1, #8b5cf6, #ec4899);
    background-size: 400% 400%;
    animation: gradient 15s ease infinite;
  }
  
  .card-glass {
    backdrop-filter: blur(16px);
    -webkit-backdrop-filter: blur(16px);
    background: rgba(255, 255, 255, 0.15);
    border: 1px solid rgba(255, 255, 255, 0.2);
  }
  
  .card-chip {
    background: linear-gradient(135deg, #ffd700 0%, #ffb700 50%, #ffd700 100%);
    border-radius: 4px;
    width: 40px;
    height: 30px;
    position: relative;
    overflow: hidden;
  }
  
  .card-chip::before {
    content: '';
    position: absolute;
    top: 5px;
    left: 3px;
    width: 34px;
    height: 20px;
    background: linear-gradient(90deg, 
      transparent 25%, 
      rgba(255, 255, 255, 0.2) 25%, 
      rgba(255, 255, 255, 0.2) 30%, 
      transparent 30%, 
      transparent 35%, 
      rgba(255, 255, 255, 0.2) 35%, 
      rgba(255, 255, 255, 0.2) 40%, 
      transparent 40%, 
      transparent 45%, 
      rgba(255, 255, 255, 0.2) 45%, 
      rgba(255, 255, 255, 0.2) 50%, 
      transparent 50%);
  }
  
  .input-focus-ring {
    transition: all 0.3s ease;
  }
  
  .input-focus-ring:focus {
    box-shadow: 0 0 0 2px rgba(99, 102, 241, 0.4);
  }
  
  .cvv-dot {
    width: 10px;
    height: 10px;
    background-color: #374151;
    border-radius: 50%;
    margin: 0 2px;
  }
  
  .card-shine {
    position: absolute;
    top: 0;
    left: -100%;
    width: 50%;
    height: 100%;
    background: linear-gradient(
      90deg, 
      transparent, 
      rgba(255, 255, 255, 0.1), 
      transparent
    );
    transform: skewX(-15deg);
    animation: card-shine 5s infinite;
  }
  
  @keyframes card-shine {
    0% { left: -100%; }
    20% { left: 100%; }
    100% { left: 100%; }
  }
  
  .shimmer {
    position: relative;
    overflow: hidden;
  }
  
  .shimmer::after {
    content: '';
    position: absolute;
    top: -50%;
    left: -50%;
    width: 200%;
    height: 200%;
    background: linear-gradient(
      60deg,
      transparent,
      rgba(255, 255, 255, 0.1),
      transparent
    );
    transform: rotate(30deg);
    animation: shimmer 3s infinite;
  }
  
  @keyframes shimmer {
    0% { transform: rotate(30deg) translateX(-100%); }
    100% { transform: rotate(30deg) translateX(100%); }
  }
`;

const CreditCardForm: React.FC<CreditCardFormProps> = ({ 
  amount, 
  onSubmit, 
  onCancel, 
  isProcessing 
}) => {
  const { user } = useUser();
  const [cardDetails, setCardDetails] = useState<CardDetails>({
    cardNumber: '',
    cardHolder: user?.username || '',
    expiryDate: '',
    cvv: ''
  });
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [cardType, setCardType] = useState<string>('');
  const [focused, setFocused] = useState<string | null>(null);
  const [flipped, setFlipped] = useState(false);

  // Detect credit card type based on first digits
  useEffect(() => {
    const number = cardDetails.cardNumber.replace(/\s/g, '');
    let type = '';
    
    // Simple card type detection based on starting digits
    if (/^4/.test(number)) type = 'visa';
    else if (/^5[1-5]/.test(number)) type = 'mastercard';
    else if (/^3[47]/.test(number)) type = 'amex';
    else if (/^6(?:011|5)/.test(number)) type = 'discover';
    else if (number.length > 0) type = 'generic';
    
    setCardType(type);
  }, [cardDetails.cardNumber]);

  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const { name, value } = e.target;
    
    // Format card number with spaces
    if (name === 'cardNumber') {
      const formattedValue = value
        .replace(/\s/g, '')
        .replace(/\D/g, '')
        .replace(/(.{4})/g, '$1 ')
        .trim();
      
      setCardDetails(prev => ({ ...prev, [name]: formattedValue }));
      return;
    }
    
    // Format expiry date
    if (name === 'expiryDate') {
      const cleaned = value.replace(/\D/g, '');
      let formatted = cleaned;
      
      if (cleaned.length > 2) {
        formatted = `${cleaned.substring(0, 2)}/${cleaned.substring(2, 4)}`;
      }
      
      setCardDetails(prev => ({ ...prev, [name]: formatted }));
      return;
    }
    
    // Format CVV
    if (name === 'cvv') {
      const formattedValue = value.replace(/\D/g, '').substring(0, 3);
      setCardDetails(prev => ({ ...prev, [name]: formattedValue }));
      return;
    }
    
    setCardDetails(prev => ({ ...prev, [name]: value }));
  };
  
  const handleFocus = (name: string) => {
    setFocused(name);
    if (name === 'cvv') {
      setFlipped(true);
    } else if (flipped) {
      setFlipped(false);
    }
  };
  
  const validateForm = (): boolean => {
    const newErrors: Record<string, string> = {};
    
    // Validate card number
    if (!cardDetails.cardNumber.replace(/\s/g, '').match(/^\d{16}$/)) {
      newErrors.cardNumber = '请输入有效的16位卡号';
    }
    
    // Validate card holder
    if (!cardDetails.cardHolder.trim()) {
      newErrors.cardHolder = '请输入持卡人姓名';
    }
    
    // Validate expiry date
    if (!cardDetails.expiryDate.match(/^(0[1-9]|1[0-2])\/([0-9]{2})$/)) {
      newErrors.expiryDate = '请输入有效的过期日期 (MM/YY)';
    } else {
      // Check if the date is not expired
      const [month, year] = cardDetails.expiryDate.split('/');
      const expiryDate = new Date(2000 + parseInt(year), parseInt(month) - 1);
      const now = new Date();
      
      if (expiryDate < now) {
        newErrors.expiryDate = '卡片已过期';
      }
    }
    
    // Validate CVV
    if (!cardDetails.cvv.match(/^\d{3}$/)) {
      newErrors.cvv = '请输入有效的3位安全码';
    }
    
    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };
  
  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!validateForm()) {
      return;
    }
    
    try {
      await onSubmit(cardDetails);
    } catch (error) {
      console.error('[CreditCardForm] Payment processing error:', error);
    }
  };
  
  // Get card logo based on type
  const getCardLogo = () => {
    switch (cardType) {
      case 'visa':
        return (
          <div className="text-blue-600 font-bold italic text-xl tracking-tighter">VISA</div>
        );
      case 'mastercard':
        return (
          <div className="flex">
            <div className="w-6 h-6 bg-red-500 rounded-full opacity-80 -mr-2"></div>
            <div className="w-6 h-6 bg-yellow-400 rounded-full opacity-80"></div>
          </div>
        );
      case 'amex':
        return (
          <div className="text-blue-600 font-bold italic text-sm">American Express</div>
        );
      case 'discover':
        return (
          <div className="text-orange-600 font-bold italic text-lg">DISCOVER</div>
        );
      default:
        return null;
    }
  };
  
  // Format card number for display
  const formatCardNumberForDisplay = () => {
    if (!cardDetails.cardNumber) return '•••• •••• •••• ••••';
    return cardDetails.cardNumber.padEnd(19, '• ').substring(0, 19);
  };
  
  return (
    <div className="max-w-md w-full mx-auto">
      {/* Add custom styles */}
      <style dangerouslySetInnerHTML={{ __html: cardFormStyles }} />
      
      <div className="bg-white dark:bg-gray-800 rounded-2xl shadow-xl overflow-hidden">
        <div className="px-6 py-8">
          <h2 className="text-2xl font-bold mb-6 text-gray-800 dark:text-white flex items-center">
            <svg className="w-6 h-6 mr-2 text-indigo-500" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m5.618-4.016A11.955 11.955 0 0112 2.944a11.955 11.955 0 01-8.618 3.04A12.02 12.02 0 003 9c0 5.591 3.824 10.29 9 11.622 5.176-1.332 9-6.03 9-11.622 0-1.042-.133-2.052-.382-3.016z" />
            </svg>
            安全支付
          </h2>
          
          {/* 3D Credit Card Preview */}
          <div className="mb-8 relative">
            <div className={`w-full h-48 rounded-xl p-6 text-white shadow-lg transition-all duration-500 overflow-hidden ${flipped ? 'rotate-y-180' : ''}`} style={{ perspective: '1000px', transformStyle: 'preserve-3d' }}>
              {/* Front of the card */}
              <div className={`absolute inset-0 backface-hidden transition-all duration-500 ${flipped ? 'opacity-0' : 'opacity-100'}`}>
                <div className="card-gradient absolute inset-0 rounded-xl"></div>
                <div className="card-glass absolute inset-0 rounded-xl"></div>
                
                {/* Card shine effect */}
                <div className="card-shine"></div>
                
                <div className="relative z-10 h-full flex flex-col justify-between">
                  <div className="flex justify-between items-start">
                    <div className="card-chip mb-6"></div>
                    {getCardLogo()}
                  </div>
                  
                  <div className="mb-6">
                    <div className="text-sm opacity-70 mb-1">Card Number</div>
                    <div className="text-xl font-mono tracking-wider">
                      {formatCardNumberForDisplay()}
                    </div>
                  </div>
                  
                  <div className="flex justify-between items-end">
                    <div>
                      <div className="text-sm opacity-70 mb-1">Card Holder</div>
                      <div className="font-medium uppercase truncate max-w-[150px]">
                        {cardDetails.cardHolder || 'YOUR NAME'}
                      </div>
                    </div>
                    
                    <div className="text-right">
                      <div className="text-sm opacity-70 mb-1">Expires</div>
                      <div>{cardDetails.expiryDate || 'MM/YY'}</div>
                    </div>
                  </div>
                </div>
              </div>
              
              {/* Back of the card */}
              <div className={`absolute inset-0 backface-hidden rotate-y-180 transition-all duration-500 ${flipped ? 'opacity-100' : 'opacity-0'}`}>
                <div className="card-gradient absolute inset-0 rounded-xl"></div>
                <div className="card-glass absolute inset-0 rounded-xl"></div>
                
                <div className="relative z-10 h-full flex flex-col justify-start pt-4">
                  <div className="w-full h-10 bg-black opacity-70 mb-6"></div>
                  
                  <div className="px-6">
                    <div className="flex items-center justify-end mb-4">
                      <div className="bg-white/80 h-8 w-3/4 flex items-center justify-end px-3">
                        <div className="font-mono text-gray-800">{cardDetails.cvv || '•••'}</div>
                      </div>
                    </div>
                    
                    <div className="mt-6 text-xs opacity-70 text-right">
                      Secure Payment System
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </div>
          
          <div className="mb-6 flex justify-between items-center bg-indigo-50 dark:bg-indigo-900/30 p-4 rounded-lg">
            <span className="text-gray-600 dark:text-gray-300 font-medium">支付金额:</span>
            <span className="text-xl font-bold text-indigo-600 dark:text-indigo-400">
              ¥{(typeof amount === 'number' ? amount : 0).toFixed(2)}
            </span>
          </div>
          
          <form onSubmit={handleSubmit}>
            <div className="space-y-4">
              <div>
                <label className="block text-gray-700 dark:text-gray-300 text-sm font-semibold mb-2" htmlFor="cardNumber">
                  卡号
                </label>
                <div className="relative">
                  <input
                    id="cardNumber"
                    name="cardNumber"
                    type="text"
                    placeholder="1234 5678 9012 3456"
                    value={cardDetails.cardNumber}
                    onChange={handleChange}
                    onFocus={() => handleFocus('cardNumber')}
                    onBlur={() => setFocused(null)}
                    className={`input-focus-ring appearance-none border rounded-lg w-full py-3 px-4 pr-10 text-gray-700 dark:text-gray-200 dark:bg-gray-700 dark:border-gray-600 leading-tight focus:outline-none ${
                      errors.cardNumber ? 'border-red-500' : 'border-gray-300 dark:border-gray-600'
                    }`}
                    maxLength={19}
                    disabled={isProcessing}
                  />
                  {cardType && (
                    <div className="absolute inset-y-0 right-0 flex items-center pr-3 pointer-events-none">
                      {getCardLogo()}
                    </div>
                  )}
                </div>
                {errors.cardNumber && (
                  <p className="text-red-500 text-xs mt-1">{errors.cardNumber}</p>
                )}
              </div>
              
              <div>
                <label className="block text-gray-700 dark:text-gray-300 text-sm font-semibold mb-2" htmlFor="cardHolder">
                  持卡人姓名
                </label>
                <input
                  id="cardHolder"
                  name="cardHolder"
                  type="text"
                  placeholder="张三"
                  value={cardDetails.cardHolder}
                  onChange={handleChange}
                  onFocus={() => handleFocus('cardHolder')}
                  onBlur={() => setFocused(null)}
                  className={`input-focus-ring appearance-none border rounded-lg w-full py-3 px-4 text-gray-700 dark:text-gray-200 dark:bg-gray-700 dark:border-gray-600 leading-tight focus:outline-none ${
                    errors.cardHolder ? 'border-red-500' : 'border-gray-300 dark:border-gray-600'
                  }`}
                  disabled={isProcessing}
                />
                {errors.cardHolder && (
                  <p className="text-red-500 text-xs mt-1">{errors.cardHolder}</p>
                )}
              </div>
              
              <div className="flex space-x-4">
                <div className="w-1/2">
                  <label className="block text-gray-700 dark:text-gray-300 text-sm font-semibold mb-2" htmlFor="expiryDate">
                    过期日期
                  </label>
                  <input
                    id="expiryDate"
                    name="expiryDate"
                    type="text"
                    placeholder="MM/YY"
                    value={cardDetails.expiryDate}
                    onChange={handleChange}
                    onFocus={() => handleFocus('expiryDate')}
                    onBlur={() => setFocused(null)}
                    className={`input-focus-ring appearance-none border rounded-lg w-full py-3 px-4 text-gray-700 dark:text-gray-200 dark:bg-gray-700 dark:border-gray-600 leading-tight focus:outline-none ${
                      errors.expiryDate ? 'border-red-500' : 'border-gray-300 dark:border-gray-600'
                    }`}
                    maxLength={5}
                    disabled={isProcessing}
                  />
                  {errors.expiryDate && (
                    <p className="text-red-500 text-xs mt-1">{errors.expiryDate}</p>
                  )}
                </div>
                
                <div className="w-1/2">
                  <label className="block text-gray-700 dark:text-gray-300 text-sm font-semibold mb-2" htmlFor="cvv">
                    安全码
                  </label>
                  <input
                    id="cvv"
                    name="cvv"
                    type="text"
                    placeholder="123"
                    value={cardDetails.cvv}
                    onChange={handleChange}
                    onFocus={() => handleFocus('cvv')}
                    onBlur={() => setFocused(null)}
                    className={`input-focus-ring appearance-none border rounded-lg w-full py-3 px-4 text-gray-700 dark:text-gray-200 dark:bg-gray-700 dark:border-gray-600 leading-tight focus:outline-none ${
                      errors.cvv ? 'border-red-500' : 'border-gray-300 dark:border-gray-600'
                    }`}
                    maxLength={3}
                    disabled={isProcessing}
                  />
                  {errors.cvv && (
                    <p className="text-red-500 text-xs mt-1">{errors.cvv}</p>
                  )}
                </div>
              </div>
            </div>
            
            <div className="mt-8 flex justify-between">
              <button
                type="button"
                onClick={onCancel}
                className="inline-flex items-center px-4 py-2 border border-gray-300 dark:border-gray-600 rounded-lg shadow-sm text-gray-700 dark:text-gray-300 bg-white dark:bg-gray-700 hover:bg-gray-50 dark:hover:bg-gray-600 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-indigo-500 transition-colors"
                disabled={isProcessing}
              >
                <svg className="w-5 h-5 mr-2" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                </svg>
                取消
              </button>
              
              <button
                type="submit"
                className={`inline-flex items-center px-6 py-2 border border-transparent rounded-lg shadow-sm text-white bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-700 hover:to-indigo-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-indigo-500 transition-all ${
                  isProcessing ? 'opacity-70 cursor-not-allowed' : ''
                }`}
                disabled={isProcessing}
              >
                {isProcessing ? (
                  <>
                    <svg className="animate-spin -ml-1 mr-2 h-4 w-4 text-white" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                      <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                      <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                    </svg>
                    处理中...
                  </>
                ) : (
                  <>
                    <svg className="w-5 h-5 mr-2" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
                    </svg>
                    确认支付
                  </>
                )}
              </button>
            </div>
          </form>
          
          <div className="mt-6 flex items-center justify-center space-x-4 text-sm text-gray-500 dark:text-gray-400">
            <div className="flex items-center">
              <svg className="w-4 h-4 mr-1" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z" />
              </svg>
              安全支付
            </div>
            <div className="flex items-center">
              <svg className="w-4 h-4 mr-1" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m5.618-4.016A11.955 11.955 0 0112 2.944a11.955 11.955 0 01-8.618 3.04A12.02 12.02 0 003 9c0 5.591 3.824 10.29 9 11.622 5.176-1.332 9-6.03 9-11.622 0-1.042-.133-2.052-.382-3.016z" />
              </svg>
              数据加密
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default CreditCardForm; 