import { useState, useEffect, useRef } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { IQuestionSet, Question } from '../types/index';
import { useUser } from '../contexts/UserContext';
import PaymentModal from './PaymentModal';
import { questionSetApi } from '../utils/api';
import { useSocket } from '../contexts/SocketContext';
import { userProgressService } from '../services/UserProgressService';
import { useUserProgress } from '../contexts/UserProgressContext';

// 定义答题记录类型
interface AnsweredQuestion {
  index: number;
  isCorrect: boolean;
}

// 获取选项标签（A, B, C, D...）
const getOptionLabel = (index: number): string => {
  return String.fromCharCode(65 + index); // 65 是 'A' 的 ASCII 码
};

function QuizPage(): JSX.Element {
  const { questionSetId } = useParams<{ questionSetId: string }>();
  const navigate = useNavigate();
  const { user, hasAccessToQuestionSet } = useUser();
  const { socket } = useSocket();
  const { fetchUserProgress } = useUserProgress();
  
  const [currentQuestionIndex, setCurrentQuestionIndex] = useState(0);
  const [selectedOptions, setSelectedOptions] = useState<string[]>([]);
  const [showExplanation, setShowExplanation] = useState(false);
  const [answeredQuestions, setAnsweredQuestions] = useState<AnsweredQuestion[]>([]);
  const [correctAnswers, setCorrectAnswers] = useState<number>(0);
  const [quizComplete, setQuizComplete] = useState(false);
  const [questionSet, setQuestionSet] = useState<IQuestionSet | null>(null);
  const [questions, setQuestions] = useState<Question[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [showPaymentModal, setShowPaymentModal] = useState(false);
  const [hasAccessToFullQuiz, setHasAccessToFullQuiz] = useState(false);
  const [trialEnded, setTrialEnded] = useState(false);
  const [questionStartTime, setQuestionStartTime] = useState(0);
  const timeoutId = useRef<NodeJS.Timeout>();
  
  // 添加 Socket 监听
  useEffect(() => {
    if (!socket || !questionSet) return;

    // 监听题库访问状态更新
    const handleQuestionSetAccessUpdate = (data: { 
      questionSetId: string;
      hasAccess: boolean;
    }) => {
      if (data.questionSetId === questionSet.id) {
        setHasAccessToFullQuiz(data.hasAccess);
      }
    };

    // 监听购买成功事件
    const handlePurchaseSuccess = (data: {
      questionSetId: string;
      purchaseId: string;
      expiryDate: string;
    }) => {
      if (data.questionSetId === questionSet.id) {
        setHasAccessToFullQuiz(true);
      }
    };

    socket.on('questionSet:accessUpdate', handleQuestionSetAccessUpdate);
    socket.on('purchase:success', handlePurchaseSuccess);

    return () => {
      socket.off('questionSet:accessUpdate', handleQuestionSetAccessUpdate);
      socket.off('purchase:success', handlePurchaseSuccess);
    };
  }, [socket, questionSet]);

  // 检查访问权限
  const checkAccess = async () => {
    if (!questionSet) return;
    
    // 如果是免费题库，直接授权访问
    if (!questionSet.isPaid) {
      setHasAccessToFullQuiz(true);
      return;
    }
    
    // 未登录用户不检查权限，在需要时会提示登录
    if (!user) {
      setHasAccessToFullQuiz(false);
      return;
    }
    
    // 检查用户是否有访问权限
    const hasAccess = hasAccessToQuestionSet(questionSet.id);
    setHasAccessToFullQuiz(hasAccess);
    
    // 如果没有访问权限，检查试用状态
    if (!hasAccess && questionSet.trialQuestions) {
      setTrialEnded(answeredQuestions.length >= questionSet.trialQuestions);
    }

    // 通过 Socket 检查访问权限
    if (socket && user) {
      socket.emit('questionSet:checkAccess', {
        userId: user.id,
        questionSetId: questionSet.id
      });
    }
  };
  
  // 在获取题库数据后检查访问权限
  useEffect(() => {
    checkAccess();
  }, [questionSet, user, answeredQuestions.length]);
  
  // 获取题库和题目数据
  useEffect(() => {
    const fetchQuestionSet = async () => {
      if (!questionSetId) {
        setError('无效的题库ID');
        setLoading(false);
        return;
      }
      
      try {
        setLoading(true);
        // 获取题库详情
        const response = await questionSetApi.getQuestionSetById(questionSetId);
        
        if (response.success && response.data) {
          const questionSetData: IQuestionSet = {
            id: response.data.id,
            title: response.data.title,
            description: response.data.description,
            category: response.data.category,
            icon: response.data.icon,
            questions: response.data.questions || [],
            isPaid: response.data.isPaid || false,
            price: response.data.price || 0,
            isFeatured: response.data.isFeatured || false,
            featuredCategory: response.data.featuredCategory,
            hasAccess: false,
            trialQuestions: response.data.trialQuestions,
            questionCount: response.data.questions?.length || 0,
            createdAt: new Date(),
            updatedAt: new Date()
          };
          setQuestionSet(questionSetData);
          
          // 使用题库中包含的题目数据
          if (questionSetData.questions && questionSetData.questions.length > 0) {
            console.log("获取到题目:", questionSetData.questions.length);
            
            // 处理题目选项并设置数据
            const processedQuestions = questionSetData.questions.map(q => {
              // 确保选项存在
              if (!q.options || !Array.isArray(q.options)) {
                console.warn("题目缺少选项:", q.id);
                q.options = [];
              }
              
              // 处理选项 - 使用固定的ID生成方式
              const processedOptions = q.options.map((opt, index) => {
                // 使用题目ID和选项索引生成固定ID
                const optionId = opt.id || `q${q.id}-opt${index}`;
                return {
                  id: optionId,
                  text: opt.text,
                  isCorrect: opt.isCorrect,
                  label: getOptionLabel(index) // 添加字母标签
                };
              });
              
              return {
                ...q,
                options: processedOptions,
                // 确保correctAnswer字段与选项ID对应
                correctAnswer: q.questionType === 'single' 
                  ? processedOptions.find(opt => opt.isCorrect)?.id
                  : processedOptions.filter(opt => opt.isCorrect).map(opt => opt.id)
              };
            });
            
            setQuestions(processedQuestions);
          } else {
            console.error("题库中没有题目");
            setError('此题库不包含任何题目');
          }
        } else {
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
  
  // 监听题库更新
  useEffect(() => {
    if (!socket || !questionSetId) return;
    
    const handleQuestionSetUpdate = (updatedQuestionSet: IQuestionSet) => {
      if (updatedQuestionSet.id === questionSetId) {
        setQuestionSet(updatedQuestionSet);
        checkAccess();
      }
    };
    
    socket.on('questionSet:update', handleQuestionSetUpdate);
    
    return () => {
      socket.off('questionSet:update', handleQuestionSetUpdate);
    };
  }, [socket, questionSetId, questionSet]);
  
  // 在加载完题目数据后设置questionStartTime
  useEffect(() => {
    if (questions.length > 0 && !loading) {
      setQuestionStartTime(Date.now());
    }
  }, [questions, loading]);
  
  // 处理选择选项
  const handleOptionSelect = (optionId: string) => {
    // 如果试用已结束且没有购买，不允许继续答题
    if (trialEnded && !hasAccessToFullQuiz) {
      return;
    }
    
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
  
  // 处理答案提交
  const handleAnswerSubmit = async (): Promise<void> => {
    if (!currentQuestion || !user || !socket || !questionSet) return;

    // 判断答案是否正确
    let isCorrect = false;
    
    if (currentQuestion.questionType === 'single') {
      // 单选题：检查选中的选项是否是正确选项
      const selectedOption = selectedOptions[0];
      const correctOption = currentQuestion.options.find(opt => opt.isCorrect);
      isCorrect = selectedOption === correctOption?.id;
    } else {
      // 多选题：检查选中的选项是否与所有正确选项完全匹配
      const correctOptionIds = currentQuestion.options
        .filter(opt => opt.isCorrect)
        .map(opt => opt.id);
      
      isCorrect = 
        correctOptionIds.length === selectedOptions.length && 
        correctOptionIds.every(id => selectedOptions.includes(id)) &&
        selectedOptions.every(id => correctOptionIds.includes(id));
    }

    const timeSpent = Math.floor((Date.now() - questionStartTime) / 1000);

    try {
      // 保存进度到后端
      const saveResponse = await userProgressService.saveProgress({
        questionId: String(currentQuestion.id),
        questionSetId: questionSet.id,
        selectedOption: currentQuestion.questionType === 'single' 
          ? selectedOptions[0] 
          : selectedOptions,
        isCorrect,
        timeSpent
      });

      if (!saveResponse.success) {
        throw new Error(saveResponse.message || '保存进度失败');
      }

      // 立即更新本地进度，并等待更新完成
      try {
        const updatedProgress = await fetchUserProgress(true);
        if (!updatedProgress) {
          console.warn('未能获取更新后的进度数据');
        }
      } catch (updateError) {
        console.error('更新本地进度失败:', updateError);
        // 继续执行，不中断用户答题流程
      }

      // 发送进度更新事件
      socket.emit('progress:update', { userId: user.id });

      // 更新本地状态
      if (isCorrect) {
        setCorrectAnswers(prev => prev + 1);
      }
      
      // 显示解析
      setShowExplanation(true);

      // 更新已回答问题列表
      setAnsweredQuestions(prev => [...prev, {
        index: currentQuestionIndex,
        isCorrect
      }]);

      // 答对自动跳到下一题
      if (isCorrect) {
        if (timeoutId.current) {
          clearTimeout(timeoutId.current);
        }
        timeoutId.current = setTimeout(() => {
          goToNextQuestion();
        }, 1000);
      }
    } catch (error) {
      console.error('保存进度失败:', error);
      setError('保存进度失败，请重试');
    }
  };
  
  // 进入下一题
  const goToNextQuestion = () => {
    // 设置下一题的开始时间
    setQuestionStartTime(Date.now());
    
    // 清除选项和解析状态
    setSelectedOptions([]);
    setShowExplanation(false);
    
    if (currentQuestionIndex < questions.length - 1) {
      setCurrentQuestionIndex(currentQuestionIndex + 1);
    } else {
      // 完成测试
      setQuizComplete(true);
    }
  };
  
  // 重新开始测试
  const handleReset = async () => {
    // 清除任何现有的定时器
    if (timeoutId.current) {
      clearTimeout(timeoutId.current);
      timeoutId.current = undefined;
    }

    // 重置所有状态
    setCurrentQuestionIndex(0);
    setSelectedOptions([]);
    setShowExplanation(false);
    setAnsweredQuestions([]);
    setCorrectAnswers(0);
    setQuizComplete(false);
    setQuestionStartTime(Date.now());
    
    console.log('重置答题状态，准备刷新进度数据');
    
    // 重置进度统计 - 确保先清除再重新加载
    if (user && questionSet) {
      try {
        // 确保强制刷新进度数据
        await fetchUserProgress(true);
        console.log('重置后成功刷新进度数据');
      } catch (error) {
        console.error('重置后刷新进度数据失败:', error);
        // 显示友好的错误提示
        setError('刷新进度数据失败，请尝试重新加载页面');
      }
    }
  };
  
  // 组件卸载时清理
  useEffect(() => {
    return () => {
      // 清除超时定时器
      if (timeoutId.current) {
        clearTimeout(timeoutId.current);
      }
    };
  }, []);
  
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
              onClick={handleReset}
              className="bg-blue-600 text-white px-4 py-2 rounded hover:bg-blue-700"
            >
              重新开始
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
                  if (!showExplanation && !(trialEnded && !hasAccessToFullQuiz)) {
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
              onClick={() => handleAnswerSubmit()}
              disabled={selectedOptions.length === 0 || (trialEnded && !hasAccessToFullQuiz)}
              className={`bg-blue-600 text-white px-4 py-2 rounded hover:bg-blue-700 ${
                selectedOptions.length === 0 || (trialEnded && !hasAccessToFullQuiz) ? 'opacity-50 cursor-not-allowed' : ''
              }`}
            >
              提交答案
            </button>
          ) : (
            <button
              onClick={goToNextQuestion}
              disabled={trialEnded && !hasAccessToFullQuiz}
              className={`bg-green-600 text-white px-4 py-2 rounded hover:bg-green-700 ${
                trialEnded && !hasAccessToFullQuiz ? 'opacity-50 cursor-not-allowed' : ''
              }`}
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