import React, { useState, useEffect, useRef, useCallback } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import QuestionCard from './QuestionCard';
import { useUser } from '../contexts/UserContext';
import apiClient from '../utils/api-client';
import { useUserProgress } from '../contexts/UserProgressContext';
import QuizCompletionSummary from './quiz/QuizCompletionSummary';
import { Question, Option, QuestionSet } from '../types';
import { AnsweredQuestion } from '../hooks/useQuizReducer';

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
  QUIZ_START_TIME: 'quizStartTime'
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
  const { progressStats, fetchUserProgress } = useUserProgress();
  
  const [questionSet, setQuestionSet] = useState<QuestionSet | null>(null);
  const [currentQuestionIndex, setCurrentQuestionIndex] = useState(0);
  const [userAnswers, setUserAnswers] = useState<Record<string, string[]>>({});
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [quizCompleted, setQuizCompleted] = useState(false);
  const [startTime, setStartTime] = useState<Date | null>(null);
  const [hasAccess, setHasAccess] = useState(false);
  const [timeSpent, setTimeSpent] = useState<number>(0);
  
  // 使用useRef创建一个标志，以避免在组件卸载后更新状态
  const isMounted = useRef(true);
  // 用于取消请求的AbortController
  const abortControllerRef = useRef<AbortController | null>(null);
  
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
    const checkAccess = async () => {
      if (!questionSetId) {
        if (isMounted.current) {
          setError('题库ID无效');
          setLoading(false);
        }
        return;
      }
      
      try {
        const signal = createAbortController();
        
        // 先发送预检请求，检查用户是否有权访问
        const accessCheckResponse = await apiClient.get(`/api/question-sets/${questionSetId}/access-check`, undefined, { signal });
        
        if (!accessCheckResponse.success) {
          if (isMounted.current) {
            setError(accessCheckResponse.message || '无权访问此题库');
            setLoading(false);
          }
          return;
        }
        
        // 如果有权限，再获取完整题库数据
        const response = await apiClient.get(`/api/question-sets/${questionSetId}`, undefined, { signal });
        
        if (isMounted.current) {
          if (response && response.success) {
            setQuestionSet(response.data);
            
            // 验证后端返回的权限信息
            const isPaid = response.data.isPaid;
            const hasAccessRight = !isPaid || (user && response.data.hasAccess);
            setHasAccess(hasAccessRight);
            
            if (!hasAccessRight && user) {
              console.warn('用户无权访问该题库');
            }
            
            // 设置开始时间
            const newStartTime = new Date();
            setStartTime(newStartTime);
            
            // 尝试恢复保存的进度
            const restored = restoreProgress();
            
            // 如果没有恢复成功，则自动保存当前状态
            if (!restored) {
              saveProgressToLocalStorage();
            }
          } else {
            setError(response?.message || '无法加载题库数据');
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
  }, [questionSetId, user, createAbortController, restoreProgress, saveProgressToLocalStorage]);
  
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
  
  // 完成测验，提交结果
  const completeQuiz = async () => {
    if (!questionSet || !questionSet.questions || !user) return;
    
    const endTime = new Date();
    const totalTime = startTime ? Math.floor((endTime.getTime() - startTime.getTime()) / 1000) : 0;
    setTimeSpent(totalTime);
    
    // 计算正确率
    const results = calculateResults();
    
    // 提交进度数据
    try {
      const signal = createAbortController();
      
      const response = await apiClient.post(
        '/api/user-progress/update',
        {
          userId: user.id,
          questionSetId,
          completedQuestions: questionSet.questions.length,
          correctAnswers: results.totalCorrect,
          timeSpent: totalTime,
          lastCompletedAt: new Date().toISOString()
        },
        { signal }
      );
      
      if (isMounted.current) {
        if (response && response.success) {
          console.log('测验结果已保存');
          // 重新获取用户进度
          if (fetchUserProgress) {
            fetchUserProgress();
          }
          
          // 清除本地存储的进度
          localStorage.removeItem(`${LOCAL_STORAGE_KEYS.QUIZ_PROGRESS}_${questionSetId}`);
        } else {
          console.error('保存测验结果失败:', response?.message);
        }
        
        setQuizCompleted(true);
      }
    } catch (err) {
      if (err instanceof Error && err.name !== 'AbortError' && isMounted.current) {
        console.error('保存测验结果时出错:', err);
        setQuizCompleted(true); // 即使保存失败也完成测验
      }
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
          <p>此题库没有题目，请返回首页选择其他题库。</p>
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
