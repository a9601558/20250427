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
import { Socket } from 'socket.io-client';

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
  trialLimit?: number;  // 添加试用题目限制参数
  isTrialMode?: boolean; // 添加试用模式标志
}> = ({ totalQuestions, answeredQuestions, currentIndex, onJump, trialLimit, isTrialMode }) => {
  return (
    <div className="bg-white shadow-md rounded-lg p-4 mb-6">
      <h3 className="text-md font-medium mb-3">答题卡</h3>
      <div className="flex flex-wrap gap-2">
        {Array.from({ length: totalQuestions }).map((_, index) => {
          const isAnswered = answeredQuestions.some(q => q.index === index);
          const isCorrect = answeredQuestions.some(q => q.index === index && q.isCorrect);
          const isCurrent = currentIndex === index;
          const isDisabled = isTrialMode && trialLimit ? index >= trialLimit : false;
          
          let bgColor = 'bg-gray-100'; // 默认未答题
          if (isCurrent) bgColor = 'bg-blue-500 text-white'; // 当前题目
          else if (isCorrect) bgColor = 'bg-green-100'; // 已答对
          else if (isAnswered) bgColor = 'bg-red-100'; // 已答错
          else if (isDisabled) bgColor = 'bg-gray-300'; // 超出试用限制
          
          return (
            <button
              key={index}
              onClick={() => !isDisabled && onJump(index)}
              className={`w-8 h-8 ${bgColor} rounded-md flex items-center justify-center text-sm font-medium ${isDisabled ? 'cursor-not-allowed opacity-60' : 'hover:opacity-80 transition-all'}`}
              disabled={isDisabled}
              title={isDisabled ? "超出试用题目范围" : `跳转到第${index + 1}题`}
            >
              {index + 1}
            </button>
          );
        })}
      </div>
    </div>
  );
};

// 添加接口定义用于保存的进度数据
interface SavedQuestionProgress {
  index: number;
  questionIndex: number;
  isCorrect: boolean;
  selectedOption: string | string[];
}

// 添加 ExtendedSaveProgressParams 接口定义
interface ExtendedSaveProgressParams {
  questionId: string;
  questionSetId: string;
  selectedOption: string | string[];
  isCorrect: boolean;
  timeSpent: number;
  lastQuestionIndex: number;
}

// 添加 ProgressData 接口定义
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
  const { socket } = useSocket() as { socket: Socket | null };
  const { fetchUserProgress } = useUserProgress();
  
  // 将 isSubmittingRef 移动到组件内部
  const isSubmittingRef = useRef<boolean>(false);
  
  // 状态管理
  const [loading, setLoading] = useState<boolean>(true);
  const [error, setError] = useState<string | null>(null);
  const [questions, setQuestions] = useState<Question[]>([]);
  const [originalQuestions, setOriginalQuestions] = useState<Question[]>([]);
  const [questionSet, setQuestionSet] = useState<IQuestionSet | null>(null);
  const [currentQuestionIndex, setCurrentQuestionIndex] = useState<number>(0);
  const [showHints, setShowHints] = useState<boolean>(false);
  const [answeredQuestions, setAnsweredQuestions] = useState<AnsweredQuestion[]>([]);
  const [showExplanation, setShowExplanation] = useState<boolean>(false);
  const [showAllExplanations, setShowAllExplanations] = useState<boolean>(false);
  const [showReviewMode, setShowReviewMode] = useState<boolean>(false);
  const [showWrongAnswers, setShowWrongAnswers] = useState<boolean>(false);
  const [questionStartTime, setQuestionStartTime] = useState<number>(0);
  const [accessChecked, setAccessChecked] = useState<boolean>(false);
  const [hasAccessToFullQuiz, setHasAccessToFullQuiz] = useState<boolean>(false);
  const [hasRedeemed, setHasRedeemed] = useState<boolean>(false);
  const [showPaymentModal, setShowPaymentModal] = useState<boolean>(false);
  const [showRedeemCodeModal, setShowRedeemCodeModal] = useState<boolean>(false);
  const [trialEnded, setTrialEnded] = useState<boolean>(false);
  const [isInTrialMode, setIsInTrialMode] = useState<boolean>(false);
  const [selectedOptions, setSelectedOptions] = useState<string[]>([]);
  const [correctAnswers, setCorrectAnswers] = useState<number>(0);
  const [quizComplete, setQuizComplete] = useState<boolean>(false);
  const [quizStartTime, setQuizStartTime] = useState<number>(0);
  const [quizTotalTime, setQuizTotalTime] = useState<number>(0);
  const [isTimerActive, setIsTimerActive] = useState<boolean>(false);
  
  // 在QuizPage组件内部，在state声明区域添加一个同步状态标识
  const [lastSyncTime, setLastSyncTime] = useState<number>(0);
  const [pendingSync, setPendingSync] = useState<boolean>(false);
  const unsyncedChangesRef = useRef<boolean>(false);
  const timeoutId = useRef<NodeJS.Timeout | undefined>(undefined);

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
      console.log(`[checkAccess] 调用hasAccessToQuestionSet('${questionSet.id}')`);
      try {
        const directAccess = await hasAccessToQuestionSet(questionSet.id);
        console.log(`[checkAccess] 通过hasAccessToQuestionSet检查: ${directAccess}`);
        hasAccess = hasAccess || directAccess;
      } catch (error) {
        console.error(`[checkAccess] 通过hasAccessToQuestionSet检查出错:`, error);
      }
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
  
  // 修改trialEnded的判定逻辑，避免错误提示购买
  useEffect(() => {
    if (!questionSet) return;
    
    console.log(`[QuizPage] 检查是否试用结束，总答题数: ${answeredQuestions.length}, 试用题目数: ${questionSet.trialQuestions}`);
    
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
      
      // 添加：显示购买模态窗口
      setTimeout(() => {
        if (isInTrialMode && !hasAccessToFullQuiz && !hasRedeemed) {
          console.log(`[QuizPage] 显示购买模态窗口`);
          setShowPaymentModal(true);
        }
      }, 1000);
    } else {
      setTrialEnded(false);
    }
  }, [answeredQuestions.length, questionSet, checkFullAccessFromAllSources, isInTrialMode, hasAccessToFullQuiz, hasRedeemed]);
  
  // 获取题库和题目数据
  useEffect(() => {
    if (!questionSetId) return;
    
    const fetchQuestionSet = async () => {
      setLoading(true);
      setError(null);
      
      try {
        // 解析URL参数
        const urlParams = new URLSearchParams(window.location.search);
        const mode = urlParams.get('mode');
        const trialLimit = urlParams.get('trialLimit');
        const specificQuestions = urlParams.get('questions');
        
        // 检查URL中的trial参数，支持两种形式："?mode=trial" 或 "?trial=true"
        // 这样可以确保向后兼容性
        const isTrialParam = mode === 'trial' || urlParams.get('trial') === 'true';
        
        // 增强调试日志
        console.log('[QuizPage] URL 参数解析:', {
          fullUrl: window.location.href,
          search: window.location.search,
          mode,
          trialLimit,
          specificQuestions,
          isTrialParam,
          rawParams: Array.from(urlParams.entries())
        });
        
        // 获取题库详情
        const response = await questionSetApi.getQuestionSetById(questionSetId);
        
        if (response.success && response.data) {
          // 判断是否是试用模式 - 改进检测方式
          const isTrialMode = isTrialParam;
          console.log(`[QuizPage] 试用模式检测结果: mode参数=${mode}, isTrialMode=${isTrialMode}`);
          
          // 更新明确的试用模式状态
          setIsInTrialMode(isTrialMode);
          
          // 设置试用题目数量，优先使用URL参数中的值
          const trialQuestionCount = isTrialMode && trialLimit 
            ? parseInt(trialLimit, 10) 
            : response.data.trialQuestions;
          
          console.log(`[QuizPage] 试用题目设置: 数量=${trialQuestionCount}, 来源=${isTrialMode && trialLimit ? 'URL参数' : '题库默认值'}`);
          
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
            trialQuestions: trialQuestionCount !== undefined && trialQuestionCount !== null ? trialQuestionCount : (response.data.trialQuestions || 3), // 设置试用题目数量，确保有默认值
            questionCount: getQuestions(response.data).length,
            createdAt: new Date(),
            updatedAt: new Date()
          };
          
          console.log(`[QuizPage] 题库数据处理: isPaid=${questionSetData.isPaid}, trialQuestions=${questionSetData.trialQuestions}`);
          
          setQuestionSet(questionSetData);
          
          // 如果是试用模式，确保相关状态正确设置
          if (isTrialMode && questionSetData.isPaid) {
            console.log(`[QuizPage] 确认进入试用模式: isPaid=${questionSetData.isPaid}, 限制题目数=${trialQuestionCount}`);
            // 显式设置没有完全访问权限
            setHasAccessToFullQuiz(false);
            setHasRedeemed(false);
            // 显式设置试用模式
            setIsInTrialMode(true);
            document.title = `${questionSetData.title} (试用模式) - 答题系统`;
            
            // 强制将当前模式存储在sessionStorage中，确保页面刷新后仍保持试用模式
            sessionStorage.setItem(`quiz_${questionSetId}_trial_mode`, 'true');
            if (trialQuestionCount) {
              sessionStorage.setItem(`quiz_${questionSetId}_trial_limit`, String(trialQuestionCount));
            }
          } else {
            // 检查是否有存储的试用模式状态
            const storedTrialMode = sessionStorage.getItem(`quiz_${questionSetId}_trial_mode`) === 'true';
            const storedTrialLimit = sessionStorage.getItem(`quiz_${questionSetId}_trial_limit`);
            
            if (storedTrialMode && questionSetData.isPaid) {
              console.log(`[QuizPage] 从sessionStorage恢复试用模式, 限制题目数=${storedTrialLimit || questionSetData.trialQuestions}`);
              
              // 恢复试用模式设置
              setHasAccessToFullQuiz(false);
              setHasRedeemed(false);
              setIsInTrialMode(true);
              
              // 更新题目限制
              if (storedTrialLimit) {
                questionSetData.trialQuestions = parseInt(storedTrialLimit, 10);
                setQuestionSet({...questionSetData});
              }
              
              document.title = `${questionSetData.title} (试用模式) - 答题系统`;
              
              // 显示试用模式提示
              const trialCount = questionSetData.trialQuestions || 3;
              toast.info(`您正在试用模式下答题，可以答${trialCount}道题`, {
                autoClose: 5000,
                icon: '🔍'
              });
            } else {
              setIsInTrialMode(false);
              document.title = `${questionSetData.title} - 答题系统`;
              // 清除可能的试用模式标记
              sessionStorage.removeItem(`quiz_${questionSetId}_trial_mode`);
              sessionStorage.removeItem(`quiz_${questionSetId}_trial_limit`);
            }
          }

          // 使用题库中包含的题目数据
          const questionsData = getQuestions(response.data);
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
            
            // 如果是试用模式，显示提示
            if (isTrialMode) {
              const trialCount = trialQuestionCount || questionSetData.trialQuestions || 3; // 默认至少显示3题
              toast.info(`您正在试用模式下答题，可以答${trialCount}道题`, {
                autoClose: 5000,
                icon: '🔍'
              });
              
              // 确保购买和兑换按钮在试用模式下可用
              if (questionSetData.isPaid) {
                console.log('[QuizPage] 试用付费题库，设置相关状态');
                // 根据URL参数设置状态以确保试用功能正常
                setHasAccessToFullQuiz(false);
                setHasRedeemed(false);
                // 清除试用结束状态，允许用户开始试用
                setTrialEnded(false);
              }
            }
            
            // 初始化问题开始时间
            setQuestionStartTime(Date.now());
            
            // 移除对initQuizState的调用，我们将直接在加载题目时处理初始化逻辑
            // 从本地存储加载上次的答题进度
            try {
              const localProgressKey = `quiz_progress_${questionSetId}`;
              const savedProgressStr = localStorage.getItem(localProgressKey);
              
              if (savedProgressStr) {
                const savedProgress = JSON.parse(savedProgressStr);
                console.log('[QuizPage] 找到本地保存的进度:', savedProgress);
                
                // 确认进度数据有效且不超过24小时
                const lastUpdated = new Date(savedProgress.lastUpdated || 0);
                const now = new Date();
                const hoursSinceLastUpdate = (now.getTime() - lastUpdated.getTime()) / (1000 * 60 * 60);
                
                if (hoursSinceLastUpdate < 24 && 
                    savedProgress.answeredQuestions && 
                    Array.isArray(savedProgress.answeredQuestions)) {
                  
                  // 检查是否有 lastQuestionIndex，确保在有效范围内
                  let startIndex = 0;
                  if (savedProgress.lastQuestionIndex !== undefined && 
                      savedProgress.lastQuestionIndex >= 0 && 
                      savedProgress.lastQuestionIndex < processedQuestions.length) {
                    startIndex = savedProgress.lastQuestionIndex;
                  } 
                  // 否则基于已答题记录计算下一题位置
                  else if (savedProgress.answeredQuestions.length > 0) {
                    // 找出最大的已答题索引
                    const indices = savedProgress.answeredQuestions
                      .filter((q: any) => q.questionIndex !== undefined)
                      .map((q: any) => q.questionIndex);
                    
                    if (indices.length > 0) {
                      const maxAnsweredIndex = Math.max(...indices);
                      // 从下一题开始，但不超过题目总数
                      startIndex = Math.min(maxAnsweredIndex + 1, processedQuestions.length - 1);
                    }
                  }
                  
                  console.log(`[QuizPage] 从本地进度恢复: 从第${startIndex + 1}题开始`);
                  setCurrentQuestionIndex(startIndex);
                  
                  // 恢复已回答问题列表
                  const validAnsweredQuestions = savedProgress.answeredQuestions
                    .filter((q: any) => q.questionIndex !== undefined && q.questionIndex < processedQuestions.length)
                    .map((q: any) => ({
                      index: q.index || 0,
                      questionIndex: q.questionIndex,
                      isCorrect: q.isCorrect || false,
                      selectedOption: q.selectedOption || ''
                    }));
                  
                  console.log('[QuizPage] 恢复已回答问题列表:', validAnsweredQuestions.length, '道题');
                  setAnsweredQuestions(validAnsweredQuestions);
                  
                  // 计算正确答题数
                  const correctCount = validAnsweredQuestions.filter((q: any) => q.isCorrect).length;
                  setCorrectAnswers(correctCount);
                  
                  // 从本地存储恢复后，仍需请求服务器进度
                  if (socket && user?.id) {
                    console.log('[QuizPage] 恢复本地进度后，请求服务器进度以确保最新');
                    socket.emit('progress:get', {
                      userId: user.id,
                      questionSetId
                    });
                  }
                } else {
                  console.log('[QuizPage] 本地进度已过期或无效，使用新进度');
                  // 没有有效的本地进度时，从第一题开始并请求服务器进度
                  setCurrentQuestionIndex(0);
                  setAnsweredQuestions([]);
                  setCorrectAnswers(0);
                  
                  if (socket && user?.id) {
                    console.log('[QuizPage] 请求服务器进度数据');
                    socket.emit('progress:get', {
                      userId: user.id,
                      questionSetId
                    });
                  }
                }
              } else {
                console.log('[QuizPage] 未找到本地保存的进度');
                // 没有本地进度时，从第一题开始并请求服务器进度
                setCurrentQuestionIndex(0);
                setAnsweredQuestions([]);
                setCorrectAnswers(0);
                
                if (socket && user?.id) {
                  console.log('[QuizPage] 请求服务器进度数据');
                  socket.emit('progress:get', {
                    userId: user.id,
                    questionSetId
                  });
                }
              }
            } catch (e) {
              console.error('[QuizPage] 读取本地进度时出错:', e);
              // 出错时，从第一题开始
              setCurrentQuestionIndex(0);
              setAnsweredQuestions([]);
              setCorrectAnswers(0);
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
  }, [questionSetId, socket, user]);
  
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

  // 处理Socket事件
  useEffect(() => {
    if (!socket || !user?.id) return;

    const handleProgressData = (data: ProgressData) => {
      // 处理进度数据
      if (data && data.answeredQuestions) {
        setAnsweredQuestions(data.answeredQuestions);
        if (data.lastQuestionIndex !== undefined) {
          setCurrentQuestionIndex(data.lastQuestionIndex);
        }
      }
    };

    // 使用类型断言
    (socket as Socket).on('progress:data', handleProgressData);
    
    return () => {
      // 使用类型断言
      (socket as Socket).off('progress:data', handleProgressData);
    };
  }, [socket, user?.id]);
  
  // 处理选择选项
  const handleOptionSelect = (optionId: string) => {
    // 如果试用已结束且没有购买，不允许继续答题
    if (trialEnded && !hasAccessToFullQuiz && !hasRedeemed) {
      toast.warning('试用已结束，请购买完整版或使用兑换码继续答题');
      setShowPaymentModal(true);
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
  
  // 修复handleAnswerSubmit函数，确保正确记录答题状态
  const handleAnswerSubmit = useCallback(async (
    selectedOption: string | string[], 
    isCorrect: boolean, 
    question: Question,
    questionIndex: number
  ) => {
    console.log(`[QuizPage] 提交答案: isCorrect=${isCorrect}, selectedOption=`, selectedOption);
    
    // 防止重复提交
    if (isSubmittingRef.current) {
      console.log('[QuizPage] 正在提交中，忽略此次提交');
      return;
    }
    
    isSubmittingRef.current = true;
    
    try {
      if (!questionSetId || !question.id) {
        console.error('[QuizPage] 题目ID或题库ID缺失，无法保存进度');
        return;
      }
      
      // 计算当前问题的答题用时（毫秒）
      const timeSpent = Date.now() - questionStartTime;
      
      // 首先检查是否为重复提交 - 修复：只使用questionIndex作为唯一标识，不再使用index
      const alreadyAnswered = answeredQuestions.findIndex(q => 
        q.questionIndex === questionIndex
      );
      
      // 构建新的已答问题对象
      const newAnsweredQuestion: AnsweredQuestion = {
        index: answeredQuestions.length, // 递增索引，确保唯一性
        questionIndex: questionIndex, // 添加问题索引以确保跨会话一致性
        isCorrect,
        selectedOption
      };
      
      // 更新已答问题列表 - 如果已存在则替换，否则添加
      let updatedAnsweredQuestions: AnsweredQuestion[];
      if (alreadyAnswered >= 0) {
        // 替换现有记录
        updatedAnsweredQuestions = [...answeredQuestions];
        updatedAnsweredQuestions[alreadyAnswered] = newAnsweredQuestion;
        console.log(`[QuizPage] 更新第${questionIndex + 1}题的现有答题记录`);
      } else {
        // 添加新记录
        updatedAnsweredQuestions = [...answeredQuestions, newAnsweredQuestion];
        console.log(`[QuizPage] 添加第${questionIndex + 1}题的新答题记录`);
      }
      
      // 更新正确答题计数器
      const newCorrectCount = updatedAnsweredQuestions.filter(q => q.isCorrect).length;
      setCorrectAnswers(newCorrectCount);
      
      // 更新状态显示已答问题
      setAnsweredQuestions(updatedAnsweredQuestions);
      
      // 更新本地存储
      const localProgressUpdate = {
        lastQuestionIndex: questionIndex,
        answeredQuestions: updatedAnsweredQuestions,
        correctAnswers: newCorrectCount,
        totalAnswered: updatedAnsweredQuestions.length,
        totalQuestions: questions.length,
        lastUpdated: new Date().toISOString()
      };
      
      // 保存到本地存储以支持离线场景
      try {
        const localProgressKey = `quiz_progress_${questionSetId}`;
        localStorage.setItem(localProgressKey, JSON.stringify(localProgressUpdate));
        console.log(`[QuizPage] 已更新本地进度存储，包含${updatedAnsweredQuestions.length}道已答题目`);
      } catch (e) {
        console.error('[QuizPage] 保存本地进度失败:', e);
      }
      
      // 标记有未同步的更改
      unsyncedChangesRef.current = true;
      
      // 通过socket.io进行同步
      if (socket && user) {
        const progressData: ExtendedSaveProgressParams = {
          questionId: String(question.id),
          questionSetId,
          selectedOption,
          isCorrect,
          timeSpent,
          lastQuestionIndex: questionIndex
        };
        
        socket.emit('progress:save', progressData);
        console.log('[QuizPage] 已通过socket发送进度保存请求');
      } else {
        console.log('[QuizPage] Socket未连接或用户未登录，跳过服务器同步');
      }
      
      // 检查是否达到试用限制
      if (questionSet && isInTrialMode && !hasAccessToFullQuiz && !hasRedeemed) {
        const trialQuestions = questionSet.trialQuestions || 0;
        if (trialQuestions > 0 && updatedAnsweredQuestions.length >= trialQuestions) {
          console.log(`[QuizPage] 已达到试用题目限制(${updatedAnsweredQuestions.length}/${trialQuestions})，设置trialEnded=true`);
          setTrialEnded(true);
          
          // 延迟显示购买提示
          setTimeout(() => {
            if (!hasAccessToFullQuiz && !hasRedeemed) {
              setShowPaymentModal(true);
            }
          }, 1500);
        }
      }
    } catch (error) {
      console.error('[QuizPage] 保存进度或答案时出错:', error);
    } finally {
      // 重置提交状态
      isSubmittingRef.current = false;
    }
  }, [answeredQuestions, questionSetId, questionStartTime, questions.length, socket, user, isInTrialMode, hasAccessToFullQuiz, hasRedeemed, questionSet, setTrialEnded, setShowPaymentModal]);
  
  // 修改处理答案提交的函数，确保模态窗口显示
  const handleAnswerSubmitAdapter = useCallback((isCorrect: boolean, selectedOption: string | string[]) => {
    // 获取当前问题
    const currentQ = questions[currentQuestionIndex];
    if (currentQ) {
      // 使用正确的参数顺序调用handleAnswerSubmit
      handleAnswerSubmit(selectedOption, isCorrect, currentQ, currentQuestionIndex);
      
      // 更新本地变量预测即将更新的答题数
      const newAnsweredCount = answeredQuestions.length + 1;
      
      console.log('[QuizPage] 答题后检查试用限制:', {
        currentAnswered: answeredQuestions.length,
        willBeAnswered: newAnsweredCount,
        trialLimit: questionSet?.trialQuestions,
        isPaid: questionSet?.isPaid,
        hasAccess: hasAccessToFullQuiz,
        hasRedeemed: hasRedeemed
      });
      
      // 提前检查是否将达到试用限制
      if (questionSet?.isPaid && !hasAccessToFullQuiz && !hasRedeemed && 
          questionSet.trialQuestions && newAnsweredCount >= questionSet.trialQuestions) {
        
        console.log('[QuizPage] 答题后即将达到试用限制，准备显示购买窗口');
        
        // 延迟显示购买窗口，给用户时间查看答案
        setTimeout(() => {
          // 再次检查确认状态没有变化
          if (!hasAccessToFullQuiz && !hasRedeemed) {
            console.log('[QuizPage] 显示购买窗口');
            setTrialEnded(true);
            setShowPaymentModal(true);
            
            // 显示提示
            toast.info('您已达到试用题目限制，请购买完整版继续使用', {
              position: 'top-center',
              autoClose: 5000,
              toastId: 'answer-submit-limit'
            });
          }
        }, 1500);
      }
    }
  }, [questions, currentQuestionIndex, handleAnswerSubmit, questionSet, hasAccessToFullQuiz, hasRedeemed, answeredQuestions.length]);
  
  // 修改下一题逻辑，确保试用限制
  const handleNextQuestion = useCallback(() => {
    // 如果有未同步的数据且已经累积了多个回答，定期同步
    if (unsyncedChangesRef.current && answeredQuestions.length > 0 && answeredQuestions.length % 5 === 0) {
      // 每答完5题同步一次
      syncProgressToServer();
    }
    
    // 检查是否达到试用限制
    const isAtTrialLimit = questionSet?.isPaid && 
                          !hasAccessToFullQuiz && 
                          !hasRedeemed && 
                          questionSet?.trialQuestions && 
                          questionSet.trialQuestions > 0 && 
                          answeredQuestions.length >= questionSet.trialQuestions;
    
    if (isAtTrialLimit && questionSet?.trialQuestions) {
      console.log('[QuizPage] 已达到试用题目限制，显示购买提示:', {
        answeredCount: answeredQuestions.length,
        trialLimit: questionSet.trialQuestions
      });
      
      // 显示提示信息
      toast.info(`您已完成 ${questionSet.trialQuestions} 道试用题目，请购买完整版或使用兑换码继续`, {
        position: "top-center",
        autoClose: 8000,
        toastId: "trial-limit-toast",
      });
      
      // 直接显示购买模态窗口
      setShowPaymentModal(true);
      return; // 阻止继续前进到下一题
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
  }, [
    currentQuestionIndex, 
    questions.length, 
    answeredQuestions.length, 
    syncProgressToServer, 
    questionSet,
    hasAccessToFullQuiz,
    hasRedeemed
  ]);

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
  
  // 确保handleResetQuiz也同步进度
  const handleResetQuiz = useCallback(async () => {
    try {
      setLoading(true);
      
      // 清除任何现有的定时器
      if (timeoutId.current) {
        clearTimeout(timeoutId.current);
        timeoutId.current = undefined;
      }
      
      // 首先同步当前进度
      if (unsyncedChangesRef.current) {
        await syncProgressToServer(true);
        unsyncedChangesRef.current = false;
      }
      
      // 重置计时器
      setQuizTotalTime(0);
      setQuizStartTime(Date.now());
      setIsTimerActive(true);
      
      // 重置所有状态
      setCurrentQuestionIndex(0);
      setSelectedOptions([]);
      setShowExplanation(false);
      setAnsweredQuestions([]);
      setCorrectAnswers(0);
      setQuizComplete(false);
      setQuestionStartTime(Date.now());
      
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
        // 1. 清除sessionStorage中的标记
        if (questionSet) {
          console.log(`[QuizPage] 清除sessionStorage中的完成标记`);
          sessionStorage.removeItem(`quiz_completed_${questionSet.id}`);
          // 设置重置标记
          sessionStorage.setItem('quiz_reset_required', 'true');
          
          // 2. 清除localStorage中可能的进度缓存
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
              
              // 更新URL，移除lastQuestion参数
              if (questionSet) {
                navigate(`/quiz/${questionSet.id}`, { replace: true });
              }
            }
          });
          
          // 设置超时，确保不会因为服务器响应问题而挂起
          timeoutId.current = setTimeout(() => {
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
    navigate,
    socket,
    user,
    questions
  ]);

  // 创建一个固定在页面底部的购买栏组件
  const TrialPurchaseBar = () => {
    // 仅当满足以下条件时显示：付费题库 + 试用模式 + 无完整访问权限
    if (!questionSet?.isPaid || hasAccessToFullQuiz || hasRedeemed) {
      return null;
    }
    
    return (
      <div className="fixed bottom-0 left-0 right-0 bg-white shadow-lg border-t border-gray-200 p-3 z-40">
        <div className="container mx-auto flex items-center justify-between">
          <div className="flex-1">
            <p className="text-sm text-gray-700">
              <span className="font-medium">试用模式:</span> 已答 
              <span className="text-blue-600 font-bold mx-1">{answeredQuestions.length}</span> 题，
              限制 <span className="text-blue-600 font-bold mx-1">{questionSet.trialQuestions}</span> 题
            </p>
          </div>
          <div className="flex space-x-2">
            <button
              onClick={() => setShowPaymentModal(true)}
              className="px-4 py-2 bg-blue-600 text-white text-sm rounded-md hover:bg-blue-700 focus:outline-none shadow-sm"
            >
              购买完整版 ¥{questionSet.price || 0}
            </button>
            <button
              onClick={() => setShowRedeemCodeModal(true)}
              className="px-4 py-2 bg-green-50 text-green-700 text-sm border border-green-300 rounded-md hover:bg-green-100 focus:outline-none shadow-sm"
            >
              使用兑换码
            </button>
          </div>
        </div>
      </div>
    );
  };

  // 渲染内容更新
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
            {/* 添加试用模式下的购买和兑换按钮 */}
            {(isInTrialMode || (questionSet?.isPaid && !hasAccessToFullQuiz)) && (
              <div className="flex mr-4 space-x-2">
                <button
                  onClick={() => {
                    console.log('[QuizPage] 点击购买按钮，打开支付模态框');
                    setShowPaymentModal(true);
                  }}
                  className="px-3 py-1 bg-blue-600 text-white text-sm rounded hover:bg-blue-700 focus:outline-none transition-colors"
                >
                  购买完整版
                </button>
                <button
                  onClick={() => {
                    console.log('[QuizPage] 点击兑换码按钮，打开兑换模态框');
                    setShowRedeemCodeModal(true);
                  }}
                  className="px-3 py-1 bg-green-50 text-green-700 text-sm border border-green-300 rounded hover:bg-green-100 focus:outline-none transition-colors"
                >
                  使用兑换码
                </button>
              </div>
            )}

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
        {questions.length > 0 && currentQuestionIndex < questions.length && (
          <QuestionCard
            question={questions[currentQuestionIndex]}
            questionNumber={currentQuestionIndex + 1}
            totalQuestions={questions.length}
            onAnswerSubmitted={handleAnswerSubmitAdapter}
            onNext={handleNextQuestion}
            onJumpToQuestion={handleJumpToQuestion}
            isPaid={questionSet?.isPaid}
            hasFullAccess={hasAccessToFullQuiz}
            questionSetId={questionSetId || ''}
            isLast={currentQuestionIndex === questions.length - 1}
            trialQuestions={questionSet?.trialQuestions}
            isSubmittingAnswer={isSubmittingRef.current}
          />
        )}
        
        {/* 答题卡 */}
        <AnswerCard
          totalQuestions={questions.length}
          answeredQuestions={answeredQuestions}
          currentIndex={currentQuestionIndex}
          trialLimit={questionSet?.trialQuestions}
          isTrialMode={isInTrialMode && !hasAccessToFullQuiz && !hasRedeemed}
          onJump={handleJumpToQuestion}
        />
        
        {/* 进度条 */}
        <div className="mt-6 bg-gray-200 rounded-full h-2.5 mb-6">
          <div 
            className="bg-blue-600 h-2.5 rounded-full transition-all duration-500"
            style={{ width: `${Math.round((answeredQuestions.length / questions.length) * 100)}%` }}
          ></div>
        </div>
      </div>
    );
  };

  // 返回函数更新
  return (
    <div className="min-h-screen bg-gray-50 py-8 pb-20">
      {/* 固定在底部的购买栏 */}
      <TrialPurchaseBar />
      
      <div className="container mx-auto px-4">
        {/* 试用模式指示器 - 在页面顶部显示 */}
        {isInTrialMode && questionSet?.isPaid && !hasAccessToFullQuiz && !hasRedeemed && (
          <div className="bg-yellow-50 border-l-4 border-yellow-400 p-4 mb-6 rounded shadow-sm">
            <div className="flex items-center">
              <div className="flex-shrink-0">
                <svg className="h-5 w-5 text-yellow-400" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20" fill="currentColor">
                  <path fillRule="evenodd" d="M18 10a8 8 0 11-16 0 8 8 0 0116 0zm-7-4a1 1 0 11-2 0 1 1 0 012 0zM9 9a1 1 0 000 2v3a1 1 0 001 1h1a1 1 0 100-2v-3a1 1 0 00-1-1H9z" clipRule="evenodd" />
                </svg>
              </div>
              <div className="ml-3">
                <p className="text-sm text-yellow-700">
                  <span className="font-medium">试用模式</span> - 您可以免费回答 {questionSet.trialQuestions} 道题目（已回答 {answeredQuestions.length} 题）
                </p>
              </div>
              <div className="ml-auto flex space-x-2">
                <button
                  onClick={() => setShowPaymentModal(true)}
                  className="px-3 py-1 bg-blue-600 text-white text-sm rounded hover:bg-blue-700 focus:outline-none"
                >
                  购买完整版
                </button>
                <button
                  onClick={() => setShowRedeemCodeModal(true)}
                  className="px-3 py-1 bg-green-50 text-green-700 text-sm border border-green-300 rounded hover:bg-green-100 focus:outline-none"
                >
                  使用兑换码
                </button>
              </div>
            </div>
          </div>
        )}
        
        {renderContent()}
        
        {/* 购买模态窗口 */}
        {showPaymentModal && questionSet && (
          <PaymentModal
            isOpen={showPaymentModal}
            onClose={() => setShowPaymentModal(false)}
            questionSet={questionSet}
            onSuccess={() => {
              setHasAccessToFullQuiz(true);
              setTrialEnded(false);
              setShowPaymentModal(false);
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
              }} />
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

export default QuizPage; 
