import React, { useMemo } from 'react';
import { PreparedQuestionSet, AccessType } from '../types/questionSet';

interface BaseCardProps {
  set: PreparedQuestionSet;
  onStartQuiz: (set: PreparedQuestionSet) => void;
}

const BaseCard: React.FC<BaseCardProps> = ({ set, onStartQuiz }) => {
  // 常量定义 - 提取默认图标到变量
  const defaultIcon = '📚';
  
  // 格式化剩余天数的显示
  const formatRemainingDays = (days: number | null) => {
    if (days === null) return "永久有效";
    if (days <= 0) return "已过期";
    if (days === 1) return "剩余1天";
    if (days < 30) return `剩余${days}天`;
    const months = Math.floor(days / 30);
    return `剩余${months}个月${days % 30 > 0 ? ` ${days % 30}天` : ''}`;
  };

  // 获取题目数量 - 使用useMemo优化
  const getQuestionCount = () => {
    // Debug original values
    const originalCount = set.questionCount;
    const questionsLength = Array.isArray(set.questions) ? set.questions.length : 0;
    const questionSetQuestionsLength = Array.isArray(set.questionSetQuestions) ? set.questionSetQuestions.length : 0;
    
    console.log(`[BaseCard] Question count data for ${set.id} (${set.title}):`, {
      questionCount: originalCount,
      questionsLength: questionsLength,
      questionSetQuestionsLength: questionSetQuestionsLength
    });
    
    // Check for valid questionCount property - most reliable source
    if (typeof originalCount === 'number' && originalCount > 0) {
      return originalCount;
    }
    
    // Fallback to questions array length if available
    if (questionsLength > 0) {
      return questionsLength;
    }
    
    // Last resort: check questionSetQuestions array length
    if (questionSetQuestionsLength > 0) {
      return questionSetQuestionsLength;
    }
    
    // Return 0 until we have better data
    return originalCount || 0;
  };
  
  // 使用useMemo缓存题目数量计算结果
  const questionCount = useMemo(() => getQuestionCount(), [
    set.id, 
    set.questionCount, 
    set.questions, 
    set.questionSetQuestions
  ]);

  // 根据剩余时间计算进度条颜色和百分比
  const getRemainingTimeDisplay = () => {
    if (set.remainingDays === null) return { color: 'bg-green-500', percent: 100 };
    if (set.remainingDays <= 0) return { color: 'bg-red-500', percent: 0 };
    if (set.validityPeriod === 0) return { color: 'bg-green-500', percent: 100 };
    
    const percent = Math.min(100, Math.round((set.remainingDays / set.validityPeriod) * 100));
    let color = 'bg-green-500';
    if (percent < 20) color = 'bg-red-500';
    else if (percent < 50) color = 'bg-yellow-500';
    return { color, percent };
  };

  const { color, percent } = getRemainingTimeDisplay();
  const isPaid = set.isPaid && set.accessType !== 'trial';
  const isRedeemed = set.accessType === 'redeemed';
  const isExpired = set.accessType === 'expired';
  const hasAccess = set.hasAccess;
  const isFree = !set.isPaid;
  
  // 确定卡片的访问类型标签
  const getAccessTypeLabel = () => {
    if (!set.isPaid) return '免费';
    if (set.accessType === 'paid') return hasAccess ? '已购买' : '付费';
    if (set.accessType === 'redeemed') return '已兑换';
    if (set.accessType === 'expired') return '已过期';
    return '付费';
  };
  
  // 确定标签的颜色
  const getAccessTypeBadgeClass = () => {
    if (!set.isPaid) return 'bg-blue-100 text-blue-800 border border-blue-200';
    if (set.accessType === 'paid') return hasAccess ? 'bg-green-100 text-green-800 border border-green-200' : 'bg-amber-100 text-amber-800 border border-amber-200';
    if (set.accessType === 'redeemed') return 'bg-purple-100 text-purple-800 border border-purple-200';
    if (set.accessType === 'expired') return 'bg-red-100 text-red-800 border border-red-200';
    return 'bg-amber-100 text-amber-800 border border-amber-200';
  };

  return (
    <div className="relative group h-[180px] rounded-xl transition-all duration-300 bg-white border border-gray-100 shadow hover:shadow-md hover:border-blue-100 transform hover:-translate-y-1 overflow-hidden">
      {/* Subtle accent */}
      <div className="absolute top-0 left-0 right-0 h-1 bg-gradient-to-r from-blue-400 to-indigo-400 opacity-80"></div>
      
      {/* Card Image Background - Add support for card image */}
      {set.cardImage && (
        <div 
          className="absolute inset-0 z-0 opacity-5"
          style={{ 
            backgroundImage: `url(${set.cardImage})`,
            backgroundSize: 'cover',
            backgroundPosition: 'center',
          }}
        />
      )}
      
      {/* Subtle decorative elements */}
      <div className="absolute -right-4 -top-4 w-16 h-16 bg-blue-400 opacity-5 rounded-full"></div>
      <div className="absolute -left-4 -bottom-4 w-16 h-16 bg-indigo-400 opacity-5 rounded-full"></div>
      
      {/* Card content */}
      <div className="relative z-10 h-full p-4 flex flex-col justify-between">
        {/* Header */}
        <div>
          <div className="flex justify-between items-start mb-2">
            {/* Title and icon */}
            <div className="flex items-center">
              <div className="w-8 h-8 rounded-full bg-blue-50 flex items-center justify-center text-lg mr-2 flex-shrink-0 text-blue-600 overflow-hidden">
                {set.icon && (set.icon.startsWith('/') || set.icon.startsWith('http') || set.icon.startsWith('data:')) ? (
                  <img 
                    src={set.icon} 
                    alt="icon" 
                    className="w-5 h-5 object-contain"
                    onError={(e) => {
                      // On error, replace with default emoji
                      const target = e.target as HTMLImageElement;
                      target.style.display = 'none';
                      const parent = target.parentElement;
                      if (parent) {
                        parent.textContent = defaultIcon;
                      }
                    }} 
                  />
                ) : (
                  set.icon || defaultIcon
                )}
              </div>
              <h3 className="text-base font-semibold text-gray-800 group-hover:text-blue-600 transition-colors line-clamp-1 pr-2">
                {set.title}
              </h3>
            </div>
            
            {/* Access type badge */}
            <div className="flex-shrink-0">
              <span className={`inline-flex items-center px-2 py-0.5 rounded-md text-xs font-medium ${getAccessTypeBadgeClass()}`}>
                {getAccessTypeLabel()}
                {isFree && <span className="absolute inset-0 rounded-md bg-blue-400 mix-blend-screen opacity-10 animate-pulse hidden group-hover:block"></span>}
              </span>
            </div>
          </div>
          
          {/* Description */}
          <p className="text-xs text-gray-500 mb-3 line-clamp-1">{set.description}</p>
        </div>
        
        {/* Info section */}
        <div className="space-y-3">
          {/* Stats */}
          <div className="flex items-center text-xs text-gray-500 space-x-4">
            <div className="flex items-center">
              <svg className="w-3.5 h-3.5 mr-1 text-blue-500" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8.228 9c.549-1.165 2.03-2 3.772-2 2.21 0 4 1.343 4 3 0 1.4-1.278 2.575-3.006 2.907-.542.104-.994.54-.994 1.093m0 3h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
              </svg>
              {questionCount > 0 ? (
                <span>{questionCount}题</span>
              ) : (
                <span className="text-red-500 flex items-center">
                  <span>0题</span>
                  <svg className="w-3 h-3 ml-1 animate-pulse text-amber-500" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
                  </svg>
                </span>
              )}
            </div>
            <div className="flex items-center">
              <svg className="w-3.5 h-3.5 mr-1 text-indigo-500" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M7 7h.01M7 3h5c.512 0 1.024.195 1.414.586l7 7a2 2 0 010 2.828l-7 7a2 2 0 01-2.828 0l-7-7A1.994 1.994 0 013 12V7a4 4 0 014-4z" />
              </svg>
              <span>{set.category}</span>
            </div>
          </div>
          
          {/* Validity period or price */}
          {(isPaid || isRedeemed) && hasAccess && !isExpired ? (
            <div className="w-full">
              <div className="flex justify-between text-xs mb-1">
                <span className="text-gray-500">有效期</span>
                <span className={`font-medium ${
                  percent < 20 ? 'text-red-600' : 
                  percent < 50 ? 'text-amber-600' : 
                  'text-green-600'
                }`}>
                  {formatRemainingDays(set.remainingDays)}
                </span>
              </div>
              <div className="w-full h-1.5 bg-gray-100 rounded-full overflow-hidden">
                <div 
                  className={`h-full ${color} transition-all duration-500`}
                  style={{ width: `${percent}%` }}
                ></div>
              </div>
            </div>
          ) : set.isPaid && !hasAccess ? (
            <div className="flex items-baseline">
              <span className="text-base font-bold text-blue-600">¥{set.price}</span>
              {set.trialQuestions && (
                <span className="ml-2 text-xs text-gray-500">
                  可试用{set.trialQuestions}题
                </span>
              )}
            </div>
          ) : (
            <div className="w-full h-[2px] bg-blue-50 rounded-full mt-2"></div>
          )}
          
          {/* Action button */}
          <button
            onClick={() => onStartQuiz(set)}
            className={`w-full py-1.5 rounded-lg text-xs font-medium transition-all duration-300 ${
              hasAccess 
                ? 'bg-blue-600 hover:bg-blue-700 text-white'
                : 'bg-indigo-600 hover:bg-indigo-700 text-white'
            } flex items-center justify-center group-hover:shadow transform group-hover:scale-[1.01]`}
          >
            {hasAccess ? (
              <>
                <svg className="w-3.5 h-3.5 mr-1" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M14.752 11.168l-3.197-2.132A1 1 0 0010 9.87v4.263a1 1 0 001.555.832l3.197-2.132a1 1 0 000-1.664z" />
                </svg>
                开始练习
              </>
            ) : (
              <>
                <svg className="w-3.5 h-3.5 mr-1" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 15l-2 5L9 9l11 4-5 2zm0 0l5 5M7.188 2.239l.777 2.897M5.136 7.965l-2.898-.777M13.95 4.05l-2.122 2.122m-5.657 5.656l-2.12 2.122" />
                </svg>
                试用练习
              </>
            )}
          </button>
        </div>
      </div>
      
      {/* Hover effects */}
      <div className="absolute inset-0 bg-gradient-to-r from-transparent via-blue-100 to-transparent opacity-0 group-hover:opacity-10 transform -translate-x-full group-hover:translate-x-full transition-all duration-1000 ease-in-out"></div>
    </div>
  );
};

export default BaseCard; 