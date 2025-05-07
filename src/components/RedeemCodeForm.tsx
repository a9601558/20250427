import React, { useState, useEffect, useRef } from 'react';
import { useUser } from '../contexts/UserContext';
import { questionSetApi } from '../utils/api';
import { toast } from 'react-toastify';
import { QuestionSet } from '../types';

// 扩展返回类型以匹配实际使用
interface RedeemCodeResult {
  success: boolean;
  message: string;
  questionSetId?: string;
  quizTitle?: string;
  expiryDate?: string;
}

interface RedeemCodeFormProps {
  onRedeemSuccess?: (questionSetId: string) => void;
  questionSetId?: string;
}

const RedeemCodeForm: React.FC<RedeemCodeFormProps> = ({ onRedeemSuccess, questionSetId }) => {
  const [redeemCode, setRedeemCode] = useState('');
  const [status, setStatus] = useState<'idle' | 'loading' | 'success' | 'error'>('idle');
  const [message, setMessage] = useState('');
  const [redeemedSet, setRedeemedSet] = useState<any>(null);
  const [questionSets, setQuestionSets] = useState<QuestionSet[]>([]);
  const eventTimeoutRef = useRef<NodeJS.Timeout | null>(null);
  
  const { redeemCode: redeemCodeFunction } = useUser();
  
  // 清理计时器
  useEffect(() => {
    return () => {
      if (eventTimeoutRef.current) {
        clearTimeout(eventTimeoutRef.current);
      }
    };
  }, []);
  
  // 加载题库数据
  useEffect(() => {
    const loadQuestionSets = async () => {
      try {
        const response = await questionSetApi.getAllQuestionSets();
        if (response.success && response.data) {
          setQuestionSets(response.data);
        }
      } catch (error) {
        console.error('加载题库失败:', error);
      }
    };
    
    loadQuestionSets();
  }, []);
  
  const handleRedeemCode = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!redeemCode.trim()) {
      setStatus('error');
      setMessage('请输入兑换码');
      return;
    }
    
    // 防止重复点击
    if (status === 'loading') {
      return;
    }
    
    // 重置状态
    setStatus('loading');
    setMessage('正在验证兑换码...');
    
    try {
      const formattedCode = redeemCode.trim().toUpperCase();
      console.log('[RedeemCodeForm] 开始兑换码:', formattedCode);
      
      // 调用 UserContext 中的 redeemCode 函数，并将结果类型扩展为 RedeemCodeResult
      const result = await redeemCodeFunction(formattedCode) as RedeemCodeResult;
      
      console.log('[RedeemCodeForm] 兑换结果:', result);
      
      if (result.success) {
        setStatus('success');
        setMessage(result.message || '兑换成功！');
        
        // 查找已兑换的题库信息
        if (result.questionSetId) {
          console.log('[RedeemCodeForm] 找到题库ID:', result.questionSetId);
          
          // 立即将访问权限写入本地存储，确保权限立即生效
          localStorage.setItem(`quiz_access_${result.questionSetId}`, JSON.stringify({
            hasAccess: true,
            timestamp: Date.now(),
            expiryDate: result.expiryDate,
            source: 'redeem'
          }));
          
          // 保存已兑换题库ID
          const redeemedSets = JSON.parse(localStorage.getItem('redeemedQuestionSets') || '[]');
          if (!redeemedSets.includes(result.questionSetId)) {
            redeemedSets.push(result.questionSetId);
            localStorage.setItem('redeemedQuestionSets', JSON.stringify(redeemedSets));
          }
          
          // 找到题库详情
          const set = questionSets.find(s => s.id === result.questionSetId);
          
          if (set) {
            setRedeemedSet({
              ...set,
              title: result.quizTitle || set.title,
              expiryDate: result.expiryDate
            });
            
            // 全局发送兑换成功事件，强制刷新
            if (typeof window !== 'undefined') {
              console.log('[RedeemCodeForm] 发送全局兑换成功事件');
              
              // 确保事件细节完整
              const eventDetail = { 
                questionSetId: result.questionSetId,
                forceRefresh: true,
                timestamp: Date.now(),
                expiryDate: result.expiryDate
              };
              
              // 立即分发事件
              window.dispatchEvent(new CustomEvent('redeem:success', { 
                detail: eventDetail
              }));
              
              // 确保事件被处理 - 延迟再次分发以防止事件丢失
              eventTimeoutRef.current = setTimeout(() => {
                window.dispatchEvent(new CustomEvent('redeem:success', { 
                  detail: eventDetail
                }));
                
                // 显示统一成功提示
                toast.success('兑换成功！您现在可以访问完整题库');
                
                // 调用成功回调函数
                if (onRedeemSuccess) {
                  onRedeemSuccess(result.questionSetId!);
                }
              }, 500);
            } else {
              if (onRedeemSuccess) {
                onRedeemSuccess(result.questionSetId!);
              }
            }
          } else {
            // 如果本地找不到题库信息，使用 API 返回的信息
            console.log('[RedeemCodeForm] 本地未找到题库，使用API返回的信息');
            setRedeemedSet({
              id: result.questionSetId,
              title: result.quizTitle || '已兑换的题库',
              icon: '📚',
              expiryDate: result.expiryDate
            });
            
            // 全局发送兑换成功事件，强制刷新
            if (typeof window !== 'undefined') {
              console.log('[RedeemCodeForm] 发送全局兑换成功事件');
              const eventDetail = { 
                questionSetId: result.questionSetId,
                forceRefresh: true, 
                timestamp: Date.now(),
                expiryDate: result.expiryDate
              };
              
              window.dispatchEvent(new CustomEvent('redeem:success', { 
                detail: eventDetail
              }));
              
              // 确保事件被处理 - 延迟再次分发
              eventTimeoutRef.current = setTimeout(() => {
                window.dispatchEvent(new CustomEvent('redeem:success', { 
                  detail: eventDetail
                }));
                
                // 显示统一成功提示
                toast.success('兑换成功！您现在可以访问完整题库');
                
                if (onRedeemSuccess) {
                  onRedeemSuccess(result.questionSetId!);
                }
              }, 500);
            } else {
              if (onRedeemSuccess) {
                onRedeemSuccess(result.questionSetId!);
              }
            }
          }
        } else {
          // 没有题库ID，但兑换成功，显示通用消息
          toast.success('兑换成功！');
          
          if (onRedeemSuccess && questionSetId) {
            onRedeemSuccess(questionSetId);
          }
        }
      } else {
        setStatus('error');
        setMessage(result.message || '兑换失败，请检查兑换码是否正确');
        toast.error(result.message || '兑换失败，请检查兑换码是否正确');
      }
    } catch (error: any) {
      console.error('Redeem code error:', error);
      setStatus('error');
      setMessage(error.message || '兑换过程中发生错误，请稍后再试');
      toast.error('兑换失败: ' + (error.message || '请稍后再试'));
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
                <span className="text-2xl mr-2">{redeemedSet.icon || '📚'}</span>
                <span className="text-md font-medium">{redeemedSet.title}</span>
              </div>
              {redeemedSet.expiryDate && (
                <div className="mt-2 text-sm text-gray-500">
                  有效期至: {new Date(redeemedSet.expiryDate).toLocaleDateString()}
                </div>
              )}
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