// @ts-nocheck - 禁用 TypeScript 未使用变量检查
import React, { useState, useEffect } from 'react';
import { QuestionSet } from '../data/questionSets';
import { Question } from '../data/questions';
import AddQuestion from './AddQuestion';
import EditQuestion from './EditQuestion';
import axios from 'axios';
import { useUser } from '../contexts/UserContext';

const ManageQuestionSets: React.FC = () => {
  const { isAdmin } = useUser();
  const [questionSets, setQuestionSets] = useState<QuestionSet[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [successMessage, setSuccessMessage] = useState<string | null>(null);
  
  // 添加题目相关状态
  const [currentQuestionSet, setCurrentQuestionSet] = useState<QuestionSet | null>(null);
  const [isAddingQuestion, setIsAddingQuestion] = useState(false);
  const [isSavingQuestion, setIsSavingQuestion] = useState(false);
  const [isManagingQuestions, setIsManagingQuestions] = useState(false);
  const [editingQuestion, setEditingQuestion] = useState<Question | null>(null);
  const [isEditingQuestion, setIsEditingQuestion] = useState(false);

  // 加载题库数据
  useEffect(() => {
    const loadQuestionSets = async () => {
      setLoading(true);
      setError(null);
      try {
        // 使用新的方式获取数据，提高可靠性
        const response = await axios.get('/api/question-sets', {
          headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${localStorage.getItem('token')}`
          }
        });
        
        // 检查响应格式
        if (response.data) {
          if (response.data.success && response.data.data) {
            // 标准API响应格式
            setQuestionSets(response.data.data);
          } else if (Array.isArray(response.data)) {
            // 直接返回数组的格式
            setQuestionSets(response.data);
          } else {
            // 其他格式，尝试处理
            console.warn('Unexpected response format:', response.data);
            if (response.data.questionSets) {
              setQuestionSets(response.data.questionSets);
            } else {
              throw new Error('响应数据格式不正确');
            }
          }
        } else {
          throw new Error('获取题库失败');
        }
      } catch (err) {
        console.error('加载题库失败:', err);
        setError(`加载题库时发生错误：${err.message || '未知错误'}，请稍后重试`);
      } finally {
        setLoading(false);
      }
    };

    if (isAdmin()) {
      loadQuestionSets();
      
      // 设置定时刷新，每30秒更新一次题库数据
      const intervalId = setInterval(loadQuestionSets, 30000);
      return () => clearInterval(intervalId);
    }
  }, [isAdmin]);

  // 删除题库
  const handleDelete = async (id: string) => {
    // 确认删除
    if (!window.confirm('确定要删除这个题库吗？此操作不可恢复。')) {
      return;
    }

    try {
      await axios.delete(`/api/question-sets/${id}`, {
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${localStorage.getItem('token')}`
        }
      });
      
      // 更新状态，移除已删除的题库
      setQuestionSets(prev => prev.filter(set => set.id !== id));
      setSuccessMessage('题库已成功删除');
      
      // 3秒后清除成功消息
      setTimeout(() => {
        setSuccessMessage(null);
      }, 3000);
    } catch (err) {
      console.error('删除题库失败:', err);
      setError(`删除题库失败: ${err.message || '未知错误'}`);
      
      // 3秒后清除错误消息
      setTimeout(() => {
        setError(null);
      }, 3000);
    }
  };

  // 开始添加题目
  const handleAddQuestion = (questionSet: QuestionSet) => {
    setCurrentQuestionSet(questionSet);
    setIsAddingQuestion(true);
  };

  // 保存新题目
  const handleSaveQuestion = async (question: Question) => {
    if (!currentQuestionSet) return;
    
    setIsSavingQuestion(true);
    setError(null);
    
    try {
      // 创建新题目对象
      const newQuestion = {
        text: question.text,
        explanation: question.explanation || '',
        questionType: question.questionType || 'single',
        orderIndex: currentQuestionSet.questions ? currentQuestionSet.questions.length : 0,
        options: question.options.map((opt, index) => ({
          text: opt.text,
          isCorrect: opt.isCorrect,
          optionIndex: opt.optionIndex || String.fromCharCode(65 + index) // A, B, C...
        }))
      };
      
      // 使用新的API端点直接添加题目
      const response = await axios.post(`/api/question-sets/${currentQuestionSet.id}/questions`, newQuestion, {
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${localStorage.getItem('token')}`
        }
      });
      
      // 获取添加的题目
      const addedQuestion = response.data.data;
      
      // 更新本地状态
      if (addedQuestion) {
        // 1. 更新当前题库的questions数组
        const updatedQuestions = Array.isArray(currentQuestionSet.questions) 
          ? [...currentQuestionSet.questions, addedQuestion] 
          : [addedQuestion];
          
        const updatedCurrentSet = {
          ...currentQuestionSet,
          questions: updatedQuestions
        };
        
        setCurrentQuestionSet(updatedCurrentSet);
        
        // 2. 更新题库列表中的对应题库
        setQuestionSets(prev => 
          prev.map(set => 
            set.id === currentQuestionSet.id ? updatedCurrentSet : set
          )
        );
      }
      
      // 重置添加题目状态
      setIsAddingQuestion(false);
      setSuccessMessage('题目添加成功');
      
      // 3秒后清除成功消息
      setTimeout(() => {
        setSuccessMessage(null);
      }, 3000);
    } catch (err) {
      console.error('添加题目失败:', err);
      setError(`添加题目失败: ${err.message || '未知错误'}`);
    } finally {
      setIsSavingQuestion(false);
    }
  };

  // 取消添加题目
  const handleCancelAddQuestion = () => {
    setCurrentQuestionSet(null);
    setIsAddingQuestion(false);
  };

  // 开始管理题目
  const handleManageQuestions = (questionSet: QuestionSet) => {
    setCurrentQuestionSet(questionSet);
    setIsManagingQuestions(true);
  };

  // 取消管理题目
  const handleCancelManageQuestions = () => {
    setCurrentQuestionSet(null);
    setIsManagingQuestions(false);
  };

  // 编辑题目
  const handleEditQuestion = async (question: Question) => {
    setEditingQuestion(question);
    setIsEditingQuestion(true);
  };

  // 保存编辑后的题目
  const handleSaveEditedQuestion = async (updatedQuestion: Question) => {
    if (!currentQuestionSet || !editingQuestion) return;
    
    setIsSavingQuestion(true);
    setError(null);
    
    try {
      // 更新题目数组
      const updatedQuestions = currentQuestionSet.questions.map(q => 
        q.id === editingQuestion.id ? updatedQuestion : q
      );
      
      // 创建更新后的题库对象
      const updatedQuestionSet = {
        ...currentQuestionSet,
        questions: updatedQuestions
      };
      
      // 发送更新请求
      const response = await axios.put(`/api/question-sets/${currentQuestionSet.id}`, updatedQuestionSet, {
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${localStorage.getItem('token')}`
        }
      });
      
      let updatedData = updatedQuestionSet;
      
      // 处理不同的响应格式
      if (response.data) {
        if (response.data.success && response.data.data) {
          updatedData = response.data.data;
        } else if (response.data.id) {
          updatedData = response.data;
        }
      }
      
      // 更新本地状态
      setQuestionSets(prev => 
        prev.map(set => 
          set.id === currentQuestionSet.id ? updatedData : set
        )
      );
      
      // 重置编辑状态
      setEditingQuestion(null);
      setIsEditingQuestion(false);
      setSuccessMessage('题目更新成功');
      
      // 3秒后清除成功消息
      setTimeout(() => {
        setSuccessMessage(null);
      }, 3000);
    } catch (err) {
      console.error('更新题目失败:', err);
      setError(`更新题目失败: ${err.message || '未知错误'}`);
    } finally {
      setIsSavingQuestion(false);
    }
  };

  // 删除题目
  const handleDeleteQuestion = async (question: Question) => {
    if (!currentQuestionSet) return;
    
    // 确认删除
    if (!window.confirm('确定要删除这个题目吗？此操作不可恢复。')) {
      return;
    }
    
    setIsSavingQuestion(true);
    setError(null);
    
    try {
      // 更新题目数组，移除要删除的题目
      const updatedQuestions = currentQuestionSet.questions.filter(q => q.id !== question.id);
      
      // 创建更新后的题库对象
      const updatedQuestionSet = {
        ...currentQuestionSet,
        questions: updatedQuestions
      };
      
      // 发送更新请求
      await axios.put(`/api/question-sets/${currentQuestionSet.id}`, updatedQuestionSet, {
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${localStorage.getItem('token')}`
        }
      });
      
      // 更新本地状态
      setQuestionSets(prev => 
        prev.map(set => 
          set.id === currentQuestionSet.id ? updatedQuestionSet : set
        )
      );
      
      setSuccessMessage('题目删除成功');
      
      // 3秒后清除成功消息
      setTimeout(() => {
        setSuccessMessage(null);
      }, 3000);
    } catch (err) {
      console.error('删除题目失败:', err);
      setError('删除题目失败，请稍后重试');
    } finally {
      setIsSavingQuestion(false);
    }
  };

  // 取消编辑题目
  const handleCancelEditQuestion = () => {
    setEditingQuestion(null);
    setIsEditingQuestion(false);
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

  // 渲染题库列表
  const renderQuestionSets = () => {
    if (loading) {
      return (
        <div className="text-center py-8">
          <p className="text-gray-500">加载中...</p>
        </div>
      );
    }
    
    if (error) {
      return (
        <div className="bg-red-50 p-8 text-center rounded">
          <p className="text-red-500 mb-2">加载出错</p>
          <p className="text-gray-700">{error}</p>
          <button 
            onClick={() => window.location.reload()}
            className="mt-4 px-4 py-2 bg-blue-600 text-white rounded hover:bg-blue-700"
          >
            重新加载
          </button>
        </div>
      );
    }
    
    if (!questionSets || !Array.isArray(questionSets) || questionSets.length === 0) {
      return (
        <div className="bg-gray-50 p-8 text-center rounded">
          <p className="text-gray-500 mb-2">暂无题库</p>
          <p className="text-gray-400 text-sm">您可以在"添加题库"选项卡中创建新题库</p>
        </div>
      );
    }

    return (
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
        {questionSets.map(questionSet => (
          <div 
            key={questionSet.id}
            className="bg-white border border-gray-200 rounded-lg shadow-sm overflow-hidden"
          >
            <div className="p-6">
              <div className="flex items-center justify-between mb-4">
                <div className="flex items-center">
                  <span className="text-2xl mr-3">{questionSet.icon || '📚'}</span>
                  <h3 className="text-lg font-medium text-gray-900">{questionSet.title}</h3>
                </div>
                <span className={`px-2 py-1 text-xs rounded-full ${getCategoryColor(questionSet.category)}`}>
                  {questionSet.category}
                </span>
              </div>
              
              <p className="text-gray-600 mb-4">{questionSet.description}</p>
              
              <div className="flex items-center justify-between text-sm text-gray-500 mb-4">
                <span>题目数量: {questionSet.questionCount || 0}</span>
                {questionSet.isPaid && (
                  <span className="text-yellow-600">¥{questionSet.price}</span>
                )}
              </div>
              
              <div className="flex space-x-2">
                <button
                  onClick={() => {
                    setCurrentQuestionSet(questionSet);
                    setIsAddingQuestion(true);
                  }}
                  className="flex-1 px-4 py-2 bg-blue-600 text-white rounded hover:bg-blue-700 transition-colors"
                >
                  添加题目
                </button>
                <button
                  onClick={() => handleManageQuestions(questionSet)}
                  className="flex-1 px-4 py-2 bg-gray-200 text-gray-700 rounded hover:bg-gray-300 transition-colors"
                >
                  管理题目
                </button>
              </div>
            </div>
          </div>
        ))}
      </div>
    );
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
      
      {error && !loading && (
        <div className="bg-red-100 border border-red-400 text-red-700 px-4 py-3 rounded mb-4">
          <p className="font-medium">加载出错</p>
          <p>{error}</p>
          <button 
            onClick={() => window.location.reload()}
            className="mt-2 px-3 py-1 bg-red-200 text-red-800 rounded hover:bg-red-300"
          >
            重新加载页面
          </button>
        </div>
      )}

      {/* 添加题目模态框 */}
      {isAddingQuestion && currentQuestionSet && (
        <div className="mb-6 p-6 bg-gray-50 border border-gray-200 rounded-lg">
          <div className="flex justify-between items-center mb-4">
            <h3 className="text-lg font-medium">
              添加题目到: <span className="text-blue-600">{currentQuestionSet.title}</span>
            </h3>
            <button 
              onClick={handleCancelAddQuestion}
              className="text-gray-500 hover:text-gray-700"
            >
              关闭
            </button>
          </div>
          
          <AddQuestion
            onAddQuestion={handleSaveQuestion}
            onCancel={handleCancelAddQuestion}
            questionCount={Array.isArray(currentQuestionSet.questions) ? currentQuestionSet.questions.length : 0}
            isAdding={isSavingQuestion}
            questionSetId={currentQuestionSet.id}
          />
        </div>
      )}

      {/* 编辑题目模态框 */}
      {isEditingQuestion && editingQuestion && currentQuestionSet && (
        <div className="mb-6 p-6 bg-gray-50 border border-gray-200 rounded-lg">
          <div className="flex justify-between items-center mb-4">
            <h3 className="text-lg font-medium">
              编辑题目: <span className="text-blue-600">{currentQuestionSet.title}</span>
            </h3>
            <button 
              onClick={handleCancelEditQuestion}
              className="text-gray-500 hover:text-gray-700"
            >
              关闭
            </button>
          </div>
          
          <EditQuestion
            question={editingQuestion}
            onSave={handleSaveEditedQuestion}
            onCancel={handleCancelEditQuestion}
          />
        </div>
      )}

      {/* 管理题目模态框 */}
      {isManagingQuestions && currentQuestionSet && (
        <div className="mb-6 p-6 bg-gray-50 border border-gray-200 rounded-lg">
          <div className="flex justify-between items-center mb-4">
            <h3 className="text-lg font-medium">
              管理题目: <span className="text-blue-600">{currentQuestionSet.title}</span>
            </h3>
            <button 
              onClick={handleCancelManageQuestions}
              className="text-gray-500 hover:text-gray-700"
            >
              关闭
            </button>
          </div>
          
          <div className="space-y-4">
            {Array.isArray(currentQuestionSet.questions) && currentQuestionSet.questions.length > 0 ? (
              currentQuestionSet.questions.map((question, index) => (
                <div key={question.id} className="p-4 bg-white rounded-lg border border-gray-200">
                  <div className="flex justify-between items-start">
                    <div className="flex-1">
                      <p className="font-medium text-gray-800">#{index + 1}. {question.text}</p>
                      <p className="text-sm text-gray-500 mt-1">类型: {question.questionType === 'single' ? '单选题' : '多选题'}</p>
                      {question.explanation && (
                        <p className="text-sm text-gray-600 mt-1">解析: {question.explanation}</p>
                      )}
                    </div>
                    <div className="flex space-x-2">
                      <button
                        onClick={() => handleEditQuestion(question)}
                        className="text-blue-600 hover:text-blue-800"
                      >
                        编辑
                      </button>
                      <button
                        onClick={() => handleDeleteQuestion(question)}
                        className="text-red-600 hover:text-red-800"
                      >
                        删除
                      </button>
                    </div>
                  </div>
                </div>
              ))
            ) : (
              <div className="text-center py-8">
                <p className="text-gray-500">该题库暂无题目</p>
              </div>
            )}
          </div>
        </div>
      )}
      
      {/* 题库列表 */}
      {renderQuestionSets()}
    </div>
  );
};

export default ManageQuestionSets; 