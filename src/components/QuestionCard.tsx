import { useState, useEffect, useRef, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { Question } from '../types';
import QuestionOption from './QuestionOption';
import RedeemCodeForm from './RedeemCodeForm';
import { toast } from 'react-toastify';
import { useUser } from '../contexts/UserContext';

interface QuestionCardProps {
  question: Question;
  onAnswerSubmitted?: (isCorrect: boolean, selectedOption: string | string[]) => void;
  onNext?: () => void;
  isLast?: boolean;
  isSubmittingAnswer?: boolean;
  questionNumber?: number;
  totalQuestions?: number;
  quizTitle?: string;
  userAnsweredQuestion?: { 
    index: number; 
    isCorrect: boolean; 
    selectedOption: string | string[];
  };
  onJumpToQuestion?: (questionIndex: number) => void;
  isPaid?: boolean;
  hasFullAccess?: boolean;
  trialQuestions?: number;
  questionSetId: string;
  trialLimitReached?: boolean;
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
  onNext = () => {}, 
  onAnswerSubmitted, 
  questionNumber = 1, 
  totalQuestions = 1, 
  quizTitle = '',
  userAnsweredQuestion,
  onJumpToQuestion,
  isPaid = false,
  hasFullAccess = false,
  trialQuestions = 0,
  questionSetId,
  isLast = false,
  isSubmittingAnswer = false,
  trialLimitReached = false
}: QuestionCardProps) => {
  // 状态管理
  const [selectedOptions, setSelectedOptions] = useState<string[]>([]);
  const [isSubmitted, setIsSubmitted] = useState(false);
  const [showExplanation, setShowExplanation] = useState(false);
  const [showRedeemCodeModal, setShowRedeemCodeModal] = useState(false);
  const navigate = useNavigate();
  let timeoutId: NodeJS.Timeout | undefined;
  
  // 防止重复提交的ref
  const isSubmittingRef = useRef<boolean>(false);
  
  // 为键盘导航跟踪当前选项
  const [focusedOptionIndex, setFocusedOptionIndex] = useState<number>(-1);
  
  const { user, syncAccessRights } = useUser();
  
  // 当用户已回答过该问题时，加载已选答案
  useEffect(() => {
    if (userAnsweredQuestion) {
      setIsSubmitted(true);
      
      const selectedOption = userAnsweredQuestion.selectedOption;
      if (Array.isArray(selectedOption)) {
        setSelectedOptions(selectedOption);
      } else {
        setSelectedOptions([selectedOption]);
      }
      
      setShowExplanation(true);
    }
  }, [userAnsweredQuestion]);

  // 判断答案是否正确
  const checkIsCorrect = (): boolean => {
    if (question.questionType === 'single') {
      // 单选题: 检查选择的答案是否正确
      const correctOption = question.options.find(opt => opt.isCorrect);
      return selectedOptions[0] === correctOption?.id;
    } else {
      // 多选题: 检查是否所有正确答案都选中，且没有选错
      const correctOptionIds = question.options
        .filter(opt => opt.isCorrect)
        .map(opt => opt.id);
      
      // 检查所有正确答案是否都被选中
      const allCorrectSelected = correctOptionIds.every(id => 
        selectedOptions.includes(id)
      );
      
      // 检查是否有选择错误的答案
      const noIncorrectSelected = selectedOptions.every(id => 
        correctOptionIds.includes(id)
      );
      
      // 检查选择数量是否一致
      const countMatch = correctOptionIds.length === selectedOptions.length;
      
      return allCorrectSelected && noIncorrectSelected && countMatch;
    }
  };

  // 提交答案处理函数
  const handleSubmit = (e: React.MouseEvent<HTMLButtonElement>) => {
    // 阻止表单提交默认行为
    e.preventDefault();
    e.stopPropagation();
    
    // 如果已提交并显示解析，点击"下一题"
    if (isSubmitted && showExplanation) {
      console.log('[QuestionCard] 已提交答案，准备进入下一题');
      onNext();
      return;
    }
    
    // 防止重复提交
    if (isSubmittingRef.current || isSubmitted) {
      console.log('[QuestionCard] 正在提交或已提交，忽略操作');
      return;
    }
    
    // 检查是否选择了答案
    if (selectedOptions.length === 0) {
      toast.warning('请至少选择一个选项');
      return;
    }
    
    // 设置提交中状态
    isSubmittingRef.current = true;
    
    try {
      // 判断答案是否正确
      const isCorrect = checkIsCorrect();
      
      // 更新UI状态
      setIsSubmitted(true);
      setShowExplanation(true);
      
      // 调用父组件回调，传递结果
      if (onAnswerSubmitted) {
        console.log(`[QuestionCard] 调用父组件onAnswerSubmitted回调, 答案正确: ${isCorrect}`);
        if (question.questionType === 'single') {
          onAnswerSubmitted(isCorrect, selectedOptions[0]);
        } else {
          onAnswerSubmitted(isCorrect, selectedOptions);
        }
      }
      
      // 本地存储答题记录
      const storageKey = `quiz_answer_${questionSetId}_${question.id}`;
      localStorage.setItem(storageKey, JSON.stringify({
        selectedOptions,
        isCorrect,
        timestamp: new Date().toISOString()
      }));
      
      // 如果答错，记录错题
      if (!isCorrect) {
        saveWrongAnswer();
      }
    } catch (error) {
      console.error('[QuestionCard] 提交答案出错:', error);
      toast.error('提交答案时出错，请重试');
    } finally {
      // 延迟释放提交锁，防止重复点击
      setTimeout(() => {
        isSubmittingRef.current = false;
      }, 800);
    }
  };

  // 保存错题函数
  const saveWrongAnswer = () => {
    const wrongAnswerEvent = new CustomEvent('wrongAnswer:save', {
      detail: {
        questionId: question.id,
        questionSetId: questionSetId,
        question: question.question || question.text,
        questionType: question.questionType,
        options: question.options,
        selectedOption: question.questionType === 'single' ? selectedOptions[0] : undefined,
        selectedOptions: question.questionType === 'multiple' ? selectedOptions : undefined,
        correctOption: question.questionType === 'single' 
          ? question.options.find(opt => opt.isCorrect)?.id 
          : undefined,
        correctOptions: question.questionType === 'multiple'
          ? question.options.filter(opt => opt.isCorrect).map(opt => opt.id)
          : undefined,
        explanation: question.explanation
      }
    });
    
    window.dispatchEvent(wrongAnswerEvent);
  };

  // 获取选项样式类
  const getOptionClass = (option: any) => {
    // 试用限制时禁用选项
    if (isPaid && !hasFullAccess && trialLimitReached) {
      return 'border-gray-300 bg-gray-50 opacity-60 pointer-events-none';
    }
    
    // 未提交答案时的样式
    if (!showExplanation) {
      return selectedOptions.includes(option.id)
        ? 'border-blue-300 bg-blue-50'
        : 'border-gray-300 bg-white hover:bg-gray-50';
    }
    
    // 已提交后的样式
    if (option.isCorrect) {
      return 'border-green-500 bg-green-50 text-green-700'; // 正确答案
    } else if (selectedOptions.includes(option.id)) {
      return 'border-red-500 bg-red-50 text-red-700'; // 错误答案
    } else {
      return 'border-gray-300 bg-gray-50 opacity-60'; // 未选答案
    }
  };

  const handleNext = () => {
    console.log('[QuestionCard] handleNext called - moving to next question');
    
    // Debug information to identify potential issues
    console.log(`[QuestionCard] Current state: isSubmitted=${isSubmitted}, showExplanation=${showExplanation}`);
    
    // Clear any selected options immediately
    setSelectedOptions([]);
    setIsSubmitted(false);
    setShowExplanation(false);
    
    // 使用props传入的trialLimitReached判断
    if (isPaid && !hasFullAccess && trialLimitReached) {
      console.log('[QuestionCard] Trial limit reached in handleNext, blocking next question');
      toast?.('试用题目已达上限，请购买完整版或使用兑换码继续', { type: 'warning' });
      return; // 不继续执行下一题
    }
    
    // Explicitly call the onNext prop function with better error handling
    if (typeof onNext === 'function') {
      try {
        console.log('[QuestionCard] Calling onNext function from props');
        onNext();
      } catch (error) {
        console.error('[QuestionCard] Error calling onNext function:', error);
      }
    } else {
      console.error('[QuestionCard] onNext function is not properly defined, type:', typeof onNext);
    }
  };
  
  // Add a useEffect to handle cross-device access synchronization
  useEffect(() => {
    if (!user?.id || !questionSetId) return;
    
    const handleAccessRightsUpdate = (event: Event) => {
      const customEvent = event as CustomEvent;
      
      // If the event is for the current user, recheck local access status
      if (customEvent.detail?.userId === user.id) {
        // Refresh local access status
        const hasLocalAccess = checkLocalRedeemedStatus(questionSetId) || 
                              checkLocalAccessRights(questionSetId);
                              
        console.log(`[QuestionCard] Access rights updated for ${questionSetId}, local access: ${hasLocalAccess}`);
      }
    };
    
    window.addEventListener('accessRights:updated', handleAccessRightsUpdate);
    
    return () => {
      window.removeEventListener('accessRights:updated', handleAccessRightsUpdate);
    };
  }, [user?.id, questionSetId]);

  // Add event listener for trial ended event
  useEffect(() => {
    const handleTrialEnded = () => {
      console.log('[QuestionCard] Detected trial ended event');
      // This helps coordinate with QuizPage to show purchase dialog
      if (isPaid && !hasFullAccess) {
        setIsSubmitted(false);
        setShowExplanation(false);
      }
    };
    
    window.addEventListener('trial:ended', handleTrialEnded);
    
    return () => {
      window.removeEventListener('trial:ended', handleTrialEnded);
    };
  }, [isPaid, hasFullAccess]);

  // 修改简化isQuestionAccessible函数，将复杂逻辑转移到QuizPage
  const isQuestionAccessible = useCallback((questionIndex: number) => {
    // If question set is free, all questions are accessible
    if (!isPaid) return true;
    
    // First check if user has full access
    if (hasFullAccess) return true;
    
    // 对于试用题库，使用onJumpToQuestion来判断，不在QuestionCard内部实现
    // 这样可以确保QuestionCard和QuizPage的访问控制逻辑一致
    if (onJumpToQuestion) {
      // 仅检查是否为当前题目之前的题目，这些题目应该都可访问
      return questionIndex < questionNumber;
    }
    
    // 默认行为：在试用模式下仅允许访问试用题目数量内的题目
    return questionIndex < (trialQuestions || 0);
  }, [isPaid, hasFullAccess, trialQuestions, questionNumber, onJumpToQuestion]);

  // 修改处理题号跳转函数，简化逻辑
  const handleJumpToQuestion = (index: number) => {
    if (!onJumpToQuestion || isSubmittingRef.current) {
      return;
    }
    
    // 直接调用父组件的处理函数，由父组件决定是否可以跳转
    onJumpToQuestion(index);
  };

  // 清理定时器
  useEffect(() => {
    return () => {
      if (timeoutId) {
        clearTimeout(timeoutId);
      }
    };
  }, []);

  // 修复 Array.from 函数中对 totalQuestions 的使用，确保它是数字
  const renderNumberButtons = () => {
    // 确保 totalQuestions 是数字
    const count = typeof totalQuestions === 'number' ? totalQuestions : 1;
    
    return Array.from({ length: count }).map((_, index) => {
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
    });
  };

  // 添加一个函数检查本地存储的兑换状态，确保跨设备兑换信息一致
  const checkLocalRedeemedStatus = (questionSetId: string): boolean => {
    try {
      const redeemedStr = localStorage.getItem('redeemedQuestionSetIds');
      if (!redeemedStr) return false;
      
      const redeemedIds = JSON.parse(redeemedStr);
      if (!Array.isArray(redeemedIds)) return false;
      
      // 标准化ID
      const targetId = String(questionSetId).trim();
      
      // 使用更宽松的匹配逻辑检查兑换记录
      return redeemedIds.some(id => {
        const redeemedId = String(id || '').trim();
        // 精确匹配
        const exactMatch = redeemedId === targetId;
        // 部分匹配 - 处理ID可能带前缀或后缀的情况
        const partialMatch = (redeemedId.includes(targetId) || targetId.includes(redeemedId)) 
          && Math.abs(redeemedId.length - targetId.length) <= 3
          && redeemedId.length > 5 && targetId.length > 5;
          
        return exactMatch || partialMatch;
      });
    } catch (e) {
      console.error('检查兑换状态失败', e);
      return false;
    }
  };
  
  // 检查access权限
  const checkLocalAccessRights = (questionSetId: string): boolean => {
    try {
      const accessRightsStr = localStorage.getItem('quizAccessRights');
      if (!accessRightsStr) return false;
      
      const accessRights = JSON.parse(accessRightsStr);
      return !!accessRights[questionSetId];
    } catch (e) {
      console.error('检查访问权限失败', e);
      return false;
    }
  };
  
  // 合并所有访问权限检查
  const hasCompleteAccess = 
    hasFullAccess || 
    checkLocalRedeemedStatus(questionSetId) || 
    checkLocalAccessRights(questionSetId) ||
    isPaid === false; // 免费题库

  return (
    <div className="bg-white rounded-xl shadow-md p-6 mb-6">
      {/* 题目头部 */}
      <div className="flex justify-between items-start mb-6">
        <div className="flex items-center">
          <div className="bg-blue-100 text-blue-800 font-medium px-3 py-1 rounded-full text-sm mr-3">
            {questionNumber} / {totalQuestions}
          </div>
          <div className={`px-2 py-0.5 rounded-full text-xs ${
            question.questionType === 'single' 
              ? 'bg-green-100 text-green-800'
              : 'bg-purple-100 text-purple-800'
          }`}>
            {question.questionType === 'single' ? '单选题' : '多选题'}
          </div>
        </div>
        
        {/* 试用状态标签 */}
        {isPaid && (
          <div className={`px-2 py-0.5 rounded-full text-xs ${
            hasFullAccess 
              ? 'bg-green-100 text-green-800' 
              : trialLimitReached 
                ? 'bg-red-100 text-red-800 animate-pulse' 
                : 'bg-yellow-100 text-yellow-800'
          }`}>
            {hasFullAccess 
              ? '完整版' 
              : trialLimitReached 
                ? '试用已结束' 
                : `试用模式 (${questionNumber}/${trialQuestions}题)`
            }
          </div>
        )}
      </div>

      {/* 题目内容 */}
      <div className="mb-6">
        <h3 className="text-lg font-medium text-gray-800 mb-2">{question.question || question.text}</h3>
      </div>

      {/* 选项列表 */}
      <div className="space-y-3 mb-6">
        {question.options.map((option, index) => (
          <div
            key={option.id}
            className={`p-3 border rounded-lg cursor-pointer transition-colors ${getOptionClass(option)}`}
            onClick={() => {
              // 如果已提交答案，不允许更改选择
              if (isSubmitted || isSubmittingRef.current) {
                return;
              }
              
              if (question.questionType === 'single') {
                // 单选题: 直接设置为当前选择
                setSelectedOptions([option.id]);
              } else {
                // 多选题: 切换选中状态
                if (selectedOptions.includes(option.id)) {
                  setSelectedOptions(selectedOptions.filter(id => id !== option.id));
                } else {
                  setSelectedOptions([...selectedOptions, option.id]);
                }
              }
            }}
            role="button"
            tabIndex={0}
          >
            <div className="flex items-start">
              <div className={`w-6 h-6 rounded-full flex items-center justify-center border mr-3 flex-shrink-0 ${
                selectedOptions.includes(option.id) 
                  ? 'bg-blue-500 border-blue-500 text-white' 
                  : 'border-gray-300'
              }`}>
                <span className="text-sm font-medium">
                  {String.fromCharCode(65 + index)}
                </span>
              </div>
              <div className="text-gray-700">
                {option.text}
              </div>
            </div>
          </div>
        ))}
      </div>

      {/* 显示解析 */}
      {showExplanation && question.explanation && (
        <div className="mb-6">
          <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-4">
            <h4 className="font-semibold text-yellow-800 mb-2 flex items-center">
              <svg className="w-5 h-5 mr-1" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
              </svg>
              解析
            </h4>
            <div className="text-yellow-700 text-sm" dangerouslySetInnerHTML={{__html: question.explanation}} />
          </div>
        </div>
      )}

      {/* 修改合并提交答案与下一题按钮 */}
      <div className="mt-6">
        <button
          type="button"
          onClick={handleSubmit}
          disabled={(selectedOptions.length === 0 && !isSubmitted) || isSubmittingRef.current || trialLimitReached}
          className={`w-full px-4 py-3 rounded-lg text-white font-medium flex items-center justify-center ${
            (selectedOptions.length === 0 && !isSubmitted) || isSubmittingRef.current || trialLimitReached
              ? 'bg-gray-400 cursor-not-allowed'
              : isSubmitted
                ? 'bg-green-600 hover:bg-green-700'
                : 'bg-blue-600 hover:bg-blue-700'
          }`}
        >
          {isSubmitted ? (
            <>
              <svg className="w-5 h-5 mr-1" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
              </svg>
              {isLast ? '完成练习' : '下一题'}
            </>
          ) : (
            <>
              <svg className="w-5 h-5 mr-1" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
              </svg>
              提交答案
            </>
          )}
        </button>
      </div>
      
      {/* 题目导航：添加上一题和下一题按钮 */}
      {questionNumber > 1 && !trialLimitReached && (
        <div className="mt-4">
          <button 
            onClick={() => handleJumpToQuestion(questionNumber - 2)}
            className="text-gray-500 hover:text-gray-700 text-sm flex items-center"
          >
            <svg className="w-4 h-4 mr-1" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
            </svg>
            上一题
          </button>
        </div>
      )}
      
      {/* 答题进度指示器 */}
      {renderNumberButtons()}
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