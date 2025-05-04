import React from 'react';
import { AnsweredQuestion } from '../../hooks/useQuizReducer';
import { Question } from '../../types';
import { formatTime } from '../../utils/formatters';

interface QuizCompletionSummaryProps {
  questionSet: {
    title: string;
    id: string;
    isPaid: boolean;
  };
  correctAnswers: number;
  totalQuestions: number;
  answeredQuestions: AnsweredQuestion[];
  questions: Question[];
  timeSpent: number;
  onRestart: () => void;
  onNavigateHome: () => void;
  hasAccess?: boolean; // Optional prop to show if user has purchased access
}

const QuizCompletionSummary: React.FC<QuizCompletionSummaryProps> = ({
  questionSet,
  correctAnswers,
  totalQuestions,
  answeredQuestions,
  questions,
  timeSpent,
  onRestart,
  onNavigateHome,
  hasAccess
}) => {
  // Calculate stats
  const accuracy = Math.round((correctAnswers / totalQuestions) * 100);
  
  // Get access status text with more granularity
  const getAccessStatusText = () => {
    if (!questionSet) return '';
    
    if (!questionSet.isPaid) {
      return 'Free Question Set';
    }
    
    if (hasAccess) {
      return 'Paid Question Set (Purchased)';
    }
    
    return 'Paid Question Set';
  };
  
  return (
    <div className="bg-white rounded-xl shadow-md p-6 max-w-3xl mx-auto">
      <div className="text-center mb-6">
        <div className="inline-block p-4 rounded-full bg-green-100 text-green-600 mb-4">
          <svg 
            className="w-10 h-10" 
            fill="none" 
            stroke="currentColor" 
            viewBox="0 0 24 24" 
            xmlns="http://www.w3.org/2000/svg"
            aria-hidden="true"
          >
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
          </svg>
        </div>
        <h2 className="text-2xl font-bold text-gray-800 mb-2">Quiz Completed!</h2>
        <p className="text-gray-600">{questionSet?.title || 'Unknown Question Set'}</p>
        
        {/* Access type */}
        <div className="mt-2 text-sm text-gray-500">
          {getAccessStatusText()}
        </div>
      </div>
      
      <div className="grid grid-cols-2 gap-4 mb-8">
        <div className="bg-blue-50 rounded-lg p-4 text-center">
          <div className="text-sm text-blue-600 mb-1">Accuracy</div>
          <div className="text-2xl font-bold text-blue-800">{accuracy}%</div>
          <div className="text-xs text-blue-600 mt-1">{correctAnswers}/{totalQuestions} questions</div>
        </div>
        
        <div className="bg-purple-50 rounded-lg p-4 text-center">
          <div className="text-sm text-purple-600 mb-1">Time Spent</div>
          <div className="text-2xl font-bold text-purple-800">{formatTime(timeSpent)}</div>
          <div className="text-xs text-purple-600 mt-1">Avg {formatTime(timeSpent/totalQuestions)}/question</div>
        </div>
      </div>
      
      <div className="space-y-3 mb-8">
        {answeredQuestions.map((answer) => {
          if (!answer.questionIndex || answer.questionIndex < 0 || answer.questionIndex >= questions.length) return null;
          const question = questions[answer.questionIndex];
          if (!question) return null;
          
          // Create a unique, stable key for each answer
          const key = `question-${answer.questionIndex}`;
          
          // Get question text, truncate if needed
          const questionText = question.question;
          const displayText = questionText && questionText.length > 50 
            ? `${questionText.substring(0, 50)}...` 
            : (questionText || 'Unknown question');
          
          return (
            <div 
              key={key} 
              className={`p-3 rounded-lg border ${answer.isCorrect ? 'border-green-200 bg-green-50' : 'border-red-200 bg-red-50'}`}
              aria-label={`Question ${answer.questionIndex + 1}: ${questionText}. ${answer.isCorrect ? 'Correct' : 'Incorrect'}`}
            >
              <div className="flex justify-between items-start">
                <div className="flex items-center">
                  <div className={`w-6 h-6 rounded-full flex items-center justify-center text-sm font-medium mr-2 ${answer.isCorrect ? 'bg-green-200 text-green-800' : 'bg-red-200 text-red-800'}`}>
                    {(answer.questionIndex ?? 0) + 1}
                  </div>
                  <div className="text-sm font-medium" title={questionText || 'Unknown question'}>
                    {displayText}
                  </div>
                </div>
                <div className={`text-xs px-2 py-0.5 rounded-full ${answer.isCorrect ? 'bg-green-200 text-green-800' : 'bg-red-200 text-red-800'}`}>
                  {answer.isCorrect ? 'Correct' : 'Incorrect'}
                </div>
              </div>
            </div>
          );
        })}
      </div>
      
      <div className="flex space-x-3 justify-center">
        <button 
          onClick={onRestart} 
          className="px-5 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition flex items-center"
          aria-label="Restart quiz"
        >
          <svg 
            className="w-5 h-5 mr-1" 
            fill="none" 
            stroke="currentColor" 
            viewBox="0 0 24 24" 
            xmlns="http://www.w3.org/2000/svg"
            aria-hidden="true"
          >
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
          </svg>
          Restart
        </button>
        <button 
          onClick={onNavigateHome} 
          className="px-5 py-2 bg-gray-200 text-gray-800 rounded-lg hover:bg-gray-300 transition flex items-center"
          aria-label="Return to home page"
        >
          <svg 
            className="w-5 h-5 mr-1" 
            fill="none" 
            stroke="currentColor" 
            viewBox="0 0 24 24" 
            xmlns="http://www.w3.org/2000/svg"
            aria-hidden="true"
          >
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 19l-7-7m0 0l7-7m-7 7h18" />
          </svg>
          Return to Home
        </button>
      </div>
    </div>
  );
};

export default QuizCompletionSummary; 