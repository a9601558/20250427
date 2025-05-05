import { useState, useEffect, useRef, useCallback } from 'react';
import { useParams, useNavigate, useLocation } from 'react-router-dom';
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
  questionIndex?: number;
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
          const isAnswered = answeredQuestions.some(q => q.index === index);
          const isCorrect = answeredQuestions.some(q => q.index === index && q.isCorrect);
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

// 添加progressData接口定义
interface ProgressData {
  lastQuestionIndex?: number;
  answeredQuestions?: Array<{
    index: number;
    questionIndex?: number;
    isCorrect: boolean;
    selectedOption: string | string[];
    selectedOptionId?: string | string[];
  }>;
  [key: string]: any;
}

function QuizPage(): JSX.Element {
  const { questionSetId } = useParams<{ questionSetId: string }>();
  const navigate = useNavigate();
  const location = useLocation();
  const { user, hasAccessToQuestionSet, syncAccessRights } = useUser();
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
  
  // 存储上次提交时间的外部变量，使用useRef避免重新渲染时重置
  const lastSubmitTimeRef = useRef<number>(0);
  // 增加一个标记当前是否正在处理提交的ref
  const isSubmittingRef = useRef<boolean>(false);
  
  // 在state变量区域添加计时器相关状态
  const [quizStartTime, setQuizStartTime] = useState<number>(0); // 整个测试开始时间
  const [quizTotalTime, setQuizTotalTime] = useState<number>(0); // 整个测试用时（秒）
  const [isTimerActive, setIsTimerActive] = useState<boolean>(false); // 计时器是否激活
  
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
            const isRedeemed = redeemedIds.some(id => {
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
      const purchase = user.purchases.find(p => {
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
      console.log(`[QuizPage] 题库hasAccess属性: true`);
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
          source: 'crossDeviceSync'
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
      console.log(`[QuizPage] 用户有完整访问权限，设置trialEnded=false`);
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
      console.log(`[checkAccess] 全面检查发现用户有访问权限`);
      setHasAccessToFullQuiz(true);
      saveAccessToLocalStorage(questionSet.id, true);
      setTrialEnded(false);
      return;
    }
    
    // 如果用户已经兑换过码，直接授权访问并跳过所有其他检查
    if (hasRedeemed) {
      console.log(`[checkAccess] 用户已兑换码，直接授权访问`);
      setHasAccessToFullQuiz(true);
      saveAccessToLocalStorage(questionSet.id, true);
      setTrialEnded(false);
      return;
    }
    
    // 检查本地存储中的访问权限
    const localStorageAccess = getAccessFromLocalStorage(questionSet.id);
    if (localStorageAccess) {
      console.log(`[checkAccess] 本地存储显示用户有访问权限，直接授权访问`);
      setHasAccessToFullQuiz(true);
      setTrialEnded(false);
      return;
    }
    
    // 如果是免费题库，直接授权访问
    if (!questionSet.isPaid) {
      console.log(`[checkAccess] 免费题库，允许访问`);
      setHasAccessToFullQuiz(true);
      saveAccessToLocalStorage(questionSet.id, true);
      setTrialEnded(false); // 确保重置试用状态
      return;
    }
    
    // 未登录用户不检查权限，在需要时会提示登录
    if (!user) {
      console.log(`[checkAccess] 用户未登录，无权限`);
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
      const purchase = user.purchases.find(p => {
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
    saveAccessToLocalStorage(questionSet.id, hasAccess);
    
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
            updatedAt: new Date()
          };
          setQuestionSet(questionSetData);
          
          // 使用题库中包含的题目数据
          const questionsData = getQuestions(questionSetData);
          if (questionsData.length > 0) {
            console.log("获取到题目:", questionsData.length);
            
            // 处理题目选项并设置数据
            const processedQuestions = questionsData.map((q: any) => {
              // 确保选项存在
              if (!q.options || !Array.isArray(q.options)) {
                console.warn("题目缺少选项:", q.id);
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
                  label: getOptionLabel(index) // 添加字母标签
                };
              });
              
              return {
                ...q,
                options: processedOptions,
                // 确保correctAnswer字段与选项ID对应
                correctAnswer: q.questionType === 'single' 
                  ? processedOptions.find((opt: any) => opt.isCorrect)?.id
                  : processedOptions.filter((opt: any) => opt.isCorrect).map((opt: any) => opt.id)
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
      console.log(`[QuizPage] 检查localStorage存储的已兑换题库IDs:`, redeemedQuestionSetIds);
      
      if (redeemedQuestionSetIds) {
        try {
          const redeemedIds = JSON.parse(redeemedQuestionSetIds);
          
          // 标准化当前题库ID
          const normalizedCurrentId = String(questionSet.id).trim();
          console.log(`[QuizPage] 当前题库ID (标准化): "${normalizedCurrentId}"`);
          
          // 检查是否已兑换，使用一致的ID格式比较
          if (Array.isArray(redeemedIds)) {
            // 输出所有已兑换ID，以便调试
            console.log(`[QuizPage] 所有已兑换题库IDs:`, redeemedIds);
            
            // 将所有ID标准化后再比较
            const isRedeemed = redeemedIds.some(id => String(id).trim() === normalizedCurrentId);
            console.log(`[QuizPage] 题库 ${normalizedCurrentId} 是否已兑换: ${isRedeemed}`);
            
            if (isRedeemed) {
              console.log(`[QuizPage] 检测到题库 ${normalizedCurrentId} 已兑换记录，启用完整访问权限`);
              setHasRedeemed(true);
              setHasAccessToFullQuiz(true);
              setTrialEnded(false);
            }
          } else {
            console.log(`[QuizPage] localStorage中的redeemedQuestionSetIds不是数组:`, redeemedIds);
          }
        } catch (e) {
          console.error('解析已兑换题库ID列表失败', e);
        }
      } else {
        console.log(`[QuizPage] localStorage中未找到已兑换题库记录`);
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
          console.log(`[QuizPage] 解析的已兑换题库IDs:`, parsed);
          
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
      
      console.log(`[QuizPage] 保存新的已兑换题库IDs列表:`, newList);
      localStorage.setItem('redeemedQuestionSetIds', newList);
    } catch (error) {
      console.error('[QuizPage] 保存已兑换题库ID失败:', error);
    }
  };
  
  // 监听兑换码成功事件
  useEffect(() => {
    const handleRedeemSuccess = (e: Event) => {
      console.log(`[QuizPage] 收到兑换成功事件`);
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
        console.log(`[QuizPage] 更新本地状态和存储`);
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
          console.log(`[QuizPage] 强制刷新数据`);
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
        setSelectedOptions(selectedOptions.filter(id => id !== optionId));
      } else {
        setSelectedOptions([...selectedOptions, optionId]);
      }
    }
  };
  
  // 在QuizPage组件内部，在state声明区域添加一个同步状态标识
  const [lastSyncTime, setLastSyncTime] = useState<number>(0);
  const [pendingSync, setPendingSync] = useState<boolean>(false);
  const unsyncedChangesRef = useRef<boolean>(false);

  // 添加同步进度到服务器的函数
  const syncProgressToServer = useCallback(async (force: boolean = false) => {
    if (!user?.id || !questionSetId || !socket) return;
    
    // 如果没有未同步的更改且不是强制同步，则跳过
    if (!force && !unsyncedChangesRef.current) {
      console.log('[QuizPage] 没有未同步的进度数据');
      return;
    }
    
    // 防止频繁同步 - 如果距离上次同步不到10秒且不是强制同步，则跳过
    const now = Date.now();
    if (!force && (now - lastSyncTime < 10000)) {
      console.log('[QuizPage] 距离上次同步时间不足10秒，跳过');
      setPendingSync(true);
      return;
    }
    
    try {
      console.log('[QuizPage] 开始同步进度数据到服务器');
      setPendingSync(false);
      
      // 准备要发送的进度数据包
      const progressBundle = {
        userId: user.id,
        questionSetId,
        lastQuestionIndex: currentQuestionIndex,
        answeredQuestions,
        timeSpent: quizTotalTime,
        timestamp: new Date().toISOString()
      };
      
      // 通过socket将打包的进度数据同步到服务器
      socket.emit('progress:update', progressBundle);
      
      // 更新同步状态
      setLastSyncTime(now);
      unsyncedChangesRef.current = false;
      
      console.log('[QuizPage] 进度数据同步完成');
    } catch (error) {
      console.error('[QuizPage] 同步进度数据异常:', error);
      unsyncedChangesRef.current = true; // 标记为未同步
    }
  }, [user?.id, questionSetId, socket, currentQuestionIndex, answeredQuestions, quizTotalTime, lastSyncTime]);

  // 在组件挂载时检查是否有待同步的进度数据
  useEffect(() => {
    if (!user?.id || !questionSetId || !socket) return;
    
    // 检查localStorage中是否有待同步的数据
    try {
      const localProgressKey = `quiz_progress_${questionSetId}`;
      const localProgressStr = localStorage.getItem(localProgressKey);
      
      if (localProgressStr) {
        const localProgress = JSON.parse(localProgressStr);
        if (localProgress.pendingSync === true) {
          console.log('[QuizPage] 检测到上次会话有未同步的进度数据，尝试同步');
          
          // 准备要发送的进度数据包
          const progressBundle = {
            userId: user.id,
            questionSetId,
            lastQuestionIndex: localProgress.lastQuestionIndex,
            answeredQuestions: localProgress.answeredQuestions,
            timeSpent: quizTotalTime,
            timestamp: new Date().toISOString()
          };
          
          // 通过socket将打包的进度数据同步到服务器
          socket.emit('progress:update', progressBundle);
          console.log('[QuizPage] 已发送进度同步请求');
          
          // 清除pendingSync标记
          localStorage.setItem(localProgressKey, JSON.stringify({
            ...localProgress,
            pendingSync: false,
            lastSynced: new Date().toISOString()
          }));
        }
      }
    } catch (error) {
      console.error('[QuizPage] 检查待同步数据失败:', error);
    }
  }, [user?.id, questionSetId, socket, quizTotalTime]);

  // 修改handleAnswerSubmit函数，只在本地保存进度
  const handleAnswerSubmit = useCallback((isCorrect: boolean, selectedOption: string | string[]) => {
    if (isSubmittingRef.current) {
      console.log('已在提交答案中，忽略重复请求');
      return;
    }

    const currentQuestion = questions[currentQuestionIndex];
    if (!currentQuestion) {
      console.error('当前问题数据不存在');
      return;
    }

    // 设置提交状态
    isSubmittingRef.current = true;

    // 确保selectedOption总是字符串数组
    const optionIds = Array.isArray(selectedOption) ? selectedOption : [selectedOption];

    // 更新当前问题的状态
    const updatedAnsweredQuestions = [...answeredQuestions];
    const timeSpent = quizStartTime ? (Date.now() - quizStartTime) / 1000 : 0;

    // 检查是否已经回答过这个问题
    const existingAnswerIndex = updatedAnsweredQuestions.findIndex(
      q => q.questionIndex === currentQuestionIndex
    );

    if (existingAnswerIndex !== -1) {
      // 更新已存在的答案
      updatedAnsweredQuestions[existingAnswerIndex] = {
        ...updatedAnsweredQuestions[existingAnswerIndex],
        isCorrect,
        selectedOption: optionIds,
      };
    } else {
      // 添加新的答案
      updatedAnsweredQuestions.push({
        index: updatedAnsweredQuestions.length,
        questionIndex: currentQuestionIndex,
        isCorrect,
        selectedOption: optionIds,
      });
    }

    setAnsweredQuestions(updatedAnsweredQuestions);

    // 仅更新本地进度
    console.log("[QuizPage] 更新本地进度:", updatedAnsweredQuestions.length);
    
    // 更新本地存储
    const localProgressKey = `quiz_progress_${questionSetId}`;
    localStorage.setItem(localProgressKey, JSON.stringify({
      lastQuestionIndex: currentQuestionIndex,
      answeredQuestions: updatedAnsweredQuestions,
      lastUpdated: new Date().toISOString()
    }));

    // 标记有未同步的更改
    unsyncedChangesRef.current = true;
    
    // 答题完成后更新总时间
    if (isTimerActive && updatedAnsweredQuestions.length === questions.length) {
      setIsTimerActive(false);
      setQuizTotalTime(timeSpent);
      
      // 全部完成时同步进度
      if (socket && user?.id) {
        // 延迟一点执行，确保状态已更新
        setTimeout(() => {
          syncProgressToServer(true);
          
          // 发送完成事件
          socket.emit('quiz:complete', {
            questionSetId,
            totalTime: timeSpent,
            correctCount: updatedAnsweredQuestions.filter(q => q.isCorrect).length,
            totalCount: questions.length
          });
        }, 300);
      }
    }

    // 重置提交状态
    setTimeout(() => {
      isSubmittingRef.current = false;
    }, 800);
  }, [
    currentQuestionIndex, 
    answeredQuestions, 
    questionSetId, 
    socket, 
    user?.id,
    quizStartTime,
    questions.length,
    isTimerActive,
    syncProgressToServer
  ]);

  // 在handleNextQuestion函数后添加定期同步逻辑
  const handleNextQuestion = useCallback(() => {
    // 如果有未同步的数据且已经累积了多个回答，定期同步
    if (unsyncedChangesRef.current && answeredQuestions.length > 0 && answeredQuestions.length % 5 === 0) {
      // 每答完5题同步一次
      syncProgressToServer();
    }
    
    // 如果已经是最后一题，标记为完成并同步所有数据
    if (currentQuestionIndex === questions.length - 1) {
      syncProgressToServer(true).then(() => {
        setQuizComplete(true);
      });
      return;
    }
    
    // 否则跳转到下一题
    setCurrentQuestionIndex(prevIndex => prevIndex + 1);
    setSelectedOptions([]);
    setShowExplanation(false);
  }, [currentQuestionIndex, questions.length, answeredQuestions.length, syncProgressToServer]);

  // 添加定期同步逻辑
  useEffect(() => {
    // 如果有未同步的更改且之前因为时间间隔太短而跳过了同步
    if (pendingSync && unsyncedChangesRef.current) {
      const syncTimer = setTimeout(() => {
        syncProgressToServer();
      }, 10000); // 10秒后再次尝试同步
      
      return () => clearTimeout(syncTimer);
    }
  }, [pendingSync, syncProgressToServer]);

  // 添加定期同步的定时器
  useEffect(() => {
    // 如果用户已登录且有题目数据，设置定期同步
    if (user?.id && questions.length > 0) {
      // 每5分钟同步一次未同步的进度
      const syncInterval = setInterval(() => {
        if (unsyncedChangesRef.current) {
          console.log('[QuizPage] 定期同步进度数据');
          syncProgressToServer();
        }
      }, 5 * 60 * 1000); // 5分钟
      
      return () => clearInterval(syncInterval);
    }
  }, [user?.id, questions.length, syncProgressToServer]);

  // 处理跳转到特定题目
  const handleJumpToQuestion = useCallback((index: number) => {
    // 检查是否是有效的问题索引
    if (index >= 0 && index < questions.length) {
      setCurrentQuestionIndex(index);
      // 更新本地存储中的最后访问问题
      const progressData = {
        questionSetId,
        lastQuestionIndex: index,
        answeredQuestions,
        lastUpdated: new Date().toISOString()
      };
      
      const localProgressKey = `quiz_progress_${questionSetId}`;
      localStorage.setItem(localProgressKey, JSON.stringify(progressData));
    }
  }, [questions.length, questionSetId, answeredQuestions]);

  // 渲染内容
  const renderContent = () => {
    if (loading) {
      return (
        <div className="flex justify-center items-center h-64">
          <div className="w-16 h-16 border-t-4 border-blue-500 border-solid rounded-full animate-spin"></div>
        </div>
      );
    }

    if (error) {
      return (
        <div className="text-center py-12">
          <div className="text-red-500 text-xl mb-4">加载失败</div>
          <p className="text-gray-600 mb-6">{error}</p>
          <button 
            onClick={() => {window.location.reload()}}
            className="px-4 py-2 bg-blue-500 text-white rounded hover:bg-blue-600"
          >
            重试
          </button>
        </div>
      );
    }

    if (questions.length === 0) {
      return (
        <div className="text-center py-12">
          <div className="text-xl mb-4">没有找到问题</div>
          <p className="text-gray-600 mb-6">该题库暂无内容或您可能没有访问权限</p>
          <button 
            onClick={() => {navigate('/')}}
            className="px-4 py-2 bg-blue-500 text-white rounded hover:bg-blue-600"
          >
            返回首页
          </button>
        </div>
      );
    }

    if (quizComplete) {
      // 计算统计数据
      const correctCount = answeredQuestions.filter(q => q.isCorrect).length;
      const totalCount = questions.length;
      const accuracy = Math.round((correctCount / totalCount) * 100);
      
      // 格式化用时
      const formatTime = (seconds: number) => {
        const mins = Math.floor(seconds / 60);
        const secs = Math.floor(seconds % 60);
        return `${mins}分${secs}秒`;
      };
      
      // 添加获取访问状态
      const getAccessStatusText = () => {
        if (!questionSet) return '';
        
        if (!questionSet.isPaid) {
          return '免费题库';
        }
        
        if (hasAccessToFullQuiz) {
          // 简化实现，返回一个固定文本
          return `付费题库 (已购买)`;
        }
        
        return '付费题库 (未购买)';
      };

      return (
        <div className="bg-white rounded-xl shadow-md p-6 max-w-3xl mx-auto">
          <div className="text-center mb-6">
            <div className="inline-block p-4 rounded-full bg-green-100 text-green-600 mb-4">
              <svg className="w-10 h-10" fill="none" stroke="currentColor" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
              </svg>
            </div>
            <h2 className="text-2xl font-bold text-gray-800 mb-2">完成练习!</h2>
            <p className="text-gray-600">{questionSet?.title || '未知题库'}</p>
            
            {/* 添加题库类型和有效期信息 */}
            <div className="mt-2 text-sm text-gray-500">
              {getAccessStatusText()}
            </div>
          </div>
          
          <div className="grid grid-cols-2 gap-4 mb-8">
            <div className="bg-blue-50 rounded-lg p-4 text-center">
              <div className="text-sm text-blue-600 mb-1">正确率</div>
              <div className="text-2xl font-bold text-blue-800">{accuracy}%</div>
              <div className="text-xs text-blue-600 mt-1">{correctCount}/{totalCount}题</div>
            </div>
            
            <div className="bg-purple-50 rounded-lg p-4 text-center">
              <div className="text-sm text-purple-600 mb-1">用时</div>
              <div className="text-2xl font-bold text-purple-800">{formatTime(quizTotalTime)}</div>
              <div className="text-xs text-purple-600 mt-1">平均{formatTime(quizTotalTime/totalCount)}/题</div>
            </div>
          </div>
          
          <div className="space-y-3 mb-8">
            {answeredQuestions.map((answer, index) => {
              if (!answer.questionIndex || answer.questionIndex < 0 || answer.questionIndex >= questions.length) return null;
              const question = questions[answer.questionIndex];
              if (!question) return null;
              
              return (
                <div key={index} className={`p-3 rounded-lg border ${answer.isCorrect ? 'border-green-200 bg-green-50' : 'border-red-200 bg-red-50'}`}>
                  <div className="flex justify-between items-start">
                    <div className="flex items-center">
                      <div className={`w-6 h-6 rounded-full flex items-center justify-center text-sm font-medium mr-2 ${answer.isCorrect ? 'bg-green-200 text-green-800' : 'bg-red-200 text-red-800'}`}>
                        {(answer.questionIndex ?? 0) + 1}
                      </div>
                      <div className="text-sm font-medium">{question.question ? (question.question.length > 50 ? `${question.question.substring(0, 50)}...` : question.question) : '未知问题'}</div>
                    </div>
                    <div className={`text-xs px-2 py-0.5 rounded-full ${answer.isCorrect ? 'bg-green-200 text-green-800' : 'bg-red-200 text-red-800'}`}>
                      {answer.isCorrect ? '正确' : '错误'}
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
          
          <div className="flex space-x-3 justify-center">
            <button 
              onClick={handleResetQuiz} 
              className="px-5 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition flex items-center"
            >
              <svg className="w-5 h-5 mr-1" fill="none" stroke="currentColor" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
              </svg>
              重新开始
            </button>
            <button 
              onClick={handleNavigateHome} 
              className="px-5 py-2 bg-gray-200 text-gray-800 rounded-lg hover:bg-gray-300 transition flex items-center"
            >
              <svg className="w-5 h-5 mr-1" fill="none" stroke="currentColor" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 19l-7-7m0 0l7-7m-7 7h18" />
              </svg>
              返回首页
            </button>
          </div>
        </div>
      );
    }

    return (
      <div className="max-w-4xl mx-auto">
        {/* 顶部导航栏 */}
        <div className="flex justify-between items-center mb-6">
          <button 
            onClick={handleNavigateHome} 
            className="text-blue-600 hover:text-blue-800 flex items-center text-sm"
          >
            <svg className="w-4 h-4 mr-1" fill="none" stroke="currentColor" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 19l-7-7m0 0l7-7m-7 7h18" />
            </svg>
            返回首页
          </button>
          
          <div className="flex items-center">
            {/* 添加清空进度按钮 */}
            <button
              onClick={() => {
                if (confirm('确定要清空当前答题进度吗？这将重置所有答题记录，但不会影响已同步到服务器的数据。')) {
                  // 清空本地存储的进度数据
                  if (questionSet) {
                    // 清除所有与进度相关的本地存储
                    const localProgressKey = `quiz_progress_${questionSet.id}`;
                    localStorage.removeItem(localProgressKey);
                    sessionStorage.removeItem(`quiz_completed_${questionSet.id}`);
                    
                    // 清除其他可能存在的相关数据
                    localStorage.removeItem(`quiz_state_${questionSet.id}`);
                    localStorage.removeItem(`last_question_${questionSet.id}`);
                    localStorage.removeItem(`answered_questions_${questionSet.id}`);
                    
                    // 重置状态
                    setCurrentQuestionIndex(0);
                    setAnsweredQuestions([]);
                    setCorrectAnswers(0);
                    setSelectedOptions([]);
                    setShowExplanation(false);
                    setQuizComplete(false);
                    
                    // 重置同步状态
                    unsyncedChangesRef.current = false;
                    
                    toast.success('答题进度已清空');
                  }
                }
              }}
              className="text-red-600 hover:text-red-800 flex items-center text-sm mr-4"
            >
              <svg className="w-4 h-4 mr-1" fill="none" stroke="currentColor" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
              </svg>
              清空进度
            </button>
            
            {/* 计时器 */}
            {isTimerActive && (
              <div className="bg-blue-50 text-blue-800 px-3 py-1 rounded-lg text-sm flex items-center mr-2">
                <svg className="w-4 h-4 mr-1 text-blue-600" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
                </svg>
                {formatTime(quizTotalTime)}
              </div>
            )}
            
            <div className="bg-indigo-100 text-indigo-800 px-3 py-1 rounded-lg text-sm">
              {questionSet?.title || '加载中...'}
            </div>
          </div>
        </div>
        
        {/* 题目卡片 */}
        {currentQuestion && (
          <QuestionCard
            key={`${currentQuestionIndex}-${answeredQuestions.length}`}
            question={currentQuestion}
            questionNumber={currentQuestionIndex + 1}
            totalQuestions={questions.length}
            onAnswerSubmitted={handleAnswerSubmit}
            onNext={handleNextQuestion}
            onJumpToQuestion={handleJumpToQuestion}
            isPaid={questionSet?.isPaid}
            hasFullAccess={hasAccessToFullQuiz}
            questionSetId={questionSetId || ''}
            isLast={currentQuestionIndex === questions.length - 1}
          />
        )}
        
        {/* 进度条 */}
        <div className="mt-6 bg-gray-200 rounded-full h-2.5 mb-6">
          <div 
            className="bg-blue-600 h-2.5 rounded-full transition-all duration-500"
            style={{ width: `${Math.round((answeredQuestions.length / questions.length) * 100)}%` }}
          ></div>
        </div>
        
        {/* 答题进度指示器 */}
        <div className="flex flex-wrap justify-center gap-2 mb-8">
          {questions.map((_, index) => {
            // 查找该题的答题记录
            const answer = answeredQuestions.find(a => a.questionIndex === index);
            let btnClass = "w-8 h-8 rounded-full flex items-center justify-center text-sm font-medium transition-all ";
            
            if (index === currentQuestionIndex) {
              btnClass += "bg-blue-600 text-white ring-2 ring-blue-300 ring-offset-2";
            } else if (answer) {
              btnClass += answer.isCorrect 
                ? "bg-green-100 text-green-800 hover:bg-green-200" 
                : "bg-red-100 text-red-800 hover:bg-red-200";
            } else {
              btnClass += "bg-gray-100 text-gray-800 hover:bg-gray-200";
            }
            
            return (
              <button 
                key={index}
                className={btnClass}
                onClick={() => handleJumpToQuestion(index)}
              >
                {index + 1}
              </button>
            );
          })}
        </div>
      </div>
    );
  };
  
  // 重新开始测试
  const handleReset = async () => {
    // 清除任何现有的定时器
    if (timeoutId.current) {
      clearTimeout(timeoutId.current);
      timeoutId.current = undefined;
    }

    // 首先同步当前进度（如果有未同步的更改）
    if (unsyncedChangesRef.current) {
      try {
        await syncProgressToServer(true);
        unsyncedChangesRef.current = false;
      } catch (error) {
        console.error('[QuizPage] 同步进度失败:', error);
      }
    }

    // 清除所有可能存储进度的缓存
    try {
      // 1. 清除sessionStorage中的标记
      if (questionSet) {
        console.log(`[QuizPage] 清除sessionStorage中的完成标记`);
        sessionStorage.removeItem(`quiz_completed_${questionSet.id}`);
        // 设置重置标记
        sessionStorage.setItem('quiz_reset_required', 'true');
      }
      
      // 2. 清除localStorage中可能的进度缓存
      if (questionSet) {
        console.log(`[QuizPage] 清除localStorage中的进度缓存`);
        const possibleKeys = [
          `quiz_progress_${questionSet.id}`,
          `quiz_state_${questionSet.id}`,
          `last_question_${questionSet.id}`,
          `answered_questions_${questionSet.id}`
        ];
        
        possibleKeys.forEach(key => {
          localStorage.removeItem(key);
        });
        
        // 清除每个问题的单独状态
        for (let i = 0; i < questions.length; i++) {
          if (questions[i] && questions[i].id) {
            localStorage.removeItem(`quiz_state_${questionSet.id}_${questions[i].id}`);
          }
        }
      }
    } catch (e) {
      console.error('[QuizPage] 清除缓存失败:', e);
    }

    // 重置所有状态
    setCurrentQuestionIndex(0);
    setSelectedOptions([]);
    setShowExplanation(false);
    setAnsweredQuestions([]);
    setCorrectAnswers(0);
    setQuizComplete(false);
    setQuestionStartTime(Date.now());
    
    console.log('[QuizPage] 重置答题状态，准备刷新进度数据');
    
    // 重置进度统计 - 确保先清除再重新加载
    if (user && questionSet && socket) {
      try {
        // 清除服务器端进度
        socket.emit('progress:reset', {
          userId: user.id,
          questionSetId: questionSet.id
        });
        
        console.log('[QuizPage] 已发送进度重置请求到服务器');
        
        // 等待响应
        socket.once('progress:reset:result', (result) => {
          console.log('[QuizPage] 服务器进度重置结果:', result);
          if (result.success) {
            toast.success('进度已重置');
            
            // 添加URL参数确保从第一题开始
            const url = new URL(window.location.href);
            url.searchParams.set('start', 'first');
            url.searchParams.set('t', Date.now().toString());
            window.location.href = url.toString();
          }
        });
        
        // 设置超时，确保不会因为服务器响应问题而挂起
        setTimeout(() => {
          // 如果还没有收到响应，直接刷新页面
          if (questionSet) {
            const url = new URL(window.location.href);
            url.searchParams.set('start', 'first');
            url.searchParams.set('t', Date.now().toString());
            window.location.href = url.toString();
          }
        }, 2000);
      } catch (error) {
        console.error('重置进度失败:', error);
        // 显示友好的错误提示
        setError('重置进度失败，请尝试重新加载页面');
        
        // 出错时也强制刷新页面
        setTimeout(() => {
          if (questionSet) {
            const url = new URL(window.location.href);
            url.searchParams.set('start', 'first');
            url.searchParams.set('t', Date.now().toString());
            window.location.href = url.toString();
          }
        }, 1000);
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
    
    // 检查URL参数，如果有reset参数，则重置进度
    const urlParams = new URLSearchParams(window.location.search);
    const resetParam = urlParams.get('reset');
    
    if (resetParam === 'true') {
      console.log('[QuizPage] 检测到reset=true参数，自动重置进度');
      // 移除reset参数，避免刷新页面时再次重置
      const newUrl = window.location.pathname + window.location.hash;
      window.history.replaceState({}, document.title, newUrl);
      
      // 设置标记，稍后会重置进度
      sessionStorage.setItem('quiz_reset_required', 'true');
    }
    
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
            const isRedeemed = redeemedIds.some(id => String(id).trim() === normalizedCurrentId);
            console.log(`[QuizPage] 题库 ${normalizedCurrentId} 是否已兑换: ${isRedeemed}`);
            
            if (isRedeemed) {
              console.log(`[QuizPage] 题库已兑换，设置状态`);
              setHasRedeemed(true);
              setHasAccessToFullQuiz(true);
              setTrialEnded(false);
            }
          }
        } catch (e) {
          console.error('[QuizPage] 检查localStorage兑换状态失败', e);
        }
      }
      
      // 检查是否需要重置进度
      const resetRequired = sessionStorage.getItem('quiz_reset_required');
      if (resetRequired === 'true') {
        console.log('[QuizPage] 需要重置进度');
        sessionStorage.removeItem('quiz_reset_required');
        
        // 延迟执行重置，确保其他初始化已完成
        setTimeout(() => {
          console.log('[QuizPage] 执行自动重置');
          handleReset();
        }, 300);
      }
    }
  }, [questionSet?.id, getAccessFromLocalStorage]);
  
  // 初始化访问状态 - 在题库信息加载后执行
  useEffect(() => {
    if (questionSet?.id && !loading) {
      // 首先从localStorage检查访问权限
      const hasStoredAccess = getAccessFromLocalStorage(questionSet.id);
      console.log(`[QuizPage] 题库 ${questionSet.id} 完成加载，检查本地存储访问权限: ${hasStoredAccess}`);
      
      if (hasStoredAccess) {
        console.log(`[QuizPage] 本地存储显示题库 ${questionSet.id} 有访问权限，设置状态`);
        setHasAccessToFullQuiz(true);
        setTrialEnded(false);
      }
      
      // 检查是否有localStorage中保存的已兑换记录
      const redeemedQuestionSetIds = localStorage.getItem('redeemedQuestionSetIds');
      if (redeemedQuestionSetIds) {
        try {
          const redeemedIds = JSON.parse(redeemedQuestionSetIds);
          const normalizedCurrentId = String(questionSet.id).trim();
          
          if (Array.isArray(redeemedIds)) {
            const isRedeemed = redeemedIds.some(id => String(id).trim() === normalizedCurrentId);
            console.log(`[QuizPage] 题库 ${normalizedCurrentId} 是否已兑换: ${isRedeemed}`);
            
            if (isRedeemed) {
              console.log(`[QuizPage] 题库已兑换，设置状态`);
              setHasRedeemed(true);
              setHasAccessToFullQuiz(true);
              setTrialEnded(false);
            }
          }
        } catch (e) {
          console.error('[QuizPage] 检查localStorage兑换状态失败', e);
        }
      }
      
      // 始终向服务器请求最新访问权限状态，确保跨设备同步
      if (socket && user) {
        console.log(`[QuizPage] 向服务器请求题库 ${questionSet.id} 的最新访问权限状态`);
        
        // 使用标准化的ID格式
        const normalizedId = String(questionSet.id).trim();
        
        // 发送请求检查访问权限
        socket.emit('questionSet:checkAccess', {
          userId: user.id,
          questionSetId: normalizedId,
          source: 'quiz_page_init'
        });
        
        // 如果本地存储表明有访问权限，也通知服务器更新
        if (hasStoredAccess) {
          socket.emit('questionSet:accessUpdate', {
            userId: user.id,
            questionSetId: normalizedId,
            hasAccess: true,
            source: 'localStorage'
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
  
  // 在现有的useEffect中优化获取用户进度的逻辑，改用Socket.IO而非HTTP请求
  useEffect(() => {
    if (questionSet?.id && user?.id && questions.length > 0 && !loading && socket) {
      console.log('[QuizPage] 尝试加载上次进度...');
      
      // 检查是否有重置标记或完成标记
      const resetRequired = sessionStorage.getItem('quiz_reset_required') === 'true';
      const quizCompleted = sessionStorage.getItem(`quiz_completed_${questionSet.id}`) === 'true';
      
      // 如果需要重置或已完成，则不加载之前的进度
      if (resetRequired || quizCompleted) {
        console.log('[QuizPage] 检测到重置标记或已完成标记，不加载之前的进度');
        sessionStorage.removeItem('quiz_reset_required');
        return;
      }
      
      // 检查URL参数
      const urlParams = new URLSearchParams(window.location.search);
      const startFromFirst = urlParams.get('start') === 'first';
      const lastQuestionParam = urlParams.get('lastQuestion');
      
      if (startFromFirst) {
        console.log('[QuizPage] 检测到start=first参数，从第一题开始');
        // 移除参数，避免刷新页面时再次重置
        const newUrl = window.location.pathname + window.location.hash;
        window.history.replaceState({}, document.title, newUrl);
        return;
      }
      
      // 如果URL中指定了最后题目位置，直接使用
      if (lastQuestionParam) {
        const lastIndex = parseInt(lastQuestionParam, 10);
        if (!isNaN(lastIndex) && lastIndex >= 0 && lastIndex < questions.length) {
          console.log(`[QuizPage] 使用URL参数设置位置: 第${lastIndex + 1}题`);
          setCurrentQuestionIndex(lastIndex);
          
          // 移除URL参数
          const newUrl = window.location.pathname + window.location.hash;
          window.history.replaceState({}, document.title, newUrl);
          return;
        }
      }
      
      // 尝试先从本地存储加载
      try {
        const localProgressKey = `quiz_progress_${questionSet.id}`;
        const localProgressStr = localStorage.getItem(localProgressKey);
        
        if (localProgressStr) {
          const localProgress = JSON.parse(localProgressStr);
          console.log('[QuizPage] 从本地存储加载进度:', localProgress);
          
          // 检查数据是否有效且不太旧
          const lastUpdated = new Date(localProgress.lastUpdated || 0);
          const isRecent = Date.now() - lastUpdated.getTime() < 24 * 60 * 60 * 1000; // 24小时内
          
          if (isRecent && localProgress.answeredQuestions && localProgress.answeredQuestions.length > 0) {
            // 从本地数据恢复进度
            console.log('[QuizPage] 使用本地存储的进度数据');
            
            // 恢复已答题状态
            setAnsweredQuestions(localProgress.answeredQuestions);
            
            // 计算正确答题数
            const correctCount = localProgress.answeredQuestions.filter((q: any) => q.isCorrect).length;
            setCorrectAnswers(correctCount);
            
            // 设置当前题目索引 - 如果已全部完成则从头开始，否则继续上次位置
            const allAnswered = localProgress.answeredQuestions.length >= questions.length;
            
            if (allAnswered) {
              setCurrentQuestionIndex(0);
              console.log('[QuizPage] 所有题目已答完，从第一题开始');
            } else if (localProgress.lastQuestionIndex !== undefined && 
                      localProgress.lastQuestionIndex >= 0 && 
                      localProgress.lastQuestionIndex < questions.length) {
              // 使用保存的索引
              setCurrentQuestionIndex(localProgress.lastQuestionIndex);
              console.log(`[QuizPage] 从上次位置继续: 第${localProgress.lastQuestionIndex + 1}题`);
            } else {
              // 或者设置为最后回答的题目的下一题
              try {
                const answeredIndices = localProgress.answeredQuestions.map((q: any) => q.index || 0);
                if (answeredIndices.length > 0) {
                  const maxAnsweredIndex = Math.max(...answeredIndices);
                  const nextIndex = Math.min(maxAnsweredIndex + 1, questions.length - 1);
                  console.log(`[QuizPage] 从上次最后答题位置继续: 第${nextIndex + 1}题`);
                  setCurrentQuestionIndex(nextIndex);
                }
              } catch (e) {
                console.error('[QuizPage] 计算下一题位置失败:', e);
                setCurrentQuestionIndex(0);
              }
            }
            
            // 如果本地数据有效，同时请求服务器数据但不等待
            // 这样可以快速显示界面并在后台同步
            socket.emit('progress:get', {
              userId: user.id,
              questionSetId: questionSet.id
            });
            
            return;
          }
        }
      } catch (e) {
        console.error('[QuizPage] 加载本地进度失败:', e);
      }
      
      // 如果本地数据无效或不存在，则从服务器获取
      console.log('[QuizPage] 尝试从服务器获取进度数据');
      
      // 使用Socket查询进度，避免HTTP请求
      socket.emit('progress:get', {
        userId: user.id,
        questionSetId: questionSet.id
      });
      
      // 创建一次性监听器，避免循环触发
      const onProgressData = (progressData: ProgressData) => {
        if (!progressData) {
          console.log('[QuizPage] 服务器返回空进度数据');
          return;
        }
        
        console.log('[QuizPage] 通过Socket获取到进度数据:', progressData);
        
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
            const answeredQs = progressData.answeredQuestions.map((q) => ({
              index: q.questionIndex || q.index || 0,
              isCorrect: q.isCorrect || false,
              selectedOption: q.selectedOption || q.selectedOptionId || ''
            }));
            console.log('[QuizPage] 重建已答题列表:', answeredQs.length, '道题');
            setAnsweredQuestions(answeredQs);
            
            // 计算正确答题数
            const correctCount = answeredQs.filter(q => q.isCorrect).length;
            setCorrectAnswers(correctCount);
            
            // 保存到本地存储以支持离线场景
            try {
              const localProgressKey = `quiz_progress_${questionSet.id}`;
              localStorage.setItem(localProgressKey, JSON.stringify({
                lastQuestionIndex: progressData.lastQuestionIndex,
                answeredQuestions: answeredQs,
                lastUpdated: new Date().toISOString()
              }));
            } catch (e) {
              console.error('[QuizPage] 本地存储进度失败:', e);
            }
          }
        } 
        // 否则尝试根据已回答题目数决定从哪里开始
        else if (progressData.answeredQuestions && progressData.answeredQuestions.length > 0) {
          try {
            // 找出最大的已答题索引
            const indices = progressData.answeredQuestions.map((q) => q.questionIndex || q.index || 0);
            const lastAnsweredIndex = Math.max(...indices);
            
            // 从下一题开始，但不超过题目总数
            const nextIndex = Math.min(lastAnsweredIndex + 1, questions.length - 1);
            console.log(`[QuizPage] 根据已答题记录设置位置: 第${nextIndex + 1}题`);
            setCurrentQuestionIndex(nextIndex);
            
            // 更新已回答问题列表
            const answeredQs = progressData.answeredQuestions.map((q) => ({
              index: q.questionIndex || q.index || 0,
              isCorrect: q.isCorrect || false,
              selectedOption: q.selectedOptionId || q.selectedOption || ''
            }));
            console.log('[QuizPage] 重建已答题列表:', answeredQs.length, '道题');
            setAnsweredQuestions(answeredQs);
            
            // 计算正确答题数
            const correctCount = answeredQs.filter(q => q.isCorrect).length;
            setCorrectAnswers(correctCount);
            
            // 保存到本地存储以支持离线场景
            try {
              const localProgressKey = `quiz_progress_${questionSet.id}`;
              localStorage.setItem(localProgressKey, JSON.stringify({
                lastQuestionIndex: nextIndex,
                answeredQuestions: answeredQs,
                lastUpdated: new Date().toISOString()
              }));
            } catch (e) {
              console.error('[QuizPage] 本地存储进度失败:', e);
            }
          } catch (e) {
            console.error('[QuizPage] 计算下一题位置失败:', e);
            setCurrentQuestionIndex(0);
          }
        }
      };
      
      // 注册一次性监听器
      socket.once('progress:data', onProgressData);
      
      // 设置超时，确保不会永远等待
      const timeout = setTimeout(() => {
        socket.off('progress:data', onProgressData); // 移除监听器
        console.log('[QuizPage] 获取进度超时，从第一题开始');
        setCurrentQuestionIndex(0);
      }, 5000); // 增加超时时间
      
      // 注册一个函数来清理
      return () => {
        clearTimeout(timeout);
        socket.off('progress:data', onProgressData);
      };
    }
  }, [questionSet?.id, user?.id, questions.length, loading, socket]);

  // 修改判断显示购买提示的条件，确保有完整权限验证
  // 使用现有的函数做权限判断
  const shouldShowPurchasePrompt = () => {
    // 如果没有加载完成或者出错，不显示提示
    if (!questionSet || error || loading) return false;
    
    // 首先检查所有可能的访问权限来源
    const hasFullAccess = checkFullAccessFromAllSources();
    
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
    
    console.log(`[QuizPage] 页面加载完成，立即进行全面权限检查`);
    
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
          console.log(`[QuizPage] 向服务器同步权限状态`);
          socket.emit('questionSet:accessUpdate', {
            userId: user.id,
            questionSetId: String(questionSet.id).trim(),
            hasAccess: true,
            source: 'pageInit'
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
      console.log(`[QuizPage] 收到设备同步事件`, data);
      
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
        timestamp: Date.now()
      }
    });
    
    return () => {
      socket.off('user:deviceSync', handleDeviceSync);
    };
  }, [socket, user?.id, questionSet]);
  
  // 添加处理跨设备访问权限同步的效果
  useEffect(() => {
    if (!user?.id || !questionSet) return;
    
    console.log('[QuizPage] 设置跨设备访问权限同步');
    
    const handleAccessRightsUpdate = (event: Event) => {
      const customEvent = event as CustomEvent;
      console.log('[QuizPage] 收到访问权限更新事件:', customEvent.detail);
      
      // 如果事件是针对当前用户，重新检查访问权限
      if (customEvent.detail?.userId === user.id) {
        console.log('[QuizPage] 更新后重新检查访问权限');
        checkAccess();
      }
    };
    
    // 监听访问权限更新
    window.addEventListener('accessRights:updated', handleAccessRightsUpdate);
    
    // 同步访问权限
    syncAccessRights().then(() => {
      console.log('[QuizPage] 访问权限已同步，检查访问权限');
      checkAccess();
    });
    
    return () => {
      window.removeEventListener('accessRights:updated', handleAccessRightsUpdate);
    };
  }, [user?.id, questionSet?.id, syncAccessRights, checkAccess]);
  
  // 在useEffect中初始化计时器
  useEffect(() => {
    if (questions.length > 0 && !quizComplete) {
      // 开始计时
      const startTime = Date.now();
      setQuizStartTime(startTime);
      setIsTimerActive(true);
      
      // 定时更新总时间
      const timerInterval = setInterval(() => {
        if (isTimerActive) {
          const currentTime = Math.floor((Date.now() - startTime) / 1000);
          setQuizTotalTime(currentTime);
        }
      }, 1000);
      
      return () => clearInterval(timerInterval);
    }
  }, [questions, quizComplete]);

  // 当完成所有题目时停止计时
  useEffect(() => {
    if (quizComplete && isTimerActive) {
      setIsTimerActive(false);
      // 记录最终时间
      const finalTime = Math.floor((Date.now() - quizStartTime) / 1000);
      setQuizTotalTime(finalTime);
      
      // 可以在这里保存用时记录到后端
      if (socket && user && questionSet) {
        socket.emit('quiz:complete', {
          userId: user.id,
          questionSetId: questionSet.id,
          totalTime: finalTime,
          correctAnswers,
          totalQuestions: questions.length
        });
      }
    }
  }, [quizComplete, isTimerActive, quizStartTime]);

  // 格式化时间显示函数
  const formatTime = (seconds: number): string => {
    const hours = Math.floor(seconds / 3600);
    const minutes = Math.floor((seconds % 3600) / 60);
    const secs = seconds % 60;
    
    if (hours > 0) {
      return `${hours}:${minutes.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
    }
    return `${minutes}:${secs.toString().padStart(2, '0')}`;
  };

  // 重新添加页面刷新/关闭事件处理
  useEffect(() => {
    // 处理页面刷新或关闭
    const handleBeforeUnload = (event: BeforeUnloadEvent) => {
      if (unsyncedChangesRef.current) {
        // 尝试同步进度（这个场景下可能不会完全同步，主要确保数据保存到localStorage）
        const localProgressKey = `quiz_progress_${questionSetId}`;
        localStorage.setItem(localProgressKey, JSON.stringify({
          lastQuestionIndex: currentQuestionIndex,
          answeredQuestions,
          lastUpdated: new Date().toISOString(),
          pendingSync: true // 标记为待同步
        }));
        
        // 显示确认对话框
        const message = '你有未保存的进度，确定要离开吗？';
        event.preventDefault();
        event.returnValue = message;
        return message;
      }
    };
    
    // 处理页面可见性变化
    const handleVisibilityChange = () => {
      if (document.visibilityState === 'hidden' && unsyncedChangesRef.current) {
        // 页面隐藏时（切换标签、最小化窗口等）同步数据
        console.log('[QuizPage] 页面隐藏，保存进度到localStorage');
        
        // 同步到localStorage
        const localProgressKey = `quiz_progress_${questionSetId}`;
        localStorage.setItem(localProgressKey, JSON.stringify({
          lastQuestionIndex: currentQuestionIndex,
          answeredQuestions,
          lastUpdated: new Date().toISOString(),
          pendingSync: true
        }));
        
        // 尝试同步到服务器
        // 使用navigator.sendBeacon确保数据发送，即使页面关闭
        if (navigator.sendBeacon && socket) {
          const progressData = JSON.stringify({
            userId: user?.id,
            questionSetId,
            lastQuestionIndex: currentQuestionIndex,
            answeredQuestions,
            timeSpent: quizTotalTime
          });
          
          // 使用sendBeacon发送数据
          navigator.sendBeacon('/api/progress/sync', progressData);
        }
      }
    };
    
    // 添加事件监听器
    window.addEventListener('beforeunload', handleBeforeUnload);
    document.addEventListener('visibilitychange', handleVisibilityChange);
    
    // 组件卸载时清理
    return () => {
      // 组件卸载时同步进度
      if (unsyncedChangesRef.current) {
        syncProgressToServer(true);
      }
      
      // 移除事件监听器
      window.removeEventListener('beforeunload', handleBeforeUnload);
      document.removeEventListener('visibilitychange', handleVisibilityChange);
    };
  }, [questionSetId, currentQuestionIndex, answeredQuestions, syncProgressToServer, user?.id, quizTotalTime]);

  // 让quizComplete状态也触发同步进度
  useEffect(() => {
    // 当测验完成时，同步所有进度
    if (quizComplete && unsyncedChangesRef.current) {
      console.log('[QuizPage] 测验完成，同步所有进度');
      syncProgressToServer(true);
    }
  }, [quizComplete, syncProgressToServer]);

  // 添加页面导航返回主页功能
  const handleNavigateHome = useCallback(() => {
    // 导航前先同步进度
    if (unsyncedChangesRef.current) {
      syncProgressToServer(true).then(() => {
        navigate('/');
      });
    } else {
      navigate('/');
    }
  }, [navigate, syncProgressToServer]);

  // 在渲染内容中使用以下组件属性和回调：
  // 1. <QuestionCard onNext={handleNextQuestion} />
  // 2. "返回首页"按钮: onClick={handleNavigateHome}

  // 确保handleResetQuiz也同步进度
  const handleResetQuiz = useCallback(async () => {
    try {
      setLoading(true);
      
      // 首先同步当前进度
      if (unsyncedChangesRef.current) {
        await syncProgressToServer(true);
      }
      
      // 重置计时器
      setQuizTotalTime(0);
      setQuizStartTime(Date.now());
      setIsTimerActive(true);
      
      // 现有的重置逻辑...
      setCurrentQuestionIndex(0);
      setAnsweredQuestions([]);
      setCorrectAnswers(0);
      setQuizComplete(false);
      
      // 使用原始问题数组重新设置问题
      if (originalQuestions && originalQuestions.length > 0) {
        // 洗牌问题数组
        const shuffled = [...originalQuestions].sort(() => Math.random() - 0.5);
        setQuestions(shuffled);
      }
      
      // 提示用户
      toast.success('进度已重置，开始新的测试！');
      
      // 更彻底地清除本地存储
      try {
        if (questionSet) {
          // 清除所有与进度相关的本地存储
          const localProgressKey = `quiz_progress_${questionSet.id}`;
          localStorage.removeItem(localProgressKey);
          sessionStorage.removeItem(`quiz_completed_${questionSet.id}`);
          
          // 清除其他可能存在的相关数据
          localStorage.removeItem(`quiz_state_${questionSet.id}`);
          localStorage.removeItem(`last_question_${questionSet.id}`);
          localStorage.removeItem(`answered_questions_${questionSet.id}`);
          
          // 确保重置未同步状态标记
          unsyncedChangesRef.current = false;
        }
      } catch (e) {
        console.error('清除本地进度失败:', e);
      }
      
      // 更新URL，移除lastQuestion参数
      if (questionSet) {
        navigate(`/quiz/${questionSet.id}`, { replace: true });
      }
      
      // 重置同步状态
      unsyncedChangesRef.current = false;
    } catch (error) {
      console.error('重置测试失败:', error);
      toast.error('重置测试失败，请刷新页面重试');
    } finally {
      setLoading(false);
    }
  }, [
    questionSet, 
    questionSetId, 
    originalQuestions, 
    syncProgressToServer, 
    navigate
  ]);
  
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
          onClick={handleNavigateHome}
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
              onClick={handleNavigateHome}
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
              
              // 保存访问权限到localStorage
              if (questionSet) {
                saveAccessToLocalStorage(questionSet.id, true);
              }
              
              // 尝试通过Socket再次检查权限，确保状态一致性
              if (socket && user) {
                setTimeout(() => {
                  console.log(`[QuizPage] 支付成功后检查权限`);
                  socket.emit('questionSet:checkAccess', {
                    userId: user.id,
                    questionSetId: String(questionSet.id).trim()
                  });
                  
                  // 明确告知服务器更新访问权限
                  socket.emit('questionSet:accessUpdate', {
                    userId: user.id,
                    questionSetId: String(questionSet.id).trim(),
                    hasAccess: true,
                    source: 'payment'
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
                console.log(`[QuizPage] 直接设置访问权限为true和重置试用状态`);
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
                      hasAccess: true,
                      source: 'redemption'
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
    
    // 设置完成标记，避免下次自动恢复进度
    if (questionSet) {
      sessionStorage.setItem(`quiz_completed_${questionSet.id}`, 'true');
    }
    
    return (
      <div className="min-h-screen bg-gray-50 py-8">
        <div className="container mx-auto px-4">
          {/* 添加按钮动画效果 */}
          <style>
            {`
              @keyframes attention {
                0% { transform: scale(1); box-shadow: 0 0 0 0 rgba(72, 187, 120, 0.7); }
                50% { transform: scale(1.05); box-shadow: 0 0 0 10px rgba(72, 187, 120, 0); }
                100% { transform: scale(1); box-shadow: 0 0 0 0 rgba(72, 187, 120, 0); }
              }
              
              .attention-animation {
                animation: attention 1.5s ease-in-out infinite;
              }
            `}
          </style>
         
          {/* 题库完成页 */}
          {quizComplete ? (
            <div className="bg-white rounded-lg shadow-md p-8 text-center">
              <div className="w-24 h-24 mx-auto bg-green-100 rounded-full flex items-center justify-center mb-6">
                <svg className="w-12 h-12 text-green-600" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                </svg>
              </div>
              <h2 className="text-2xl font-bold text-gray-800 mb-2">恭喜你完成了所有题目！</h2>
              <p className="text-gray-600 mb-2">你答对了 {correctAnswers} 题，共 {questions.length} 题</p>
              <p className="text-gray-600 mb-6">总用时: <span className="font-semibold text-indigo-600">{formatTime(quizTotalTime)}</span></p>
          
              <div className="flex justify-center space-x-4">
                <button 
                  onClick={handleResetQuiz}
                  className="px-6 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700 transition-colors duration-300 flex items-center"
                >
                  <svg className="w-5 h-5 mr-2" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
                  </svg>
                  重新开始
                </button>
                <button 
                  onClick={handleNavigateHome}
                  className="px-6 py-2 bg-indigo-600 text-white rounded-md hover:bg-indigo-700 transition-colors duration-300 flex items-center"
                >
                  <svg className="w-5 h-5 mr-2" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 12l2-2m0 0l7-7 7 7M5 10v10a1 1 0 001 1h3m10-11l2 2m-2-2v10a1 1 0 01-1 1h-3m-6 0a1 1 0 001-1v-4a1 1 0 011-1h2a1 1 0 011 1v4a1 1 0 001 1m-6 0h6" />
                  </svg>
                  回到首页
                </button>
              </div>
            </div>
          ) : (
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
                  onClick={() => {
                    // 设置标记，确保重置
                    sessionStorage.setItem('quiz_reset_required', 'true');
                    handleReset();
                    
                    // 强制添加参数并刷新页面
                    if (questionSet) {
                      window.location.href = `/quiz/${questionSet.id}?start=first&t=${Date.now()}`;
                    }
                  }}
                  className="bg-blue-600 text-white px-4 py-2 rounded hover:bg-blue-700"
                >
                  重新开始
                </button>
                
                <button
                  onClick={handleNavigateHome}
                  className="bg-gray-100 text-gray-800 px-4 py-2 rounded hover:bg-gray-200"
                >
                  返回首页
                </button>
              </div>
            </div>
          )}
        </div>
      </div>
    );
  }
  
  return (
    <div className="min-h-screen bg-gray-50 py-8">
      <div className="container mx-auto px-4">
        {/* 添加按钮动画效果 */}
        <style>
          {`
            @keyframes attention {
              0% { transform: scale(1); box-shadow: 0 0 0 0 rgba(72, 187, 120, 0.7); }
              50% { transform: scale(1.05); box-shadow: 0 0 0 10px rgba(72, 187, 120, 0); }
              100% { transform: scale(1); box-shadow: 0 0 0 0 rgba(72, 187, 120, 0); }
            }
            
            .attention-animation {
              animation: attention 1.5s ease-in-out infinite;
            }
          `}
        </style>
        
        {/* 题库完成页 */}
        {quizComplete ? (
          <div className="bg-white rounded-lg shadow-md p-8 text-center">
            <div className="w-24 h-24 mx-auto bg-green-100 rounded-full flex items-center justify-center mb-6">
              <svg className="w-12 h-12 text-green-600" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
              </svg>
            </div>
            <h2 className="text-2xl font-bold text-gray-800 mb-2">恭喜你完成了所有题目！</h2>
            <p className="text-gray-600 mb-2">你答对了 {correctAnswers} 题，共 {questions.length} 题</p>
            <p className="text-gray-600 mb-6">总用时: <span className="font-semibold text-indigo-600">{formatTime(quizTotalTime)}</span></p>
        
            <div className="flex justify-center space-x-4">
              <button 
                onClick={handleResetQuiz}
                className="px-6 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700 transition-colors duration-300 flex items-center"
              >
                <svg className="w-5 h-5 mr-2" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
                </svg>
                重新开始
              </button>
              <button 
                onClick={handleNavigateHome}
                className="px-6 py-2 bg-indigo-600 text-white rounded-md hover:bg-indigo-700 transition-colors duration-300 flex items-center"
              >
                <svg className="w-5 h-5 mr-2" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 12l2-2m0 0l7-7 7 7M5 10v10a1 1 0 001 1h3m10-11l2 2m-2-2v10a1 1 0 01-1 1h-3m-6 0a1 1 0 001-1v-4a1 1 0 011-1h2a1 1 0 011 1v4a1 1 0 001 1m-6 0h6" />
                </svg>
                回到首页
              </button>
            </div>
          </div>
        ) : (
          // 展示当前问题
          <>
            <div className="mb-6">
              <div className="flex justify-between items-center mb-4">
                <h1 className="text-2xl font-bold">{questionSet.title}</h1>
                <button
                  onClick={handleNavigateHome}
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
                </div>
              )}
              
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
            {questions.length > 0 && currentQuestionIndex < questions.length && (
              <QuestionCard
                key={`question-${currentQuestionIndex}`}
                question={questions[currentQuestionIndex]}
                questionNumber={currentQuestionIndex + 1}
                totalQuestions={questions.length}
                onAnswerSubmitted={handleAnswerSubmit}
                onNext={handleNextQuestion}
                onJumpToQuestion={handleJumpToQuestion}
                isPaid={questionSet?.isPaid}
                hasFullAccess={hasAccessToFullQuiz}
                questionSetId={questionSet?.id || ''}
                isLast={currentQuestionIndex === questions.length - 1}
              />
            )}
          </>
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
                console.log(`[QuizPage] 直接设置访问权限为true和重置试用状态`);
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
                      hasAccess: true,
                      source: 'redemption'
                    });
                  }
                }, 500);
              }} />
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

export default QuizPage; 