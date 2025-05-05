import React from 'react';
import { Option } from '../types';

// 获取选项标签（A, B, C, D...）
const getOptionLabel = (index: number): string => {
  return String.fromCharCode(65 + index); // 65 是 'A' 的 ASCII 码
};

interface QuestionOptionProps {
  option: Option;
  isSelected: boolean;
  correctOptionIds: string[]; // 替代原来的isCorrect，使用数组表示所有正确选项
  isSubmitted: boolean;
  isMultiple?: boolean;
  onClick: () => void;
  index: number;
  optionId: string; // 确保每个选项有明确的ID
}

const QuestionOption: React.FC<QuestionOptionProps> = ({
  option,
  isSelected,
  correctOptionIds,
  isSubmitted,
  isMultiple = false,
  onClick,
  index,
  optionId
}) => {
  // 判断当前选项是否为正确答案
  const isOptionCorrect = correctOptionIds.includes(optionId);
  
  // 判断用户的选择是否正确
  const isUserSelectionCorrect = isSelected && isOptionCorrect;
  
  // 判断用户是否漏选了正确答案
  const isMissedCorrect = !isSelected && isOptionCorrect && isSubmitted;
  
  // 判断用户是否错误选择了此选项
  const isUserSelectionWrong = isSelected && !isOptionCorrect && isSubmitted;

  // 根据当前状态确定背景颜色和边框
  const getStyleClasses = () => {
    // 基础样式类
    let baseClasses = "flex items-start p-4 mb-3 border-2 rounded-lg transition-all ";
    
    // 未提交状态
    if (!isSubmitted) {
      // 鼠标悬停效果仅在未提交时显示
      const hoverClasses = "hover:border-blue-400 hover:bg-blue-50 ";
      
      // 已选中状态
      if (isSelected) {
        return baseClasses + "bg-blue-100 border-blue-500 " + hoverClasses;
      }
      
      // 未选中状态
      return baseClasses + "bg-white border-gray-200 " + hoverClasses;
    }
    
    // 已提交状态的样式逻辑
    if (isUserSelectionCorrect) {
      // 用户选择正确
      return baseClasses + "bg-green-100 border-green-500";
    } else if (isUserSelectionWrong) {
      // 用户选择错误
      return baseClasses + "bg-red-100 border-red-500";
    } else if (isMissedCorrect) {
      // 用户漏选的正确答案
      return baseClasses + "bg-green-50 border-green-500 border-dashed";
    }
    
    // 其他情况 - 未选且非正确答案
    return baseClasses + "bg-white border-gray-200 opacity-70";
  };

  // 获取指示器的样式
  const getIndicatorClasses = () => {
    let baseClasses = "flex-shrink-0 w-8 h-8 rounded-full mr-3 flex items-center justify-center ";
    
    // 未提交状态
    if (!isSubmitted) {
      if (isSelected) {
        // 选中但未提交
        return baseClasses + (isMultiple ? "bg-blue-500 text-white" : "bg-blue-500 text-white");
      }
      // 未选中且未提交
      return baseClasses + "bg-gray-200 text-gray-700";
    }
    
    // 已提交状态
    if (isUserSelectionCorrect) {
      // 用户选择正确
      return baseClasses + "bg-green-600 text-white";
    } else if (isUserSelectionWrong) {
      // 用户选择错误
      return baseClasses + "bg-red-600 text-white";
    } else if (isMissedCorrect) {
      // 用户漏选的正确答案
      return baseClasses + "bg-green-500 text-white border-2 border-white";
    }
    
    // 其他情况
    return baseClasses + "bg-gray-200 text-gray-700";
  };

  // 获取选项显示标签
  const optionLabel = option.label || getOptionLabel(index);

  // 获取辅助描述文本
  const getAccessibleDescription = () => {
    if (!isSubmitted) {
      return isMultiple ? "多选题选项，点击选择" : "单选题选项，点击选择";
    }
    
    if (isUserSelectionCorrect) {
      return "正确选择";
    } else if (isUserSelectionWrong) {
      return "错误选择";
    } else if (isMissedCorrect) {
      return "未选择的正确答案";
    }
    
    return "";
  };

  // 使用正确的语义化元素
  const role = isMultiple ? "checkbox" : "radio";
  
  return (
    <button
      type="button"
      role={role}
      aria-checked={isSelected}
      aria-disabled={isSubmitted}
      aria-label={`选项 ${optionLabel}: ${option.text}`}
      className={getStyleClasses()}
      onClick={!isSubmitted ? onClick : undefined}
      tabIndex={!isSubmitted ? 0 : -1}
      data-testid={`option-${optionId}`}
    >
      <div className={getIndicatorClasses()}>
        {isMultiple && isSelected ? (
          // 多选项选中时显示勾选图标和字母标签
          <span className="relative">
            {optionLabel}
            {!isSubmitted && (
              <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4 absolute -top-2 -right-2 bg-blue-600 rounded-full p-0.5" fill="none" viewBox="0 0 24 24" stroke="white">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M5 13l4 4L19 7" />
              </svg>
            )}
          </span>
        ) : (
          // 其他情况只显示字母标签
          optionLabel
        )}
      </div>
      <div className="flex-1 text-left">
        <p className="text-gray-800">{option.text}</p>
        <p className="text-sm mt-1" aria-live="polite">
          {getAccessibleDescription()}
        </p>
      </div>
      
      {/* 提交后显示特殊图标来增强视觉反馈 */}
      {isSubmitted && (
        <div className="ml-2 flex-shrink-0">
          {isUserSelectionCorrect && (
            <svg xmlns="http://www.w3.org/2000/svg" className="h-6 w-6 text-green-600" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
            </svg>
          )}
          {isUserSelectionWrong && (
            <svg xmlns="http://www.w3.org/2000/svg" className="h-6 w-6 text-red-600" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 14l2-2m0 0l2-2m-2 2l-2-2m2 2l2 2m7-2a9 9 0 11-18 0 9 9 0 0118 0z" />
            </svg>
          )}
          {isMissedCorrect && (
            <svg xmlns="http://www.w3.org/2000/svg" className="h-6 w-6 text-yellow-600" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
            </svg>
          )}
        </div>
      )}
    </button>
  );
};

export default QuestionOption; 