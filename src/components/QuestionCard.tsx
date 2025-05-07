import { useState, useEffect, useRef, KeyboardEvent, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { Question } from '../types';
import QuestionOption from './QuestionOption';
import RedeemCodeForm from './RedeemCodeForm';
import { toast } from 'react-toastify';
import { useUser } from '../contexts/UserContext';
import { useSocket } from '../contexts/SocketContext';
import PaymentModal from './PaymentModal';

// 定义常量
const STORAGE_KEYS = {
  QUIZ_STATE_PREFIX: 'quiz_state_',
  REDEEMED_SETS: 'redeemedQuestionSetIds',
  ACCESS_RIGHTS: 'quizAccessRights',
  WRONG_ANSWER_PREFIX: 'wrong_answer_'
};

const EVENTS = {
  REDEEM_SUCCESS: 'redeem:success',
  ACCESS_RIGHTS_UPDATED: 'accessRights:updated',
  WRONG_ANSWER_SAVE: 'wrongAnswer:save'
};

const TIMEOUTS = {
  DEBOUNCE: 800,
  SHORT: 300,
  STANDARD: 500,
  LONG: 1000
};

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
  NEXT_QUESTION: '下一题',
  TRIAL_LIMIT: (count: number) => `您已完成${count}道试用题目。请购买完整题库或使用兑换码继续答题。`
};

interface QuestionWithCode extends Question {
  code?: string;
}

interface QuestionCardProps {
  question: QuestionWithCode;
  onAnswerSubmitted?: (isCorrect: boolean, selectedOption: string | string[]) => void;
  onNext?: () => void;
  isLast?: boolean;
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
  isTrialMode?: boolean;
  questionSetId: string;
}

/**
 * 计算答案是否正确的通用函数
 * @param question 题目对象
 * @param selectedOptionOrOptions 用户选择的选项ID或ID数组
 * @returns 是否回答正确
 */
const calculateIsCorrect = (question: QuestionWithCode, selectedOptionOrOptions: string | string[] | null): boolean => {
  if (!question || !question.options || !selectedOptionOrOptions) return false;
  
  const selectedIds = Array.isArray(selectedOptionOrOptions) 
    ? selectedOptionOrOptions 
    : [selectedOptionOrOptions];

  if (question.questionType === 'single') {
    const correctOptionId = question.options.find(opt => opt.isCorrect)?.id;
    return selectedIds[0] === correctOptionId;
  } else { // multiple
    const correctOptionIds = question.options
      .filter(opt => opt.isCorrect)
      .map(opt => opt.id);
    
    const lengthMatch = selectedIds.length === correctOptionIds.length;
    const allSelectedAreCorrect = selectedIds.every(id => correctOptionIds.includes(id));
    const allCorrectAreSelected = correctOptionIds.every(id => selectedIds.includes(id));
    
    return lengthMatch && allSelectedAreCorrect && allCorrectAreSelected;
  }
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
  isTrialMode = false,
  questionSetId,
  isLast = false
}: QuestionCardProps) => {
  const [selectedOptions, setSelectedOptions] = useState<string[]>([]);
  const [isSubmitted, setIsSubmitted] = useState(!!userAnsweredQuestion);
  const [showExplanation, setShowExplanation] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isCorrectAnswer, setIsCorrectAnswer] = useState(false);
  const isSubmittingRef = useRef<boolean>(false);
  const [selectedOption, setSelectedOption] = useState<string | null>(null);
  const [showRedeemCodeModal, setShowRedeemCodeModal] = useState(false);
  const [showPaymentModal, setShowPaymentModal] = useState(false);
  const navigate = useNavigate();
  
  // 添加ref以防止重复点击和提交
  const answerTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const lastSubmitTimeRef = useRef<number>(0);
  
  const { user, syncAccessRights } = useUser();
  const { socket } = useSocket();
  
  // 当userAnsweredQuestion存在时预填选项
  useEffect(() => {
    if (userAnsweredQuestion) {
      setIsSubmitted(true);
      if (question.questionType === 'single') {
        setSelectedOption(userAnsweredQuestion.selectedOption as string);
        setSelectedOptions([userAnsweredQuestion.selectedOption as string]);
      } else {
        setSelectedOptions(userAnsweredQuestion.selectedOption as string[]);
      }
    }
  }, [userAnsweredQuestion, question.questionType]);

  // 修改getOptionClass函数确保正确答案显示为绿色
  const getOptionClass = (option: any) => {
    if (!showExplanation) {
      // 没有提交答案时的样式
      return selectedOptions.includes(option.id)
        ? 'border-blue-300 bg-blue-50'
        : 'border-gray-300 bg-white hover:bg-gray-50';
    }
    
    // 已经提交答案，显示正确与错误状态
    if (option.isCorrect) {
      return 'border-green-500 bg-green-50 text-green-700'; // 正确答案
    } else if (selectedOptions.includes(option.id)) {
      return 'border-red-500 bg-red-50 text-red-700'; // 选择了错误答案
    } else {
      return 'border-gray-300 bg-gray-50 opacity-60'; // 其他未选答案
    }
  };

  // 修改handleOptionClick函数，移除自动提交代码
  const handleOptionClick = (optionText: string, optionId: string) => {
    if (isSubmittingRef.current || isSubmitted) {
      console.log('[QuestionCard] 正在提交答案中或已提交，忽略点击');
      return;
    }
    
    if (showExplanation) {
      console.log('[QuestionCard] 已显示解析，忽略点击');
      return;
    }
    
    // 增加试用模式检查，确保不能超过试用题目数量
    if (isTrialMode && !hasFullAccess && trialQuestions && questionNumber > trialQuestions) {
      console.log(`[QuestionCard] 已超过试用题目限制: ${questionNumber} > ${trialQuestions}`);
      
      // 显示购买或兑换提示
      toast.info(MESSAGES.TRIAL_LIMIT(trialQuestions));
      
      // 立即显示购买模态窗口
      setShowPaymentModal(true);
      return;
    }
    
    // 单选题模式 - 确保不会自动提交
    if (question.questionType === 'single') {
      if (selectedOptions.includes(optionId)) {
        return; // 已选中，不做处理
      }
      
      // 只更新选择状态，不自动提交 - 用户需要点击"提交答案"按钮
      setSelectedOptions([optionId]);
      setSelectedOption(optionId);
      console.log('[QuestionCard] 已选择单选项，等待用户手动提交');
      
      // 添加提示帮助用户理解需要点击提交按钮
      toast.info('请点击"提交答案"按钮确认您的选择', {
        autoClose: 1500,
        position: 'bottom-center'
      });
    } 
    // 多选题模式
    else {
      const updatedSelection = selectedOptions.includes(optionId)
        ? selectedOptions.filter(id => id !== optionId)
        : [...selectedOptions, optionId];
      
      setSelectedOptions(updatedSelection);
    }
  };

  // 增强试用模式检查，确保处理边界情况
  const canSubmitAnswer = useCallback(() => {
    // 如果已经提交过，不能再次提交
    if (isSubmittingRef.current || isSubmitted) return false;
    
    // 试用模式特殊处理 - 确保不能超过试用题目数量
    if (isTrialMode && !hasFullAccess && trialQuestions && questionNumber > trialQuestions) {
      console.log(`[QuestionCard] 已超过试用题目限制: ${questionNumber} > ${trialQuestions}`);
      // 显示购买或兑换提示
      toast.info(MESSAGES.TRIAL_LIMIT(trialQuestions), {
        position: "top-center",
        autoClose: 5000,
      });
      
      // 立即显示购买或兑换模态窗口
      setShowRedeemCodeModal(true);
      return false;
    }
    
    return true;
  }, [isSubmitted, isTrialMode, hasFullAccess, trialQuestions, questionNumber]);

  // 修改handleSubmit函数，确保试用模式检查并使用通用的回答检查函数
  const handleSubmit = async () => {
    // 增加试用模式安全检查
    if (!canSubmitAnswer()) return;
    
    isSubmittingRef.current = true;
    setIsSubmitting(true);

    try {
      // 检查是否选择了选项
      if (selectedOptions.length === 0) {
        toast.error(MESSAGES.SELECT_ONE_OPTION);
        return;
      }

      // 判断答案是否正确，使用通用函数
      const isCorrect = calculateIsCorrect(
        question, 
        question.questionType === 'single' ? selectedOption : selectedOptions
      );

      setIsCorrectAnswer(isCorrect);
      setIsSubmitted(true);
      setShowExplanation(true);
      
      // 调用父组件的回调
      if (onAnswerSubmitted) {
        onAnswerSubmitted(isCorrect, selectedOptions);
      }

      // 如果答错了，保存错题记录
      if (!isCorrect) {
        const wrongAnswerEvent = new CustomEvent(EVENTS.WRONG_ANSWER_SAVE, {
              detail: {
                questionId: question.id,
            questionSetId,
            question: question.question,
            selectedOption: selectedOptions,
            correctAnswer: question.options.filter(opt => opt.isCorrect).map(opt => opt.id),
            isCorrect: false
              }
            });
            window.dispatchEvent(wrongAnswerEvent);
      }

    } finally {
      setIsSubmitting(false);
      setTimeout(() => {
        isSubmittingRef.current = false;
      }, TIMEOUTS.STANDARD);
    }
  };

  // 添加一个函数检查本地存储的兑换状态，确保跨设备兑换信息一致
  const checkLocalRedeemedStatus = (questionSetId: string): boolean => {
    try {
      const redeemedStr = localStorage.getItem(STORAGE_KEYS.REDEEMED_SETS);
      if (!redeemedStr) return false;
      
      const redeemedIds = JSON.parse(redeemedStr);
      if (!Array.isArray(redeemedIds)) return false;
      
      // 标准化ID
      const targetId = String(questionSetId).trim();
      
      // 优先使用精确匹配，减少模糊匹配的风险
      return redeemedIds.some(id => {
        const redeemedId = String(id || '').trim();
        // 精确匹配
        return redeemedId === targetId;
      });
    } catch (e) {
      console.error('检查兑换状态失败', e);
      return false;
    }
  };
  
  // 检查access权限
  const checkLocalAccessRights = (questionSetId: string): boolean => {
    try {
      const accessRightsStr = localStorage.getItem(STORAGE_KEYS.ACCESS_RIGHTS);
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

  // 保存当前答题状态到localStorage
  const saveCurrentState = () => {
    try {
      if (!questionSetId || !question.id) return;
      
      // 构建本地存储的键名
      const storageKey = `${STORAGE_KEYS.QUIZ_STATE_PREFIX}${questionSetId}_${question.id}`;
      
      // 计算答案是否正确，使用通用函数
      const isCorrectValue = isSubmitted && calculateIsCorrect(
        question,
        question.questionType === 'single' ? selectedOption : selectedOptions
      );
      
      // 保存状态
      const stateToSave = {
                questionId: question.id,
        selectedOption: question.questionType === 'single' ? selectedOption : null,
        selectedOptions: question.questionType === 'multiple' ? selectedOptions : [],
        isSubmitted,
        isCorrect: isCorrectValue,
        showExplanation,
        timestamp: new Date().toISOString()
      };
      
      localStorage.setItem(storageKey, JSON.stringify(stateToSave));
    } catch (error) {
      console.error('保存答题状态失败:', error);
    }
  };

  // 清除组件卸载时可能存在的定时器
  useEffect(() => {
    return () => {
      if (answerTimeoutRef.current) {
        clearTimeout(answerTimeoutRef.current);
      }
    };
  }, []);

  // 检查下一题是否可以访问
  const isQuestionAccessible = (index: number) => {
    // 自由模式 - 可以访问所有题目
    if (!isTrialMode) return true;
    
    // 试用模式 - 只能访问指定数量范围内的题目
    const effectiveTrialLimit = trialQuestions || 0;
    
    // 如果有完整访问权限或者题目在试用范围内，则可以访问
    return hasCompleteAccess || index < effectiveTrialLimit;
  };

  // 跳转到指定题目
  const handleJumpToQuestion = (index: number) => {
    // 检查是否可以访问这道题
    if (!isQuestionAccessible(index)) {
      // 如果是付费题目且未购买，显示提示
      // 检查是否需要购买或兑换
      if (isPaid && !hasFullAccess) {
        toast?.('需要购买完整题库或使用兑换码才能访问', { type: 'warning' });
      }
      return;
    }
    
    if (onJumpToQuestion && !isSubmittingRef.current) {
      onJumpToQuestion(index);
    }
  };

  // 修改handleNext函数，增强试用限制检查
  const handleNext = () => {
    // 记录当前状态
    saveCurrentState();
    
    // 增强试用模式限制检查
    const nextQuestionNumber = questionNumber + 1;
    if (isTrialMode && !hasFullAccess && trialQuestions && nextQuestionNumber > trialQuestions) {
      console.log(`[QuestionCard] 已达到试用题目限制，下一题号将超过限制: ${nextQuestionNumber} > ${trialQuestions}`);
      
      // 显示购买或兑换提示
      toast.info(MESSAGES.TRIAL_LIMIT(trialQuestions));
      
      // 立即显示购买模态窗口
      setShowPaymentModal(true);
      return; // 阻止继续前进到下一题
    }
    
    // 调用onNext回调
    if (onNext) {
      onNext();
    }
  };

  // 增强试用模式状态监控的useEffect
  useEffect(() => {
    // 检查是否超出试用题目限制
    if (isTrialMode && !hasFullAccess && trialQuestions) {
      // 检查当前题目或下一题是否会超过限制
      if (questionNumber > trialQuestions) {
        console.log(`[QuestionCard] 检测到超过试用题目限制: ${questionNumber} > ${trialQuestions}`);
        
        // 显示购买或兑换提示
        toast.info(MESSAGES.TRIAL_LIMIT(trialQuestions), {
          position: "top-center",
          autoClose: 5000,
        });
        
        // 强制显示购买模态窗口，确保不会忽略
        setTimeout(() => {
          setShowPaymentModal(true);
        }, 300);
      }
    }
  }, [isTrialMode, hasFullAccess, trialQuestions, questionNumber]);

  // 监听全局事件
  useEffect(() => {
    // 当兑换码成功使用时更新状态
    const handleRedeemSuccess = (e: Event) => {
      const customEvent = e as CustomEvent;
      if (customEvent.detail?.questionSetId === questionSetId) {
        console.log('[QuestionCard] 兑换码成功使用，更新状态');
        
        // 关闭兑换码模态窗口
        setShowRedeemCodeModal(false);
        
        // 如果正在显示付费模态窗口，也一并关闭
        setShowPaymentModal(false);
        
        // 通知父组件刷新权限
        if (syncAccessRights) {
          syncAccessRights();
        }
      }
    };
    
    // 当访问权限更新时的处理
    const handleAccessRightsUpdate = (event: Event) => {
      console.log('[QuestionCard] 收到访问权限更新事件');
      
      // 关闭兑换码和付费模态窗口
      setShowRedeemCodeModal(false);
      setShowPaymentModal(false);
    };
    
    // 添加事件监听器
    window.addEventListener(EVENTS.REDEEM_SUCCESS, handleRedeemSuccess);
    window.addEventListener(EVENTS.ACCESS_RIGHTS_UPDATED, handleAccessRightsUpdate);
    
    // 清理函数
    return () => {
      window.removeEventListener(EVENTS.REDEEM_SUCCESS, handleRedeemSuccess);
      window.removeEventListener(EVENTS.ACCESS_RIGHTS_UPDATED, handleAccessRightsUpdate);
    };
  }, [questionSetId, syncAccessRights]);

  // 渲染用于显示在试用模式下的信息横幅
  const TrialInfoBanner = () => {
    if (!isTrialMode) return null;
    
    // 显示试用模式信息
    return (
      <div className="bg-yellow-50 border-l-4 border-yellow-400 p-4 mb-6">
        <div className="flex items-center">
          <div className="flex-shrink-0">
            <svg className="h-5 w-5 text-yellow-400" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20" fill="currentColor">
              <path fillRule="evenodd" d="M18 10a8 8 0 11-16 0 8 8 0 0116 0zm-7-4a1 1 0 11-2 0 1 1 0 012 0zM9 9a1 1 0 000 2v3a1 1 0 001 1h1a1 1 0 100-2v-3a1 1 0 00-1-1H9z" clipRule="evenodd" />
            </svg>
          </div>
          <div className="ml-3">
            <p className="text-sm text-yellow-700">
              <span className="font-medium">试用模式：</span> 您可以免费体验前 {trialQuestions} 道题，购买完整题库或使用兑换码可访问全部 {totalQuestions} 道题。
            </p>
          </div>
        </div>
      </div>
    );
  };

  // 渲染独立的解释部分，避免在每个正确选项下都显示
  const renderExplanation = () => {
    if (!isSubmitted || !showExplanation || !question.explanation) return null;
    
    return (
      <div className="mt-4 p-4 bg-gray-50 border border-gray-200 rounded-lg">
        <h4 className="font-medium text-gray-900 mb-2">解析:</h4>
        <p className="text-gray-700 whitespace-pre-wrap">{question.explanation}</p>
      </div>
    );
  };

  // 渲染分页按钮
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

  // 在QuestionCard组件中添加答题状态保存功能
  useEffect(() => {
    // 加载已保存的答题状态
    const loadSavedState = () => {
      try {
        if (!questionSetId || !question.id) return;
        
        // 构建本地存储的键名
        const storageKey = `${STORAGE_KEYS.QUIZ_STATE_PREFIX}${questionSetId}_${question.id}`;
        const savedStateStr = localStorage.getItem(storageKey);
        
        if (savedStateStr) {
          const savedState = JSON.parse(savedStateStr);
          
          // 恢复已选择的选项
          if (question.questionType === 'single' && savedState.selectedOption) {
            setSelectedOption(savedState.selectedOption);
            setSelectedOptions([savedState.selectedOption]);
          } else if (question.questionType === 'multiple' && savedState.selectedOptions) {
            setSelectedOptions(savedState.selectedOptions);
          }
          
          // 恢复已提交状态
          if (savedState.isSubmitted) {
            setIsSubmitted(true);
            setIsCorrectAnswer(savedState.isCorrect || false);
            
            // 移除对父组件的回调，防止自动答题
            // 注意：不再调用onAnswerSubmitted，仅恢复UI状态
            // 父组件应通过userAnsweredQuestion提供已处理答案的历史记录
            
            // 自动显示解析
            if (savedState.showExplanation) {
              setShowExplanation(true);
            }
          }
        }
      } catch (error) {
        console.error('加载已保存的答题状态失败:', error);
      }
    };
    
    // 初始加载
    if (!userAnsweredQuestion) {
      loadSavedState();
    }
    
    // 监听页面可见性变化
    const handleVisibilityChange = () => {
      if (document.visibilityState === 'hidden') {
        saveCurrentState();
      }
    };
    
    // 监听beforeunload事件
    const handleBeforeUnload = () => {
      saveCurrentState();
    };
    
    // 在组件卸载时保存状态
    const saveOnUnmount = () => {
      saveCurrentState();
    };
    
    // 添加事件监听器
    window.addEventListener('visibilitychange', handleVisibilityChange);
    window.addEventListener('beforeunload', handleBeforeUnload);
    
    // 清理函数
    return () => {
      saveOnUnmount();
      window.removeEventListener('visibilitychange', handleVisibilityChange);
      window.removeEventListener('beforeunload', handleBeforeUnload);
    };
  }, [question.id, questionSetId, question.questionType, userAnsweredQuestion]);

  // 修改handleOptionKeyDown函数，确保键盘操作也不会自动提交
  const handleOptionKeyDown = (e: React.KeyboardEvent<HTMLDivElement>, optionId: string, index: number) => {
    // 如果已经提交或正在提交，忽略键盘事件
    if (isSubmittingRef.current || isSubmitted) return;
    
    // 空格键或回车键仅选择选项，不自动提交
    if (e.key === ' ' || e.key === 'Enter') {
      e.preventDefault();
      handleOptionClick(question.options[index].text, optionId);
    }
  };

  // 修改全局键盘事件处理器，确保数字键不会触发自动提交
  useEffect(() => {
    const handleKeyDown = (e: globalThis.KeyboardEvent) => {
      // 如果已经提交或正在提交，忽略键盘事件
      if (isSubmittingRef.current || isSubmitted && e.key !== 'ArrowRight') return;
      
      // 左右箭头控制上一题/下一题
      if (e.key === 'ArrowLeft') {
        handlePrevious();
      } else if (e.key === 'ArrowRight' && isSubmitted) {
        handleNext();
      } else if (e.key === 'Enter' && selectedOptions.length > 0 && !isSubmitted) {
        // 只有在已经选择了选项的情况下，按Enter键才提交答案
        e.preventDefault(); // 防止页面滚动
        handleSubmit();
      }
      
      // 数字键选择选项 (1-9)
      const num = parseInt(e.key);
      if (!isNaN(num) && num >= 1 && num <= 9 && num <= question.options.length && !isSubmitted) {
        const optionIndex = num - 1;
        const option = question.options[optionIndex];
        
        if (option) {
          // 模拟点击选项，但不自动提交
          handleOptionClick(option.text, option.id);
        }
      }
    };
    
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isSubmitted, selectedOptions, question.options, question.questionType]);

  // 确保试用模式结束时显示购买窗口
  useEffect(() => {
    // 如果处于试用模式，且已达到试用限制，且用户没有完整访问权限
    const hasTrialEnded = 
      isTrialMode && 
      trialQuestions && 
      questionNumber >= trialQuestions && 
      !(hasFullAccess || checkLocalRedeemedStatus(questionSetId) || checkLocalAccessRights(questionSetId));
    
    if (hasTrialEnded) {
      console.log(`[QuestionCard] 检测到试用已结束: ${questionNumber}/${trialQuestions}`);
      // 在组件挂载后，如果试用已结束，立即显示购买窗口
      const timer = setTimeout(() => {
        setShowPaymentModal(true);
      }, 500);
      
      return () => clearTimeout(timer);
    }
  }, [isTrialMode, trialQuestions, questionNumber, hasFullAccess, questionSetId]);

  // 处理上一题按钮点击
  const handlePrevious = () => {
    if (onJumpToQuestion && questionNumber > 1) {
      onJumpToQuestion(questionNumber - 2); // 因为索引从0开始，问题编号从1开始
    }
  };

  // 修复按钮点击函数调用
  const renderButtonArea = () => (
    <div className="flex justify-between">
      <button
        onClick={handlePrevious}
        className="px-4 py-2 text-blue-600 hover:bg-blue-50 rounded-lg transition-colors flex items-center"
      >
        <svg className="w-5 h-5 mr-1" fill="none" viewBox="0 0 24 24" stroke="currentColor">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
        </svg>
        上一题
      </button>
      
      <div>
        {!isSubmitted ? (
          <button
            onClick={handleSubmit}
            disabled={selectedOptions.length === 0 || isSubmitting}
            className={`px-6 py-2 rounded-lg bg-blue-600 text-white hover:bg-blue-700 transition-colors flex items-center ${
              isSubmitting ? 'opacity-70 cursor-not-allowed' : ''
            }`}
          >
            {isSubmitting ? (
              <>
                <svg className="animate-spin -ml-1 mr-2 h-4 w-4 text-white" fill="none" viewBox="0 0 24 24">
                  <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                  <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                </svg>
                提交中...
              </>
            ) : (
              <>提交答案</>
            )}
          </button>
        ) : (
          <button
            onClick={handleNext}
            className={`px-6 py-2 rounded-lg ${
              isLast ? 'bg-green-600 hover:bg-green-700' : 'bg-blue-600 hover:bg-blue-700'
            } text-white transition-colors flex items-center`}
          >
            {isLast ? '完成答题' : '下一题'}
            <svg className="w-5 h-5 ml-1" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
            </svg>
          </button>
        )}
      </div>
    </div>
  );

  return (
    <div className="bg-white rounded-xl shadow-lg p-6 mb-6 transition-all">
      {/* 试用信息横幅 */}
      <TrialInfoBanner />
      
      {/* 题目信息 */}
      <div className="flex justify-between items-start mb-6">
        <div className="flex items-center">
          <span className="w-10 h-10 rounded-full bg-blue-100 text-blue-600 flex items-center justify-center font-medium text-lg mr-3">
            {questionNumber}
          </span>
          <h3 className="text-lg font-semibold text-gray-800">
            {question.questionType === 'single' ? '[单选题]' : '[多选题]'}
          </h3>
        </div>
        <span className="text-sm text-gray-500">
            {questionNumber} / {totalQuestions}
          </span>
      </div>

      {/* 题目内容 */}
      <div className="mb-6">
        <p className="text-gray-800 text-base whitespace-pre-wrap mb-2">{question.question}</p>
        {question.code && (
          <div className="bg-gray-900 rounded-md p-4 my-3 overflow-x-auto">
            <pre className="text-sm text-gray-100 font-mono">{question.code}</pre>
          </div>
        )}
      </div>

      {/* 选项列表 */}
      <div className="space-y-3 mb-6">
        {question.options.map((option, index) => (
          <div
            key={option.id}
            tabIndex={0}
            className={`relative p-4 border rounded-lg cursor-pointer transition-all 
              ${getOptionClass(option)}
              ${!isSubmitted ? 'hover:border-blue-300' : ''}
            `}
            onClick={() => !isSubmitted && handleOptionClick(option.text, option.id)}
            onKeyDown={(e) => handleOptionKeyDown(e, option.id, index)}
          >
            <div className="flex items-start">
              <div className={`flex-shrink-0 w-6 h-6 ${isSubmitted ? '' : 'border'} rounded-full flex items-center justify-center mr-3 mt-0.5 transition-colors ${
                selectedOptions.includes(option.id) 
                  ? (isSubmitted 
                      ? (option.isCorrect ? 'bg-green-500 text-white border-green-500' : 'bg-red-500 text-white border-red-500') 
                      : 'bg-blue-500 text-white border-blue-500'
                    )
                  : (isSubmitted && option.isCorrect ? 'bg-green-500 text-white border-green-500' : 'border-gray-300 text-transparent')
              }`}>
                {(selectedOptions.includes(option.id) || (isSubmitted && option.isCorrect)) && (
                  <svg className="w-4 h-4" fill="currentColor" viewBox="0 0 20 20" xmlns="http://www.w3.org/2000/svg">
                    <path fillRule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clipRule="evenodd" />
                  </svg>
                )}
            </div>
              <div>
                <span className="text-md text-gray-800">{option.label}. {option.text}</span>
          </div>
      </div>

            {/* 正确/错误指示器 */}
            {isSubmitted && (
              <div className="absolute right-4 top-4">
                {option.isCorrect ? (
                  <svg className="w-6 h-6 text-green-500" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
            </svg>
                ) : selectedOptions.includes(option.id) ? (
                  <svg className="w-6 h-6 text-red-500" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 14l2-2m0 0l2-2m-2 2l-2-2m2 2l2 2m7-2a9 9 0 11-18 0 9 9 0 0118 0z" />
                  </svg>
                ) : null}
        </div>
      )}
              </div>
        ))}
          </div>
          
      {/* 集中显示解析，只在一个地方显示 */}
      {renderExplanation()}
      
      {/* 操作按钮 */}
      {renderButtonArea()}
      
      {/* 题目导航 - 只在非试用模式或有完整访问权限时显示 */}
      {(!isTrialMode || hasFullAccess) && (
        <div className="mt-8">
          <h4 className="text-sm font-medium text-gray-700 mb-3">题目导航</h4>
          <div className="flex flex-wrap gap-2">
            {renderNumberButtons()}
          </div>
        </div>
      )}
      
      {/* 解释开关 */}
      {isSubmitted && question.explanation && (
        <button
          onClick={() => setShowExplanation(!showExplanation)}
          className="mt-4 text-sm text-blue-600 hover:text-blue-800 flex items-center"
        >
          {showExplanation ? (
            <>
              <svg className="w-4 h-4 mr-1" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
          </svg>
              隐藏解析
            </>
          ) : (
            <>
              <svg className="w-4 h-4 mr-1" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
              </svg>
              查看解析
            </>
          )}
        </button>
      )}
      
      {/* 兑换码模态窗口 */}
      {showRedeemCodeModal && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-lg p-6 max-w-md w-full">
            <div className="flex justify-between items-center mb-4">
              <h3 className="text-lg font-medium">兑换题库访问码</h3>
        <button
                onClick={() => setShowRedeemCodeModal(false)}
                className="text-gray-400 hover:text-gray-500"
              >
                <svg className="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
          </svg>
        </button>
      </div>
            <RedeemCodeForm 
              questionSetId={questionSetId}
              onRedeemSuccess={() => {
                // 触发兑换成功事件
                window.dispatchEvent(new CustomEvent(EVENTS.REDEEM_SUCCESS, {
                  detail: { questionSetId }
                }));
                
                // 显示成功消息
                toast.success('兑换码使用成功！您已获得完整访问权限。');
                
                // 关闭模态窗口
                setShowRedeemCodeModal(false);
              }}
            />
            <div className="mt-4 pt-4 border-t">
        <button
          onClick={() => {
                  setShowRedeemCodeModal(false);
                  setShowPaymentModal(true);
                }}
                className="w-full px-4 py-2 bg-green-500 text-white rounded-lg hover:bg-green-600 transition-colors"
              >
                购买完整题库
        </button>
      </div>
    </div>
        </div>
      )}
      
      {/* 支付模态窗口 */}
      {showPaymentModal && (
        <PaymentModal
          questionSetId={questionSetId}
          onClose={() => setShowPaymentModal(false)}
          onSuccess={() => {
            // 关闭模态窗口
            setShowPaymentModal(false);
            
            // 刷新访问权限
            if (syncAccessRights) {
              syncAccessRights();
            }
            
            // 显示成功消息
            toast.success('购买成功！您已获得完整访问权限。');
            
            // 触发权限更新事件
            window.dispatchEvent(new CustomEvent(EVENTS.ACCESS_RIGHTS_UPDATED));
          }}
        />
      )}
    </div>
  );
};

export default QuestionCard; 