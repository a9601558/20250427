import React, { useState, useEffect } from 'react';
import { toast } from 'react-toastify';
import { redeemCodeService, questionSetService } from '../services/api';
import { QuestionSet } from '../types';

const RedeemCodeAdmin: React.FC = () => {
  const [questionSets, setQuestionSets] = useState<QuestionSet[]>([]);
  const [selectedQuestionSetId, setSelectedQuestionSetId] = useState('');
  const [validityDays, setValidityDays] = useState(180); // 默认6个月
  const [quantity, setQuantity] = useState(1);
  const [redeemCodes, setRedeemCodes] = useState<any[]>([]);
  const [isGenerating, setIsGenerating] = useState(false);
  const [isLoading, setIsLoading] = useState(true);
  const [showGeneratedCodes, setShowGeneratedCodes] = useState(false);
  const [generatedCodes, setGeneratedCodes] = useState<any[]>([]);

  // 加载题库和兑换码列表
  useEffect(() => {
    const loadData = async () => {
      try {
        setIsLoading(true);
        
        // 获取题库列表
        const questionSetsResponse = await questionSetService.getAllQuestionSets();
        if (questionSetsResponse.success && questionSetsResponse.data) {
          // 过滤出付费题库
          const paidQuestionSets = questionSetsResponse.data.filter(qs => qs.isPaid);
          setQuestionSets(paidQuestionSets);
          
          if (paidQuestionSets.length > 0) {
            setSelectedQuestionSetId(paidQuestionSets[0].id);
          }
        }
        
        // 获取兑换码列表
        const redeemCodesResponse = await redeemCodeService.getAllRedeemCodes();
        if (redeemCodesResponse.success && redeemCodesResponse.data) {
          setRedeemCodes(redeemCodesResponse.data as any[]);
        }
      } catch (error) {
        console.error('データの読み込みに失敗:', error);
        toast.error('データの読み込みに失敗しました。ページを更新して再試行してください');
      } finally {
        setIsLoading(false);
      }
    };
    
    loadData();
  }, []);
  
  // 生成兑换码
  const handleGenerateCodes = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!selectedQuestionSetId) {
      toast.error('問題集を選択してください');
      return;
    }
    
    if (validityDays < 1) {
      toast.error('有効期限は最低1日必要です');
      return;
    }
    
    if (quantity < 1 || quantity > 100) {
      toast.error('生成数は1～100の範囲で入力してください');
      return;
    }
    
    try {
      setIsGenerating(true);
      
      const response = await redeemCodeService.generateRedeemCodes(
        selectedQuestionSetId,
        validityDays,
        quantity
      );
      
      if (response.success && response.data) {
        // 更新兑换码列表
        const newCodes = response.data as any[];
        setRedeemCodes(prev => [...newCodes, ...prev]);
        setGeneratedCodes(newCodes);
        setShowGeneratedCodes(true);
        toast.success(`${quantity}個の引き換えコードを正常に生成しました`);
      } else {
        throw new Error(response.message || '引き換えコードの生成に失敗しました');
      }
    } catch (error: any) {
      console.error('引き換えコードの生成に失敗:', error);
      toast.error(error.message || '引き換えコードの生成に失敗しました。再試行してください');
    } finally {
      setIsGenerating(false);
    }
  };
  
  // 复制兑换码到剪贴板
  const copyToClipboard = (text: string) => {
    navigator.clipboard.writeText(text)
      .then(() => toast.success('クリップボードにコピーしました'))
      .catch(err => {
        console.error('コピーに失敗:', err);
        toast.error('コピーに失敗しました');
      });
  };
  
  // 删除兑换码
  const handleDeleteCode = async (codeId: string) => {
    try {
      const response = await redeemCodeService.deleteRedeemCode(codeId);
      
      if (response.success) {
        setRedeemCodes(prev => prev.filter(code => code.id !== codeId));
        toast.success('引き換えコードを削除しました');
      } else {
        throw new Error(response.message || '引き換えコードの削除に失敗しました');
      }
    } catch (error: any) {
      console.error('引き換えコードの削除に失敗:', error);
      toast.error(error.message || '引き換えコードの削除に失敗しました');
    }
  };
  
  // 格式化日期
  const formatDate = (dateString: string) => {
    const options: Intl.DateTimeFormatOptions = { 
      year: 'numeric', 
      month: 'short', 
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit'
    };
    return new Date(dateString).toLocaleDateString('ja-JP', options);
  };
  
  // 根据题库ID获取题库标题
  const getQuestionSetTitle = (questionSetId: string) => {
    const questionSet = questionSets.find(qs => qs.id === questionSetId);
    return questionSet ? questionSet.title : '不明な問題集';
  };
  
  if (isLoading) {
    return (
      <div className="flex justify-center items-center min-h-screen">
        <div className="animate-spin rounded-full h-12 w-12 border-t-2 border-b-2 border-blue-500"></div>
      </div>
    );
  }
  
  return (
    <div className="p-6">
      <h1 className="text-2xl font-bold mb-6">引き換えコード管理</h1>
      
      {/* 引き換えコード生成フォーム */}
      <div className="bg-white p-6 rounded-lg shadow mb-8">
        <h2 className="text-lg font-semibold mb-4">引き換えコードを生成</h2>
        
        <form onSubmit={handleGenerateCodes}>
          <div className="grid gap-6 md:grid-cols-4">
            <div className="md:col-span-2">
              <label className="block text-sm font-medium text-gray-700 mb-1">
                問題集を選択
              </label>
              <select
                value={selectedQuestionSetId}
                onChange={e => setSelectedQuestionSetId(e.target.value)}
                className="block w-full py-2 px-3 border border-gray-300 bg-white dark:bg-gray-700 dark:text-gray-200 dark:border-gray-600 rounded-md shadow-sm focus:outline-none focus:ring-blue-500 focus:border-blue-500"
                required
              >
                <option value="">問題集を選択</option>
                {questionSets.map(qs => (
                  <option key={qs.id} value={qs.id}>{qs.title}</option>
                ))}
              </select>
            </div>
            
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                有効期限（日）
              </label>
              <input
                type="number"
                value={validityDays}
                onChange={e => setValidityDays(parseInt(e.target.value))}
                min="1"
                max="3650"
                className="block w-full py-2 px-3 border border-gray-300 bg-white dark:bg-gray-700 dark:text-gray-200 dark:border-gray-600 rounded-md shadow-sm focus:outline-none focus:ring-blue-500 focus:border-blue-500"
                required
              />
            </div>
            
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                生成数
              </label>
              <input
                type="number"
                value={quantity}
                onChange={e => setQuantity(parseInt(e.target.value))}
                min="1"
                max="100"
                className="block w-full py-2 px-3 border border-gray-300 bg-white dark:bg-gray-700 dark:text-gray-200 dark:border-gray-600 rounded-md shadow-sm focus:outline-none focus:ring-blue-500 focus:border-blue-500"
                required
              />
            </div>
          </div>
          
          <div className="mt-4">
            <button
              type="submit"
              disabled={isGenerating}
              className={`inline-flex justify-center py-2 px-4 border border-transparent shadow-sm text-sm font-medium rounded-md text-white bg-blue-600 hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500 ${
                isGenerating ? 'opacity-70 cursor-not-allowed' : ''
              }`}
            >
              {isGenerating ? '生成中...' : '引き換えコードを生成'}
            </button>
          </div>
        </form>
      </div>
      
      {/* 新生成的兑换码列表 */}
      {showGeneratedCodes && generatedCodes.length > 0 && (
        <div className="bg-green-50 border border-green-200 p-4 rounded-lg mb-8">
          <div className="flex justify-between items-center mb-4">
            <h2 className="text-lg font-semibold text-green-800">新しく生成された引き換えコード</h2>
            <button
              onClick={() => setShowGeneratedCodes(false)}
              className="text-green-800 hover:text-green-900"
            >
              <svg className="h-5 w-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M6 18L18 6M6 6l12 12" />
              </svg>
            </button>
          </div>
          
          <div className="overflow-x-auto">
            <table className="min-w-full divide-y divide-green-200">
              <thead>
                <tr>
                  <th className="px-6 py-3 text-left text-xs font-medium text-green-800 uppercase tracking-wider">兑换码</th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-green-800 uppercase tracking-wider">题库</th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-green-800 uppercase tracking-wider">有效期</th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-green-800 uppercase tracking-wider">状态</th>
                  <th className="px-6 py-3 text-right text-xs font-medium text-green-800 uppercase tracking-wider">操作</th>
                </tr>
              </thead>
              <tbody className="bg-white divide-y divide-green-200">
                {generatedCodes.map(code => (
                  <tr key={code.id} className="hover:bg-green-50">
                    <td className="px-6 py-4 whitespace-nowrap text-sm font-medium text-gray-900">{code.code}</td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">{getQuestionSetTitle(code.questionSetId)}</td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">{code.expiryDate ? formatDate(code.expiryDate) : '未设置'}</td>
                    <td className="px-6 py-4 whitespace-nowrap">
                      <span className="px-2 inline-flex text-xs leading-5 font-semibold rounded-full bg-green-100 text-green-800">
                        {code.isUsed ? '已使用' : '未使用'}
                      </span>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-right text-sm font-medium">
                      <button
                        onClick={() => copyToClipboard(code.code)}
                        className="text-blue-600 hover:text-blue-900 mr-3"
                      >
                        复制
                      </button>
                      {!code.isUsed && (
                        <button
                          onClick={() => handleDeleteCode(code.id)}
                          className="text-red-600 hover:text-red-900"
                        >
                          删除
                        </button>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}
      
      {/* 所有兑换码列表 */}
      <div className="bg-white shadow overflow-hidden rounded-lg">
        <div className="px-4 py-5 sm:px-6 flex justify-between items-center">
          <h2 className="text-lg font-medium text-gray-900">所有兑换码</h2>
          <span className="text-sm text-gray-500">共 {redeemCodes.length} 个兑换码</span>
        </div>
        
        <div className="overflow-x-auto">
          <table className="min-w-full divide-y divide-gray-200">
            <thead className="bg-gray-50">
              <tr>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">兑换码</th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">题库</th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">生成日期</th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">有效期</th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">状态</th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">使用者</th>
                <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">操作</th>
              </tr>
            </thead>
            <tbody className="bg-white divide-y divide-gray-200">
              {redeemCodes.length > 0 ? (
                redeemCodes.map(code => (
                  <tr key={code.id} className="hover:bg-gray-50">
                    <td className="px-6 py-4 whitespace-nowrap text-sm font-medium text-gray-900">{code.code}</td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">{getQuestionSetTitle(code.questionSetId)}</td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">{code.createdAt ? formatDate(code.createdAt) : '-'}</td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">{code.expiryDate ? formatDate(code.expiryDate) : '-'}</td>
                    <td className="px-6 py-4 whitespace-nowrap">
                      <span className={`px-2 inline-flex text-xs leading-5 font-semibold rounded-full ${
                        code.isUsed 
                          ? 'bg-gray-100 text-gray-800' 
                          : 'bg-green-100 text-green-800'
                      }`}>
                        {code.isUsed ? '已使用' : '未使用'}
                      </span>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                      {code.usedBy ? (code.redeemUser?.username || code.usedBy) : '-'}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-right text-sm font-medium">
                      <button
                        onClick={() => copyToClipboard(code.code)}
                        className="text-blue-600 hover:text-blue-900 mr-3"
                      >
                        复制
                      </button>
                      {!code.isUsed && (
                        <button
                          onClick={() => handleDeleteCode(code.id)}
                          className="text-red-600 hover:text-red-900"
                        >
                          删除
                        </button>
                      )}
                    </td>
                  </tr>
                ))
              ) : (
                <tr>
                  <td colSpan={7} className="px-6 py-4 text-center text-sm text-gray-500">
                    暂无兑换码数据
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
};

export default RedeemCodeAdmin; 