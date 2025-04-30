import React, { createContext, useContext, useState, useCallback, useEffect } from 'react';
import { useSocket } from './SocketContext';
import { userProgressService } from '../services/UserProgressService';
import { useUser } from './UserContext';

interface ProgressStats {
  questionSetId: string;
  completedQuestions: number;
  totalQuestions: number;
  correctAnswers: number;
  totalTimeSpent: number;
  averageTimeSpent: number;
  accuracy: number;
  lastAccessed: string;
}

interface UserProgressContextType {
  progressStats: Record<string, ProgressStats>;
  fetchUserProgress: (forceUpdate?: boolean) => Promise<Record<string, ProgressStats> | undefined>;
  updateProgressStats: (newStats: Record<string, ProgressStats>) => void;
  isLoading: boolean;
  error: string | null;
}

const UserProgressContext = createContext<UserProgressContextType | undefined>(undefined);

// 默认进度结构
const defaultProgress: ProgressStats = {
  questionSetId: '',
  completedQuestions: 0,
  totalQuestions: 0,
  correctAnswers: 0,
  totalTimeSpent: 0,
  averageTimeSpent: 0,
  accuracy: 0,
  lastAccessed: new Date(0).toISOString()
};

export const UserProgressProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const { user } = useUser();
  const { socket } = useSocket();
  const [progressStats, setProgressStats] = useState<Record<string, ProgressStats>>({});
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // 更新进度统计的通用方法
  const updateProgressStats = useCallback((newStats: Record<string, ProgressStats>) => {
    setProgressStats(prev => {
      // 确保每个进度记录都有完整的字段
      const processedStats = Object.entries(newStats).reduce((acc, [key, value]) => {
        acc[key] = {
          ...defaultProgress,
          ...value,
          questionSetId: key,
          lastAccessed: value.lastAccessed || defaultProgress.lastAccessed
        };
        return acc;
      }, {} as Record<string, ProgressStats>);

      return {
        ...prev,
        ...processedStats
      };
    });
  }, []);

  // 获取用户进度，支持强制更新
  const fetchUserProgress = useCallback(async (forceUpdate = true) => {
    if (!user) return;

    try {
      setIsLoading(true);
      setError(null);

      console.log("当前用户ID:", user.id); // 添加日志

      const response = await userProgressService.getUserProgress();
      if (response.success && response.data) {
        console.log("获取到的进度:", response.data); // 添加日志

        // 确保每个进度记录都有完整的字段
        const processedData = Object.entries(response.data).reduce((acc, [key, value]) => {
          acc[key] = {
            ...defaultProgress,
            ...value,
            questionSetId: key,
            lastAccessed: value.lastAccessed || defaultProgress.lastAccessed
          };
          return acc;
        }, {} as Record<string, ProgressStats>);

        if (forceUpdate) {
          updateProgressStats(processedData);
        }
        return processedData;
      }
    } catch (err) {
      console.error('获取用户进度失败:', err);
      setError('获取用户进度失败');
    } finally {
      setIsLoading(false);
    }
  }, [user, updateProgressStats]);

  // 监听用户ID变化，自动刷新进度
  useEffect(() => {
    if (user?.id) {
      console.log("用户ID变化，刷新进度:", user.id);
      fetchUserProgress(true);
    } else {
      // 用户登出时清空进度
      console.log("用户登出，清空进度");
      setProgressStats({});
    }
  }, [user?.id, fetchUserProgress]);

  // 监听进度更新事件
  useEffect(() => {
    if (!socket || !user) return;

    const handleProgressUpdate = (data: { userId: string }) => {
      if (data.userId === user.id) {
        fetchUserProgress(true);
      }
    };

    socket.on('progress:update', handleProgressUpdate);

    return () => {
      socket.off('progress:update', handleProgressUpdate);
    };
  }, [socket, user, fetchUserProgress]);

  return (
    <UserProgressContext.Provider value={{
      progressStats,
      fetchUserProgress,
      updateProgressStats,
      isLoading,
      error
    }}>
      {children}
    </UserProgressContext.Provider>
  );
};

export const useUserProgress = () => {
  const context = useContext(UserProgressContext);
  if (context === undefined) {
    throw new Error('useUserProgress must be used within a UserProgressProvider');
  }
  return context;
}; 