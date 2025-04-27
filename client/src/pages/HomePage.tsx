import { useEffect, useState } from 'react';
import { useAuth } from '../contexts/AuthContext';
import { socketManager } from '../config/socket';
import { QuestionSet } from '../types';
import { fetchQuestionSets } from '../services/questionSetService';

const HomePage = () => {
  const { user } = useAuth();
  const [questionSets, setQuestionSets] = useState<QuestionSet[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    // 初始化Socket连接
    if (user) {
      socketManager.connect(user.id);
    }

    // 加载题库列表
    const loadQuestionSets = async () => {
      try {
        const data = await fetchQuestionSets();
        setQuestionSets(data);
      } catch (err) {
        setError('加载题库失败');
        console.error('加载题库失败:', err);
      } finally {
        setLoading(false);
      }
    };

    loadQuestionSets();

    // 监听题目数量更新事件
    const handleQuestionCountUpdate = (data: { questionSetId: string; count: number }) => {
      setQuestionSets(prevSets => 
        prevSets.map(set => 
          set.id === data.questionSetId
            ? { ...set, questionCount: data.count }
            : set
        )
      );
    };

    socketManager.addEventListener('question_count_updated', handleQuestionCountUpdate);

    // 清理函数
    return () => {
      socketManager.removeEventListener('question_count_updated', handleQuestionCountUpdate);
      socketManager.disconnect();
    };
  }, [user]);

  if (loading) {
    return <div>加载中...</div>;
  }

  if (error) {
    return <div>{error}</div>;
  }

  return (
    <div className="container mx-auto px-4 py-8">
      <h1 className="text-3xl font-bold mb-8">题库列表</h1>
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
        {questionSets.map(set => (
          <div key={set.id} className="bg-white rounded-lg shadow-md p-6">
            <h2 className="text-xl font-semibold mb-2">{set.title}</h2>
            <p className="text-gray-600 mb-4">{set.description}</p>
            <div className="flex justify-between items-center">
              <span className="text-sm text-gray-500">
                题目数量: {set.questionCount}
              </span>
              <button className="bg-blue-500 text-white px-4 py-2 rounded hover:bg-blue-600">
                开始练习
              </button>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
};

export default HomePage; 