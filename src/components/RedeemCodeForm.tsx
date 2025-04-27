import React, { useState } from 'react';
import { useUser } from '../contexts/UserContext';
import { questionSets } from '../data/questionSets';

// 扩展返回类型以匹配实际使用
interface RedeemCodeResult {
  success: boolean;
  message: string;
  quizId?: string;
  quizTitle?: string;
}

interface RedeemCodeFormProps {
  onRedeemSuccess?: (quizId: string) => void;
}

const RedeemCodeForm: React.FC<RedeemCodeFormProps> = ({ onRedeemSuccess }) => {
  const [redeemCode, setRedeemCode] = useState('');
  const [status, setStatus] = useState<'idle' | 'loading' | 'success' | 'error'>('idle');
  const [message, setMessage] = useState('');
  const [redeemedSet, setRedeemedSet] = useState<any>(null);
  
  const { redeemCode: redeemCodeFunction } = useUser();
  
  const handleRedeemCode = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!redeemCode.trim()) {
      setStatus('error');
      setMessage('请输入兑换码');
      return;
    }
    
    // 重置状态
    setStatus('loading');
    setMessage('正在验证兑换码...');
    
    try {
      // 调用 UserContext 中的 redeemCode 函数，并将结果类型扩展为 RedeemCodeResult
      const result = await redeemCodeFunction(redeemCode.trim()) as RedeemCodeResult;
      
      if (result.success) {
        setStatus('success');
        setMessage(result.message || '兑换成功！');
        
        // 查找已兑换的题库信息
        if (result.quizId) {
          const set = questionSets.find(s => s.id === result.quizId);
          
          if (set) {
            setRedeemedSet({
              ...set,
              title: result.quizTitle || set.title
            });
            
            // 调用成功回调函数
            if (onRedeemSuccess) {
              onRedeemSuccess(result.quizId);
            }
          } else {
            // 如果本地找不到题库信息，使用 API 返回的信息
            setRedeemedSet({
              id: result.quizId,
              title: result.quizTitle || '已兑换的题库',
              icon: '📚'
            });
            
            if (onRedeemSuccess) {
              onRedeemSuccess(result.quizId);
            }
          }
        }
      } else {
        setStatus('error');
        setMessage(result.message || '兑换失败，请检查兑换码是否正确');
      }
    } catch (error: any) {
      console.error('Redeem code error:', error);
      setStatus('error');
      setMessage(error.message || '兑换过程中发生错误，请稍后再试');
    }
  };
  
  const resetForm = () => {
    setRedeemCode('');
    setStatus('idle');
    setMessage('');
    setRedeemedSet(null);
  };
  
  return (
    <div className="bg-white p-4 rounded-lg shadow-sm border border-gray-100">
      {status === 'success' ? (
        <div className="text-center">
          <div className="mb-4 flex justify-center">
            <svg className="h-12 w-12 text-green-500" fill="none" stroke="currentColor" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
            </svg>
          </div>
          <h3 className="text-lg font-medium text-gray-900 mb-2">{message}</h3>
          
          {redeemedSet && (
            <div className="bg-gray-50 p-3 rounded-lg mb-4">
              <p className="text-sm font-medium text-gray-700">已获取访问权限：</p>
              <div className="flex items-center mt-2">
                <span className="text-2xl mr-2">{redeemedSet.icon}</span>
                <span className="text-md font-medium">{redeemedSet.title}</span>
              </div>
            </div>
          )}
          
          <div className="mt-4 flex justify-center space-x-4">
            <button
              onClick={resetForm}
              className="inline-flex items-center px-4 py-2 border border-gray-300 rounded-md shadow-sm text-sm font-medium text-gray-700 bg-white hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500"
            >
              继续兑换
            </button>
            
            {redeemedSet && (
              <a
                href={`/quiz/${redeemedSet.id}`}
                className="inline-flex items-center px-4 py-2 border border-transparent rounded-md shadow-sm text-sm font-medium text-white bg-blue-600 hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500"
              >
                立即开始
              </a>
            )}
          </div>
        </div>
      ) : (
        <form onSubmit={handleRedeemCode}>
          <div className="mb-4">
            <label htmlFor="redeemCode" className="block text-sm font-medium text-gray-700 mb-1">
              兑换码
            </label>
            <input
              type="text"
              id="redeemCode"
              value={redeemCode}
              onChange={(e) => setRedeemCode(e.target.value)}
              placeholder="请输入有效的兑换码"
              className="block w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm placeholder-gray-400 focus:outline-none focus:ring-blue-500 focus:border-blue-500 text-sm"
              required
              disabled={status === 'loading'}
            />
          </div>
          
          {status === 'error' && (
            <div className="mb-4 text-sm text-red-600 bg-red-50 p-2 rounded">
              {message}
            </div>
          )}
          
          {status === 'loading' && (
            <div className="mb-4 text-sm text-blue-600 bg-blue-50 p-2 rounded flex items-center">
              <svg className="animate-spin -ml-1 mr-2 h-4 w-4 text-blue-600" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
              </svg>
              {message}
            </div>
          )}
          
          <div className="text-right">
            <button
              type="submit"
              className="inline-flex justify-center px-4 py-2 border border-transparent rounded-md shadow-sm text-sm font-medium text-white bg-blue-600 hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500"
              disabled={status === 'loading'}
            >
              {status === 'loading' ? '处理中...' : '提交兑换'}
            </button>
          </div>
        </form>
      )}
    </div>
  );
};

export default RedeemCodeForm; 