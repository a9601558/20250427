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

// 从本地存储获取缓存的进度数据
const getLocalProgressData = (): Record<string, any> | null => {
  try {
    const cachedDataStr = localStorage.getItem('userProgressCache');
    if (!cachedDataStr) return null;
    
    const cachedData = JSON.parse(cachedDataStr);
    if (!cachedData.timestamp || Date.now() - cachedData.timestamp > 3600000) {
      // 缓存过期（1小时），返回null
      localStorage.removeItem('userProgressCache');
      return null;
    }
    
    return cachedData.data;
  } catch (e) {
    console.error('读取本地进度缓存失败:', e);
    return null;
  }
};

// 保存进度数据到本地存储
const saveLocalProgressData = (data: Record<string, any>): void => {
  try {
    const cacheData = {
      timestamp: Date.now(),
      data: data
    };
    localStorage.setItem('userProgressCache', JSON.stringify(cacheData));
  } catch (e) {
    console.error('保存进度数据到本地缓存失败:', e);
  }
};

// 解析进度数据并确保其格式正确
const parseProgressData = (data: any): Record<string, any> => {
  if (!data) return {};
  
  // 尝试读取不同格式的数据结构
  let result: Record<string, any> = {};
  
  // 第一种格式: 直接包含题库ID作为键的对象
  if (typeof data === 'object' && !Array.isArray(data)) {
    const keys = Object.keys(data).filter(key => 
      !['completedQuestionSets', 'inProgressQuestionSets', 'totalQuestions', 'totalCompleted', 'lastActivity'].includes(key)
    );
    
    if (keys.length > 0) {
      keys.forEach(key => {
        result[key] = processSingleProgressRecord(key, data[key]);
      });
      return result;
    }
  }
  
  // 第二种格式: 包含completedQuestionSets数组
  if (data.completedQuestionSets && Array.isArray(data.completedQuestionSets)) {
    data.completedQuestionSets.forEach((item: any) => {
      if (item && item.questionSetId) {
        result[item.questionSetId] = processSingleProgressRecord(item.questionSetId, item);
      }
    });
  }
  
  // 第三种格式: 包含inProgressQuestionSets数组
  if (data.inProgressQuestionSets && Array.isArray(data.inProgressQuestionSets)) {
    data.inProgressQuestionSets.forEach((item: any) => {
      if (item && item.questionSetId) {
        // 只在结果中不存在该键时才添加
        if (!result[item.questionSetId]) {
          result[item.questionSetId] = processSingleProgressRecord(item.questionSetId, item);
        }
      }
    });
  }
  
  return result;
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
  // 跟踪API端点尝试状态
  const apiEndpointStatus = useRef<{
    primary: boolean;
    backup: boolean;
    lastPrimaryFail: number;
    lastBackupFail: number;
  }>({
    primary: true,
    backup: true,
    lastPrimaryFail: 0,
    lastBackupFail: 0
  });
  
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
      requestCount: requestCountRef.current,
      apiStatus: apiEndpointStatus.current
    };
  }

  const resetError = () => setError(null);

  // 创建一个通用的API请求函数，支持多个备用端点
  const safeApiRequest = async (endpoints: string[]): Promise<[any, string | null]> => {
    for (let i = 0; i < endpoints.length; i++) {
      try {
        const response = await apiClient.get(endpoints[i]);
        if (response && response.success) {
          return [response.data, null];
        } else {
          console.warn(`API端点 ${endpoints[i]} 返回错误:`, response?.message);
        }
      } catch (err) {
        console.warn(`API端点 ${endpoints[i]} 请求失败:`, err);
      }
    }
    return [null, "所有API端点请求失败"];
  };

  const fetchUserProgress = async (): Promise<void> => {
    if (!user || !user.id) return;
    
    // 如果不需要重新获取，使用缓存数据
    if (!shouldRefetch(user.id) && progressCache.current.data) {
      setProgressStats(progressCache.current.data);
      return;
    }

    // 如果已经在请求中，避免重复请求
    if (isRequesting) {
      console.log("已有请求进行中，跳过");
      return;
    }
    
    setIsRequesting(true);
    setLoading(true);
    setLastFetchTime(Date.now());
    
    try {
      // 初始化数据和错误消息
      let statsData = null;
      let errorMessage = null;
      
      // 准备尝试的API端点列表
      const now = Date.now();
      const endpoints = [];
      
      // 动态确定要请求的端点顺序
      if (apiEndpointStatus.current.primary && (now - apiEndpointStatus.current.lastPrimaryFail > 300000)) {
        endpoints.push(`/api/user-progress/stats/${user.id}`);
      }
      
      if (apiEndpointStatus.current.backup && (now - apiEndpointStatus.current.lastBackupFail > 300000)) {
        endpoints.push(`/api/users/${user.id}/progress`);
      }
      
      // 再添加一个可能的备用端点
      endpoints.push(`/api/users/progress/${user.id}`);
      
      // 尝试本地缓存 - 优先使用缓存，即使API请求也会进行
      const localData = getLocalProgressData();
      if (localData) {
        console.log("从本地缓存加载用户进度");
        // 继续发送API请求，但先渲染本地数据
        const parsedLocalData = parseProgressData(localData);
        setProgressStats(parsedLocalData);
        // 更新内存缓存
        progressCache.current = {
          data: parsedLocalData,
          timestamp: now - 15000 // 设置为略旧，这样API结果返回时会更新
        };
      }
      
      // 执行API请求
      if (endpoints.length > 0) {
        const [data, error] = await safeApiRequest(endpoints);
        
        if (data) {
          // 处理数据成正确的格式
          statsData = parseProgressData(data);
          
          setProgressStats(statsData);
          // 更新缓存
          progressCache.current = {
            data: statsData,
            timestamp: Date.now()
          };
          // 保存到本地存储
          saveLocalProgressData(data);
          // 清除错误
          setError(null);
          
          // 更新API端点状态 - 成功
          apiEndpointStatus.current = {
            ...apiEndpointStatus.current,
            primary: true,
            backup: true
          };
        } else {
          errorMessage = error || '获取进度数据失败';
          
          // 如果API失败但有本地数据，继续使用本地数据
          if (localData) {
            // 不设置错误，因为我们有本地数据可用
            console.warn('API请求失败，但使用了本地缓存数据:', errorMessage);
          } else {
            // 设置一个非阻断性错误提示
            setError('获取进度数据时出现问题，但不影响测验功能');
            console.error('获取用户进度失败且无本地缓存:', errorMessage);
            
            // 仍提供空数据以避免UI错误
            const emptyData = {};
            setProgressStats(emptyData);
          }
          
          // 更新API端点状态 - 失败
          apiEndpointStatus.current = {
            ...apiEndpointStatus.current,
            lastPrimaryFail: Date.now(),
            lastBackupFail: Date.now()
          };
        }
      } else {
        console.warn('所有API端点暂时不可用，仅使用本地数据');
        
        if (!localData) {
          // 仍提供空数据以避免UI错误
          setProgressStats({});
          setError('暂时无法连接到服务器');
        }
      }
    } catch (err) {
      console.error('获取用户进度时出错:', err);
      setError('获取进度数据时发生错误，但不影响测验功能');
      
      // 即使出错也设置一个空的进度数据以避免UI错误
      setProgressStats({});
    } finally {
      setLoading(false);
      setIsRequesting(false);
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