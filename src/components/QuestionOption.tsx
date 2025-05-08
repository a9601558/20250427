import React from 'react';
import { Option } from '../types';
import { getOptionLabel, getOptionStyleClass } from '../utils/optionUtils';

interface QuestionOptionProps {
  option: Option;
  isSelected: boolean;
  isCorrect: string | null;
  isSubmitted: boolean;
  isMultiple?: boolean;
  onClick: () => void;
  index: number; // 添加索引属性
}

const QuestionOption: React.FC<QuestionOptionProps> = ({
  option,
  isSelected,
  isCorrect,
  isSubmitted,
  isMultiple = false,
  onClick,
  index
}) => {
  // 多选题中确定选项是否正确
  const isOptionCorrect = isSubmitted && isMultiple 
    ? isCorrect === option.id
    : isSubmitted && option.id === isCorrect;

  // 获取选项显示标签
  const optionLabel = option.label || getOptionLabel(index);

  return (
    <div
      className={`flex items-start p-4 mb-3 border rounded-lg cursor-pointer transition-all ${getOptionStyleClass(isSelected, isSubmitted, isCorrect, option.id)}`}
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
        {!isMultiple && optionLabel}
        {isMultiple && !isSelected && optionLabel}
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