import React, { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { QuestionSet, Question } from '../types';
import { useUser } from '../contexts/UserContext';
import PaymentModal from './PaymentModal';
import { questionSetApi } from '../utils/api';

// 获取选项标签（A, B, C, D...）
const getOptionLabel = (index: number): string => {
  return String.fromCharCode(65 + index); // 65 是 'A' 的 ASCII 码
};

function QuizPage(): React.ReactNode {
  const { questionSetId } = useParams<{ questionSetId: string }>();
  const navigate = useNavigate();
  const { user, addProgress, hasAccessToQuestionSet, getRemainingAccessDays } = useUser();
  
  const [currentQuestionIndex, setCurrentQuestionIndex] = useState(0);
  const [selectedOptions, setSelectedOptions] = useState<string[]>([]);
  const [showExplanation, setShowExplanation] = useState(false);
  const [answeredQuestions, setAnsweredQuestions] = useState<number[]>([]);
  const [correctAnswers, setCorrectAnswers] = useState<number>(0);
  const [quizComplete, setQuizComplete] = useState(false);
  const [questionSet, setQuestionSet] = useState<QuestionSet | null>(null);
  const [questions, setQuestions] = useState<Question[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [showPaymentModal, setShowPaymentModal] = useState(false);
  const [hasAccessToFullQuiz, setHasAccessToFullQuiz] = useState(false);
  const [trialEnded, setTrialEnded] = useState(false);
  
  useEffect(() => {
    const fetchQuestionSet = async () => {
      if (!questionSetId) {
        setError('无效的题库ID');
        setLoading(false);
        return;
      }
      
      try {
        setLoading(true);
        // 尝试从API获取题库详情
        const response = await questionSetApi.getQuestionSetById(questionSetId);
        
        if (response.success && response.data) {
          setQuestionSet(response.data);
          
          // 检查题目数据
          if (response.data.questions && response.data.questions.length > 0) {
            console.log("获取到题目:", response.data.questions.length);
            
            // 检查并处理题目选项
            const processedQuestions = response.data.questions.map(q => {
              // 确保选项存在
              if (!q.options || !Array.isArray(q.options)) {
                console.warn("题目缺少选项:", q.id);
                q.options = [];
              }
              
              // 处理选项
              const processedOptions = q.options.map((opt, index) => ({
                id: opt.id || opt.optionIndex || `option-${Math.random().toString(36).substr(2, 9)}`,
                text: opt.text,
                isCorrect: opt.isCorrect,
                label: getOptionLabel(index) // 添加字母标签
              }));
              
              // 处理正确答案
              let correctAnswer;
              if (q.questionType === 'single') {
                const correctOpt = q.options.find(o => o.isCorrect);
                correctAnswer = correctOpt ? (correctOpt.id || correctOpt.optionIndex || '') : '';
              } else {
                correctAnswer = q.options
                  .filter(o => o.isCorrect)
                  .map(o => o.id || o.optionIndex || '')
                  .filter(id => id !== '');
              }
              
              return {
                ...q,
                options: processedOptions,
                correctAnswer
              };
            });
            
            setQuestions(processedQuestions);
          } else {
            console.error("题库中没有题目");
            setError('此题库不包含任何题目');
          }
        } else {
          // 如果API请求失败，我们无法使用本地数据，只能显示错误
          setError('无法加载题库数据');
        }
      } catch (error) {
        console.error('获取题库详情失败:', error);
        setError('获取题库数据失败');
      } finally {
        setLoading(false);
      }
    };
    
    fetchQuestionSet();
  }, [questionSetId]);
  
  // 检查用户访问权限
  useEffect(() => {
    if (!questionSet || !user) return;
    
    // 检查用户是否有权限访问此题库
    const hasAccess = hasAccessToQuestionSet(questionSet.id);
    setHasAccessToFullQuiz(hasAccess);
    
    // 获取剩余天数，但不需要存储
    // const days = getRemainingAccessDays(questionSet.id);
    
    // 如果是免费题库，直接授权访问
    if (!questionSet.isPaid) {
      setHasAccessToFullQuiz(true);
    }
  }, [questionSet, user, hasAccessToQuestionSet, getRemainingAccessDays]);
  
  // 处理试用题目限制
  useEffect(() => {
    if (!questionSet || !questions.length || hasAccessToFullQuiz) return;
    
    // 如果用户已回答的题目数量超过试用题数限制，显示付费提示
    if (
      questionSet.isPaid && 
      questionSet.trialQuestions && 
      answeredQuestions.length >= questionSet.trialQuestions &&
      !hasAccessToFullQuiz
    ) {
      setTrialEnded(true);
    }
  }, [answeredQuestions, questionSet, hasAccessToFullQuiz, questions]);
  
  // 处理选择选项
  const handleOptionSelect = (optionId: string) => {
    const currentQuestion = questions[currentQuestionIndex];
    
    if (currentQuestion.questionType === 'single') {
      setSelectedOptions([optionId]);
    } else {
      // 多选题，切换选中状态
      if (selectedOptions.includes(optionId)) {
        setSelectedOptions(selectedOptions.filter(id => id !== optionId));
      } else {
        setSelectedOptions([...selectedOptions, optionId]);
      }
    }
  };
  
  // 提交答案检查
  const checkAnswer = () => {
    if (selectedOptions.length === 0) return;
    
    const currentQuestion = questions[currentQuestionIndex];
    let isCorrect = false;
    
    if (currentQuestion.questionType === 'single') {
      // 单选题
      isCorrect = selectedOptions[0] === currentQuestion.correctAnswer;
    } else {
      // 多选题 - 所有选项需要完全匹配
      const correctOptions = Array.isArray(currentQuestion.correctAnswer) 
        ? currentQuestion.correctAnswer 
        : [currentQuestion.correctAnswer];
      
      isCorrect = 
        selectedOptions.length === correctOptions.length && 
        selectedOptions.every(option => correctOptions.includes(option));
    }
    
    setShowExplanation(true);
    
    // 更新已回答的题目和正确答案数
    if (!answeredQuestions.includes(currentQuestionIndex)) {
      setAnsweredQuestions([...answeredQuestions, currentQuestionIndex]);
      if (isCorrect) {
        setCorrectAnswers(correctAnswers + 1);
      }
    }
  };
  
  // 进入下一题
  const goToNextQuestion = () => {
    setSelectedOptions([]);
    setShowExplanation(false);
    
    if (currentQuestionIndex < questions.length - 1) {
      setCurrentQuestionIndex(currentQuestionIndex + 1);
    } else {
      // 完成测试
      completeQuiz();
    }
  };
  
  // 完成测试
  const completeQuiz = async () => {
    if (!user || !questionSet) return;
    
    setQuizComplete(true);
    
    // 保存进度
    try {
      await addProgress({
        questionSetId: questionSet.id,
        completedQuestions: answeredQuestions.length,
        totalQuestions: questions.length,
        correctAnswers: correctAnswers
      });
    } catch (error) {
      console.error('保存进度失败:', error);
    }
  };
  
  if (loading) {
    return (
      <div className="flex justify-center items-center h-96">
        <div className="animate-spin rounded-full h-12 w-12 border-t-2 border-b-2 border-blue-500"></div>
      </div>
    );
  }
  
  if (error || !questionSet || questions.length === 0) {
    return (
      <div className="container mx-auto px-4 py-8">
        <div className="bg-red-100 border border-red-400 text-red-700 px-4 py-3 rounded relative">
          <span className="block sm:inline">{error || '无法加载题库数据'}</span>
        </div>
        <button
          onClick={() => navigate('/')}
          className="mt-4 bg-blue-600 text-white px-4 py-2 rounded hover:bg-blue-700"
        >
          返回首页
        </button>
      </div>
    );
  }
  
  const currentQuestion = questions[currentQuestionIndex];
  
  if (quizComplete) {
    const score = Math.round((correctAnswers / questions.length) * 100);
    
    return (
      <div className="container mx-auto px-4 py-8">
        <h1 className="text-2xl font-bold text-center mb-8">测试完成！</h1>
        
        <div className="bg-white rounded-lg shadow p-6 mb-8">
          <h2 className="text-xl font-semibold mb-4">{questionSet.title}</h2>
          
          <div className="flex flex-col md:flex-row md:items-center justify-between mb-6">
            <div className="mb-4 md:mb-0">
              <p className="text-gray-600">总题数: <span className="font-medium">{questions.length}</span></p>
              <p className="text-gray-600">正确答案: <span className="font-medium">{correctAnswers}</span></p>
            </div>
            
            <div className="text-center bg-blue-50 p-4 rounded-lg">
              <p className="text-lg text-gray-700">得分</p>
              <p className="text-3xl font-bold text-blue-600">{score}%</p>
            </div>
          </div>
          
          <div className="flex flex-wrap gap-3 mt-6">
            <button
              onClick={() => {
                setCurrentQuestionIndex(0);
                setSelectedOptions([]);
                setShowExplanation(false);
                setAnsweredQuestions([]);
                setCorrectAnswers(0);
                setQuizComplete(false);
              }}
              className="bg-blue-600 text-white px-4 py-2 rounded hover:bg-blue-700"
            >
              重新测试
            </button>
            
            <button
              onClick={() => navigate('/')}
              className="bg-gray-100 text-gray-800 px-4 py-2 rounded hover:bg-gray-200"
            >
              返回首页
            </button>
          </div>
        </div>
      </div>
    );
  }
  
  // 如果达到试用上限并且没有购买，显示购买提示
  if (trialEnded && !hasAccessToFullQuiz) {
    return (
      <div className="container mx-auto px-4 py-8">
        <div className="bg-white rounded-lg shadow p-6">
          <h2 className="text-xl font-semibold mb-4">{questionSet.title}</h2>
          <div className="bg-yellow-50 border-l-4 border-yellow-400 p-4 mb-6">
            <div className="flex">
              <div className="flex-shrink-0">
                <svg className="h-5 w-5 text-yellow-400" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20" fill="currentColor">
                  <path fillRule="evenodd" d="M18 10a8 8 0 11-16 0 8 8 0 0116 0zm-7-4a1 1 0 11-2 0 1 1 0 012 0zM9 9a1 1 0 000 2v3a1 1 0 001 1h1a1 1 0 100-2v-3a1 1 0 00-1-1H9z" clipRule="evenodd" />
                </svg>
              </div>
              <div className="ml-3">
                <p className="text-sm text-yellow-700">
                  您已完成免费试用的 {questionSet.trialQuestions} 道题目。
                  要继续访问完整题库，请购买完整版。
                </p>
              </div>
            </div>
          </div>
          
          <div className="bg-white border rounded-lg p-4 mb-6">
            <div className="flex justify-between items-center mb-2">
              <h3 className="text-lg font-medium">完整题库访问</h3>
              <span className="text-xl font-bold text-green-600">¥{questionSet.price}</span>
            </div>
            <p className="text-gray-600 mb-4">购买后可访问全部 {questions.length} 道题目，有效期6个月。</p>
            <button 
              onClick={() => setShowPaymentModal(true)}
              className="w-full bg-blue-600 text-white py-2 px-4 rounded hover:bg-blue-700"
            >
              立即购买
            </button>
          </div>
          
          <div className="flex justify-between">
            <button
              onClick={() => navigate('/')}
              className="bg-gray-100 text-gray-800 px-4 py-2 rounded hover:bg-gray-200"
            >
              返回首页
            </button>
            {user ? null : (
              <button
                onClick={() => navigate('/login')}
                className="bg-green-600 text-white px-4 py-2 rounded hover:bg-green-700"
              >
                登录/注册
              </button>
            )}
          </div>
        </div>
        
        {/* 支付模态窗口 */}
        {showPaymentModal && (
          <PaymentModal
            isOpen={showPaymentModal}
            questionSet={questionSet}
            onClose={() => setShowPaymentModal(false)}
            onSuccess={() => {
              setHasAccessToFullQuiz(true);
              setTrialEnded(false);
            }}
          />
        )}
      </div>
    );
  }
  
  return (
    <div className="container mx-auto px-4 py-8">
      <div className="mb-6">
        <div className="flex justify-between items-center mb-4">
          <h1 className="text-2xl font-bold">{questionSet.title}</h1>
          <button
            onClick={() => navigate('/')}
            className="bg-gray-100 text-gray-800 px-3 py-1.5 rounded text-sm hover:bg-gray-200"
          >
            返回首页
          </button>
        </div>
        
        {!questionSet.isPaid ? (
          <p className="text-sm text-gray-600 mb-2">此题库为免费访问，包含 {questions.length} 道题目</p>
        ) : !hasAccessToFullQuiz && questionSet.trialQuestions && questionSet.trialQuestions > 0 ? (
          <div className="bg-yellow-50 border-l-4 border-yellow-400 p-4 mb-4">
            <p className="text-sm text-yellow-700">
              您正在试用此题库，可免费回答 {questionSet.trialQuestions} 道题目
              （当前已回答 {answeredQuestions.length} / {questionSet.trialQuestions}）
            </p>
          </div>
        ) : null}
        
        {/* 进度条 */}
        <div className="w-full bg-gray-200 rounded-full h-2.5 mb-4">
          <div 
            className="bg-blue-600 h-2.5 rounded-full" 
            style={{ width: `${(currentQuestionIndex / questions.length) * 100}%` }}
          />
        </div>
        
        <div className="flex justify-between text-sm text-gray-500">
          <span>题目 {currentQuestionIndex + 1} / {questions.length}</span>
          <span>已回答 {answeredQuestions.length} 题</span>
        </div>
      </div>
      
      {/* 当前题目 */}
      <div className="bg-white rounded-lg shadow p-6 mb-6">
        <h2 className="text-lg font-semibold mb-4">
          {currentQuestionIndex + 1}. {currentQuestion.text}
          <span className="ml-2 px-2 py-0.5 bg-blue-100 text-blue-800 text-xs font-medium rounded">
            {currentQuestion.questionType === 'single' ? '单选题' : '多选题'}
          </span>
        </h2>
        
        {/* 选项列表 */}
        <div className="space-y-3 mb-6">
          {currentQuestion.options.map((option, index) => {
            const isSelected = selectedOptions.includes(option.id);
            return (
              <div 
                key={option.id}
                onClick={() => {
                  if (!showExplanation) {
                    handleOptionSelect(option.id);
                  }
                }}
                className={`p-3 border rounded-lg cursor-pointer flex justify-between items-center ${
                  showExplanation
                    ? option.isCorrect
                      ? 'bg-green-50 border-green-300'
                      : isSelected
                        ? 'bg-red-50 border-red-300'
                        : 'border-gray-200'
                    : isSelected
                      ? 'bg-blue-50 border-blue-300'
                      : 'border-gray-200 hover:border-blue-200 hover:bg-blue-50'
                }`}
              >
                <div className="flex items-center">
                  <span className={`w-6 h-6 flex items-center justify-center rounded-full border mr-3 ${
                    isSelected ? 'bg-blue-500 text-white border-blue-500' : 'border-gray-300'
                  }`}>
                    {option.label || getOptionLabel(index)}
                  </span>
                  <span>{option.text}</span>
                </div>
                
                {/* 正确/错误标记（只在显示解析时） */}
                {showExplanation && (
                  option.isCorrect ? (
                    <svg className="h-5 w-5 text-green-500 ml-2" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20" fill="currentColor">
                      <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z" clipRule="evenodd" />
                    </svg>
                  ) : isSelected ? (
                    <svg className="h-5 w-5 text-red-500 ml-2" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20" fill="currentColor">
                      <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zM8.707 7.293a1 1 0 00-1.414 1.414L8.586 10l-1.293 1.293a1 1 0 101.414 1.414L10 11.414l1.293 1.293a1 1 0 001.414-1.414L11.414 10l1.293-1.293a1 1 0 00-1.414-1.414L10 8.586 8.707 7.293z" clipRule="evenodd" />
                    </svg>
                  ) : null
                )}
              </div>
            );
          })}
        </div>
        
        {/* 题目解析 */}
        {showExplanation && (
          <div className="bg-blue-50 p-4 rounded-lg mb-6">
            <h3 className="text-md font-medium text-blue-800 mb-2">解析</h3>
            <p className="text-blue-700">{currentQuestion.explanation}</p>
          </div>
        )}
        
        {/* 按钮区域 */}
        <div className="flex justify-between">
          {!showExplanation ? (
            <button
              onClick={checkAnswer}
              disabled={selectedOptions.length === 0}
              className={`bg-blue-600 text-white px-4 py-2 rounded hover:bg-blue-700 ${
                selectedOptions.length === 0 ? 'opacity-50 cursor-not-allowed' : ''
              }`}
            >
              提交答案
            </button>
          ) : (
            <button
              onClick={goToNextQuestion}
              className="bg-green-600 text-white px-4 py-2 rounded hover:bg-green-700"
            >
              {currentQuestionIndex < questions.length - 1 ? '下一题' : '完成测试'}
            </button>
          )}
        </div>
      </div>
    </div>
  );
}

export default QuizPage; 