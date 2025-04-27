import React, { useState, useEffect } from 'react';
import { useUser } from '../../contexts/UserContext';
import { RedeemCode } from '../../types';
import { questionSets, QuestionSet } from '../../data/questionSets';

const AdminRedeemCodes: React.FC = () => {
  const { generateRedeemCode, getRedeemCodes } = useUser();
  const [selectedQuestionSet, setSelectedQuestionSet] = useState<string>('');
  const [validityDays, setValidityDays] = useState<number>(30);
  const [quantity, setQuantity] = useState<number>(1);
  const [paidQuestionSets, setPaidQuestionSets] = useState<QuestionSet[]>([]);
  const [redeemCodes, setRedeemCodes] = useState<RedeemCode[]>([]);
  const [statusMessage, setStatusMessage] = useState<{ type: string; message: string }>({ type: '', message: '' });
  const [filterStatus, setFilterStatus] = useState<'all' | 'used' | 'unused'>('all');
  const [filterQuestionSet, setFilterQuestionSet] = useState<string>('all');
  const [isLoading, setIsLoading] = useState<boolean>(false);

  // Get paid question sets
  useEffect(() => {
    const paidSets = questionSets.filter(set => set.isPaid);
    setPaidQuestionSets(paidSets);
  }, []);

  // Get redeem codes
  useEffect(() => {
    const fetchRedeemCodes = async () => {
      try {
        setIsLoading(true);
        const codes = await getRedeemCodes();
        setRedeemCodes(codes);
      } catch (error) {
        console.error('获取兑换码失败:', error);
        setStatusMessage({
          type: 'error',
          message: '获取兑换码失败，请刷新页面重试'
        });
      } finally {
        setIsLoading(false);
      }
    };

    fetchRedeemCodes();
  }, [getRedeemCodes]);

  // Filter redeem codes based on status and question set
  const filteredCodes = redeemCodes.filter(code => {
    if (filterStatus === 'used' && !code.usedAt) return false;
    if (filterStatus === 'unused' && code.usedAt) return false;
    if (filterQuestionSet !== 'all' && code.questionSetId !== filterQuestionSet) return false;
    return true;
  });

  // Handle generating redeem codes
  const handleGenerateCode = async () => {
    if (!selectedQuestionSet) {
      setStatusMessage({ 
        type: 'error', 
        message: '请选择题库' 
      });
      return;
    }

    if (validityDays <= 0) {
      setStatusMessage({ 
        type: 'error', 
        message: '有效期必须大于0天' 
      });
      return;
    }

    if (quantity <= 0 || quantity > 100) {
      setStatusMessage({ 
        type: 'error', 
        message: '生成数量必须在1-100之间' 
      });
      return;
    }

    try {
      setIsLoading(true);
      console.log('Generating codes with params:', {
        questionSetId: selectedQuestionSet,
        validityDays,
        quantity
      });
      
      const result = await generateRedeemCode(selectedQuestionSet, validityDays, quantity);
      
      if (!result.success) {
        throw new Error(result.message || '生成兑换码失败');
      }
      
      console.log('Code generation result:', result);
      
      // 重新获取更新后的兑换码列表
      const updatedCodes = await getRedeemCodes();
      setRedeemCodes(updatedCodes);
      
      setStatusMessage({ 
        type: 'success', 
        message: `成功生成 ${quantity} 个兑换码` 
      });
    } catch (error: any) {
      console.error('生成兑换码失败:', error);
      setStatusMessage({ 
        type: 'error', 
        message: error.message || '生成兑换码失败，请重试' 
      });
    } finally {
      setIsLoading(false);
    }
  };

  // Copy code to clipboard
  const copyToClipboard = (code: string) => {
    navigator.clipboard.writeText(code).then(
      () => {
        setStatusMessage({ 
          type: 'success', 
          message: '兑换码已复制到剪贴板' 
        });
        
        // Clear message after 3 seconds
        setTimeout(() => {
          setStatusMessage({ type: '', message: '' });
        }, 3000);
      },
      () => {
        setStatusMessage({ 
          type: 'error', 
          message: '复制失败，请手动复制' 
        });
      }
    );
  };

  // Format date
  const formatDate = (date: string | Date) => {
    if (!date) return '';
    return new Date(date).toLocaleString();
  };

  // Get question set title by ID
  const getQuestionSetTitle = (id: string) => {
    const set = paidQuestionSets.find(s => s.id === id);
    return set ? set.title : id;
  };

  return (
    <div className="p-6">
      <h2 className="text-xl font-semibold text-gray-800 mb-6">兑换码管理</h2>
      
      {/* Status Message */}
      {statusMessage.message && (
        <div className={`mb-4 p-3 rounded-md ${
          statusMessage.type === 'success' 
            ? 'bg-green-50 text-green-800 border border-green-200' 
            : 'bg-red-50 text-red-800 border border-red-200'
        }`}>
          {statusMessage.message}
        </div>
      )}

      {/* Create Redeem Code Form */}
      <div className="bg-white p-6 rounded-lg shadow-md mb-6">
        <h3 className="text-lg font-medium text-gray-900 mb-4">生成兑换码</h3>
        <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
          <div>
            <label htmlFor="questionSet" className="block text-sm font-medium text-gray-700 mb-1">
              选择题库
            </label>
            <select
              id="questionSet"
              value={selectedQuestionSet}
              onChange={(e) => setSelectedQuestionSet(e.target.value)}
              className="w-full border-gray-300 rounded-md shadow-sm focus:ring-indigo-500 focus:border-indigo-500"
              disabled={isLoading}
            >
              <option value="">-- 请选择题库 --</option>
              {paidQuestionSets.map(set => (
                <option key={set.id} value={set.id}>{set.title}</option>
              ))}
            </select>
          </div>
          
          <div>
            <label htmlFor="validityDays" className="block text-sm font-medium text-gray-700 mb-1">
              有效期（天）
            </label>
            <input
              type="number"
              id="validityDays"
              value={validityDays}
              onChange={(e) => setValidityDays(parseInt(e.target.value))}
              min="1"
              max="365"
              className="w-full border-gray-300 rounded-md shadow-sm focus:ring-indigo-500 focus:border-indigo-500"
              disabled={isLoading}
            />
          </div>
          
          <div>
            <label htmlFor="quantity" className="block text-sm font-medium text-gray-700 mb-1">
              生成数量
            </label>
            <input
              type="number"
              id="quantity"
              value={quantity}
              onChange={(e) => setQuantity(parseInt(e.target.value))}
              min="1"
              max="100"
              className="w-full border-gray-300 rounded-md shadow-sm focus:ring-indigo-500 focus:border-indigo-500"
              disabled={isLoading}
            />
          </div>
          
          <div className="flex items-end">
            <button
              onClick={handleGenerateCode}
              className="w-full bg-indigo-600 text-white py-2 px-4 rounded-md hover:bg-indigo-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-indigo-500 disabled:bg-indigo-400 disabled:cursor-not-allowed"
              disabled={isLoading}
            >
              {isLoading ? '处理中...' : '生成兑换码'}
            </button>
          </div>
        </div>
      </div>
      
      {/* Redeem Codes List */}
      <div className="bg-white p-6 rounded-lg shadow-md">
        <div className="flex justify-between items-center mb-4">
          <h3 className="text-lg font-medium text-gray-900">兑换码列表</h3>
          
          <div className="flex space-x-2">
            <select
              value={filterStatus}
              onChange={(e) => setFilterStatus(e.target.value as 'all' | 'used' | 'unused')}
              className="border-gray-300 rounded-md shadow-sm focus:ring-indigo-500 focus:border-indigo-500"
              disabled={isLoading}
            >
              <option value="all">所有状态</option>
              <option value="used">已使用</option>
              <option value="unused">未使用</option>
            </select>
            
            <select
              value={filterQuestionSet}
              onChange={(e) => setFilterQuestionSet(e.target.value)}
              className="border-gray-300 rounded-md shadow-sm focus:ring-indigo-500 focus:border-indigo-500"
              disabled={isLoading}
            >
              <option value="all">所有题库</option>
              {paidQuestionSets.map(set => (
                <option key={set.id} value={set.id}>{set.title}</option>
              ))}
            </select>
          </div>
        </div>
        
        {isLoading ? (
          <div className="text-center py-8">
            <div className="inline-block animate-spin rounded-full h-8 w-8 border-t-2 border-b-2 border-indigo-600"></div>
            <p className="mt-2 text-gray-600">加载中...</p>
          </div>
        ) : filteredCodes.length === 0 ? (
          <div className="text-center py-8 text-gray-500">
            没有符合条件的兑换码
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="min-w-full divide-y divide-gray-200">
              <thead className="bg-gray-50">
                <tr>
                  <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    兑换码
                  </th>
                  <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    题库
                  </th>
                  <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    有效期(天)
                  </th>
                  <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    创建时间
                  </th>
                  <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    状态
                  </th>
                  <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    使用时间
                  </th>
                  <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    操作
                  </th>
                </tr>
              </thead>
              <tbody className="bg-white divide-y divide-gray-200">
                {filteredCodes.map((code) => (
                  <tr key={code.code}>
                    <td className="px-6 py-4 whitespace-nowrap">
                      <div className="text-sm font-medium text-gray-900">
                        {code.code}
                      </div>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap">
                      <div className="text-sm text-gray-900">
                        {getQuestionSetTitle(code.questionSetId)}
                      </div>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap">
                      <div className="text-sm text-gray-500">
                        {code.validityDays}
                      </div>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap">
                      <div className="text-sm text-gray-500">
                        {formatDate(code.createdAt)}
                      </div>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap">
                      {code.usedAt ? (
                        <span className="px-2 py-1 inline-flex text-xs leading-5 font-semibold rounded-full bg-red-100 text-red-800">
                          已使用
                        </span>
                      ) : (
                        <span className="px-2 py-1 inline-flex text-xs leading-5 font-semibold rounded-full bg-green-100 text-green-800">
                          未使用
                        </span>
                      )}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap">
                      <div className="text-sm text-gray-500">
                        {code.usedAt ? formatDate(code.usedAt) : '-'}
                      </div>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm font-medium">
                      {!code.usedAt && (
                        <button
                          onClick={() => copyToClipboard(code.code)}
                          className="text-indigo-600 hover:text-indigo-900"
                          disabled={isLoading}
                        >
                          复制
                        </button>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
};

export default AdminRedeemCodes; 