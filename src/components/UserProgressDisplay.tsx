import React from 'react';
import { Link } from 'react-router-dom';
import { QuestionSet } from '../types';
import { useUser } from '../contexts/UserContext';
import { useUserProgress } from '../contexts/UserProgressContext';

interface UserProgressDisplayProps {
  questionSets: QuestionSet[];
  limit?: number;
  showTitle?: boolean;
  className?: string;
}

/**
 * 用户进度展示组件
 * 用于在首页或其他页面展示用户在各个题库的学习进度
 */
const UserProgressDisplay: React.FC<UserProgressDisplayProps> = ({
  questionSets,
  limit = 3,
  showTitle = true,
  className = '',
}) => {
  const { user, getQuizScore, isQuizCompleted } = useUser();
  const { progressStats } = useUserProgress();

  if (!user || !progressStats || Object.keys(progressStats).length === 0) {
    return null;
  }

  // 获取有进度记录的题库
  const progressQuestionSets = questionSets.filter(qs => 
    progressStats[qs.id] && progressStats[qs.id].completedQuestions > 0
  );

  // 按照最后访问时间排序
  const sortedSets = [...progressQuestionSets].sort((a, b) => {
    const aTime = progressStats[a.id]?.lastAccessed
      ? new Date(progressStats[a.id]?.lastAccessed).getTime()
      : 0;
    const bTime = progressStats[b.id]?.lastAccessed
      ? new Date(progressStats[b.id]?.lastAccessed).getTime()
      : 0;
    return bTime - aTime; // 从新到旧排序
  });

  // 限制展示数量
  const displaySets = limit > 0 ? sortedSets.slice(0, limit) : sortedSets;

  if (displaySets.length === 0) {
    return null;
  }

  // 计算总体进度
  const totalQuestions = Object.values(progressStats).reduce((sum, prog) => sum + prog.totalQuestions, 0);
  const completedQuestions = Object.values(progressStats).reduce((sum, prog) => sum + prog.completedQuestions, 0);
  const overallProgress = totalQuestions > 0 ? Math.round((completedQuestions / totalQuestions) * 100) : 0;

  return (
    <div className={`bg-white rounded-lg shadow p-4 ${className}`}>
      {showTitle && (
        <div className="flex justify-between items-center mb-4">
          <h2 className="text-lg font-semibold text-gray-900">私の学習進朗</h2>
          <Link to="/profile" className="text-sm text-blue-600 hover:text-blue-800">
            全て表示
          </Link>
        </div>
      )}

      {/* 总体进度 */}
      <div className="mb-4">
        <div className="flex justify-between items-center mb-1">
          <span className="text-sm font-medium text-gray-700">全体進朗</span>
          <span className="text-sm font-medium text-blue-600">{overallProgress}%</span>
        </div>
        <div className="w-full bg-gray-200 rounded-full h-2.5">
          <div 
            className="bg-blue-600 h-2.5 rounded-full" 
            style={{ width: `${overallProgress}%` }}
          />
        </div>
        <div className="text-xs text-gray-500 mt-1 text-right">
          {completedQuestions}/{totalQuestions} 题目已完成
        </div>
      </div>

      {/* 各题库进度 */}
      <div className="space-y-3">
        {displaySets.map((questionSet) => {
          const progress = progressStats[questionSet.id];
          const progressPercentage = Math.round((progress.completedQuestions / progress.totalQuestions) * 100);
          const score = getQuizScore(questionSet.id);
          const isCompleted = isQuizCompleted(questionSet.id);
          
          return (
            <div key={questionSet.id} className="border rounded-lg p-3 hover:bg-gray-50 transition-colors">
              <div className="flex justify-between items-center mb-2">
                <div className="flex items-center">
                  <span className="text-xl mr-2">{questionSet.icon || '📝'}</span>
                  <span className="font-medium text-gray-800">{questionSet.title}</span>
                </div>
                {isCompleted && (
                  <span className="px-2 py-0.5 text-xs rounded bg-green-100 text-green-800">
                    已完成
                  </span>
                )}
              </div>
              
              <div className="w-full bg-gray-200 rounded-full h-2 mb-2">
                <div 
                  className={`h-2 rounded-full ${score && score >= 80 ? 'bg-green-500' : score && score >= 60 ? 'bg-yellow-500' : 'bg-blue-500'}`}
                  style={{ width: `${progressPercentage}%` }} 
                />
              </div>
              
              <div className="flex justify-between text-xs text-gray-500">
                <span>{progress.completedQuestions}/{progress.totalQuestions} 問題</span>
                {score !== null && (
                  <span className="font-medium" style={{ color: score >= 80 ? '#10B981' : score >= 60 ? '#F59E0B' : '#3B82F6' }}>
                    得分: {score}%
                  </span>
                )}
              </div>
              
              <Link 
                to={`/quiz/${questionSet.id}`}
                className="mt-2 text-xs text-blue-600 hover:text-blue-800 inline-block"
              >
                {isCompleted ? '再試験' : '学習継続'} →
              </Link>
            </div>
          );
        })}
      </div>
    </div>
  );
};

export default UserProgressDisplay; 