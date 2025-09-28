import React, { useState, useEffect } from 'react';
import { questionSetService } from '../../services/api';

const QuestionCountTest: React.FC = () => {
  const [questionSets, setQuestionSets] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    loadQuestionSets();
  }, []);

  const loadQuestionSets = async () => {
    try {
      const response = await questionSetService.getAllQuestionSets();
      if (response.success && response.data) {
        console.log('Raw API response:', response.data);
        setQuestionSets(response.data);
      }
    } catch (error) {
      console.error('加载题库失败:', error);
    } finally {
      setLoading(false);
    }
  };

  const getCorrectQuestionCount = (set: any): number => {
    console.log(`计算题库 "${set.title}" 的题目数量:`, {
      questionCount: set.questionCount,
      questionSetQuestions: set.questionSetQuestions?.length,
      questions: set.questions?.length,
      rawSet: set
    });

    // 优先使用API返回的questionCount
    if (typeof set.questionCount === 'number' && set.questionCount >= 0) {
      return set.questionCount;
    }
    
    // 其次使用questionSetQuestions数组
    if (set.questionSetQuestions && Array.isArray(set.questionSetQuestions)) {
      return set.questionSetQuestions.length;
    }
    
    // 最后使用questions数组
    if (set.questions && Array.isArray(set.questions)) {
      return set.questions.length;
    }
    
    return 0;
  };

  if (loading) {
    return <div className="p-4">加载中...</div>;
  }

  return (
    <div className="p-6">
      <h2 className="text-xl font-bold mb-4">题目数量测试</h2>
      <div className="space-y-4">
        {questionSets.map((set, index) => (
          <div key={set.id || index} className="border p-4 rounded">
            <h3 className="font-medium">{set.title}</h3>
            <div className="mt-2 text-sm space-y-1">
              <div>API questionCount: <span className="font-mono">{set.questionCount}</span></div>
              <div>questionSetQuestions数组长度: <span className="font-mono">{set.questionSetQuestions?.length || 'undefined'}</span></div>
              <div>questions数组长度: <span className="font-mono">{set.questions?.length || 'undefined'}</span></div>
              <div className="font-bold text-blue-600">计算结果: {getCorrectQuestionCount(set)}</div>
            </div>
            <details className="mt-2">
              <summary className="cursor-pointer text-sm text-gray-500">查看原始数据</summary>
              <pre className="mt-2 text-xs bg-gray-100 p-2 rounded overflow-x-auto">
                {JSON.stringify(set, null, 2)}
              </pre>
            </details>
          </div>
        ))}
      </div>
    </div>
  );
};

export default QuestionCountTest;