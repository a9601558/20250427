import { useState, useEffect, useRef, useCallback } from 'react';
import { useParams, useNavigate, useLocation } from 'react-router-dom';
import { IQuestionSet, Question } from '../types/index';
import { useUser } from '../contexts/UserContext';
import PaymentModal from './PaymentModal';
import { questionSetApi } from '../utils/api';
import { useSocket } from '../contexts/SocketContext';
import { userProgressService, wrongAnswerService } from '../services/api';
import { useUserProgress } from '../contexts/UserProgressContext';
import RedeemCodeForm from './RedeemCodeForm';
import QuestionCard from './QuestionCard';
import { toast } from 'react-toastify';
import { Socket } from 'socket.io-client';

// 定义答题记录类型
interface AnsweredQuestion {
  index: number;
  questionIndex?: number;
  isCorrect: boolean;
  selectedOption: string | string[];
}

// 获取选项标签（A, B, C, D...）
const getOptionLabel = (index: number): string => {
  return String.fromCharCode(65 + index); // 65 是 'A' 的 ASCII 码
};

// 添加对两种字段命名的兼容处理
const getQuestions = (data: any) => {
  // 首先检查新的字段名
  if (data.questionSetQuestions && data.questionSetQuestions.length > 0) {
    return data.questionSetQuestions;
  }
  // 然后检查旧的字段名
  if (data.questions && data.questions.length > 0) {
    return data.questions;
  }
  // 都没有则返回空数组
  return [];
};

// 添加 ProgressData 接口定义
interface ProgressData {
  lastQuestionIndex?: number;
  answeredQuestions?: Array<{
    index: number;
    questionIndex?: number;
    isCorrect: boolean;
    selectedOption: string | string[];
  }>;
  [key: string]: any;
}

// 添加 QuestionCard 的 props 类型定义
interface QuestionCardProps {
  question: Question;
  questionNumber: number;
  totalQuestions: number;
  onAnswerSubmitted: (isCorrect: boolean, selectedOption: string | string[]) => void;
  onNext: () => void;
  onJumpToQuestion?: (index: number) => void;
  isPaid?: boolean;
  hasFullAccess?: boolean;
  questionSetId: string;
  isLast: boolean;
  trialQuestions?: number;
  isSubmittingAnswer?: boolean;
}

function QuizPage(): JSX.Element {
  const { questionSetId } = useParams<{ questionSetId: string }>();
  const navigate = useNavigate();
  const location = useLocation();
  const { user, hasAccessToQuestionSet, syncAccessRights } = useUser();
  const { socket } = useSocket() as { socket: Socket | null };
  const { fetchUserProgress } = useUserProgress();
  
  // 将 isSubmittingRef 移动到组件内部
  const isSubmittingRef = useRef<boolean>(false);
  
  // 状态管理
  const [loading, setLoading] = useState<boolean>(true);
  const [error, setError] = useState<string | null>(null);
  const [questions, setQuestions] = useState<Question[]>([]);
  const [originalQuestions, setOriginalQuestions] = useState<Question[]>([]);
  const [questionSet, setQuestionSet] = useState<IQuestionSet | null>(null);
  const [currentQuestionIndex, setCurrentQuestionIndex] = useState<number>(0);
  const [showHints, setShowHints] = useState<boolean>(false);
  const [answeredQuestions, setAnsweredQuestions] = useState<AnsweredQuestion[]>([]);
  const [showExplanation, setShowExplanation] = useState<boolean>(false);
  const [showPaymentModal, setShowPaymentModal] = useState<boolean>(false);
  const [showRedeemCodeModal, setShowRedeemCodeModal] = useState<boolean>(false);
  const [hasAccessToFullQuiz, setHasAccessToFullQuiz] = useState<boolean>(false);
  const [hasRedeemed, setHasRedeemed] = useState<boolean>(false);
  const [trialEnded, setTrialEnded] = useState<boolean>(false);
  const [isInTrialMode, setIsInTrialMode] = useState<boolean>(false);
  const [selectedOptions, setSelectedOptions] = useState<string[]>([]);
  const [correctAnswers, setCorrectAnswers] = useState<number>(0);
  const [quizComplete, setQuizComplete] = useState<boolean>(false);
  const [quizStartTime, setQuizStartTime] = useState<number>(0);
  const [quizTotalTime, setQuizTotalTime] = useState<number>(0);
  const [isTimerActive, setIsTimerActive] = useState<boolean>(false);
  
  // 初始化试用模式
  useEffect(() => {
    if (!questionSetId) return;
    
    const initializeQuizMode = async () => {
      setLoading(true);
      setError(null);
      
      try {
        // 解析URL参数
        const urlParams = new URLSearchParams(window.location.search);
        const mode = urlParams.get('mode');
        const trialLimit = urlParams.get('trialLimit');
        
        // 检查是否是试用模式
        const isTrialParam = mode === 'trial';
        
        console.log('[QuizPage] URL参数解析:', {
          mode,
          trialLimit,
          isTrialParam
        });
        
        // 获取题库详情
        const response = await questionSetApi.getQuestionSetById(questionSetId);
        
        if (response.success && response.data) {
          // 设置试用题目数量，优先使用URL参数中的值
          const trialQuestionCount = isTrialParam && trialLimit 
            ? parseInt(trialLimit, 10) 
            : response.data.trialQuestions;
          
          // 确保所有必需字段都有值
          const questionSetData: IQuestionSet = {
            id: response.data.id,
            title: response.data.title,
            description: response.data.description,
            category: response.data.category,
            icon: response.data.icon,
            isPaid: response.data.isPaid || false,
            price: response.data.price || 0,
            isFeatured: response.data.isFeatured || false,
            featuredCategory: response.data.featuredCategory,
            hasAccess: false,
            trialQuestions: trialQuestionCount,
            questionCount: response.data.questionCount || 0,
            createdAt: new Date(response.data.createdAt || Date.now()),
            updatedAt: new Date(response.data.updatedAt || Date.now())
          };
          
          setQuestionSet(questionSetData);
          
          // 如果是试用模式，设置相关状态
          if (isTrialParam && questionSetData.isPaid) {
            console.log(`[QuizPage] 进入试用模式: 限制题目数=${trialQuestionCount}`);
            setIsInTrialMode(true);
            setHasAccessToFullQuiz(false);
            setTrialEnded(false);
            
            // 保存试用模式状态
            sessionStorage.setItem(`quiz_${questionSetId}_trial_mode`, 'true');
            if (trialQuestionCount) {
              sessionStorage.setItem(`quiz_${questionSetId}_trial_limit`, String(trialQuestionCount));
            }
            
            // 显示提示
            toast.info(`您正在试用模式下答题，可以答${trialQuestionCount}道题`, {
              autoClose: 5000,
              position: 'top-center'
            });
          }
          
          // 处理题目数据
          const questionsData = getQuestions(questionSetData);
          if (questionsData.length > 0) {
            setQuestions(questionsData);
            setOriginalQuestions(questionsData);
              } else {
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
    
    initializeQuizMode();
  }, [questionSetId]);
  
  // 监控试用模式的题目限制
  useEffect(() => {
    if (!questionSet || !isInTrialMode) return;
    
    const hasReachedLimit = 
      questionSet.isPaid && 
      !hasAccessToFullQuiz && 
      !hasRedeemed && 
      questionSet.trialQuestions && 
      answeredQuestions.length >= questionSet.trialQuestions;
    
    if (hasReachedLimit) {
      console.log(`[QuizPage] 已达到试用题目限制 (${answeredQuestions.length}/${questionSet.trialQuestions})`);
      setTrialEnded(true);
      
      // 显示购买提示
      toast.info('您已达到试用题目限制，请购买完整版或使用兑换码继续答题', {
        position: 'top-center',
        autoClose: 8000,
        toastId: 'trial-limit'
      });
      
      // 显示购买模态窗口
      setShowPaymentModal(true);
    }
  }, [questionSet, isInTrialMode, hasAccessToFullQuiz, hasRedeemed, answeredQuestions.length]);
  
  // 处理Socket事件
  useEffect(() => {
    if (!socket || !user?.id) return;

    const handleProgressData = (data: ProgressData) => {
      // 处理进度数据
      if (data && data.answeredQuestions) {
        setAnsweredQuestions(data.answeredQuestions);
        if (data.lastQuestionIndex !== undefined) {
          setCurrentQuestionIndex(data.lastQuestionIndex);
        }
      }
    };

    // 使用类型断言
    (socket as Socket).on('progress:data', handleProgressData);
    
    return () => {
      // 使用类型断言
      (socket as Socket).off('progress:data', handleProgressData);
    };
  }, [socket, user?.id]);
  
  // 处理选择选项
  const handleOptionSelect = (optionId: string) => {
    // 如果试用已结束且没有购买，不允许继续答题
    if (trialEnded && !hasAccessToFullQuiz && !hasRedeemed) {
      toast.warning('试用已结束，请购买完整版或使用兑换码继续答题');
      setShowPaymentModal(true);
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
  const handleAnswerSubmit = useCallback((isCorrect: boolean, selectedOption: string | string[]) => {
    if (isSubmittingRef.current) {
      console.log('已在提交答案中，忽略重复请求');
      return;
    }
    
    const currentQuestion = questions[currentQuestionIndex];
    if (!currentQuestion) {
      console.error('当前问题数据不存在');
      return;
    }
    
    // 设置提交状态
    isSubmittingRef.current = true;
    
    // 确保selectedOption总是字符串数组
    const optionIds = Array.isArray(selectedOption) ? selectedOption : [selectedOption];

    // 更新当前问题的状态
    const updatedAnsweredQuestions = [...answeredQuestions];
    const timeSpent = quizStartTime ? (Date.now() - quizStartTime) / 1000 : 0;

    // 检查是否已经回答过这个问题
    const existingAnswerIndex = updatedAnsweredQuestions.findIndex(
      q => q.questionIndex === currentQuestionIndex
    );

    if (existingAnswerIndex !== -1) {
      // 更新已存在的答案
      updatedAnsweredQuestions[existingAnswerIndex] = {
        ...updatedAnsweredQuestions[existingAnswerIndex],
        isCorrect,
        selectedOption: optionIds,
      };
      } else {
      // 添加新的答案
      updatedAnsweredQuestions.push({
        index: updatedAnsweredQuestions.length,
        questionIndex: currentQuestionIndex,
        isCorrect,
        selectedOption: optionIds,
      });
    }

      setAnsweredQuestions(updatedAnsweredQuestions);
    if (isCorrect) {
      setCorrectAnswers(prev => prev + 1);
    }
      
      // 更新本地存储
    const localProgressKey = `quiz_progress_${questionSetId}`;
    localStorage.setItem(localProgressKey, JSON.stringify({
      lastQuestionIndex: currentQuestionIndex,
        answeredQuestions: updatedAnsweredQuestions,
        lastUpdated: new Date().toISOString()
    }));

      // 重置提交状态
    setTimeout(() => {
      isSubmittingRef.current = false;
    }, 800);
  }, [
    currentQuestionIndex, 
    answeredQuestions, 
    questionSetId,
    questions,
    quizStartTime
  ]);

  // 处理下一题
  const handleNextQuestion = useCallback(() => {
    if (currentQuestionIndex >= questions.length - 1) {
        setQuizComplete(true);
      return;
    }
    
    setCurrentQuestionIndex(prevIndex => prevIndex + 1);
    setSelectedOptions([]);
    setShowExplanation(false);
  }, [currentQuestionIndex, questions.length]);

  // 处理跳转到特定题目
  const handleJumpToQuestion = useCallback((index: number) => {
    // 如果试用已结束且没有购买，不允许继续答题
    if (trialEnded && !hasAccessToFullQuiz && !hasRedeemed) {
      toast.warning('试用已结束，请购买完整版或使用兑换码继续答题');
      setShowPaymentModal(true);
      return;
    }

    if (index >= 0 && index < questions.length) {
      setCurrentQuestionIndex(index);
                    setSelectedOptions([]);
                    setShowExplanation(false);
    }
  }, [questions.length, trialEnded, hasAccessToFullQuiz, hasRedeemed]);

  // 渲染题目卡片
  const renderQuestionCard = () => {
    if (!questions.length || currentQuestionIndex >= questions.length || !questionSetId) {
      return null;
    }

    const currentQuestion = questions[currentQuestionIndex];
    return (
          <QuestionCard
            question={currentQuestion}
            questionNumber={currentQuestionIndex + 1}
            totalQuestions={questions.length}
        onAnswerSubmitted={handleAnswerSubmit}
            onNext={handleNextQuestion}
            onJumpToQuestion={handleJumpToQuestion}
            isPaid={questionSet?.isPaid}
            hasFullAccess={hasAccessToFullQuiz}
        questionSetId={questionSetId}
            isLast={currentQuestionIndex === questions.length - 1}
            trialQuestions={questionSet?.trialQuestions}
        isSubmittingAnswer={isSubmittingRef.current}
      />
    );
  };

  // 渲染答题卡
  const renderAnswerCard = () => {
    return (
      <div className="mb-6">
        <div className="bg-white rounded-lg shadow-md p-4">
          <h3 className="text-lg font-medium mb-4">答题进度</h3>
          <div className="grid grid-cols-10 gap-2">
          {questions.map((_, index) => {
            const answer = answeredQuestions.find(a => a.questionIndex === index);
              const isCurrent = currentQuestionIndex === index;
              const isDisabled = isInTrialMode && questionSet?.trialQuestions 
                ? index >= questionSet.trialQuestions 
                : false;

              let bgColor = 'bg-gray-100';
              if (isCurrent) bgColor = 'bg-blue-500 text-white';
              else if (answer?.isCorrect) bgColor = 'bg-green-100';
              else if (answer) bgColor = 'bg-red-100';
              else if (isDisabled) bgColor = 'bg-gray-300';
            
            return (
              <button 
                key={index}
                  onClick={() => !isDisabled && handleJumpToQuestion(index)}
                  className={`h-10 ${bgColor} rounded-lg flex items-center justify-center text-sm font-medium
                    ${isDisabled ? 'cursor-not-allowed opacity-50' : 'hover:opacity-80'}`}
                  disabled={isDisabled}
              >
                {index + 1}
              </button>
            );
          })}
        </div>
          <div className="mt-4 flex justify-between text-sm text-gray-600">
            <span>总题数: {questions.length}</span>
            <span>已答: {answeredQuestions.length}</span>
            <span>正确: {correctAnswers}</span>
      </div>
        </div>
      </div>
    );
  };
  
  // 渲染完成页面
  const renderCompletePage = () => {
    if (!quizComplete) return null;

    const score = Math.round((correctAnswers / questions.length) * 100);
    return (
            <div className="bg-white rounded-lg shadow-md p-8 text-center">
        <div className="mb-6">
          <div className="w-20 h-20 mx-auto bg-green-100 rounded-full flex items-center justify-center">
            <svg className="w-12 h-12 text-green-500" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                </svg>
              </div>
          <h2 className="text-2xl font-bold mt-4">答题完成！</h2>
          <p className="text-gray-600 mt-2">
            得分: {score}% ({correctAnswers}/{questions.length})
          </p>
        </div>
              <div className="flex justify-center space-x-4">
                <button 
            onClick={() => window.location.reload()}
            className="px-4 py-2 bg-blue-500 text-white rounded hover:bg-blue-600"
                >
                  重新开始
                </button>
                <button 
            onClick={() => navigate('/')}
            className="px-4 py-2 bg-gray-500 text-white rounded hover:bg-gray-600"
                >
                  返回首页
                </button>
        </div>
      </div>
    );
  };
  
  return (
    <div className="min-h-screen bg-gray-50 py-8">
      <div className="container mx-auto px-4">
        {loading ? (
          <div className="flex justify-center items-center h-64">
            <div className="w-16 h-16 border-t-4 border-blue-500 border-solid rounded-full animate-spin"></div>
            </div>
        ) : error ? (
          <div className="text-center py-12">
            <div className="text-red-500 text-xl mb-4">加载失败</div>
            <p className="text-gray-600 mb-6">{error}</p>
              <button 
              onClick={() => {window.location.reload()}}
              className="px-4 py-2 bg-blue-500 text-white rounded hover:bg-blue-600"
            >
              重试
              </button>
          </div>
        ) : (
          <>
            {/* 题库标题和导航 */}
            <div className="mb-6">
              <div className="flex justify-between items-center">
                <h1 className="text-2xl font-bold">{questionSet?.title}</h1>
                      <button
                  onClick={() => navigate('/')}
                  className="text-blue-500 hover:text-blue-600"
                  >
                    返回首页
                  </button>
                </div>
              {isInTrialMode && questionSet?.trialQuestions && (
                <div className="mt-2 bg-yellow-50 border-l-4 border-yellow-400 p-3">
                  <p className="text-yellow-700">
                    试用模式：可答题数 {answeredQuestions.length}/{questionSet.trialQuestions}
                  </p>
                  </div>
                    )}
                  </div>
                  
            {/* 答题卡 */}
            {renderAnswerCard()}

            {/* 题目卡片或完成页面 */}
            {quizComplete ? renderCompletePage() : renderQuestionCard()}

            {/* 购买模态框 */}
            {showPaymentModal && questionSet && (
              <PaymentModal
                isOpen={showPaymentModal}
                onClose={() => setShowPaymentModal(false)}
                questionSet={questionSet}
                onSuccess={() => {
                  setHasAccessToFullQuiz(true);
                  setTrialEnded(false);
                  setShowPaymentModal(false);
                }}
              />
        )}
        
        {/* 兑换码模态框 */}
        {showRedeemCodeModal && (
              <RedeemCodeForm
                onRedeemSuccess={() => {
                  setHasRedeemed(true);
                setHasAccessToFullQuiz(true);
                setTrialEnded(false);
                  setShowRedeemCodeModal(false);
                }}
              />
            )}
          </>
        )}
      </div>
    </div>
  );
}

export default QuizPage; 
