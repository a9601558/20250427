import React from 'react';
import { Link } from 'react-router-dom';
import { QuestionSet } from '../types';
import { useUser } from '../contexts/UserContext';

interface StudySuggestionsProps {
  questionSets: QuestionSet[];
  theme?: 'light' | 'dark';
}

/**
 * 学习建议组件
 * 根据用户的学习进度和历史数据，提供个性化的学习建议和推荐
 */
const StudySuggestions: React.FC<StudySuggestionsProps> = ({
  questionSets,
  theme = 'light'
}) => {
  const { user, getQuizScore } = useUser();

  if (!user) {
    return null;
  }

  // 根据用户进度和学习情况，获取不同类型的建议
  const getSuggestions = () => {
    // 如果用户没有进度记录，推荐一些入门题库
    if (!user.progress || Object.keys(user.progress).length === 0) {
      const beginnerSets = questionSets
        .filter(qs => !qs.isPaid || (user.purchases && user.purchases.some(p => p.questionSetId === qs.id)))
        .slice(0, 3);
      
      return {
        type: 'beginner',
        title: '新手入门推荐',
        message: '这些题库适合初学者开始学习',
        questionSets: beginnerSets
      };
    }

    // 查找未完成的题库
    const incompleteQuestionSets = questionSets.filter(qs => {
      const progress = user.progress && user.progress[qs.id];
      return progress && progress.completedQuestions < progress.totalQuestions;
    }).sort((a, b) => {
      const aProgress = user.progress && user.progress[a.id];
      const bProgress = user.progress && user.progress[b.id];
      if (!aProgress || !bProgress) return 0;
      
      // 按照完成百分比从高到低排序，优先推荐接近完成的题库
      const aPercentage = aProgress.completedQuestions / aProgress.totalQuestions;
      const bPercentage = bProgress.completedQuestions / bProgress.totalQuestions;
      return bPercentage - aPercentage;
    }).slice(0, 3);

    if (incompleteQuestionSets.length > 0) {
      return {
        type: 'continue',
        title: '继续学习',
        message: '这些题库您已经开始学习，建议继续完成',
        questionSets: incompleteQuestionSets
      };
    }

    // 如果所有开始的题库都完成了，推荐新的题库
    const completedIds = Object.keys(user.progress || {});
    const newSuggestions = questionSets
      .filter(qs => !completedIds.includes(qs.id) && 
        (!qs.isPaid || (user.purchases && user.purchases.some(p => p.questionSetId === qs.id))))
      .slice(0, 3);

    if (newSuggestions.length > 0) {
      return {
        type: 'new',
        title: '推荐新题库',
        message: '尝试这些您尚未学习的题库，拓展知识面',
        questionSets: newSuggestions
      };
    }

    // 如果用户已经学习了所有题库，推荐复习得分较低的题库
    const reviewSuggestions = questionSets
      .filter(qs => {
        if (!user.progress || !user.progress[qs.id]) return false;
        const score = getQuizScore(qs.id);
        return score !== null && score < 80;
      })
      .sort((a, b) => {
        const aScore = getQuizScore(a.id);
        const bScore = getQuizScore(b.id);
        return (aScore || 0) - (bScore || 0); // 按照得分从低到高排序，处理null的情况
      })
      .slice(0, 3);

    if (reviewSuggestions.length > 0) {
      return {
        type: 'review',
        title: '建议复习',
        message: '这些题库的得分较低，建议重新学习以提高成绩',
        questionSets: reviewSuggestions
      };
    }

    // 默认返回一些随机推荐
    return {
      type: 'random',
      title: '随机推荐',
      message: '这些题库可能适合您继续深入学习',
      questionSets: questionSets
        .sort(() => Math.random() - 0.5)
        .slice(0, 3)
    };
  };

  const suggestions = getSuggestions();
  
  if (!suggestions.questionSets.length) {
    return null;
  }

  return (
    <div className={`rounded-lg shadow p-4 ${theme === 'dark' ? 'bg-gray-700' : 'bg-white'}`}>
      <div className="mb-4">
        <h2 className={`text-lg font-semibold ${theme === 'dark' ? 'text-white' : 'text-gray-900'}`}>
          {suggestions.title}
        </h2>
        <p className={`text-sm ${theme === 'dark' ? 'text-gray-300' : 'text-gray-500'} mt-1`}>
          {suggestions.message}
        </p>
      </div>

      <div className="space-y-3">
        {suggestions.questionSets.map(set => {
          // 计算进度百分比（如果有）
          const progress = user.progress && user.progress[set.id];
          const progressPercentage = progress 
            ? Math.round((progress.completedQuestions / progress.totalQuestions) * 100) 
            : 0;
          
          return (
            <div 
              key={set.id} 
              className={`border rounded-lg p-3 ${theme === 'dark' ? 'border-gray-600 hover:bg-gray-600' : 'border-gray-200 hover:bg-gray-50'} transition-colors`}
            >
              <div className="flex justify-between items-center mb-2">
                <div className="flex items-center">
                  <span className="text-xl mr-2">{set.icon || '📝'}</span>
                  <div>
                    <h3 className={`font-medium ${theme === 'dark' ? 'text-white' : 'text-gray-800'}`}>
                      {set.title}
                    </h3>
                    <p className={`text-xs ${theme === 'dark' ? 'text-gray-300' : 'text-gray-500'}`}>
                      {set.category} · {set.questionCount || 0} 题
                    </p>
                  </div>
                </div>
                
                {progress && (
                  <span className={`text-xs px-2 py-0.5 rounded-full ${
                    theme === 'dark' 
                      ? 'bg-blue-900 text-blue-200' 
                      : 'bg-blue-100 text-blue-800'
                  }`}>
                    {progressPercentage}%
                  </span>
                )}
              </div>
              
              {progress && (
                <div className="w-full bg-gray-200 rounded-full h-1.5 mb-2">
                  <div 
                    className={`h-1.5 rounded-full ${
                      suggestions.type === 'review' 
                        ? 'bg-red-500' 
                        : 'bg-blue-500'
                    }`}
                    style={{ width: `${progressPercentage}%` }} 
                  />
                </div>
              )}
              
              <div className="flex justify-end mt-2">
                <Link 
                  to={`/quiz/${set.id}`}
                  className={`text-sm px-3 py-1 rounded-md ${
                    theme === 'dark'
                      ? 'bg-blue-600 text-white hover:bg-blue-700'
                      : 'bg-blue-600 text-white hover:bg-blue-700'
                  }`}
                >
                  {progress ? '继续学习' : '开始学习'}
                </Link>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
};

export default StudySuggestions; 