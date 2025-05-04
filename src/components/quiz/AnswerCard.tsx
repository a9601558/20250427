import React from 'react';
import { AnsweredQuestion } from '../../hooks/useQuizReducer';

interface AnswerCardProps {
  totalQuestions: number;
  answeredQuestions: AnsweredQuestion[];
  currentIndex: number;
  onJump: (index: number) => void;
}

const AnswerCard: React.FC<AnswerCardProps> = ({ 
  totalQuestions, 
  answeredQuestions, 
  currentIndex, 
  onJump 
}) => {
  return (
    <div className="bg-white shadow-md rounded-lg p-4 mb-6">
      <h3 className="text-md font-medium mb-3">Answer Card</h3>
      <div className="flex flex-wrap gap-2">
        {Array.from({ length: totalQuestions }).map((_, index) => {
          const isAnswered = answeredQuestions.some(q => q.questionIndex === index);
          const isCorrect = answeredQuestions.some(q => q.questionIndex === index && q.isCorrect);
          const isCurrent = currentIndex === index;
          
          let bgColor = 'bg-gray-100'; // Default for unanswered
          if (isCurrent) bgColor = 'bg-blue-500 text-white'; // Current question
          else if (isCorrect) bgColor = 'bg-green-100'; // Answered correctly
          else if (isAnswered) bgColor = 'bg-red-100'; // Answered incorrectly
          
          return (
            <button
              key={index}
              onClick={() => onJump(index)}
              className={`w-8 h-8 ${bgColor} rounded-md flex items-center justify-center text-sm font-medium hover:opacity-80 transition-all`}
            >
              {index + 1}
            </button>
          );
        })}
      </div>
    </div>
  );
};

export default AnswerCard; 