import React, { useState, useEffect } from 'react';
import { v4 as uuidv4 } from 'uuid';
import AddQuestion from './AddQuestion';
import { QuestionSet, Question } from '../types';
import axios from 'axios';
import { useNavigate } from 'react-router-dom';

// 分类选项
const categoryOptions = [
  '计算机基础',
  '编程语言',
  '网络协议',
  '安全技术',
  '数据库',
  '操作系统',
  '软件工程',
  '人工智能',
  '云计算',
  '其他'
];

// 图标选项
const iconOptions = ['📝', '⚙️', '🌐', '🔒', '💻', '📊', '🧩', '🤖', '☁️', '📚'];

const AddQuestionSet: React.FC = () => {
  // 题库基本信息
  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [category, setCategory] = useState(categoryOptions[0]);
  const [icon, setIcon] = useState(iconOptions[0]);
  const [isPaid, setIsPaid] = useState(false);
  const [price, setPrice] = useState('');
  const [trialQuestions, setTrialQuestions] = useState('0');
  
  // 题目管理
  const [questions, setQuestions] = useState<Question[]>([]);
  const [isAddingQuestion, setIsAddingQuestion] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [successMessage, setSuccessMessage] = useState('');
  const [errorMessage, setErrorMessage] = useState('');
  const [serverStatus, setServerStatus] = useState<'checking' | 'online' | 'offline'>('checking');

  const navigate = useNavigate();

  // 添加题目
  const handleAddQuestion = (question: Question) => {
    setQuestions([...questions, question]);
    setIsAddingQuestion(false);
  };

  // 删除题目
  const handleDeleteQuestion = (id: string | number) => {
    setQuestions(questions.filter(q => q.id !== id));
  };

  // 检查服务器状态
  const checkServerStatus = async () => {
    try {
      setServerStatus('checking');
      // 尝试访问题库列表接口而不是健康检查接口
      // 这个接口应该在生产环境中也存在
      await axios.get('/api/question-sets', { 
        timeout: 5000,
        params: { limit: 1 } // 只请求一条数据以减少负载
      });
      setServerStatus('online');
      return true;
    } catch (error) {
      console.error('服务器连接失败:', error);
      setServerStatus('offline');
      setErrorMessage('无法连接到服务器，请确保后端服务正在运行');
      return false;
    }
  };

  // 组件加载时检查服务器状态
  useEffect(() => {
    checkServerStatus();
  }, []);

  // 提交题库
  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (title.trim() === '') {
      setErrorMessage('请填写题库标题');
      return;
    }
    
    // 不再强制要求添加题目
    // if (questions.length === 0) {
    //   setErrorMessage('请至少添加一道题目');
    //   return;
    // }

    setIsSubmitting(true);
    setErrorMessage('');
    setSuccessMessage('');

    try {
      console.log('开始创建题库...');
      
      // 创建题库对象
      const questionSet: Partial<QuestionSet> = {
        id: uuidv4(),
        title,
        description,
        category,
        icon,
        isPaid,
        questions,
      };

      if (isPaid) {
        questionSet.price = parseFloat(price || '0');
        questionSet.trialQuestions = parseInt(trialQuestions || '0');
      }

      console.log('题库数据:', JSON.stringify(questionSet));

      // 直接使用axios发送请求，避开可能的封装问题
      const response = await axios.post('/api/question-sets', questionSet, {
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${localStorage.getItem('token')}`
        },
        timeout: 15000 // 15秒超时
      });

      console.log('创建题库响应:', response);

      if (response.data) {
        // 保存成功，重置表单
        setTitle('');
        setDescription('');
        setCategory(categoryOptions[0]);
        setIcon(iconOptions[0]);
        setIsPaid(false);
        setPrice('');
        setTrialQuestions('0');
        setQuestions([]);
        setSuccessMessage('题库创建成功！');
        navigate('/');
      } else {
        setErrorMessage(response.data?.message || '创建失败，请重试');
      }
    } catch (error: any) {
      console.error('创建题库错误:', error);
      
      // 详细记录错误信息
      if (error.response) {
        // 服务器返回了错误状态码
        console.error('服务器响应:', error.response.status, error.response.data);
        setErrorMessage(`服务器错误: ${error.response.data?.message || error.response.status}`);
      } else if (error.request) {
        // 请求发送了但没有收到响应
        console.error('没有收到服务器响应:', error.request);
        setErrorMessage('服务器无响应，请检查网络连接');
      } else {
        // 设置请求时发生了错误
        console.error('请求错误:', error.message);
        setErrorMessage(`请求错误: ${error.message}`);
      }
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div>
      <h2 className="text-xl font-semibold text-gray-800 mb-4">添加新题库</h2>
      
      {serverStatus === 'offline' && (
        <div className="bg-red-100 border border-red-400 text-red-700 px-4 py-3 rounded mb-4 flex justify-between items-center">
          <div>
            <span className="font-medium">服务器连接失败!</span> 请确保后端服务正在运行。
          </div>
          <button 
            onClick={checkServerStatus}
            className="bg-red-200 hover:bg-red-300 text-red-800 px-3 py-1 rounded"
          >
            重试连接
          </button>
        </div>
      )}
      
      {successMessage && (
        <div className="bg-green-100 border border-green-400 text-green-700 px-4 py-3 rounded mb-4">
          {successMessage}
        </div>
      )}
      
      {errorMessage && (
        <div className="bg-red-100 border border-red-400 text-red-700 px-4 py-3 rounded mb-4">
          {errorMessage}
        </div>
      )}

      <form onSubmit={handleSubmit}>
        {/* 基本信息部分 */}
        <div className="mb-6 pb-6 border-b border-gray-200">
          <h3 className="text-lg font-medium text-gray-700 mb-4">基本信息</h3>
          
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <label className="block text-gray-700 mb-2">题库标题 *</label>
              <input
                type="text"
                value={title}
                onChange={(e) => setTitle(e.target.value)}
                className="w-full border border-gray-300 rounded px-3 py-2"
                placeholder="输入题库标题"
                required
              />
            </div>
            
            <div>
              <label className="block text-gray-700 mb-2">分类</label>
              <select
                value={category}
                onChange={(e) => setCategory(e.target.value)}
                className="w-full border border-gray-300 rounded px-3 py-2"
              >
                {categoryOptions.map((cat) => (
                  <option key={cat} value={cat}>
                    {cat}
                  </option>
                ))}
              </select>
            </div>
            
            <div>
              <label className="block text-gray-700 mb-2">图标</label>
              <div className="flex flex-wrap gap-2">
                {iconOptions.map((ico) => (
                  <button
                    key={ico}
                    type="button"
                    className={`w-10 h-10 flex items-center justify-center text-xl rounded ${
                      icon === ico ? 'bg-blue-100 border-2 border-blue-500' : 'border border-gray-300'
                    }`}
                    onClick={() => setIcon(ico)}
                  >
                    {ico}
                  </button>
                ))}
              </div>
            </div>
            
            <div>
              <label className="block text-gray-700 mb-2">描述</label>
              <textarea
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                className="w-full border border-gray-300 rounded px-3 py-2"
                rows={3}
                placeholder="输入题库描述"
              />
            </div>
          </div>
          
          <div className="mt-4">
            <label className="inline-flex items-center">
              <input
                type="checkbox"
                checked={isPaid}
                onChange={(e) => setIsPaid(e.target.checked)}
                className="form-checkbox"
              />
              <span className="ml-2">付费题库</span>
            </label>
            
            {isPaid && (
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mt-3">
                <div>
                  <label className="block text-gray-700 mb-2">价格 (¥)</label>
                  <input
                    type="number"
                    value={price}
                    onChange={(e) => setPrice(e.target.value)}
                    className="w-full border border-gray-300 rounded px-3 py-2"
                    placeholder="例如: 29.9"
                    step="0.1"
                    min="0"
                  />
                </div>
                <div>
                  <label className="block text-gray-700 mb-2">免费试用题目数量</label>
                  <input
                    type="number"
                    value={trialQuestions}
                    onChange={(e) => setTrialQuestions(e.target.value)}
                    className="w-full border border-gray-300 rounded px-3 py-2"
                    placeholder="例如: 5"
                    step="1"
                    min="0"
                  />
                </div>
              </div>
            )}
          </div>
        </div>
        
        {/* 题目管理部分 - 可选 */}
        <div className="mb-6">
          <div className="flex justify-between items-center mb-4">
            <h3 className="text-lg font-medium text-gray-700">题目管理（可选）</h3>
            <button
              type="button"
              onClick={() => setIsAddingQuestion(true)}
              className="px-4 py-2 bg-blue-600 text-white rounded hover:bg-blue-700 transition-colors"
            >
              添加题目
            </button>
          </div>
          
          {questions.length > 0 ? (
            <div className="bg-white border border-gray-200 rounded overflow-hidden">
              <ul className="divide-y divide-gray-200">
                {questions.map((question, index) => (
                  <li key={question.id} className="p-4">
                    <div className="flex justify-between">
                      <div>
                        <span className="font-medium text-gray-800">#{index + 1}. </span>
                        <span>{question.question}</span>
                      </div>
                      <button
                        type="button"
                        onClick={() => handleDeleteQuestion(question.id)}
                        className="text-red-600 hover:text-red-800"
                      >
                        删除
                      </button>
                    </div>
                  </li>
                ))}
              </ul>
            </div>
          ) : (
            <div className="text-center py-10 bg-gray-50 rounded border border-gray-200">
              <p className="text-gray-500">题库中还没有题目。添加题目或者先创建空题库。</p>
            </div>
          )}
        </div>
        
        {/* 添加题目表单 */}
        {isAddingQuestion && (
          <AddQuestion
            onAddQuestion={handleAddQuestion}
            onCancel={() => setIsAddingQuestion(false)}
            questionCount={questions.length}
          />
        )}
        
        {/* 提交按钮 */}
        <div className="flex justify-end space-x-4 mt-6">
          <button
            type="button"
            onClick={() => navigate('/')}
            className="px-4 py-2 border border-gray-300 rounded text-gray-700 hover:bg-gray-50 transition-colors"
          >
            取消
          </button>
          <button
            type="submit"
            disabled={isSubmitting}
            className={`px-4 py-2 bg-blue-600 text-white rounded hover:bg-blue-700 transition-colors ${
              isSubmitting ? 'opacity-75 cursor-not-allowed' : ''
            }`}
          >
            {isSubmitting ? '保存中...' : '保存题库'}
          </button>
        </div>
      </form>
    </div>
  );
};

export default AddQuestionSet; 