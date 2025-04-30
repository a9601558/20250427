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

export const UserProgressProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const { user } = useUser();
  const { socket } = useSocket();
  const [progressStats, setProgressStats] = useState<Record<string, ProgressStats>>({});
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // 更新进度统计的通用方法
  const updateProgressStats = useCallback((newStats: Record<string, ProgressStats>) => {
    setProgressStats(prev => ({
      ...prev,
      ...newStats
    }));
  }, []);

  // 获取用户进度，支持强制更新
  const fetchUserProgress = useCallback(async (forceUpdate = true) => {
    if (!user) return;

    try {
      setIsLoading(true);
      setError(null);

      const response = await userProgressService.getUserProgress();
      if (response.success && response.data) {
        if (forceUpdate) {
          updateProgressStats(response.data);
        }
        return response.data;
      }
    } catch (err) {
      console.error('获取用户进度失败:', err);
      setError('获取用户进度失败');
    } finally {
      setIsLoading(false);
    }
  }, [user, updateProgressStats]);

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

  // 初始加载进度
  useEffect(() => {
    fetchUserProgress(true);
  }, [fetchUserProgress]);

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