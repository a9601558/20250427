import React, { createContext, useContext, useState, useCallback, useEffect, useRef, ReactNode } from 'react';
import { useSocket } from './SocketContext';
import { userProgressService } from '../services/UserProgressService';
import { useUser } from './UserContext';
import apiClient from '../utils/api-client';

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
  progressStats: Record<string, any> | null;
  fetchUserProgress: () => Promise<void>;
  loading: boolean;
  error: string | null;
  resetError: () => void;
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

export const UserProgressProvider: React.FC<{ children: ReactNode }> = ({ children }) => {
  const { user, userChangeEvent } = useUser();
  const { socket } = useSocket();
  const [progressStats, setProgressStats] = useState<Record<string, any> | null>(null);
  const [loading, setLoading] = useState<boolean>(false);
  const [error, setError] = useState<string | null>(null);
  const [lastFetchTime, setLastFetchTime] = useState<number>(0);
  const [lastUserId, setLastUserId] = useState<string | null>(null);
  // 添加请求控制标志，防止重复请求
  const [isRequesting, setIsRequesting] = useState(false);
  // 添加请求计数器，用于调试
  const requestCountRef = useRef(0);
  
  // 添加缓存以减少API调用
  const progressCache = React.useRef<{
    data: Record<string, any> | null;
    timestamp: number;
  }>({
    data: null,
    timestamp: 0
  });
  
  // 检查是否应该重新获取数据
  const shouldRefetch = (userId: string): boolean => {
    const now = Date.now();
    // 如果距离上次获取超过30秒，则重新获取数据
    return now - lastFetchTime > 30000 || now - progressCache.current.timestamp > 30000;
  };
  
  // 添加全局引用用于调试
  if (process.env.NODE_ENV !== 'production') {
    (window as any).__UserProgressContext = {
      progressStats,
      user,
      lastUserId,
      reset: () => setProgressStats(null),
      requestCount: requestCountRef.current
    };
  }

  const resetError = () => setError(null);

  const fetchUserProgress = async (): Promise<void> => {
    if (!user || !user.id) return;
    
    // 如果不需要重新获取，使用缓存数据
    if (!shouldRefetch(user.id) && progressCache.current.data) {
      setProgressStats(progressCache.current.data);
      return;
    }
    
    setLoading(true);
    setLastFetchTime(Date.now());
    
    try {
      // 修改：首先尝试新的API端点
      let statsData = null;
      let errorMessage = null;
      
      // 尝试新的进度API端点
      try {
        const response = await apiClient.get(`/api/user-progress/stats/${user.id}`);
        if (response && response.success) {
          statsData = response.data;
        } else {
          errorMessage = response?.message || '获取用户进度统计失败';
          console.warn('首选API端点返回错误:', errorMessage);
        }
      } catch (err) {
        console.warn('首选API端点请求失败，尝试备用端点');
      }
      
      // 如果第一个端点失败，尝试备用端点
      if (!statsData) {
        try {
          const backupResponse = await apiClient.get(`/api/users/${user.id}/progress`);
          if (backupResponse && backupResponse.success) {
            statsData = backupResponse.data;
          } else {
            errorMessage = backupResponse?.message || '所有进度API端点都失败';
          }
        } catch (backupErr) {
          console.warn('备用API端点也失败');
          
          // 如果所有API调用都失败，生成默认空数据
          statsData = {
            completedQuestionSets: [],
            inProgressQuestionSets: [],
            totalQuestions: 0,
            totalCompleted: 0,
            lastActivity: null
          };
          errorMessage = '无法连接到进度服务，使用本地数据';
        }
      }
      
      if (statsData) {
        setProgressStats(statsData);
        // 更新缓存
        progressCache.current = {
          data: statsData,
          timestamp: Date.now()
        };
        // 清除错误
        setError(null);
      } else {
        // 设置错误但不阻止应用继续运行
        setError(errorMessage || '获取进度数据失败');
        console.error('获取用户进度失败:', errorMessage);
      }
    } catch (err) {
      console.error('获取用户进度时出错:', err);
      setError('获取进度数据时发生错误，但不影响测验功能');
      
      // 即使出错也设置一个空的进度数据以避免UI错误
      setProgressStats({
        completedQuestionSets: [],
        inProgressQuestionSets: [],
        totalQuestions: 0,
        totalCompleted: 0,
        lastActivity: null
      });
    } finally {
      setLoading(false);
    }
  };

  // 用户变化事件和用户ID变化二选一即可，这里合并成一个useEffect
  useEffect(() => {
    // 处理用户登出情况
    if (!user) {
      console.log("用户登出，清空进度");
      setProgressStats(null);
      setLastUserId(null);
      return;
    }

    // 处理用户切换情况
    if (user.id !== lastUserId) {
      console.log(`用户切换: ${lastUserId || 'none'} -> ${user.id}，重置进度`);
      
      // 先清空旧数据
      setProgressStats(null);
      setLastUserId(user.id);
      
      // 用setTimeout延迟请求，避免组件渲染期间的过多请求
      const timer = setTimeout(() => {
        if (!isRequesting) {
          console.log("拉取新用户进度:", user.id);
          fetchUserProgress().catch(err => {
            console.error("拉取新用户进度失败:", err);
          });
        }
      }, 300);
      
      return () => clearTimeout(timer);
    }
  }, [user, lastUserId, fetchUserProgress, isRequesting]);

  // 监听进度更新事件
  useEffect(() => {
    if (!socket || !user) return;

    const handleProgressUpdate = async (data: { userId: string }) => {
      if (data.userId === user.id && !isRequesting) {
        console.log("收到进度更新事件，刷新进度");
        try {
          await fetchUserProgress();
        } catch (err) {
          console.error("更新进度失败:", err);
        }
      }
    };

    socket.on('progress:update', handleProgressUpdate);

    return () => {
      socket.off('progress:update', handleProgressUpdate);
    };
  }, [socket, user, fetchUserProgress, isRequesting]);

  // 组件挂载时完成初始化 - 只在初始挂载时执行一次
  useEffect(() => {
    // 只有当组件挂载且用户存在且不在请求中时才执行
    if (user && !isRequesting) {
      console.log("组件挂载，初始化进度");
      const timer = setTimeout(() => {
        fetchUserProgress().catch(err => {
        console.error("初始化进度失败:", err);
      });
      }, 500);
      
      return () => clearTimeout(timer);
    }
  }, []); // 空依赖数组，确保只执行一次

  return (
    <UserProgressContext.Provider value={{ progressStats, fetchUserProgress, loading, error, resetError }}>
      {children}
    </UserProgressContext.Provider>
  );
};

export const useUserProgress = (): UserProgressContextType => {
  const context = useContext(UserProgressContext);
  if (context === undefined) {
    throw new Error('useUserProgress must be used within a UserProgressProvider');
  }
  return context;
}; 