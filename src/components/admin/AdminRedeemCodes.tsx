import React, { useState, useEffect } from 'react';
import { useUser } from '../../contexts/UserContext';
import { QuestionSet } from '../../types';
import { questionSetApi } from '../../utils/api';
import axios, { AxiosError } from 'axios';

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
  const [debuggingResults, setDebuggingResults] = useState<any>(null);
  const [isDebugging, setIsDebugging] = useState(false);
  const [showDebugInfo, setShowDebugInfo] = useState(false);
  const [isLoading, setIsLoading] = useState(false);

  // 加载题库和兑换码数据
  useEffect(() => {
    const loadData = async () => {
      try {
        setIsLoading(true);
        
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
        
        // 加载兑换码数据 - 使用直接API调用替代上下文方法
        try {
          console.log("[AdminRedeemCodes] 开始加载兑换码数据");
          const token = localStorage.getItem('token');
          const response = await axios.get('/api/redeem-codes', {
            headers: { Authorization: `Bearer ${token}` }
          });
          
          console.log("[AdminRedeemCodes] 兑换码API响应:", response.data);
          
          if (response.data.success && response.data.data) {
            // 检查数据类型和结构
            const codesData = response.data.data;
            console.log("[AdminRedeemCodes] 兑换码数据类型:", typeof codesData);
            console.log("[AdminRedeemCodes] 是否为数组:", Array.isArray(codesData));
            
            // 规范化数据格式
            let normalizedCodes = [];
            if (Array.isArray(codesData)) {
              normalizedCodes = codesData;
            } else if (codesData.list && Array.isArray(codesData.list)) {
              normalizedCodes = codesData.list;
            } else if (typeof codesData === 'object') {
              // 尝试将对象转换为数组
              normalizedCodes = Object.values(codesData);
            }
            
            console.log("[AdminRedeemCodes] 规范化后的兑换码:", normalizedCodes);
            
            if (normalizedCodes.length > 0) {
              setRedeemCodes(normalizedCodes);
              setStatusMessage("成功加载兑换码数据");
            } else {
              console.warn("[AdminRedeemCodes] 规范化后的兑换码数组为空");
              setRedeemCodes([]);
              setStatusMessage("没有可用的兑换码数据");
            }
          } else {
            console.error("[AdminRedeemCodes] API返回成功但无数据:", response.data);
            setRedeemCodes([]);
            setStatusMessage(response.data.message || "获取兑换码数据失败");
          }
        } catch (codeError: any) {
          console.error('[AdminRedeemCodes] 获取兑换码数据失败:', codeError);
          
          if (codeError.response) {
            console.error('[AdminRedeemCodes] 错误响应状态:', codeError.response.status);
            console.error('[AdminRedeemCodes] 错误响应数据:', codeError.response.data);
          }
          
          setStatusMessage('获取兑换码数据失败，请刷新页面重试');
          setRedeemCodes([]);
          
          // 尝试使用用户上下文的方法作为备用
          try {
            console.log('[AdminRedeemCodes] 尝试使用备用方法获取兑换码');
            const codes = await getRedeemCodes();
            console.log('[AdminRedeemCodes] 备用方法返回数据:', codes);
            
            if (Array.isArray(codes) && codes.length > 0) {
              setRedeemCodes(codes);
              setStatusMessage('数据已通过备用方式加载');
            }
          } catch (backupError) {
            console.error('[AdminRedeemCodes] 备用方法获取兑换码失败:', backupError);
          }
        }
      } catch (error: any) {
        console.error('[AdminRedeemCodes] 加载数据失败:', error);
        setStatusMessage('加载数据失败，请刷新页面重试');
      } finally {
        setIsLoading(false);
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
      
      console.log(`正在发送修复请求: codeId=${codeId}, newQuestionSetId=${newQuestionSetId}`);
      
      const response = await axios.put(
        `/api/redeem-codes/${codeId}/fix-question-set`, 
        { questionSetId: newQuestionSetId },
        { 
          headers: { 
            Authorization: `Bearer ${token}`,
            'Content-Type': 'application/json'
          }
        }
      );
      
      console.log('修复请求响应:', response.data);
      
      if (response.data.success) {
        // 刷新兑换码列表
        const updatedCodes = await getRedeemCodes();
        setRedeemCodes(updatedCodes);
        setStatusMessage(`兑换码题库关联已成功修复为: ${getQuestionSetTitle(newQuestionSetId)}`);
        setEditingCodeId(null);
      } else {
        setStatusMessage(`修复失败: ${response.data.message || '未知错误'}`);
      }
    } catch (error: any) {
      console.error('修复兑换码关联失败:', error);
      // 详细记录错误信息
      if (error.response) {
        console.error('错误响应数据:', error.response.data);
        console.error('错误状态码:', error.response.status);
        setStatusMessage(`修复失败(${error.response.status}): ${error.response.data?.message || '服务器错误'}`);
      } else if (error.request) {
        console.error('未收到响应:', error.request);
        setStatusMessage('服务器未响应，请检查网络连接');
      } else {
        console.error('请求配置错误:', error.message);
        setStatusMessage(`请求错误: ${error.message}`);
      }
    } finally {
      setUpdatingCode(false);
    }
  };

  // 调试功能 - 检查兑换码和题库的一致性
  const debugRedeemCodes = async () => {
    setIsDebugging(true);
    try {
      const token = localStorage.getItem('token');
      
      console.log('正在调试兑换码数据...');
      
      const response = await axios.get(
        `/api/redeem-codes/debug`,
        { headers: { Authorization: `Bearer ${token}` } }
      );
      
      console.log('调试结果:', response.data);
      
      if (response.data.success) {
        setDebuggingResults(response.data.data);
        setShowDebugInfo(true);
        
        if (response.data.data.issues.length > 0) {
          setStatusMessage(`发现 ${response.data.data.issues.length} 个兑换码存在问题，请查看详情`);
        } else {
          setStatusMessage('没有发现问题的兑换码');
        }
      } else {
        setStatusMessage(`调试失败: ${response.data.message || '未知错误'}`);
      }
    } catch (error: any) {
      console.error('调试兑换码失败:', error);
      
      if (error.response) {
        console.error('错误响应数据:', error.response.data);
        console.error('错误状态码:', error.response.status);
        setStatusMessage(`调试失败(${error.response.status}): ${error.response.data?.message || '服务器错误'}`);
      } else if (error.request) {
        console.error('未收到响应:', error.request);
        setStatusMessage('服务器未响应，请检查网络连接');
      } else {
        console.error('请求配置错误:', error.message);
        setStatusMessage(`请求错误: ${error.message}`);
      }
    } finally {
      setIsDebugging(false);
    }
  };
  
  // 批量修复问题兑换码
  const batchFixRedeemCodes = async () => {
    if (!debuggingResults || !debuggingResults.issues || debuggingResults.issues.length === 0) {
      setStatusMessage('没有需要修复的兑换码');
      return;
    }
    
    if (!selectedQuestionSetId) {
      setStatusMessage('请选择一个要关联的题库');
      return;
    }
    
    setIsDebugging(true);
    try {
      const token = localStorage.getItem('token');
      
      // 创建修复映射
      const codeToQuestionSetMap: Record<string, string> = {};
      debuggingResults.issues.forEach((issue: any) => {
        codeToQuestionSetMap[issue.codeId] = selectedQuestionSetId;
      });
      
      console.log('准备批量修复兑换码:', codeToQuestionSetMap);
      
      const response = await axios.post(
        `/api/redeem-codes/batch-fix`,
        { codeToQuestionSetMap },
        { headers: { 
          Authorization: `Bearer ${token}`,
          'Content-Type': 'application/json'
        }}
      );
      
      console.log('批量修复结果:', response.data);
      
      if (response.data.success) {
        setStatusMessage(response.data.message || '成功修复兑换码');
        
        // 刷新数据
        const updatedCodes = await getRedeemCodes();
        setRedeemCodes(updatedCodes);
        
        // 重新运行调试
        await debugRedeemCodes();
      } else {
        setStatusMessage(`修复失败: ${response.data.message || '未知错误'}`);
      }
    } catch (error: any) {
      console.error('批量修复兑换码失败:', error);
      
      if (error.response) {
        setStatusMessage(`修复失败(${error.response.status}): ${error.response.data?.message || '服务器错误'}`);
      } else if (error.request) {
        setStatusMessage('服务器未响应，请检查网络连接');
      } else {
        setStatusMessage(`请求错误: ${error.message}`);
      }
    } finally {
      setIsDebugging(false);
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
            <button
              onClick={debugRedeemCodes}
              className="bg-purple-600 text-white px-3 py-1 rounded text-sm hover:bg-purple-700"
              disabled={isDebugging}
            >
              {isDebugging ? '正在检查...' : '检查兑换码问题'}
            </button>
            
            {debuggingResults && debuggingResults.issues.length > 0 && (
              <button
                onClick={batchFixRedeemCodes}
                className="bg-red-600 text-white px-3 py-1 rounded text-sm hover:bg-red-700"
                disabled={isDebugging || !selectedQuestionSetId}
              >
                批量修复 {debuggingResults.issues.length} 个问题兑换码
              </button>
            )}
            
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

      {/* 调试信息显示 */}
      {showDebugInfo && debuggingResults && (
        <div className="bg-gray-50 p-4 mb-4 rounded-lg border border-gray-200">
          <div className="flex justify-between items-center mb-2">
            <h4 className="font-medium text-gray-700">调试信息</h4>
            <button
              onClick={() => setShowDebugInfo(false)}
              className="text-gray-500 hover:text-gray-700"
            >
              <svg className="h-5 w-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M6 18L18 6M6 6l12 12" />
              </svg>
            </button>
          </div>
          
          <div className="text-sm">
            <p className="mb-1">总兑换码数量: <span className="font-medium">{debuggingResults.totalRedeemCodes}</span></p>
            <p className="mb-1">总题库数量: <span className="font-medium">{debuggingResults.totalQuestionSets}</span></p>
            <p className="mb-3">
              有问题的兑换码: 
              <span className={`font-medium ${debuggingResults.issues.length > 0 ? 'text-red-600' : 'text-green-600'}`}>
                {debuggingResults.issues.length}
              </span>
            </p>
            
            {debuggingResults.issues.length > 0 && (
              <div className="mt-2">
                <p className="text-red-600 font-medium mb-1">问题详情:</p>
                <ul className="text-xs bg-white p-2 rounded border border-gray-200 max-h-32 overflow-y-auto">
                  {debuggingResults.issues.map((issue: any, index: number) => (
                    <li key={index} className="mb-1 pb-1 border-b border-gray-100">
                      <span className="font-mono">Code: {issue.code}</span> → 
                      <span className="text-red-500 ml-1">{issue.issue}</span>
                    </li>
                  ))}
                </ul>
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
};

export default AdminRedeemCodes; 