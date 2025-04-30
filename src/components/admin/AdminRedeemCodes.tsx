import React, { useState, useEffect } from 'react';
import { useUser } from '../../contexts/UserContext';
import { QuestionSet } from '../../types';
import { questionSetApi } from '../../utils/api';
import axios from 'axios';

const AdminRedeemCodes: React.FC = () => {
  const { generateRedeemCode, getRedeemCodes } = useUser();
  const [redeemCodes, setRedeemCodes] = useState<any[]>([]);
  const [questionSets, setQuestionSets] = useState<QuestionSet[]>([]);
  const [selectedQuestionSetId, setSelectedQuestionSetId] = useState('');
  const [validityDays, setValidityDays] = useState(30);
  const [codeCount, setCodeCount] = useState(1);
  const [generatingCodes, setGeneratingCodes] = useState(false);
  const [statusMessage, setStatusMessage] = useState('');
  const [filterStatus, setFilterStatus] = useState<'all' | 'used' | 'unused'>('all');
  const [filterQuestionSet, setFilterQuestionSet] = useState<string>('all');
  const [editingCodeId, setEditingCodeId] = useState<string | null>(null);
  const [newQuestionSetId, setNewQuestionSetId] = useState<string>('');
  const [updatingCode, setUpdatingCode] = useState(false);

  // 加载题库和兑换码数据
  useEffect(() => {
    const loadData = async () => {
      try {
        // 加载题库数据
        const qsResponse = await questionSetApi.getAllQuestionSets();
        if (qsResponse.success && qsResponse.data) {
          setQuestionSets(qsResponse.data);
          // 过滤出付费题库
          const paidSets = qsResponse.data.filter((set: QuestionSet) => set.isPaid);
          if (paidSets.length > 0) {
            setSelectedQuestionSetId(paidSets[0].id);
          }
        }
        
        // 加载兑换码数据
        const codes = await getRedeemCodes();
        setRedeemCodes(codes);
      } catch (error) {
        console.error('加载数据失败:', error);
        setStatusMessage('加载数据失败');
      }
    };
    
    loadData();
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
    if (!selectedQuestionSetId) {
      setStatusMessage('请选择题库');
      return;
    }

    if (validityDays <= 0) {
      setStatusMessage('有效期必须大于0天');
      return;
    }
    
    if (codeCount <= 0 || codeCount > 100) {
      setStatusMessage('生成数量必须在1-100之间');
      return;
    }

    setGeneratingCodes(true);
    
    try {
      const result = await generateRedeemCode(selectedQuestionSetId, validityDays, codeCount);
      
      if (!result.success) {
        throw new Error(result.message || '生成兑换码失败');
      }
      
      const updatedCodes = await getRedeemCodes();
      setRedeemCodes(updatedCodes);
      
      setStatusMessage(`成功生成 ${codeCount} 个兑换码`);
    } catch (error: any) {
      console.error('生成兑换码失败:', error);
      setStatusMessage(error.message || '生成兑换码失败，请重试');
    } finally {
      setGeneratingCodes(false);
    }
  };

  // Copy code to clipboard
  const copyToClipboard = (code: string) => {
    navigator.clipboard.writeText(code).then(
      () => {
        setStatusMessage('兑换码已复制到剪贴板');
        
        // Clear message after 3 seconds
        setTimeout(() => {
          setStatusMessage('');
        }, 3000);
      },
      () => {
        setStatusMessage('复制失败，请手动复制');
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
    const set = questionSets.find(s => s.id === id);
    return set ? set.title : id;
  };

  // 开始编辑兑换码
  const startEditCode = (codeId: string, currentQuestionSetId: string) => {
    setEditingCodeId(codeId);
    setNewQuestionSetId(currentQuestionSetId);
  };

  // 取消编辑
  const cancelEditCode = () => {
    setEditingCodeId(null);
    setNewQuestionSetId('');
  };

  // 修复兑换码的题库ID
  const updateRedeemCodeQuestionSet = async (codeId: string) => {
    if (!newQuestionSetId) {
      setStatusMessage('请选择有效的题库');
      return;
    }

    setUpdatingCode(true);
    try {
      // 获取token用于验证
      const token = localStorage.getItem('token');
      
      const response = await axios.put(
        `/api/redeem-codes/${codeId}/fix-question-set`, 
        { questionSetId: newQuestionSetId },
        { headers: { Authorization: `Bearer ${token}` } }
      );
      
      if (response.data.success) {
        // 刷新兑换码列表
        const updatedCodes = await getRedeemCodes();
        setRedeemCodes(updatedCodes);
        setStatusMessage('兑换码题库关联已成功修复');
        setEditingCodeId(null);
      } else {
        setStatusMessage(response.data.message || '修复兑换码关联失败');
      }
    } catch (error: any) {
      console.error('修复兑换码关联失败:', error);
      setStatusMessage(error.response?.data?.message || '修复兑换码关联失败');
    } finally {
      setUpdatingCode(false);
    }
  };

  // 添加以下代码来修改表格中的渲染方式
  // 在表格行的渲染中添加编辑功能
  const renderTableRow = (code: any) => {
    const isEditing = editingCodeId === code.id;
    const questionSetTitle = getQuestionSetTitle(code.questionSetId);

    return (
      <tr key={code.id} className={code.usedAt ? 'bg-gray-50' : ''}>
        <td className="border px-4 py-2">
          <div className="flex items-center">
            <span className="font-mono text-sm">{code.code}</span>
            <button
              onClick={() => copyToClipboard(code.code)}
              className="ml-2 text-gray-600 hover:text-blue-600"
              title="复制兑换码"
            >
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M8 5H6a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2v-1M8 5a2 2 0 002 2h2a2 2 0 002-2M8 5a2 2 0 012-2h2a2 2 0 012 2m0 0h2a2 2 0 012 2v3m2 4H10m0 0l3-3m-3 3l3 3" />
              </svg>
            </button>
          </div>
        </td>
        <td className="border px-4 py-2">
          {isEditing ? (
            <select
              value={newQuestionSetId}
              onChange={(e) => setNewQuestionSetId(e.target.value)}
              className="w-full border-gray-300 rounded-md shadow-sm focus:ring-indigo-500 focus:border-indigo-500"
              disabled={updatingCode}
            >
              <option value="">-- 请选择题库 --</option>
              {questionSets.map(set => (
                <option key={set.id} value={set.id}>{set.title}</option>
              ))}
            </select>
          ) : (
            questionSetTitle
          )}
        </td>
        <td className="border px-4 py-2">{code.validityDays} 天</td>
        <td className="border px-4 py-2">
          {code.usedAt ? (
            <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-red-100 text-red-800">
              已使用
            </span>
          ) : (
            <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-green-100 text-green-800">
              未使用
            </span>
          )}
        </td>
        <td className="border px-4 py-2">{code.usedAt ? formatDate(code.usedAt) : '-'}</td>
        <td className="border px-4 py-2">{code.redeemUser?.username || '-'}</td>
        <td className="border px-4 py-2">{formatDate(code.createdAt)}</td>
        <td className="border px-4 py-2">{code.redeemCreator?.username || '-'}</td>
        <td className="border px-4 py-2">
          {isEditing ? (
            <div className="flex space-x-2">
              <button
                onClick={() => updateRedeemCodeQuestionSet(code.id)}
                className="bg-green-600 text-white px-2 py-1 rounded text-xs hover:bg-green-700"
                disabled={updatingCode}
              >
                {updatingCode ? '保存中...' : '保存'}
              </button>
              <button
                onClick={cancelEditCode}
                className="bg-gray-300 text-gray-700 px-2 py-1 rounded text-xs hover:bg-gray-400"
                disabled={updatingCode}
              >
                取消
              </button>
            </div>
          ) : (
            <div className="flex space-x-2">
              {!code.usedAt && (
                <button
                  onClick={() => startEditCode(code.id, code.questionSetId)}
                  className="bg-blue-600 text-white px-2 py-1 rounded text-xs hover:bg-blue-700"
                >
                  修复关联
                </button>
              )}
            </div>
          )}
        </td>
      </tr>
    );
  };

  return (
    <div className="p-6">
      <h2 className="text-xl font-semibold text-gray-800 mb-6">兑换码管理</h2>
      
      {/* Status Message */}
      {statusMessage && (
        <div className={`mb-4 p-3 rounded-md ${
          statusMessage.startsWith('成功') || statusMessage.includes('成功')
            ? 'bg-green-50 text-green-800 border border-green-200' 
            : 'bg-red-50 text-red-800 border border-red-200'
        }`}>
          {statusMessage}
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
              value={selectedQuestionSetId}
              onChange={(e) => setSelectedQuestionSetId(e.target.value)}
              className="w-full border-gray-300 rounded-md shadow-sm focus:ring-indigo-500 focus:border-indigo-500"
              disabled={generatingCodes}
            >
              <option value="">-- 请选择题库 --</option>
              {questionSets.map(set => (
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
              disabled={generatingCodes}
            />
          </div>
          
          <div>
            <label htmlFor="quantity" className="block text-sm font-medium text-gray-700 mb-1">
              生成数量
            </label>
            <input
              type="number"
              id="quantity"
              value={codeCount}
              onChange={(e) => setCodeCount(parseInt(e.target.value))}
              min="1"
              max="100"
              className="w-full border-gray-300 rounded-md shadow-sm focus:ring-indigo-500 focus:border-indigo-500"
              disabled={generatingCodes}
            />
          </div>
          
          <div className="flex items-end">
            <button
              onClick={handleGenerateCode}
              className="w-full bg-indigo-600 text-white py-2 px-4 rounded-md hover:bg-indigo-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-indigo-500 disabled:bg-indigo-400 disabled:cursor-not-allowed"
              disabled={generatingCodes}
            >
              {generatingCodes ? '处理中...' : '生成兑换码'}
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
              disabled={generatingCodes}
            >
              <option value="all">所有状态</option>
              <option value="used">已使用</option>
              <option value="unused">未使用</option>
            </select>
            
            <select
              value={filterQuestionSet}
              onChange={(e) => setFilterQuestionSet(e.target.value)}
              className="border-gray-300 rounded-md shadow-sm focus:ring-indigo-500 focus:border-indigo-500"
              disabled={generatingCodes}
            >
              <option value="all">所有题库</option>
              {questionSets.map(set => (
                <option key={set.id} value={set.id}>{set.title}</option>
              ))}
            </select>
          </div>
        </div>
        
        {generatingCodes ? (
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
                  <th scope="col" className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    兑换码
                  </th>
                  <th scope="col" className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    题库
                  </th>
                  <th scope="col" className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    有效期
                  </th>
                  <th scope="col" className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    状态
                  </th>
                  <th scope="col" className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    使用时间
                  </th>
                  <th scope="col" className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    使用者
                  </th>
                  <th scope="col" className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    创建时间
                  </th>
                  <th scope="col" className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    创建者
                  </th>
                  <th scope="col" className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    操作
                  </th>
                </tr>
              </thead>
              <tbody className="bg-white divide-y divide-gray-200">
                {filteredCodes.map(code => renderTableRow(code))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
};

export default AdminRedeemCodes; 