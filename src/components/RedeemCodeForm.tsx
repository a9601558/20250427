import React, { useState, useEffect } from 'react';
import { useUser } from '../contexts/UserContext';
import { questionSetApi } from '../utils/api';
import { QuestionSet } from '../types';

// 扩展返回类型以匹配实际使用
interface RedeemCodeResult {
  success: boolean;
  message: string;
  questionSetId?: string;
  quizTitle?: string;
}

interface RedeemCodeFormProps {
  onRedeemSuccess?: (questionSetId: string) => void;
  questionSetId?: string;
}

const RedeemCodeForm: React.FC<RedeemCodeFormProps> = ({ onRedeemSuccess, questionSetId }) => {
  const [redeemCode, setRedeemCode] = useState('');
  const [status, setStatus] = useState<'idle' | 'loading' | 'success' | 'error' | 'warning'>('idle');
  const [message, setMessage] = useState('');
  const [redeemedSet, setRedeemedSet] = useState<any>(null);
  const [questionSets, setQuestionSets] = useState<QuestionSet[]>([]);
  
  const { redeemCode: redeemCodeFunction, syncAccessRights } = useUser();
  
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
      setMessage('引き換えコードを入力してください');
      return;
    }
    
    // 重置状态
    setStatus('loading');
    setMessage('引き換えコードを検証中...');
    
    try {
      console.log('[RedeemCodeForm] 开始兑换码:', redeemCode.trim());
      // 调用 UserContext 中的 redeemCode 函数，并将结果类型扩展为 RedeemCodeResult
      const result = await redeemCodeFunction(redeemCode.trim()) as RedeemCodeResult;
      
      console.log('[RedeemCodeForm] 兑换结果:', result);
      
      if (result.success) {
        setStatus('success');
        setMessage(result.message || '引き換え成功！');
        
        // 查找已兑换的题库信息
        if (result.questionSetId) {
          console.log('[RedeemCodeForm] 找到题库ID:', result.questionSetId);
          const set = questionSets.find(s => s.id === result.questionSetId);
          
          if (set) {
            setRedeemedSet({
              ...set,
              title: result.quizTitle || set.title
            });
            
            // 全局发送兑换成功事件，强制刷新
            if (typeof window !== 'undefined') {
              console.log('[RedeemCodeForm] 发送全局兑换成功事件');
              
              // 确保事件细节完整
              const eventDetail = { 
                questionSetId: result.questionSetId,
                forceRefresh: true,
                timestamp: Date.now()
              };
              
              // 分发事件
              window.dispatchEvent(new CustomEvent('redeem:success', { 
                detail: eventDetail
              }));
              
              // 确保事件被处理 - 延迟再次分发以防止事件丢失
              setTimeout(() => {
                window.dispatchEvent(new CustomEvent('redeem:success', { 
                  detail: eventDetail
                }));
              }, 500);
            }
            
            // 添加短暂延迟，确保状态已更新
            setTimeout(() => {
              console.log('[RedeemCodeForm] 调用成功回调');
              // 调用成功回调函数
              if (onRedeemSuccess) {
                onRedeemSuccess(result.questionSetId!);
              }
            }, 800);
          } else {
            // 如果本地找不到题库信息，使用 API 返回的信息
            console.log('[RedeemCodeForm] 本地未找到题库，使用API返回的信息');
            setRedeemedSet({
              id: result.questionSetId,
              title: result.quizTitle || '引き換え済みの問題集',
              icon: '📚'
            });
            
            // 全局发送兑换成功事件，强制刷新
            if (typeof window !== 'undefined') {
              console.log('[RedeemCodeForm] 发送全局兑换成功事件');
              window.dispatchEvent(new CustomEvent('redeem:success', { 
                detail: { 
                  questionSetId: result.questionSetId,
                  forceRefresh: true, 
                  timestamp: Date.now()
                } 
              }));
            }
            
            // 添加短暂延迟，确保状态已更新
            setTimeout(() => {
              console.log('[RedeemCodeForm] 调用成功回调');
              if (onRedeemSuccess) {
                onRedeemSuccess(result.questionSetId!);
              }
            }, 500);
          }
        }
      } else {
        setStatus('error');
        setMessage(result.message || '引き換え失敗。コードが正しいか確認してください');
      }
    } catch (error: any) {
      console.error('[RedeemCodeForm] Redeem code error:', error);
      
      // 发送一个额外的检查，因为有可能兑换码已经成功兑换但返回错误
      try {
        console.log('[RedeemCodeForm] 尝试检查兑换码可能已兑换...');
        
        // 等待一小段时间再检查，让服务器有时间完成事务
        setTimeout(async () => {
          try {
            // 刷新用户访问权限，可能会获取到新兑换的权限
            if (syncAccessRights) {
              await syncAccessRights();
            }
            
            // 通知用户可能需要刷新页面
            setStatus('warning');
            setMessage('引き換えは成功した可能性がありますが、システムエラーが発生しました。ページを更新して最新の権限を確認するか、カスタマーサポートにお問い合わせください。');
            
            // 触发全局事件以便应用程序可以刷新状态
            window.dispatchEvent(new CustomEvent('redeem:possibleSuccess', { 
              detail: { forceRefresh: true, timestamp: Date.now() }
            }));
          } catch (checkError) {
            console.error('[RedeemCodeForm] 检查兑换状态失败:', checkError);
          }
        }, 1000);
      } catch (recoveryError) {
        console.error('[RedeemCodeForm] 恢复尝试失败:', recoveryError);
      }
      
      setStatus('error');
      setMessage(typeof error === 'string' ? error : (error.message || '引き換え中にエラーが発生しました。しばらくしてから再度お試しください。問題が継続する場合は、カスタマーサポートにお問い合わせください。'));
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
                className="inline-flex items-center px-4 py-2 border border-transparent rounded-md shadow-md text-sm font-medium text-white bg-gradient-to-r from-blue-600 to-blue-700 hover:from-blue-700 hover:to-blue-800 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500 transition transform hover:-translate-y-0.5 hover:shadow-lg"
              >
                <svg className="w-4 h-4 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M14 5l7 7m0 0l-7 7m7-7H3" />
                </svg>
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
              className="block w-full px-3 py-2 border border-gray-300 text-gray-700 bg-white dark:bg-gray-700 dark:text-gray-200 dark:border-gray-600 rounded-md shadow-sm placeholder-gray-400 dark:placeholder-gray-500 focus:outline-none focus:ring-blue-500 focus:border-blue-500 text-sm"
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
              className="inline-flex justify-center px-4 py-2 border border-transparent rounded-md shadow-md text-sm font-medium text-white bg-gradient-to-r from-green-600 to-green-700 hover:from-green-700 hover:to-green-800 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-green-500 transition transform hover:-translate-y-0.5 hover:shadow-lg disabled:opacity-70 disabled:cursor-not-allowed disabled:transform-none disabled:shadow-none"
              disabled={status === 'loading'}
            >
              {status === 'loading' ? (
                <>
                  <svg className="animate-spin -ml-1 mr-2 h-4 w-4 text-white" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                    <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                    <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                  </svg>
                  处理中...
                </>
              ) : (
                <>
                  <svg className="w-4 h-4 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
                  </svg>
                  提交兑换
                </>
              )}
            </button>
          </div>
        </form>
      )}
    </div>
  );
};

export default RedeemCodeForm; 