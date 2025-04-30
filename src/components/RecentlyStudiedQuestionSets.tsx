import React from 'react';
import { Link } from 'react-router-dom';
import { QuestionSet } from '../types';
import { useUser } from '../contexts/UserContext';
import { useUserProgress } from '../contexts/UserProgressContext';

interface RecentlyStudiedQuestionSetsProps {
  questionSets: QuestionSet[];
  limit?: number;
  theme?: 'light' | 'dark';
}

/**
 * 最近学习的题库组件
 * 显示用户最近学习过的题库，并提供快捷访问
 */
const RecentlyStudiedQuestionSets: React.FC<RecentlyStudiedQuestionSetsProps> = ({
  questionSets,
  limit = 5,
  theme = 'light'
}) => {
  const { user } = useUser();
  const { progressStats } = useUserProgress();

  if (!user || !progressStats || Object.keys(progressStats).length === 0) {
    return null;
  }

  // 获取用户有进度记录的题库，添加更严格的检查
  const studiedSets = questionSets.filter(qs => {
    const progress = progressStats[qs.id];
    return progress && progress.completedQuestions > 0;
  });

  // 按照最后访问时间排序，添加更安全的处理
  const sortedSets = [...studiedSets].sort((a, b) => {
    const aProgress = progressStats[a.id];
    const bProgress = progressStats[b.id];
    
    if (!aProgress || !bProgress) return 0;
    
    const parseTime = (input?: string | Date): number => {
      try {
        return input ? new Date(input).getTime() : 0;
      } catch {
        return 0;
      }
    };

    const aTime = parseTime(aProgress?.lastAccessed);
    const bTime = parseTime(bProgress?.lastAccessed);
    return bTime - aTime; // 从新到旧排序
  });

  // 限制显示数量
  const displaySets = sortedSets.slice(0, limit);

  if (displaySets.length === 0) {
    return null;
  }

  // 格式化最后访问时间，添加更安全的处理
  const formatLastAccessed = (date: string | Date | null): string => {
    try {
      if (!date) return '无记录';
      
      const now = new Date();
      const lastAccessed = new Date(date);
      if (isNaN(lastAccessed.getTime())) {
        return '无记录';
      }
      const diffTime = Math.abs(now.getTime() - lastAccessed.getTime());
      const diffDays = Math.floor(diffTime / (1000 * 60 * 60 * 24));
      const diffHours = Math.floor((diffTime % (1000 * 60 * 60 * 24)) / (1000 * 60 * 60));
      const diffMinutes = Math.floor((diffTime % (1000 * 60 * 60)) / (1000 * 60));

      if (diffDays > 0) {
        return `${diffDays}天前`;
      } else if (diffHours > 0) {
        return `${diffHours}小时前`;
      } else if (diffMinutes > 0) {
        return `${diffMinutes}分钟前`;
      } else {
        return '刚刚';
      }
    } catch (error) {
      console.error('格式化时间失败:', error);
      return '无记录';
    }
  };

  return (
    <div className={`rounded-lg shadow p-4 ${theme === 'dark' ? 'bg-gray-700 text-white' : 'bg-white'}`}>
      <div className="flex items-center justify-between mb-4">
        <h2 className={`text-lg font-semibold ${theme === 'dark' ? 'text-white' : 'text-gray-900'}`}>
          最近学习
        </h2>
        <Link 
          to="/profile" 
          className={`text-sm ${theme === 'dark' ? 'text-blue-300 hover:text-blue-200' : 'text-blue-600 hover:text-blue-800'}`}
        >
          查看全部
        </Link>
      </div>

      <div className="space-y-2">
        {displaySets.map(set => {
          const progress = progressStats[set.id];
          const progressPercentage = progress?.totalQuestions
            ? Math.round((progress.completedQuestions / progress.totalQuestions) * 100)
            : 0;
          
          // 安全地处理lastAccessed，如果不存在则使用当前时间
          const safeDate = progress?.lastAccessed ? new Date(progress.lastAccessed) : new Date();
          
          return (
            <Link 
              key={set.id} 
              to={`/quiz/${set.id}`}
              className={`flex items-center p-2 rounded-lg ${theme === 'dark' ? 'hover:bg-gray-600' : 'hover:bg-gray-50'} transition-colors`}
            >
              <span className="text-xl mr-3">{set.icon || '📘'}</span>
              <div className="flex-1 min-w-0">
                <p className={`text-sm font-medium ${theme === 'dark' ? 'text-white' : 'text-gray-900'} truncate`}>
                  {set.title}
                </p>
                <div className="flex items-center mt-1">
                  <div className="w-24 bg-gray-200 rounded-full h-1.5 mr-2">
                    <div 
                      className="bg-blue-600 h-1.5 rounded-full" 
                      style={{ width: `${progressPercentage}%` }}
                    />
                  </div>
                  <p className={`text-xs ${theme === 'dark' ? 'text-gray-300' : 'text-gray-500'}`}>
                    {progressPercentage}%
                  </p>
                </div>
              </div>
              <div className="ml-2 text-right">
                <p className={`text-xs ${theme === 'dark' ? 'text-gray-300' : 'text-gray-500'}`}>
                  {formatLastAccessed(safeDate)}
                </p>
                <p className={`text-xs mt-1 ${theme === 'dark' ? 'text-blue-300' : 'text-blue-600'}`}>
                  继续学习
                </p>
              </div>
            </Link>
          );
        })}
      </div>
    </div>
  );
};

export default RecentlyStudiedQuestionSets; 