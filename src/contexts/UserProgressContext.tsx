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

/**
 * 确保对象具有有效的 lastAccessed 属性
 */
const ensureValidLastAccessed = (obj: any): string => {
  if (!obj) return new Date(0).toISOString();
  
  try {
    // 如果存在有效的 lastAccessed 属性，直接返回
    if (obj.lastAccessed && !isNaN(new Date(obj.lastAccessed).getTime())) {
      return obj.lastAccessed;
    }
    
    // 尝试使用 updatedAt 或其他属性
    if (obj.updatedAt && !isNaN(new Date(obj.updatedAt).getTime())) {
      return new Date(obj.updatedAt).toISOString();
    }
    
    // 都不存在时返回当前时间
    return new Date().toISOString();
  } catch (error) {
    console.error('处理 lastAccessed 时出错:', error);
    return new Date().toISOString();
  }
};

/**
 * 安全地处理一个进度记录，确保所有必要的字段都存在
 */
const processSingleProgressRecord = (key: string, value: any): ProgressStats => {
  if (!value) {
    return {
      ...defaultProgress,
      questionSetId: key
    };
  }
  
  return {
    ...defaultProgress,
    ...value,
    questionSetId: key,
    completedQuestions: value.completedQuestions || 0,
    totalQuestions: value.totalQuestions || 0,
    correctAnswers: value.correctAnswers || 0,
    totalTimeSpent: value.totalTimeSpent || 0,
    averageTimeSpent: value.averageTimeSpent || 0,
    accuracy: value.accuracy || 0,
    lastAccessed: ensureValidLastAccessed(value)
  };
};

export const UserProgressProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const { user, userChangeEvent } = useUser();
  const { socket } = useSocket();
  const [progressStats, setProgressStats] = useState<Record<string, ProgressStats>>({});
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [lastUserId, setLastUserId] = useState<string | null>(null);

  // 添加全局引用用于调试
  if (process.env.NODE_ENV !== 'production') {
    (window as any).__UserProgressContext = {
      progressStats,
      user,
      lastUserId,
      reset: () => setProgressStats({})
    };
  }

  // 更新进度统计的通用方法
  const updateProgressStats = useCallback((newStats: Record<string, ProgressStats>) => {
    // 不合并旧状态，而是完全替换，防止旧用户数据残留
    setProgressStats(() => {
      const processedStats = Object.entries(newStats).reduce((acc, [key, value]) => {
        acc[key] = {
          questionSetId: key,
          completedQuestions: value.completedQuestions || 0,
          totalQuestions: value.totalQuestions || 0,
          correctAnswers: value.correctAnswers || 0,
          totalTimeSpent: value.totalTimeSpent || 0,
          averageTimeSpent: value.averageTimeSpent || 0,
          accuracy: value.accuracy || 0,
          lastAccessed: value.lastAccessed || new Date(0).toISOString()
        };
        return acc;
      }, {} as Record<string, ProgressStats>);
      return processedStats;
    });
  }, []);

  // 获取用户进度，支持强制更新
  const fetchUserProgress = useCallback(async (forceUpdate = true) => {
    if (!user) {
      console.log('用户未登录，无法获取进度');
      return;
    }

    try {
      setIsLoading(true);
      setError(null);

      console.log("当前用户ID:", user.id);

      const response = await userProgressService.getUserProgress();
      if (response.success && response.data) {
        console.log("获取到的进度:", response.data);

        // 确保每个进度记录都有完整的字段
        const processedData = Object.entries(response.data).reduce((acc, [key, value]) => {
          acc[key] = {
            ...defaultProgress,
            ...value,
            questionSetId: key,
            lastAccessed: value.lastAccessed || new Date(0).toISOString()
          };
          return acc;
        }, {} as Record<string, ProgressStats>);

        // 始终完全替换状态，不合并旧数据
        console.log('更新进度统计:', processedData);
        setProgressStats(processedData);
        return processedData;
      } else {
        console.warn('获取进度响应失败:', response);
        return {};
      }
    } catch (err) {
      console.error('获取用户进度失败:', err);
      setError('获取用户进度失败');
      return {};
    } finally {
      setIsLoading(false);
    }
  }, [user]);

  // 监听用户变化事件，确保在用户切换时重置进度
  useEffect(() => {
    console.log("用户变化事件:", userChangeEvent);
    
    // 如果是用户登出
    if (!userChangeEvent.userId) {
      console.log("用户登出，清空进度");
      setProgressStats({});
      setLastUserId(null);
      return;
    }
    
    // 如果是用户登录或切换
    if (userChangeEvent.userId !== lastUserId) {
      console.log(`用户切换: ${lastUserId || 'none'} -> ${userChangeEvent.userId}，重置进度`);
      // 先清空旧数据
      setProgressStats({});
      setLastUserId(userChangeEvent.userId);
      
      // 然后获取新数据
      if (userChangeEvent.userId) {
        console.log("拉取新用户进度:", userChangeEvent.userId);
        fetchUserProgress(true).catch(err => {
          console.error("拉取新用户进度失败:", err);
        });
      }
    }
  }, [userChangeEvent, fetchUserProgress, lastUserId]);

  // 保留原有的用户ID监听，作为额外保障
  useEffect(() => {
    if (user?.id) {
      console.log("用户ID变化，刷新进度:", user.id);
      
      // 检查是否是不同用户，如果是则先清空状态
      if (lastUserId !== user.id) {
        console.log("用户ID与上次不同，先清空进度");
        setProgressStats({});
        setLastUserId(user.id);
      }
      
      fetchUserProgress(true).catch(err => {
        console.error("自动刷新进度失败:", err);
      });
    } else {
      // 用户登出时清空进度
      console.log("用户登出，清空进度");
      setProgressStats({});
      setLastUserId(null);
    }
  }, [user?.id, fetchUserProgress, lastUserId]);

  // 监听进度更新事件
  useEffect(() => {
    if (!socket || !user) return;

    const handleProgressUpdate = async (data: { userId: string }) => {
      if (data.userId === user.id) {
        console.log("收到进度更新事件，刷新进度");
        try {
          await fetchUserProgress(true);
        } catch (err) {
          console.error("更新进度失败:", err);
        }
      }
    };

    socket.on('progress:update', handleProgressUpdate);

    return () => {
      socket.off('progress:update', handleProgressUpdate);
    };
  }, [socket, user, fetchUserProgress]);

  // 组件挂载时完成初始化
  useEffect(() => {
    if (user) {
      fetchUserProgress(true).catch(err => {
        console.error("初始化进度失败:", err);
      });
    }
  }, []);

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