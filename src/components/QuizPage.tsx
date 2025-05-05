import React, { useState, useEffect, useRef, useCallback } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import QuestionCard from './QuestionCard';
import { useUser } from '../contexts/UserContext';
import apiClient from '../utils/api-client';
import { useUserProgress } from '../contexts/UserProgressContext';
import QuizCompletionSummary from './quiz/QuizCompletionSummary';
import { Question, Option, QuestionSet } from '../types';
import { AnsweredQuestion } from '../hooks/useQuizReducer';

// 添加题目数据相关的类型定义
interface ExtractedQuestion {
  id: string;
  text: string;
  questionType: string;
  explanation: string;
  options: any[];
  [key: string]: any;
}

// 定义QuizCompletionSummary真实Props接口
interface QuizCompletionSummaryProps {
  questionSet: {
    title: string;
    id: string;
    isPaid: boolean;
  };
  correctAnswers: number;
  totalQuestions: number;
  answeredQuestions: AnsweredQuestion[];
  questions: Question[];
  timeSpent: number;
  onRestart: () => void;
  onNavigateHome: () => void;
  hasAccess?: boolean;
}

// 为测验结果定义明确的类型接口
interface QuizResults {
  totalCorrect: number;
  totalQuestions: number;
  accuracyPercentage: number;
  questionResults: QuestionResult[];
}

interface QuestionResult {
  questionId: string;
  isCorrect: boolean;
  userSelectedOptionIds: string[];
  correctOptionIds: string[];
}

// 本地存储键名
const LOCAL_STORAGE_KEYS = {
  QUIZ_PROGRESS: 'quizProgress',
  QUIZ_ANSWERS: 'quizAnswers',
  QUIZ_START_TIME: 'quizStartTime',
  QUESTION_SET_CACHE: 'questionSetCache' // 新增缓存键
};

// 将QuizResults转换为QuizCompletionSummary所需的数据结构
function convertResultsToSummaryProps(results: QuizResults, questionSet: QuestionSet, questions: Question[], timeSpent: number, hasAccess: boolean, onRestart: () => void, onNavigateHome: () => void): QuizCompletionSummaryProps {
  const answeredQuestions: AnsweredQuestion[] = results.questionResults.map((result, index) => ({
    index: index,
    questionIndex: index,
    isCorrect: result.isCorrect,
    selectedOption: result.userSelectedOptionIds
  }));
  
  return {
    questionSet: {
      title: questionSet.title,
      id: questionSet.id,
      isPaid: questionSet.isPaid
    },
    correctAnswers: results.totalCorrect,
    totalQuestions: results.totalQuestions,
    answeredQuestions,
    questions,
    timeSpent,
    onRestart,
    onNavigateHome,
    hasAccess
  };
}

const QuizPage: React.FC = () => {
  const { questionSetId } = useParams<{ questionSetId: string }>();
  const navigate = useNavigate();
  const { user } = useUser();
  const { progressStats, fetchUserProgress, loading: progressLoading, error: progressError } = useUserProgress();
  
  const [questionSet, setQuestionSet] = useState<QuestionSet | null>(null);
  const [currentQuestionIndex, setCurrentQuestionIndex] = useState(0);
  const [userAnswers, setUserAnswers] = useState<Record<string, string[]>>({});
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [quizCompleted, setQuizCompleted] = useState(false);
  const [startTime, setStartTime] = useState<Date | null>(null);
  const [hasAccess, setHasAccess] = useState(false);
  const [timeSpent, setTimeSpent] = useState<number>(0);
  
  // 新增数据加载状态标记
  const dataLoadedRef = useRef<boolean>(false);
  
  // 使用useRef创建一个标志，以避免在组件卸载后更新状态
  const isMounted = useRef(true);
  // 用于取消请求的AbortController
  const abortControllerRef = useRef<AbortController | null>(null);
  
  // 增加一个状态标记是否已尝试加载进度
  const [progressAttempted, setProgressAttempted] = useState(false);
  
  // 从本地存储读取缓存的题库数据
  const getQuestionSetFromCache = useCallback((qsId: string) => {
    try {
      const cacheKey = `${LOCAL_STORAGE_KEYS.QUESTION_SET_CACHE}_${qsId}`;
      const cachedDataStr = localStorage.getItem(cacheKey);
      if (!cachedDataStr) return null;
      
      const cachedData = JSON.parse(cachedDataStr);
      // 检查缓存是否过期（30分钟）
      const cacheTime = new Date(cachedData.timestamp || 0);
      const now = new Date();
      const cacheAgeMinutes = (now.getTime() - cacheTime.getTime()) / (1000 * 60);
      
      if (cacheAgeMinutes > 30) {
        // 缓存过期，删除
        localStorage.removeItem(cacheKey);
        return null;
      }
      
      console.log(`从缓存加载题库数据，包含 ${cachedData.data.questions?.length || 0} 个题目`);
      return cachedData.data;
    } catch (e) {
      console.error('读取缓存题库数据失败:', e);
      return null;
    }
  }, []);
  
  // 将题库数据保存到缓存
  const saveQuestionSetToCache = useCallback((qsId: string, data: any) => {
    try {
      const cacheKey = `${LOCAL_STORAGE_KEYS.QUESTION_SET_CACHE}_${qsId}`;
      const cacheData = {
        timestamp: new Date().toISOString(),
        data: data
      };
      localStorage.setItem(cacheKey, JSON.stringify(cacheData));
    } catch (e) {
      console.error('保存题库数据到缓存失败:', e);
    }
  }, []);
  
  // 保存进度到localStorage的辅助函数
  const saveProgressToLocalStorage = useCallback(() => {
    if (!questionSetId || !questionSet) return;
    
    const progressData = {
      questionSetId,
      currentQuestionIndex,
      userAnswers,
      startTime: startTime ? startTime.toISOString() : null,
      lastSaved: new Date().toISOString()
    };
    
    try {
      localStorage.setItem(
        `${LOCAL_STORAGE_KEYS.QUIZ_PROGRESS}_${questionSetId}`,
        JSON.stringify(progressData)
      );
      console.log('进度已保存到本地存储');
    } catch (e) {
      console.error('保存进度到本地存储失败:', e);
    }
  }, [questionSetId, questionSet, currentQuestionIndex, userAnswers, startTime]);
  
  // 恢复保存的进度
  const restoreProgress = useCallback(() => {
    if (!questionSetId) return false;
    
    try {
      const savedProgressStr = localStorage.getItem(`${LOCAL_STORAGE_KEYS.QUIZ_PROGRESS}_${questionSetId}`);
      if (!savedProgressStr) return false;
      
      const savedProgress = JSON.parse(savedProgressStr);
      
      // 验证保存的数据与当前题库匹配
      if (savedProgress.questionSetId === questionSetId) {
        setCurrentQuestionIndex(savedProgress.currentQuestionIndex || 0);
        setUserAnswers(savedProgress.userAnswers || {});
        setStartTime(savedProgress.startTime ? new Date(savedProgress.startTime) : new Date());
        
        console.log('已恢复上次的测验进度');
        return true;
      }
    } catch (e) {
      console.error('恢复保存的进度失败:', e);
    }
    
    return false;
  }, [questionSetId]);
  
  // 清理组件和AbortController
  useEffect(() => {
    return () => {
      isMounted.current = false;
      if (abortControllerRef.current) {
        abortControllerRef.current.abort();
      }
    };
  }, []);
  
  // 创建新的AbortController
  const createAbortController = useCallback(() => {
    if (abortControllerRef.current) {
      abortControllerRef.current.abort();
    }
    
    abortControllerRef.current = new AbortController();
    return abortControllerRef.current.signal;
  }, []);
  
  // 更新已用时间
  useEffect(() => {
    if (!startTime || quizCompleted) return;
    
    const updateTimeSpent = () => {
      const now = new Date();
      const elapsed = Math.floor((now.getTime() - startTime.getTime()) / 1000);
      setTimeSpent(elapsed);
    };
    
    // 每秒更新时间
    const interval = setInterval(updateTimeSpent, 1000);
    
    return () => clearInterval(interval);
  }, [startTime, quizCompleted]);
  
  // 先检查用户是否有权限访问题库
  useEffect(() => {
    // 如果已经加载过数据，不再重复加载
    if (dataLoadedRef.current) {
      return;
    }
    
    const checkAccess = async () => {
      if (!questionSetId) {
        if (isMounted.current) {
          setError('题库ID无效');
          setLoading(false);
        }
        return;
      }
      
      // 尝试从缓存获取数据
      const cachedData = getQuestionSetFromCache(questionSetId);
      if (cachedData) {
        if (isMounted.current) {
          setQuestionSet(cachedData);
          setHasAccess(true);
          dataLoadedRef.current = true;
          setLoading(false);
          
          // 设置开始时间
          const newStartTime = new Date();
          setStartTime(newStartTime);
          
          // 尝试恢复保存的进度
          const restored = restoreProgress();
          
          // 如果没有恢复成功，则自动保存当前状态
          if (!restored) {
            saveProgressToLocalStorage();
          }
        }
        return;
      }
      
      try {
        const signal = createAbortController();
        
        // 修改: 直接获取题库数据，不再调用不存在的access-check端点
        const response = await apiClient.get(`/api/question-sets/${questionSetId}`, undefined, { signal });
        
        // 原始JSON字符串，用于诊断数据结构
        console.log('原始API响应:', JSON.stringify(response?.data).substring(0, 500) + '...');
        
        // 查找可能的题目数据来源
        const findQuestionsInResponse = (data: any) => {
          if (!data) return null;
          
          // 记录所有可能包含题目的字段
          const potentialQuestionFields: Array<{
            field: string;
            count: number;
            sample: any;
          }> = [];
          
          // 直接检查questions字段
          if (data.questions && Array.isArray(data.questions) && data.questions.length > 0) {
            potentialQuestionFields.push({
              field: 'questions',
              count: data.questions.length,
              sample: data.questions[0]
            });
          }
          
          // 检查questionSetQuestions字段(ORM关联名称可能不同)
          if (data.questionSetQuestions && Array.isArray(data.questionSetQuestions) && data.questionSetQuestions.length > 0) {
            potentialQuestionFields.push({
              field: 'questionSetQuestions',
              count: data.questionSetQuestions.length,
              sample: data.questionSetQuestions[0]
            });
          }
          
          // 检查其他可能包含"question"关键字的字段
          Object.keys(data).forEach(key => {
            if (key.toLowerCase().includes('question') && 
                key !== 'questions' && 
                key !== 'questionSetQuestions' &&
                Array.isArray(data[key]) && 
                data[key].length > 0) {
              potentialQuestionFields.push({
                field: key,
                count: data[key].length,
                sample: data[key][0]
              });
            }
          });
          
          return potentialQuestionFields;
        };
        
        const potentialQuestions = findQuestionsInResponse(response?.data);
        console.log('可能的题目数据来源:', potentialQuestions);
        
        if (isMounted.current) {
          if (response && response.success && response.data) {
            // 保存原始数据，用于调试
            const originalData = { ...response.data };
            
            // 检查是否有替代的题目数据来源
            if (potentialQuestions && potentialQuestions.length > 0) {
              // 使用第一个找到的题目数据源
              const alternativeSource = potentialQuestions[0];
              console.log(`使用替代题目来源: ${alternativeSource.field}，包含 ${alternativeSource.count} 个题目`);
              
              // 将替代数据源复制到标准questions字段
              response.data.questions = response.data[alternativeSource.field];
            }
            
            // 检查题库是否实际包含题目
            const hasStandardQuestions = response.data.questions && 
                                Array.isArray(response.data.questions) && 
                                response.data.questions.length > 0;
                                
            // 如果没有找到任何题目，尝试从嵌套结构中提取
            if (!hasStandardQuestions && response.data.questionSetQuestions) {
              // 尝试将questionSetQuestions转换为标准questions格式
              try {
                const extractedQuestions: ExtractedQuestion[] = [];
                // 收集所有嵌套的题目
                if (Array.isArray(response.data.questionSetQuestions)) {
                  response.data.questionSetQuestions.forEach((item: any) => {
                    if (item && typeof item === 'object') {
                      // 复制必要的字段
                      const question: ExtractedQuestion = {
                        id: item.id,
                        text: item.text,
                        questionType: item.questionType,
                        explanation: item.explanation,
                        options: []
                      };
                      
                      // 如果有选项，添加选项
                      if (item.options && Array.isArray(item.options)) {
                        question.options = item.options;
                      }
                      
                      extractedQuestions.push(question);
                    }
                  });
                }
                
                if (extractedQuestions.length > 0) {
                  console.log(`从嵌套结构提取了 ${extractedQuestions.length} 个题目`);
                  response.data.questions = extractedQuestions;
                }
              } catch (err) {
                console.error('提取题目时出错:', err);
              }
            }
            
            // 再次检查是否有题目
            const hasQuestions = response.data.questions && 
                               Array.isArray(response.data.questions) && 
                               response.data.questions.length > 0;
            
            // 直接保存题库数据
            setQuestionSet(response.data);
            
            // 强制授予权限，跳过权限检查
            setHasAccess(true);
            
            // 标记数据已加载，防止重复请求
            dataLoadedRef.current = true;
            
            // 保存到缓存以减少API调用
            saveQuestionSetToCache(questionSetId, response.data);
            
            // 设置开始时间
            const newStartTime = new Date();
            setStartTime(newStartTime);
            
            // 关键逻辑：检查题库是否为空
            if (!hasQuestions) {
              console.error('无法找到任何有效题目数据:', {
                id: response.data.id,
                title: response.data.title,
                originalStructure: Object.keys(originalData).join(',')
              });
              
              // 加载完成但显示明确的空题库错误，而不是权限错误
              setError('此题库的题目数据格式异常，无法正常显示。请联系管理员检查题库数据结构。');
              setLoading(false);
              return;
            }
            
            console.log('题库加载成功，共包含题目：', response.data.questions.length);
            
            // 尝试恢复保存的进度
            const restored = restoreProgress();
            
            // 如果没有恢复成功，则自动保存当前状态
            if (!restored) {
              saveProgressToLocalStorage();
            }
          } else {
            const errorMsg = response?.message || '无法加载题库数据';
            console.error('加载题库失败:', {
              error: errorMsg,
              response: response
            });
            setError(errorMsg);
          }
          
          setLoading(false);
        }
      } catch (err) {
        if (err instanceof Error && err.name !== 'AbortError' && isMounted.current) {
          console.error('加载题库失败:', err);
          setError('加载题库失败，请稍后重试');
          setLoading(false);
        }
      }
    };
    
    checkAccess();
  }, [questionSetId, user, createAbortController, restoreProgress, saveProgressToLocalStorage, getQuestionSetFromCache, saveQuestionSetToCache]);
  
  // 定期自动保存进度
  useEffect(() => {
    if (!questionSet || !questionSetId || quizCompleted) return;
    
    // 每30秒自动保存一次
    const saveInterval = setInterval(() => {
      saveProgressToLocalStorage();
    }, 30000);
    
    return () => {
      clearInterval(saveInterval);
    };
  }, [questionSet, questionSetId, quizCompleted, saveProgressToLocalStorage]);
  
  // 处理答案选择
  const handleAnswerSelect = (questionId: string, selectedOptionIds: string[]) => {
    setUserAnswers(prev => {
      const updated = {
        ...prev,
        [questionId]: selectedOptionIds
      };
      
      // 每当用户选择答案时保存进度
      setTimeout(() => saveProgressToLocalStorage(), 0);
      
      return updated;
    });
  };
  
  // 处理答案提交 - 新增处理QuestionCard的回调
  const handleAnswerSubmitted = (isCorrect: boolean, selectedOption: string | string[]) => {
    console.log(`答案提交: 正确=${isCorrect}, 所选=${Array.isArray(selectedOption) ? selectedOption.join(',') : selectedOption}`);
    // 可以在这里增加额外逻辑，比如即时统计或显示下一题提示
  };
  
  // 移动到下一题
  const handleNextQuestion = () => {
    if (!questionSet || !questionSet.questions) return;
    
    const totalQuestions = questionSet.questions.length;
    
    if (currentQuestionIndex < totalQuestions - 1) {
      setCurrentQuestionIndex(prev => {
        const nextIndex = prev + 1;
        // 切换题目时保存进度
        setTimeout(() => saveProgressToLocalStorage(), 0);
        return nextIndex;
      });
    } else {
      // 完成所有题目，结束测验
      completeQuiz();
    }
  };
  
  // 移动到上一题
  const handlePreviousQuestion = () => {
    if (currentQuestionIndex > 0) {
      setCurrentQuestionIndex(prev => {
        const nextIndex = prev - 1;
        // 切换题目时保存进度
        setTimeout(() => saveProgressToLocalStorage(), 0);
        return nextIndex;
      });
    }
  };
  
  // 添加安全的进度获取函数
  const fetchProgressSafely = useCallback(async () => {
    try {
      if (fetchUserProgress) {
        // 标记尝试获取进度以防止无限循环
        setProgressAttempted(true);
        // 等待结果
        await fetchUserProgress();
      }
    } catch (err) {
      console.warn('获取用户进度失败，但不会阻止答题功能:', err);
      setProgressAttempted(true);
    }
  }, [fetchUserProgress]);
  
  // 修改用户进度相关的useEffect
  useEffect(() => {
    // 只有在用户已登录且有问题集ID时尝试获取进度
    // 并且最多只尝试一次以防止无限循环
    if (user && questionSetId && !progressAttempted) {
      // 使用setTimeout避免在组件渲染期间立即触发
      const timer = setTimeout(() => {
        console.log('安全获取用户进度');
        fetchProgressSafely();
      }, 500);
      
      return () => clearTimeout(timer);
    }
  }, [user, questionSetId, progressAttempted, fetchProgressSafely]);
  
  // 修改完成测验逻辑，增加错误处理和备用提交方式
  const completeQuiz = async () => {
    if (!questionSet || !questionSet.questions || !user) return;
    
    const endTime = new Date();
    const totalTime = startTime ? Math.floor((endTime.getTime() - startTime.getTime()) / 1000) : 0;
    setTimeSpent(totalTime);
    
    // 计算正确率
    const results = calculateResults();
    
    // 先完成前端UI状态更新，防止API错误影响用户体验
    setQuizCompleted(true);
    
    // 清除本地存储的进度
    localStorage.removeItem(`${LOCAL_STORAGE_KEYS.QUIZ_PROGRESS}_${questionSetId}`);
    
    // 创建提交数据 - 确保同时支持驼峰式和下划线式的命名，增强后端兼容性
    const payload = {
      // 核心字段（驼峰命名）
      userId: user.id,
      questionSetId,
      completedQuestions: questionSet.questions.length,
      correctAnswers: results.totalCorrect,
      timeSpent: totalTime,
      lastCompletedAt: new Date().toISOString(),
      
      // 备用字段（下划线命名）- 兼容不同的后端API版本
      question_set_id: questionSetId, 
      user_id: user.id,
      total_questions: questionSet.questions.length,
      correct_count: results.totalCorrect,
      time_spent: totalTime,
      completion_date: new Date().toISOString(),
      
      // 添加额外的字段以增强兼容性
      progress: 100, // 假设已完成
      score: results.totalCorrect,
      accuracy: results.accuracyPercentage,
      quizId: questionSetId,
      testId: questionSetId,
      
      // 详细答题记录 - 提供两种格式的字段名称
      answerDetails: results.questionResults.map(result => ({
        questionId: result.questionId,
        question_id: result.questionId, // 下划线格式的备用字段
        isCorrect: result.isCorrect,
        is_correct: result.isCorrect, // 下划线格式的备用字段
        selectedOptionIds: result.userSelectedOptionIds,
        selected_option_ids: result.userSelectedOptionIds, // 下划线格式的备用字段
        correctOptionIds: result.correctOptionIds,
        correct_option_ids: result.correctOptionIds // 下划线格式的备用字段
      }))
    };
    
    console.log('提交测验结果数据:', payload);
    
    // 本地存储一份结果数据作为额外备份
    try {
      const quizResultsKey = `quizResults_${questionSetId}_${user.id}`;
      localStorage.setItem(quizResultsKey, JSON.stringify({
        results,
        timeSpent,
        completedAt: new Date().toISOString()
      }));
    } catch (err) {
      console.error('保存结果到本地存储失败:', err);
    }
    
    // 提交进度数据 - 在后台进行，不等待结果
    // 这样即使API失败，用户体验也不会受影响
    if (isMounted.current) {
      setTimeout(async () => {
        try {
          const signal = createAbortController();
          
          // 注册认证错误监听器，用于重试逻辑
          const handleAuthRefresh = (event: Event) => {
            const customEvent = event as CustomEvent;
            
            if (customEvent.detail?.success) {
              console.log('认证令牌已刷新，尝试重新提交测验结果');
              
              // 延迟一秒，确保令牌已更新到axios默认头部
              setTimeout(async () => {
                try {
                  await apiClient.post('/api/user-progress/update', payload, { signal });
                  console.log('认证刷新后重新提交成功');
                } catch (retryErr) {
                  console.error('认证刷新后重新提交仍然失败:', retryErr);
                }
              }, 1000);
            }
          };
          
          // 添加认证刷新事件监听器
          window.addEventListener('auth:tokenRefreshed', handleAuthRefresh);
          
          try {
            const response = await apiClient.post(
              '/api/user-progress/update',
              payload,
              { signal }
            );
            
            if (isMounted.current) {
              // 清除事件监听器
              window.removeEventListener('auth:tokenRefreshed', handleAuthRefresh);
              
              if (response && response.success) {
                console.log('测验结果已保存');
                // 安全获取用户进度
                try {
                  await fetchProgressSafely();
                } catch (progressErr) {
                  console.warn('刷新进度失败，但不影响结果展示', progressErr);
                }
              } else {
                console.error('保存测验结果失败:', response?.message);
                // 失败时尝试备用端点
                throw new Error(response?.message || '保存失败');
              }
            }
          } catch (err) {
            // 清除事件监听器
            window.removeEventListener('auth:tokenRefreshed', handleAuthRefresh);
            
            // 尝试使用备用端点
            if (!isMounted.current) return;
            
            try {
              console.log('尝试备用进度更新端点...');
              const backupResponse = await apiClient.post(
                '/api/quiz/submit',
                payload,
                { signal }
              );
              
              if (isMounted.current && backupResponse && backupResponse.success) {
                console.log('测验结果已通过备用端点保存');
              } else if (isMounted.current) {
                console.warn('备用提交也失败:', backupResponse?.message);
                // 即使失败也存储到本地以备后续恢复
                try {
                  // 尝试使用第三个通用端点
                  console.log('尝试通用提交端点...');
                  const genericResponse = await apiClient.post(
                    '/api/submissions',
                    payload,
                    { signal }
                  );
                  
                  if (genericResponse && genericResponse.success) {
                    console.log('测验结果已通过通用端点保存');
                    return;
                  }
                } catch (genericError) {
                  console.warn('通用端点提交失败:', genericError);
                }
                
                try {
                  const localResults = localStorage.getItem('pendingQuizResults') || '[]';
                  const pendingResults = JSON.parse(localResults);
                  pendingResults.push({
                    ...payload,
                    timestamp: Date.now()
                  });
                  localStorage.setItem('pendingQuizResults', JSON.stringify(pendingResults));
                  console.log('测验结果已保存到本地，等待后续恢复');
                } catch (localErr) {
                  console.error('本地存储测验结果失败:', localErr);
                }
              }
            } catch (backupErr) {
              if (!isMounted.current) return;
              console.error('备用端点也失败:', backupErr);
              
              // 保存到本地存储以便后续恢复
              try {
                const localResults = localStorage.getItem('pendingQuizResults') || '[]';
                const pendingResults = JSON.parse(localResults);
                pendingResults.push({
                  ...payload,
                  timestamp: Date.now()
                });
                localStorage.setItem('pendingQuizResults', JSON.stringify(pendingResults));
                console.log('测验结果已保存到本地，等待后续恢复');
              } catch (localErr) {
                console.error('本地存储测验结果失败:', localErr);
              }
            }
          }
        } catch (err) {
          if (err instanceof Error && err.name !== 'AbortError' && isMounted.current) {
            console.error('保存测验结果时出错:', err);
          }
        }
      }, 0);
    }
  };
  
  // 计算测验结果 - 修复类型比较问题
  const calculateResults = (): QuizResults => {
    if (!questionSet || !questionSet.questions) {
      return { totalCorrect: 0, totalQuestions: 0, accuracyPercentage: 0, questionResults: [] };
    }
    
    let totalCorrect = 0;
    const questionResults = questionSet.questions.map(question => {
      // 确保所有ID都是字符串类型
      const userSelectedOptionIds = (userAnswers[question.id] || []).map(id => String(id));
      const correctOptionIds = question.options
        .filter(option => option.isCorrect)
        .map(option => String(option.id));
      
      // 使用Set进行集合比较，确保顺序无关
      const userSelectedSet = new Set(userSelectedOptionIds);
      const correctSet = new Set(correctOptionIds);
      
      // 多选题的正确判断: 用户选择的选项集合与正确答案集合完全相同
      const isSetEqual = (a: Set<string>, b: Set<string>) => {
        if (a.size !== b.size) return false;
        for (const item of a) {
          if (!b.has(item)) return false;
        }
        return true;
      };
      
      const isCorrect = isSetEqual(userSelectedSet, correctSet);
      
      if (isCorrect) {
        totalCorrect++;
      }
      
      return {
        questionId: String(question.id),
        isCorrect,
        userSelectedOptionIds,
        correctOptionIds
      };
    });
    
    return {
      totalCorrect,
      totalQuestions: questionSet.questions.length,
      accuracyPercentage: questionSet.questions.length > 0 
        ? Math.round((totalCorrect / questionSet.questions.length) * 100) 
        : 0,
      questionResults
    };
  };
  
  // 重新开始测验
  const handleRestartQuiz = () => {
    setUserAnswers({});
    setCurrentQuestionIndex(0);
    setQuizCompleted(false);
    setStartTime(new Date());
    setTimeSpent(0);
    // 清除本地存储的进度
    if (questionSetId) {
      localStorage.removeItem(`${LOCAL_STORAGE_KEYS.QUIZ_PROGRESS}_${questionSetId}`);
    }
  };
  
  // 返回首页
  const handleBackToHome = () => {
    navigate('/');
  };
  
  // 在QuizPage组件中添加事件监听器
  useEffect(() => {
    // 监听进度保存事件
    const handleProgressSave = (event: Event) => {
      const customEvent = event as CustomEvent;
      const progressData = customEvent.detail;
      
      if (!progressData) {
        console.error('[QuizPage] 进度保存事件无数据');
        return;
      }
      
      console.log('[QuizPage] 收到进度保存事件:', progressData);
      
      // 确保有用户ID
      const effectiveUserId = progressData.userId || user?.id || localStorage.getItem('userId');
      
      if (!effectiveUserId) {
        console.error('[QuizPage] 缺少用户ID，无法保存进度');
        return;
      }
      
      // 确保有问题ID和题库ID
      if (!progressData.questionId || !progressData.questionSetId) {
        console.error('[QuizPage] 缺少题目ID或题库ID，无法保存进度');
        return;
      }
      
      // 准备API需要的数据结构
      const apiPayload = {
        userId: effectiveUserId,
        questionId: progressData.questionId,
        questionSetId: progressData.questionSetId,
        isCorrect: progressData.isCorrect,
        timeSpent: progressData.timeSpent || 0,
        // 添加兼容性字段
        user_id: effectiveUserId,
        question_id: progressData.questionId,
        question_set_id: progressData.questionSetId,
        is_correct: progressData.isCorrect
      };
      
      // 使用API服务发送进度更新
      (async () => {
        try {
          // 导入API服务
          const { userProgressService } = await import('../services/api');
          const response = await userProgressService.updateProgress(apiPayload);
          
          if (response && response.success) {
            console.log('[QuizPage] 进度保存成功:', response);
          } else {
            console.warn('[QuizPage] 进度保存失败:', response);
            // 保存到本地以便后续恢复
            try {
              const pendingUpdates = JSON.parse(localStorage.getItem('pendingProgressUpdates') || '[]');
              pendingUpdates.push({
                ...apiPayload,
                timestamp: Date.now()
              });
              localStorage.setItem('pendingProgressUpdates', JSON.stringify(pendingUpdates));
              console.log('[QuizPage] 已保存到本地待提交队列');
            } catch (e) {
              console.error('[QuizPage] 保存到本地失败:', e);
            }
          }
        } catch (error) {
          console.error('[QuizPage] 保存进度时出错:', error);
        }
      })();
    };
    
    // 注册事件监听器
    window.addEventListener('progress:save', handleProgressSave);
    
    // 清理函数
    return () => {
      window.removeEventListener('progress:save', handleProgressSave);
    };
  }, [user]);

  // 添加用户ID到本地存储
  useEffect(() => {
    // 如果用户已登录，保存用户ID到本地存储
    if (user && user.id) {
      localStorage.setItem('userId', user.id);
      console.log('[QuizPage] 已保存用户ID到本地存储:', user.id);
    }
  }, [user]);
  
  if (loading) {
    return (
      <div className="flex justify-center items-center h-screen">
        <div className="animate-spin rounded-full h-12 w-12 border-t-2 border-b-2 border-blue-500"></div>
      </div>
    );
  }
  
  if (error) {
    return (
      <div className="container mx-auto px-4 py-8">
        <div className="bg-red-100 border border-red-400 text-red-700 px-4 py-3 rounded">
          <p className="font-bold">加载错误</p>
          <p>{error}</p>
          <button 
            onClick={handleBackToHome}
            className="mt-4 px-4 py-2 bg-blue-500 text-white rounded hover:bg-blue-600"
          >
            返回首页
          </button>
        </div>
      </div>
    );
  }
  
  if (!questionSet) {
    return (
      <div className="container mx-auto px-4 py-8">
        <div className="bg-yellow-100 border border-yellow-400 text-yellow-700 px-4 py-3 rounded">
          <p className="font-bold">题库不存在</p>
          <p>无法找到请求的题库，请返回首页重试。</p>
          <button 
            onClick={handleBackToHome}
            className="mt-4 px-4 py-2 bg-blue-500 text-white rounded hover:bg-blue-600"
          >
            返回首页
          </button>
        </div>
      </div>
    );
  }
  
  if (!hasAccess && user) {
    return (
      <div className="container mx-auto px-4 py-8">
        <div className="bg-yellow-100 border border-yellow-400 text-yellow-700 px-4 py-3 rounded">
          <p className="font-bold">访问受限</p>
          <p>您没有访问此题库的权限，请返回首页购买或兑换此题库。</p>
          <button 
            onClick={handleBackToHome}
            className="mt-4 px-4 py-2 bg-blue-500 text-white rounded hover:bg-blue-600"
          >
            返回首页
          </button>
        </div>
      </div>
    );
  }
  
  if (quizCompleted && questionSet) {
    const results = calculateResults();
    
    // 使用转换函数将QuizResults转换为QuizCompletionSummaryProps格式
    const summaryProps = convertResultsToSummaryProps(
      results,
      questionSet,
      questionSet.questions || [],
      timeSpent,
      hasAccess,
      handleRestartQuiz,
      handleBackToHome
    );
    
    return <QuizCompletionSummary {...summaryProps} />;
  }
  
  if (!questionSet.questions || questionSet.questions.length === 0) {
    return (
      <div className="container mx-auto px-4 py-8">
        <div className="bg-yellow-100 border border-yellow-400 text-yellow-700 px-4 py-3 rounded">
          <p className="font-bold">题库为空</p>
          <p>此题库没有任何题目内容，请联系管理员或选择其他题库。</p>
          <p className="text-xs mt-2 text-gray-500">诊断信息：ID={questionSet.id}, 标题={questionSet.title}</p>
          <button 
            onClick={handleBackToHome}
            className="mt-4 px-4 py-2 bg-blue-500 text-white rounded hover:bg-blue-600"
          >
            返回首页
          </button>
        </div>
      </div>
    );
  }
  
  const currentQuestion = questionSet.questions[currentQuestionIndex];
  const totalQuestions = questionSet.questions.length;
  const progress = Math.round(((currentQuestionIndex + 1) / totalQuestions) * 100);
  
  // 添加进度恢复/继续UI
  const renderProgressControls = () => {
    // 检查是否有进度提示
    if (userAnswers && Object.keys(userAnswers).length > 0) {
      const answeredCount = Object.keys(userAnswers).length;
      return (
        <div className="flex justify-between items-center bg-blue-50 p-3 rounded-lg mb-4">
          <span className="text-sm text-blue-700">
            已答 {answeredCount}/{totalQuestions} 题 
            ({Math.round((answeredCount / totalQuestions) * 100)}%)
          </span>
          <button
            onClick={saveProgressToLocalStorage}
            className="px-2 py-1 bg-blue-600 text-white text-xs rounded hover:bg-blue-700"
          >
            手动保存进度
          </button>
        </div>
      );
    }
    return null;
  };
  
  return (
    <div className="container mx-auto px-4 py-8">
      <div className="mb-8">
        <h1 className="text-2xl font-bold text-center">{questionSet.title}</h1>
        {renderProgressControls()}
        <div className="mt-4">
          <div className="flex justify-between mb-2">
            <span>进度: {currentQuestionIndex + 1} / {totalQuestions}</span>
            <span>{progress}%</span>
          </div>
          <div className="h-2 bg-gray-200 rounded-full">
            <div 
              className="h-full bg-blue-500 rounded-full" 
              style={{ width: `${progress}%` }}
            ></div>
          </div>
        </div>
      </div>
      
      {currentQuestion && (
        <QuestionCard
          {...{
            question: currentQuestion,
            questionSetId: questionSet.id,
            onAnswerSubmitted: handleAnswerSubmitted,
            onNext: handleNextQuestion,
            isFirst: currentQuestionIndex === 0,
            isLast: currentQuestionIndex === totalQuestions - 1,
            questionNumber: currentQuestionIndex + 1,
            totalQuestions: totalQuestions,
            quizTitle: questionSet.title,
            isPaid: questionSet.isPaid,
            hasFullAccess: hasAccess,
            trialQuestions: questionSet.trialQuestions
          } as any}
        />
      )}
    </div>
  );
};

export default QuizPage;
