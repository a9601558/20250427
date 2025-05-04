import { useState, useEffect, useCallback, useRef } from 'react';
import { useParams, useNavigate, useLocation } from 'react-router-dom';
import { useUser } from '../contexts/UserContext';
import PaymentModal from './PaymentModal';
import { useSocket } from '../contexts/SocketContext';
import RedeemCodeForm from './RedeemCodeForm';
import QuestionCard from './QuestionCard';
import { toast } from 'react-toastify';

// Import custom hooks
import { useQuizReducer } from '../hooks/useQuizReducer';
import { useQuizAccess } from '../hooks/useQuizAccess';
import { useQuizProgress } from '../hooks/useQuizProgress';
import { useQuizTimer } from '../hooks/useQuizTimer';
import { useQuestionSetData } from '../hooks/useQuestionSetData';

// Import UI components
import QuizHeader from './quiz/QuizHeader';
import QuizCompletionSummary from './quiz/QuizCompletionSummary';
import PurchasePrompt from './quiz/PurchasePrompt';
import AnswerCard from './quiz/AnswerCard';

// Import constants
import { MESSAGES } from '../constants/quiz';

function QuizPage(): JSX.Element {
  const { questionSetId } = useParams<{ questionSetId: string }>();
  const navigate = useNavigate();
  const { user } = useUser();
  const { socket } = useSocket();
  
  // State for modals
  const [showPaymentModal, setShowPaymentModal] = useState(false);
  const [showRedeemCodeModal, setShowRedeemCodeModal] = useState(false);
  
  // Use custom hooks
  const { quizState, dispatch } = useQuizReducer();
  const { 
    questionSet, 
    questions, 
    originalQuestions, 
    loading, 
    error, 
    shuffleQuestions, 
    restoreOriginalOrder, 
    isRandomMode 
  } = useQuestionSetData(questionSetId);
  
  const {
    hasAccess,
    isLoading: accessLoading,
    trialEnded,
    hasRedeemed,
    isPaid,
    trialQuestions,
    updateAnsweredCount,
    checkAccess
  } = useQuizAccess(questionSetId, questionSet);
  
  const {
    saveProgressToLocalStorage,
    syncProgressToServer,
    resetProgress,
    loadBestProgressSource,
    isSyncing
  } = useQuizProgress({ 
    questionSetId, 
    userId: user?.id 
  });
  
  const {
    isTimerActive,
    elapsedTime,
    startTimer,
    stopTimer,
    resetTimer,
    formatTime
  } = useQuizTimer();
  
  // Destructure quiz state for convenience
  const {
    currentQuestionIndex,
    selectedOptions,
    answeredQuestions,
    correctAnswers,
    quizComplete,
    showExplanation
  } = quizState;
  
  // Update answeredCount in useQuizAccess whenever it changes
  useEffect(() => {
    updateAnsweredCount(answeredQuestions.length);
  }, [answeredQuestions.length, updateAnsweredCount]);
  
  // Initialize quiz when questions are loaded
  useEffect(() => {
    if (questions.length > 0 && !loading) {
      // Initialize timer
      dispatch({ type: 'INITIALIZE_QUIZ', startTime: Date.now() });
      startTimer();
      
      // Load saved progress
      const loadSavedProgress = async () => {
        const progress = await loadBestProgressSource();
        
        if (progress && progress.answeredQuestions.length > 0) {
          // Load answered questions
          dispatch({ 
            type: 'LOAD_ANSWERED_QUESTIONS', 
            answeredQuestions: progress.answeredQuestions 
          });
          
          // Set current question index
          const allAnswered = progress.answeredQuestions.length >= questions.length;
          
          if (allAnswered) {
            dispatch({ type: 'JUMP_TO_QUESTION', index: 0 });
          } else if (progress.lastQuestionIndex !== undefined &&
                    progress.lastQuestionIndex >= 0 &&
                    progress.lastQuestionIndex < questions.length) {
            dispatch({ type: 'JUMP_TO_QUESTION', index: progress.lastQuestionIndex });
          }
        }
      };
      
      loadSavedProgress();
    }
  }, [questions, loading, loadBestProgressSource]);
  
  // Check access when questionSet changes
  useEffect(() => {
      if (questionSet) {
          checkAccess();
        }
  }, [questionSet, checkAccess]);
  
  // Handle option selection
  const handleOptionSelect = useCallback((optionId: string) => {
    // If trial ended and no access, don't allow answering
    if (trialEnded && !hasAccess && !hasRedeemed) {
      return;
    }
    
    const currentQuestion = questions[currentQuestionIndex];
    const isMultiChoice = currentQuestion.questionType === 'multiple';
    
    dispatch({ 
      type: 'SELECT_OPTION', 
      optionId, 
      isMultiChoice 
    });
  }, [currentQuestionIndex, dispatch, hasAccess, hasRedeemed, questions, trialEnded]);
  
  // Handle answer submission
  const handleAnswerSubmit = useCallback((isCorrect: boolean, selectedOption: string | string[]) => {
    dispatch({
      type: 'SUBMIT_ANSWER',
        isCorrect,
      selectedOption,
      questionIndex: currentQuestionIndex
    });
    
    // Save progress locally
    saveProgressToLocalStorage(
    currentQuestionIndex, 
      [...answeredQuestions, {
        index: answeredQuestions.length,
        questionIndex: currentQuestionIndex,
        isCorrect,
        selectedOption
      }],
      elapsedTime
    );
  }, [currentQuestionIndex, answeredQuestions, dispatch, saveProgressToLocalStorage, elapsedTime]);
  
  // Handle next question
  const handleNextQuestion = useCallback(() => {
    const isLastQuestion = currentQuestionIndex === questions.length - 1;
    
    // If answering every 5 questions, sync progress
    if (answeredQuestions.length > 0 && answeredQuestions.length % 5 === 0) {
      syncProgressToServer(currentQuestionIndex, answeredQuestions, elapsedTime);
    }
    
    dispatch({ 
      type: 'NEXT_QUESTION', 
      isLastQuestion 
    });
    
    // If it's the last question, complete the quiz
    if (isLastQuestion) {
      // Sync progress with server
      syncProgressToServer(currentQuestionIndex, answeredQuestions, elapsedTime, true);
      
      // Stop timer
      stopTimer();
      
      // Update quiz state to complete
      dispatch({
        type: 'COMPLETE_QUIZ',
        timeSpent: elapsedTime
      });
    }
  }, [currentQuestionIndex, questions.length, answeredQuestions, dispatch, syncProgressToServer, elapsedTime, stopTimer]);
  
  // Handle jump to question
  const handleJumpToQuestion = useCallback((index: number) => {
    // If trial ended and no access, don't allow jumping
    if (trialEnded && !hasAccess && !hasRedeemed) {
        return;
      }
      
    // Check if current question is answered before jumping
    const isCurrentQuestionAnswered = answeredQuestions.some(q => q.questionIndex === currentQuestionIndex);
    
    if (!isCurrentQuestionAnswered && currentQuestionIndex !== index) {
      if (confirm("Current question has not been answered. Are you sure you want to leave?")) {
        dispatch({ type: 'JUMP_TO_QUESTION', index });
      }
            } else {
      dispatch({ type: 'JUMP_TO_QUESTION', index });
    }
    
    // Save progress to localStorage
    saveProgressToLocalStorage(index, answeredQuestions, elapsedTime);
  }, [currentQuestionIndex, answeredQuestions, dispatch, hasAccess, hasRedeemed, trialEnded, saveProgressToLocalStorage, elapsedTime]);
  
  // Handle quiz reset
  const handleResetQuiz = useCallback(async () => {
    if (!confirm(MESSAGES.RESET_CONFIRMATION)) {
            return;
    }
    
    try {
      // Reset progress on server
      await resetProgress();
      
      // Reset local state
      dispatch({ type: 'RESET_QUIZ', questions });
      resetTimer();
      
      toast.success('Progress has been reset');
    } catch (error) {
      console.error('Failed to reset quiz:', error);
      toast.error('Failed to reset quiz. Please try again.');
    }
  }, [dispatch, questions, resetProgress, resetTimer]);
  
  // Navigate to home
  const handleNavigateHome = useCallback(() => {
    // Sync progress before navigating
    if (answeredQuestions.length > 0) {
      syncProgressToServer(currentQuestionIndex, answeredQuestions, elapsedTime, true);
    }
    
    navigate('/');
  }, [answeredQuestions, currentQuestionIndex, elapsedTime, navigate, syncProgressToServer]);
  
  // Navigate to profile
  const handleNavigateProfile = useCallback(() => {
    navigate(user ? '/profile' : '/login');
  }, [navigate, user]);
  
  // Check if we should show purchase prompt
  const shouldShowPurchasePrompt = useCallback(() => {
    if (!questionSet || error || loading) return false;
    
    return (
      isPaid && 
      !hasAccess && 
      trialQuestions !== null && 
      answeredQuestions.length >= (trialQuestions || 0)
    );
  }, [questionSet, error, loading, isPaid, hasAccess, trialQuestions, answeredQuestions.length]);
  
  // Render loading state
  if (loading || accessLoading) {
    return (
      <div className="flex justify-center items-center h-96">
        <div className="animate-spin rounded-full h-12 w-12 border-t-2 border-b-2 border-blue-500"></div>
      </div>
    );
  }
   
  // Render error state
  if (error || !questionSet || questions.length === 0) {
    return (
      <div className="container mx-auto px-4 py-8">
        <div className="bg-red-100 border border-red-400 text-red-700 px-4 py-3 rounded relative">
          <span className="block sm:inline">{error || 'Unable to load question set data'}</span>
        </div>
        <button
          onClick={handleNavigateHome}
          className="mt-4 bg-blue-600 text-white px-4 py-2 rounded hover:bg-blue-700"
        >
          Return to Home
        </button>
      </div>
    );
  }
  
  // Render purchase prompt
  if (shouldShowPurchasePrompt()) {
    return (
      <>
        <PurchasePrompt
          questionSet={questionSet}
          totalQuestions={questions.length}
          answeredCount={answeredQuestions.length}
          correctCount={correctAnswers}
          onShowPaymentModal={() => setShowPaymentModal(true)}
          onShowRedeemCodeModal={() => setShowRedeemCodeModal(true)}
          onNavigateHome={handleNavigateHome}
          onNavigateProfile={handleNavigateProfile}
          isLoggedIn={!!user}
          validityPeriod="6 months"
          currencyCode="CNY"
        />
        
        {/* Payment Modal */}
        {showPaymentModal && (
          <PaymentModal
            isOpen={showPaymentModal}
            questionSet={questionSet}
            onClose={() => setShowPaymentModal(false)}
            onSuccess={() => {
              setShowPaymentModal(false);
              checkAccess();
            }}
          />
        )}
        
        {/* Redeem Code Modal */}
        {showRedeemCodeModal && (
          <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
            <div className="bg-white rounded-lg p-6 max-w-md w-full mx-4">
              <div className="flex justify-between items-center mb-4">
                <h2 className="text-xl font-semibold">Redemption Code</h2>
                <button
                  onClick={() => setShowRedeemCodeModal(false)}
                  className="text-gray-500 hover:text-gray-700"
                >
                  <svg className="h-6 w-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M6 18L18 6M6 6l12 12" />
                  </svg>
                </button>
              </div>
              <RedeemCodeForm onRedeemSuccess={(redeemedSetId) => {
                setShowRedeemCodeModal(false);
                  checkAccess();
              }} />
            </div>
          </div>
        )}
      </>
    );
  }
  
  // Render completion summary
  if (quizComplete) {
    return (
      <div className="min-h-screen bg-gray-50 py-8">
        <div className="container mx-auto px-4">
          <QuizCompletionSummary
            questionSet={{
              title: questionSet.title,
              id: questionSet.id,
              isPaid: questionSet.isPaid || false
            }}
            correctAnswers={correctAnswers}
            totalQuestions={questions.length}
            answeredQuestions={answeredQuestions}
            questions={questions}
            timeSpent={elapsedTime}
            onRestart={handleResetQuiz}
            onNavigateHome={handleNavigateHome}
            hasAccess={hasAccess}
          />
        </div>
      </div>
    );
  }
  
  // Render quiz
  return (
    <div className="min-h-screen bg-gray-50 py-8">
      <div className="container mx-auto px-4">
        {/* Header with navigation, timer, etc. */}
        <QuizHeader
          title={questionSet.title}
          onClearProgress={handleResetQuiz}
          formattedTime={formatTime(elapsedTime)}
          isTimerActive={isTimerActive}
        />
        
        {/* Only show random mode switch for users with access */}
        {(!isPaid || hasAccess || hasRedeemed) && (
          <div className="flex items-center justify-between mb-4">
                    <div className="flex items-center">
              <span className="mr-2 text-sm font-medium text-gray-700">Random Mode:</span>
                      <button
                        onClick={isRandomMode ? restoreOriginalOrder : shuffleQuestions}
                        className={`px-3 py-1 text-sm rounded-md ${
                          isRandomMode 
                            ? 'bg-red-100 text-red-700 hover:bg-red-200' 
                            : 'bg-blue-100 text-blue-700 hover:bg-blue-200'
                        } transition-colors`}
                      >
                {isRandomMode ? 'Restore Order' : 'Shuffle Questions'}
                      </button>
                    </div>
                    {isRandomMode && (
              <span className="text-xs text-orange-600">Random mode active: questions have been shuffled</span>
                    )}
                  </div>
        )}
                  
        {/* Answer Card */}
        {(!isPaid || hasAccess || hasRedeemed) && (
                  <AnswerCard
                    totalQuestions={questions.length}
                    answeredQuestions={answeredQuestions}
                    currentIndex={currentQuestionIndex}
            onJump={handleJumpToQuestion}
          />
        )}
        
        {/* Progress Bar */}
              <div className="w-full bg-gray-200 rounded-full h-2.5 mb-4">
                <div 
                  className="bg-blue-600 h-2.5 rounded-full" 
            style={{ width: `${(answeredQuestions.length / questions.length) * 100}%` }}
                />
              </div>
              
        <div className="flex justify-between text-sm text-gray-500 mb-4">
          <span>Question {currentQuestionIndex + 1} / {questions.length}</span>
          <span>Answered {answeredQuestions.length} questions</span>
            </div>
            
        {/* Current Question */}
            {questions.length > 0 && currentQuestionIndex < questions.length && (
              <QuestionCard
                key={`question-${currentQuestionIndex}`}
                question={questions[currentQuestionIndex]}
                questionNumber={currentQuestionIndex + 1}
                totalQuestions={questions.length}
                onAnswerSubmitted={handleAnswerSubmit}
                onNext={handleNextQuestion}
                onJumpToQuestion={handleJumpToQuestion}
            isPaid={isPaid}
            hasFullAccess={hasAccess}
                questionSetId={questionSet?.id || ''}
                isLast={currentQuestionIndex === questions.length - 1}
              />
        )}
        
        {/* Syncing indicator */}
        {isSyncing && (
          <div className="fixed bottom-4 right-4 bg-blue-100 text-blue-800 px-3 py-1 rounded-md text-sm flex items-center">
            <svg className="animate-spin -ml-1 mr-2 h-4 w-4 text-blue-600" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
              <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
              <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                  </svg>
            Syncing progress...
          </div>
        )}
      </div>
    </div>
  );
}

export default QuizPage; 