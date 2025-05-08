import { useState, useEffect, useRef, useCallback } from 'react';
import { useParams, useNavigate, useLocation, useSearchParams } from 'react-router-dom';
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
import axios from 'axios';
import PaymentModal from './PaymentModal';

// 从服务api中导入API_BASE_URL
import { API_BASE_URL } from '../services/api';

// 导入工具函数
import { isPaidQuiz } from '../utils/paymentUtils'; 
import { getOptionLabel, formatOptions } from '../utils/optionUtils';
import { saveAccessToLocalStorage, getAccessFromLocalStorage, saveRedeemedQuestionSetId, checkFullAccessFromAllSources } from '../utils/accessUtils';
import { formatTime, calculateRemainingDays, formatDate } from '../utils/timeUtils';

// 定义答题记录类型
interface AnsweredQuestion {
  index: number;
  questionIndex?: number;
  isCorrect: boolean;
  selectedOption: string | string[];
}

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

// 改进PurchasePage组件
const PurchasePage: React.FC<{
  questionSet: IQuestionSet | null;
  onPurchase: () => void;
  onRedeem: () => void;
  onBack: () => void;
  trialCount: number;
  isProcessing?: boolean;
}> = ({ questionSet, onPurchase, onRedeem, onBack, trialCount, isProcessing = false }) => {
  
  // Simplified state - single object for button states
  const [btnStates, setBtnStates] = useState({
    purchase: { clicked: false },
    redeem: { clicked: false },
    back: { clicked: false }
  });
  
  // Improved purchase button click handler
  const handlePurchaseClick = (e: React.MouseEvent) => {
    // Critical: prevent event bubbling
    e.stopPropagation();
    e.preventDefault();
    
    console.log('[PurchasePage] Purchase button clicked at:', new Date().toISOString());
    
    // Don't proceed if already processing or clicked
    if (isProcessing || btnStates.purchase.clicked) {
      console.log('[PurchasePage] Ignoring click - isProcessing:', isProcessing, 'clicked:', btnStates.purchase.clicked);
      return;
    }
    
    // Update button state using functional state update
    setBtnStates(prev => ({
      ...prev,
      purchase: { clicked: true }
    }));
    
    // Visual feedback
    toast.info('正在准备支付界面...', { 
      autoClose: 1000,
      position: 'top-center',
      hideProgressBar: false
    });
    
    // Execute callback
    try {
      console.log('[PurchasePage] Calling onPurchase callback');
      if (typeof onPurchase === 'function') {
        onPurchase();
      } else {
        console.error('[PurchasePage] onPurchase is not a function');
        toast.error('支付功能暂时不可用，请稍后再试');
      }
    } catch (err) {
      console.error('[PurchasePage] Purchase callback error:', err);
      toast.error('处理购买请求时出错，请重试');
    }
    
    // Reset button state after delay
    setTimeout(() => {
      setBtnStates(prev => ({
        ...prev,
        purchase: { clicked: false }
      }));
    }, 300);
  };
  
  // Improved redeem button click handler
  const handleRedeemClick = (e: React.MouseEvent) => {
    // Critical: prevent event bubbling
    e.stopPropagation();
    e.preventDefault();
    
    console.log('[PurchasePage] Redeem button clicked at:', new Date().toISOString());
    
    // Don't proceed if already processing or clicked
    if (isProcessing || btnStates.redeem.clicked) {
      console.log('[PurchasePage] Ignoring click - isProcessing:', isProcessing, 'clicked:', btnStates.redeem.clicked);
      return;
    }
    
    // Update button state using functional state update
    setBtnStates(prev => ({
      ...prev,
      redeem: { clicked: true }
    }));
    
    // Visual feedback
    toast.info('正在准备兑换界面...', { 
      autoClose: 1000,
      position: 'top-center',
      hideProgressBar: false
    });
    
    // Execute callback
    try {
      console.log('[PurchasePage] Calling onRedeem callback');
      if (typeof onRedeem === 'function') {
        onRedeem();
      } else {
        console.error('[PurchasePage] onRedeem is not a function');
        toast.error('兑换功能暂时不可用，请稍后再试');
      }
    } catch (err) {
      console.error('[PurchasePage] Redeem callback error:', err);
      toast.error('处理兑换请求时出错，请重试');
    }
    
    // Reset button state after delay
    setTimeout(() => {
      setBtnStates(prev => ({
        ...prev,
        redeem: { clicked: false }
      }));
    }, 300);
  };
  
  // Improved back button click handler
  const handleBackClick = (e: React.MouseEvent) => {
    // Critical: prevent event bubbling
    e.stopPropagation();
    e.preventDefault();
    
    console.log('[PurchasePage] Back button clicked at:', new Date().toISOString());
    
    // Don't proceed if already processing or clicked
    if (isProcessing || btnStates.back.clicked) {
      console.log('[PurchasePage] Ignoring click - isProcessing:', isProcessing, 'clicked:', btnStates.back.clicked);
      return;
    }
    
    // Update button state using functional state update
    setBtnStates(prev => ({
      ...prev,
      back: { clicked: true }
    }));
    
    // Visual feedback
    toast.info('正在返回首页...', { 
      autoClose: 1000,
      position: 'top-center'
    });
    
    // Execute callback
    try {
      console.log('[PurchasePage] Calling onBack callback');
      if (typeof onBack === 'function') {
        onBack();
      } else {
        console.error('[PurchasePage] onBack is not a function');
        toast.error('暂时无法返回，请刷新页面');
      }
    } catch (err) {
      console.error('[PurchasePage] Back callback error:', err);
    }
    
    // Reset button state after delay
    setTimeout(() => {
      setBtnStates(prev => ({
        ...prev,
        back: { clicked: false }
      }));
    }, 300);
  };
  
  return (
    <div className="fixed inset-0 bg-gray-800 bg-opacity-95 z-50 flex items-center justify-center p-4">
      <div className="bg-white rounded-xl shadow-xl max-w-lg w-full mx-4 p-6 relative overflow-hidden">
        {/* Processing overlay */}
        {isProcessing && (
          <div className="absolute inset-0 bg-white bg-opacity-80 flex flex-col items-center justify-center z-10">
            <div className="w-16 h-16 border-t-4 border-blue-500 border-solid rounded-full animate-spin mb-3"></div>
            <p className="text-blue-600 font-semibold">正在处理，请稍候...</p>
          </div>
        )}
        
        {/* Title and info */}
        <div className="text-center mb-6">
          <div className="inline-block p-3 bg-blue-100 rounded-full text-blue-600 mb-3">
            <svg className="w-8 h-8" fill="none" stroke="currentColor" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
            </svg>
          </div>
          <h2 className="text-2xl font-bold text-gray-800 mb-2">试用已结束</h2>
          <p className="text-gray-600 mb-1">您已完成 <span className="font-semibold text-blue-600">{trialCount}</span> 道试用题目</p>
          <p className="text-gray-600 mb-4">请购买完整版或使用兑换码继续使用</p>
        </div>
        
        {/* Quiz set info */}
        <div className="bg-gradient-to-br from-blue-50 to-blue-100 p-5 rounded-lg mb-8 shadow-sm border border-blue-200">
          <h3 className="text-lg font-medium text-blue-800 mb-2">{questionSet?.title || '题库'}</h3>
          <p className="text-blue-700 mb-4">{questionSet?.description || '详细学习各种问题，提升知识水平。'}</p>
          <div className="flex items-center justify-between">
            <div className="flex items-baseline">
              <span className="text-3xl font-bold text-blue-800">¥{questionSet?.price || '0'}</span>
              <span className="text-sm text-blue-600 ml-1">一次付费，永久使用</span>
            </div>
            <span className="bg-blue-200 text-blue-800 px-3 py-1 rounded-full text-sm font-medium">
              包含 {questionSet?.questionCount || '0'} 道题
            </span>
          </div>
        </div>
        
        {/* Action buttons */}
        <div className="space-y-4 mb-6">
          {/* Purchase button */}
          <button 
            onClick={handlePurchaseClick}
            type="button" 
            className={`
              w-full py-4 relative overflow-hidden
              ${btnStates.purchase.clicked 
                ? 'bg-blue-800 transform scale-[0.98] shadow-inner' 
                : 'bg-gradient-to-r from-blue-600 to-blue-700 hover:from-blue-700 hover:to-blue-800 transform hover:-translate-y-0.5'
              } 
              text-white rounded-lg font-medium transition-all duration-200 
              flex items-center justify-center shadow-md hover:shadow-lg 
              disabled:opacity-70 disabled:transform-none disabled:shadow-none disabled:cursor-not-allowed
              focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2
              active:scale-[0.98] active:shadow-inner
            `}
            disabled={isProcessing}
          >
            {/* Ripple effect */}
            {btnStates.purchase.clicked && (
              <span className="absolute inset-0 bg-white opacity-30 rounded-lg animate-ripple"></span>
            )}
            
            {/* Button content */}
            <svg className="w-5 h-5 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 10h18M7 15h1m4 0h1m-7 4h12a3 3 0 003-3V8a3 3 0 00-3-3H6a3 3 0 00-3 3v8a3 3 0 003 3z" />
            </svg>
            <span className="mr-2">立即购买完整版</span>
            
            {/* Right arrow icon */}
            <svg className="w-4 h-4 ml-1 transform group-hover:translate-x-1 transition-transform" fill="none" stroke="currentColor" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M14 5l7 7m0 0l-7 7m7-7H3" />
            </svg>
          </button>
          
          {/* Divider */}
          <div className="flex items-center">
            <div className="flex-grow border-t border-gray-200"></div>
            <span className="mx-4 text-sm text-gray-500">或者</span>
            <div className="flex-grow border-t border-gray-200"></div>
          </div>
          
          {/* Redeem button */}
          <button 
            onClick={handleRedeemClick}
            type="button" 
            className={`
              w-full py-4 relative overflow-hidden
              ${btnStates.redeem.clicked 
                ? 'bg-green-100 text-green-800 transform scale-[0.98] shadow-inner' 
                : 'bg-white hover:bg-green-50 text-green-700 transform hover:-translate-y-0.5'
              } 
              border-2 border-green-400 rounded-lg font-medium transition-all duration-200 
              flex items-center justify-center shadow-sm hover:shadow-md
              disabled:opacity-70 disabled:transform-none disabled:shadow-none disabled:cursor-not-allowed
              focus:outline-none focus:ring-2 focus:ring-green-400 focus:ring-offset-2
              active:scale-[0.98] active:bg-green-100
            `}
            disabled={isProcessing}
          >
            {/* Ripple effect */}
            {btnStates.redeem.clicked && (
              <span className="absolute inset-0 bg-green-500 opacity-10 rounded-lg animate-ripple"></span>
            )}
            
            {/* Button content */}
            <svg className="w-5 h-5 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M7 7h.01M7 3h5c.512 0 1.024.195 1.414.586l7 7a2 2 0 010 2.828l-7 7a2 2 0 01-2.828 0l-7-7A1.994 1.994 0 013 12V7a4 4 0 014-4z" />
            </svg>
            <span className="mr-2">使用兑换码解锁</span>
            
            {/* Right arrow icon */}
            <svg className="w-4 h-4 ml-1 transform group-hover:translate-x-1 transition-transform" fill="none" stroke="currentColor" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M14 5l7 7m0 0l-7 7m7-7H3" />
            </svg>
          </button>
          
          {/* Back button */}
          <button 
            onClick={handleBackClick}
            type="button" 
            className={`
              w-full py-3 mt-2 
              ${btnStates.back.clicked 
                ? 'bg-gray-300 transform scale-[0.98]' 
                : 'bg-gray-100 hover:bg-gray-200 transform hover:-translate-y-0.5'
              } 
              text-gray-700 rounded-lg font-medium transition-all duration-200 
              flex items-center justify-center
              disabled:opacity-70 disabled:cursor-not-allowed
              focus:outline-none focus:ring-2 focus:ring-gray-400 focus:ring-offset-2
            `}
            disabled={isProcessing}
          >
            <svg className="w-5 h-5 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 19l-7-7m0 0l7-7m-7 7h18" />
            </svg>
            返回首页
          </button>
        </div>
        
        {/* Footer info */}
        <div className="text-center">
          <p className="text-xs text-gray-500 mb-2">
          付费后立即获得完整题库的访问权限，内容持续更新
        </p>
          <p className="text-xs text-gray-400">
            支持Stripe安全支付，确保您的付款安全
          </p>
        </div>
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
  isOpen: boolean; 
  questionSet: IQuestionSet | null;
  onClose: () => void;
  onSuccess: (data: any) => void;
}

interface RedeemCodeModalProps {
  questionSet: IQuestionSet | null;
  onClose: () => void;
  onRedeemSuccess: () => void;
}

// 添加RedeemCodeModal组件
const RedeemCodeModal: React.FC<RedeemCodeModalProps> = ({ questionSet, onClose, onRedeemSuccess }) => {
  const { user } = useUser();
  const [code, setCode] = useState("");
  const [isProcessing, setIsProcessing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState(false);
  
  const handleCodeChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    setCode(e.target.value);
    if (error) setError(null);
  };
  
  const handleRedeem = async (e: React.FormEvent) => {
    // Prevent default form submission
    e.preventDefault();
    
    // Prevent event bubbling
    e.stopPropagation();
    
    if (!user || !questionSet) {
      setError("请先登录或选择题库");
      return;
    }
    
    // Validate code
    if (!code || code.trim().length < 6) {
      setError("请输入有效的兑换码");
      return;
    }
    
    // Don't proceed if already processing
    if (isProcessing) {
      console.log('[RedeemCodeModal] Ignoring submission - already processing');
      return;
    }
    
    setIsProcessing(true);
    setError(null);
    
    try {
      console.log(`[RedeemCodeModal] Attempting to redeem code "${code}" for quiz set ${questionSet.id}`);
      
      // Call redeem API - fix parameter count to match API
      const response = await redeemCodeService.redeemCode(code.trim());
      
      console.log(`[RedeemCodeModal] Redeem API response:`, response);
      
      if (response.success) {
        // Success - show notification
        console.log('[RedeemCodeModal] Code redemption successful');
        setSuccess(true);
        
        // Dispatch custom event for system-wide notification
        window.dispatchEvent(
          new CustomEvent('redeem:success', { 
            detail: { 
              questionSetId: questionSet.id,
              code,
              forceRefresh: true
            } 
          })
        );
        
        toast.success('兑换成功！您现在可以访问完整题库');
        
        // Wait a moment before closing modal to show success state
        setTimeout(() => {
        onRedeemSuccess();
        }, 1000);
      } else {
        // API returned error
        console.error('[RedeemCodeModal] Code redemption failed:', response);
        setError(response.message || '兑换码无效或已被使用');
        setIsProcessing(false);
      }
    } catch (err) {
      // Exception during API call
      console.error('[RedeemCodeModal] Error during code redemption:', err);
      setError(typeof err === 'string' ? err : '兑换过程中出现错误，请稍后再试');
      setIsProcessing(false);
    }
  };
  
  const handleCloseClick = (e: React.MouseEvent) => {
    // Prevent event bubbling
    e.stopPropagation();
    e.preventDefault();
    
    if (isProcessing) {
      console.log('[RedeemCodeModal] Cannot close while processing');
      return;
    }
    
    console.log('[RedeemCodeModal] Closing modal');
    onClose();
  };
  
  return (
    <div 
      className="fixed inset-0 bg-black bg-opacity-50 z-50 flex items-center justify-center p-4"
      onClick={(e) => e.stopPropagation()}
    >
      <div 
        className="bg-white rounded-xl max-w-md w-full p-6 relative"
        onClick={(e) => e.stopPropagation()}
      >
        {isProcessing && (
          <div className="absolute inset-0 flex flex-col items-center justify-center bg-white bg-opacity-90 z-10 rounded-xl">
            <div className="w-12 h-12 border-t-4 border-green-500 border-solid rounded-full animate-spin mb-3"></div>
            <p className="text-green-600 font-medium">验证中，请稍候...</p>
          </div>
        )}
        
        {success && (
          <div className="absolute inset-0 flex flex-col items-center justify-center bg-white bg-opacity-95 z-10 rounded-xl">
            <div className="w-16 h-16 bg-green-100 rounded-full flex items-center justify-center mb-4">
              <svg className="w-10 h-10 text-green-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
              </svg>
            </div>
            <h3 className="text-xl font-bold text-green-700 mb-2">兑换成功！</h3>
            <p className="text-green-600">您已成功解锁完整题库</p>
          </div>
        )}
        
        <button
          onClick={handleCloseClick}
          disabled={isProcessing}
          className="absolute top-4 right-4 text-gray-400 hover:text-gray-600 disabled:opacity-50"
          aria-label="Close"
        >
          <svg className="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
          </svg>
        </button>
        
        <h3 className="text-xl font-bold text-gray-800 mb-4">兑换码解锁</h3>
        
        <div className="bg-blue-50 rounded-lg p-4 mb-6">
          <h4 className="font-medium text-blue-800 mb-1">{questionSet?.title || '题库'}</h4>
          <p className="text-blue-600 text-sm">{questionSet?.description || '完整练习题库'}</p>
        </div>
        
        {error && (
          <div className="bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded-lg mb-6 text-sm">
            {error}
          </div>
        )}
        
        <form onSubmit={handleRedeem}>
        <div className="mb-6">
            <label htmlFor="redeemCode" className="block text-sm font-medium text-gray-700 mb-2">
              输入兑换码
            </label>
          <input
            type="text"
              id="redeemCode"
            value={code}
              onChange={handleCodeChange}
              className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-green-500 focus:border-green-500"
              placeholder="例如: EXAM-XXXX-XXXX"
            disabled={isProcessing}
              autoComplete="off"
              autoCapitalize="characters"
              autoFocus
          />
            <p className="mt-2 text-xs text-gray-500">
              兑换码通常由12-16位字母和数字组成，区分大小写
            </p>
        </div>
        
        <button
            type="submit"
            disabled={isProcessing || !code.trim() || !questionSet || !user}
            className={`
              w-full py-3 ${isProcessing ? 'bg-green-700' : 'bg-green-600 hover:bg-green-700'} 
              text-white rounded-lg font-medium transition-all duration-200
              flex items-center justify-center
              disabled:opacity-70 disabled:cursor-not-allowed
              focus:outline-none focus:ring-2 focus:ring-green-500 focus:ring-offset-2
            `}
          >
            {isProcessing ? '验证中...' : '验证并解锁'}
        </button>
        </form>
        
        <p className="text-xs text-center text-gray-500 mt-4">
          兑换成功后，您将获得该题库的永久访问权限
        </p>
      </div>
    </div>
  );
};

// 添加波纹效果动画的StyleInjector组件
const StyleInjector = () => {
  useEffect(() => {
    // 创建style元素
    const style = document.createElement('style');
    style.innerHTML = `
      /* 波纹点击效果 */
      @keyframes ripple {
        0% {
          transform: scale(0);
          opacity: 0.5;
        }
        100% {
          transform: scale(4);
          opacity: 0;
        }
      }
      
      .animate-ripple {
        animation: ripple 0.6s ease-out;
      }
      
      /* 轻微脉动效果 */
      @keyframes pulse-scale {
        0%, 100% {
          transform: scale(1);
        }
        50% {
          transform: scale(1.05);
        }
      }
      
      .animate-pulse-scale {
        animation: pulse-scale 1.5s ease-in-out infinite;
      }
      
      /* 点击缩放效果 */
      .scale-transition {
        transition: transform 0.2s ease-out !important;
      }
      
      .hover-raise:hover {
        transform: translateY(-2px);
      }
      
      .click-shrink:active {
        transform: scale(0.95);
      }
      
      /* 自定义toast样式 */
      .Toastify__toast {
        border-radius: 8px;
        box-shadow: 0 4px 12px rgba(0, 0, 0, 0.1);
      }
      
      .Toastify__toast--info {
        background: linear-gradient(135deg, #3b82f6, #1d4ed8);
      }
      
      /* 改进按钮点击和触摸体验 */
      button {
        -webkit-tap-highlight-color: transparent;
        touch-action: manipulation;
        user-select: none;
      }
      
      /* 修复safari移动设备上的按钮点击问题 */
      @media (hover: none) {
        button:active {
          transform: scale(0.95);
        }
      }
    `;
    
    // 添加到文档头部
    document.head.appendChild(style);
    
    // 清理函数
    return () => {
      document.head.removeChild(style);
    };
  }, []);
  
  return null;
};

// 在删除isPaidQuiz函数后，添加回IQuestionSet接口定义
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

function QuizPage(): JSX.Element {
  const { id } = useParams<{ id: string }>();
  const location = useLocation();
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const { user, syncAccessRights, hasAccessToQuestionSet } = useUser();
  const { socket } = useSocket();
  const [lastQuestion, setLastQuestion] = useState<number>(
    parseInt(searchParams.get('lastQuestion') || '0')
  );
  
  // Imported from src/pages/QuizPage.tsx - Add access check state
  const [accessCheckComplete, setAccessCheckComplete] = useState(false);
  const [accessRights, setAccessRights] = useState<{hasAccess: boolean, remainingDays?: number | null}>({
    hasAccess: false,
    remainingDays: null
  });
  
  // 将 isSubmittingRef 移动到组件内部
  const isSubmittingRef = useRef<boolean>(false);
  
  // 修改状态定义部分，将相关状态合并成对象
  // 在QuizPage组件内部，将散布的状态合并为状态对象
  const [quizStatus, setQuizStatus] = useState<{
    loading: boolean;
    error: string | null;
    hasAccessToFullQuiz: boolean;
    hasRedeemed: boolean;
    trialEnded: boolean;
    showPaymentModal: boolean;
    showRedeemCodeModal: boolean;
    showPurchasePage: boolean;
    isInTrialMode: boolean;
    showHints: boolean;
    showExplanation: boolean;
    showAllExplanations: boolean;
    showReviewMode: boolean;
    showWrongAnswers: boolean;
    quizComplete: boolean;
    isTimerActive: boolean;
    isProcessingPayment: boolean; // 添加支付处理状态 
    isProcessingRedeem: boolean;  // 添加兑换处理状态
  }>({
    loading: true,
    error: null,
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
    isProcessingPayment: false, // 初始化为false
    isProcessingRedeem: false,  // 初始化为false
  });
  
  // 保留独立的数据状态，因为这些需要频繁单独更新且不适合合并到对象中
  const [questions, setQuestions] = useState<Question[]>([]);
  const [originalQuestions, setOriginalQuestions] = useState<Question[]>([]);
  const [questionSet, setQuestionSet] = useState<IQuestionSet | null>(null);
  const [currentQuestionIndex, setCurrentQuestionIndex] = useState<number>(0);
  const [answeredQuestions, setAnsweredQuestions] = useState<AnsweredQuestion[]>([]);
  const [questionStartTime, setQuestionStartTime] = useState<number>(0);
  const [selectedOptions, setSelectedOptions] = useState<string[]>([]);
  const [correctAnswers, setCorrectAnswers] = useState<number>(0);
  const [quizStartTime, setQuizStartTime] = useState<number>(0);
  const [quizTotalTime, setQuizTotalTime] = useState<number>(0);
  
  // 添加保存状态相关变量
  const [isSaving, setIsSaving] = useState<boolean>(false);
  const [lastSavedTime, setLastSavedTime] = useState<number>(0);
  const [showSaveSuccess, setShowSaveSuccess] = useState<boolean>(false);
  const [hasUnsavedChanges, setHasUnsavedChanges] = useState<boolean>(false);

  // 在QuizPage组件内部，在state声明区域添加一个同步状态标识
  const [lastSyncTime, setLastSyncTime] = useState<number>(0);
  const [pendingSync, setPendingSync] = useState<boolean>(false);
  const unsyncedChangesRef = useRef<boolean>(false);
  const timeoutId = useRef<NodeJS.Timeout | undefined>(undefined);

  // 每次应用启动时清除有问题的权限缓存
  useEffect(() => {
    // 清除可能有问题的权限缓存数据
    try {
      console.log('[QuizPage] 应用启动，清除可能有问题的权限缓存');
      
      // 获取所有本地存储的access rights
      const accessRightsStr = localStorage.getItem('quizAccessRights');
      if (accessRightsStr) {
        const accessRights = JSON.parse(accessRightsStr) as AccessRights;
        
        // 创建新的权限对象
        const newAccessRights: AccessRights = {};
        
        // 如果questionSetId存在，则检查当前题库
        if (id) {
          // 保留当前题库的权限，后续会重新检查
          if (accessRights && accessRights[id]) {
            newAccessRights[id] = accessRights[id];
          }
        }
        
        // 保存清理后的权限数据
        localStorage.setItem('quizAccessRights', JSON.stringify(newAccessRights));
      }
    } catch (e) {
      console.error('[QuizPage] 清除权限缓存出错:', e);
    }
  }, [id]);
  
  // 修改checkAccess函数，避免多次单独更新状态导致渲染问题
  const checkAccess = async () => {
    if (!questionSet || !user) return;
    
    console.log(`[checkAccess] 开始检查题库 ${questionSet.id} 的访问权限`);
    
    // 免费题库直接授权
    if (!isPaidQuiz(questionSet)) {
      console.log(`[checkAccess] 免费题库，直接授予访问权限`);
      setQuizStatus(prev => ({ 
        ...prev, 
        hasAccessToFullQuiz: true,
        trialEnded: false,
        showPurchasePage: false
      }));
      saveAccessToLocalStorage(questionSet.id, true);
      return;
    }
    
    // 清除可能的缓存状态，强制重新检查
    localStorage.removeItem(`quiz_access_check_${questionSet.id}`);
    
    // 重新全面检查权限 - 使用从accessUtils导入的函数
    const hasFullAccess = checkFullAccessFromAllSources(questionSet, user, quizStatus.hasRedeemed);
    console.log(`[checkAccess] 重新检查权限: ${hasFullAccess}`);
    
    // 更新访问权限状态
    setQuizStatus(prev => ({ ...prev, hasAccessToFullQuiz: hasFullAccess }));
    
    // 根据检查结果更新本地存储
    if (hasFullAccess) {
      console.log(`[checkAccess] 用户有访问权限，保存到本地缓存并重置试用结束状态`);
      saveAccessToLocalStorage(questionSet.id, true);
      setQuizStatus(prev => ({ ...prev, trialEnded: false, showPurchasePage: false }));
    } else {
      console.log(`[checkAccess] 用户无访问权限，检查试用状态`);
      saveAccessToLocalStorage(questionSet.id, false);
      
      
      // 检查是否已达试用限制
      if (questionSet.trialQuestions && answeredQuestions.length >= questionSet.trialQuestions) {
        console.log(`[checkAccess] 已达到试用限制：${answeredQuestions.length}/${questionSet.trialQuestions}`);
        setQuizStatus({ ...quizStatus, trialEnded: true });
      } else {
        setQuizStatus({ ...quizStatus, trialEnded: false });
      }
    }
    
    // 同步服务器检查
    if (socket && user) {
      socket.emit('questionSet:checkAccess', {
        userId: user.id,
        questionSetId: String(questionSet.id).trim()
      });
    }
  };
  
  // 在获取题库数据后检查访问权限，并在用户状态变化时重新检查
  useEffect(() => {
    console.log(`[useEffect] 触发checkAccess重新检查, 用户ID: ${user?.id}, 题库ID: ${questionSet?.id}, 已兑换: ${quizStatus.hasRedeemed}`);
    if (user && user.purchases) {
      console.log(`[useEffect] 当前用户购买记录数量: ${user.purchases.length}`);
    }
    
    // 确保页面加载时不会显示购买弹窗
    if (questionSet && !isPaidQuiz(questionSet)) {
      console.log(`[useEffect] 检测到免费题库，确保不会显示购买弹窗`);
      setQuizStatus({ ...quizStatus, hasAccessToFullQuiz: true });
      setQuizStatus({ ...quizStatus, trialEnded: false });
      setQuizStatus({ ...quizStatus, showPurchasePage: false });
      saveAccessToLocalStorage(questionSet.id, true);
    }
    
    checkAccess();
  }, [questionSet, user, answeredQuestions.length, user?.purchases?.length, quizStatus.hasRedeemed]);
  
  // 修改trialEnded的判定逻辑，避免错误提示购买
  useEffect(() => {
    if (!questionSet) return;
    
    console.log(`[QuizPage] 检查是否试用结束，总答题数: ${answeredQuestions.length}, 试用题目数: ${questionSet.trialQuestions}`);
    
    // 如果是免费题库，永远不会试用结束
    if (!isPaidQuiz(questionSet)) {
      console.log(`[QuizPage] 免费题库不存在试用结束概念`);
      if (quizStatus.trialEnded) setQuizStatus({ ...quizStatus, trialEnded: false });
      if (quizStatus.showPurchasePage) setQuizStatus({ ...quizStatus, showPurchasePage: false });
      return;
    }
    
    // 重新检查完整访问权限
    const hasFullAccess = checkFullAccessFromAllSources(questionSet, user, quizStatus.hasRedeemed);
    
    // 如果用户有访问权限，确保状态一致性
    if (hasFullAccess) {
      console.log(`[QuizPage] 用户有完整访问权限，确保不显示试用结束/购买页面`);
      if (!quizStatus.hasAccessToFullQuiz) setQuizStatus({ ...quizStatus, hasAccessToFullQuiz: true });
      if (quizStatus.trialEnded) setQuizStatus({ ...quizStatus, trialEnded: false });
      if (quizStatus.showPurchasePage) setQuizStatus({ ...quizStatus, showPurchasePage: false });
      return;
    }
    
    // 到这里说明：付费题库 + 用户无完整访问权限
    console.log(`[QuizPage] 用户对付费题库无完整访问权限，检查试用状态`);
    if (quizStatus.hasAccessToFullQuiz) setQuizStatus({ ...quizStatus, hasAccessToFullQuiz: false });
    
    // 确定试用题目数量
    const trialQuestionsCount = questionSet.trialQuestions || 0;
    
    // 如果试用题目数为0，直接标记为试用结束
    if (trialQuestionsCount <= 0) {
      console.log(`[QuizPage] 付费题库无试用题或试用题为0，直接标记试用结束`);
      if (!quizStatus.trialEnded) setQuizStatus({ ...quizStatus, trialEnded: true });
      return;
    }
    
    // 检查已答题数是否达到试用限制
    const isTrialLimitReached = answeredQuestions.length >= trialQuestionsCount;
    console.log(`[QuizPage] 试用状态检查: 已答题数=${answeredQuestions.length}, 试用题数=${trialQuestionsCount}, 达到限制=${isTrialLimitReached}`);
    
    // 更新试用结束状态
    if (isTrialLimitReached) {
      if (!quizStatus.trialEnded) setQuizStatus({ ...quizStatus, trialEnded: true });
    } else {
      if (quizStatus.trialEnded) setQuizStatus({ ...quizStatus, trialEnded: false });
    }
  }, [
    questionSet, 
    answeredQuestions.length,
    checkFullAccessFromAllSources,
    quizStatus.hasAccessToFullQuiz,
    quizStatus.trialEnded,
    quizStatus.showPurchasePage
  ]);
  
  // 获取题库和题目数据
  useEffect(() => {
    if (!id) return;
    
    const fetchQuestionSet = async () => {
      setQuizStatus({ ...quizStatus, loading: true });
      setQuizStatus({ ...quizStatus, error: null });
      
      try {
        // 解析URL参数
        const urlParams = new URLSearchParams(window.location.search);
        const mode = urlParams.get('mode');
        const trialLimitParam = urlParams.get('trialLimit');
        const specificQuestions = urlParams.get('questions');
        
        // 检查URL中的trial参数，支持两种形式："?mode=trial" 或 "?trial=true"
        // 这样可以确保向后兼容性
        const isExplicitTrialMode = mode === 'trial' || urlParams.get('trial') === 'true';
        
        // 增强调试日志
        console.log('[QuizPage] URL 参数解析:', {
          fullUrl: window.location.href,
          search: window.location.search,
          mode,
          trialLimitParam,
          specificQuestions,
          isExplicitTrialMode,
          rawParams: Array.from(urlParams.entries())
        });
        
        // 获取题库详情 - 先从API缓存获取
        const response = await questionSetApi.getQuestionSetById(id);
        
        // 检查是否有疑似数据问题
        let questionSetData: IQuestionSet | null = null;
        let directApiData = null;
        
        if (response.success && response.data) {
          // 初步处理题库数据
          questionSetData = {
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
            trialQuestions: 0, // 先初始化为0，后面再设置
            questionCount: getQuestions(response.data).length,
            createdAt: new Date(),
            updatedAt: new Date()
          };
          
          // 使用调试模式检查题库付费状态
          const cachedIsPaid = isPaidQuiz(questionSetData, true);
          
          // 如果缓存API返回的是付费题库，但缓存isPaid标识可能存在问题，直接从API获取
          if (!cachedIsPaid && questionSetData.price > 0) {
            console.log('[QuizPage] 检测到潜在的题库数据不一致：价格 > 0 但 isPaid 不为真，尝试直接调用 API');
            
            try {
              // 直接从API获取最新数据，绕过可能的缓存
              const timestamp = new Date().getTime();
              const directResponse = await axios.get(
                `${API_BASE_URL}/question-sets/${id}?t=${timestamp}`, 
                { 
                  headers: { 
                    'Authorization': `Bearer ${localStorage.getItem('token')}`,
                    'Cache-Control': 'no-cache, no-store'
                  } 
                }
              );
              
              if (directResponse.data && directResponse.data.data) {
                directApiData = directResponse.data.data;
                
                // 验证直接API返回的付费状态
                const directIsPaid = isPaidQuiz(directApiData, true);
                
                // 如果直接API显示这是付费题库，更新本地数据
                if (directIsPaid) {
                  console.log('[QuizPage] 直接API调用显示此题库为付费题库，更新本地数据');
                  
                  // 更新questionSetData
                  questionSetData.isPaid = true;
                  
                  // 显示警告
                  toast.warning('检测到题库数据不一致，已自动修复', { autoClose: 3000 });
                }
              }
            } catch (directApiError) {
              console.error('[QuizPage] 直接API调用失败:', directApiError);
              // 继续使用缓存数据，这只是额外验证
            }
          }
          
          // 更新明确的试用模式状态
          setQuizStatus({ ...quizStatus, isInTrialMode: isExplicitTrialMode });
          
          // 改进对试用题目数量的确定逻辑
          const trialQuestionsFromApi = directApiData?.trialQuestions || response.data.trialQuestions;
          let determinedTrialCount: number;
          
          if (isExplicitTrialMode) {
            // 显式试用模式下，确保试用题数为正数
            const limitFromUrl = trialLimitParam ? parseInt(trialLimitParam, 10) : undefined;
            if (limitFromUrl !== undefined && limitFromUrl > 0) {
              determinedTrialCount = limitFromUrl;
            } else if (trialQuestionsFromApi !== undefined && trialQuestionsFromApi > 0) {
              determinedTrialCount = trialQuestionsFromApi;
            } else {
              determinedTrialCount = 3; // 显式试用模式下，若无有效正数限制，则默认为3题
            }
            console.log(`[QuizPage] 显式试用模式，试用题数: ${determinedTrialCount}`);
          } else {
            // 非显式试用模式 (直接访问 /quiz/:id)
            if (trialQuestionsFromApi !== undefined && trialQuestionsFromApi !== null && trialQuestionsFromApi >= 0) {
              determinedTrialCount = trialQuestionsFromApi;
            } else {
              // API未定义试用题数: 付费题库默认给1题隐式试用，免费题库0题
              const useDirectApi = directApiData && isPaidQuiz(directApiData, false);
              const useCachedApi = isPaidQuiz(questionSetData, false);
              const finalIsPaid = useDirectApi || useCachedApi;
              
              determinedTrialCount = finalIsPaid ? 1 : 0;
            }
            console.log(`[QuizPage] 非显式试用模式，试用题数: ${determinedTrialCount}`);
          }
          
          // 确保 determinedTrialCount 不为负
          if (determinedTrialCount < 0) determinedTrialCount = 0;
          
          // 更新题库的试用题数
          questionSetData.trialQuestions = determinedTrialCount;
          
          // 最终确认付费状态
          const finalIsPaid = directApiData ? isPaidQuiz(directApiData) : isPaidQuiz(questionSetData);
          
          console.log(`[QuizPage] 题库数据处理: isPaid=${finalIsPaid}, trialQuestions=${determinedTrialCount}`);
          
          setQuestionSet(questionSetData);
          
          // 免费题库直接授予访问权限，不显示购买页面
          if (!finalIsPaid) {
            console.log(`[QuizPage] 免费题库，授予访问权限`);
            setQuizStatus({ ...quizStatus, hasAccessToFullQuiz: true });
            setQuizStatus({ ...quizStatus, trialEnded: false });
            setQuizStatus({ ...quizStatus, showPurchasePage: false });
            saveAccessToLocalStorage(questionSetData.id, true);
          }
          
          // 修改试用模式初始化逻辑
          if (isExplicitTrialMode) {
            console.log(`[QuizPage] 初始化试用模式，限制题目数: ${determinedTrialCount}`);
            
            // 设置试用模式状态，但不触发购买提示
            if (finalIsPaid) {
              setQuizStatus({ ...quizStatus, hasAccessToFullQuiz: false });
              setQuizStatus({ ...quizStatus, hasRedeemed: false });
              // 重要：确保刚进入时不会显示试用结束状态
              setQuizStatus({ ...quizStatus, trialEnded: false });
              setQuizStatus({ ...quizStatus, showPaymentModal: false }); 
              setQuizStatus({ ...quizStatus, showPurchasePage: false }); // 确保不立即显示购买页面
              
              // 更新文档标题
              document.title = `${questionSetData.title} (试用模式) - 答题系统`;
              
              // 保存试用模式状态
              sessionStorage.setItem(`quiz_${id}_trial_mode`, 'true');
              if (determinedTrialCount > 0) {
                sessionStorage.setItem(`quiz_${id}_trial_limit`, String(determinedTrialCount));
              }
              
              // 只显示提示，不显示购买窗口
              toast.info(`您正在试用模式下答题，可以答${determinedTrialCount}道题`, {
                autoClose: 5000,
                icon: '🔍'
              });
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
            if (isExplicitTrialMode) {
              toast.info(`您正在试用模式下答题，可以答${determinedTrialCount}道题`, {
                autoClose: 5000,
                icon: '🔍'
              });
              
              // 确保购买和兑换按钮在试用模式下可用
              if (questionSetData.isPaid) {
                console.log('[QuizPage] 试用付费题库，设置相关状态');
                // 根据URL参数设置状态以确保试用功能正常
                setQuizStatus({ ...quizStatus, hasAccessToFullQuiz: false });
                setQuizStatus({ ...quizStatus, hasRedeemed: false });
                // 清除试用结束状态，允许用户开始试用
                setQuizStatus({ ...quizStatus, trialEnded: false });
              }
            }
            
            // 初始化问题开始时间
            setQuestionStartTime(Date.now());
            
            // 从本地存储加载上次的答题进度
            try {
              const localProgressKey = `quiz_progress_${id}`;
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
                      questionSetId: id
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
                      questionSetId: id
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
                    questionSetId: id
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
            setQuizStatus({ ...quizStatus, error: '此题库不包含任何题目' });
          }
        } else {
          setQuizStatus({ ...quizStatus, error: '无法加载题库数据' });
        }
      } catch (error) {
        console.error('获取题库详情失败:', error);
        setQuizStatus({ ...quizStatus, error: '获取题库数据失败' });
      } finally {
        setQuizStatus({ ...quizStatus, loading: false });
      }
    };
    
    fetchQuestionSet();
  }, [id, socket, user]);
  
  // 在加载完题目数据后设置questionStartTime
  useEffect(() => {
    if (questions.length > 0 && !quizStatus.loading) {
      setQuestionStartTime(Date.now());
    }
  }, [questions, quizStatus.loading]);

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
              setQuizStatus({ ...quizStatus, hasRedeemed: true });
              setQuizStatus({ ...quizStatus, hasAccessToFullQuiz: true });
              setQuizStatus({ ...quizStatus, trialEnded: false });
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

    // 添加进度删除事件处理
    const handleProgressDelete = (data: {questionSetId: string}) => {
      console.log('[QuizPage] 收到progress:delete事件:', data);
      if (data.questionSetId === id) {
        // 如果删除的是当前题库的进度，重置本地状态
        console.log('[QuizPage] 当前题库进度被删除，重置状态');
        setAnsweredQuestions([]);
        setCurrentQuestionIndex(0);
        setCorrectAnswers(0);
        setSelectedOptions([]);
        
        // 重置计时器
        setQuizTotalTime(0);
        setQuizStartTime(Date.now());
        
        // 如果有本地存储，也清除
        const localProgressKey = `quiz_progress_${id}`;
        localStorage.removeItem(localProgressKey);
        
        // 通知用户
        toast.info('题库进度已被重置', {
          position: 'top-center',
          autoClose: 3000
        });
      }
    };

    // 使用类型断言注册事件监听
    (socket as Socket).on('progress:data', handleProgressData);
    (socket as Socket).on('progress:delete', handleProgressDelete);
    
    return () => {
      // 使用类型断言清理事件监听
      (socket as Socket).off('progress:data', handleProgressData);
      (socket as Socket).off('progress:delete', handleProgressDelete);
    };
  }, [socket, user?.id, id]);
  
  // 处理选择选项
  const handleOptionSelect = (optionId: string) => {
    // 如果试用已结束且没有购买，不允许继续答题
    if (quizStatus.trialEnded && !quizStatus.hasAccessToFullQuiz && !quizStatus.hasRedeemed) {
      toast.warning('试用已结束，请购买完整版或使用兑换码继续答题');
      setQuizStatus({ ...quizStatus, showPaymentModal: true });
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
        setQuizStatus({ ...quizStatus, hasAccessToFullQuiz: data.hasAccess });
        
        // 权限开启后，同时确保试用结束状态重置
        if (data.hasAccess) {
          setQuizStatus({ ...quizStatus, trialEnded: false });
          // 更新本地缓存
          saveAccessToLocalStorage(questionSet.id, true);
        }
      }
    };

    // 监听购买成功事件
    const handlePurchaseSuccess = (data: {
      questionSetId: string;
      purchaseId: string;
      expiryDate: string;
    }) => {
      // Log using consistent naming and formatting
      console.log(`[QuizPage] Purchase success event received: questionSetId=${data.questionSetId}, currentId=${questionSet?.id}`);
      
      // Normalize IDs for reliable comparison
      const receivedId = String(data.questionSetId || '').trim();
      const currentId = String(questionSet?.id || '').trim();
      const isMatch = receivedId === currentId;
      
      console.log(`[QuizPage] ID comparison: received=${receivedId}, current=${currentId}, match=${isMatch}`);
      
      // Process matching events or events with no specific ID
      if (isMatch || !currentId) {
        console.log(`[QuizPage] Updating access rights for this question set`);
        
        // Update all relevant states in a single operation to prevent UI flickers
        setQuizStatus(prev => ({
          ...prev,
          hasAccessToFullQuiz: true,
          trialEnded: false,
          showPaymentModal: false,
          isProcessingPayment: false,
          showPurchasePage: false // 确保购买页面被关闭
        }));
        
        // Save access to local storage
        saveAccessToLocalStorage(receivedId, true);
        
        // 增加重试机制，确保服务器端成功更新
        const ensureAccessSaved = async () => {
          try {
            // 直接调用API确保服务器端更新权限
            const accessUpdateResponse = await axios.post(
              `${API_BASE_URL}/purchases/update-access`,
              { 
                questionSetId: receivedId,
                purchaseId: data.purchaseId
              },
              {
                headers: {
                  'Authorization': `Bearer ${localStorage.getItem('token')}`
                }
              }
            );
            
            console.log('[QuizPage] 访问权限更新响应:', accessUpdateResponse.data);
          } catch (updateError) {
            console.error('[QuizPage] 访问权限更新请求失败:', updateError);
            // 失败后不再重试，但确保本地仍被标记为已购买
          }
        };
        
        // 执行确保访问权限更新的函数
        ensureAccessSaved();
        
        // Force check access after a short delay to ensure server sync
        setTimeout(() => {
          console.log(`[QuizPage] Performing delayed access check after purchase`);
          checkAccess();
        }, 300);
        
        // Display success message
        toast.success('购买成功！您现在可以访问完整题库', {
          position: 'top-center',
          autoClose: 3000
        });
      }
    };

    console.log(`[Socket] 注册题库访问和购买事件监听`);
    socket.on('questionSet:accessUpdate', handleQuestionSetAccessUpdate);
    socket.on('purchase:success', handlePurchaseSuccess);
    
    // 添加document事件监听，确保从不同窗口触发的事件也能被捕获
    const handleDocumentPurchaseSuccess = (e: Event) => {
      const customEvent = e as CustomEvent;
      if (customEvent.detail) {
        handlePurchaseSuccess(customEvent.detail);
      }
    };
    
    document.addEventListener('purchase:success', handleDocumentPurchaseSuccess);

    return () => {
      console.log(`[Socket] 移除事件监听`);
      socket.off('questionSet:accessUpdate', handleQuestionSetAccessUpdate);
      socket.off('purchase:success', handlePurchaseSuccess);
      document.removeEventListener('purchase:success', handleDocumentPurchaseSuccess);
    };
  }, [socket, questionSet, quizStatus]);
  
  // 监听兑换码成功事件
  useEffect(() => {
    const handleRedeemSuccess = (e: Event) => {
      console.log(`[QuizPage] Redeem success event received`);
      const customEvent = e as CustomEvent;
      
      // Extract and normalize data from event
      const eventDetail = customEvent.detail || {};
      const receivedQuestionSetId = String(eventDetail.questionSetId || '').trim();
      const legacyQuizId = String(eventDetail.quizId || '').trim(); // For backwards compatibility
      const effectiveId = receivedQuestionSetId || legacyQuizId; // Prefer new ID format
      const currentId = String(questionSet?.id || '').trim();
      const isCurrentQuestionSet = effectiveId === currentId;
      const forceRefresh = !!eventDetail.forceRefresh;
      
      console.log(`[QuizPage] Redeem event details:`, {
        receivedId: effectiveId,
        currentId,
        isMatch: isCurrentQuestionSet,
        forceRefresh
      });
      
      // Update if it matches current question set or has forceRefresh flag
      if (isCurrentQuestionSet || forceRefresh || !currentId) {
        console.log(`[QuizPage] Updating access rights after redemption`);
        
        // Update all relevant states in a single operation to prevent UI flickers
        setQuizStatus(prev => ({
          ...prev,
          hasAccessToFullQuiz: true,
          trialEnded: false,
          hasRedeemed: true,
          showRedeemCodeModal: false,
          isProcessingRedeem: false
        }));
        
        // Save access to localStorage
        if (effectiveId) {
          saveAccessToLocalStorage(effectiveId, true);
          saveRedeemedQuestionSetId(effectiveId);
        }
        
        // Also save for current question set if different
        if (currentId && currentId !== effectiveId) {
          saveAccessToLocalStorage(currentId, true);
          saveRedeemedQuestionSetId(currentId);
        }
        
        // Force access check to ensure data consistency
        setTimeout(() => {
          console.log(`[QuizPage] Performing delayed access check after redemption`);
          checkAccess();
        }, 300);
        
        // Show success notification if not already shown by modal
        if (!isCurrentQuestionSet) {
          toast.success('兑换成功！您现在可以访问完整题库', {
            position: 'top-center',
            autoClose: 3000
          });
        }
      }
    };
    
    // Add event listener
    window.addEventListener('redeem:success', handleRedeemSuccess);
    
    return () => {
      window.removeEventListener('redeem:success', handleRedeemSuccess);
    };
  }, [questionSet, saveAccessToLocalStorage, saveRedeemedQuestionSetId, checkAccess]);
  
  // 修改syncProgressToServer函数为手动保存函数
  const saveProgressManually = useCallback(async () => {
    if (!user?.id || !id || !socket) {
      toast.error('保存失败，请确认您已登录');
      return;
    }
    
    setIsSaving(true);
    
    try {
      console.log('[QuizPage] 开始手动保存进度数据');
      
      // 准备要发送的进度数据包
      const progressBundle = {
        userId: user.id,
        questionSetId: id,
        lastQuestionIndex: currentQuestionIndex,
        answeredQuestions,
        timeSpent: quizTotalTime,
        timestamp: new Date().toISOString()
      };
      
      // 通过socket将打包的进度数据同步到服务器
      socket.emit('progress:update', progressBundle);
      
      // 等待服务器响应
      await new Promise<void>((resolve, reject) => {
        const timeout = setTimeout(() => {
          reject(new Error('保存超时'));
        }, 5000);
        
        const handleSaveResponse = (response: {success: boolean}) => {
          clearTimeout(timeout);
          if (response.success) {
            resolve();
          } else {
            reject(new Error('服务器保存失败'));
          }
        };
        
        socket.once('progress:update:result', handleSaveResponse);
      });
      
      // 更新本地存储
      try {
        const localProgressKey = `quiz_progress_${id}`;
        const localProgressUpdate = {
          lastQuestionIndex: currentQuestionIndex,
          answeredQuestions,
          correctAnswers,
          totalAnswered: answeredQuestions.length,
          totalQuestions: questions.length,
          lastUpdated: new Date().toISOString()
        };
        localStorage.setItem(localProgressKey, JSON.stringify(localProgressUpdate));
      } catch (e) {
        console.error('[QuizPage] 保存本地进度失败:', e);
      }
      
      // 更新保存状态
      setLastSavedTime(Date.now());
      setHasUnsavedChanges(false);
      setShowSaveSuccess(true);
      setTimeout(() => setShowSaveSuccess(false), 3000);
      
      // 显示成功消息
      toast.success('进度保存成功');
      
      console.log('[QuizPage] 进度数据保存完成');
    } catch (error) {
      console.error('[QuizPage] 保存进度数据异常:', error);
      toast.error('保存失败，请重试');
    } finally {
      setIsSaving(false);
    }
  }, [user?.id, id, socket, currentQuestionIndex, answeredQuestions, quizTotalTime, correctAnswers, questions.length]);
  
  // 修改handleAnswerSubmit函数，不再自动同步，移除阻塞行为
  const handleAnswerSubmit = useCallback(async (
    selectedOption: string | string[], 
    isCorrect: boolean, 
    question: Question,
    questionIndex: number
  ) => {
    console.log(`[QuizPage] handleAnswerSubmit: 开始处理答案提交 - 题目ID=${question.id}, 索引=${questionIndex}`);
    
    try {
      if (!id || !question.id) {
        console.error('[QuizPage] 题目ID或题库ID缺失');
        return;
      }
      
      // 计算当前问题的答题用时（毫秒）
      const timeSpent = Date.now() - questionStartTime;
      
      // 检查是否为重复提交相同题目
      const alreadyAnsweredIndex = answeredQuestions.findIndex((a) => 
        a.questionIndex === questionIndex
      );
      
      // 构建新的答题记录
      const newAnswer: AnsweredQuestion = {
        index: alreadyAnsweredIndex >= 0 ? answeredQuestions[alreadyAnsweredIndex].index : answeredQuestions.length,
        questionIndex: questionIndex,
        isCorrect: isCorrect,
        selectedOption: selectedOption
      };
      
      // 更新已答题目列表
      let updatedAnsweredQuestions = [...answeredQuestions];
      
      if (alreadyAnsweredIndex >= 0) {
        // 替换已存在的答题记录
        updatedAnsweredQuestions[alreadyAnsweredIndex] = newAnswer;
      } else {
        // 添加新的答题记录
        updatedAnsweredQuestions.push(newAnswer);
      }
      
      // 更新正确答题计数
      const newCorrectCount = updatedAnsweredQuestions.filter(q => q.isCorrect).length;
      setCorrectAnswers(newCorrectCount);
      
      // 更新状态显示已答问题
      setAnsweredQuestions(updatedAnsweredQuestions);
      
      // 更新本地存储
      if (questionSet) {
        const localProgressKey = `quiz_progress_${id}`;
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
          localStorage.setItem(localProgressKey, JSON.stringify(localProgressUpdate));
          console.log(`[QuizPage] 已更新本地进度存储，包含${updatedAnsweredQuestions.length}道已答题目`);
        } catch (e) {
          console.error('[QuizPage] 保存本地进度失败:', e);
        }
        
        // 标记有未保存的更改
        setHasUnsavedChanges(true);
      }
      
      console.log('[QuizPage] 答案提交处理完成');
    } catch (error) {
      console.error('[QuizPage] 提交答案出错:', error);
    }
  }, [
    answeredQuestions, 
    id, 
    questionStartTime, 
    questions.length, 
    questionSet
  ]);
  
  // 添加一个新的函数来集中管理试用限制逻辑
  const isTrialLimitReached = useCallback((): boolean => {
    if (!questionSet || !user) return false;
    
    // 如果不是付费题库，永远不会达到限制
    if (!questionSet.isPaid) return false;
    
    // 如果用户有完整访问权限，永远不会达到限制
    if (checkFullAccessFromAllSources(questionSet, user, quizStatus.hasRedeemed)) return false;
    
    // 检查是否已达到试用题目数量
    const trialLimit = questionSet.trialQuestions || 0;
    const answeredCount = answeredQuestions.length;
    
    console.log(`[QuizPage] 检查试用限制: 已答题=${answeredCount}, 限制=${trialLimit}`);
    
    // 已达到或超过试用限制
    return answeredCount >= trialLimit;
  }, [answeredQuestions.length, questionSet, user, quizStatus.hasRedeemed]);

  // 添加一个函数专门控制是否可以访问特定题目索引
  const canAccessQuestion = useCallback((questionIndex: number): boolean => {
    // 所有题目都应该可以访问，确保流畅的用户体验
    return true;
  }, []);
  
  // 修改处理答案提交的函数，确保模态窗口显示
  const handleAnswerSubmitAdapter = useCallback((isCorrect: boolean, selectedOption: string | string[]) => {
    console.log(`[QuizPage] handleAnswerSubmitAdapter 被调用 - isCorrect=${isCorrect}`);
    
    // 使用集中的访问权限检查
    const hasFullAccess = checkFullAccessFromAllSources(questionSet, user, quizStatus.hasRedeemed);
    if (hasFullAccess) {
      console.log('[QuizPage] 用户有完整访问权限，允许提交答案');
      // 确保状态一致性
      if (!quizStatus.hasAccessToFullQuiz) setQuizStatus({ ...quizStatus, hasAccessToFullQuiz: true });
      if (quizStatus.trialEnded) setQuizStatus({ ...quizStatus, trialEnded: false });
    }
    
    // 获取当前问题
    const currentQ = questions[currentQuestionIndex];
    if (currentQ) {
      try {
        // 使用正确的参数顺序调用handleAnswerSubmit
        handleAnswerSubmit(selectedOption, isCorrect, currentQ, currentQuestionIndex);
        
        // 检查答题后是否会达到试用限制
        if (!hasFullAccess) {
          // 预计提交后的答题数
          const willBeAnsweredCount = answeredQuestions.findIndex(q => q.questionIndex === currentQuestionIndex) >= 0 
            ? answeredQuestions.length  // 已答过的题目，数量不变
            : answeredQuestions.length + 1; // 新答的题目，数量+1
          
          const trialLimit = questionSet?.trialQuestions || 0;
          
          console.log('[QuizPage] 答题后试用限制检查:', {
            currentAnswered: answeredQuestions.length,
            willBeAnswered: willBeAnsweredCount,
            trialLimit: trialLimit
          });
          
          // 如果答题后将达到试用限制
          if (questionSet?.isPaid && !hasFullAccess && willBeAnsweredCount >= trialLimit) {
            console.log('[QuizPage] 答题将达到试用限制，准备显示购买窗口');
            
            // 延迟显示购买窗口，给用户时间查看答案
            setTimeout(() => {
              // 再次检查确认状态没有变化
              if (!checkFullAccessFromAllSources(questionSet, user, quizStatus.hasRedeemed)) {
                console.log('[QuizPage] 确认用户仍无访问权限，显示购买窗口');
                setQuizStatus({ ...quizStatus, trialEnded: true });
                setQuizStatus({ ...quizStatus, showPurchasePage: true });
                
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
      } catch (error) {
        console.error('[QuizPage] 处理答案提交时出错:', error);
      }
    } else {
      console.error('[QuizPage] 无法提交答案：当前题目不存在');
    }
  }, [
    questions, 
    currentQuestionIndex, 
    handleAnswerSubmit, 
    questionSet, 
    answeredQuestions, 
    checkFullAccessFromAllSources,
    quizStatus.hasAccessToFullQuiz,
    setQuizStatus,
    setAnsweredQuestions,
    quizStatus.trialEnded
  ]);
  
  // 修改下一题逻辑，确保顺畅过渡而不检查权限
  const handleNextQuestion = useCallback(() => {
    console.log('[QuizPage] handleNextQuestion 被调用 - 准备跳转到下一题');
    
    // 如果已经是最后一题，标记为完成
    if (currentQuestionIndex === questions.length - 1) {
      console.log('[QuizPage] 当前是最后一题，将标记为完成');
      setQuizStatus({ ...quizStatus, quizComplete: true });
      console.log('[QuizPage] 答题已完成');
      return;
    }
    
    try {
      // 跳转到下一题
      const nextQuestionIndex = currentQuestionIndex + 1;
      console.log(`[QuizPage] 跳转到下一题: ${nextQuestionIndex + 1}`);
      setCurrentQuestionIndex(nextQuestionIndex);
      setSelectedOptions([]);
      setQuestionStartTime(Date.now());
    } catch (error) {
      console.error('[QuizPage] 跳转到下一题时出错:', error);
    }
  }, [
    currentQuestionIndex, 
    questions.length, 
    quizStatus
  ]);

  // 跳转到指定题目的处理函数
  const handleJumpToQuestion = useCallback((questionIndex: number) => {
    // 阻止在提交过程中或完成状态下跳转
    if (isSubmittingRef.current || quizStatus.quizComplete) {
      console.log('[QuizPage] 无法跳转：正在提交答案或已完成问答');
      return;
    }
    
    // 安全检查：确保题目索引有效
    if (questionIndex < 0 || questionIndex >= questions.length) {
      console.error(`[QuizPage] 无效题目索引: ${questionIndex}, 最大索引: ${questions.length - 1}`);
      return;
    }
    
    // 使用集中的访问控制函数
    if (canAccessQuestion(questionIndex)) {
      console.log(`[QuizPage] 允许跳转到题目: ${questionIndex + 1}`);
      setCurrentQuestionIndex(questionIndex);
      setQuestionStartTime(Date.now()); // 重置计时器
    } else {
      console.log(`[QuizPage] 禁止跳转到题目: ${questionIndex + 1}, 超出试用限制`);
      
      // 显示提示信息
      toast.info(`您正在试用模式下，需要购买完整版才能访问更多题目`, {
        position: "top-center",
        autoClose: 5000,
        toastId: "trial-limit-jump-toast",
      });
      
      // 设置试用结束状态
      setQuizStatus({ ...quizStatus, trialEnded: true });
      
      // 显示购买页面
      setQuizStatus({ ...quizStatus, showPurchasePage: true });
    }
  }, [
    questions.length, 
    quizStatus.quizComplete, 
    canAccessQuestion,
    setQuizStatus,
    setAnsweredQuestions,
    setSelectedOptions,
    setQuestionStartTime,
    setQuizStatus
  ]);

  // 添加页面导航返回主页功能
  const handleNavigateHome = useCallback(() => {
    // 导航前先同步进度
    if (unsyncedChangesRef.current) {
      saveProgressManually().then(() => {
        navigate('/');
      });
    } else {
      navigate('/');
    }
  }, [navigate, saveProgressManually]);
  
  // 确保handleResetQuiz也同步进度
  const handleResetQuiz = useCallback(async () => {
    try {
      setQuizStatus({ ...quizStatus, loading: true });
      
      // 清除任何现有的定时器
      if (timeoutId.current) {
        clearTimeout(timeoutId.current);
        timeoutId.current = undefined;
      }
      
      // 首先同步当前进度
      if (unsyncedChangesRef.current) {
        await saveProgressManually();
        unsyncedChangesRef.current = false;
      }
      
      // 重置计时器
      setQuizTotalTime(0);
      setQuizStartTime(Date.now());
      setQuizStatus({ ...quizStatus, isTimerActive: true });
      
      // 重置所有状态
      setCurrentQuestionIndex(0);
      setSelectedOptions([]);
      setQuizStatus({ ...quizStatus, showExplanation: false });
      setAnsweredQuestions([]);
      setCorrectAnswers(0);
      setQuizStatus({ ...quizStatus, quizComplete: false });
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
          setQuizStatus({ ...quizStatus, error: '重置进度失败，请尝试重新加载页面' });
          
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
      setQuizStatus({ ...quizStatus, loading: false });
    }
  }, [
    questionSet, 
    id, 
    originalQuestions, 
    saveProgressManually, 
    navigate,
    socket,
    user,
    questions
  ]);

  // 创建一个固定在页面底部的购买栏组件
  const TrialPurchaseBar = () => {
    // 仅当满足以下条件时显示购买栏：付费题库 + 试用模式 + 无完整访问权限
    if (!questionSet || !isPaidQuiz(questionSet) || quizStatus.hasAccessToFullQuiz || quizStatus.hasRedeemed) {
      // 对于已购买或已兑换的题库，显示有效期信息而不是购买栏
      if (questionSet && isPaidQuiz(questionSet) && (quizStatus.hasAccessToFullQuiz || quizStatus.hasRedeemed)) {
        // 查找当前题库的有效期信息
        let expiryInfo = null;
        
        // 检查用户购买记录
        if (user?.purchases && Array.isArray(user.purchases)) {
          const purchase = user.purchases.find(p => 
            String(p.questionSetId).trim() === String(questionSet.id).trim());
          
          if (purchase && purchase.expiryDate) {
            const expiryDate = new Date(purchase.expiryDate);
            const now = new Date();
            const remainingDays = Math.max(0, Math.ceil((expiryDate.getTime() - now.getTime()) / (1000 * 60 * 60 * 24)));
            
            if (expiryDate > now) {
              expiryInfo = {
                type: 'purchase',
                remainingDays,
                expiryDate: expiryDate.toLocaleDateString()
              };
            }
          }
        }
        
        // 如果没有找到购买记录，检查是否是兑换记录
        if (!expiryInfo && user?.id) {
          // 这里可以添加从localStorage中读取兑换有效期的逻辑
          const redeemedStr = localStorage.getItem('redeemedQuestionSetInfo');
          if (redeemedStr) {
            try {
              const redeemedInfo = JSON.parse(redeemedStr);
              const currentInfo = redeemedInfo.find((item: any) => 
                String(item.questionSetId).trim() === String(questionSet.id).trim());
              
              if (currentInfo && currentInfo.expiryDate) {
                const expiryDate = new Date(currentInfo.expiryDate);
                const now = new Date();
                const remainingDays = Math.max(0, Math.ceil((expiryDate.getTime() - now.getTime()) / (1000 * 60 * 60 * 24)));
                
                if (expiryDate > now) {
                  expiryInfo = {
                    type: 'redeem',
                    remainingDays,
                    expiryDate: expiryDate.toLocaleDateString()
                  };
                }
              }
            } catch (e) {
              console.error('[QuizPage] 解析兑换信息失败:', e);
            }
          }
        }
        
        // 显示有效期信息
        if (expiryInfo) {
          return (
            <div className="fixed bottom-0 left-0 right-0 bg-white shadow-sm border-t border-gray-200 p-2 z-40">
              <div className="container mx-auto flex items-center justify-between">
                <div className="flex-1">
                  <p className="text-sm text-gray-700">
                    <span className="font-medium">题库有效期:</span> 
                    <span className="text-blue-600 font-bold mx-1">{expiryInfo.expiryDate}</span>
                    <span className="ml-2 bg-green-100 text-green-800 px-2 py-0.5 rounded-full text-xs font-medium">
                      剩余 {expiryInfo.remainingDays} 天
                    </span>
                  </p>
                </div>
                <div>
                  <button
                    onClick={saveProgressManually}
                    disabled={isSaving}
                    className={`px-3 py-1.5 rounded-md text-sm flex items-center ${
                      isSaving 
                      ? 'bg-gray-100 text-gray-500 cursor-not-allowed' 
                      : 'bg-blue-100 text-blue-700 hover:bg-blue-200'
                    }`}
                  >
                    {isSaving ? (
                      <>
                        <svg className="w-4 h-4 mr-1 animate-spin" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
                        </svg>
                        保存中...
                      </>
                    ) : (
                      <>
                        <svg className="w-4 h-4 mr-1" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 7H5a2 2 0 00-2 2v9a2 2 0 002 2h14a2 2 0 002-2V9a2 2 0 00-2-2h-3m-1 4l-3 3m0 0l-3-3m3 3V4" />
                        </svg>
                        保存进度
                      </>
                    )}
                  </button>
                </div>
              </div>
            </div>
          );
        }
      }
      return null;
    }
    
    // 计算还剩多少题可以试用
    const answeredCount = answeredQuestions.length;
    const totalTrialQuestions = questionSet.trialQuestions || 0;
    const remainingTrialQuestions = Math.max(0, totalTrialQuestions - answeredCount);
    
    // 判断是否已达到试用限制
    const isTrialLimitReached = totalTrialQuestions > 0 && answeredCount >= totalTrialQuestions;
    
    return (
      <div className="fixed bottom-0 left-0 right-0 bg-white shadow-lg border-t border-gray-200 p-3 z-40">
        <div className="container mx-auto flex items-center justify-between">
          <div className="flex-1">
            {isTrialLimitReached ? (
              <p className="text-sm text-red-600 font-medium">
                您已达到试用题目限制，请购买完整版继续使用
              </p>
            ) : (
              <p className="text-sm text-gray-700">
                <span className="font-medium">试用模式:</span> 已答 
                <span className="text-blue-600 font-bold mx-1">{answeredCount}</span> 题，
                限制 <span className="text-blue-600 font-bold mx-1">{totalTrialQuestions}</span> 题
                <span className="ml-2 bg-green-100 text-green-800 px-2 py-0.5 rounded-full text-xs font-medium">
                  还可答 {remainingTrialQuestions} 题
                </span>
              </p>
            )}
          </div>
          <div className="flex space-x-2">
            <button
              onClick={(e) => {
                // 阻止事件冒泡
                e.stopPropagation();
                
                console.log('[TrialPurchaseBar] 点击购买按钮 - 当前时间:', new Date().toISOString());
                
                // 防止重复处理
                if (quizStatus.isProcessingPayment || quizStatus.showPaymentModal) {
                  console.log('[TrialPurchaseBar] 忽略点击 - isProcessingPayment:', quizStatus.isProcessingPayment, 'showPaymentModal:', quizStatus.showPaymentModal);
                  return;
                }
                
                // 增加按钮点击视觉反馈
                const button = e.currentTarget;
                button.classList.add('scale-95');
                setTimeout(() => button.classList.remove('scale-95'), 150);
                
                toast.info('正在准备支付...', { autoClose: 1500 });
                
                // 直接设置状态显示支付模态窗口
                console.log('[TrialPurchaseBar] 设置showPaymentModal=true');
                setQuizStatus(prev => ({
                  ...prev,
                  showPaymentModal: true
                }));
              }}
              type="button"
              className={`px-4 py-2 text-sm rounded-md transition-all duration-200
                ${isTrialLimitReached 
                  ? "bg-blue-600 text-white animate-pulse transform hover:scale-105 hover:shadow-md active:scale-95" 
                  : "bg-blue-600 text-white hover:bg-blue-700 hover:shadow-md transform hover:-translate-y-0.5 active:translate-y-0 active:scale-95"
                } focus:outline-none focus:ring-2 focus:ring-blue-400 focus:ring-offset-2`}
            >
              <div className="flex items-center">
                <svg className="w-4 h-4 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 10h18M7 15h1m4 0h1m-7 4h12a3 3 0 003-3V8a3 3 0 00-3-3H6a3 3 0 00-3 3v8a3 3 0 003 3z" />
                </svg>
              购买完整版 ¥{questionSet.price || 0}
              </div>
            </button>
            <button
              onClick={(e) => {
                // 阻止事件冒泡
                e.stopPropagation();
                
                console.log('[TrialPurchaseBar] 点击兑换按钮 - 当前时间:', new Date().toISOString());
                
                // 防止重复处理
                if (quizStatus.isProcessingRedeem || quizStatus.showRedeemCodeModal) {
                  console.log('[TrialPurchaseBar] 忽略点击 - isProcessingRedeem:', quizStatus.isProcessingRedeem, 'showRedeemCodeModal:', quizStatus.showRedeemCodeModal);
                  return;
                }
                
                // 增加按钮点击视觉反馈
                const button = e.currentTarget;
                button.classList.add('scale-95');
                setTimeout(() => button.classList.remove('scale-95'), 150);
                
                toast.info('正在准备兑换...', { autoClose: 1500 });
                
                // 直接设置状态显示兑换模态窗口
                console.log('[TrialPurchaseBar] 设置showRedeemCodeModal=true');
                setQuizStatus(prev => ({
                  ...prev,
                  showRedeemCodeModal: true
                }));
              }}
              type="button"
              className="px-4 py-2 bg-green-50 text-green-700 text-sm border-2 border-green-400 rounded-lg font-medium transition-all duration-200 flex items-center justify-center hover:bg-green-100 hover:shadow-md transform hover:-translate-y-0.5 active:translate-y-0 active:scale-95 focus:outline-none focus:ring-2 focus:ring-green-400 focus:ring-offset-2"
            >
              <svg className="w-5 h-5 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M7 7h.01M7 3h5c.512 0 1.024.195 1.414.586l7 7a2 2 0 010 2.828l-7 7a2 2 0 01-2.828 0l-7-7A1.994 1.994 0 013 12V7a4 4 0 014-4z" />
              </svg>
              使用兑换码
            </button>
          </div>
        </div>
      </div>
    );
  };

  // 渲染内容更新
  const renderContent = () => {
    if (quizStatus.loading) {
      return (
        <div className="flex justify-center items-center h-64">
          <div className="w-16 h-16 border-t-4 border-blue-500 border-solid rounded-full animate-spin"></div>
        </div>
      );
    }

    if (quizStatus.error) {
      return (
        <div className="text-center py-12">
          <div className="text-red-500 text-xl mb-4">加载失败</div>
          <p className="text-gray-600 mb-6">{quizStatus.error}</p>
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

    if (quizStatus.quizComplete) {
      // 计算统计数据
      const correctCount = answeredQuestions.filter(q => q.isCorrect).length;
      const totalCount = questions.length;
      const accuracy = Math.round((correctCount / totalCount) * 100);
      const averageTimePerQuestion = Math.round(quizTotalTime / (answeredQuestions.length || 1));
      
      // 获取访问状态文本
      const getAccessStatusText = () => {
        if (!questionSet) return '';
        
        if (!isPaidQuiz(questionSet)) {
          return '免费题库';
        }
        
        if (quizStatus.hasAccessToFullQuiz) {
          return `付费题库 (已购买)`;
        }
        
        return '付费题库 (未购买)';
      };

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
              <div className="bg-indigo-100 text-indigo-800 px-3 py-1 rounded-lg text-sm">
                {questionSet?.title || '完成练习'}
              </div>
            </div>
          </div>
          
          {/* 完成练习页面主体 */}
          <div className="bg-white rounded-xl shadow-md p-6 mb-6">
            <div className="text-center mb-8">
              <div className="inline-flex items-center justify-center p-4 rounded-full bg-green-100 text-green-600 mb-4">
                <svg className="w-10 h-10" fill="none" stroke="currentColor" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                </svg>
              </div>
              <h2 className="text-2xl font-bold text-gray-800 mb-2">练习完成！</h2>
              <p className="text-gray-600 text-lg">{questionSet?.title || '未知题库'}</p>
              
              {/* 题库类型和信息 */}
              <div className="mt-2 text-sm text-gray-500">
                {getAccessStatusText()}
              </div>
            </div>
            
            {/* 统计数据卡片 */}
            <div className="grid grid-cols-2 gap-4 mb-8 md:grid-cols-4">
              <div className="bg-blue-50 rounded-lg p-4 text-center">
                <div className="text-sm text-blue-600 mb-1">答题数</div>
                <div className="text-2xl font-bold text-blue-800">{answeredQuestions.length}</div>
                <div className="text-xs text-blue-600 mt-1">共{totalCount}题</div>
              </div>
              
              <div className="bg-green-50 rounded-lg p-4 text-center">
                <div className="text-sm text-green-600 mb-1">正确率</div>
                <div className="text-2xl font-bold text-green-800">{accuracy}%</div>
                <div className="text-xs text-green-600 mt-1">{correctCount}题正确</div>
              </div>
              
              <div className="bg-purple-50 rounded-lg p-4 text-center">
                <div className="text-sm text-purple-600 mb-1">总用时</div>
                <div className="text-2xl font-bold text-purple-800">{formatTime(quizTotalTime)}</div>
                <div className="text-xs text-purple-600 mt-1">完成所有题目</div>
              </div>
              
              <div className="bg-orange-50 rounded-lg p-4 text-center">
                <div className="text-sm text-orange-600 mb-1">平均用时</div>
                <div className="text-2xl font-bold text-orange-800">{formatTime(averageTimePerQuestion)}</div>
                <div className="text-xs text-orange-600 mt-1">每题平均</div>
              </div>
            </div>
            
            {/* 答题详情面板 */}
            <div className="mb-8">
              <h3 className="text-lg font-semibold text-gray-700 mb-4">答题详情</h3>
              
              <div className="bg-gray-50 rounded-lg p-4 mb-4">
                <div className="flex items-center justify-between mb-2">
                  <div className="text-sm font-medium text-gray-500">答对题目</div>
                  <div className="text-sm font-medium text-green-600">{correctCount} 题</div>
                </div>
                <div className="w-full bg-gray-200 rounded-full h-2">
                  <div 
                    className="bg-green-500 h-2 rounded-full" 
                    style={{width: `${correctCount / totalCount * 100}%`}}
                  ></div>
                </div>
              </div>
              
              <div className="bg-gray-50 rounded-lg p-4">
                <div className="flex items-center justify-between mb-2">
                  <div className="text-sm font-medium text-gray-500">答错题目</div>
                  <div className="text-sm font-medium text-red-600">{totalCount - correctCount} 题</div>
                </div>
                <div className="w-full bg-gray-200 rounded-full h-2">
                  <div 
                    className="bg-red-500 h-2 rounded-full" 
                    style={{width: `${(totalCount - correctCount) / totalCount * 100}%`}}
                  ></div>
                </div>
              </div>
            </div>
            
            {/* 题目列表（折叠状态） */}
            <div className="mb-8">
              <details className="bg-gray-50 rounded-lg p-4">
                <summary className="font-medium text-gray-700 cursor-pointer">
                  题目答题情况详情 ({answeredQuestions.length}题)
                </summary>
                <div className="mt-4 space-y-3">
                  {answeredQuestions.map((answer, index) => {
                    if (!answer.questionIndex) return null;
                    const question = questions[answer.questionIndex];
                    if (!question) return null;
                    
                    return (
                      <div key={index} className={`p-3 rounded-lg border ${answer.isCorrect ? 'border-green-200 bg-green-50' : 'border-red-200 bg-red-50'}`}>
                        <div className="flex justify-between items-start">
                          <div className="flex items-center">
                            <div className={`w-6 h-6 rounded-full flex items-center justify-center text-sm font-medium mr-2 ${answer.isCorrect ? 'bg-green-200 text-green-800' : 'bg-red-200 text-red-800'}`}>
                              {(answer.questionIndex ?? 0) + 1}
                            </div>
                            <div className="text-sm font-medium text-gray-700">{question.question ? (question.question.length > 100 ? `${question.question.substring(0, 100)}...` : question.question) : '未知问题'}</div>
                          </div>
                          <div className={`text-xs px-2 py-0.5 rounded-full ${answer.isCorrect ? 'bg-green-200 text-green-800' : 'bg-red-200 text-red-800'}`}>
                            {answer.isCorrect ? '正确' : '错误'}
                          </div>
                        </div>
                      </div>
                    );
                  })}
                </div>
              </details>
            </div>
            
            {/* 操作按钮 */}
            <div className="flex flex-col space-y-3 sm:flex-row sm:space-y-0 sm:space-x-3 justify-center">
              <button 
                onClick={handleResetQuiz} 
                className="px-5 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition flex items-center justify-center"
              >
                <svg className="w-5 h-5 mr-1" fill="none" stroke="currentColor" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
                </svg>
                重新开始
              </button>
              
              <button 
                onClick={handleNavigateHome} 
                className="px-5 py-2 bg-gray-200 text-gray-800 rounded-lg hover:bg-gray-300 transition flex items-center justify-center"
              >
                <svg className="w-5 h-5 mr-1" fill="none" stroke="currentColor" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 12l2-2m0 0l7-7 7 7M5 10v10a1 1 0 001 1h3m10-11l2 2m-2-2v10a1 1 0 01-1 1h-3m-6 0a1 1 0 001-1v-4a1 1 0 011-1h2a1 1 0 011 1v4a1 1 0 001 1m-6 0h6" />
                </svg>
                返回首页
              </button>
              
              {/* 使用hasAccessToFullQuiz来判断是否显示购买按钮 */}
              {questionSet && isPaidQuiz(questionSet) && !quizStatus.hasAccessToFullQuiz && !quizStatus.hasRedeemed && (
                <button
                  onClick={(e) => {
                    // 阻止事件冒泡
                    e.stopPropagation();
                    
                    console.log('[QuizPage] 完成页面点击购买按钮 - 当前时间:', new Date().toISOString());
                    
                    // 防止重复处理
                    if (quizStatus.isProcessingPayment || quizStatus.showPaymentModal) {
                      console.log('[QuizPage] 完成页面忽略点击 - isProcessingPayment:', quizStatus.isProcessingPayment, 'showPaymentModal:', quizStatus.showPaymentModal);
                      return;
                    }
                    
                    // 增加按钮点击视觉反馈
                    const button = e.currentTarget;
                    button.classList.add('scale-95');
                    setTimeout(() => button.classList.remove('scale-95'), 150);
                    
                    toast.info('正在准备支付...', { autoClose: 1500 });
                    
                    // 直接设置状态显示支付模态窗口
                    console.log('[QuizPage] 完成页面设置showPaymentModal=true');
                    setQuizStatus(prev => ({
                      ...prev,
                      showPaymentModal: true
                    }));
                  }}
                  type="button"
                  className="mt-4 px-6 py-2.5 bg-gradient-to-r from-blue-600 to-blue-700 hover:from-blue-700 hover:to-blue-800 text-white rounded-lg font-medium shadow-md hover:shadow-lg transition-all duration-200 transform hover:-translate-y-0.5 active:translate-y-0 active:scale-95 focus:outline-none focus:ring-2 focus:ring-blue-400 focus:ring-offset-2 flex items-center justify-center"
                >
                  <svg className="w-5 h-5 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 10h18M7 15h1m4 0h1m-7 4h12a3 3 0 003-3V8a3 3 0 00-3-3H6a3 3 0 00-3 3v8a3 3 0 003 3z" />
                  </svg>
                  购买完整版 ¥{questionSet.price || 0}
                  <svg className="w-4 h-4 ml-2" fill="none" stroke="currentColor" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M14 5l7 7m0 0l-7 7m7-7H3" />
                  </svg>
                </button>
              )}
            </div>
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
            {/* 添加保存进度按钮 */}
            <button
              onClick={saveProgressManually}
              disabled={isSaving || !hasUnsavedChanges}
              className={`flex items-center px-3 py-1 mr-4 rounded text-sm ${
                isSaving 
                  ? 'bg-gray-200 text-gray-500 cursor-not-allowed' 
                  : hasUnsavedChanges
                    ? 'bg-green-100 text-green-700 hover:bg-green-200' 
                    : 'bg-gray-100 text-gray-500 cursor-not-allowed'
              }`}
            >
              {isSaving ? (
                <>
                  <svg className="w-4 h-4 mr-1 animate-spin" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
                  </svg>
                  保存中...
                </>
              ) : (
                <>
                  <svg className="w-4 h-4 mr-1" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 7H5a2 2 0 00-2 2v9a2 2 0 002 2h14a2 2 0 002-2V9a2 2 0 00-2-2h-3m-1 4l-3 3m0 0l-3-3m3 3V4" />
                  </svg>
                  {hasUnsavedChanges ? '保存进度' : '已保存'}
                </>
              )}
            </button>

            {/* 显示上次保存时间 */}
            {lastSavedTime > 0 && (
              <div className={`text-xs mr-4 ${showSaveSuccess ? 'text-green-600' : 'text-gray-500'}`}>
                {showSaveSuccess ? '保存成功!' : `上次保存: ${new Date(lastSavedTime).toLocaleTimeString()}`}
              </div>
            )}

            {/* 现有按钮和内容 */}
            {/* 添加试用模式下的购买和兑换按钮 */}
            {(quizStatus.isInTrialMode || (questionSet?.isPaid && !quizStatus.hasAccessToFullQuiz)) && (
              <div className="flex mr-4 space-x-2">
                <button
                  onClick={(e) => {
                    // 阻止事件冒泡
                    e.stopPropagation();
                    
                    console.log('[QuizPage] 顶部指示器点击购买按钮 - 当前时间:', new Date().toISOString());
                    
                    // 防止重复处理
                    if (quizStatus.isProcessingPayment || quizStatus.showPaymentModal) {
                      console.log('[QuizPage] 顶部指示器忽略点击 - isProcessingPayment:', quizStatus.isProcessingPayment, 'showPaymentModal:', quizStatus.showPaymentModal);
                      return;
                    }
                    
                    // 增加按钮点击视觉反馈
                    const button = e.currentTarget;
                    button.classList.add('scale-95');
                    setTimeout(() => button.classList.remove('scale-95'), 150);
                    
                    toast.info('正在准备支付...', { autoClose: 1500 });
                    
                    // 直接设置状态显示支付模态窗口
                    console.log('[QuizPage] 顶部指示器设置showPaymentModal=true');
                    setQuizStatus(prev => ({
                      ...prev,
                      showPaymentModal: true
                    }));
                  }}
                  type="button"
                  className="px-3 py-1.5 bg-gradient-to-r from-blue-600 to-blue-700 hover:from-blue-700 hover:to-blue-800 text-white text-sm rounded-md hover:shadow-md focus:outline-none transition-all transform hover:-translate-y-0.5 active:translate-y-0 active:scale-95 focus:ring-2 focus:ring-blue-400 focus:ring-offset-2 flex items-center"
                >
                  <svg className="w-4 h-4 mr-1" fill="none" stroke="currentColor" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 10h18M7 15h1m4 0h1m-7 4h12a3 3 0 003-3V8a3 3 0 00-3-3H6a3 3 0 00-3 3v8a3 3 0 003 3z" />
                  </svg>
                  购买完整版
                </button>
                <button
                  onClick={(e) => {
                    // 阻止事件冒泡
                    e.stopPropagation();
                    
                    console.log('[QuizPage] 顶部指示器点击兑换按钮 - 当前时间:', new Date().toISOString());
                    
                    // 防止重复处理
                    if (quizStatus.isProcessingRedeem || quizStatus.showRedeemCodeModal) {
                      console.log('[QuizPage] 顶部指示器忽略点击 - isProcessingRedeem:', quizStatus.isProcessingRedeem, 'showRedeemCodeModal:', quizStatus.showRedeemCodeModal);
                      return;
                    }
                    
                    // 增加按钮点击视觉反馈
                    const button = e.currentTarget;
                    button.classList.add('scale-95');
                    setTimeout(() => button.classList.remove('scale-95'), 150);
                    
                    toast.info('正在准备兑换...', { autoClose: 1500 });
                    
                    // 直接设置状态显示兑换模态窗口
                    console.log('[QuizPage] 顶部指示器设置showRedeemCodeModal=true');
                    setQuizStatus(prev => ({
                      ...prev,
                      showRedeemCodeModal: true
                    }));
                  }}
                  type="button"
                  className="px-3 py-1.5 bg-white hover:bg-green-50 text-green-700 text-sm border-2 border-green-400 rounded-md hover:shadow-md focus:outline-none transition-all transform hover:-translate-y-0.5 active:translate-y-0 active:scale-95 focus:ring-2 focus:ring-green-400 focus:ring-offset-2 flex items-center"
                >
                  <svg className="w-4 h-4 mr-1" fill="none" stroke="currentColor" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M7 7h.01M7 3h5c.512 0 1.024.195 1.414.586l7 7a2 2 0 010 2.828l-7 7a2 2 0 01-2.828 0l-7-7A1.994 1.994 0 013 12V7a4 4 0 014-4z" />
                  </svg>
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
                    setQuizStatus({ ...quizStatus, showExplanation: false });
                    setQuizStatus({ ...quizStatus, quizComplete: false });
                    
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
            {quizStatus.isTimerActive && (
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
            hasFullAccess={true} // 始终允许访问所有题目，确保流畅体验
            questionSetId={id || ''}
            isLast={currentQuestionIndex === questions.length - 1}
            trialQuestions={questionSet?.trialQuestions}
            isSubmittingAnswer={false} // 移除提交锁定
            trialLimitReached={false}  // 移除试用限制检查
          />
        )}
        
        {/* 答题卡 */}
        <AnswerCard
          totalQuestions={questions.length}
          answeredQuestions={answeredQuestions}
          currentIndex={currentQuestionIndex}
          trialLimit={questionSet?.trialQuestions}
          isTrialMode={(!quizStatus.hasAccessToFullQuiz && !quizStatus.hasRedeemed && questionSet?.isPaid) || false}
          isTrialLimitReached={isTrialLimitReached()}
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

  // 添加一个更明确的useEffect来管理试用结束和购买页面显示
  useEffect(() => {
    // 如果没有题库，不做任何处理
    if (!questionSet) return;
    
    console.log(`[QuizPage] 试用限制状态检查 - 已答题:${answeredQuestions.length}, 限制:${questionSet.trialQuestions}, 已达限制:${isTrialLimitReached()}`);
    
    // 如果是免费题库，永远不显示购买页面
    if (!isPaidQuiz(questionSet)) {
      if (quizStatus.showPurchasePage) setQuizStatus({ ...quizStatus, showPurchasePage: false });
      if (quizStatus.trialEnded) setQuizStatus({ ...quizStatus, trialEnded: false });
      return;
    }
    
    // 如果用户有完整访问权限，不显示购买页面
    if (quizStatus.hasAccessToFullQuiz || quizStatus.hasRedeemed || checkFullAccessFromAllSources(questionSet, user, quizStatus.hasRedeemed)) {
      if (quizStatus.showPurchasePage) setQuizStatus({ ...quizStatus, showPurchasePage: false });
      if (quizStatus.trialEnded) setQuizStatus({ ...quizStatus, trialEnded: false });
      return;
    }
    
    // 如果已达到试用限制，显示试用结束状态
    if (isTrialLimitReached()) {
      if (!quizStatus.trialEnded) setQuizStatus({ ...quizStatus, trialEnded: true });
      
      // 仅当试用已结束且还未显示购买页面时，显示购买页面
      // **** 修改：只有当没有其他模态窗口处于活跃状态时才显示购买页面 ****
      if (quizStatus.trialEnded && !quizStatus.showPurchasePage 
          && !quizStatus.showPaymentModal && !quizStatus.showRedeemCodeModal) {
        console.log('[QuizPage Trial Effect] 试用已结束且没有其他模态窗口活跃，显示购买页面');
        setQuizStatus({ ...quizStatus, showPurchasePage: true });
      } else if (quizStatus.trialEnded && !quizStatus.showPurchasePage) {
        console.log('[QuizPage Trial Effect] 试用已结束，但已有其他模态窗口活跃或即将打开');
      }
    } else {
      // 未达到限制时，确保状态正确
      if (quizStatus.trialEnded) setQuizStatus({ ...quizStatus, trialEnded: false });
      
      // 仅当没有其他模态窗口活跃时，隐藏购买页面
      if (quizStatus.showPurchasePage && !quizStatus.showPaymentModal && !quizStatus.showRedeemCodeModal) {
        console.log('[QuizPage Trial Effect] 未达到试用限制，隐藏购买页面');
        setQuizStatus({ ...quizStatus, showPurchasePage: false });
      }
    }
  }, [
    questionSet, 
    answeredQuestions.length, 
    quizStatus.hasAccessToFullQuiz, 
    quizStatus.hasRedeemed,
    checkFullAccessFromAllSources,
    isTrialLimitReached,
    quizStatus.trialEnded,
    quizStatus.showPurchasePage,
    quizStatus.showPaymentModal,  // 添加依赖项
    quizStatus.showRedeemCodeModal  // 添加依赖项
  ]);
  
  // 在渲染函数前添加DirectPurchaseDebugButton组件
  const DirectPurchaseDebugButton: React.FC<{questionSetId: string; price: number}> = ({ questionSetId, price }) => {
    const handleDirectPurchase = async () => {
      try {
        if (!questionSetId) return;
        toast.info('正在处理...');
        const { createDirectPurchase } = await import('../utils/paymentUtils');
        const result = await createDirectPurchase(questionSetId, price, user?.id);
        
        if (result) {
          toast.success('直接购买成功！');
          // 将题库ID添加到本地存储
          try {
            const purchasedStr = localStorage.getItem('purchasedQuestionSets') || '[]';
            const purchasedSets = JSON.parse(purchasedStr);
            if (!purchasedSets.includes(questionSetId)) {
              purchasedSets.push(questionSetId);
              localStorage.setItem('purchasedQuestionSets', JSON.stringify(purchasedSets));
            }
          } catch (e) {
            console.error('保存购买记录失败', e);
          }
          
          // 触发购买成功事件
          const purchaseEvent = new CustomEvent('purchase:success', {
            detail: {
              questionSetId: questionSetId,
              purchaseId: result.id,
              transactionId: result.transactionId
            }
          });
          window.dispatchEvent(purchaseEvent);
          
          // 刷新页面以重新验证权限
          window.location.reload();
        } else {
          toast.error('购买失败');
        }
      } catch (error) {
        console.error('直接购买失败', error);
        toast.error('购买处理时出错');
      }
    };
    
    // 检查是否显示此调试按钮
    const urlParams = new URLSearchParams(window.location.search);
    const showDebug = urlParams.get('debug') === 'true';
    
    if (!showDebug) return null;
    
    return (
      <div className="fixed bottom-24 right-4 z-50">
        <button
          onClick={handleDirectPurchase}
          disabled={quizStatus.isProcessingPayment || quizStatus.showPaymentModal}
          className="bg-red-600 hover:bg-red-700 text-white px-4 py-2 rounded-lg shadow-lg flex items-center space-x-2"
        >
          {quizStatus.isProcessingPayment ? (
            <>
              <svg className="animate-spin h-5 w-5 mr-2" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
              </svg>
              处理中...
            </>
          ) : (
            <>
              <svg className="w-5 h-5 mr-1" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 10V3L4 14h7v7l9-11h-7z" />
              </svg>
              强制购买(¥{price})
            </>
          )}
        </button>
      </div>
    );
  };
  
  // 修改渲染函数，确保PurchasePage优先显示
  return (
    <div className="min-h-screen bg-gray-50 py-8 pb-20">
      {/* 添加StyleInjector组件 */}
      <StyleInjector />
      
      {/* 添加DirectPurchaseDebugButton组件 */}
      {questionSet && <DirectPurchaseDebugButton questionSetId={questionSet.id} price={questionSet.price} />}
      
      {/* 优先显示购买页面，强制中断正常答题流程 */}
      {quizStatus.showPurchasePage && questionSet && (
        <PurchasePage 
          questionSet={questionSet}
          trialCount={answeredQuestions.length}
          isProcessing={quizStatus.isProcessingPayment || quizStatus.isProcessingRedeem}
          onPurchase={() => {
            console.log('[QuizPage] 从PurchasePage点击购买按钮 - 时间:', new Date().toISOString());
            toast.info('正在准备支付...', { autoClose: 1500 });
              setQuizStatus(prev => ({
                ...prev,
              showPurchasePage: false,
              showPaymentModal: true
              }));
          }}
          onRedeem={() => {
            console.log('[QuizPage] 从PurchasePage点击兑换按钮 - 时间:', new Date().toISOString());
            toast.info('正在准备兑换...', { autoClose: 1500 });
              setQuizStatus(prev => ({
                ...prev,
              showPurchasePage: false,
              showRedeemCodeModal: true
              }));
          }}
          onBack={() => {
            console.log('[QuizPage] 从PurchasePage点击返回按钮');
            // 首先更新状态，然后再导航
            setQuizStatus(prev => ({
              ...prev,
              showPurchasePage: false
              // 注意：不重置trialEnded，因为这只是取消购买页面但用户仍处于试用结束状态
            }));
            // 延迟一下再导航，确保状态更新完成
            setTimeout(() => navigate('/'), 100);
          }}
        />
      )}
      
      {/* 只有在不显示购买页面时才显示其他UI */}
      {!quizStatus.showPurchasePage && (
        <>
          {/* 固定在底部的购买栏 */}
          <TrialPurchaseBar />
          
          <div className="container mx-auto px-4">
            {/* 试用模式指示器 - 在页面顶部显示 */}
            {renderContent()}
          </div>
        </>
      )}

      {/* 使用实际的PaymentModal组件 */}
      {quizStatus.showPaymentModal && questionSet && (
        <PaymentModal
          isOpen={quizStatus.showPaymentModal}
          questionSet={questionSet as any} 
          onClose={() => {
            console.log('[QuizPage] 关闭支付模态窗口');
            setQuizStatus(prev => ({
              ...prev,
              showPaymentModal: false,
              // 如果试用已结束且未成功购买，恢复购买页面
              showPurchasePage: prev.trialEnded ? true : false
            }));
          }}
          onSuccess={(purchaseInfo) => {
            console.log('[QuizPage] 支付成功，触发自定义事件', purchaseInfo);
            // 关闭支付模态窗口
            setQuizStatus(prev => ({
              ...prev,
              showPaymentModal: false,
              hasAccessToFullQuiz: true
            }));
            
            // 题库ID
            const qsId = purchaseInfo.questionSetId;
            
            // 触发购买成功事件
            const customEvent = new CustomEvent('purchase:success', {
              detail: {
                questionSetId: qsId,
                purchaseId: `purchase_${Date.now()}`,
                expiryDate: new Date(Date.now() + 180*24*60*60*1000).toISOString() // 6个月
              }
            });
            document.dispatchEvent(customEvent);
            
            // 显示成功提示
            toast.success('购买成功！现在可以查看完整题库', { autoClose: 3000 });

            // 保存访问权限到本地存储
            saveAccessToLocalStorage(qsId, true);
          }}
        />
      )}

      {/* 使用实际的RedeemCodeModal组件 */}
      {quizStatus.showRedeemCodeModal && questionSet && (
        <RedeemCodeModal
          questionSet={questionSet}
          onClose={() => {
            console.log('[QuizPage] 关闭兑换码模态窗口');
            setQuizStatus(prev => ({
              ...prev,
              showRedeemCodeModal: false,
              // 如果试用已结束且未成功兑换，恢复购买页面
              showPurchasePage: prev.trialEnded ? true : false
            }));
          }}
          onRedeemSuccess={() => {
            console.log('[QuizPage] 兑换成功，更新状态');
            // 关闭兑换模态窗口
            setQuizStatus(prev => ({
              ...prev,
              showRedeemCodeModal: false,
              hasRedeemed: true
            }));
            
            // 触发兑换成功事件
            const customEvent = new CustomEvent('redeem:success', {
              detail: {
                questionSetId: questionSet.id,
                forceRefresh: true
              }
            });
            document.dispatchEvent(customEvent);
            
            // 显示成功提示
            toast.success('兑换成功！现在可以查看完整题库', { autoClose: 3000 });
          }}
        />
      )}
    </div>
  );
}

export default QuizPage; 
