import React, { useMemo } from 'react';

interface QuizCompletionSummaryProps {
  questionSet?: { title: string; isPaid: boolean };
  correctAnswers: number;
  totalQuestions: number;
  answeredQuestions: number;
  questions: { id: string; text: string; isCorrect: boolean }[];
  timeSpent: number;
  onRestart: () => void;
  onReturn: () => void;
}

const QuizCompletionSummary: React.FC<QuizCompletionSummaryProps> = ({
  questionSet,
  correctAnswers,
  totalQuestions,
  answeredQuestions,
  questions,
  timeSpent,
  onRestart,
  onReturn
}) => {
  // 计算每题平均用时
  const avgTimePerQuestion = useMemo(() => {
    if (!timeSpent || !answeredQuestions || answeredQuestions <= 0) return 0;
    return Math.round(timeSpent / answeredQuestions);
  }, [timeSpent, answeredQuestions]);

  // 确保没有NaN或Infinity的百分比 
  const getAccuracyPercentage = () => {
    if (!totalQuestions || totalQuestions <= 0 || !correctAnswers) return 0;
    return Math.round((correctAnswers / totalQuestions) * 100);
  };

  // 格式化时间显示
  const formatTime = (seconds: number): string => {
    if (isNaN(seconds) || seconds < 0) return '0s';
    
    const hours = Math.floor(seconds / 3600);
    const minutes = Math.floor((seconds % 3600) / 60);
    const remainingSeconds = seconds % 60;
    
    if (hours > 0) {
      return `${hours}h ${minutes}m ${remainingSeconds}s`;
    } else if (minutes > 0) {
      return `${minutes}m ${remainingSeconds}s`;
    } else {
      return `${remainingSeconds}s`;
    }
  };

  // 格式化平均用时
  const formatAvgTime = (seconds: number): string => {
    if (isNaN(seconds) || seconds < 0) return '0s';
    
    const minutes = Math.floor(seconds / 60);
    const remainingSeconds = seconds % 60;
    
    if (minutes > 0) {
      return `${minutes}m ${remainingSeconds}s`;
    } else {
      return `${remainingSeconds}s`;
    }
  };

  return (
    <div className="bg-white rounded-xl shadow-lg p-8 max-w-2xl mx-auto my-8">
      {/* 完成图标和标题 */}
      <div className="text-center mb-8">
        <div className="mx-auto w-16 h-16 bg-green-100 rounded-full flex items-center justify-center mb-4">
          <svg className="w-10 h-10 text-green-500" fill="none" stroke="currentColor" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M5 13l4 4L19 7"></path>
          </svg>
        </div>
        <h1 className="text-2xl font-bold text-gray-800">Quiz Completed!</h1>
        <p className="text-gray-600 mt-2">{questionSet?.title || 'Completed Quiz'}</p>
        <div className="mt-1 text-sm text-gray-500">
          {questionSet?.isPaid ? 'Paid Question Set (Purchased)' : 'Free Question Set'}
        </div>
      </div>

      {/* 统计信息 */}
      <div className="grid grid-cols-2 gap-4 mb-8">
        <div className="bg-blue-50 p-4 rounded-lg text-center">
          <h2 className="text-lg font-medium text-blue-800">Accuracy</h2>
          <div className="text-3xl font-bold text-blue-700">{getAccuracyPercentage()}%</div>
          <div className="text-sm text-blue-600 mt-1">
            {correctAnswers || 0}/{totalQuestions || 0} questions
          </div>
        </div>
        
        <div className="bg-purple-50 p-4 rounded-lg text-center">
          <h2 className="text-lg font-medium text-purple-800">Time Spent</h2>
          <div className="text-3xl font-bold text-purple-700">{formatTime(timeSpent || 0)}</div>
          <div className="text-sm text-purple-600 mt-1">
            Avg {formatAvgTime(avgTimePerQuestion)}/question
          </div>
        </div>
      </div>

      {/* 题目列表 */}
      <div className="mb-8">
        <h2 className="text-lg font-medium text-gray-800 mb-4">Question Summary</h2>
        <div className="space-y-3">
          {questions?.map((question, index) => (
            <div key={question.id} className="flex items-start p-3 border rounded-lg">
              <div className={`w-6 h-6 rounded-full flex-shrink-0 flex items-center justify-center mr-3 ${
                question.isCorrect ? 'bg-green-100 text-green-700' : 'bg-red-100 text-red-700'
              }`}>
                {index + 1}
              </div>
              <div className="flex-grow">
                <p className="text-sm text-gray-700 line-clamp-1">{question.text || 'Unknown question'}</p>
                {!question.isCorrect && (
                  <p className="text-xs text-red-600 mt-1">
                    <span className="font-medium">Incorrect</span>
                  </p>
                )}
              </div>
              <div className={`px-2 py-1 rounded text-xs font-medium ${
                question.isCorrect ? 'bg-green-100 text-green-700' : 'bg-red-100 text-red-700'
              }`}>
                {question.isCorrect ? 'Correct' : 'Incorrect'}
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* 操作按钮 */}
      <div className="flex justify-between space-x-4">
        <button
          onClick={onRestart}
          className="flex-1 bg-blue-600 hover:bg-blue-700 text-white py-3 px-4 rounded-md font-medium flex items-center justify-center transition-colors"
        >
          <svg className="w-5 h-5 mr-2" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
          </svg>
          Restart
        </button>
        
        <button
          onClick={onReturn}
          className="flex-1 bg-gray-100 hover:bg-gray-200 text-gray-800 py-3 px-4 rounded-md font-medium flex items-center justify-center transition-colors"
        >
          <svg className="w-5 h-5 mr-2" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 19l-7-7m0 0l7-7m-7 7h18" />
          </svg>
          Return to Home
        </button>
      </div>
    </div>
  );
};

export default QuizCompletionSummary; 