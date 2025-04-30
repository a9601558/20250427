import React, { useEffect, useState, useCallback } from 'react';
import { useUser } from '../contexts/UserContext';
import { useSocket } from '../contexts/SocketContext';
import { toast } from 'react-toastify';
import { userProgressService, questionSetService } from '../services/api';
import { useNavigate } from 'react-router-dom';

// 原始进度记录类型
interface ProgressRecord {
  id: string;
  questionSetId: string;
  questionId: string;
  isCorrect: boolean;
  timeSpent: number;
  createdAt?: Date;
  progressQuestionSet?: {
    id: string;
    title: string;
  };
}

// 进度统计类型
interface ProgressStats {
  questionSetId: string;
  title: string;
  completedQuestions: number;
  correctAnswers: number;
  totalTimeSpent: number;
  averageTimeSpent: number;
  accuracy: number;
  answeredQuestions?: {
    questionId: string;
    selectedOptionId: string;
    isCorrect: boolean;
  }[];
}

// 题库信息
interface QuestionSet {
    id: string;
    title: string;
}

const formatTime = (seconds: number): string => {
  const mins = Math.floor(seconds / 60);
  const secs = Math.floor(seconds % 60);
  return mins > 0 ? `${mins}m ${secs}s` : `${secs}s`;
};

interface ProgressCardProps {
  stats: ProgressStats;
}

const ProgressCard: React.FC<ProgressCardProps> = ({ stats }) => {
  const navigate = useNavigate();

  return (
    <div 
      className="bg-white p-5 rounded-lg shadow-md hover:shadow-lg transition-shadow duration-300 cursor-pointer"
      onClick={() => navigate(`/question-set/${stats.questionSetId}`)}
    >
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
          <span className="font-medium">{formatTime(stats.averageTimeSpent)}</span>
        </div>
        <div className="flex justify-between items-center">
          <span className="text-sm text-gray-600">Total Time Spent:</span>
          <span className="font-medium">{formatTime(stats.totalTimeSpent)}</span>
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
  );
};

const ProfilePage: React.FC = () => {
  const { user } = useUser();
  const { socket } = useSocket();
  const [progressStats, setProgressStats] = useState<ProgressStats[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const navigate = useNavigate();

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
        const accuracy = Math.min(100, (correctAnswers / completedQuestions) * 100);
        
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
  const handleProgressUpdate = useCallback(async () => {
    try {
      setIsLoading(true);
      
      const questionSetsResponse = await questionSetService.getAllQuestionSets();
      const questionSetsMap = new Map<string, QuestionSet>();
      
      if (questionSetsResponse.success && questionSetsResponse.data) {
        questionSetsResponse.data.forEach(qs => {
          questionSetsMap.set(qs.id, { id: qs.id, title: qs.title });
        });
      }
      
      const progressResponse = await userProgressService.getUserProgressRecords();
      
      if (progressResponse.success && progressResponse.data) {
        const stats = calculateProgressStats(progressResponse.data, questionSetsMap);
        setProgressStats(stats);
      } else {
        throw new Error(progressResponse.message || 'Failed to fetch progress');
      }
    } catch (error) {
      toast.error('Failed to load progress data');
      console.error('[ProfilePage] Error fetching progress:', error);
    } finally {
      setIsLoading(false);
    }
  }, [calculateProgressStats]);

  useEffect(() => {
    if (!socket || !user) return;

    // 初始加载数据
    handleProgressUpdate();

    // 监听实时更新
    socket.on('progress:update', handleProgressUpdate);

    return () => {
      socket.off('progress:update', handleProgressUpdate);
    };
  }, [socket, user, handleProgressUpdate]);

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
          <p className="text-gray-600 mb-4">🎯 你还没有开始答题，点击这里开始练习！</p>
          <button
            onClick={() => navigate('/question-sets')}
            className="bg-blue-500 hover:bg-blue-600 text-white font-medium py-2 px-4 rounded-lg transition-colors duration-200"
          >
            开始练习
          </button>
        </div>
      ) : (
        <div className="grid gap-6 sm:grid-cols-1 md:grid-cols-2 lg:grid-cols-3">
          {progressStats.map((stats) => (
            <ProgressCard key={stats.questionSetId} stats={stats} />
          ))}
        </div>
      )}
    </div>
  );
};

export default ProfilePage;