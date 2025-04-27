import React, { useState, useEffect } from 'react';
import { QuestionSet } from '../data/questionSets';
import axios from 'axios';

const ManageQuestionSets: React.FC = () => {
  const [questionSets, setQuestionSets] = useState<QuestionSet[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [successMessage, setSuccessMessage] = useState<string | null>(null);

  // 加载题库列表
  useEffect(() => {
    const fetchQuestionSets = async () => {
      try {
        setLoading(true);
        setError(null);
        
        const response = await axios.get('/api/question-sets');
        setQuestionSets(response.data);
      } catch (err) {
        console.error('获取题库列表失败:', err);
        setError('无法加载题库列表，请稍后重试');
      } finally {
        setLoading(false);
      }
    };

    fetchQuestionSets();
  }, []);

  // 删除题库
  const handleDelete = async (id: string) => {
    // 确认删除
    if (!window.confirm('确定要删除这个题库吗？此操作不可恢复。')) {
      return;
    }

    try {
      await axios.delete(`/api/question-sets/${id}`);
      
      // 更新状态，移除已删除的题库
      setQuestionSets(prev => prev.filter(set => set.id !== id));
      setSuccessMessage('题库已成功删除');
      
      // 3秒后清除成功消息
      setTimeout(() => {
        setSuccessMessage(null);
      }, 3000);
    } catch (err) {
      console.error('删除题库失败:', err);
      setError('删除题库失败，请稍后重试');
      
      // 3秒后清除错误消息
      setTimeout(() => {
        setError(null);
      }, 3000);
    }
  };

  // 根据题库类型获取颜色
  const getCategoryColor = (category: string) => {
    const colors: Record<string, string> = {
      '计算机基础': 'bg-blue-100 text-blue-800',
      '编程语言': 'bg-green-100 text-green-800',
      '网络协议': 'bg-purple-100 text-purple-800',
      '安全技术': 'bg-red-100 text-red-800',
      '数据库': 'bg-yellow-100 text-yellow-800',
      '操作系统': 'bg-orange-100 text-orange-800',
      '软件工程': 'bg-teal-100 text-teal-800',
      '人工智能': 'bg-indigo-100 text-indigo-800',
      '云计算': 'bg-cyan-100 text-cyan-800',
    };
    
    return colors[category] || 'bg-gray-100 text-gray-800';
  };

  return (
    <div>
      <h2 className="text-xl font-semibold text-gray-800 mb-4">管理题库</h2>
      
      {/* 消息区域 */}
      {successMessage && (
        <div className="bg-green-100 border border-green-400 text-green-700 px-4 py-3 rounded mb-4">
          {successMessage}
        </div>
      )}
      
      {error && (
        <div className="bg-red-100 border border-red-400 text-red-700 px-4 py-3 rounded mb-4">
          {error}
        </div>
      )}
      
      {/* 题库列表 */}
      {loading ? (
        <div className="text-center py-8">
          <p className="text-gray-500">加载中...</p>
        </div>
      ) : questionSets.length === 0 ? (
        <div className="bg-gray-50 p-8 text-center rounded">
          <p className="text-gray-500 mb-2">暂无题库</p>
          <p className="text-gray-400 text-sm">您可以在"添加题库"选项卡中创建新题库</p>
        </div>
      ) : (
        <div className="grid gap-4">
          {questionSets.map((set) => (
            <div key={set.id} className="border border-gray-200 rounded-lg shadow-sm overflow-hidden">
              <div className="flex justify-between items-center p-4 bg-gray-50 border-b border-gray-200">
                <div className="flex items-center">
                  <span className="text-2xl mr-3">{set.icon}</span>
                  <div>
                    <h3 className="font-medium text-gray-800">{set.title}</h3>
                    <span className={`inline-block text-xs px-2 py-1 rounded-full mt-1 ${getCategoryColor(set.category)}`}>
                      {set.category}
                    </span>
                  </div>
                </div>
                <div className="flex space-x-2">
                  <button
                    onClick={() => handleDelete(set.id)}
                    className="text-red-600 hover:text-red-800 text-sm"
                  >
                    删除
                  </button>
                </div>
              </div>
              
              <div className="p-4">
                <p className="text-sm text-gray-600 mb-2 line-clamp-2">
                  {set.description || <span className="text-gray-400 italic">无描述</span>}
                </p>
                
                <div className="flex justify-between items-center mt-2 text-sm">
                  <div className="flex space-x-4">
                    <span className="text-gray-500">题目数量: {set.questions?.length || 0}</span>
                    <span className="text-gray-500">
                      {set.isPaid ? `付费: ${set.price}元` : '免费'}
                    </span>
                  </div>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
};

export default ManageQuestionSets; 