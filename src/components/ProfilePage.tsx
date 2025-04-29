import React, { useEffect, useState, useCallback } from 'react';
import { useUser } from '../contexts/UserContext';
import { useSocket } from '../contexts/SocketContext';
import { toast } from 'react-toastify';
import { userProgressService, questionSetService } from '../services/api';

// 原始进度记录类型
interface ProgressRecord {
  id: string;
  questionSetId: string;
  questionId: string;
  isCorrect: boolean;
  timeSpent: number;
  createdAt?: string;
  progressQuestionSet?: {
    id: string;
    title: string;
  };
}

// 进度统计类型
interface ProgressStats {
  questionSetId: string;
  title?: string;
  completedQuestions: number;
  correctAnswers: number;
  totalTimeSpent: number;
  averageTimeSpent: number;
  accuracy: number;
}

// 题库信息
interface QuestionSet {
    id: string;
    title: string;
}

const ProfilePage: React.FC = () => {
  const { user } = useUser();
  const { socket } = useSocket();
  const [progressStats, setProgressStats] = useState<ProgressStats[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  // 在前端计算进度统计
  const calculateProgressStats = useCallback((records: ProgressRecord[], questionSets: Map<string, QuestionSet>) => {
    // 按题库ID分组
    const progressMap = new Map<string, Map<string, ProgressRecord>>();
    
    // 处理每条记录，按题库和题目分组，保留最后一次作答
    records.forEach(record => {
      const qsId = record.questionSetId;
      const qId = record.questionId;
      
      if (!progressMap.has(qsId)) {
        progressMap.set(qsId, new Map<string, ProgressRecord>());
      }
      
      const questionMap = progressMap.get(qsId)!;
      
      // 如果题目不存在或当前记录更新，则更新记录
      if (!questionMap.has(qId) || 
          (record.createdAt && questionMap.get(qId)!.createdAt && 
           new Date(record.createdAt) > new Date(questionMap.get(qId)!.createdAt!))) {
        questionMap.set(qId, record);
      }
    });
    
    // 生成最终统计结果
    const stats: ProgressStats[] = [];
    
    progressMap.forEach((questionMap, questionSetId) => {
      // 只处理有作答记录的题库
      if (questionMap.size > 0) {
        // 获取该题库的所有最终记录
        const finalRecords = Array.from(questionMap.values());
        
        // 统计数据
        const completedQuestions = finalRecords.length;
        const correctAnswers = finalRecords.filter(r => r.isCorrect).length;
        const totalTimeSpent = finalRecords.reduce((sum, r) => sum + r.timeSpent, 0);
        const averageTimeSpent = completedQuestions > 0 ? totalTimeSpent / completedQuestions : 0;
        const accuracy = completedQuestions > 0 ? (correctAnswers / completedQuestions) * 100 : 0;
        
        // 获取题库标题
        const title = questionSets.get(questionSetId)?.title || 
                     finalRecords[0]?.progressQuestionSet?.title || 
                     'Unknown Set';
        
        stats.push({
          questionSetId,
          title,
          completedQuestions,
          correctAnswers,
          totalTimeSpent,
          averageTimeSpent,
          accuracy
        });
      }
    });
    
    return stats;
  }, []);

  // 处理实时进度更新
  const handleProgressUpdate = useCallback((data: ProgressRecord) => {
    setProgressStats(prevStats => {
      // 复制现有统计
      const statsCopy = [...prevStats];
      
      // 查找相关题库的统计
      const existingStatIndex = statsCopy.findIndex(
        stat => stat.questionSetId === data.questionSetId
      );
      
      if (existingStatIndex >= 0) {
        // 更新现有统计 - 这里假设是一个新答题记录
        // 实际应用中可能需要更复杂的逻辑来处理题目重复作答的情况
        const stat = statsCopy[existingStatIndex];
        
        // 为简化处理，这里假设每次事件都是新题目
        // 实际应用可能需要通过API重新获取完整统计
        const newCompletedQuestions = stat.completedQuestions + 1;
        const newCorrectAnswers = data.isCorrect 
          ? stat.correctAnswers + 1 
          : stat.correctAnswers;
        const newTotalTimeSpent = stat.totalTimeSpent + data.timeSpent;
        
        statsCopy[existingStatIndex] = {
          ...stat,
          completedQuestions: newCompletedQuestions,
          correctAnswers: newCorrectAnswers,
          totalTimeSpent: newTotalTimeSpent,
          averageTimeSpent: newTotalTimeSpent / newCompletedQuestions,
          accuracy: (newCorrectAnswers / newCompletedQuestions) * 100
        };
      } else {
        // 添加新题库统计
        statsCopy.push({
          questionSetId: data.questionSetId,
          title: data.progressQuestionSet?.title || 'Unknown Set',
          completedQuestions: 1,
          correctAnswers: data.isCorrect ? 1 : 0,
          totalTimeSpent: data.timeSpent,
          averageTimeSpent: data.timeSpent,
          accuracy: data.isCorrect ? 100 : 0
        });
      }
      
      return statsCopy;
    });
  }, []);

  useEffect(() => {
    if (!socket || !user) return;

    const fetchProgressData = async () => {
      try {
        setIsLoading(true);
        
        // 获取所有题库信息
        const questionSetsResponse = await questionSetService.getAllQuestionSets();
        const questionSetsMap = new Map<string, QuestionSet>();
        
        if (questionSetsResponse.success && questionSetsResponse.data) {
          questionSetsResponse.data.forEach(qs => {
            questionSetsMap.set(qs.id, { id: qs.id, title: qs.title });
          });
        }
        
        // 获取原始进度记录
        const progressResponse = await userProgressService.getUserProgressRecords();
        
        if (progressResponse.success && progressResponse.data) {
          // 计算统计数据
          const stats = calculateProgressStats(progressResponse.data, questionSetsMap);
          setProgressStats(stats);
        } else {
          throw new Error(progressResponse.message || 'Failed to fetch progress');
        }
      } catch (error) {
        toast.error('Failed to load progress data');
        console.error('Error fetching progress:', error);
      } finally {
        setIsLoading(false);
      }
    };

    fetchProgressData();

    // 监听实时更新
    socket.on('progress:update', handleProgressUpdate);

    return () => {
      socket.off('progress:update', handleProgressUpdate);
    };
  }, [socket, user, calculateProgressStats, handleProgressUpdate]);

  if (isLoading) {
    return <div className="flex justify-center items-center h-64">
      <div className="animate-spin rounded-full h-12 w-12 border-t-2 border-b-2 border-blue-500"></div>
    </div>;
  }

  return (
    <div className="p-4">
      <h1 className="text-2xl font-bold mb-6">Learning Progress</h1>
      {progressStats.length === 0 ? (
        <div className="bg-white p-6 rounded-lg shadow text-center">
          <p className="text-gray-600">No progress data available. Start practicing to see your progress!</p>
        </div>
      ) : (
        <div className="grid gap-6 sm:grid-cols-1 md:grid-cols-2 lg:grid-cols-3">
          {progressStats.map((stats) => (
            <div key={stats.questionSetId} className="bg-white p-5 rounded-lg shadow-md hover:shadow-lg transition-shadow duration-300">
              <h2 className="text-lg font-semibold mb-3 text-blue-700 truncate">{stats.title}</h2>
              <div className="space-y-3">
                <div className="flex justify-between items-center">
                  <span className="text-sm text-gray-600">Completed Questions:</span>
                  <span className="font-medium">{stats.completedQuestions}</span>
                </div>
                <div className="flex justify-between items-center">
                  <span className="text-sm text-gray-600">Correct Answers:</span>
                  <span className="font-medium">{stats.correctAnswers}</span>
                </div>
                <div className="flex justify-between items-center">
                  <span className="text-sm text-gray-600">Accuracy:</span>
                  <span className="font-medium">{stats.accuracy.toFixed(1)}%</span>
                </div>
                <div className="flex justify-between items-center">
                  <span className="text-sm text-gray-600">Avg. Time Per Question:</span>
                  <span className="font-medium">{Math.round(stats.averageTimeSpent)} sec</span>
                </div>
                <div className="flex justify-between items-center">
                  <span className="text-sm text-gray-600">Total Time Spent:</span>
                  <span className="font-medium">{Math.round(stats.totalTimeSpent)} sec</span>
                </div>
                <div className="mt-4 pt-3 border-t border-gray-100">
                  <div className="h-2 bg-gray-200 rounded-full overflow-hidden">
                    <div 
                      className="h-full bg-green-500 rounded-full" 
                      style={{ width: `${stats.accuracy}%` }}
                    ></div>
                  </div>
                  <p className="text-xs text-gray-500 mt-1 text-right">Accuracy</p>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
};

export default ProfilePage;