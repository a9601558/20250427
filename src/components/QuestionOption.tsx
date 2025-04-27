import React from 'react';
import { Option } from '../data/questions';

interface QuestionOptionProps {
  option: Option;
  isSelected: boolean;
  isCorrect: string | null;
  isSubmitted: boolean;
  isMultiple?: boolean;
  onClick: () => void;
}

const QuestionOption: React.FC<QuestionOptionProps> = ({
  option,
  isSelected,
  isCorrect,
  isSubmitted,
  isMultiple = false,
  onClick
}) => {
  // 根据当前状态确定背景颜色
  const getBgColor = () => {
    if (!isSubmitted) {
      return isSelected ? 'bg-blue-100 border-blue-500' : 'bg-white hover:bg-gray-50';
    }
    
    if (isSelected) {
      return isCorrect === option.id
        ? 'bg-green-100 border-green-500' 
        : 'bg-red-100 border-red-500';
    }
    
    if (option.id === isCorrect) {
      return 'bg-green-100 border-green-500';
    }
    
    return 'bg-white';
  };

  // 多选题中确定选项是否正确
  const isOptionCorrect = isSubmitted && isMultiple 
    ? isCorrect === option.id
    : isSubmitted && option.id === isCorrect;

  return (
    <div
      className={`flex items-start p-4 mb-3 border rounded-lg cursor-pointer transition-all ${getBgColor()}`}
      onClick={!isSubmitted ? onClick : undefined}
    >
      <div className={`flex-shrink-0 w-8 h-8 rounded-full mr-3 flex items-center justify-center 
        ${isSelected 
          ? isSubmitted
            ? isOptionCorrect 
              ? 'bg-green-500 text-white' 
              : 'bg-red-500 text-white'
            : 'bg-blue-500 text-white'
          : isSubmitted && isOptionCorrect
            ? 'bg-green-500 text-white'
            : 'bg-gray-200 text-gray-700'
        }
      `}>
        {isMultiple && isSelected && !isSubmitted && (
          <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
          </svg>
        )}
        {!isMultiple && option.id}
        {isMultiple && !isSelected && option.id}
      </div>
      <div className="flex-1">
        <p className="text-gray-800">{option.text}</p>
        {isMultiple && (
          <p className="text-gray-500 text-xs mt-1">
            {isSubmitted ? 
              (isOptionCorrect ? '正确选项' : (isSelected ? '错误选择' : '')) : 
              '多选题，点击选择'
            }
          </p>
        )}
      </div>
    </div>
  );
};

export default QuestionOption; 