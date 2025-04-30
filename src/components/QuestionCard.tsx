import { useState, useEffect, useRef, KeyboardEvent } from 'react';
import { useNavigate } from 'react-router-dom';
import { Question } from '../types';
import QuestionOption from './QuestionOption';
import RedeemCodeForm from './RedeemCodeForm';

interface QuestionCardProps {
  question: Question;
  onNext: () => void;
  onAnswerSubmitted?: (isCorrect: boolean, selectedOption: string | string[]) => void;
  questionNumber: number;
  totalQuestions: number;
  quizTitle: string;
  userAnsweredQuestion?: { 
    index: number; 
    isCorrect: boolean; 
    selectedOption: string | string[];
  };
  onJumpToQuestion?: (questionIndex: number) => void;
  isPaid?: boolean;
  hasFullAccess?: boolean;
  trialQuestions?: number;
}

// 提示语精简：提取为常量，便于后期i18n多语言
const MESSAGES = {
  SUBMIT_ANSWER: '提交答案',
  SELECT_ONE_OPTION: '请选择一个选项',
  SUBMIT_ALL_OPTIONS: '提交所有选项',
  SELECT_AT_LEAST_ONE: '请选择至少一个选项',
  CORRECT_ANSWER: '回答正确!',
  WRONG_ANSWER: '回答错误!',
  CORRECT_ANSWER_IS: '正确答案是',
  SHOW_EXPLANATION: '查看解析',
  HIDE_EXPLANATION: '隐藏解析',
  ANALYSIS: '解析:',
  NEXT_QUESTION: '下一题'
};

const QuestionCard = ({ 
  question, 
  onNext, 
  onAnswerSubmitted, 
  questionNumber, 
  totalQuestions, 
  quizTitle,
  userAnsweredQuestion,
  onJumpToQuestion,
  isPaid = false,
  hasFullAccess = false,
  trialQuestions = 0
}: QuestionCardProps) => {
  // 单选题选择一个选项，多选题选择多个选项
  const [selectedOption, setSelectedOption] = useState<string | null>(null);
  const [selectedOptions, setSelectedOptions] = useState<string[]>([]);
  const [isSubmitted, setIsSubmitted] = useState(!!userAnsweredQuestion);
  const [showExplanation, setShowExplanation] = useState(false);
  const [showRedeemCodeModal, setShowRedeemCodeModal] = useState(false);
  const navigate = useNavigate();
  let timeoutId: NodeJS.Timeout | undefined;
  
  // 防重复提交
  const isSubmittingRef = useRef(false);
  
  // 为键盘导航跟踪当前选项
  const [focusedOptionIndex, setFocusedOptionIndex] = useState<number>(-1);
  
  // 当userAnsweredQuestion存在时预填选项
  useEffect(() => {
    if (userAnsweredQuestion) {
      setIsSubmitted(true);
      if (question.questionType === 'single') {
        setSelectedOption(userAnsweredQuestion.selectedOption as string);
      } else {
        setSelectedOptions(userAnsweredQuestion.selectedOption as string[]);
      }
    }
  }, [userAnsweredQuestion, question.questionType]);

  // 优化后的正确性检查逻辑
  const isCorrect = userAnsweredQuestion
    ? userAnsweredQuestion.isCorrect
    : isSubmitted && (
        question.questionType === 'single'
          ? selectedOption === question.correctAnswer
          : (() => {
              // 对于多选题，比较选择的选项集合是否与正确答案集合相同
              const correctAnswers = Array.isArray(question.correctAnswer) 
                ? question.correctAnswer 
                : question.correctAnswer ? [question.correctAnswer] : [];
                
              return (
                selectedOptions.length === correctAnswers.length &&
                selectedOptions.every(id => correctAnswers.includes(id)) &&
                correctAnswers.every(id => selectedOptions.includes(id))
              );
            })()
      );

  const handleOptionClick = (optionId: string) => {
    if (isSubmitted) return;

    if (question.questionType === 'single') {
      // 单选题
      setSelectedOption(optionId);
    } else {
      // 多选题
      setSelectedOptions(prev => {
        if (prev.includes(optionId)) {
          // 如果已选中，则移除
          return prev.filter(id => id !== optionId);
        } else {
          // 如果未选中，则添加
          return [...prev, optionId];
        }
      });
    }
  };
  
  // 处理选项键盘操作
  const handleOptionKeyDown = (e: KeyboardEvent<HTMLDivElement>, optionId: string, index: number) => {
    // 空格键或回车键选择选项
    if (e.key === ' ' || e.key === 'Enter') {
      e.preventDefault();
      handleOptionClick(optionId);
    }
    // 上下键导航选项
    else if (e.key === 'ArrowDown') {
      e.preventDefault();
      setFocusedOptionIndex(Math.min(index + 1, question.options.length - 1));
    }
    else if (e.key === 'ArrowUp') {
      e.preventDefault();
      setFocusedOptionIndex(Math.max(index - 1, 0));
    }
  };
  
  // 当焦点选项索引改变时，自动聚焦对应元素
  useEffect(() => {
    if (focusedOptionIndex >= 0) {
      const optionElement = document.getElementById(`option-${focusedOptionIndex}`);
      if (optionElement) {
        optionElement.focus();
      }
    }
  }, [focusedOptionIndex]);

  const handleSubmit = () => {
    // 防重复提交机制
    if (isSubmittingRef.current || isSubmitted) return;
    isSubmittingRef.current = true;
    
    try {
      if (question.questionType === 'single' && selectedOption) {
        setIsSubmitted(true);
        
        // 修改判断逻辑，直接与correctAnswer比较
        const isCorrect = selectedOption === question.correctAnswer;
        
        if (onAnswerSubmitted) {
          onAnswerSubmitted(isCorrect, selectedOption);
        }
        // 答对自动跳到下一题
        if (isCorrect) {
          timeoutId = setTimeout(() => {
            handleNext();
          }, 1000);
        }
      } else if (question.questionType === 'multiple' && selectedOptions.length > 0) {
        setIsSubmitted(true);
        
        // 修改多选题判断逻辑
        const correctAnswers = Array.isArray(question.correctAnswer) 
          ? question.correctAnswer 
          : question.correctAnswer ? [question.correctAnswer] : [];
        
        const isCorrect = 
          selectedOptions.length === correctAnswers.length &&
          selectedOptions.every(id => correctAnswers.includes(id)) &&
          correctAnswers.every(id => selectedOptions.includes(id));
        
        if (onAnswerSubmitted) {
          onAnswerSubmitted(isCorrect, selectedOptions);
        }
        // 答对自动跳到下一题
        if (isCorrect) {
          timeoutId = setTimeout(() => {
            handleNext();
          }, 1000);
        }
      }
    } finally {
      // 1秒后才能再次提交，防止快速点击
      setTimeout(() => {
        isSubmittingRef.current = false;
      }, 1000);
    }
  };

  const handleNext = () => {
    setSelectedOption(null);
    setSelectedOptions([]);
    setIsSubmitted(false);
    setShowExplanation(false);
    onNext();
  };
  
  // 判断题号是否可点击
  const isQuestionAccessible = (index: number) => {
    if (!isPaid || hasFullAccess) return true;
    return index < trialQuestions;
  };
  
  // 处理题号跳转
  const handleJumpToQuestion = (index: number) => {
    if (!isQuestionAccessible(index)) {
      // 如果是付费题目且未购买，显示提示
      return;
    }
    
    if (onJumpToQuestion && !isSubmittingRef.current) {
      onJumpToQuestion(index);
    }
  };

  // 清理定时器
  useEffect(() => {
    return () => {
      if (timeoutId) {
        clearTimeout(timeoutId);
      }
    };
  }, []);

  return (
    <div className="bg-white shadow-md rounded-lg p-6 max-w-3xl mx-auto">
      {/* 顶部导航和标题 */}
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center mb-6">
        <div>
          <button 
            onClick={() => navigate('/')} 
            className="text-blue-600 hover:text-blue-800 mb-2 sm:mb-0 flex items-center"
          >
            <svg className="w-4 h-4 mr-1" fill="none" stroke="currentColor" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 19l-7-7m0 0l7-7m-7 7h18" />
            </svg>
            返回主页
          </button>
        </div>
        <div className="flex items-center space-x-2">
          <button
            onClick={() => setShowRedeemCodeModal(true)}
            className="bg-green-600 text-white px-4 py-2 rounded hover:bg-green-700 transition-colors duration-200"
          >
            使用兑换码
          </button>
          <div className="bg-blue-100 text-blue-800 py-1 px-3 rounded-full text-sm">
            {quizTitle}
          </div>
        </div>
      </div>

      {/* 问题标题和进度 */}
      <div className="flex justify-between items-center mb-6">
        <h2 className="text-xl font-semibold text-gray-800">问题 {questionNumber} / {totalQuestions}</h2>
        <span className="bg-gray-100 text-gray-600 px-2 py-1 rounded text-sm">
          {question.questionType === 'single' ? '单选题' : '多选题'}
        </span>
      </div>
      
      {/* 题号小圆点导航 */}
      {onJumpToQuestion && (
        <div className="flex justify-center mb-6 flex-wrap gap-1">
          {Array.from({ length: totalQuestions }).map((_, index) => {
            const isAccessible = isQuestionAccessible(index);
            return (
              <button
                key={index}
                onClick={() => handleJumpToQuestion(index)}
                disabled={!isAccessible}
                className={`w-8 h-8 rounded-full flex items-center justify-center text-sm 
                  transition-colors duration-200 focus:outline-none focus:ring-2 focus:ring-offset-2
                  ${questionNumber === index + 1 
                    ? 'bg-blue-600 text-white' 
                    : isAccessible
                      ? 'bg-gray-200 text-gray-600 hover:bg-gray-300'
                      : 'bg-gray-100 text-gray-400 cursor-not-allowed opacity-50'
                  }
                  ${isAccessible ? 'focus:ring-blue-500' : 'focus:ring-gray-400'}
                `}
                aria-label={`跳转到第${index + 1}题${!isAccessible ? ' (需要购买)' : ''}`}
                title={!isAccessible ? '需要购买完整题库才能访问' : `跳转到第${index + 1}题`}
              >
                {index + 1}
                {!isAccessible && (
                  <span className="absolute -top-1 -right-1 w-3 h-3">
                    <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20" fill="currentColor" className="text-gray-400">
                      <path fillRule="evenodd" d="M5 9V7a5 5 0 0110 0v2a2 2 0 012 2v5a2 2 0 01-2 2H5a2 2 0 01-2-2v-5a2 2 0 012-2zm8-2v2H7V7a3 3 0 016 0z" clipRule="evenodd" />
                    </svg>
                  </span>
                )}
              </button>
            );
          })}
        </div>
      )}

      {/* 问题内容 */}
      <div className="mb-6">
        <p className="text-gray-700 text-lg mb-4">{question.question}</p>
      </div>

      {/* 选项 */}
      <div className="mb-6">
        {question.options.map((option, index) => (
          <div 
            key={option.id}
            id={`option-${index}`}
            tabIndex={0}
            onKeyDown={(e) => handleOptionKeyDown(e, option.id, index)}
            className={`focus:outline-none focus:ring-2 focus:ring-blue-300 rounded-md`}
          >
            <QuestionOption
              option={option}
              index={index}
              isSelected={
                question.questionType === 'single' 
                  ? selectedOption === option.id 
                  : selectedOptions.includes(option.id)
              }
              isCorrect={
                isSubmitted
                  ? option.isCorrect ? option.id : null
                  : null
              }
              isSubmitted={isSubmitted}
              isMultiple={question.questionType === 'multiple'}
              onClick={() => handleOptionClick(option.id)}
            />
          </div>
        ))}
      </div>

      {/* 解析 */}
      {isSubmitted && (
        <div className="mb-6">
          <div className="flex items-center justify-between mb-2">
            <div className="flex items-center">
              <span className={`inline-block w-5 h-5 rounded-full mr-2 ${isCorrect ? 'bg-green-500' : 'bg-red-500'} transition-colors duration-300`}></span>
              <span className={`font-medium ${isCorrect ? 'text-green-600' : 'text-red-600'} transition-colors duration-300`}>
                {isCorrect ? MESSAGES.CORRECT_ANSWER : MESSAGES.WRONG_ANSWER}
                {!isCorrect && question.questionType === 'single' && (
                  ` ${MESSAGES.CORRECT_ANSWER_IS} ${
                    question.options.find(opt => opt.isCorrect)?.text || ''
                  }`
                )}
                {!isCorrect && question.questionType === 'multiple' && (
                  ` ${MESSAGES.CORRECT_ANSWER_IS} ${
                    question.options
                      .filter(opt => opt.isCorrect)
                      .map(opt => opt.text)
                      .join(', ')
                  }`
                )}
              </span>
            </div>
            <button
              onClick={() => setShowExplanation(!showExplanation)}
              className="text-blue-600 hover:text-blue-800 text-sm font-medium transition-colors duration-200"
            >
              {showExplanation ? MESSAGES.HIDE_EXPLANATION : MESSAGES.SHOW_EXPLANATION}
            </button>
          </div>

          {showExplanation && (
            <div className="bg-gray-50 p-4 rounded-md mt-2 animate-fadeIn">
              <h3 className="font-semibold text-gray-700 mb-2">{MESSAGES.ANALYSIS}</h3>
              <p className="text-gray-600">{question.explanation}</p>
            </div>
          )}
        </div>
      )}

      {/* 按钮 */}
      <div className="flex justify-between">
        {!isSubmitted ? (
          <button
            onClick={handleSubmit}
            disabled={question.questionType === 'single' 
              ? !selectedOption 
              : selectedOptions.length === 0 || isSubmittingRef.current}
            className={`py-2 px-6 rounded-lg font-medium transition-colors duration-200 ${
              (question.questionType === 'single' ? selectedOption : selectedOptions.length > 0) && !isSubmittingRef.current
                ? 'bg-blue-600 text-white hover:bg-blue-700'
                : 'bg-gray-300 text-gray-500 cursor-not-allowed'
            }`}
          >
            {question.questionType === 'single' 
              ? selectedOption 
                ? MESSAGES.SUBMIT_ANSWER 
                : MESSAGES.SELECT_ONE_OPTION
              : selectedOptions.length > 0
                ? MESSAGES.SUBMIT_ALL_OPTIONS
                : MESSAGES.SELECT_AT_LEAST_ONE}
          </button>
        ) : (
          !isCorrect && (
            <button
              onClick={handleNext}
              className="bg-green-600 hover:bg-green-700 text-white py-2 px-6 rounded-lg font-medium transition-colors duration-200"
            >
              {MESSAGES.NEXT_QUESTION}
            </button>
          )
        )}
      </div>

      {/* Redeem Code Modal */}
      {showRedeemCodeModal && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 animate-fadeIn">
          <div className="bg-white rounded-lg p-6 max-w-md w-full mx-4 animate-scaleIn">
            <div className="flex justify-between items-center mb-4">
              <h2 className="text-xl font-semibold">题库兑换码</h2>
              <button
                onClick={() => setShowRedeemCodeModal(false)}
                className="text-gray-500 hover:text-gray-700 transition-colors duration-200"
              >
                <svg className="h-6 w-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>
            </div>
            <RedeemCodeForm onRedeemSuccess={(quizId) => {
              console.log(`[QuestionCard] 发送兑换成功事件，题库ID: ${quizId}`);
              setShowRedeemCodeModal(false);
              
              // 使用自定义事件通知父组件，避免使用window.location.reload()
              if (typeof window !== 'undefined') {
                console.log(`[QuestionCard] 发送兑换成功事件，题库ID: ${quizId}`);
                
                // 创建详细的事件对象
                const eventDetail = { 
                  quizId, 
                  forceRefresh: true,
                  source: 'QuestionCard',
                  timestamp: Date.now()
                };
                
                // 分发事件
                window.dispatchEvent(new CustomEvent('redeem:success', { 
                  detail: eventDetail
                }));
                
                // 延迟再次发送以确保事件被处理
                setTimeout(() => {
                  window.dispatchEvent(new CustomEvent('redeem:success', { 
                    detail: eventDetail
                  }));
                }, 800);
                
                // 尝试直接获取socket并发送事件
                const socket = (window as any).socket;
                if (socket) {
                  console.log(`[QuestionCard] 通过socket发送权限更新通知`);
                  socket.emit('questionSet:accessUpdate', {
                    userId: 'current',
                    questionSetId: quizId,
                    hasAccess: true
                  });
                }
              }
            }} />
          </div>
        </div>
      )}
    </div>
  );
};

// 为动画添加全局样式
const styleElement = document.createElement('style');
styleElement.textContent = `
  @keyframes fadeIn {
    from { opacity: 0; }
    to { opacity: 1; }
  }
  
  @keyframes scaleIn {
    from { transform: scale(0.95); opacity: 0; }
    to { transform: scale(1); opacity: 1; }
  }
  
  .animate-fadeIn {
    animation: fadeIn 0.3s ease-in-out;
  }
  
  .animate-scaleIn {
    animation: scaleIn 0.3s ease-out;
  }
`;
document.head.appendChild(styleElement);

export default QuestionCard; 