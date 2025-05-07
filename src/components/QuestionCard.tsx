import { useState, useEffect, useRef, KeyboardEvent, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { Question } from '../types';
import QuestionOption from './QuestionOption';
import RedeemCodeForm from './RedeemCodeForm';
import { toast } from 'react-toastify';
import { useUser } from '../contexts/UserContext';

interface QuestionWithCode extends Question {
  code?: string;
}

interface QuestionCardProps {
  question: QuestionWithCode;
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
  isSubmittingAnswer = false
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
      if (selectedOptions.includes(optionId)) {
        return; // 已选中，不做处理
      }
      setSelectedOptions([optionId]);
      
      // 单选题可自动提交
      console.log('[QuestionCard] 单选题自动提交答案');
      
      // 延迟提交，给用户时间看清自己的选择
      isSubmittingRef.current = true;
      
      if (answerTimeoutRef.current) {
        clearTimeout(answerTimeoutRef.current);
      }
      
      try {
        answerTimeoutRef.current = setTimeout(() => {
          handleSubmitAnswer([optionId], [optionText]);
          // 确保超时后重置状态
          isSubmittingRef.current = false;
        }, 300);
      } catch (error) {
        // 确保出错时也会重置提交状态
        console.error('[QuestionCard] 提交选项出错:', error);
        isSubmittingRef.current = false;
      }
    } 
    // 多选题模式
    else {
      const updatedSelection = selectedOptions.includes(optionId)
        ? selectedOptions.filter(id => id !== optionId)
        : [...selectedOptions, optionId];
      
      setSelectedOptions(updatedSelection);
    }
  };

  const handleSubmitAnswer = (selectedIds: string[], selectedTexts: string[]) => {
    if (isSubmittingRef.current && Date.now() - lastSubmitTimeRef.current < 800) {
      console.log('[QuestionCard] 正在提交答案中，忽略重复提交');
      return;
    }

    if (showExplanation) {
      console.log('[QuestionCard] 已显示解析，忽略提交');
      return;
    }
    
    if (selectedIds.length === 0) {
      console.log('[QuestionCard] 未选择任何选项，忽略提交');
      return;
    }
    
    // 防止重复提交
    isSubmittingRef.current = true;
    lastSubmitTimeRef.current = Date.now();
    
    // 判断答案是否正确
    let isCorrect = false;
    
    try {
      // 单选题模式
      if (question.questionType === 'single') {
        // 正确答案ID就是question.answer
        const correctOptionId = question.options.find(opt => opt.isCorrect)?.id;
        isCorrect = selectedIds[0] === correctOptionId;
        
        console.log(`[QuestionCard] 单选题提交: 选择=${selectedIds[0]}, 正确答案=${correctOptionId}, 正确=${isCorrect}`);
      } 
      // 多选题模式
      else {
        const correctOptionIds = question.options
          .filter(opt => opt.isCorrect)
          .map(opt => opt.id);
        
        // 检查是否选择了所有正确答案，且没有选择错误答案
        const allCorrectSelected = correctOptionIds.every(id => selectedIds.includes(id));
        const noIncorrectSelected = selectedIds.every(id => correctOptionIds.includes(id));
        
        isCorrect = allCorrectSelected && noIncorrectSelected;
        
        console.log(`[QuestionCard] 多选题提交: 选择=${selectedIds.join(',')}, 正确答案=${correctOptionIds.join(',')}, 正确=${isCorrect}`);
      }
      
      // 强制显示解析
      setShowExplanation(true);
      
      // 调用父组件提供的答案提交处理函数
      if (onAnswerSubmitted) {
        onAnswerSubmitted(isCorrect, selectedIds);
      }
      
      // 如果回答错误，记录错题
      if (!isCorrect && onAnswerSubmitted) {
        // 检查此题是否最近已保存过，避免重复保存
        const wrongAnswerKey = `wrong_answer_${question.id}`;
        const lastSaved = sessionStorage.getItem(wrongAnswerKey);
        const now = new Date().getTime();
        
        // 一小时内不重复保存同一题目
        if (!lastSaved || now - parseInt(lastSaved, 10) > 60 * 60 * 1000) {
          sessionStorage.setItem(wrongAnswerKey, now.toString());
          
          // 保存错题
          setTimeout(() => {
            // 使用事件方式提交错题，避免直接依赖socket
            const wrongAnswerEvent = new CustomEvent('wrongAnswer:save', {
              detail: {
                questionId: question.id,
                questionSetId: questionSetId,
                question: question.question || question.text,
                questionType: question.questionType,
                options: question.options,
                selectedOption: question.questionType === 'single' ? selectedIds[0] : undefined,
                selectedOptions: question.questionType === 'multiple' ? selectedIds : undefined,
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
          }, 400);
        }
      }
      
      // 允许继续
      setCanProceed(true);
      
    } catch (error) {
      console.error('[QuestionCard] 提交答案出错:', error);
      // 确保错误情况下也会重置提交状态并允许继续
      setCanProceed(true);
    } finally {
      // 延迟释放提交锁
      setTimeout(() => {
        isSubmittingRef.current = false;
      }, 800);
    }
  };

  // 添加状态来控制是否可以继续到下一题
  const [canProceed, setCanProceed] = useState(false);

  // 确保渲染时正确地显示选项样式
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

  const handleSubmit = () => {
    // 防止重复提交
    if (isSubmittingRef.current || isSubmitted) return;
    isSubmittingRef.current = true;
    
    try {
      if (question.questionType === 'single' && selectedOption) {
        setIsSubmitted(true);
        
        // 修改判断逻辑，找到正确选项的ID比较
        const correctOptionId = question.options.find(opt => opt.isCorrect)?.id;
        const isCorrect = selectedOption === correctOptionId;
        
        if (onAnswerSubmitted) {
          onAnswerSubmitted(isCorrect, selectedOption);
        }

        // 如果回答错误，保存到错题集
        if (!isCorrect) {
          // 检查此题是否最近已保存过，避免重复保存
          const wrongAnswerKey = `wrong_answer_${question.id}`;
          const lastSaved = localStorage.getItem(wrongAnswerKey);
          const now = Date.now();
          
          if (!lastSaved || now - parseInt(lastSaved) > 5000) { // 5秒内不重复保存
            localStorage.setItem(wrongAnswerKey, now.toString());
            // 修复: 确保包含完整的 question 字段
            const wrongAnswerEvent = new CustomEvent('wrongAnswer:save', {
              detail: {
                questionId: question.id,
                questionSetId: questionSetId,
                question: question.question || question.text, // 使用 question.question 或 question.text 字段
                questionText: question.question || question.text, // 额外提供字段以防模型需要
                questionType: question.questionType,
                options: question.options,
                selectedOption: selectedOption,
                correctOption: correctOptionId,
                explanation: question.explanation
              }
            });
            window.dispatchEvent(wrongAnswerEvent);
            
            // 错误时显示解析
            setShowExplanation(true);
          }
        } else {
          // 答对自动更快地跳到下一题 (400ms)
          timeoutId = setTimeout(() => {
            handleNext();
          }, 400);
        }
      } else if (question.questionType === 'multiple' && selectedOptions.length > 0) {
        setIsSubmitted(true);
        
        // 修改多选题判断逻辑
        const correctOptionIds = question.options
          .filter(opt => opt.isCorrect)
          .map(opt => opt.id);
        
        const lengthMatch = selectedOptions.length === correctOptionIds.length;
        const allSelectedAreCorrect = selectedOptions.every(id => correctOptionIds.includes(id));
        const allCorrectAreSelected = correctOptionIds.every(id => selectedOptions.includes(id));
        const isCorrect = lengthMatch && allSelectedAreCorrect && allCorrectAreSelected;
        
        if (onAnswerSubmitted) {
          onAnswerSubmitted(isCorrect, selectedOptions);
        }

        // 如果回答错误，保存到错题集
        if (!isCorrect) {
          // 检查此题是否最近已保存过，避免重复保存
          const wrongAnswerKey = `wrong_answer_${question.id}`;
          const lastSaved = localStorage.getItem(wrongAnswerKey);
          const now = Date.now();
          
          if (!lastSaved || now - parseInt(lastSaved) > 5000) { // 5秒内不重复保存
            localStorage.setItem(wrongAnswerKey, now.toString());
            // 修复: 确保包含完整的 question 字段
            const wrongAnswerEvent = new CustomEvent('wrongAnswer:save', {
              detail: {
                questionId: question.id,
                questionSetId: questionSetId,
                question: question.question || question.text, // 使用 question.question 或 question.text 字段
                questionText: question.question || question.text, // 额外提供字段以防模型需要
                questionType: question.questionType,
                options: question.options,
                selectedOptions: selectedOptions,
                correctOptions: correctOptionIds,
                explanation: question.explanation
              }
            });
            window.dispatchEvent(wrongAnswerEvent);
            
            // 错误时显示解析
            setShowExplanation(true);
          }
        } else {
          // 答对自动更快地跳到下一题 (400ms)
          timeoutId = setTimeout(() => {
            handleNext();
          }, 400);
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

  // Enhanced local access check function
  const isQuestionAccessible = useCallback((questionIndex: number) => {
    // If question set is free, all questions are accessible
    if (!isPaid) return true;
    
    // First check if user has full access
    if (hasFullAccess) return true;
    
    // Check local storage for redeemed status and access rights
    const hasLocalAccess = checkLocalRedeemedStatus(questionSetId) || 
                          checkLocalAccessRights(questionSetId);
    
    if (hasLocalAccess) return true;
    
    // If no access, check if within trial questions
    return questionIndex < (trialQuestions || 0);
  }, [isPaid, hasFullAccess, trialQuestions, questionSetId]);

  // 处理题号跳转
  const handleJumpToQuestion = (index: number) => {
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

  // 清除组件卸载时可能存在的定时器
  useEffect(() => {
    return () => {
      if (answerTimeoutRef.current) {
        clearTimeout(answerTimeoutRef.current);
      }
    };
  }, []);

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

  // 添加快捷键支持
  useEffect(() => {
    const handleKeyDown = (e: globalThis.KeyboardEvent) => {
      // 左右箭头控制上一题/下一题
      if (e.key === 'ArrowLeft') {
        handlePrevious();
      } else if (e.key === 'ArrowRight' && (showExplanation || canProceed)) {
        handleNext();
      }
      
      // 数字键选择选项 (1-9)
      const num = parseInt(e.key);
      if (!isNaN(num) && num >= 1 && num <= 9 && num <= question.options.length) {
        const optionIndex = num - 1;
        const option = question.options[optionIndex];
        if (option) {
          handleOptionClick(option.text, option.id);
        }
      }
    };
    
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [showExplanation, canProceed, question.options]);

  // 添加试用信息组件
  const TrialInfoBanner = () => {
    // 如果不是付费题库或者用户有完整访问权限，不显示试用信息
    if (!isPaid || hasFullAccess) return null;
    
    // 这里显示试用信息，包括当前是第几题、试用总题数等
    return (
      <div className="mb-4 bg-gradient-to-r from-blue-50 to-indigo-50 border border-blue-100 rounded-lg p-3">
        <div className="flex items-center">
          <svg className="w-5 h-5 text-blue-500 mr-2" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
          </svg>
          <span className="text-sm text-blue-800">
            您正在试用模式下答题 <span className="font-medium">({questionNumber} / {totalQuestions}题)</span>
          </span>
        </div>
      </div>
    );
  };

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
                      ? (isCorrect ? 'bg-green-500 text-white border-green-500' : 'bg-red-500 text-white border-red-500') 
                      : 'bg-blue-500 text-white border-blue-500'
                    )
                  : 'border-gray-300 text-transparent'
              }`}>
                {selectedOptions.includes(option.id) && (
                  <svg className="w-4 h-4" fill="currentColor" viewBox="0 0 20 20" xmlns="http://www.w3.org/2000/svg">
                    <path fillRule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clipRule="evenodd" />
                  </svg>
                )}
              </div>
              <div>
                <span className="text-md text-gray-800">{option.label}. {option.text}</span>
                {/* 解释 */}
                {isSubmitted && option.isCorrect && showExplanation && question.explanation && (
                  <div className="mt-2 text-sm text-green-700 bg-green-50 p-3 rounded-md">
                    <p className="font-medium mb-1">解释:</p>
                    <p className="whitespace-pre-wrap">{question.explanation}</p>
                  </div>
                )}
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
      
      {/* 操作按钮 */}
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
              disabled={selectedOptions.length === 0 || isSubmittingRef.current}
              className={`px-6 py-2 rounded-lg bg-blue-600 text-white hover:bg-blue-700 transition-colors flex items-center ${
                isSubmittingRef.current ? 'opacity-70 cursor-not-allowed' : ''
              }`}
            >
              {isSubmittingRef.current ? (
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
              隐藏解释
            </>
          ) : (
            <>
              <svg className="w-4 h-4 mr-1" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
              </svg>
              查看解释
            </>
          )}
        </button>
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