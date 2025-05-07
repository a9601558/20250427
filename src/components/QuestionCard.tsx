import { useState, useEffect, useRef, KeyboardEvent, useCallback } from 'react';
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
  // 单选题选择一个选项，多选题选择多个选项
  const [selectedOption, setSelectedOption] = useState<string | null>(null);
  const [selectedOptions, setSelectedOptions] = useState<string[]>([]);
  const [isSubmitted, setIsSubmitted] = useState(!!userAnsweredQuestion);
  const [showExplanation, setShowExplanation] = useState(false);
  const [showRedeemCodeModal, setShowRedeemCodeModal] = useState(false);
  const navigate = useNavigate();
  let timeoutId: NodeJS.Timeout | undefined;
  
  // 添加ref以防止重复点击和提交
  const isSubmittingRef = useRef<boolean>(false);
  const answerTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const lastSubmitTimeRef = useRef<number>(0);
  
  // 为键盘导航跟踪当前选项
  const [focusedOptionIndex, setFocusedOptionIndex] = useState<number>(-1);
  
  const { user, syncAccessRights } = useUser();
  
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

  // 修复的正确性检查逻辑
  const isCorrect = userAnsweredQuestion
    ? userAnsweredQuestion.isCorrect
    : isSubmitted && (
        question.questionType === 'single'
          ? (() => {
              // 找到正确选项的ID
              const correctOptionId = question.options.find(opt => opt.isCorrect)?.id;
              return selectedOption === correctOptionId;
            })()
          : (() => {
              // 对于多选题，找出所有正确选项的ID
              const correctOptionIds = question.options
                .filter(opt => opt.isCorrect)
                .map(opt => opt.id);
              
              const lengthMatch = selectedOptions.length === correctOptionIds.length;
              const allSelectedAreCorrect = selectedOptions.every(id => correctOptionIds.includes(id));
              const allCorrectAreSelected = correctOptionIds.every(id => selectedOptions.includes(id));
                
              return (
                lengthMatch &&
                allSelectedAreCorrect &&
                allCorrectAreSelected
              );
            })()
      );

  const handleOptionClick = (optionText: string, optionId: string) => {
    if (isSubmittingRef.current) {
      console.log('[QuestionCard] 正在提交答案中，忽略点击');
      return;
    }
    
    if (showExplanation) {
      console.log('[QuestionCard] 已显示解析，忽略点击');
      return;
    }
    
    // 单选题模式
    if (question.questionType === 'single') {
      // 更新选择状态
      setSelectedOption(optionId);
      setSelectedOptions([optionId]);
      
      // 禁用自动提交功能，要求用户手动提交答案
      console.log('[QuestionCard] 单选题选中选项:', optionId);
      
      // 清除任何可能存在的自动提交定时器
      if (answerTimeoutRef.current) {
        clearTimeout(answerTimeoutRef.current);
        answerTimeoutRef.current = null;
      }
      
      // 移除自动提交行为，改为要求手动提交
      // 这样可以防止用户意外提交和在切换题目后自动选择问题
    } 
    // 多选题模式
    else {
      const updatedSelection = selectedOptions.includes(optionId)
        ? selectedOptions.filter(id => id !== optionId)
        : [...selectedOptions, optionId];
      
      setSelectedOptions(updatedSelection);
      console.log('[QuestionCard] 多选题更新选项:', updatedSelection);
    }
  };

  const handleSubmit = () => {
    // 如果已提交且显示解析中，则转为下一题逻辑
    if (isSubmitted && showExplanation) {
      handleNext();
      return;
    }

    // 防重复提交机制
    if (isSubmittingRef.current || isSubmitted) return;
    isSubmittingRef.current = true;
    
    try {
      // 先检查是否已选择答案
      if (selectedOptions.length === 0) {
        // 未选择任何选项，显示提示
        toast?.('请至少选择一个选项', { type: 'warning' });
        isSubmittingRef.current = false;
        return;
      }
      
      // 标记为已提交
      setIsSubmitted(true);
      
      // 单选题处理
      if (question.questionType === 'single') {
        // 获取单选题的选择
        const selectedId = selectedOptions[0];
        const selectedText = question.options.find(opt => opt.id === selectedId)?.text || '';
        
        // 判断答案是否正确
        const correctOptionId = question.options.find(opt => opt.isCorrect)?.id;
        const isCorrect = selectedId === correctOptionId;
        
        console.log(`[QuestionCard] 提交单选题: 选择=${selectedId}, 正确答案=${correctOptionId}, 正确=${isCorrect}`);
        
        // 显示解析
        setShowExplanation(true);
        
        // 调用父组件回调
        if (onAnswerSubmitted) {
          onAnswerSubmitted(isCorrect, selectedId);
        }
        
        // 处理错题保存和答对自动跳转
        if (!isCorrect) {
          // 保存错题
          saveWrongAnswer(selectedId);
        }
      } 
      // 多选题处理
      else {
        // 收集选择的选项ID和文本
        const selectedIds = [...selectedOptions];
        const selectedTexts = selectedIds.map(id => 
          question.options.find(opt => opt.id === id)?.text || ''
        );
        
        // 判断答案是否正确
        const correctOptionIds = question.options
          .filter(opt => opt.isCorrect)
          .map(opt => opt.id);
        
        // 需要所有正确答案都被选中，且不能选错
        const allCorrectSelected = correctOptionIds.every(id => selectedIds.includes(id));
        const noIncorrectSelected = selectedIds.every(id => correctOptionIds.includes(id));
        const isCorrect = allCorrectSelected && noIncorrectSelected;
        
        console.log(`[QuestionCard] 提交多选题: 选择=[${selectedIds.join(',')}], 正确答案=[${correctOptionIds.join(',')}], 正确=${isCorrect}`);
        
        // 显示解析
        setShowExplanation(true);
        
        // 调用父组件回调
        if (onAnswerSubmitted) {
          onAnswerSubmitted(isCorrect, selectedIds);
        }
        
        // 处理错题保存和答对自动跳转
        if (!isCorrect) {
          // 保存错题
          saveWrongAnswer(selectedIds);
        }
      }
      
      // 允许跳转到下一题
      setCanProceed(true);
      
      // 保存答题状态
      saveCurrentState();
      
    } catch (error) {
      console.error('[QuestionCard] 提交答案出错:', error);
    } finally {
      // 延迟释放提交锁
      setTimeout(() => {
        isSubmittingRef.current = false;
      }, 1000);
    }
  };

  // 添加状态来控制是否可以继续到下一题
  const [canProceed, setCanProceed] = useState(false);

  // 修改getOptionClass函数，在试用限制时禁用交互
  const getOptionClass = (option: any) => {
    // 如果已达到试用限制，禁用所有选项
    if (isPaid && !hasFullAccess && trialLimitReached) {
      return 'border-gray-300 bg-gray-50 opacity-60 pointer-events-none';
    }
    
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

  const handleNext = () => {
    console.log('[QuestionCard] handleNext called - moving to next question');
    
    // Debug information to identify potential issues
    console.log(`[QuestionCard] Current state: isSubmitted=${isSubmitted}, showExplanation=${showExplanation}`);
    
    // Clear any selected options immediately
    setSelectedOption(null);
    setSelectedOptions([]);
    setIsSubmitted(false);
    setShowExplanation(false);
    setCanProceed(false); // Reset canProceed to prevent auto-submission
    
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
        setCanProceed(false);
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
      
      // 清除答案提交定时器
      if (answerTimeoutRef.current) {
        clearTimeout(answerTimeoutRef.current);
        answerTimeoutRef.current = null;
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

  // 在QuestionCard组件中添加答题状态保存功能
  useEffect(() => {
    // 加载已保存的答题状态
    const loadSavedState = () => {
      try {
        if (!questionSetId || !question.id) return;
        
        // 构建本地存储的键名
        const storageKey = `quiz_state_${questionSetId}_${question.id}`;
        const savedStateStr = localStorage.getItem(storageKey);
        
        if (savedStateStr) {
          const savedState = JSON.parse(savedStateStr);
          
          // 恢复已选择的选项
          if (question.questionType === 'single' && savedState.selectedOption) {
            setSelectedOption(savedState.selectedOption);
          } else if (question.questionType === 'multiple' && savedState.selectedOptions) {
            setSelectedOptions(savedState.selectedOptions);
          }
          
          // 恢复已提交状态
          if (savedState.isSubmitted) {
            setIsSubmitted(true);
            
            // 如果之前已经提交过答案，同时通知父组件
            if (onAnswerSubmitted && !userAnsweredQuestion) {
              const isCorrect = savedState.isCorrect;
              const selectedOpt = question.questionType === 'single' 
                ? savedState.selectedOption 
                : savedState.selectedOptions;
                
              // 延迟触发以确保组件已完全加载
              setTimeout(() => {
                onAnswerSubmitted(isCorrect, selectedOpt);
              }, 300);
            }
            
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
  }, [question.id, questionSetId, question.questionType, userAnsweredQuestion, onAnswerSubmitted]);

  // 保存当前答题状态到localStorage
  const saveCurrentState = () => {
    try {
      if (!questionSetId || !question.id) return;
      
      // 构建本地存储的键名
      const storageKey = `quiz_state_${questionSetId}_${question.id}`;
      
      // 如果已经提交过，计算是否正确
      let isCorrectAnswer = false;
      if (isSubmitted) {
        if (question.questionType === 'single') {
          const correctOptionId = question.options.find(opt => opt.isCorrect)?.id;
          isCorrectAnswer = selectedOption === correctOptionId;
        } else {
          const correctOptionIds = question.options
            .filter(opt => opt.isCorrect)
            .map(opt => opt.id);
            
          const lengthMatch = selectedOptions.length === correctOptionIds.length;
          const allSelectedAreCorrect = selectedOptions.every(id => correctOptionIds.includes(id));
          const allCorrectAreSelected = correctOptionIds.every(id => selectedOptions.includes(id));
          
          isCorrectAnswer = lengthMatch && allSelectedAreCorrect && allCorrectAreSelected;
        }
      }
      
      // 保存状态
      const stateToSave = {
        questionId: question.id,
        selectedOption: question.questionType === 'single' ? selectedOption : null,
        selectedOptions: question.questionType === 'multiple' ? selectedOptions : [],
        isSubmitted,
        isCorrect: isCorrectAnswer,
        showExplanation,
        timestamp: new Date().toISOString()
      };
      
      localStorage.setItem(storageKey, JSON.stringify(stateToSave));
    } catch (error) {
      console.error('保存答题状态失败:', error);
    }
  };

  // 处理选项键盘操作
  const handleOptionKeyDown = (e: React.KeyboardEvent<HTMLDivElement>, optionId: string, index: number) => {
    // 空格键或回车键选择选项
    if (e.key === ' ' || e.key === 'Enter') {
      e.preventDefault();
      handleOptionClick(question.options[index].text, optionId);
    }
  };

  // 处理上一题按钮点击
  const handlePrevious = () => {
    if (onJumpToQuestion && questionNumber > 1) {
      onJumpToQuestion(questionNumber - 2); // 因为索引从0开始，问题编号从1开始
    }
  };

  // 修改键盘事件处理器，支持空格键提交/下一题
  useEffect(() => {
    const handleKeyDown = (e: globalThis.KeyboardEvent) => {
      // 左右箭头控制上一题/下一题
      if (e.key === 'ArrowLeft') {
        handlePrevious();
      } else if (e.key === 'ArrowRight' && isSubmitted) {
        handleNext();
      }
      
      // 空格键提交答案/下一题
      if (e.key === ' ' && !e.target) {
        e.preventDefault();
        handleSubmit();
      }
      
      // 数字键选择选项 (1-9)
      const num = parseInt(e.key);
      if (!isNaN(num) && num >= 1 && num <= 9 && num <= question.options.length && !isSubmitted) {
        const optionIndex = num - 1;
        const option = question.options[optionIndex];
        if (option) {
          handleOptionClick(option.text, option.id);
        }
      }
    };
    
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isSubmitted, showExplanation, canProceed, question.options]);

  // 保存错题的辅助函数
  const saveWrongAnswer = (selectedAnswer: string | string[]) => {
    // 检查此题是否最近已保存过，避免重复保存
    const wrongAnswerKey = `wrong_answer_${question.id}`;
    const lastSaved = localStorage.getItem(wrongAnswerKey);
    const now = Date.now();
    
    // 5秒内不重复保存同一题目
    if (!lastSaved || now - parseInt(lastSaved) > 5000) {
      localStorage.setItem(wrongAnswerKey, now.toString());
      
      // 创建错题保存事件
      const wrongAnswerEvent = new CustomEvent('wrongAnswer:save', {
        detail: {
          questionId: question.id,
          questionSetId: questionSetId,
          question: question.question || question.text,
          questionText: question.question || question.text,
          questionType: question.questionType,
          options: question.options,
          selectedOption: question.questionType === 'single' ? selectedAnswer : undefined,
          selectedOptions: question.questionType === 'multiple' ? selectedAnswer : undefined,
          correctOption: question.questionType === 'single' 
            ? question.options.find(opt => opt.isCorrect)?.id 
            : undefined,
          correctOptions: question.questionType === 'multiple'
            ? question.options.filter(opt => opt.isCorrect).map(opt => opt.id)
            : undefined,
          explanation: question.explanation
        }
      });
      
      // 发送事件
      window.dispatchEvent(wrongAnswerEvent);
      console.log('[QuestionCard] 已保存错题');
    }
  };

  return (
    <div className="bg-white rounded-xl shadow-md p-6 mb-6">
      {/* 题目信息 */}
      <div className="mb-4 flex justify-between items-center">
        <div className="flex items-center">
          <span className="bg-blue-100 text-blue-700 text-sm px-3 py-1 rounded-full font-medium mr-2">
            {questionNumber} / {totalQuestions}
          </span>
          <span className="text-sm text-gray-500 bg-gray-100 px-2 py-0.5 rounded">
            {question.questionType === 'single' ? '单选题' : '多选题'}
          </span>
        </div>
        
        {/* 添加试用限制标志 */}
        {isPaid && !hasFullAccess && trialLimitReached && (
          <span className="bg-red-100 text-red-600 text-xs px-2 py-1 rounded">
            试用已结束
          </span>
        )}
      </div>

      {/* 题目内容 */}
      <h2 className="text-lg font-semibold text-gray-800 mb-5">{question.question || question.text}</h2>

      {/* 选项列表 */}
      <div className="space-y-3 mt-4">
        {question.options.map((option, index) => (
          <div
            key={option.id}
            className={`flex items-start p-3 border rounded-lg cursor-pointer transition-all duration-150 ${getOptionClass(option)}`}
            onClick={() => !showExplanation && !trialLimitReached && handleOptionClick(option.text, option.id)}
          >
            <div className={`w-6 h-6 rounded-full flex-shrink-0 flex items-center justify-center mr-3 ${
              showExplanation && option.isCorrect 
                ? 'bg-green-100 text-green-700' 
                : (showExplanation && selectedOptions.includes(option.id)) 
                  ? 'bg-red-100 text-red-700' 
                  : selectedOptions.includes(option.id)
                    ? 'bg-blue-100 text-blue-700'
                    : 'bg-gray-100 text-gray-700'
            }`}>
              {String.fromCharCode(65 + index)}
            </div>
            <div className="mt-0.5 text-sm">{option.text}</div>
          </div>
        ))}
      </div>

      {/* 合并提交答案与下一题按钮 */}
      <div className="mt-6">
        <button
          onClick={handleSubmit}
          disabled={(selectedOptions.length === 0 && !isSubmitted) || isSubmittingRef.current || trialLimitReached}
          className={`w-full px-4 py-2 rounded-md text-white font-medium flex items-center justify-center ${
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
      
      {/* 解析显示区域 */}
      {showExplanation && (
        <div className="mt-5">
          <div className="p-4 bg-blue-50 rounded-lg border border-blue-100">
            <div className="flex items-start">
              <div className="bg-blue-100 p-1 rounded-md text-blue-700 mr-3 flex-shrink-0">
                <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                </svg>
              </div>
              <div>
                <h3 className="font-medium text-blue-800 mb-1">解析</h3>
                <p className="text-sm text-blue-700">{question.explanation || "本题暂无解析"}</p>
              </div>
            </div>
          </div>
          
          {/* 答案正确/错误提示 */}
          <div className="mt-4 text-center">
            <div className={`inline-block px-4 py-2 rounded-full font-medium text-sm ${
              selectedOptions.some(id => 
                question.options.find(opt => opt.id === id)?.isCorrect
              ) 
                ? 'bg-green-100 text-green-800' 
                : 'bg-red-100 text-red-800'
            }`}>
              {selectedOptions.some(id => 
                question.options.find(opt => opt.id === id)?.isCorrect
              ) 
                ? '答对了' 
                : '答错了'
              }
            </div>
          </div>
        </div>
      )}
      
      {/* 题目导航与辅助按钮 */}
      <div className="mt-6 flex justify-between items-center">
        <button
          onClick={handlePrevious}
          className={`px-5 py-2 rounded-md flex items-center ${
            questionNumber > 1 && !trialLimitReached 
              ? 'text-gray-700 bg-gray-100 hover:bg-gray-200'
              : 'text-gray-400 bg-gray-50 cursor-not-allowed'
          }`}
          disabled={questionNumber <= 1 || trialLimitReached}
        >
          <svg className="w-5 h-5 mr-1" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
          </svg>
          上一题
        </button>
      </div>
      
      {/* 键盘快捷键提示 */}
      <div className="mt-4 text-center text-xs text-gray-500">
        <span className="bg-gray-100 rounded px-1.5 py-0.5 mr-1">←</span>上一题
        <span className="ml-3 bg-gray-100 rounded px-1.5 py-0.5 mr-1">Space</span>
        {isSubmitted ? '下一题' : '提交答案'}
        <span className="ml-3 bg-gray-100 rounded px-1.5 py-0.5 mr-1">1-9</span>选择选项
      </div>
      
      {/* 添加清空答题按钮 */}
      <div className="mt-3 text-center">
        <button
          onClick={() => {
            if (window.confirm('确定要清空当前题目的答题记录吗？')) {
              try {
                // 清除当前题目的状态记录
                if (questionSetId && question.id) {
                  const storageKey = `quiz_state_${questionSetId}_${question.id}`;
                  localStorage.removeItem(storageKey);
                  
                  // 重置组件状态
                  setSelectedOption(null);
                  setSelectedOptions([]);
                  setIsSubmitted(false);
                  setShowExplanation(false);
                  
                  // 展示成功消息
                  toast.success('已清空当前题目的答题记录');
                }
              } catch (e) {
                console.error('清空答题记录失败:', e);
                toast.error('清空答题记录失败');
              }
            }
          }}
          className="text-gray-500 hover:text-red-600 text-xs underline transition-colors"
        >
          清空当前题目答题记录
        </button>
      </div>

      {/* 在需要时显示试用限制警告 */}
      {isPaid && !hasFullAccess && trialLimitReached && (
        <div className="mt-4 p-3 bg-yellow-50 border border-yellow-200 rounded-lg">
          <div className="flex items-center text-yellow-700">
            <svg className="w-5 h-5 mr-2" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
            </svg>
            <span>您已达到试用题目限制，需要购买完整版或使用兑换码继续使用。无法回看已答题目。</span>
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