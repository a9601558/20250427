import { useState, useEffect, useRef } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { IQuestionSet, Question } from '../types/index';
import { useUser } from '../contexts/UserContext';
import PaymentModal from './PaymentModal';
import { questionSetApi } from '../utils/api';
import { useSocket } from '../contexts/SocketContext';
import { userProgressService } from '../services/UserProgressService';
import { useUserProgress } from '../contexts/UserProgressContext';
import RedeemCodeForm from './RedeemCodeForm';
import QuestionCard from './QuestionCard';

// 定义答题记录类型
interface AnsweredQuestion {
  index: number;
  isCorrect: boolean;
  selectedOption: string | string[];
}

// 获取选项标签（A, B, C, D...）
const getOptionLabel = (index: number): string => {
  return String.fromCharCode(65 + index); // 65 是 'A' 的 ASCII 码
};

function QuizPage(): JSX.Element {
  const { questionSetId } = useParams<{ questionSetId: string }>();
  const navigate = useNavigate();
  const { user, hasAccessToQuestionSet } = useUser();
  const { socket } = useSocket();
  const { fetchUserProgress } = useUserProgress();
  
  const [currentQuestionIndex, setCurrentQuestionIndex] = useState(0);
  const [selectedOptions, setSelectedOptions] = useState<string[]>([]);
  const [showExplanation, setShowExplanation] = useState(false);
  const [answeredQuestions, setAnsweredQuestions] = useState<AnsweredQuestion[]>([]);
  const [correctAnswers, setCorrectAnswers] = useState<number>(0);
  const [quizComplete, setQuizComplete] = useState(false);
  const [questionSet, setQuestionSet] = useState<IQuestionSet | null>(null);
  const [questions, setQuestions] = useState<Question[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [showPaymentModal, setShowPaymentModal] = useState(false);
  const [hasAccessToFullQuiz, setHasAccessToFullQuiz] = useState(false);
  const [trialEnded, setTrialEnded] = useState(false);
  const [questionStartTime, setQuestionStartTime] = useState(0);
  const timeoutId = useRef<NodeJS.Timeout>();
  const [showRedeemCodeModal, setShowRedeemCodeModal] = useState(false);
  
  // 添加 Socket 监听
  useEffect(() => {
    if (!socket || !questionSet) return;

    // 监听题库访问状态更新
    const handleQuestionSetAccessUpdate = (data: { 
      questionSetId: string;
      hasAccess: boolean;
    }) => {
      console.log(`[Socket事件] 收到访问权限更新: questionSetId=${data.questionSetId}, hasAccess=${data.hasAccess}`);
      if (data.questionSetId === questionSet.id) {
        console.log(`[Socket事件] 设置题库访问权限为: ${data.hasAccess}`);
        setHasAccessToFullQuiz(data.hasAccess);
        
        // 权限开启后，同时确保试用结束状态重置
        if (data.hasAccess) {
          setTrialEnded(false);
        }
      }
    };

    // 监听购买成功事件
    const handlePurchaseSuccess = (data: {
      questionSetId: string;
      purchaseId: string;
      expiryDate: string;
    }) => {
      console.log(`[Socket事件] 收到购买成功事件: questionSetId=${data.questionSetId}, 当前题库=${questionSet.id}`);
      const isMatch = String(data.questionSetId).trim() === String(questionSet.id).trim();
      console.log(`[Socket事件] 是否匹配当前题库: ${isMatch}`);
      
      if (isMatch) {
        console.log(`[Socket事件] 设置题库访问权限为true`);
        setHasAccessToFullQuiz(true);
        setTrialEnded(false);
        
        // 主动检查一次权限
        setTimeout(() => {
          console.log(`[Socket事件] 购买后延迟检查权限`);
          checkAccess();
        }, 300);
      }
    };

    console.log(`[Socket] 注册题库访问和购买事件监听`);
    socket.on('questionSet:accessUpdate', handleQuestionSetAccessUpdate);
    socket.on('purchase:success', handlePurchaseSuccess);

    return () => {
      console.log(`[Socket] 移除事件监听`);
      socket.off('questionSet:accessUpdate', handleQuestionSetAccessUpdate);
      socket.off('purchase:success', handlePurchaseSuccess);
    };
  }, [socket, questionSet]);

  // 检查访问权限
  const checkAccess = async () => {
    if (!questionSet) return;
    
    console.log(`[checkAccess] 开始检查题库 ${questionSet.id} 的访问权限`);
    
    // 如果是免费题库，直接授权访问
    if (!questionSet.isPaid) {
      console.log(`[checkAccess] 免费题库，允许访问`);
      setHasAccessToFullQuiz(true);
      setTrialEnded(false); // 确保重置试用状态
      return;
    }
    
    // 未登录用户不检查权限，在需要时会提示登录
    if (!user) {
      console.log(`[checkAccess] 用户未登录，无权限`);
      setHasAccessToFullQuiz(false);
      
      // 检查试用状态
      if (questionSet.trialQuestions && answeredQuestions.length >= questionSet.trialQuestions) {
        setTrialEnded(true);
      }
      return;
    }
    
    console.log(`[checkAccess] 用户已登录，ID: ${user.id}`);
    console.log(`[checkAccess] 用户购买记录数量: ${user.purchases?.length || 0}`);
    
    // 检查用户是否有访问权限 - 多种情况检查
    let hasAccess = false;
    
    // 检查购买记录 - 包括兼容不同的关联字段名
    if (user.purchases && user.purchases.length > 0) {
      console.log(`[checkAccess] 开始检查购买记录，题库ID(目标): ${questionSet.id}`);
      
      // 添加额外的ID格式化检查
      const targetId = String(questionSet.id).trim();
      console.log(`[checkAccess] 格式化后的目标题库ID: "${targetId}"`);
      
      // 增加更详细的日志
      user.purchases.forEach((p, index) => {
        const purchaseId = String(p.questionSetId).trim();
        const match = purchaseId === targetId;
        console.log(`[checkAccess] 购买记录 #${index}: ID="${purchaseId}", 匹配=${match}, 状态=${p.status}, 有效期=${p.expiryDate}`);
      });
      
      const purchase = user.purchases.find(p => {
        // 确保正确比较字符串
        const purchaseSetId = String(p.questionSetId).trim();
        return purchaseSetId === targetId;
      });
      
      if (purchase) {
        console.log(`[checkAccess] 找到匹配的购买记录: ID=${purchase.id}, 状态=${purchase.status}`);
        const expiryDate = new Date(purchase.expiryDate);
        const now = new Date();
        const isExpired = expiryDate <= now;
        const isActive = purchase.status === 'active' || purchase.status === 'completed';
        
        hasAccess = !isExpired && isActive;
        console.log(`[checkAccess] 有效期检查: ${expiryDate.toISOString()} > ${now.toISOString()}, 已过期=${isExpired}`);
        console.log(`[checkAccess] 状态检查: 状态=${purchase.status}, 有效=${isActive}`);
        console.log(`[checkAccess] 购买记录综合判断: 访问权限=${hasAccess}`);
      } else {
        console.log(`[checkAccess] 未找到匹配的购买记录`);
      }
    } else {
      console.log(`[checkAccess] 用户没有购买记录`);
    }
    
    // 检查questionSet自身的hasAccess字段(通过socket实时更新)
    if (questionSet.hasAccess) {
      console.log(`[checkAccess] 题库自带hasAccess属性: ${questionSet.hasAccess}`);
      hasAccess = true;
    }
    
    // 用户直接的访问检查函数
    if (hasAccessToQuestionSet) {
      const directAccess = hasAccessToQuestionSet(questionSet.id);
      console.log(`[checkAccess] 通过hasAccessToQuestionSet检查: ${directAccess}`);
      console.log(`[checkAccess] 调用hasAccessToQuestionSet('${questionSet.id}')`);
      hasAccess = hasAccess || directAccess;
    }
    
    console.log(`[checkAccess] 最终访问权限结果: ${hasAccess}`);
    setHasAccessToFullQuiz(hasAccess);
    
    // 如果有访问权限，确保试用结束状态重置
    if (hasAccess) {
      console.log(`[checkAccess] 用户有访问权限，重置试用结束状态`);
      setTrialEnded(false);
    }
    // 如果没有访问权限，检查试用状态
    else if (questionSet.trialQuestions) {
      const trialStatus = answeredQuestions.length >= questionSet.trialQuestions;
      console.log(`[checkAccess] 试用状态检查: 已答题数 ${answeredQuestions.length} >= 试用题数 ${questionSet.trialQuestions}, 结果: ${trialStatus}`);
      setTrialEnded(trialStatus);
    }

    // 通过 Socket 检查访问权限
    if (socket && user) {
      console.log(`[checkAccess] 通过Socket发送检查请求`);
      socket.emit('questionSet:checkAccess', {
        userId: user.id,
        questionSetId: String(questionSet.id).trim()
      });
    }
  };
  
  // 在获取题库数据后检查访问权限，并在用户状态变化时重新检查
  useEffect(() => {
    console.log(`[useEffect] 触发checkAccess重新检查, 用户ID: ${user?.id}, 题库ID: ${questionSet?.id}`);
    if (user && user.purchases) {
      console.log(`[useEffect] 当前用户购买记录数量: ${user.purchases.length}`);
    }
    checkAccess();
  }, [questionSet, user, answeredQuestions.length, user?.purchases?.length]);
  
  // 获取题库和题目数据
  useEffect(() => {
    const fetchQuestionSet = async () => {
      if (!questionSetId) {
        setError('无效的题库ID');
        setLoading(false);
        return;
      }
      
      try {
        setLoading(true);
        // 获取题库详情
        const response = await questionSetApi.getQuestionSetById(questionSetId);
        
        if (response.success && response.data) {
          const questionSetData: IQuestionSet = {
            id: response.data.id,
            title: response.data.title,
            description: response.data.description,
            category: response.data.category,
            icon: response.data.icon,
            questions: response.data.questions || [],
            isPaid: response.data.isPaid || false,
            price: response.data.price || 0,
            isFeatured: response.data.isFeatured || false,
            featuredCategory: response.data.featuredCategory,
            hasAccess: false,
            trialQuestions: response.data.trialQuestions,
            questionCount: response.data.questions?.length || 0,
            createdAt: new Date(),
            updatedAt: new Date()
          };
          setQuestionSet(questionSetData);
          
          // 使用题库中包含的题目数据
          if (questionSetData.questions && questionSetData.questions.length > 0) {
            console.log("获取到题目:", questionSetData.questions.length);
            
            // 处理题目选项并设置数据
            const processedQuestions = questionSetData.questions.map(q => {
              // 确保选项存在
              if (!q.options || !Array.isArray(q.options)) {
                console.warn("题目缺少选项:", q.id);
                q.options = [];
              }
              
              // 处理选项 - 使用固定的ID生成方式
              const processedOptions = q.options.map((opt, index) => {
                // 使用题目ID和选项索引生成固定ID
                const optionId = opt.id || `q${q.id}-opt${index}`;
                return {
                  id: optionId,
                  text: opt.text,
                  isCorrect: opt.isCorrect,
                  label: getOptionLabel(index) // 添加字母标签
                };
              });
              
              return {
                ...q,
                options: processedOptions,
                // 确保correctAnswer字段与选项ID对应
                correctAnswer: q.questionType === 'single' 
                  ? processedOptions.find(opt => opt.isCorrect)?.id
                  : processedOptions.filter(opt => opt.isCorrect).map(opt => opt.id)
              };
            });
            
            setQuestions(processedQuestions);
          } else {
            console.error("题库中没有题目");
            setError('此题库不包含任何题目');
          }
        } else {
          setError('无法加载题库数据');
        }
      } catch (error) {
        console.error('获取题库详情失败:', error);
        setError('获取题库数据失败');
      } finally {
        setLoading(false);
      }
    };
    
    fetchQuestionSet();
  }, [questionSetId]);
  
  // 监听题库更新
  useEffect(() => {
    if (!socket || !questionSetId) return;
    
    const handleQuestionSetUpdate = (updatedQuestionSet: IQuestionSet) => {
      if (updatedQuestionSet.id === questionSetId) {
        setQuestionSet(updatedQuestionSet);
        checkAccess();
      }
    };
    
    socket.on('questionSet:update', handleQuestionSetUpdate);
    
    return () => {
      socket.off('questionSet:update', handleQuestionSetUpdate);
    };
  }, [socket, questionSetId, questionSet]);
  
  // 在加载完题目数据后设置questionStartTime
  useEffect(() => {
    if (questions.length > 0 && !loading) {
      setQuestionStartTime(Date.now());
    }
  }, [questions, loading]);
  
  // 监听兑换码成功事件
  useEffect(() => {
    // 创建正确类型的事件处理函数
    const handleRedeemSuccess = async (e: Event) => {
      const customEvent = e as CustomEvent;
      console.log(`[QuizPage] 接收到兑换码成功事件:`, customEvent.detail);
      const eventQuizId = String(customEvent.detail?.quizId || '').trim();
      const currentQuizId = String(questionSet?.id || '').trim();
      
      console.log(`[QuizPage] 比较ID: 事件ID=${eventQuizId}, 当前题库ID=${currentQuizId}`);
      
      // 立即更新UI状态，无论ID是否匹配
      console.log(`[QuizPage] 立即更新UI状态: 重置试用状态和访问权限`);
      setHasAccessToFullQuiz(true);  // 确保设置为true
      setTrialEnded(false);          // 确保重置试用结束状态
      
      // 如果是当前题库，执行更深入的检查
      if (eventQuizId === currentQuizId || customEvent.detail?.forceRefresh) {
        console.log(`[QuizPage] 题库ID匹配或强制刷新，更新访问权限并刷新数据`);
        
        // 使用setTimeout确保状态更新后再检查权限
        setTimeout(() => {
          // 主动检查权限
          console.log(`[QuizPage] 兑换后重新检查权限`);
          checkAccess();
          
          // 获取最新进度
          if (fetchUserProgress) {
            console.log(`[QuizPage] 兑换后刷新用户进度`);
            fetchUserProgress(true).catch(err => {
              console.error(`[QuizPage] 刷新进度出错:`, err);
            });
          }
        }, 300);
        
        // 尝试通过Socket再次检查权限
        if (socket && user) {
          console.log(`[QuizPage] 通过Socket重新发送检查请求`);
          socket.emit('questionSet:checkAccess', {
            userId: user.id,
            questionSetId: String(questionSet?.id).trim()
          });
          
          // 手动触发访问权限更新事件
          socket.emit('questionSet:accessUpdate', {
            userId: user.id,
            questionSetId: String(questionSet?.id).trim(),
            hasAccess: true
          });
        }
      }
    };
    
    window.addEventListener('redeem:success', handleRedeemSuccess);
    
    return () => {
      window.removeEventListener('redeem:success', handleRedeemSuccess);
    };
  }, [questionSet?.id, socket, user, fetchUserProgress]);
  
  // 处理选择选项
  const handleOptionSelect = (optionId: string) => {
    // 如果试用已结束且没有购买，不允许继续答题
    if (trialEnded && !hasAccessToFullQuiz) {
      return;
    }
    
    const currentQuestion = questions[currentQuestionIndex];
    
    if (currentQuestion.questionType === 'single') {
      setSelectedOptions([optionId]);
    } else {
      // 多选题，切换选中状态
      if (selectedOptions.includes(optionId)) {
        setSelectedOptions(selectedOptions.filter(id => id !== optionId));
      } else {
        setSelectedOptions([...selectedOptions, optionId]);
      }
    }
  };
  
  // 处理答案提交
  const handleAnswerSubmit = async (): Promise<void> => {
    if (!currentQuestion || !user || !socket || !questionSet) return;

    // 判断答案是否正确
    let isCorrect = false;
    
    if (currentQuestion.questionType === 'single') {
      // 单选题：检查选中的选项是否是正确选项
      const selectedOption = selectedOptions[0];
      const correctOption = currentQuestion.options.find(opt => opt.isCorrect);
      isCorrect = selectedOption === correctOption?.id;
    } else {
      // 多选题：检查选中的选项是否与所有正确选项完全匹配
      const correctOptionIds = currentQuestion.options
        .filter(opt => opt.isCorrect)
        .map(opt => opt.id);
      
      isCorrect = 
        correctOptionIds.length === selectedOptions.length && 
        correctOptionIds.every(id => selectedOptions.includes(id)) &&
        selectedOptions.every(id => correctOptionIds.includes(id));
    }

    const timeSpent = Math.floor((Date.now() - questionStartTime) / 1000);

    try {
      // 保存进度到后端
      const saveResponse = await userProgressService.saveProgress({
        questionId: String(currentQuestion.id),
        questionSetId: questionSet.id,
        selectedOption: currentQuestion.questionType === 'single' 
          ? selectedOptions[0] 
          : selectedOptions,
        isCorrect,
        timeSpent
      });

      if (!saveResponse.success) {
        throw new Error(saveResponse.message || '保存进度失败');
      }

      // 立即更新本地进度，并等待更新完成
      try {
        const updatedProgress = await fetchUserProgress(true);
        if (!updatedProgress) {
          console.warn('未能获取更新后的进度数据');
        }
      } catch (updateError) {
        console.error('更新本地进度失败:', updateError);
        // 继续执行，不中断用户答题流程
      }

      // 发送进度更新事件
      socket.emit('progress:update', { 
        userId: user.id,
        questionSetId: questionSet.id,
        questionId: String(currentQuestion.id),
        isCorrect,
        timeSpent,
        completedQuestions: (user.progress?.[questionSet.id]?.completedQuestions || 0) + (isCorrect ? 1 : 0),
        totalQuestions: questions.length,
        correctAnswers: (user.progress?.[questionSet.id]?.correctAnswers || 0) + (isCorrect ? 1 : 0),
        lastAccessed: new Date().toISOString()
      });

      // 更新本地状态
      if (isCorrect) {
        setCorrectAnswers(prev => prev + 1);
      }
      
      // 显示解析
      setShowExplanation(true);

      // 更新已回答问题列表
      setAnsweredQuestions(prev => [...prev, {
        index: currentQuestionIndex,
        isCorrect,
        selectedOption: currentQuestion.questionType === 'single' 
          ? selectedOptions[0] 
          : selectedOptions
      }]);

      // 答对自动跳到下一题
      if (isCorrect) {
        if (timeoutId.current) {
          clearTimeout(timeoutId.current);
        }
        timeoutId.current = setTimeout(() => {
          goToNextQuestion();
        }, 1000);
      }
    } catch (error) {
      console.error('保存进度失败:', error);
      setError('保存进度失败，请重试');
    }
  };
  
  // 进入下一题
  const goToNextQuestion = () => {
    // 设置下一题的开始时间
    setQuestionStartTime(Date.now());
    
    // 清除选项和解析状态
    setSelectedOptions([]);
    setShowExplanation(false);
    
    if (currentQuestionIndex < questions.length - 1) {
      setCurrentQuestionIndex(currentQuestionIndex + 1);
    } else {
      // 完成测试
      setQuizComplete(true);
    }
  };
  
  // 重新开始测试
  const handleReset = async () => {
    // 清除任何现有的定时器
    if (timeoutId.current) {
      clearTimeout(timeoutId.current);
      timeoutId.current = undefined;
    }

    // 重置所有状态
    setCurrentQuestionIndex(0);
    setSelectedOptions([]);
    setShowExplanation(false);
    setAnsweredQuestions([]);
    setCorrectAnswers(0);
    setQuizComplete(false);
    setQuestionStartTime(Date.now());
    
    console.log('重置答题状态，准备刷新进度数据');
    
    // 重置进度统计 - 确保先清除再重新加载
    if (user && questionSet) {
      try {
        // 确保强制刷新进度数据
        await fetchUserProgress(true);
        console.log('重置后成功刷新进度数据');
      } catch (error) {
        console.error('重置后刷新进度数据失败:', error);
        // 显示友好的错误提示
        setError('刷新进度数据失败，请尝试重新加载页面');
      }
    }
  };
  
  // 组件卸载时清理
  useEffect(() => {
    return () => {
      // 清除超时定时器
      if (timeoutId.current) {
        clearTimeout(timeoutId.current);
      }
    };
  }, []);
  
  if (loading) {
    return (
      <div className="flex justify-center items-center h-96">
        <div className="animate-spin rounded-full h-12 w-12 border-t-2 border-b-2 border-blue-500"></div>
      </div>
    );
  }
  
  if (error || !questionSet || questions.length === 0) {
    return (
      <div className="container mx-auto px-4 py-8">
        <div className="bg-red-100 border border-red-400 text-red-700 px-4 py-3 rounded relative">
          <span className="block sm:inline">{error || '无法加载题库数据'}</span>
        </div>
        <button
          onClick={() => navigate('/')}
          className="mt-4 bg-blue-600 text-white px-4 py-2 rounded hover:bg-blue-700"
        >
          返回首页
        </button>
      </div>
    );
  }
  
  const currentQuestion = questions[currentQuestionIndex];
  
  if (quizComplete) {
    const score = Math.round((correctAnswers / questions.length) * 100);
    
    return (
      <div className="container mx-auto px-4 py-8">
        <h1 className="text-2xl font-bold text-center mb-8">测试完成！</h1>
        
        <div className="bg-white rounded-lg shadow p-6 mb-8">
          <h2 className="text-xl font-semibold mb-4">{questionSet.title}</h2>
          
          <div className="flex flex-col md:flex-row md:items-center justify-between mb-6">
            <div className="mb-4 md:mb-0">
              <p className="text-gray-600">总题数: <span className="font-medium">{questions.length}</span></p>
              <p className="text-gray-600">正确答案: <span className="font-medium">{correctAnswers}</span></p>
            </div>
            
            <div className="text-center bg-blue-50 p-4 rounded-lg">
              <p className="text-lg text-gray-700">得分</p>
              <p className="text-3xl font-bold text-blue-600">{score}%</p>
            </div>
          </div>
          
          <div className="flex flex-wrap gap-3 mt-6">
            <button
              onClick={handleReset}
              className="bg-blue-600 text-white px-4 py-2 rounded hover:bg-blue-700"
            >
              重新开始
            </button>
            
            <button
              onClick={() => navigate('/')}
              className="bg-gray-100 text-gray-800 px-4 py-2 rounded hover:bg-gray-200"
            >
              返回首页
            </button>
          </div>
        </div>
      </div>
    );
  }
  
  // 如果达到试用上限并且没有购买，显示购买提示
  if (trialEnded && !hasAccessToFullQuiz) {
    return (
      <div className="container mx-auto px-4 py-8">
        <div className="bg-white rounded-lg shadow p-6">
          <h2 className="text-xl font-semibold mb-4">{questionSet.title}</h2>
          <div className="bg-yellow-50 border-l-4 border-yellow-400 p-4 mb-6">
            <div className="flex">
              <div className="flex-shrink-0">
                <svg className="h-5 w-5 text-yellow-400" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20" fill="currentColor">
                  <path fillRule="evenodd" d="M18 10a8 8 0 11-16 0 8 8 0 0116 0zm-7-4a1 1 0 11-2 0 1 1 0 012 0zM9 9a1 1 0 000 2v3a1 1 0 001 1h1a1 1 0 100-2v-3a1 1 0 00-1-1H9z" clipRule="evenodd" />
                </svg>
              </div>
              <div className="ml-3">
                <p className="text-sm text-yellow-700">
                  您已完成免费试用的 {questionSet.trialQuestions} 道题目。
                  要继续访问完整题库的 {questions.length} 道题目，请购买完整版或使用兑换码。
                </p>
              </div>
            </div>
          </div>
          
          <div className="bg-white border rounded-lg p-4 mb-6">
            <div className="flex justify-between items-center mb-2">
              <h3 className="text-lg font-medium">完整题库访问</h3>
              <span className="text-xl font-bold text-green-600">¥{questionSet.price}</span>
            </div>
            <p className="text-gray-600 mb-4">
              购买后可访问全部 {questions.length} 道题目，有效期6个月。
              您已经完成了 {answeredQuestions.length} 道题目，其中答对了 {correctAnswers} 题。
            </p>
            <div className="flex flex-col space-y-3">
              <button 
                onClick={() => setShowPaymentModal(true)}
                className="w-full bg-blue-600 text-white py-2 px-4 rounded hover:bg-blue-700"
              >
                立即购买
              </button>
              
              <button
                onClick={() => setShowRedeemCodeModal(true)}
                className="w-full bg-green-50 text-green-700 border border-green-300 py-2 px-4 rounded hover:bg-green-100"
              >
                使用兑换码
              </button>
            </div>
          </div>
          
          <div className="flex justify-between mt-4">
            <button
              onClick={() => navigate('/')}
              className="bg-gray-100 text-gray-800 px-4 py-2 rounded hover:bg-gray-200"
            >
              返回首页
            </button>
            {user ? (
              <button
                onClick={() => navigate('/profile')}
                className="bg-green-600 text-white px-4 py-2 rounded hover:bg-green-700"
              >
                查看已购题库
              </button>
            ) : (
              <button
                onClick={() => navigate('/login')}
                className="bg-green-600 text-white px-4 py-2 rounded hover:bg-green-700"
              >
                登录/注册
              </button>
            )}
          </div>
        </div>
        
        {/* 支付模态窗口 */}
        {showPaymentModal && (
          <PaymentModal
            isOpen={showPaymentModal}
            questionSet={questionSet}
            onClose={() => setShowPaymentModal(false)}
            onSuccess={() => {
              console.log(`[QuizPage] 支付成功回调，更新访问权限`);
              setHasAccessToFullQuiz(true);
              setTrialEnded(false);
              setShowPaymentModal(false);
              
              // 尝试通过Socket再次检查权限，确保状态一致性
              if (socket && user) {
                setTimeout(() => {
                  console.log(`[QuizPage] 支付成功后检查权限`);
                  socket.emit('questionSet:checkAccess', {
                    userId: user.id,
                    questionSetId: String(questionSet.id).trim()
                  });
                }, 300);
              }
            }}
          />
        )}
        
        {/* 兑换码模态窗口 */}
        {showRedeemCodeModal && (
          <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
            <div className="bg-white rounded-lg p-6 max-w-md w-full mx-4">
              <div className="flex justify-between items-center mb-4">
                <h2 className="text-xl font-semibold">题库兑换码</h2>
                <button
                  onClick={() => setShowRedeemCodeModal(false)}
                  className="text-gray-500 hover:text-gray-700"
                >
                  <svg className="h-6 w-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M6 18L18 6M6 6l12 12" />
                  </svg>
                </button>
              </div>
              <RedeemCodeForm onRedeemSuccess={(quizId) => {
                console.log(`[QuizPage] 兑换码成功回调，题库ID: ${quizId}`);
                setShowRedeemCodeModal(false);
                
                // 立即更新UI状态
                console.log(`[QuizPage] 直接设置访问权限为true和重置试用状态`);
                setHasAccessToFullQuiz(true);
                setTrialEnded(false);
                
                // 延迟发送自定义事件确保完整处理
                setTimeout(() => {
                  if (typeof window !== 'undefined') {
                    window.dispatchEvent(new CustomEvent('redeem:success', { 
                      detail: { 
                        quizId, 
                        forceRefresh: true,
                        source: 'QuizPageRedeemForm',
                        timestamp: Date.now()
                      } 
                    }));
                  }
                }, 200);
                
                // 后台异步执行权限检查以确保数据完整性
                setTimeout(() => {
                  console.log(`[QuizPage] 后台检查访问权限`);
                  checkAccess();
                  
                  // 通过Socket请求确认权限
                  if (socket && user && questionSet) {
                    console.log(`[QuizPage] 通过Socket请求确认权限`);
                    socket.emit('questionSet:checkAccess', {
                      userId: user.id,
                      questionSetId: String(questionSet.id).trim()
                    });
                    
                    // 明确设置访问权限
                    socket.emit('questionSet:accessUpdate', {
                      userId: user.id,
                      questionSetId: String(questionSet.id).trim(),
                      hasAccess: true
                    });
                  }
                }, 500);
              }} />
            </div>
          </div>
        )}
      </div>
    );
  }
  
  return (
    <div className="container mx-auto px-4 py-8">
      <div className="mb-6">
        <div className="flex justify-between items-center mb-4">
          <h1 className="text-2xl font-bold">{questionSet.title}</h1>
          <button
            onClick={() => navigate('/')}
            className="bg-gray-100 text-gray-800 px-3 py-1.5 rounded text-sm hover:bg-gray-200"
          >
            返回首页
          </button>
        </div>
        
        {!questionSet.isPaid ? (
          <p className="text-sm text-gray-600 mb-2">此题库为免费访问，包含 {questions.length} 道题目</p>
        ) : !hasAccessToFullQuiz && questionSet.trialQuestions && questionSet.trialQuestions > 0 ? (
          <div className="bg-yellow-50 border-l-4 border-yellow-400 p-4 mb-4">
            <p className="text-sm text-yellow-700">
              您正在试用此题库，可免费回答 {questionSet.trialQuestions} 道题目
              （当前已回答 {answeredQuestions.length} / {questionSet.trialQuestions}）
            </p>
          </div>
        ) : null}
        
        {/* 进度条 */}
        <div className="w-full bg-gray-200 rounded-full h-2.5 mb-4">
          <div 
            className="bg-blue-600 h-2.5 rounded-full" 
            style={{ width: `${(currentQuestionIndex / questions.length) * 100}%` }}
          />
        </div>
        
        <div className="flex justify-between text-sm text-gray-500">
          <span>题目 {currentQuestionIndex + 1} / {questions.length}</span>
          <span>已回答 {answeredQuestions.length} 题</span>
        </div>
      </div>
      
      {/* 当前题目 */}
      <QuestionCard
        question={currentQuestion}
        onNext={goToNextQuestion}
        onAnswerSubmitted={handleAnswerSubmit}
        questionNumber={currentQuestionIndex + 1}
        totalQuestions={questions.length}
        quizTitle={questionSet.title}
        userAnsweredQuestion={answeredQuestions.find(q => q.index === currentQuestionIndex)}
        onJumpToQuestion={(index) => {
          // 如果试用已结束且没有购买，不允许跳转
          if (trialEnded && !hasAccessToFullQuiz && index >= (questionSet.trialQuestions || 0)) {
            console.log(`[QuizPage] 试用已结束，无法跳转到第 ${index + 1} 题`);
            return;
          }
          
          // 确保没有未提交的答案
          const isCurrentQuestionSubmitted = answeredQuestions.some(q => q.index === currentQuestionIndex);
          if (!isCurrentQuestionSubmitted && currentQuestionIndex !== index) {
            if (confirm("当前题目尚未提交答案，确定要离开吗？")) {
              setCurrentQuestionIndex(index);
              setSelectedOptions([]);
            }
          } else {
            console.log(`[QuizPage] 跳转到第 ${index + 1} 题`);
            setCurrentQuestionIndex(index);
            setSelectedOptions([]);
          }
        }}
      />
      
      {/* 兑换码模态框 */}
      {showRedeemCodeModal && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
          <div className="bg-white rounded-lg p-6 max-w-md w-full mx-4">
            <div className="flex justify-between items-center mb-4">
              <h2 className="text-xl font-semibold">题库兑换码</h2>
              <button
                onClick={() => setShowRedeemCodeModal(false)}
                className="text-gray-500 hover:text-gray-700"
              >
                <svg className="h-6 w-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>
            </div>
            <RedeemCodeForm onRedeemSuccess={(quizId) => {
              console.log(`[QuizPage] 兑换码成功回调，题库ID: ${quizId}`);
              setShowRedeemCodeModal(false);
              
              // 立即更新UI状态
              console.log(`[QuizPage] 直接设置访问权限为true和重置试用状态`);
              setHasAccessToFullQuiz(true);
              setTrialEnded(false);
              
              // 延迟发送自定义事件确保完整处理
              setTimeout(() => {
                if (typeof window !== 'undefined') {
                  window.dispatchEvent(new CustomEvent('redeem:success', { 
                    detail: { 
                      quizId, 
                      forceRefresh: true,
                      source: 'QuizPageRedeemForm',
                      timestamp: Date.now()
                    } 
                  }));
                }
              }, 200);
              
              // 后台异步执行权限检查以确保数据完整性
              setTimeout(() => {
                console.log(`[QuizPage] 后台检查访问权限`);
                checkAccess();
                
                // 通过Socket请求确认权限
                if (socket && user && questionSet) {
                  console.log(`[QuizPage] 通过Socket请求确认权限`);
                  socket.emit('questionSet:checkAccess', {
                    userId: user.id,
                    questionSetId: String(questionSet.id).trim()
                  });
                  
                  // 明确设置访问权限
                  socket.emit('questionSet:accessUpdate', {
                    userId: user.id,
                    questionSetId: String(questionSet.id).trim(),
                    hasAccess: true
                  });
                }
              }, 500);
            }} />
          </div>
        </div>
      )}
    </div>
  );
}

export default QuizPage; 