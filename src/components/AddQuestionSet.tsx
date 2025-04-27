import React, { useState, useEffect } from 'react';
import { v4 as uuidv4 } from 'uuid';
import AddQuestion from './AddQuestion';
import { QuestionSet } from '../data/questionSets';
import { Question } from '../data/questions';
import axios from 'axios';

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

  // 添加题目
  const handleAddQuestion = (question: Question) => {
    setQuestions([...questions, question]);
    setIsAddingQuestion(false);
  };

  // 删除题目
  const handleDeleteQuestion = (questionId: number) => {
    setQuestions(questions.filter(q => q.id !== questionId));
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
    
    if (questions.length === 0) {
      setErrorMessage('请至少添加一道题目');
      return;
    }

    setIsSubmitting(true);
    setErrorMessage('');
    setSuccessMessage('');

    try {
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

      // 发送请求保存题库
      const response = await axios.post('/api/question-sets', questionSet, {
        headers: {
          'Content-Type': 'application/json'
        },
        timeout: 10000 // 10秒超时
      });

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
      console.log('创建成功:', response.data);
    } catch (error: any) {
      console.error('创建题库失败:', error);
      
      // 提取详细错误信息
      let errorMsg = '创建题库失败，请稍后重试';
      
      if (error.response) {
        if (error.response.status === 404) {
          // 处理404特殊情况，可能是Nginx配置问题
          errorMsg = '服务器未找到此API路径，请联系管理员检查服务器配置';
          // 尝试检查服务器状态
          checkServerStatus();
        } else {
          // 其他服务器响应错误
          errorMsg = `服务器响应错误 (${error.response.status}): ${error.response.data?.error || error.message}`;
          console.error('错误详情:', error.response.data);
        }
      } else if (error.request) {
        // 请求发送成功但没有收到响应
        errorMsg = '服务器无响应，请检查后端服务是否运行';
      } else {
        // 请求配置有问题
        errorMsg = `请求配置错误: ${error.message}`;
      }
      
      setErrorMessage(errorMsg);
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
              <label className="block text-gray-700 mb-2">访问权限</label>
              <div className="flex items-center">
                <input
                  type="checkbox"
                  checked={isPaid}
                  onChange={(e) => setIsPaid(e.target.checked)}
                  className="mr-2"
                />
                <span>付费题库</span>
              </div>
              
              {isPaid && (
                <div className="mt-2 grid grid-cols-2 gap-2">
                  <div>
                    <label className="block text-gray-700 mb-1 text-sm">价格 (元)</label>
                    <input
                      type="number"
                      value={price}
                      onChange={(e) => setPrice(e.target.value)}
                      className="w-full border border-gray-300 rounded px-3 py-1"
                      placeholder="0.00"
                      min="0"
                      step="0.01"
                    />
                  </div>
                  <div>
                    <label className="block text-gray-700 mb-1 text-sm">试用题数</label>
                    <input
                      type="number"
                      value={trialQuestions}
                      onChange={(e) => setTrialQuestions(e.target.value)}
                      className="w-full border border-gray-300 rounded px-3 py-1"
                      placeholder="0"
                      min="0"
                      step="1"
                    />
                  </div>
                </div>
              )}
            </div>
          </div>
          
          <div className="mt-4">
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
        
        {/* 题目管理部分 */}
        <div>
          <div className="flex justify-between items-center mb-4">
            <h3 className="text-lg font-medium text-gray-700">题目管理</h3>
            <button
              type="button"
              onClick={() => setIsAddingQuestion(true)}
              className="bg-blue-600 text-white px-4 py-2 rounded hover:bg-blue-700"
            >
              添加题目
            </button>
          </div>
          
          {questions.length === 0 ? (
            <div className="bg-gray-50 p-6 text-center rounded">
              <p className="text-gray-500">还没有添加题目，点击「添加题目」开始创建</p>
            </div>
          ) : (
            <div className="space-y-4">
              {questions.map((question, index) => (
                <div key={question.id} className="border border-gray-200 rounded p-4">
                  <div className="flex justify-between items-start">
                    <div>
                      <span className="inline-block bg-blue-100 text-blue-800 text-xs font-medium px-2 py-1 rounded-full mb-2">
                        {question.questionType === 'single' ? '单选题' : '多选题'}
                      </span>
                      <h4 className="font-medium">{index + 1}. {question.question}</h4>
                    </div>
                    <button
                      type="button"
                      onClick={() => handleDeleteQuestion(question.id)}
                      className="text-red-600 hover:text-red-800"
                    >
                      删除
                    </button>
                  </div>
                  <div className="mt-2 pl-4">
                    {question.options.map((option) => (
                      <div key={option.id} className="flex items-center my-1">
                        <span className={`w-6 h-6 flex items-center justify-center rounded-full border mr-2 ${
                          question.questionType === 'single'
                            ? question.correctAnswer === option.id
                              ? 'bg-green-500 text-white border-green-500'
                              : 'border-gray-300'
                            : (question.correctAnswer as string[]).includes(option.id)
                              ? 'bg-green-500 text-white border-green-500'
                              : 'border-gray-300'
                        }`}>
                          {option.id}
                        </span>
                        <span>{option.text}</span>
                      </div>
                    ))}
                  </div>
                </div>
              ))}
            </div>
          )}
          
          {isAddingQuestion && (
            <div className="mt-4 border-t border-gray-200 pt-4">
              <AddQuestion
                onAddQuestion={handleAddQuestion}
                onCancel={() => setIsAddingQuestion(false)}
                questionCount={questions.length}
              />
            </div>
          )}
        </div>
        
        {/* 提交按钮 */}
        <div className="mt-6 pt-6 border-t border-gray-200">
          <button
            type="submit"
            disabled={isSubmitting}
            className={`px-6 py-2 rounded font-medium ${
              isSubmitting
                ? 'bg-gray-400 text-white cursor-not-allowed'
                : 'bg-green-600 text-white hover:bg-green-700'
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