import React, { useState, useEffect, useCallback, useRef } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { IQuestionSet, Question } from '../types/index';
import { useUser } from '../contexts/UserContext';
import PaymentModal from './PaymentModal';
import { questionSetApi } from '../utils/api';
import { useSocket } from '../contexts/SocketContext';
import { userProgressService, wrongAnswerService } from '../services/api';
import { useUserProgress } from '../contexts/UserProgressContext';
import RedeemCodeForm from './RedeemCodeForm';
import QuestionCard from './QuestionCard';
import { toast } from 'react-toastify';

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

// 添加对两种字段命名的兼容处理
const getQuestions = (data: any) => {
  // 首先检查新的字段名
  if (data.questionSetQuestions && data.questionSetQuestions.length > 0) {
    return data.questionSetQuestions;
  }
  // 然后检查旧的字段名
  if (data.questions && data.questions.length > 0) {
    return data.questions;
  }
  // 都没有则返回空数组
  return [];
};

// 添加答题卡组件
const AnswerCard: React.FC<{
  totalQuestions: number;
  answeredQuestions: AnsweredQuestion[];
  currentIndex: number;
  onJump: (index: number) => void;
}> = ({ totalQuestions, answeredQuestions, currentIndex, onJump }) => {
  return (
    <div className="bg-white shadow-md rounded-lg p-4 mb-6">
      <h3 className="text-md font-medium mb-3">答题卡</h3>
      <div className="flex flex-wrap gap-2">
        {Array.from({ length: totalQuestions }).map((_, index) => {
          const isAnswered = answeredQuestions.some((q) => q.index === index);
          const isCorrect = answeredQuestions.some((q) => q.index === index && q.isCorrect);
          const isCurrent = currentIndex === index;
          
          let bgColor = 'bg-gray-100'; // 默认未答题
          if (isCurrent) bgColor = 'bg-blue-500 text-white'; // 当前题目
          else if (isCorrect) bgColor = 'bg-green-100'; // 已答对
          else if (isAnswered) bgColor = 'bg-red-100'; // 已答错
          
          return (
            <button
              key={index}
              onClick={() => onJump(index)}
              className={`w-8 h-8 ${bgColor} rounded-md flex items-center justify-center text-sm font-medium hover:opacity-80 transition-all`}
            >
              {index + 1}
            </button>
          );
        })}
      </div>
    </div>
  );
};

// Add this interface before the QuizPage component
interface ExtendedSaveProgressParams {
  questionId: string;
  questionSetId: string;
  selectedOption: string | string[];
  isCorrect: boolean;
  timeSpent: number;
  lastQuestionIndex: number;
}

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
  const [hasRedeemed, setHasRedeemed] = useState(false); // Track if user has redeemed a code
  const timeoutId = useRef<NodeJS.Timeout>();
  const [showRedeemCodeModal, setShowRedeemCodeModal] = useState(false);
  const [isRandomMode, setIsRandomMode] = useState(false);
  const [originalQuestions, setOriginalQuestions] = useState<Question[]>([]);
  
  // 保存访问权限到localStorage - 以题库ID为key
  const saveAccessToLocalStorage = useCallback((questionSetId: string, hasAccess: boolean) => {
    if (!questionSetId) return;
    
    try {
      const normalizedId = String(questionSetId).trim();
      console.log(`[QuizPage] 保存题库 ${normalizedId} 的访问权限: ${hasAccess}`);
      
      // 获取当前访问权限列表
      const accessRightsStr = localStorage.getItem('quizAccessRights');
      let accessRights: {[key: string]: boolean} = {};
      
      if (accessRightsStr) {
        try {
          accessRights = JSON.parse(accessRightsStr);
        } catch (e) {
          console.error('[QuizPage] 解析访问权限记录失败，将创建新记录', e);
        }
      }
      
      // 更新访问权限
      accessRights[normalizedId] = hasAccess;
      
      // 保存回localStorage
      localStorage.setItem('quizAccessRights', JSON.stringify(accessRights));
      console.log(`[QuizPage] 已保存题库 ${normalizedId} 的访问权限`);
    } catch (e) {
      console.error('[QuizPage] 保存访问权限失败', e);
    }
  }, []);
  
  // 从localStorage获取访问权限
  const getAccessFromLocalStorage = useCallback((questionSetId: string): boolean => {
    if (!questionSetId) return false;
    
    try {
      const normalizedId = String(questionSetId).trim();
      console.log(`[QuizPage] 获取题库 ${normalizedId} 的访问权限`);
      
      const accessRightsStr = localStorage.getItem('quizAccessRights');
      if (!accessRightsStr) return false;
      
      const accessRights = JSON.parse(accessRightsStr);
      const hasAccess = !!accessRights[normalizedId];
      
      console.log(`[QuizPage] 题库 ${normalizedId} 的本地存储访问权限: ${hasAccess}`);
      return hasAccess;
    } catch (e) {
      console.error('[QuizPage] 获取访问权限失败', e);
      return false;
    }
  }, []);
  
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
        console.log('[Socket事件] 设置题库访问权限为true');
        setHasAccessToFullQuiz(true);
        setTrialEnded(false);
        
        // 主动检查一次权限
        setTimeout(() => {
          console.log('[Socket事件] 购买后延迟检查权限');
          checkAccess();
        }, 300);
      }
    };

    console.log('[Socket] 注册题库访问和购买事件监听');
    socket.on('questionSet:accessUpdate', handleQuestionSetAccessUpdate);
    socket.on('purchase:success', handlePurchaseSuccess);

    return () => {
      console.log('[Socket] 移除事件监听');
      socket.off('questionSet:accessUpdate', handleQuestionSetAccessUpdate);
      socket.off('purchase:success', handlePurchaseSuccess);
    };
  }, [socket, questionSet]);

  // 添加一个更全面的权限检查函数，确保跨设备兑换状态一致
  const checkFullAccessFromAllSources = useCallback(() => {
    if (!questionSet) return false;
    
    console.log(`[QuizPage] 全面检查题库 ${questionSet.id} 的访问权限来源`);
    
    // 1. 检查localStorage中的访问权限记录
    let hasAccess = false;
    try {
      // 检查一般访问权限
      const accessRightsStr = localStorage.getItem('quizAccessRights');
      if (accessRightsStr) {
        const accessRights = JSON.parse(accessRightsStr);
        const localAccess = !!accessRights[questionSet.id];
        hasAccess = hasAccess || localAccess;
        console.log(`[QuizPage] localStorage访问权限检查: ${localAccess}`);
      }
      
      // 检查兑换记录 - 使用更宽松的ID匹配
      const redeemedStr = localStorage.getItem('redeemedQuestionSetIds');
      if (redeemedStr) {
        try {
          const redeemedIds = JSON.parse(redeemedStr);
          const targetId = String(questionSet.id).trim();
          
          // 确保是数组
          if (Array.isArray(redeemedIds)) {
            // 使用更宽松的匹配逻辑，避免因ID格式不同而无法匹配
            const isRedeemed = redeemedIds.some((id) => {
              const redeemedId = String(id).trim();
              // 精确匹配
              const exactMatch = redeemedId === targetId;
              // 包含匹配 - 处理有可能带前缀后缀的ID
              const partialMatch = (redeemedId.includes(targetId) || targetId.includes(redeemedId)) 
                && Math.abs(redeemedId.length - targetId.length) <= 3
                && redeemedId.length > 5 && targetId.length > 5;
                
              return exactMatch || partialMatch;
            });
            
            hasAccess = hasAccess || isRedeemed;
            console.log(`[QuizPage] localStorage兑换记录检查: ${isRedeemed}, 匹配ID: ${targetId}`);
          }
        } catch (e) {
          console.error('[QuizPage] 解析localStorage兑换记录失败', e);
        }
      }
    } catch (e) {
      console.error('[QuizPage] 检查localStorage权限失败', e);
    }
    
    // 2. 检查用户购买记录
    if (user && user.purchases && Array.isArray(user.purchases)) {
      const purchase = user.purchases.find((p) => {
        const purchaseId = String(p.questionSetId || '').trim();
        const targetId = String(questionSet.id || '').trim();
        
        // 使用更宽松的匹配逻辑
        const exactMatch = purchaseId === targetId;
        const partialMatch = (purchaseId.includes(targetId) || targetId.includes(purchaseId)) 
          && Math.abs(purchaseId.length - targetId.length) <= 3
          && purchaseId.length > 5 && targetId.length > 5;
        
        return exactMatch || partialMatch;
      });
      
      if (purchase) {
        const now = new Date();
        const expiryDate = purchase.expiryDate ? new Date(purchase.expiryDate) : null;
        const isExpired = expiryDate && expiryDate <= now;
        const isActive = purchase.status === 'active' || purchase.status === 'completed' || !purchase.status; // 允许缺失状态
        
        const purchaseHasAccess = !isExpired && isActive;
        hasAccess = hasAccess || purchaseHasAccess;
        console.log(`[QuizPage] 用户购买记录检查: ${purchaseHasAccess}`);
      }
    }
    
    // 3. 检查questionSet自身的hasAccess属性
    if (questionSet.hasAccess) {
      hasAccess = true;
      console.log('[QuizPage] 题库hasAccess属性: true');
    }
    
    // 4. 检查当前组件状态
    const componentStateAccess = hasAccessToFullQuiz || hasRedeemed;
    hasAccess = hasAccess || componentStateAccess;
    console.log(`[QuizPage] 组件状态检查: hasAccessToFullQuiz=${hasAccessToFullQuiz}, hasRedeemed=${hasRedeemed}`);
    
    // 5. 检查免费题库
    const isFreeAccess = !questionSet.isPaid;
    hasAccess = hasAccess || isFreeAccess;
    console.log(`[QuizPage] 免费题库检查: ${isFreeAccess}`);
    
    console.log(`[QuizPage] 全面权限检查最终结果: ${hasAccess}`);
    return hasAccess;
  }, [questionSet, user, hasAccessToFullQuiz, hasRedeemed]);

  // 在现有的useEffect中增强跨设备权限同步
  useEffect(() => {
    // 仅当用户已登录且题库信息加载后执行
    if (!user?.id || !questionSet) return;
    
    console.log('[QuizPage] 用户登录后主动进行跨设备权限同步检查');
    
    // 首先检查所有可能的访问权限来源
    const hasFullAccess = checkFullAccessFromAllSources();
    
    // 如果发现有访问权限，立即更新状态并保存到localStorage
    if (hasFullAccess) {
      console.log('[QuizPage] 检测到访问权限，更新状态');
      setHasAccessToFullQuiz(true);
      setTrialEnded(false);
      saveAccessToLocalStorage(questionSet.id, true);
      
      // 通知服务器更新权限状态
      if (socket) {
        console.log('[QuizPage] 向服务器发送权限更新');
        socket.emit('questionSet:accessUpdate', {
          userId: user.id,
          questionSetId: String(questionSet.id).trim(),
          hasAccess: true,
          source: 'crossDeviceSync',
        });
      }
    }
    // 只检查一次，避免重复
  }, [user?.id, questionSet?.id, checkFullAccessFromAllSources, saveAccessToLocalStorage, socket]);

  // 修改trialEnded的判定逻辑，避免错误提示购买
  useEffect(() => {
    if (!questionSet) return;
    
    console.log(`[QuizPage] 检查是否试用结束，总答题数: ${answeredQuestions.length}`);
    
    // 首先全面检查是否有权限访问
    const hasFullAccess = checkFullAccessFromAllSources();
    
    // 如果有访问权限，确保不会显示试用结束
    if (hasFullAccess) {
      console.log('[QuizPage] 用户有完整访问权限，设置trialEnded=false');
      setHasAccessToFullQuiz(true);
      setTrialEnded(false);
      return;
    }
    
    // 只有在无权限且达到试用题目数量限制时才设置试用结束
    if (!hasFullAccess && questionSet.trialQuestions && answeredQuestions.length >= questionSet.trialQuestions) {
      console.log(`[QuizPage] 试用题目已达上限 (${answeredQuestions.length}/${questionSet.trialQuestions})，设置trialEnded=true`);
      setTrialEnded(true);
    } else {
      setTrialEnded(false);
    }
  }, [answeredQuestions.length, questionSet, checkFullAccessFromAllSources]);

  // 在权限检查函数中增强对兑换状态的识别
  const checkAccess = async () => {
    if (!questionSet) return;
    
    console.log(`[checkAccess] 开始检查题库 ${questionSet.id} 的访问权限, 已兑换状态: ${hasRedeemed}`);
    
    // 首先全面检查所有可能的访问权限来源
    const hasFullAccess = checkFullAccessFromAllSources();
    if (hasFullAccess) {
      console.log('[checkAccess] 全面检查发现用户有访问权限');
      setHasAccessToFullQuiz(true);
      saveAccessToLocalStorage(questionSet.id, true);
      setTrialEnded(false);
      return;
    }
    
    // 如果用户已经兑换过码，直接授权访问并跳过所有其他检查
    if (hasRedeemed) {
      console.log('[checkAccess] 用户已兑换码，直接授权访问');
      setHasAccessToFullQuiz(true);
      saveAccessToLocalStorage(questionSet.id, true);
      setTrialEnded(false);
      return;
    }
    
    // 检查本地存储中的访问权限
    const localStorageAccess = getAccessFromLocalStorage(questionSet.id);
    if (localStorageAccess) {
      console.log('[checkAccess] 本地存储显示用户有访问权限，直接授权访问');
      setHasAccessToFullQuiz(true);
      setTrialEnded(false);
      return;
    }
    
    // 如果是免费题库，直接授权访问
    if (!questionSet.isPaid) {
      console.log('[checkAccess] 免费题库，允许访问');
      setHasAccessToFullQuiz(true);
      saveAccessToLocalStorage(questionSet.id, true);
      setTrialEnded(false); // 确保重置试用状态
      return;
    }
    
    // 未登录用户不检查权限，在需要时会提示登录
    if (!user) {
      console.log('[checkAccess] 用户未登录，无权限');
      setHasAccessToFullQuiz(false);
      saveAccessToLocalStorage(questionSet.id, false);
      
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
        const expiryDate = new Date(p.expiryDate);
        const isExpired = expiryDate <= new Date();
        
        console.log(`[checkAccess] 购买记录 #${index}: ID="${purchaseId}", 匹配=${match}, 状态=${p.status}, 有效期=${p.expiryDate}, 已过期=${isExpired}`);
      });
      
      // 改进购买记录匹配机制，使用更宽松的比较，避免ID格式差异问题
      const purchase = user.purchases.find((p) => {
        // 标准化两个ID进行比较
        const purchaseSetId = String(p.questionSetId).trim();
        const targetId = String(questionSet.id).trim();
        
        // 检查是否匹配
        const isExactMatch = purchaseSetId === targetId;
        
        // 添加二次检查 - 有时ID可能包含了前缀或后缀
        const containsId = purchaseSetId.includes(targetId) || targetId.includes(purchaseSetId);
        const similarLength = Math.abs(purchaseSetId.length - targetId.length) <= 2;
        const isPartialMatch = containsId && similarLength;
        
        const result = isExactMatch || isPartialMatch;
        console.log(`[checkAccess] 比较 "${purchaseSetId}" 与 "${targetId}": 精确匹配=${isExactMatch}, 部分匹配=${isPartialMatch}, 最终结果=${result}`);
        
        return result;
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
        
        // 如果确认有购买权限，立即保存到localStorage
        if (hasAccess) {
          saveAccessToLocalStorage(questionSet.id, true);
        }
      } else {
        console.log('[checkAccess] 未找到匹配的购买记录');
      }
    } else {
      console.log('[checkAccess] 用户没有购买记录');
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
    saveAccessToLocalStorage(questionSet.id, hasAccess);
    
    // 如果有访问权限，确保试用结束状态重置
    if (hasAccess) {
      console.log('[checkAccess] 用户有访问权限，重置试用结束状态');
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
      console.log('[checkAccess] 通过Socket发送检查请求');
      socket.emit('questionSet:checkAccess', {
        userId: user.id,
        questionSetId: String(questionSet.id).trim(),
      });
    }
  };
  
  // 在获取题库数据后检查访问权限，并在用户状态变化时重新检查
  useEffect(() => {
    console.log(`[useEffect] 触发checkAccess重新检查, 用户ID: ${user?.id}, 题库ID: ${questionSet?.id}, 已兑换: ${hasRedeemed}`);
    if (user && user.purchases) {
      console.log(`[useEffect] 当前用户购买记录数量: ${user.purchases.length}`);
    }
    checkAccess();
  }, [questionSet, user, answeredQuestions.length, user?.purchases?.length, hasRedeemed]);
  
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
        
        // 解析URL参数
        const urlParams = new URLSearchParams(window.location.search);
        const mode = urlParams.get('mode');
        const specificQuestions = urlParams.get('questions');
        
        // 获取题库详情
        const response = await questionSetApi.getQuestionSetById(questionSetId);
        
        if (response.success && response.data) {
          const questionSetData: IQuestionSet = {
            id: response.data.id,
            title: response.data.title,
            description: response.data.description,
            category: response.data.category,
            icon: response.data.icon,
            questions: getQuestions(response.data),
            isPaid: response.data.isPaid || false,
            price: response.data.price || 0,
            isFeatured: response.data.isFeatured || false,
            featuredCategory: response.data.featuredCategory,
            hasAccess: false,
            trialQuestions: response.data.trialQuestions,
            questionCount: getQuestions(response.data).length,
            createdAt: new Date(),
            updatedAt: new Date(),
          };
          setQuestionSet(questionSetData);
          
          // 使用题库中包含的题目数据
          const questionsData = getQuestions(questionSetData);
          if (questionsData.length > 0) {
            console.log('获取到题目:', questionsData.length);
            
            // 处理题目选项并设置数据
            const processedQuestions = questionsData.map((q: any) => {
              // 确保选项存在
              if (!q.options || !Array.isArray(q.options)) {
                console.warn('题目缺少选项:', q.id);
                q.options = [];
              }
              
              // 处理选项 - 使用固定的ID生成方式
              const processedOptions = q.options.map((opt: any, index: number) => {
                // 使用题目ID和选项索引生成固定ID
                const optionId = opt.id || `q${q.id}-opt${index}`;
                return {
                  id: optionId,
                  text: opt.text,
                  isCorrect: opt.isCorrect,
                  label: getOptionLabel(index), // 添加字母标签
                };
              });
              
              return {
                ...q,
                options: processedOptions,
                // 确保correctAnswer字段与选项ID对应
                correctAnswer: q.questionType === 'single' 
                  ? processedOptions.find((opt: any) => opt.isCorrect)?.id
                  : processedOptions.filter((opt: any) => opt.isCorrect).map((opt: any) => opt.id),
              };
            });
            
            // 保存原始题目顺序
            setOriginalQuestions(processedQuestions);
            
            // 如果是错题练习模式且指定了问题ID，则筛选题目
            if (mode === 'wrong-answers' && specificQuestions) {
              console.log('[QuizPage] 错题练习模式，筛选指定题目');
              const questionIds = specificQuestions.split(',');
              
              // 只保留指定ID的题目
              const filteredQuestions = processedQuestions.filter((q: Question) => 
                questionIds.includes(String(q.id))
              );
              
              if (filteredQuestions.length > 0) {
                console.log(`[QuizPage] 筛选后的题目数量: ${filteredQuestions.length}`);
                setQuestions(filteredQuestions);
              } else {
                // 如果筛选后没有题目，使用全部题目
                console.log('[QuizPage] 未找到指定题目，使用全部题目');
                setQuestions(processedQuestions);
              }
            } else {
              setQuestions(processedQuestions);
            }
          } else {
            console.error('题库中没有题目');
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
  }, [questionSetId, getQuestions]);
  
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
  
  // 检查 localStorage 中是否有已兑换记录
  useEffect(() => {
    if (questionSet?.id) {
      const redeemedQuestionSetIds = localStorage.getItem('redeemedQuestionSetIds');
      console.log('[QuizPage] 检查localStorage存储的已兑换题库IDs:', redeemedQuestionSetIds);
      
      if (redeemedQuestionSetIds) {
        try {
          const redeemedIds = JSON.parse(redeemedQuestionSetIds);
          
          // 标准化当前题库ID
          const normalizedCurrentId = String(questionSet.id).trim();
          console.log(`[QuizPage] 当前题库ID (标准化): "${normalizedCurrentId}"`);
          
          // 检查是否已兑换，使用一致的ID格式比较
          if (Array.isArray(redeemedIds)) {
            // 输出所有已兑换ID，以便调试
            console.log('[QuizPage] 所有已兑换题库IDs:', redeemedIds);
            
            // 将所有ID标准化后再比较
            const isRedeemed = redeemedIds.some((id) => String(id).trim() === normalizedCurrentId);
            console.log(`[QuizPage] 题库 ${normalizedCurrentId} 是否已兑换: ${isRedeemed}`);
            
            if (isRedeemed) {
              console.log(`[QuizPage] 检测到题库 ${normalizedCurrentId} 已兑换记录，启用完整访问权限`);
              setHasRedeemed(true);
              setHasAccessToFullQuiz(true);
              setTrialEnded(false);
            }
          } else {
            console.log('[QuizPage] localStorage中的redeemedQuestionSetIds不是数组:', redeemedIds);
          }
        } catch (e) {
          console.error('解析已兑换题库ID列表失败', e);
        }
      } else {
        console.log('[QuizPage] localStorage中未找到已兑换题库记录');
      }
    }
  }, [questionSet?.id]);
  
  // 保存已兑换的题库ID到localStorage
  const saveRedeemedQuestionSetId = (questionSetId: string) => {
    console.log(`[QuizPage] 保存已兑换题库ID: ${questionSetId}`);
    
    if (!questionSetId) {
      console.error('[QuizPage] 无法保存空的题库ID');
      return;
    }
    
    try {
      const normalizedId = String(questionSetId).trim();
      console.log(`[QuizPage] 规范化题库ID: ${normalizedId}`);
      
      // 获取现有的已兑换题库IDs
      const redeemedQuestionSetIds = localStorage.getItem('redeemedQuestionSetIds');
      console.log(`[QuizPage] 现有的已兑换题库IDs: ${redeemedQuestionSetIds}`);
      
      let newList = '';
      
      if (redeemedQuestionSetIds) {
        try {
          const parsed = JSON.parse(redeemedQuestionSetIds);
          console.log('[QuizPage] 解析的已兑换题库IDs:', parsed);
          
          // 检查是否已存在
          if (Array.isArray(parsed) && !parsed.includes(normalizedId)) {
            parsed.push(normalizedId);
            newList = JSON.stringify(parsed);
          } else if (typeof parsed === 'string' && parsed !== normalizedId) {
            newList = JSON.stringify([parsed, normalizedId]);
          } else {
            newList = JSON.stringify([normalizedId]);
          }
        } catch (error) {
          console.error('[QuizPage] 解析已兑换题库IDs失败:', error);
          newList = JSON.stringify([normalizedId]);
        }
      } else {
        newList = JSON.stringify([normalizedId]);
      }
      
      console.log('[QuizPage] 保存新的已兑换题库IDs列表:', newList);
      localStorage.setItem('redeemedQuestionSetIds', newList);
    } catch (error) {
      console.error('[QuizPage] 保存已兑换题库ID失败:', error);
    }
  };
  
  // 监听兑换码成功事件
  useEffect(() => {
    const handleRedeemSuccess = (e: Event) => {
      console.log('[QuizPage] 收到兑换成功事件');
      const customEvent = e as CustomEvent;
      
      // 从事件中获取题库ID
      const eventQuestionSetId = String(customEvent.detail?.questionSetId || '').trim();
      
      // 兼容旧版本事件中可能存在的quizId
      const quizId = String(customEvent.detail?.quizId || '').trim();
      const effectiveId = eventQuestionSetId || quizId; // 优先使用questionSetId
      
      const currentQuestionSetId = String(questionSet?.id || '').trim();
      
      console.log(`[QuizPage] 比较ID: 事件ID=${effectiveId}, 当前题库ID=${currentQuestionSetId}`);
      
      // 更新本地状态和存储
      if (questionSet) {
        console.log('[QuizPage] 更新本地状态和存储');
        setHasAccessToFullQuiz(true);
        setTrialEnded(false);
        setHasRedeemed(true);
        
        // 保存访问权限到localStorage
        if (effectiveId) {
          saveAccessToLocalStorage(effectiveId, true);
        }
        
        // 如果当前题库ID与事件ID不同，也保存当前题库的访问权限
        if (currentQuestionSetId && currentQuestionSetId !== effectiveId) {
          saveAccessToLocalStorage(currentQuestionSetId, true);
        }
        
        // 保存已兑换的题库ID
        if (effectiveId) {
          saveRedeemedQuestionSetId(effectiveId);
        } else if (currentQuestionSetId) {
          saveRedeemedQuestionSetId(currentQuestionSetId);
        }
        
        // 刷新数据
        if (effectiveId === currentQuestionSetId || customEvent.detail?.forceRefresh) {
          console.log('[QuizPage] 强制刷新数据');
          checkAccess();
        }
      }
    };
    
    // 添加事件监听器
    window.addEventListener('redeem:success', handleRedeemSuccess);
    
    return () => {
      window.removeEventListener('redeem:success', handleRedeemSuccess);
    };
  }, [questionSet, checkAccess]);
  
  // 监听模态窗口状态变化，重新检查访问权限
  useEffect(() => {
    if (!showPaymentModal && !showRedeemCodeModal) {
      // 模态窗口关闭时，再次检查访问权限，确保状态一致
      console.log('[QuizPage] 模态窗口关闭，重新检查访问权限');
      checkAccess();
    }
  }, [showPaymentModal, showRedeemCodeModal]);
  
  // 处理选择选项
  const handleOptionSelect = (optionId: string) => {
    // 如果试用已结束且没有购买，不允许继续答题
    // 但如果已经兑换了代码，则忽略此限制
    if (trialEnded && !hasAccessToFullQuiz && !hasRedeemed) {
      return;
    }
    
    const currentQuestion = questions[currentQuestionIndex];
    
    if (currentQuestion.questionType === 'single') {
      setSelectedOptions([optionId]);
    } else {
      // 多选题，切换选中状态
      if (selectedOptions.includes(optionId)) {
        setSelectedOptions(selectedOptions.filter((id) => id !== optionId));
      } else {
        setSelectedOptions([...selectedOptions, optionId]);
      }
    }
  };
  
  // 处理答案提交
  const handleAnswerSubmit = async (isCorrect: boolean, selectedOpt: string | string[]): Promise<void> => {
    if (!questions[currentQuestionIndex] || !user || !socket || !questionSet) return;

    const timeSpent = Math.floor((Date.now() - questionStartTime) / 1000);

    try {
      // 保存进度到后端
      const saveResponse = await userProgressService.saveProgress({
        questionId: String(questions[currentQuestionIndex].id),
        questionSetId: questionSet.id,
        selectedOption: selectedOpt,
        isCorrect,
        timeSpent,
        // @ts-expect-error Using any here as the type is complex and unknown
        lastQuestionIndex: currentQuestionIndex,
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

      // 发送进度更新事件，包含最后题目索引
      const progressEvent = { 
        userId: user.id,
        questionSetId: questionSet.id,
        questionId: String(questions[currentQuestionIndex].id),
        isCorrect,
        timeSpent,
        completedQuestions: (user.progress?.[questionSet.id]?.completedQuestions || 0) + (isCorrect ? 1 : 0),
        totalQuestions: questions.length,
        correctAnswers: (user.progress?.[questionSet.id]?.correctAnswers || 0) + (isCorrect ? 1 : 0),
        lastAccessed: new Date().toISOString(),
        lastQuestionIndex: currentQuestionIndex, // 添加当前题目索引
      };
      
      socket.emit('progress:update', progressEvent);

      // 更新本地状态
      if (isCorrect) {
        setCorrectAnswers((prev) => prev + 1);
      }
      
      // 显示解析
      setShowExplanation(true);

      // 更新已回答问题列表
      const newAnsweredQuestion = {
        index: currentQuestionIndex,
        isCorrect,
        selectedOption: selectedOpt, // 使用从QuestionCard传入的选项
      };
      
      setAnsweredQuestions((prev) => [...prev, newAnsweredQuestion]);

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
  
  // 在组件挂载时检查localStorage中的访问权限
  useEffect(() => {
    console.log('[QuizPage] 组件挂载，检查localStorage中的访问权限');
    
    if (questionSet?.id) {
      // 检查localStorage中是否有访问权限
      const hasStoredAccess = getAccessFromLocalStorage(questionSet.id);
      
      if (hasStoredAccess) {
        console.log(`[QuizPage] 本地存储中发现题库 ${questionSet.id} 的访问权限`);
        setHasAccessToFullQuiz(true);
        setTrialEnded(false);
      }
      
      // 检查localStorage中是否有已兑换记录
      const redeemedQuestionSetIds = localStorage.getItem('redeemedQuestionSetIds');
      if (redeemedQuestionSetIds) {
        try {
          const redeemedIds = JSON.parse(redeemedQuestionSetIds);
          const normalizedCurrentId = String(questionSet.id).trim();
          
          if (Array.isArray(redeemedIds)) {
            const isRedeemed = redeemedIds.some((id) => String(id).trim() === normalizedCurrentId);
            console.log(`[QuizPage] 题库 ${normalizedCurrentId} 是否已兑换: ${isRedeemed}`);
            
            if (isRedeemed) {
              console.log('[QuizPage] 题库已兑换，设置状态');
              setHasRedeemed(true);
              setHasAccessToFullQuiz(true);
              setTrialEnded(false);
            }
          }
        } catch (e) {
          console.error('[QuizPage] 检查localStorage兑换状态失败', e);
        }
      }
    }
  }, [questionSet?.id, getAccessFromLocalStorage]);
  
  // 初始化访问状态 - 在题库信息加载后执行
  useEffect(() => {
    if (questionSet?.id && !loading) {
      const hasStoredAccess = getAccessFromLocalStorage(questionSet.id);
      console.log(`[QuizPage] 题库 ${questionSet.id} 完成加载，检查本地存储访问权限: ${hasStoredAccess}`);
      
      if (hasStoredAccess) {
        console.log(`[QuizPage] 本地存储显示题库 ${questionSet.id} 有访问权限，设置状态`);
        setHasAccessToFullQuiz(true);
        setTrialEnded(false);
        
        // 通知服务器确认访问权限
        if (socket && user) {
          socket.emit('questionSet:accessUpdate', {
            userId: user.id,
            questionSetId: String(questionSet.id).trim(),
            hasAccess: true,
            source: 'localStorage',
          });
        }
      }
    }
  }, [questionSet?.id, loading, getAccessFromLocalStorage, socket, user]);
  
  // 随机题目顺序的函数
  const shuffleQuestions = () => {
    if (originalQuestions.length === 0) return;
    
    // 使用Fisher-Yates算法打乱题目顺序
    const shuffled = [...originalQuestions];
    for (let i = shuffled.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [shuffled[i], shuffled[j]] = [shuffled[j], shuffled[i]];
    }
    
    setQuestions(shuffled);
    setCurrentQuestionIndex(0);
    setSelectedOptions([]);
    setIsRandomMode(true);
  };

  // 恢复原始题目顺序
  const restoreOriginalOrder = () => {
    setQuestions([...originalQuestions]);
    setCurrentQuestionIndex(0);
    setSelectedOptions([]);
    setIsRandomMode(false);
  };
  
  // 在函数组件中添加错题保存逻辑
  useEffect(() => {
    // 监听错题保存事件
    const saveWrongAnswer = async (event: CustomEvent<any>) => {
      if (!user) return;
      
      try {
        console.log('保存错题:', event.detail);
        await wrongAnswerService.saveWrongAnswer(event.detail);
        console.log('错题保存成功');
      } catch (error) {
        console.error('保存错题失败:', error);
      }
    };

    // 添加自定义事件监听
    window.addEventListener('wrongAnswer:save', saveWrongAnswer as unknown as EventListener);
    
    // 组件卸载时移除监听
    return () => {
      window.removeEventListener('wrongAnswer:save', saveWrongAnswer as unknown as EventListener);
    };
  }, [user]);
  
  // 在现有的useEffect中增强获取用户进度的逻辑
  useEffect(() => {
    if (questionSet?.id && user?.id && questions.length > 0 && !loading) {
      console.log('[QuizPage] 尝试加载上次进度...');
      
      // 检查用户是否有进度记录
      const fetchLastProgress = async () => {
        try {
          // 获取题库的进度数据
          const response = await userProgressService.getProgressByQuestionSetId(questionSet.id);
          
          if (response.success && response.data) {
            const progressData = response.data;
            console.log('[QuizPage] 获取到进度数据:', progressData);
            
            // 如果有保存的最后题目索引，直接使用
            if (progressData.lastQuestionIndex !== undefined && 
                progressData.lastQuestionIndex >= 0 && 
                progressData.lastQuestionIndex < questions.length) {
              console.log(`[QuizPage] 从上次进度开始: 第${progressData.lastQuestionIndex + 1}题`);
              setCurrentQuestionIndex(progressData.lastQuestionIndex);
              
              // 重置选项状态，确保从干净状态开始
              setSelectedOptions([]);
              setShowExplanation(false);
              
              // 更新已回答问题列表，确保答题卡显示正确
              if (progressData.answeredQuestions && Array.isArray(progressData.answeredQuestions)) {
                const answeredQs = progressData.answeredQuestions.map((q: any) => ({
                  index: q.questionIndex || q.index || 0,
                  isCorrect: q.isCorrect || false,
                  selectedOption: q.selectedOption || q.selectedOptionId || '',
                }));
                console.log('[QuizPage] 重建已答题列表:', answeredQs);
                setAnsweredQuestions(answeredQs);
              }
            } 
            // 否则尝试根据已回答题目数决定从哪里开始
            else if (progressData.answeredQuestions && progressData.answeredQuestions.length > 0) {
              // 找出最大的已答题索引
              const lastAnsweredIndex = Math.max(
                ...progressData.answeredQuestions.map((q: any) => q.questionIndex || q.index || 0)
              );
              // 从下一题开始
              const nextIndex = Math.min(lastAnsweredIndex + 1, questions.length - 1);
              console.log(`[QuizPage] 根据已答题记录设置位置: 第${nextIndex + 1}题`);
              setCurrentQuestionIndex(nextIndex);
              
              // 更新已回答问题列表
              const answeredQs = progressData.answeredQuestions.map((q: any) => ({
                index: q.questionIndex || q.index || 0,
                isCorrect: q.isCorrect || false,
                selectedOption: q.selectedOptionId || q.selectedOption || '',
              }));
              console.log('[QuizPage] 重建已答题列表:', answeredQs);
              setAnsweredQuestions(answeredQs);
            }
          }
        } catch (error) {
          console.error('[QuizPage] 加载上次进度失败:', error);
        }
      };
      
      fetchLastProgress();
    }
  }, [questionSet?.id, user?.id, questions.length, loading]);

  // 添加强化的跨设备访问权限验证函数
  const getAccessAllSources = useCallback(() => {
    if (!questionSet?.id) return false;
    
    console.log(`[QuizPage] 全面检查题库 ${questionSet.id} 的访问权限`);
    
    // 1. 检查基础访问标志
    let hasAccess = hasAccessToFullQuiz;
    console.log(`[QuizPage] 基础访问权限状态: ${hasAccess}`);
    
    // 2. 检查localStorage中的访问权限 - 兼容多格式
    try {
      // 检查访问权限缓存
      const accessRightsStr = localStorage.getItem('quizAccessRights');
      if (accessRightsStr) {
        const accessRights = JSON.parse(accessRightsStr);
        const localAccess = !!accessRights[questionSet.id];
        console.log(`[QuizPage] localStorage访问权限: ${localAccess}`);
        hasAccess = hasAccess || localAccess;
      }
      
      // 检查兑换记录 - 使用更灵活的ID匹配
      const redeemedStr = localStorage.getItem('redeemedQuestionSetIds');
      if (redeemedStr) {
        const redeemedIds = JSON.parse(redeemedStr);
        if (Array.isArray(redeemedIds)) {
          // 标准化ID比较
          const targetId = String(questionSet.id).trim();
          
          // 更灵活的ID匹配逻辑 
          const isRedeemed = redeemedIds.some((id) => {
            const redeemedId = String(id || '').trim();
            
            // 精确匹配
            const exactMatch = redeemedId === targetId;
            
            // 部分匹配 - 当ID格式可能有差异但本质上是同一个ID时
            const partialMatch = (redeemedId.includes(targetId) || targetId.includes(redeemedId)) 
              && Math.abs(redeemedId.length - targetId.length) <= 3
              && redeemedId.length > 5 && targetId.length > 5;
              
            return exactMatch || partialMatch;
          });
          
          console.log(`[QuizPage] localStorage兑换记录匹配: ${isRedeemed}`);
          hasAccess = hasAccess || isRedeemed;
        }
      }
    } catch (e) {
      console.error('[QuizPage] 检查本地存储访问权限时出错:', e);
    }
    
    // 3. 检查购买记录 (如果存在)
    const hasPurchase = user?.purchases?.some((p) => 
      String(p.questionSetId).trim() === String(questionSet.id).trim()
    );
    
    if (hasPurchase) {
      console.log('[QuizPage] 用户有此题库的购买记录');
      hasAccess = true;
    }
    
    // 4. 检查是否为免费题库
    if (!questionSet.isPaid) {
      console.log('[QuizPage] 题库为免费题库');
      hasAccess = true;
    }
    
    // 如果用户有访问权限，立即更新状态
    if (hasAccess && !hasAccessToFullQuiz) {
      console.log('[QuizPage] 设置访问状态为true');
      setHasAccessToFullQuiz(true);
    }
    
    return hasAccess;
  }, [questionSet?.id, hasAccessToFullQuiz, user?.purchases]);
  
  // 使用增强的访问权限检查函数
  const shouldShowPurchasePrompt = () => {
    // 如果没有加载完成或者出错，不显示提示
    if (!questionSet || error || loading) return false;
    
    // 使用全面的访问权限检查
    const hasFullAccess = getAccessAllSources();
    
    // 只有在以下情况才显示购买提示：
    // 1. 确实是付费题库
    // 2. 用户没有任何访问权限
    // 3. 已经超过试用题目数量
    return (
      questionSet.isPaid && 
      !hasFullAccess && 
      questionSet.trialQuestions !== undefined && 
      questionSet.trialQuestions !== null &&
      answeredQuestions.length >= questionSet.trialQuestions
    );
  };
  
  // 修复跨设备同步问题 - 确保页面加载完成后立即执行全面权限检查
  useEffect(() => {
    if (!questionSet || !user?.id) return;
    
    console.log('[QuizPage] 页面加载完成，立即进行全面权限检查');
    
    // 使用延时确保DOM和状态已完全加载
    const timer = setTimeout(() => {
      // 执行全面权限检查
      const hasAccess = checkFullAccessFromAllSources();
      console.log(`[QuizPage] 初始化权限检查结果: ${hasAccess}`);
      
      // 如果发现有访问权限，立即更新状态和界面
      if (hasAccess) {
        setHasAccessToFullQuiz(true);
        setTrialEnded(false);
        
        // 通知服务器更新权限状态（跨设备同步）
        if (socket) {
          console.log('[QuizPage] 向服务器同步权限状态');
          socket.emit('questionSet:accessUpdate', {
            userId: user.id,
            questionSetId: String(questionSet.id).trim(),
            hasAccess: true,
            source: 'pageInit',
          });
        }
      }
    }, 500); // 给予足够时间让其他useEffect完成
    
    return () => clearTimeout(timer);
  }, [questionSet?.id, user?.id, checkFullAccessFromAllSources]);
  
  // 监听用户切换设备和登录事件
  useEffect(() => {
    if (!socket || !user?.id) return;
    
    // 用户切换设备事件处理
    const handleDeviceSync = (data: any) => {
      console.log('[QuizPage] 收到设备同步事件', data);
      
      // 如果收到同步事件，强制重新检查权限
      if (questionSet) {
        checkAccess();
      }
    };
    
    // 监听设备同步事件
    socket.on('user:deviceSync', handleDeviceSync);
    
    // 发送设备同步请求
    socket.emit('user:requestDeviceSync', {
      userId: user.id,
      deviceInfo: {
        userAgent: navigator.userAgent,
        timestamp: Date.now(),
      },
    });
    
    return () => {
      socket.off('user:deviceSync', handleDeviceSync);
    };
  }, [socket, user?.id, questionSet]);
  
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
  
  // 在这里检查是否应该显示购买提示
  if (shouldShowPurchasePrompt()) {
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
              console.log('[QuizPage] 支付成功回调，更新访问权限');
              setHasAccessToFullQuiz(true);
              setTrialEnded(false);
              setShowPaymentModal(false);
              
              // 保存访问权限到localStorage
              if (questionSet) {
                saveAccessToLocalStorage(questionSet.id, true);
              }
              
              // 尝试通过Socket再次检查权限，确保状态一致性
              if (socket && user) {
                setTimeout(() => {
                  console.log('[QuizPage] 支付成功后检查权限');
                  socket.emit('questionSet:checkAccess', {
                    userId: user.id,
                    questionSetId: String(questionSet.id).trim(),
                  });
                  
                  // 明确告知服务器更新访问权限
                  socket.emit('questionSet:accessUpdate', {
                    userId: user.id,
                    questionSetId: String(questionSet.id).trim(),
                    hasAccess: true,
                    source: 'payment',
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
              <RedeemCodeForm onRedeemSuccess={(questionSetId) => {
                console.log(`[QuizPage] 兑换码成功回调，题库ID: ${questionSetId}`);
                setShowRedeemCodeModal(false);
                
                // 立即更新UI状态
                console.log('[QuizPage] 直接设置访问权限为true和重置试用状态');
                setHasAccessToFullQuiz(true);
                setTrialEnded(false);
                setHasRedeemed(true); // 标记为已兑换
                
                // 保存访问权限到localStorage
                saveAccessToLocalStorage(questionSetId, true);
                if (questionSet) {
                  saveAccessToLocalStorage(questionSet.id, true);
                }
                
                // 保存已兑换状态到localStorage
                saveRedeemedQuestionSetId(questionSetId);
                
                // 延迟发送自定义事件确保完整处理
                setTimeout(() => {
                  if (typeof window !== 'undefined') {
                    window.dispatchEvent(new CustomEvent('redeem:success', { 
                      detail: { 
                        questionSetId, 
                        forceRefresh: true,
                        source: 'QuizPageRedeemForm',
                        timestamp: Date.now(),
                      }, 
                    }));
                  }
                }, 200);
                
                // 后台异步执行权限检查以确保数据完整性
                setTimeout(() => {
                  console.log('[QuizPage] 后台检查访问权限');
                  checkAccess();
                  
                  // 通过Socket请求确认权限
                  if (socket && user && questionSet) {
                    console.log('[QuizPage] 通过Socket请求确认权限');
                    socket.emit('questionSet:checkAccess', {
                      userId: user.id,
                      questionSetId: String(questionSet.id).trim(),
                    });
                    
                    // 明确设置访问权限
                    socket.emit('questionSet:accessUpdate', {
                      userId: user.id,
                      questionSetId: String(questionSet.id).trim(),
                      hasAccess: true,
                      source: 'redemption',
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
        
        {/* 只有免费题库或已购买题库才显示答题卡和随机模式切换 */}
        {(!questionSet.isPaid || hasAccessToFullQuiz || hasRedeemed) && (
          <div className="flex flex-col space-y-4">
            {/* 随机模式切换 */}
            <div className="flex items-center justify-between">
              <div className="flex items-center">
                <span className="mr-2 text-sm font-medium text-gray-700">随机答题模式:</span>
                <button
                  onClick={isRandomMode ? restoreOriginalOrder : shuffleQuestions}
                  className={`px-3 py-1 text-sm rounded-md ${
                    isRandomMode 
                      ? 'bg-red-100 text-red-700 hover:bg-red-200' 
                      : 'bg-blue-100 text-blue-700 hover:bg-blue-200'
                  } transition-colors`}
                >
                  {isRandomMode ? '恢复顺序' : '打乱题目'}
                </button>
              </div>
              {isRandomMode && (
                <span className="text-xs text-orange-600">随机模式下，题目顺序已被打乱</span>
              )}
            </div>
            
            {/* 答题卡组件 */}
            <AnswerCard
              totalQuestions={questions.length}
              answeredQuestions={answeredQuestions}
              currentIndex={currentQuestionIndex}
              onJump={(index) => {
                // 如果试用已结束且没有购买，不允许跳转
                if (trialEnded && !hasAccessToFullQuiz && !hasRedeemed) {
                  console.log(`[QuizPage] 试用已结束，无法跳转到第 ${index + 1} 题`);
                  return;
                }
                
                // 确保没有未提交的答案
                const isCurrentQuestionSubmitted = answeredQuestions.some((q) => q.index === currentQuestionIndex);
                if (!isCurrentQuestionSubmitted && currentQuestionIndex !== index) {
                  if (confirm('当前题目尚未提交答案，确定要离开吗？')) {
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
          </div>
        )}
        
        {/* 进度条 */}
        <div className="w-full bg-gray-200 rounded-full h-2.5 mb-4">
          <div 
            className="bg-blue-600 h-2.5 rounded-full" 
            style={{ width: `${(currentQuestionIndex / questions.length) * 100}%` }}
          />
        </div>
        
        {/* 上一题/下一题按钮导航 */}
        <div className="flex justify-between mb-6">
          <button
            onClick={() => currentQuestionIndex > 0 && setCurrentQuestionIndex(currentQuestionIndex - 1)}
            disabled={currentQuestionIndex === 0}
            className={`py-2 px-4 rounded-lg flex items-center transition-colors duration-200 
              ${currentQuestionIndex > 0 
                ? 'bg-gray-100 hover:bg-gray-200 text-gray-700' 
                : 'bg-gray-100 text-gray-400 cursor-not-allowed opacity-50'}`}
          >
            <svg className="w-5 h-5 mr-1" fill="none" stroke="currentColor" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
            </svg>
            上一题
          </button>
          
          <div className="text-sm text-gray-500 flex items-center">
            {currentQuestionIndex + 1} / {questions.length} 
            <span className="ml-2">已回答 {answeredQuestions.length} 题</span>
          </div>
          
          <button
            onClick={() => {
              // 检查当前是否已回答此题
              const isAnswered = answeredQuestions.some((q) => q.index === currentQuestionIndex);
              
              // 如果已回答并且在不是最后一题，直接到下一题
              if (isAnswered && currentQuestionIndex < questions.length - 1) {
                setCurrentQuestionIndex(currentQuestionIndex + 1);
              } else {
                // 未回答时，显示提示
                if (!isAnswered) {
                  toast.warning('请先回答当前题目');
                } else if (currentQuestionIndex >= questions.length - 1) {
                  toast.info('已经是最后一题了');
                }
              }
            }}
            disabled={currentQuestionIndex >= questions.length - 1}
            className={`py-2 px-4 rounded-lg flex items-center transition-colors duration-200 
              ${currentQuestionIndex < questions.length - 1
                ? 'bg-blue-600 hover:bg-blue-700 text-white' 
                : 'bg-gray-100 text-gray-400 cursor-not-allowed opacity-50'}`}
          >
            下一题
            <svg className="w-5 h-5 ml-1" fill="none" stroke="currentColor" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
            </svg>
          </button>
        </div>
      </div>
      
      {/* 当前题目 */}
      {questions.length > 0 && currentQuestionIndex < questions.length && (
        <QuestionCard
          key={`question-${currentQuestionIndex}`}
          question={questions[currentQuestionIndex]}
          onAnswerSubmitted={handleAnswerSubmit}
          onNext={goToNextQuestion}
          isLast={currentQuestionIndex === questions.length - 1}
          isSubmittingAnswer={false}
          questionSetId={questionSet?.id || ''} // 传递问题集ID
        />
      )}
      
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
            <RedeemCodeForm onRedeemSuccess={(questionSetId) => {
              console.log(`[QuizPage] 兑换码成功回调，题库ID: ${questionSetId}`);
              setShowRedeemCodeModal(false);
              
              // 立即更新UI状态
              console.log('[QuizPage] 直接设置访问权限为true和重置试用状态');
              setHasAccessToFullQuiz(true);
              setTrialEnded(false);
              setHasRedeemed(true); // 标记为已兑换
              
              // 保存访问权限到localStorage
              saveAccessToLocalStorage(questionSetId, true);
              if (questionSet) {
                saveAccessToLocalStorage(questionSet.id, true);
              }
              
              // 保存已兑换状态到localStorage
              saveRedeemedQuestionSetId(questionSetId);
              
              // 延迟发送自定义事件确保完整处理
              setTimeout(() => {
                if (typeof window !== 'undefined') {
                  window.dispatchEvent(new CustomEvent('redeem:success', { 
                    detail: { 
                      questionSetId, 
                      forceRefresh: true,
                      source: 'QuizPageRedeemForm',
                      timestamp: Date.now(),
                    }, 
                  }));
                }
              }, 200);
              
              // 后台异步执行权限检查以确保数据完整性
              setTimeout(() => {
                console.log('[QuizPage] 后台检查访问权限');
                checkAccess();
                
                // 通过Socket请求确认权限
                if (socket && user && questionSet) {
                  console.log('[QuizPage] 通过Socket请求确认权限');
                  socket.emit('questionSet:checkAccess', {
                    userId: user.id,
                    questionSetId: String(questionSet.id).trim(),
                  });
                  
                  // 明确设置访问权限
                  socket.emit('questionSet:accessUpdate', {
                    userId: user.id,
                    questionSetId: String(questionSet.id).trim(),
                    hasAccess: true,
                    source: 'redemption',
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
