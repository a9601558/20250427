import { useState, useEffect } from 'react';
import { Question } from '../types';
import { useUser } from '../contexts/UserContext';

interface QuestionCardProps {
  question: Question;
  onAnswerSubmitted?: (isCorrect: boolean, selectedOption: string | string[]) => void;
  onNext?: () => void;
  questionNumber?: number;
  totalQuestions?: number;
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
  autoAdvanceOnCorrect?: boolean; // 正解時に自動的に次へ進むかどうか
}

// 提示语常量
const MESSAGES = {
  SUBMIT_ANSWER: '回答を送信',
  NEXT_QUESTION: '次の問題',
  COMPLETE_EXERCISE: '練習を完了'
};

const QuestionCard = ({ 
  question, 
  onNext = () => {}, 
  onAnswerSubmitted, 
  questionNumber = 1, 
  totalQuestions = 1, 
  userAnsweredQuestion,
  onJumpToQuestion,
  isPaid = false,
  hasFullAccess = false,
  trialQuestions = 0,
  questionSetId,
  trialLimitReached = false,
  autoAdvanceOnCorrect = false // 默认关闭自动进入下一题
}: QuestionCardProps) => {
  // 状态管理
  const [selectedOptions, setSelectedOptions] = useState<string[]>([]);
  const [isSubmitted, setIsSubmitted] = useState(false);
  const [showExplanation, setShowExplanation] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  
  // 提交结果动画状态
  const [submissionResult, setSubmissionResult] = useState<{
    isCorrect: boolean;
    isShowing: boolean;
    timestamp: number;
  }>({
    isCorrect: false,
    isShowing: false,
    timestamp: 0
  });
  
  const { user } = useUser();
  
  // 当题目改变时，重置所有状态（关键：防止状态污染）
  useEffect(() => {
    // 重置所有状态
    setSelectedOptions([]);
    setIsSubmitted(false);
    setShowExplanation(false);
    setIsSubmitting(false);
    setSubmissionResult({
      isCorrect: false,
      isShowing: false,
      timestamp: 0
    });
    
    // 如果用户已回答过该题目，加载已选答案
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
  }, [question.id, userAnsweredQuestion]);

  // 判断答案是否正确
  const checkIsCorrect = (): boolean => {
    if (question.questionType === 'single') {
      const correctOption = question.options.find(opt => opt.isCorrect);
      return selectedOptions[0] === correctOption?.id;
    } else {
      // 多选题：检查所有正确答案都选中且没有选错
      const correctOptionIds = question.options
        .filter(opt => opt.isCorrect)
        .map(opt => opt.id);
      
      const allCorrectSelected = correctOptionIds.every(id => 
        selectedOptions.includes(id)
      );
      const noIncorrectSelected = selectedOptions.every(id => 
        correctOptionIds.includes(id)
      );
      const countMatch = correctOptionIds.length === selectedOptions.length;
      
      return allCorrectSelected && noIncorrectSelected && countMatch;
    }
  };

  // 处理选项点击
  const handleOptionClick = (optionId: string) => {
    if (isSubmitted || isSubmitting) {
      return;
    }
    
    if (question.questionType === 'single') {
      setSelectedOptions([optionId]);
      // 单选题立即提交
      setTimeout(() => {
        submitAnswerImmediately([optionId]);
      }, 100);
    } else {
      // 多选题切换选中状态
      if (selectedOptions.includes(optionId)) {
        setSelectedOptions(selectedOptions.filter(id => id !== optionId));
      } else {
        setSelectedOptions([...selectedOptions, optionId]);
      }
    }
  };
  
  // 立即提交答案
  const submitAnswerImmediately = (optionsToSubmit: string[]) => {
    if (isSubmitting || isSubmitted) return;
    
    setIsSubmitting(true);
    
    try {
      const isCorrect = question.questionType === 'single' 
        ? optionsToSubmit[0] === question.options.find(opt => opt.isCorrect)?.id
        : checkIsCorrect();
      
      setIsSubmitted(true);
      setShowExplanation(true);
      
      // 显示动画反馈
      setSubmissionResult({
        isCorrect,
        isShowing: true,
        timestamp: Date.now()
      });
      
      // 本地存储答题记录
      const storageKey = `quiz_answer_${questionSetId}_${question.id}`;
      localStorage.setItem(storageKey, JSON.stringify({
        selectedOptions: optionsToSubmit,
        isCorrect,
        timestamp: new Date().toISOString()
      }));
      
      // 调用父组件回调，传递结果
      if (onAnswerSubmitted) {
        if (question.questionType === 'single') {
          onAnswerSubmitted(isCorrect, optionsToSubmit[0]);
        } else {
          onAnswerSubmitted(isCorrect, optionsToSubmit);
        }
      }
      
      // 如果答错，记录错题
      if (!isCorrect) {
        saveWrongAnswer(optionsToSubmit);
      }
      
      // 单选题答对且开启自动进入：1秒后自动跳转
      if (question.questionType === 'single' && isCorrect && autoAdvanceOnCorrect) {
        setTimeout(() => {
          setSubmissionResult(prev => ({ ...prev, isShowing: false }));
          handleNext();
        }, 1000);
      } else {
        // 其他情况：显示结果动画
        setTimeout(() => {
          setSubmissionResult(prev => ({ ...prev, isShowing: false }));
        }, 2500);
      }
    } catch (error) {
      console.error('[QuestionCard] 提交答案出错:', error);
    } finally {
      setTimeout(() => setIsSubmitting(false), 500);
    }
  };
  
  // 保存错题
  const saveWrongAnswer = (customSelectedOptions?: string[]) => {
    const optionsToSave = customSelectedOptions || selectedOptions;
    
    const wrongAnswerEvent = new CustomEvent('wrongAnswer:save', {
      detail: {
        questionId: question.id,
        questionSetId: questionSetId,
        question: question.question || question.text,
        questionType: question.questionType,
        options: question.options,
        selectedOption: question.questionType === 'single' ? optionsToSave[0] : undefined,
        selectedOptions: question.questionType === 'multiple' ? optionsToSave : undefined,
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

  // 处理下一题
  const handleNext = () => {
    // 重置状态
    setSelectedOptions([]);
    setIsSubmitted(false);
    setShowExplanation(false);
    setSubmissionResult({
      isCorrect: false,
      isShowing: false,
      timestamp: 0
    });
    
    // 直接调用父组件传入的onNext函数
    if (typeof onNext === 'function') {
      onNext();
    }
  };

  // 提交答案（多选题使用）
  const handleSubmit = (e?: React.MouseEvent<HTMLButtonElement>) => {
    if (e) {
      e.preventDefault();
      e.stopPropagation();
    }
    
    if (isSubmitted && showExplanation) {
      handleNext();
      return;
    }
    
    if (isSubmitting || selectedOptions.length === 0) return;
    
    setIsSubmitting(true);
    
    try {
      const isCorrect = checkIsCorrect();
      
      setIsSubmitted(true);
      setShowExplanation(true);
      
      // 显示动画反馈
      setSubmissionResult({
        isCorrect,
        isShowing: true,
        timestamp: Date.now()
      });
      
      // 本地存储答题记录
      const storageKey = `quiz_answer_${questionSetId}_${question.id}`;
      localStorage.setItem(storageKey, JSON.stringify({
        selectedOptions,
        isCorrect,
        timestamp: new Date().toISOString()
      }));
      
      // 调用父组件回调，传递结果
      if (onAnswerSubmitted) {
        if (question.questionType === 'single') {
          onAnswerSubmitted(isCorrect, selectedOptions[0]);
        } else {
          onAnswerSubmitted(isCorrect, selectedOptions);
        }
      }
      
      // 如果答错，记录错题
      if (!isCorrect) {
        saveWrongAnswer();
      }
      
      // 延迟隐藏提交结果
      setTimeout(() => {
        setSubmissionResult(prev => ({
          ...prev,
          isShowing: false
        }));
      }, 2500);
    } catch (error) {
      console.error('[QuestionCard] 提交答案出错:', error);
    } finally {
      setTimeout(() => setIsSubmitting(false), 500);
    }
  };

  // 获取选项样式
  const getOptionClass = (option: any) => {
    if (isPaid && !hasFullAccess && trialLimitReached) {
      return 'border-gray-300 bg-gray-50 opacity-60 pointer-events-none';
    }
    
    if (!showExplanation) {
      return selectedOptions.includes(option.id)
        ? 'border-blue-300 bg-blue-50'
        : 'border-gray-300 bg-white hover:bg-gray-50';
    }
    
    if (option.isCorrect) {
      return 'border-green-500 bg-green-50 text-green-700';
    } else if (selectedOptions.includes(option.id)) {
      return 'border-red-500 bg-red-50 text-red-700';
    } else {
      return 'border-gray-300 bg-gray-50 opacity-60';
    }
  };

  // 跨设备访问权限同步
  useEffect(() => {
    if (!user?.id || !questionSetId) return;
    
    const handleAccessRightsUpdate = (event: Event) => {
      const customEvent = event as CustomEvent;
      if (customEvent.detail?.userId === user.id) {
        const hasLocalAccess = checkLocalRedeemedStatus(questionSetId) || 
                              checkLocalAccessRights(questionSetId);
        console.log(`[QuestionCard] Access rights updated for ${questionSetId}, local access: ${hasLocalAccess}`);
      }
    };
    
    window.addEventListener('accessRights:updated', handleAccessRightsUpdate);
    return () => window.removeEventListener('accessRights:updated', handleAccessRightsUpdate);
  }, [user?.id, questionSetId]);

  // 试用结束事件监听
  useEffect(() => {
    const handleTrialEnded = () => {
      console.log('[QuestionCard] Detected trial ended event');
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

  // 检查兑换状态
  const checkLocalRedeemedStatus = (questionSetId: string): boolean => {
    try {
      const redeemedStr = localStorage.getItem('redeemedQuestionSetIds');
      if (!redeemedStr) return false;
      
      const redeemedIds = JSON.parse(redeemedStr);
      if (!Array.isArray(redeemedIds)) return false;
      
      const targetId = String(questionSetId).trim();
      
      return redeemedIds.some(id => {
        const redeemedId = String(id || '').trim();
        const exactMatch = redeemedId === targetId;
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
  
  // 检查访问权限
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

  return (
    <div className="bg-white rounded-xl shadow-md p-4 sm:p-6 mb-6">
      {/* 题目头部 - モバイル最適化 */}
      <div className="flex flex-col sm:flex-row sm:justify-between sm:items-start gap-3 mb-6">
        <div className="flex items-center flex-wrap gap-2">
          <div className="bg-blue-100 text-blue-800 font-medium px-3 py-1.5 rounded-full text-sm sm:text-base">
            {questionNumber} / {totalQuestions}
          </div>
          <div className={`px-2.5 py-1 rounded-full text-xs sm:text-sm ${
            question.questionType === 'single' 
              ? 'bg-green-100 text-green-800'
              : 'bg-purple-100 text-purple-800'
          }`}>
            {question.questionType === 'single' ? '単一選択' : '複数選択'}
          </div>
        </div>
        
        {/* 试用状态标签 */}
        {isPaid && (
          <div className={`px-2.5 py-1 rounded-full text-xs sm:text-sm ${
            hasFullAccess 
              ? 'bg-green-100 text-green-800' 
              : trialLimitReached 
                ? 'bg-red-100 text-red-800 animate-pulse' 
                : 'bg-yellow-100 text-yellow-800'
          }`}>
            {hasFullAccess 
              ? 'フルバージョン' 
              : trialLimitReached 
                ? 'トライアル終了' 
                : `トライアルモード (${questionNumber}/${trialQuestions}問)`
            }
          </div>
        )}
      </div>

      {/* 题目内容 - モバイル向けフォントサイズと行間を改善 */}
      <div className="mb-6">
        <h3 className="text-base sm:text-lg font-medium text-gray-800 mb-3 leading-relaxed sm:leading-normal">{question.question || question.text}</h3>
      </div>

      {/* 选项列表 - モバイル最適化: タッチターゲット拡大、読みやすさ改善 */}
      <div className="space-y-3 mb-6">
        {question.options.map((option, index) => (
          <div
            key={option.id}
            className={`min-h-[44px] p-4 border rounded-lg transition-colors ${
              isSubmitted || isSubmitting ? 'cursor-default' : 'cursor-pointer'
            } ${getOptionClass(option)}`}
            onClick={() => handleOptionClick(option.id)}
            role="button"
            tabIndex={0}
          >
            <div className="flex items-start">
              <div className={`w-7 h-7 sm:w-6 sm:h-6 rounded-full flex items-center justify-center border mr-3 flex-shrink-0 ${
                selectedOptions.includes(option.id) 
                  ? 'bg-blue-500 border-blue-500 text-white' 
                  : 'border-gray-300'
              }`}>
                <span className="text-sm font-medium">
                  {String.fromCharCode(65 + index)}
                </span>
              </div>
              <div className="text-gray-700 text-base leading-relaxed">
                {option.text}
              </div>
            </div>
          </div>
        ))}
      </div>
          
      {/* 添加提交结果动画效果 */}
      {submissionResult.isShowing && (
        <div className={`fixed top-1/2 left-1/2 transform -translate-x-1/2 -translate-y-1/2 z-50 animate-scaleIn ${
          submissionResult.isCorrect ? 'text-green-500' : 'text-red-500'
        }`}>
          {submissionResult.isCorrect ? (
            <svg className="w-20 h-20" fill="currentColor" viewBox="0 0 20 20">
              <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z" clipRule="evenodd" />
            </svg>
          ) : (
            <svg className="w-20 h-20" fill="currentColor" viewBox="0 0 20 20">
              <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zM8.707 7.293a1 1 0 00-1.414 1.414L8.586 10l-1.293 1.293a1 1 0 101.414 1.414L10 11.414l1.293 1.293a1 1 0 001.414-1.414L11.414 10l1.293-1.293a1 1 0 00-1.414-1.414L10 8.586 8.707 7.293z" clipRule="evenodd" />
            </svg>
          )}
        </div>
      )}
      
      {/* 解析显示 - モバイル最適化: フォントサイズと行間改善 */}
      {showExplanation && question.explanation && (
        <div className="mb-6 animate-fadeIn">
          <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-4">
            <h4 className="font-semibold text-yellow-800 mb-3 flex items-center text-base">
              <svg className="w-5 h-5 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
              </svg>
              解説
            </h4>
            <div className="text-yellow-700 text-sm sm:text-base leading-relaxed" dangerouslySetInnerHTML={{__html: question.explanation}} />
          </div>
        </div>
      )}
      
      {/* 答题/下一题按钮 - モバイル最適化 */}
      <div className="mt-6">
        {question.questionType === 'single' ? (
          /* 单选题：只在已提交后显示"下一题"按钮 */
          isSubmitted ? (
            <button
              type="button"
              onClick={handleNext}
              className="w-full min-h-[48px] px-5 py-3.5 rounded-lg text-white text-base font-medium flex items-center justify-center transition-all bg-green-600 hover:bg-green-700 active:bg-green-800"
            >
              <svg className="w-5 h-5 mr-1" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
              </svg>
              {questionNumber >= totalQuestions ? MESSAGES.COMPLETE_EXERCISE : MESSAGES.NEXT_QUESTION}
            </button>
          ) : null
        ) : (
          /* 多选题：保留"送信"按钮 */
          <button
            type="button"
            onClick={handleSubmit}
            disabled={(selectedOptions.length === 0 && !isSubmitted) || isSubmitting}
            className={`w-full min-h-[48px] px-5 py-3.5 rounded-lg text-white text-base font-medium flex items-center justify-center transition-all ${
              (selectedOptions.length === 0 && !isSubmitted) || isSubmitting
                ? 'bg-gray-400 cursor-not-allowed'
                : isSubmitted
                  ? 'bg-green-600 hover:bg-green-700 active:bg-green-800'
                  : 'bg-blue-600 hover:bg-blue-700 active:bg-blue-800'
            }`}
          >
            {isSubmitting && (
              <svg className="animate-spin -ml-1 mr-2 h-5 w-5 text-white" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
              </svg>
            )}
            {isSubmitted ? (
              <>
                <svg className="w-5 h-5 mr-1" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
                </svg>
                {questionNumber >= totalQuestions ? MESSAGES.COMPLETE_EXERCISE : MESSAGES.NEXT_QUESTION}
              </>
            ) : (
              <>
                <svg className="w-5 h-5 mr-1" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                </svg>
                {MESSAGES.SUBMIT_ANSWER}
              </>
            )}
          </button>
        )}
      </div>
      
      {/* 题目导航：上下题切换区域 */}
      <div className="mt-4 flex justify-between items-center">
        {/* 上一题按钮 */}
          <button 
          onClick={() => onJumpToQuestion && questionNumber > 1 ? onJumpToQuestion(questionNumber - 2) : null}
          className={`text-blue-600 hover:text-blue-800 text-sm flex items-center px-2 py-1 rounded-md hover:bg-blue-50 transition-colors ${
            questionNumber <= 1 ? 'opacity-50 cursor-not-allowed' : ''
          }`}
          disabled={questionNumber <= 1}
          >
            <svg className="w-4 h-4 mr-1" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
            </svg>
            前の問題
          </button>
        
        {/* 当前位置显示 - 添加数字导航 */}
        <div className="flex items-center space-x-1">
          {totalQuestions <= 10 ? (
            // 当题目数量小于等于10时，显示所有页码
            Array.from({ length: totalQuestions }, (_, i) => {
              // 检查是否超出试用限制
              const trialLimit = trialQuestions || 0;
              const isDisabled = isPaid && !hasFullAccess && i >= trialLimit;
              
              return (
                <button
                  key={i}
                  onClick={() => !isDisabled && onJumpToQuestion && onJumpToQuestion(i)}
                  className={`w-6 h-6 flex items-center justify-center rounded text-xs ${
                    questionNumber === i + 1
                      ? 'bg-blue-600 text-white'
                      : isDisabled
                        ? 'bg-gray-200 text-gray-400 cursor-not-allowed opacity-60'
                        : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
                  }`}
                  disabled={isDisabled}
                >
                  {i + 1}
                </button>
              );
            })
          ) : (
            // 当题目数量大于10时，使用省略显示
            <>
              {/* 前部分页码 */}
              {Array.from({ length: Math.min(3, totalQuestions) }, (_, i) => {
                // 检查是否超出试用限制
                const trialLimit = trialQuestions || 0;
                const isDisabled = isPaid && !hasFullAccess && i >= trialLimit;
                
                return (
                  <button
                    key={i}
                    onClick={() => !isDisabled && onJumpToQuestion && onJumpToQuestion(i)}
                    className={`w-6 h-6 flex items-center justify-center rounded text-xs ${
                      questionNumber === i + 1
                        ? 'bg-blue-600 text-white'
                        : isDisabled
                          ? 'bg-gray-200 text-gray-400 cursor-not-allowed opacity-60'
                          : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
                    }`}
                    disabled={isDisabled}
                  >
                    {i + 1}
                  </button>
                );
              })}
              
              {/* 省略号 */}
              {questionNumber > 4 && questionNumber < totalQuestions - 3 && (
                <span className="text-gray-500 text-xs px-1">...</span>
              )}
              
              {/* 当前页码及其附近 */}
              {questionNumber > 3 && questionNumber < totalQuestions - 2 && (
                <>
                  {questionNumber > 4 && (() => {
                    const targetIndex = questionNumber - 2;
                    const trialLimit = trialQuestions || 0;
                    const isDisabled = isPaid && !hasFullAccess && targetIndex >= trialLimit;
                    
                    return (
                      <button
                        onClick={() => !isDisabled && onJumpToQuestion && onJumpToQuestion(targetIndex)}
                        className={`w-6 h-6 flex items-center justify-center rounded text-xs ${
                          isDisabled
                            ? 'bg-gray-200 text-gray-400 cursor-not-allowed opacity-60'
                            : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
                        }`}
                        disabled={isDisabled}
                      >
                        {questionNumber - 1}
                      </button>
                    );
                  })()}
                  
                  {(() => {
                    const trialLimit = trialQuestions || 0;
                    const isDisabled = isPaid && !hasFullAccess && (questionNumber - 1) >= trialLimit;
                    
                    return (
                      <button
                        className={`w-6 h-6 flex items-center justify-center rounded text-xs ${
                          isDisabled
                            ? 'bg-gray-200 text-gray-400 cursor-not-allowed opacity-60'
                            : 'bg-blue-600 text-white'
                        }`}
                        disabled={isDisabled}
                      >
                        {questionNumber}
                      </button>
                    );
                  })()}
                  
                  {questionNumber < totalQuestions - 3 && (() => {
                    const targetIndex = questionNumber;
                    const trialLimit = trialQuestions || 0;
                    const isDisabled = isPaid && !hasFullAccess && targetIndex >= trialLimit;
                    
                    return (
                      <button
                        onClick={() => !isDisabled && onJumpToQuestion && onJumpToQuestion(targetIndex)}
                        className={`w-6 h-6 flex items-center justify-center rounded text-xs ${
                          isDisabled
                            ? 'bg-gray-200 text-gray-400 cursor-not-allowed opacity-60'
                            : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
                        }`}
                        disabled={isDisabled}
                      >
                        {questionNumber + 1}
                      </button>
                    );
                  })()}
                </>
              )}
              
              {/* 省略号 */}
              {questionNumber < totalQuestions - 3 && questionNumber > 3 && (
                <span className="text-gray-500 text-xs px-1">...</span>
              )}
              
              {/* 末尾页码 */}
              {Array.from({ length: Math.min(3, totalQuestions) }, (_, i) => {
                const pageIndex = totalQuestions - 3 + i;
                // 检查是否超出试用限制
                const trialLimit = trialQuestions || 0;
                const isDisabled = isPaid && !hasFullAccess && pageIndex >= trialLimit;
                
                return (
                  <button
                    key={pageIndex}
                    onClick={() => !isDisabled && onJumpToQuestion && onJumpToQuestion(pageIndex)}
                    className={`w-6 h-6 flex items-center justify-center rounded text-xs ${
                      questionNumber === totalQuestions - 2 + i
                        ? 'bg-blue-600 text-white'
                        : isDisabled
                          ? 'bg-gray-200 text-gray-400 cursor-not-allowed opacity-60'
                          : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
                    }`}
                    disabled={isDisabled}
                  >
                    {totalQuestions - 2 + i}
                  </button>
                );
              })}
            </>
          )}
        </div>
        
        {/* 下一题按钮 */}
        <button 
          onClick={() => onJumpToQuestion && questionNumber < totalQuestions ? onJumpToQuestion(questionNumber) : null}
          className={`text-blue-600 hover:text-blue-800 text-sm flex items-center px-2 py-1 rounded-md hover:bg-blue-50 transition-colors ${
            questionNumber >= totalQuestions || (isPaid && !hasFullAccess && questionNumber >= (trialQuestions || 0)) 
              ? 'opacity-50 cursor-not-allowed' 
              : ''
          }`}
          disabled={questionNumber >= totalQuestions || (isPaid && !hasFullAccess && questionNumber >= (trialQuestions || 0))}
        >
          次の問題
          <svg className="w-4 h-4 ml-1" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
          </svg>
        </button>
      </div>
    </div>
  );
};

// 为动画添加全局样式
const styleElement = document.createElement('style');
styleElement.textContent = `
  @keyframes fadeIn {
    0% { opacity: 0; }
    100% { opacity: 1; }
  }
  
  @keyframes scaleIn {
    0% { transform: translate(-50%, -50%) scale(0.95); opacity: 0; }
    100% { transform: translate(-50%, -50%) scale(1); opacity: 1; }
  }
  
  .animate-fadeIn {
    animation-name: fadeIn;
    animation-duration: 0.3s;
    animation-timing-function: ease-in-out;
  }
  
  .animate-scaleIn {
    animation-name: scaleIn;
    animation-duration: 0.3s;
    animation-timing-function: ease-out;
  }
`;
document.head.appendChild(styleElement);

export default QuestionCard; 