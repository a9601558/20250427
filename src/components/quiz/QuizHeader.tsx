import React from 'react';
import { useNavigate } from 'react-router-dom';

interface QuizHeaderProps {
  title: string;
  onClearProgress: () => void;
  formattedTime?: string;
  isTimerActive?: boolean;
}

const QuizHeader: React.FC<QuizHeaderProps> = ({ 
  title, 
  onClearProgress, 
  formattedTime, 
  isTimerActive 
}) => {
  const navigate = useNavigate();
  
  return (
    <div className="flex justify-between items-center mb-6">
      <button 
        onClick={() => navigate('/')} 
        className="text-blue-600 hover:text-blue-800 flex items-center text-sm"
      >
        <svg className="w-4 h-4 mr-1" fill="none" stroke="currentColor" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 19l-7-7m0 0l7-7m-7 7h18" />
        </svg>
        Back to Home
      </button>
      
      <div className="flex items-center">
        {/* Clear Progress Button */}
        <button
          onClick={onClearProgress}
          className="text-red-600 hover:text-red-800 flex items-center text-sm mr-4"
        >
          <svg className="w-4 h-4 mr-1" fill="none" stroke="currentColor" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
          </svg>
          Clear Progress
        </button>
        
        {/* Timer */}
        {isTimerActive && formattedTime && (
          <div className="bg-blue-50 text-blue-800 px-3 py-1 rounded-lg text-sm flex items-center mr-2">
            <svg className="w-4 h-4 mr-1 text-blue-600" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
            </svg>
            {formattedTime}
          </div>
        )}
        
        <div className="bg-indigo-100 text-indigo-800 px-3 py-1 rounded-lg text-sm">
          {title}
        </div>
      </div>
    </div>
  );
};

export default QuizHeader; 