import React, { useState } from 'react';
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
  
  return (
    <div className="bg-white p-6 rounded-lg shadow-lg max-w-md w-full">
      <h2 className="text-xl font-bold mb-4 text-gray-800">支付确认</h2>
      <div className="mb-4 p-2 bg-blue-50 rounded text-blue-700 text-sm">
        <p className="font-medium">模拟支付环境</p>
        <p>本系统使用模拟支付流程，不会产生实际费用</p>
      </div>
      
      <div className="mb-6 flex justify-between items-center">
        <span className="text-gray-600">支付金额:</span>
        <span className="text-xl font-bold text-green-600">¥{amount.toFixed(2)}</span>
      </div>
      
      <form onSubmit={handleSubmit}>
        <div className="mb-4">
          <label className="block text-gray-700 text-sm font-bold mb-2" htmlFor="cardNumber">
            卡号
          </label>
          <input
            id="cardNumber"
            name="cardNumber"
            type="text"
            placeholder="1234 5678 9012 3456"
            value={cardDetails.cardNumber}
            onChange={handleChange}
            className={`shadow appearance-none border rounded w-full py-2 px-3 text-gray-700 leading-tight focus:outline-none focus:shadow-outline ${
              errors.cardNumber ? 'border-red-500' : ''
            }`}
            maxLength={19}
            disabled={isProcessing}
          />
          {errors.cardNumber && (
            <p className="text-red-500 text-xs italic">{errors.cardNumber}</p>
          )}
        </div>
        
        <div className="mb-4">
          <label className="block text-gray-700 text-sm font-bold mb-2" htmlFor="cardHolder">
            持卡人姓名
          </label>
          <input
            id="cardHolder"
            name="cardHolder"
            type="text"
            placeholder="张三"
            value={cardDetails.cardHolder}
            onChange={handleChange}
            className={`shadow appearance-none border rounded w-full py-2 px-3 text-gray-700 leading-tight focus:outline-none focus:shadow-outline ${
              errors.cardHolder ? 'border-red-500' : ''
            }`}
            disabled={isProcessing}
          />
          {errors.cardHolder && (
            <p className="text-red-500 text-xs italic">{errors.cardHolder}</p>
          )}
        </div>
        
        <div className="flex mb-6">
          <div className="w-1/2 pr-2">
            <label className="block text-gray-700 text-sm font-bold mb-2" htmlFor="expiryDate">
              过期日期
            </label>
            <input
              id="expiryDate"
              name="expiryDate"
              type="text"
              placeholder="MM/YY"
              value={cardDetails.expiryDate}
              onChange={handleChange}
              className={`shadow appearance-none border rounded w-full py-2 px-3 text-gray-700 leading-tight focus:outline-none focus:shadow-outline ${
                errors.expiryDate ? 'border-red-500' : ''
              }`}
              maxLength={5}
              disabled={isProcessing}
            />
            {errors.expiryDate && (
              <p className="text-red-500 text-xs italic">{errors.expiryDate}</p>
            )}
          </div>
          
          <div className="w-1/2 pl-2">
            <label className="block text-gray-700 text-sm font-bold mb-2" htmlFor="cvv">
              安全码
            </label>
            <input
              id="cvv"
              name="cvv"
              type="text"
              placeholder="123"
              value={cardDetails.cvv}
              onChange={handleChange}
              className={`shadow appearance-none border rounded w-full py-2 px-3 text-gray-700 leading-tight focus:outline-none focus:shadow-outline ${
                errors.cvv ? 'border-red-500' : ''
              }`}
              maxLength={3}
              disabled={isProcessing}
            />
            {errors.cvv && (
              <p className="text-red-500 text-xs italic">{errors.cvv}</p>
            )}
          </div>
        </div>
        
        <div className="flex justify-between">
          <button
            type="button"
            onClick={onCancel}
            className="bg-gray-300 hover:bg-gray-400 text-gray-800 font-bold py-2 px-4 rounded focus:outline-none focus:shadow-outline"
            disabled={isProcessing}
          >
            取消
          </button>
          
          <button
            type="submit"
            className={`bg-blue-500 hover:bg-blue-700 text-white font-bold py-2 px-4 rounded focus:outline-none focus:shadow-outline ${
              isProcessing ? 'opacity-50 cursor-not-allowed' : ''
            }`}
            disabled={isProcessing}
          >
            {isProcessing ? '处理中...' : '确认支付'}
          </button>
        </div>
      </form>
    </div>
  );
};

export default CreditCardForm; 