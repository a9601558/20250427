import { useState, useEffect, useRef, useCallback } from 'react';
import { useParams, useNavigate, useLocation } from 'react-router-dom';
import { Question } from '../types/index';
import { useUser } from '../contexts/UserContext';
import { questionSetApi } from '../utils/api';
import { useSocket } from '../contexts/SocketContext';
import { userProgressService, wrongAnswerService } from '../services/api';
import { purchaseService, redeemCodeService, userService } from '../services/api';
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
  isTrialMode?: boolean;
  isTrialLimitReached?: boolean; // 新增，是否已达到试用限制
}> = ({ totalQuestions, answeredQuestions, currentIndex, onJump, trialLimit, isTrialMode, isTrialLimitReached }) => {
  // 生成按钮
  return (
    <div className="flex flex-col bg-white rounded-xl shadow-md p-5 mb-5">
      <h3 className="text-lg font-medium text-gray-700 mb-4">答题卡</h3>
      <div className="grid grid-cols-5 gap-2 sm:grid-cols-8 md:grid-cols-10">
        {Array.from({length: totalQuestions}).map((_, index) => {
          const answered = answeredQuestions.find(q => q.questionIndex === index);
          const isActive = currentIndex === index;
          
          // 修改禁用逻辑：如果已达到试用限制，禁用所有非当前激活的题目
          // 只有当前题目可以操作（保持当前状态），其他题目都禁用
          const isDisabled = isTrialMode && isTrialLimitReached && !isActive;
          
          let bgColor = "bg-gray-100 text-gray-600";
          if (isActive) {
            bgColor = "bg-blue-500 text-white";
          } else if (answered) {
            bgColor = answered.isCorrect 
              ? "bg-green-500 text-white" 
              : "bg-red-500 text-white";
          } else if (isDisabled) {
            bgColor = "bg-gray-200 text-gray-400 cursor-not-allowed";
          }
          
          return (
            <button
              key={index}
              className={`w-8 h-8 rounded-full flex items-center justify-center text-sm ${bgColor} ${
                isDisabled ? "opacity-50 pointer-events-none" : "hover:bg-opacity-80"
              }`}
              onClick={() => !isDisabled && onJump(index)}
              disabled={isDisabled}
              title={isDisabled ? "需要购买完整版才能访问" : `跳转到第${index + 1}题`}
            >
              {index + 1}
              {isDisabled && (
                <span className="absolute -top-1 -right-1">
                  <svg className="w-3 h-3 text-gray-500" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20" fill="currentColor">
                    <path fillRule="evenodd" d="M5 9V7a5 5 0 0110 0v2a2 2 0 012 2v5a2 2 0 01-2 2H5a2 2 0 01-2-2v-5a2 2 0 012-2zm8-2v2H7V7a3 3 0 016 0z" clipRule="evenodd" />
                  </svg>
                </span>
              )}
            </button>
          );
        })}
      </div>
      
      {/* 更新试用限制提示的文本 */}
      {isTrialMode && trialLimit && !isTrialLimitReached && (
        <div className="mt-3 text-xs text-center text-gray-500">
          您正在试用模式，可使用 <span className="font-medium text-blue-600">{trialLimit}</span> 道题，
          已答 <span className="font-medium text-blue-600">{answeredQuestions.length}</span> 道
        </div>
      )}
      
      {isTrialMode && isTrialLimitReached && (
        <div className="mt-3 text-xs text-center text-orange-600 font-medium">
          已达到试用题目上限，请购买完整版继续使用，无法回看已答题目
        </div>
      )}
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

// 修改 IQuestionSet 接口添加 expiryDate 属性
interface IQuestionSet {
  id: string;
  title: string;
  description: string;
  questionCount: number;
  isPaid: boolean;
  price: number;
  trialQuestions: number;
  questions?: Question[];
  trialEnded?: boolean;
  category?: string;
  expiryDate?: string; // 添加题库有效期字段
  icon?: string; // Add icon property that was missing
  isFeatured?: boolean;
  featuredCategory?: string;
  hasAccess?: boolean;
  createdAt: Date;
  updatedAt: Date;
}

// 改进PurchasePage组件
const PurchasePage: React.FC<{
  questionSet: IQuestionSet | null;
  onPurchase: () => void;
  onRedeem: () => void;
  onBack: () => void;
  trialCount: number;
  isProcessing?: boolean;
}> = ({ questionSet, onPurchase, onRedeem, onBack, trialCount, isProcessing = false }) => {
  // Add local states to prevent double clicks
  const [isProcessingPurchase, setIsProcessingPurchase] = useState(false);
  const [isProcessingRedeem, setIsProcessingRedeem] = useState(false);
  
  // Handlers with debounce
  const handlePurchase = () => {
    if (isProcessingPurchase || isProcessingRedeem || isProcessing) return;
    setIsProcessingPurchase(true);
    onPurchase();
    // Reset after a delay in case the parent component doesn't update isProcessing
    setTimeout(() => setIsProcessingPurchase(false), 1000);
  };
  
  const handleRedeem = () => {
    if (isProcessingPurchase || isProcessingRedeem || isProcessing) return;
    setIsProcessingRedeem(true);
    onRedeem();
    // Reset after a delay in case the parent component doesn't update isProcessing
    setTimeout(() => setIsProcessingRedeem(false), 1000);
  };
  
  const handleBack = () => {
    if (isProcessingPurchase || isProcessingRedeem || isProcessing) return;
    onBack();
  };
  
  return (
    <div className="fixed inset-0 bg-gray-800 bg-opacity-95 z-50 flex items-center justify-center">
      <div className="bg-white rounded-xl shadow-xl max-w-lg w-full mx-4 p-6 relative overflow-hidden">
        {/* 如果正在处理请求，显示Loading覆盖层 */}
        {(isProcessing || isProcessingPurchase || isProcessingRedeem) && (
          <div className="absolute inset-0 bg-white bg-opacity-80 flex flex-col items-center justify-center z-10">
            <div className="w-16 h-16 border-t-4 border-blue-500 border-solid rounded-full animate-spin mb-3"></div>
            <p className="text-blue-600 font-semibold">正在处理，请稍候...</p>
          </div>
        )}
        
        <div className="text-center mb-6">
          <div className="inline-block p-3 bg-blue-100 rounded-full text-blue-600 mb-3">
            <svg className="w-8 h-8" fill="none" stroke="currentColor" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
            </svg>
          </div>
          <h2 className="text-2xl font-bold text-gray-800 mb-2">试用已结束</h2>
          <p className="text-gray-600 mb-1">您已完成 {trialCount} 道试用题目</p>
          <p className="text-gray-600 mb-4">请购买完整版或使用兑换码继续使用</p>
        </div>
        
        <div className="bg-blue-50 p-4 rounded-lg mb-6">
          <h3 className="text-lg font-medium text-blue-800 mb-2">{questionSet?.title || '题库'}</h3>
          <p className="text-blue-700 mb-3">{questionSet?.description || '详细学习各种问题，提升知识水平。'}</p>
          <div className="flex items-center justify-between">
            <span className="text-2xl font-bold text-blue-800">¥{questionSet?.price || '0'}</span>
            <span className="bg-blue-200 text-blue-800 px-2 py-1 rounded text-sm">包含 {questionSet?.questionCount || '0'} 道题</span>
          </div>
        </div>
        
        <div className="space-y-3 mb-6">
          <button 
            onClick={handlePurchase}
            className="w-full py-3 bg-blue-600 hover:bg-blue-700 text-white rounded-lg font-medium transition flex items-center justify-center disabled:opacity-70 disabled:cursor-not-allowed"
            disabled={isProcessing || isProcessingPurchase || isProcessingRedeem}
          >
            <svg className="w-5 h-5 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 10h18M7 15h1m4 0h1m-7 4h12a3 3 0 003-3V8a3 3 0 00-3-3H6a3 3 0 00-3 3v8a3 3 0 003 3z" />
            </svg>
            立即购买完整版
          </button>
          
          <button 
            onClick={handleRedeem}
            className="w-full py-3 bg-green-50 hover:bg-green-100 text-green-700 border border-green-300 rounded-lg font-medium transition flex items-center justify-center disabled:opacity-70 disabled:cursor-not-allowed"
            disabled={isProcessing || isProcessingPurchase || isProcessingRedeem}
          >
            <svg className="w-5 h-5 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M7 7h.01M7 3h5c.512 0 1.024.195 1.414.586l7 7a2 2 0 010 2.828l-7 7a2 2 0 01-2.828 0l-7-7A1.994 1.994 0 013 12V7a4 4 0 014-4z" />
            </svg>
            使用兑换码解锁
          </button>
          
          <button 
            onClick={handleBack}
            className="w-full py-3 bg-gray-100 hover:bg-gray-200 text-gray-700 rounded-lg font-medium transition flex items-center justify-center disabled:opacity-70 disabled:cursor-not-allowed"
            disabled={isProcessing || isProcessingPurchase || isProcessingRedeem}
          >
            <svg className="w-5 h-5 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 19l-7-7m0 0l7-7m-7 7h18" />
            </svg>
            返回首页
          </button>
        </div>
        
        <p className="text-xs text-center text-gray-500">
          付费后立即获得完整题库的访问权限，内容持续更新
        </p>
      </div>
    </div>
  );
};

// 添加访问权限对象的类型定义
interface AccessRights {
  [key: string]: boolean | number;
}

// 在合适的位置添加PaymentModal和RedeemCodeModal的Props接口定义
interface PaymentModalProps {
  isOpen: boolean; // Add isOpen property to match usage
  questionSet: IQuestionSet | null;
  onClose: () => void;
  onSuccess: (data: any) => void; // Changed from onPurchaseSuccess to match usage
}

interface RedeemCodeModalProps {
  questionSet: IQuestionSet | null;
  onClose: () => void;
  onRedeemSuccess: () => void;
}

// 添加PaymentModal组件
const PaymentModal: React.FC<PaymentModalProps> = ({ questionSet, onClose, onSuccess, isOpen }) => {
  const { user } = useUser();
  const [isProcessing, setIsProcessing] = useState(false);
  const [paymentMethod, setPaymentMethod] = useState<string>('wechat');
  const [error, setError] = useState<string | null>(null);
  const processingTimeoutRef = useRef<NodeJS.Timeout | null>(null);
  
  // Clear timeout on unmount
  useEffect(() => {
    return () => {
      if (processingTimeoutRef.current) {
        clearTimeout(processingTimeoutRef.current);
      }
    };
  }, []);
  
  const handlePurchase = async () => {
    if (!user || !questionSet || isProcessing) return;
    
    setIsProcessing(true);
    setError(null);
    
    try {
      console.log('[PaymentModal] 正在进行购买操作...', {
        questionSetId: questionSet.id,
        paymentMethod,
        price: questionSet.price
      });
      
      // 调用购买API
      const response = await purchaseService.createPurchase(
        questionSet.id,
        paymentMethod,
        questionSet.price
      );
      
      console.log('[PaymentModal] 购买API响应:', response);
      
      if (response.success && response.data) {
        console.log('[PaymentModal] 购买成功:', response.data);
        toast.success('购买成功！您现在可以访问完整题库');
        
        // First, save success state to localStorage to ensure access rights are immediately available
        localStorage.setItem(`quiz_access_${questionSet.id}`, JSON.stringify({
          hasAccess: true,
          timestamp: Date.now(),
          expiryDate: response.data.expiryDate,
        }));
        
        // Then call onSuccess with a short delay
        processingTimeoutRef.current = setTimeout(() => {
          onSuccess(response.data);
          setIsProcessing(false);
        }, 500);
      } else {
        console.error('[PaymentModal] 购买失败:', response);
        setError(response.message || '购买失败，请稍后再试');
        setIsProcessing(false);
      }
    } catch (err) {
      console.error('[PaymentModal] 购买出错:', err);
      setError('购买过程中出现错误，请稍后再试');
      setIsProcessing(false);
    }
  };
  
  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 z-50 flex items-center justify-center p-4">
      <div className="bg-white rounded-xl max-w-md w-full p-6 relative">
        {isProcessing && (
          <div className="absolute inset-0 flex flex-col items-center justify-center bg-white bg-opacity-90 z-10 rounded-xl">
            <div className="w-12 h-12 border-t-4 border-blue-500 border-solid rounded-full animate-spin mb-3"></div>
            <p className="text-blue-600 font-medium">处理中，请稍候...</p>
          </div>
        )}
        
        <button
          onClick={onClose}
          disabled={isProcessing}
          className="absolute top-4 right-4 text-gray-400 hover:text-gray-600"
        >
          <svg className="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
          </svg>
        </button>
        
        <h2 className="text-xl font-bold text-gray-800 mb-4">购买完整版</h2>
        
        <div className="bg-blue-50 p-4 rounded-lg mb-6">
          <div className="flex justify-between items-start mb-2">
            <h3 className="text-lg font-medium text-blue-800">{questionSet?.title}</h3>
            <span className="text-xl font-bold text-blue-800">¥{questionSet?.price}</span>
          </div>
          <p className="text-blue-700 text-sm mb-2">{questionSet?.description}</p>
          <span className="bg-blue-200 text-blue-800 px-2 py-1 rounded text-xs">
            包含 {questionSet?.questionCount} 道题 | 购买后永久有效
          </span>
        </div>
        
        {error && (
          <div className="bg-red-50 text-red-700 p-3 rounded-lg mb-4 text-sm">
            {error}
          </div>
        )}
        
        <div className="mb-6">
          <label className="block text-gray-700 font-medium mb-2">选择支付方式</label>
          <div className="space-y-2">
            <label className="flex items-center p-3 border rounded-lg cursor-pointer hover:bg-gray-50">
              <input
                type="radio"
                name="paymentMethod"
                value="wechat"
                checked={paymentMethod === 'wechat'}
                onChange={() => setPaymentMethod('wechat')}
                className="h-4 w-4 text-blue-600"
                disabled={isProcessing}
              />
              <span className="ml-2 text-gray-700">微信支付</span>
            </label>
            
            <label className="flex items-center p-3 border rounded-lg cursor-pointer hover:bg-gray-50">
              <input
                type="radio"
                name="paymentMethod"
                value="alipay"
                checked={paymentMethod === 'alipay'}
                onChange={() => setPaymentMethod('alipay')}
                className="h-4 w-4 text-blue-600"
                disabled={isProcessing}
              />
              <span className="ml-2 text-gray-700">支付宝</span>
            </label>
          </div>
        </div>
        
        <button
          onClick={handlePurchase}
          disabled={isProcessing}
          className="w-full py-3 bg-blue-600 hover:bg-blue-700 text-white rounded-lg font-medium transition disabled:opacity-70"
        >
          确认购买
        </button>
        
        <p className="text-xs text-center text-gray-500 mt-4">
          点击确认购买，即表示您同意我们的服务条款和隐私政策
        </p>
      </div>
    </div>
  );
};

// 添加RedeemCodeModal组件
const RedeemCodeModal: React.FC<RedeemCodeModalProps> = ({ questionSet, onClose, onRedeemSuccess }) => {
  const [code, setCode] = useState('');
  const [isProcessing, setIsProcessing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  
  const handleRedeem = async () => {
    if (!code.trim()) {
      setError('请输入有效的兑换码');
      return;
    }
    
    setIsProcessing(true);
    setError(null);
    
    try {
      // 调用兑换API
      const response = await redeemCodeService.redeemCode(code.trim());
      
      if (response.success && response.data) {
        console.log('[RedeemCodeModal] 兑换成功:', response.data);
        toast.success('兑换成功！您现在可以访问完整题库');
        onRedeemSuccess();
      } else {
        console.error('[RedeemCodeModal] 兑换失败:', response);
        setError(response.message || '兑换失败，请检查兑换码是否正确');
        setIsProcessing(false);
      }
    } catch (err) {
      console.error('[RedeemCodeModal] 兑换出错:', err);
      setError('兑换过程中出现错误，请稍后再试');
      setIsProcessing(false);
    }
  };
  
  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 z-50 flex items-center justify-center p-4">
      <div className="bg-white rounded-xl max-w-md w-full p-6 relative">
        {isProcessing && (
          <div className="absolute inset-0 flex flex-col items-center justify-center bg-white bg-opacity-90 z-10 rounded-xl">
            <div className="w-12 h-12 border-t-4 border-blue-500 border-solid rounded-full animate-spin mb-3"></div>
            <p className="text-blue-600 font-medium">处理中，请稍候...</p>
          </div>
        )}
        
        <button
          onClick={onClose}
          disabled={isProcessing}
          className="absolute top-4 right-4 text-gray-400 hover:text-gray-600"
        >
          <svg className="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
          </svg>
        </button>
        
        <h2 className="text-xl font-bold text-gray-800 mb-4">使用兑换码</h2>
        
        <div className="bg-green-50 p-4 rounded-lg mb-6">
          <h3 className="text-lg font-medium text-green-800 mb-2">{questionSet?.title}</h3>
          <p className="text-green-700 text-sm mb-3">{questionSet?.description}</p>
          <span className="bg-green-200 text-green-800 px-2 py-1 rounded text-xs">
            包含 {questionSet?.questionCount} 道题
          </span>
        </div>
        
        {error && (
          <div className="bg-red-50 text-red-700 p-3 rounded-lg mb-4 text-sm">
            {error}
          </div>
        )}
        
        <div className="mb-6">
          <label className="block text-gray-700 font-medium mb-2">请输入兑换码</label>
          <input
            type="text"
            value={code}
            onChange={(e) => setCode(e.target.value)}
            placeholder="例如: QUIZ-1234-ABCD-5678"
            className="w-full px-4 py-3 border rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
            disabled={isProcessing}
          />
        </div>
        
        <button
          onClick={handleRedeem}
          disabled={isProcessing || !code.trim()}
          className="w-full py-3 bg-green-600 hover:bg-green-700 text-white rounded-lg font-medium transition disabled:opacity-70"
        >
          确认兑换
        </button>
        
        <p className="text-xs text-center text-gray-500 mt-4">
          兑换码仅可使用一次，请勿泄露给他人
        </p>
      </div>
    </div>
  );
};

// Define MAX_TRIAL_QUESTIONS constant at the top level
const MAX_TRIAL_QUESTIONS = 5; // Assuming 5 is the default trial limit

function QuizPage(): JSX.Element {
  const { id: questionSetId } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const location = useLocation();
  const { user, updateUser } = useUser();
  const { socket } = useSocket();
  const [questionSet, setQuestionSet] = useState<IQuestionSet | null>(null);
  const [questions, setQuestions] = useState<Question[]>([]);
  const [currentQuestionIndex, setCurrentQuestionIndex] = useState(0);
  const [answeredQuestions, setAnsweredQuestions] = useState<AnsweredQuestion[]>([]);
  const [correctAnswers, setCorrectAnswers] = useState(0);
  const [selectedOption, setSelectedOption] = useState<string | string[]>('');
  const [isCheckingAnswer, setIsCheckingAnswer] = useState(false);
  const [questionStartTime, setQuestionStartTime] = useState(Date.now());
  const [quizStartTime, setQuizStartTime] = useState(Date.now());
  const [quizTotalTime, setQuizTotalTime] = useState(0);
  const [isSaving, setIsSaving] = useState(false);
  const [lastSavedTime, setLastSavedTime] = useState(0);
  const [hasUnsavedChanges, setHasUnsavedChanges] = useState(false);
  const [showSaveSuccess, setShowSaveSuccess] = useState(false);
  
  // 添加权限检查状态
  const [accessCheckCompleted, setAccessCheckCompleted] = useState(false);
  const [showAccessCheckModal, setShowAccessCheckModal] = useState(false);
  
  // 复用现有的quizStatus状态
  const [quizStatus, setQuizStatus] = useState({
    loading: false,
    error: null as null | string,
    hasAccessToFullQuiz: false,
    hasRedeemed: false,
    trialEnded: false,
    showPaymentModal: false,
    showRedeemCodeModal: false,
    showPurchasePage: false,
    isInTrialMode: false,
    showHints: false,
    showExplanation: false,
    showAllExplanations: false,
    showReviewMode: false,
    showWrongAnswers: false,
    quizComplete: false,
    isTimerActive: false,
    isProcessingPayment: false,
    isProcessingRedeem: false
  });

  // 页面加载时检查权限
  useEffect(() => {
    // 检查URL是否包含refresh参数
    const urlParams = new URLSearchParams(window.location.search);
    const shouldRefresh = urlParams.get('refresh') === 'true';
    const comingFromHome = urlParams.get('from') === 'home';
    
    // 如果是直接从首页点击进入（而不是刷新），检查权限
    if (comingFromHome && questionSetId && !shouldRefresh) {
      console.log('[QuizPage] 从首页进入，检查访问权限');
      checkInitialAccess();
    } else {
      setAccessCheckCompleted(true);
    }
  }, [questionSetId, questionSet]);
  
  // 检查初始权限并处理重定向
  const checkInitialAccess = async () => {
    if (!questionSetId || !questionSet) {
      setAccessCheckCompleted(true);
      return;
    }
    
    // 显示检查中状态
    setShowAccessCheckModal(true);
    
    try {
      console.log('[QuizPage] 正在检查题库访问权限:', questionSetId);
      
      // 如果是免费题库，直接通过
      if (questionSet && !questionSet.isPaid) {
        setAccessCheckCompleted(true);
        setShowAccessCheckModal(false);
        return;
      }
      
      // 检查用户是否有访问权限
      const hasAccess = checkFullAccessFromAllSources();
      
      if (hasAccess) {
        console.log('[QuizPage] 用户有访问权限，进行页面刷新');
        
        // 有权限，通过refresh参数刷新页面
        const currentUrl = new URL(window.location.href);
        currentUrl.searchParams.set('refresh', 'true');
        currentUrl.searchParams.delete('from');
        
        // 延迟执行，避免闪烁
        setTimeout(() => {
          window.location.href = currentUrl.toString();
        }, 300);
        
        return;
      }
      
      // 没有权限，进入试用模式
      console.log('[QuizPage] 用户无访问权限，显示购买提示');
      setTimeout(() => {
        setShowAccessCheckModal(false);
        setAccessCheckCompleted(true);
        
        // 如果没有权限且是付费题库，显示购买页面
        if (questionSet && questionSet.isPaid) {
          setQuizStatus(prevStatus => ({
            ...prevStatus,
            showPurchasePage: true
          }));
        }
      }, 500);
      
    } catch (error) {
      console.error('[QuizPage] 检查访问权限错误:', error);
      setAccessCheckCompleted(true);
      setShowAccessCheckModal(false);
    }
  };
  
  // 访问检查中的加载弹窗
  const AccessCheckingModal = () => (
    <div className="fixed inset-0 bg-gray-800 bg-opacity-90 z-50 flex items-center justify-center">
      <div className="bg-white rounded-xl p-6 max-w-md w-full mx-4 text-center">
        <div className="w-16 h-16 border-t-4 border-blue-500 border-solid rounded-full animate-spin mx-auto mb-4"></div>
        <h2 className="text-xl font-semibold text-gray-800 mb-2">正在检查访问权限</h2>
        <p className="text-gray-600">请稍候，正在验证您对此题库的访问权限...</p>
      </div>
    </div>
  );

  // 从所有可能的来源检查题库的完整访问权限 - 修改以处理URL请求
  const checkFullAccessFromAllSources = useCallback((targetQuestionSetId?: string) => {
    const qsId = targetQuestionSetId || questionSetId;
    if (!qsId || !questionSet) return false;
    
    console.log(`[checkFullAccess] 全面检查题库 ${qsId} 的访问权限`);
    
    // 1. 如果是免费题库，直接授权
    if (questionSet && !questionSet.isPaid) {
      console.log('[checkFullAccess] 免费题库，自动有访问权限');
      return true;
    }
    
    // 2. 检查用户购买记录
    if (user && user.purchases && Array.isArray(user.purchases)) {
      const hasPurchased = user.purchases.some(purchase => {
        const purchaseQsId = String(purchase.questionSetId).trim();
        const targetQsId = String(qsId).trim();
        const isPurchased = purchaseQsId === targetQsId;
        const expiryDate = purchase.expiryDate ? new Date(purchase.expiryDate) : null;
        const isValid = expiryDate ? expiryDate > new Date() : true;
        
        if (isPurchased && isValid) {
          console.log('[checkFullAccess] 找到有效的购买记录');
          return true;
        }
        return false;
      });
      
      if (hasPurchased) {
        return true;
      }
    }
    
    // 3. 检查本地存储中的访问记录
    try {
      const accessKey = `quiz_access_${qsId}`;
      const accessStr = localStorage.getItem(accessKey);
      
      if (accessStr) {
        const accessData = JSON.parse(accessStr);
        if (accessData && accessData.hasAccess) {
          if (accessData.expiryDate) {
            const expiryDate = new Date(accessData.expiryDate);
            const now = new Date();
            if (expiryDate > now) {
              console.log('[checkFullAccess] 本地存储中有有效的访问权限记录');
              return true;
            } else {
              console.log('[checkFullAccess] 本地存储中的访问权限已过期');
              return false;
            }
          } else {
            console.log('[checkFullAccess] 本地存储中有访问权限记录（无过期日期）');
            return true;
          }
        }
      }
    } catch (e) {
      console.error('[checkFullAccess] 检查本地存储访问权限出错:', e);
    }
    
    // 4. 检查兑换码
    try {
      const redeemedSets = JSON.parse(localStorage.getItem('redeemedQuestionSets') || '[]');
      if (redeemedSets.includes(qsId)) {
        console.log('[checkFullAccess] 该题库已被兑换过');
        return true;
      }
    } catch (e) {
      console.error('[checkFullAccess] 检查兑换记录出错:', e);
    }
    
    // 如果所有检查都失败，则没有完整访问权限
    console.log('[checkFullAccess] 未找到有效的访问权限');
    return false;
  }, [questionSetId, questionSet, user]);

  // 处理购买和兑换操作
  const handlePurchase = () => {
    setQuizStatus(prevStatus => ({
      ...prevStatus,
      showPaymentModal: true,
      isProcessingPayment: false
    }));
  };
  
  const handleRedeem = () => {
    setQuizStatus(prevStatus => ({
      ...prevStatus,
      showRedeemCodeModal: true,
      isProcessingRedeem: false
    }));
  };

  // 显示剩余有效期的TrialPurchaseBar组件
  const TrialPurchaseBar = () => {
    const trialMode = quizStatus.isInTrialMode && !quizStatus.trialEnded;
    const trialRemainingCount = MAX_TRIAL_QUESTIONS - answeredQuestions.length;
    const [expiryDate, setExpiryDate] = useState<string | null>(null);
    const [accessSource, setAccessSource] = useState<string>('');
    
    useEffect(() => {
      // 检查用户是否已购买或兑换过这个题库
      if (questionSet && questionSetId) {
        // 先从本地存储检查访问权限
        const accessKey = `quiz_access_${questionSetId}`;
        try {
          const accessData = localStorage.getItem(accessKey);
          if (accessData) {
            const parsed = JSON.parse(accessData);
            if (parsed && parsed.hasAccess && parsed.expiryDate) {
              setExpiryDate(parsed.expiryDate);
              setAccessSource(parsed.source || 'purchase');
            }
          }
        } catch (e) {
          console.error('Error checking access data:', e);
        }
        
        // 再从用户购买记录中检查
        if (user && user.purchases && Array.isArray(user.purchases) && !expiryDate) {
          const purchase = user.purchases.find(p => 
            String(p.questionSetId).trim() === String(questionSetId).trim()
          );
          
          if (purchase && purchase.expiryDate) {
            setExpiryDate(purchase.expiryDate);
            setAccessSource('purchase');
          }
        }
      }
    }, []);
    
    // 检查是否有访问权限并且显示有效期
    const hasFullAccess = !!expiryDate;
    
    // 计算剩余有效期天数
    const getRemainingDays = () => {
      if (!expiryDate) return null;
      
      const expiry = new Date(expiryDate);
      const now = new Date();
      const diffTime = expiry.getTime() - now.getTime();
      const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));
      
      return diffDays > 0 ? diffDays : 0;
    };
    
    const remainingDays = getRemainingDays();
    
    // 格式化到期日期显示
    const formatExpiryDate = () => {
      if (!expiryDate) return '';
      
      const date = new Date(expiryDate);
      return date.toLocaleDateString('zh-CN', {
        year: 'numeric',
        month: 'long',
        day: 'numeric'
      });
    };
    
    return (
      <div className="fixed bottom-0 left-0 right-0 bg-white border-t border-gray-200 px-4 py-3 shadow-md">
        <div className="flex items-center justify-between max-w-4xl mx-auto">
          {/* 已购买/兑换的题库，显示有效期信息 */}
          {hasFullAccess && (
            <div className="w-full flex items-center justify-between">
              <div className="flex items-center space-x-3">
                <div className="flex-shrink-0 bg-green-100 p-2 rounded-full">
                  <svg className="h-6 w-6 text-green-600" fill="none" stroke="currentColor" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
                  </svg>
                </div>
                <div>
                  <div className="text-sm font-medium text-gray-700">已{accessSource === 'redeem' ? '兑换' : '购买'}完整版</div>
                  <div className="text-xs text-gray-500">
                    有效期至: {formatExpiryDate()}
                    {remainingDays !== null && remainingDays < 30 && (
                      <span className="ml-2 text-orange-500 font-medium">
                        (剩余 {remainingDays} 天)
                      </span>
                    )}
                  </div>
                </div>
              </div>
              <button 
                onClick={() => navigate('/profile')} 
                className="px-3 py-1.5 text-sm bg-gray-100 hover:bg-gray-200 text-gray-700 rounded-md"
              >
                查看购买记录
              </button>
            </div>
          )}
          
          {/* 试用模式显示剩余题目数 */}
          {trialMode && !hasFullAccess && (
            <>
              <div className="flex items-center space-x-2">
                <svg className="h-5 w-5 text-blue-500" fill="none" stroke="currentColor" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                </svg>
                <span className="text-sm text-gray-600">试用模式: 还可免费使用 <span className="font-bold text-blue-600">{trialRemainingCount}</span> 道题</span>
              </div>
              
              <div className="flex space-x-2">
                <button
                  onClick={handlePurchase}
                  className="px-3 py-1.5 text-sm bg-blue-600 hover:bg-blue-700 text-white rounded-md flex items-center"
                >
                  <svg className="h-4 w-4 mr-1" fill="none" stroke="currentColor" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M3 10h18M7 15h1m4 0h1m-7 4h12a3 3 0 003-3V8a3 3 0 00-3-3H6a3 3 0 00-3 3v8a3 3 0 003 3z" />
                  </svg>
                  购买完整版
                </button>
                
                <button
                  onClick={handleRedeem}
                  className="px-3 py-1.5 text-sm bg-white border border-gray-300 hover:bg-gray-50 text-gray-700 rounded-md flex items-center"
                >
                  <svg className="h-4 w-4 mr-1" fill="none" stroke="currentColor" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M7 7h.01M7 3h5c.512 0 1.024.195 1.414.586l7 7a2 2 0 010 2.828l-7 7a2 2 0 01-2.828 0l-7-7A1.994 1.994 0 013 12V7a4 4 0 014-4z" />
                  </svg>
                  使用兑换码
                </button>
              </div>
            </>
          )}
          
          {/* 试用已结束显示购买提示 */}
          {!trialMode && !quizStatus.showPurchasePage && !hasFullAccess && (
            <div className="w-full flex items-center justify-between">
              <div className="flex items-center space-x-3">
                <div className="flex-shrink-0 bg-amber-100 p-2 rounded-full">
                  <svg className="h-6 w-6 text-amber-600" fill="none" stroke="currentColor" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
                  </svg>
                </div>
                <div>
                  <div className="text-sm font-medium text-gray-700">试用已结束</div>
                  <div className="text-xs text-gray-500">购买完整版解锁全部 {questionSet?.questionCount || '0'} 道题目</div>
                </div>
              </div>
              
              <div className="flex space-x-2">
                <button 
                  onClick={handlePurchase} 
                  className="px-3 py-1.5 text-sm bg-blue-600 hover:bg-blue-700 text-white rounded-md"
                >
                  立即购买
                </button>
                <button 
                  onClick={handleRedeem} 
                  className="px-3 py-1.5 text-sm bg-white border border-gray-300 hover:bg-gray-50 text-gray-700 rounded-md"
                >
                  使用兑换码
                </button>
              </div>
            </div>
          )}
        </div>
      </div>
    );
  };

  // 在返回中添加访问检查弹窗
  return (
    <div className="min-h-screen bg-gray-50 py-8 pb-20">
      {/* 显示访问检查加载状态 */}
      {showAccessCheckModal && <AccessCheckingModal />}
      
      {/* 优先显示购买页面，强制中断正常答题流程 */}
      {quizStatus.showPurchasePage && questionSet && (
        <PurchasePage 
          questionSet={questionSet}
          trialCount={answeredQuestions.length}
          isProcessing={quizStatus.isProcessingPayment || quizStatus.isProcessingRedeem}
          onPurchase={() => {
            setQuizStatus(prevStatus => ({
              ...prevStatus,
              showPaymentModal: true,
              showPurchasePage: false
            }));
          }}
          onRedeem={() => {
            setQuizStatus(prevStatus => ({
              ...prevStatus,
              showRedeemCodeModal: true,
              showPurchasePage: false
            }));
          }}
          onBack={() => {
            navigate('/');
          }}
        />
      )}
      
      {/* 其余内容 */}
      {!quizStatus.showPurchasePage && (
        <div className="max-w-4xl mx-auto px-4">
          {/* 题库信息展示 */}
          {questionSet && (
            <div className="mb-4">
              <h1 className="text-2xl font-bold text-gray-800 mb-2">{questionSet.title}</h1>
              <p className="text-gray-600">{questionSet.description}</p>
            </div>
          )}
          
          {/* 题库内容 */}
          {/* 在这里放置问题卡片和其他组件 */}
          
          {/* 显示购买/有效期信息 */}
          <TrialPurchaseBar />
        </div>
      )}
      
      {/* 支付模态窗口 */}
      {quizStatus.showPaymentModal && questionSet && (
        <PaymentModal
          isOpen={quizStatus.showPaymentModal}
          onClose={() => {
            setQuizStatus(prevStatus => ({
              ...prevStatus,
              showPaymentModal: false,
              isProcessingPayment: false
            }));
          }}
          questionSet={questionSet}
          onSuccess={(data: any) => {
            console.log('[QuizPage] PaymentModal 支付成功:', data);
            
            // 更新状态
            setQuizStatus(prevStatus => ({
              ...prevStatus,
              showPaymentModal: false,
              isProcessingPayment: false,
              hasAccessToFullQuiz: true
            }));
            
            // 给用户一个成功的反馈
            toast.success('购买成功！现在您可以访问完整题库了');
            
            // 刷新页面或更新权限状态
            setTimeout(() => {
              window.location.reload();
            }, 1000);
          }}
        />
      )}
      
      {/* 兑换码模态窗口 */}
      {quizStatus.showRedeemCodeModal && questionSet && (
        <RedeemCodeModal
          questionSet={questionSet}
          onClose={() => {
            setQuizStatus(prevStatus => ({
              ...prevStatus,
              showRedeemCodeModal: false,
              isProcessingRedeem: false
            }));
          }}
          onRedeemSuccess={() => {
            // 更新状态
            setQuizStatus(prevStatus => ({
              ...prevStatus,
              showRedeemCodeModal: false,
              isProcessingRedeem: false,
              hasAccessToFullQuiz: true,
              hasRedeemed: true
            }));
            
            // 给用户一个成功的反馈
            toast.success('兑换成功！现在您可以访问完整题库了');
            
            // 刷新页面或更新权限状态
            setTimeout(() => {
              window.location.reload();
            }, 1000);
          }}
        />
      )}
    </div>
  );
}

export default QuizPage; 
