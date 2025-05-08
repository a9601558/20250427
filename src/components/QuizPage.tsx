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
  
  // 添加点击状态和动画状态
  const [btnStates, setBtnStates] = useState({
    purchase: { clicked: false, hovered: false },
    redeem: { clicked: false, hovered: false },
    back: { clicked: false, hovered: false }
  });
  
  // 处理购买按钮点击
  const handlePurchaseClick = (e: React.MouseEvent) => {
    // 阻止事件冒泡
    e.stopPropagation();
    
    console.log('[PurchasePage] 立即购买按钮被点击 - 当前时间:', new Date().toISOString());
    
    // 防止重复点击和处理中状态下点击
    if (isProcessing || btnStates.purchase.clicked) {
      console.log('[PurchasePage] 忽略点击 - isProcessing:', isProcessing, 'clicked:', btnStates.purchase.clicked);
      return;
    }
    
    // 立即更新UI状态提供反馈
    setBtnStates(prev => ({
      ...prev,
      purchase: { ...prev.purchase, clicked: true }
    }));
    
    // 显示loading提示
    toast.info('正在准备支付界面...', { 
      autoClose: 1000,
      position: 'top-center',
      hideProgressBar: false
    });
    
    // 直接执行回调，减少不必要的延时
    try {
      console.log('[PurchasePage] 调用onPurchase回调');
      if (typeof onPurchase === 'function') {
        onPurchase();
      } else {
        console.error('[PurchasePage] onPurchase不是一个函数');
        toast.error('支付功能暂时不可用，请稍后再试');
      }
    } catch (err) {
      console.error('[PurchasePage] 执行购买回调出错:', err);
      toast.error('处理购买请求时出错，请重试');
    }
    
    // 300ms后重置按钮状态
    setTimeout(() => {
      setBtnStates(prev => ({
        ...prev,
        purchase: { ...prev.purchase, clicked: false }
      }));
    }, 300);
  };
  
  // 处理兑换按钮点击
  const handleRedeemClick = (e: React.MouseEvent) => {
    // 阻止事件冒泡
    e.stopPropagation();
    
    console.log('[PurchasePage] 使用兑换码按钮被点击 - 当前时间:', new Date().toISOString());
    
    // 防止重复点击和处理中状态下点击
    if (isProcessing || btnStates.redeem.clicked) {
      console.log('[PurchasePage] 忽略点击 - isProcessing:', isProcessing, 'clicked:', btnStates.redeem.clicked);
      return;
    }
    
    // 立即更新UI状态提供反馈
    setBtnStates(prev => ({
      ...prev,
      redeem: { ...prev.redeem, clicked: true }
    }));
    
    // 显示loading提示
    toast.info('正在准备兑换界面...', { 
      autoClose: 1000,
      position: 'top-center',
      hideProgressBar: false
    });
    
    // 直接执行回调，减少不必要的延时
    try {
      console.log('[PurchasePage] 调用onRedeem回调');
      if (typeof onRedeem === 'function') {
        onRedeem();
      } else {
        console.error('[PurchasePage] onRedeem不是一个函数');
        toast.error('兑换功能暂时不可用，请稍后再试');
      }
    } catch (err) {
      console.error('[PurchasePage] 执行兑换回调出错:', err);
      toast.error('处理兑换请求时出错，请重试');
    }
    
    // 300ms后重置按钮状态
    setTimeout(() => {
      setBtnStates(prev => ({
        ...prev,
        redeem: { ...prev.redeem, clicked: false }
      }));
    }, 300);
  };
  
  // 处理返回按钮点击
  const handleBackClick = (e: React.MouseEvent) => {
    // 阻止事件冒泡
    e.stopPropagation();
    
    console.log('[PurchasePage] 返回首页按钮被点击 - 当前时间:', new Date().toISOString());
    
    // 防止重复点击和处理中状态下点击
    if (isProcessing || btnStates.back.clicked) {
      console.log('[PurchasePage] 忽略点击 - isProcessing:', isProcessing, 'clicked:', btnStates.back.clicked);
      return;
    }
    
    // 立即更新UI状态提供反馈
    setBtnStates(prev => ({
      ...prev,
      back: { ...prev.back, clicked: true }
    }));
    
    // 显示toast提示
    toast.info('正在返回首页...', { 
      autoClose: 1000,
      position: 'top-center'
    });
    
    // 直接执行回调，减少不必要的延时
    try {
      console.log('[PurchasePage] 调用onBack回调');
      if (typeof onBack === 'function') {
        onBack();
      } else {
        console.error('[PurchasePage] onBack不是一个函数');
        toast.error('暂时无法返回，请刷新页面');
      }
    } catch (err) {
      console.error('[PurchasePage] 执行返回回调出错:', err);
    } finally {
      // 重置按钮状态
      setTimeout(() => {
        setBtnStates(prev => ({
          ...prev,
          back: { ...prev.back, clicked: false }
        }));
      }, 300);
    }
  };
  
  return (
    <div className="fixed inset-0 bg-gray-800 bg-opacity-95 z-50 flex items-center justify-center p-4">
      <div className="bg-white rounded-xl shadow-xl max-w-lg w-full mx-4 p-6 relative overflow-hidden">
        {/* 处理中状态遮罩 */}
        {isProcessing && (
          <div className="absolute inset-0 bg-white bg-opacity-80 flex flex-col items-center justify-center z-10">
            <div className="w-16 h-16 border-t-4 border-blue-500 border-solid rounded-full animate-spin mb-3"></div>
            <p className="text-blue-600 font-semibold">正在处理，请稍候...</p>
          </div>
        )}
        
        {/* 顶部图标和标题 */}
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
        
        {/* 题库信息卡片 */}
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
        
        {/* 操作按钮区 */}
        <div className="space-y-4 mb-6">
          {/* 购买按钮 */}
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
            {/* 波纹效果层 */}
            {btnStates.purchase.clicked && (
              <span className="absolute inset-0 bg-white opacity-30 rounded-lg animate-ripple"></span>
            )}
            
            {/* 按钮内容 */}
            <svg className="w-5 h-5 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 10h18M7 15h1m4 0h1m-7 4h12a3 3 0 003-3V8a3 3 0 00-3-3H6a3 3 0 00-3 3v8a3 3 0 003 3z" />
            </svg>
            <span className="mr-2">立即购买完整版</span>
            
            {/* 右箭头图标 */}
            <svg className="w-4 h-4 ml-1 transform group-hover:translate-x-1 transition-transform" fill="none" stroke="currentColor" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M14 5l7 7m0 0l-7 7m7-7H3" />
            </svg>
          </button>
          
          {/* 分隔线 */}
          <div className="flex items-center">
            <div className="flex-grow border-t border-gray-200"></div>
            <span className="mx-4 text-sm text-gray-500">或者</span>
            <div className="flex-grow border-t border-gray-200"></div>
          </div>
          
          {/* 兑换按钮 */}
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
            {/* 波纹效果层 */}
            {btnStates.redeem.clicked && (
              <span className="absolute inset-0 bg-green-500 opacity-10 rounded-lg animate-ripple"></span>
            )}
            
            {/* 按钮内容 */}
            <svg className="w-5 h-5 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M7 7h.01M7 3h5c.512 0 1.024.195 1.414.586l7 7a2 2 0 010 2.828l-7 7a2 2 0 01-2.828 0l-7-7A1.994 1.994 0 013 12V7a4 4 0 014-4z" />
            </svg>
            <span className="mr-2">使用兑换码解锁</span>
            
            {/* 右箭头图标 */}
            <svg className="w-4 h-4 ml-1 transform group-hover:translate-x-1 transition-transform" fill="none" stroke="currentColor" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M14 5l7 7m0 0l-7 7m7-7H3" />
            </svg>
          </button>
          
          {/* 返回按钮 */}
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
        
        {/* 底部信息提示 */}
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
  const [error, setError] = useState<string | null>(null);
  const [btnClicked, setBtnClicked] = useState(false);
  
  const handlePurchase = async () => {
    if (!user || !questionSet) return;
    
    setIsProcessing(true);
    setError(null);
    setBtnClicked(true);
    
    try {
      console.log('[PaymentModal] 开始处理Stripe支付');
      // 调用购买API，使用Stripe支付方式
      const response = await purchaseService.createPurchase(
        questionSet.id,
        'stripe', // 直接使用stripe作为支付方式
        questionSet.price
      );
      
      if (response.success && response.data) {
        console.log('[PaymentModal] 购买成功:', response.data);
        toast.success('购买成功！您现在可以访问完整题库');
        onSuccess(response.data);
      } else {
        console.error('[PaymentModal] 购买失败:', response);
        setError(response.message || '购买失败，请稍后再试');
        setIsProcessing(false);
        setBtnClicked(false);
      }
    } catch (err) {
      console.error('[PaymentModal] 购买出错:', err);
      setError('购买过程中出现错误，请稍后再试');
      setIsProcessing(false);
      setBtnClicked(false);
    }
  };
  
  const handleCloseClick = () => {
    if (isProcessing) return; // 如果正在处理，不允许关闭
    onClose();
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
          onClick={handleCloseClick}
          disabled={isProcessing}
          className="absolute top-4 right-4 text-gray-400 hover:text-gray-600 disabled:opacity-50"
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
          <div className="bg-blue-50 p-4 rounded-lg">
            <div className="flex items-center">
              <div className="flex-shrink-0 mr-3">
                <svg className="w-7 h-7 text-blue-600" viewBox="0 0 24 24" fill="currentColor">
                  <path d="M12 0C5.383 0 0 5.383 0 12s5.383 12 12 12 12-5.383 12-12S18.617 0 12 0z" fill="#6772E5"/>
                  <path d="M13.5 9.17c0-.59.177-1.067.532-1.434.354-.367.864-.55 1.531-.55.396 0 .74.066 1.036.2.295.133.516.317.661.55.146.233.218.492.218.775 0 .375-.1.695-.304.958-.204.263-.5.492-.889.683-.39.192-.927.392-1.615.6-.872.267-1.583.592-2.132.975-.55.383-.958.825-1.226 1.325-.268.5-.402 1.084-.402 1.75 0 .692.147 1.3.44 1.825.293.525.714.933 1.264 1.225.55.292 1.2.438 1.95.438.725 0 1.359-.15 1.9-.45.542-.3.959-.717 1.25-1.25.292-.533.438-1.142.438-1.825H16.8c0 .658-.186 1.167-.557 1.525-.372.358-.923.537-1.655.537-.683 0-1.214-.158-1.593-.475-.38-.317-.57-.75-.57-1.3 0-.35.114-.65.342-.9.228-.25.538-.467.93-.65.393-.183.876-.365 1.449-.545 1.036-.33 1.84-.654 2.413-.975.571-.32 1.003-.695 1.294-1.125.292-.43.438-.95.438-1.563 0-.675-.162-1.283-.487-1.825-.325-.542-.787-.967-1.386-1.275-.6-.308-1.303-.462-2.107-.462-.867 0-1.625.163-2.275.487-.65.325-1.153.775-1.506 1.35-.354.575-.531 1.234-.531 1.976h1.5c0-.592.178-1.08.532-1.467z" fill="#fff"/>
                </svg>
              </div>
              <div>
                <p className="font-medium text-gray-900">Stripe 安全支付</p>
                <p className="text-xs text-gray-600">使用安全的Stripe支付处理</p>
              </div>
            </div>
          </div>
        </div>
        
        <button
          onClick={handlePurchase}
          disabled={isProcessing}
          className={`w-full py-3.5 ${btnClicked ? 'bg-blue-800' : 'bg-gradient-to-r from-blue-600 to-blue-700 hover:from-blue-700 hover:to-blue-800'} text-white rounded-lg font-medium transition flex items-center justify-center shadow-md hover:shadow-lg transform hover:-translate-y-0.5 disabled:opacity-70 disabled:transform-none disabled:shadow-none disabled:cursor-not-allowed active:bg-blue-800`}
        >
          <svg className="w-5 h-5 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
          </svg>
          {isProcessing ? '处理中...' : '确认购买'}
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
  const [btnClicked, setBtnClicked] = useState(false);
  
  const handleRedeem = async () => {
    if (!code.trim()) {
      setError('请输入有效的兑换码');
      return;
    }
    
    setIsProcessing(true);
    setError(null);
    setBtnClicked(true);
    
    try {
      console.log('[RedeemCodeModal] 开始处理兑换码:', code.trim());
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
        setBtnClicked(false);
      }
    } catch (err) {
      console.error('[RedeemCodeModal] 兑换出错:', err);
      setError('兑换过程中出现错误，请稍后再试');
      setIsProcessing(false);
      setBtnClicked(false);
    }
  };
  
  const handleCloseClick = () => {
    if (isProcessing) return; // 如果正在处理，不允许关闭
    onClose();
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
          onClick={handleCloseClick}
          disabled={isProcessing}
          className="absolute top-4 right-4 text-gray-400 hover:text-gray-600 disabled:opacity-50"
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
          className={`w-full py-3.5 ${btnClicked ? 'bg-green-800' : 'bg-gradient-to-r from-green-600 to-green-700 hover:from-green-700 hover:to-green-800'} text-white rounded-lg font-medium transition flex items-center justify-center shadow-md hover:shadow-lg transform hover:-translate-y-0.5 disabled:opacity-70 disabled:transform-none disabled:shadow-none disabled:cursor-not-allowed active:bg-green-800`}
        >
          <svg className="w-5 h-5 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
          </svg>
          {isProcessing ? '处理中...' : '确认兑换'}
        </button>
        
        <p className="text-xs text-center text-gray-500 mt-4">
          兑换码仅可使用一次，请勿泄露给他人
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

function QuizPage(): JSX.Element {
  const { questionSetId } = useParams<{ questionSetId: string }>();
  const navigate = useNavigate();
  const location = useLocation();
  const { user, hasAccessToQuestionSet, syncAccessRights, updateUser } = useUser();
  const { socket } = useSocket() as { socket: Socket | null };
  const { fetchUserProgress } = useUserProgress();
  
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
        if (questionSetId) {
          // 保留当前题库的权限，后续会重新检查
          if (accessRights && accessRights[questionSetId]) {
            newAccessRights[questionSetId] = accessRights[questionSetId];
          }
        }
        
        // 保存清理后的权限数据
        localStorage.setItem('quizAccessRights', JSON.stringify(newAccessRights));
      }
    } catch (e) {
      console.error('[QuizPage] 清除权限缓存出错:', e);
    }
  }, [questionSetId]);
  
  // 修改保存权限函数，确保准确保存
  const saveAccessToLocalStorage = useCallback((questionSetId: string, hasAccess: boolean) => {
    if (!questionSetId) return;
    
    try {
      const normalizedId = String(questionSetId).trim();
      console.log(`[QuizPage] 保存题库 ${normalizedId} 的访问权限: ${hasAccess}`);
      
      // 获取当前访问权限列表
      const accessRightsStr = localStorage.getItem('quizAccessRights');
      let accessRights: AccessRights = {};
      
      if (accessRightsStr) {
        try {
          const parsed = JSON.parse(accessRightsStr);
          if (parsed && typeof parsed === 'object') {
            accessRights = parsed as AccessRights;
          } else {
            console.error('[QuizPage] 访问权限记录格式错误，重新创建');
          }
        } catch (e) {
          console.error('[QuizPage] 解析访问权限记录失败，将创建新记录', e);
        }
      }
      
      // 更新访问权限 - 使用精确ID匹配
      accessRights[normalizedId] = hasAccess;
      
      // 记录修改时间，便于后续清理过期数据
      const timestamp = Date.now();
      const accessRightsWithMeta: AccessRights = {
        ...accessRights,
        [`${normalizedId}_timestamp`]: timestamp
      };
      
      // 保存回localStorage
      localStorage.setItem('quizAccessRights', JSON.stringify(accessRightsWithMeta));
      console.log(`[QuizPage] 已保存题库 ${normalizedId} 的访问权限: ${hasAccess}`);
      
      // 记录检查日志，便于调试
      const accessLog = localStorage.getItem('accessRightsLog') || '[]';
      try {
        const logEntries = JSON.parse(accessLog);
        logEntries.push({
          id: normalizedId,
          access: hasAccess,
          timestamp
        });
        // 只保留最近50条记录
        const recentEntries = logEntries.slice(-50);
        localStorage.setItem('accessRightsLog', JSON.stringify(recentEntries));
      } catch (e) {
        console.error('[QuizPage] 保存访问日志失败', e);
      }
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
      
      const accessRights = JSON.parse(accessRightsStr) as AccessRights;
      const hasAccess = !!accessRights[normalizedId];
      
      console.log(`[QuizPage] 题库 ${normalizedId} 的本地存储访问权限: ${hasAccess}`);
      return hasAccess;
    } catch (e) {
      console.error('[QuizPage] 获取访问权限失败', e);
      return false;
    }
  }, []);

  // 完全重写检查权限函数，修复ID匹配和权限检查逻辑
  const checkFullAccessFromAllSources = useCallback(() => {
    if (!questionSet || !questionSet.id) {
      console.log('[QuizPage] 检查访问权限：无题库ID，返回false');
      return false;
    }
    
    // 标准化当前题库ID，确保精确匹配
    const questionSetId = String(questionSet.id).trim();
    console.log(`[QuizPage] 检查题库ID "${questionSetId}" 的访问权限`);
    
    // 步骤1：免费题库检查（最高优先级）
    if (!questionSet.isPaid) {
      console.log('[QuizPage] 免费题库，直接返回true');
      return true;
    }
    
    // 步骤2：检查用户购买记录
    if (user && user.purchases && Array.isArray(user.purchases)) {
      console.log(`[QuizPage] 检查用户购买记录，共${user.purchases.length}条`);
      
      // 严格匹配购买记录中的题库ID
      const purchase = user.purchases.find(p => {
        // 确保有效的questionSetId
        if (!p.questionSetId) return false;
        
        // 严格匹配，不允许部分匹配
        const purchaseId = String(p.questionSetId).trim();
        const isExactMatch = purchaseId === questionSetId;
        
        if (isExactMatch) {
          console.log(`[QuizPage] 找到购买记录匹配: ID=${p.id}, 状态=${p.status}`);
        }
        
        return isExactMatch;
      });
      
      if (purchase) {
        // 检查购买记录是否有效（未过期且状态正确）
        const now = new Date();
        const expiryDate = purchase.expiryDate ? new Date(purchase.expiryDate) : null;
        const isExpired = expiryDate && expiryDate <= now;
        
        // 仅接受明确的active或completed状态
        const validStates = ['active', 'completed', 'success'];
        const isActive = validStates.includes(purchase.status || '');
        
        const purchaseHasAccess = !isExpired && isActive;
        
        console.log(`[QuizPage] 购买记录检查: 已过期=${isExpired}, 状态有效=${isActive}, 最终结果=${purchaseHasAccess}`);
        
        if (purchaseHasAccess) {
          return true;
        }
      } else {
        console.log(`[QuizPage] 未找到匹配的购买记录`);
      }
    }
    
    // 步骤3：检查本地存储的兑换记录
    try {
      const redeemedStr = localStorage.getItem('redeemedQuestionSetIds');
      if (redeemedStr) {
        const redeemedIds = JSON.parse(redeemedStr);
        
        if (Array.isArray(redeemedIds)) {
          // 只检查完全匹配，不再支持部分匹配
          const isRedeemed = redeemedIds.some(id => String(id || '').trim() === questionSetId);
          
          console.log(`[QuizPage] 本地兑换检查: ${isRedeemed}`);
          
          if (isRedeemed) {
            return true;
          }
        }
      }
    } catch (e) {
      console.error('[QuizPage] 检查兑换记录出错:', e);
    }
    
    // 步骤4：检查本地存储的访问权限记录
    try {
      const accessRightsStr = localStorage.getItem('quizAccessRights');
      if (accessRightsStr) {
        const accessRights = JSON.parse(accessRightsStr) as AccessRights;
        
        // 确保只检查精确匹配的权限
        if (accessRights && accessRights[questionSetId] === true) {
          console.log(`[QuizPage] 本地访问权限检查: true`);
          return true;
        }
      }
    } catch (e) {
      console.error('[QuizPage] 检查本地访问权限出错:', e);
    }
    
    // 步骤5：检查其他状态变量
    if (quizStatus.hasAccessToFullQuiz || quizStatus.hasRedeemed) {
      console.log(`[QuizPage] 内部状态检查: hasAccessToFullQuiz=${quizStatus.hasAccessToFullQuiz}, hasRedeemed=${quizStatus.hasRedeemed}`);
      return true;
    }
    
    // 步骤6：如果所有检查都未通过，返回false
    console.log(`[QuizPage] 所有权限检查均未通过，返回false`);
    return false;
  }, [questionSet, user, quizStatus.hasAccessToFullQuiz, quizStatus.hasRedeemed]);

  // 修改checkAccess函数，严格检查每个权限来源
  const checkAccess = async () => {
    if (!questionSet) return;
    
    console.log(`[checkAccess] 开始检查题库 ${questionSet.id} 的访问权限`);
    
    // 免费题库直接授权
    if (!questionSet.isPaid) {
      console.log(`[checkAccess] 免费题库，直接授予访问权限`);
      setQuizStatus({ ...quizStatus, hasAccessToFullQuiz: true });
      saveAccessToLocalStorage(questionSet.id, true);
      setQuizStatus({ ...quizStatus, trialEnded: false });
      setQuizStatus({ ...quizStatus, showPurchasePage: false });
      return;
    }
    
    // 清除可能的缓存状态，强制重新检查
    localStorage.removeItem(`quiz_access_check_${questionSet.id}`);
    
    // 重新全面检查权限
    const hasFullAccess = checkFullAccessFromAllSources();
    console.log(`[checkAccess] 重新检查权限: ${hasFullAccess}`);
    
    // 更新访问权限状态
    setQuizStatus({ ...quizStatus, hasAccessToFullQuiz: hasFullAccess });
    
    // 根据检查结果更新本地存储
    if (hasFullAccess) {
      console.log(`[checkAccess] 用户有访问权限，保存到本地缓存并重置试用结束状态`);
      saveAccessToLocalStorage(questionSet.id, true);
      setQuizStatus({ ...quizStatus, trialEnded: false });
      setQuizStatus({ ...quizStatus, showPurchasePage: false });
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
    if (questionSet && !questionSet.isPaid) {
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
    if (!questionSet.isPaid) {
      console.log(`[QuizPage] 免费题库不存在试用结束概念`);
      if (quizStatus.trialEnded) setQuizStatus({ ...quizStatus, trialEnded: false });
      if (quizStatus.showPurchasePage) setQuizStatus({ ...quizStatus, showPurchasePage: false });
      return;
    }
    
    // 重新检查完整访问权限
    const hasFullAccess = checkFullAccessFromAllSources();
    
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
    if (!questionSetId) return;
    
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
        
        // 获取题库详情
        const response = await questionSetApi.getQuestionSetById(questionSetId);
        
        if (response.success && response.data) {
          // 更新明确的试用模式状态
          setQuizStatus({ ...quizStatus, isInTrialMode: isExplicitTrialMode });
          
          // 改进对试用题目数量的确定逻辑
          const trialQuestionsFromApi = response.data.trialQuestions;
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
              determinedTrialCount = response.data.isPaid ? 1 : 0;
            }
            console.log(`[QuizPage] 非显式试用模式 (isPaid: ${response.data.isPaid})，试用题数: ${determinedTrialCount}`);
          }
          
          // 确保 determinedTrialCount 不为负
          if (determinedTrialCount < 0) determinedTrialCount = 0;
          
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
            trialQuestions: determinedTrialCount,
            questionCount: getQuestions(response.data).length,
            createdAt: new Date(),
            updatedAt: new Date()
          };
          
          console.log(`[QuizPage] 题库数据处理: isPaid=${questionSetData.isPaid}, trialQuestions=${questionSetData.trialQuestions}`);
          
          setQuestionSet(questionSetData);
          
          // 免费题库直接授予访问权限，不显示购买页面
          if (!questionSetData.isPaid) {
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
            if (questionSetData.isPaid) {
              setQuizStatus({ ...quizStatus, hasAccessToFullQuiz: false });
              setQuizStatus({ ...quizStatus, hasRedeemed: false });
              // 重要：确保刚进入时不会显示试用结束状态
              setQuizStatus({ ...quizStatus, trialEnded: false });
              setQuizStatus({ ...quizStatus, showPaymentModal: false }); 
              setQuizStatus({ ...quizStatus, showPurchasePage: false }); // 确保不立即显示购买页面
              
              // 更新文档标题
              document.title = `${questionSetData.title} (试用模式) - 答题系统`;
              
              // 保存试用模式状态
              sessionStorage.setItem(`quiz_${questionSetId}_trial_mode`, 'true');
              if (determinedTrialCount > 0) {
                sessionStorage.setItem(`quiz_${questionSetId}_trial_limit`, String(determinedTrialCount));
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
  }, [questionSetId, socket, user]);
  
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
      if (data.questionSetId === questionSetId) {
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
        const localProgressKey = `quiz_progress_${questionSetId}`;
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
  }, [socket, user?.id, questionSetId]);
  
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
        setQuizStatus({ ...quizStatus, hasAccessToFullQuiz: true });
        setQuizStatus({ ...quizStatus, trialEnded: false });
        
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
        setQuizStatus({ ...quizStatus, hasAccessToFullQuiz: true });
        setQuizStatus({ ...quizStatus, trialEnded: false });
        setQuizStatus({ ...quizStatus, hasRedeemed: true });
        
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
  
  // 修改syncProgressToServer函数为手动保存函数
  const saveProgressManually = useCallback(async () => {
    if (!user?.id || !questionSetId || !socket) {
      toast.error('保存失败，请确认您已登录');
      return;
    }
    
    setIsSaving(true);
    
    try {
      console.log('[QuizPage] 开始手动保存进度数据');
      
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
        const localProgressKey = `quiz_progress_${questionSetId}`;
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
  }, [user?.id, questionSetId, socket, currentQuestionIndex, answeredQuestions, quizTotalTime, correctAnswers, questions.length]);
  
  // 修改handleAnswerSubmit函数，不再自动同步，移除阻塞行为
  const handleAnswerSubmit = useCallback(async (
    selectedOption: string | string[], 
    isCorrect: boolean, 
    question: Question,
    questionIndex: number
  ) => {
    console.log(`[QuizPage] handleAnswerSubmit: 开始处理答案提交 - 题目ID=${question.id}, 索引=${questionIndex}`);
    
    try {
      if (!questionSetId || !question.id) {
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
        const localProgressKey = `quiz_progress_${questionSetId}`;
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
    questionSetId, 
    questionStartTime, 
    questions.length, 
    questionSet
  ]);
  
  // 添加一个新的函数来集中管理试用限制逻辑
  const isTrialLimitReached = useCallback((): boolean => {
    if (!questionSet) return false;
    
    // 如果不是付费题库，永远不会达到限制
    if (!questionSet.isPaid) return false;
    
    // 如果用户有完整访问权限，永远不会达到限制
    if (checkFullAccessFromAllSources()) return false;
    
    // 检查是否已达到试用题目数量
    const trialLimit = questionSet.trialQuestions || 0;
    const answeredCount = answeredQuestions.length;
    
    console.log(`[QuizPage] 检查试用限制: 已答题=${answeredCount}, 限制=${trialLimit}`);
    
    // 已达到或超过试用限制
    return answeredCount >= trialLimit;
  }, [answeredQuestions.length, questionSet, checkFullAccessFromAllSources]);

  // 添加一个函数专门控制是否可以访问特定题目索引
  const canAccessQuestion = useCallback((questionIndex: number): boolean => {
    // 所有题目都应该可以访问，确保流畅的用户体验
    return true;
  }, []);
  
  // 修改处理答案提交的函数，确保模态窗口显示
  const handleAnswerSubmitAdapter = useCallback((isCorrect: boolean, selectedOption: string | string[]) => {
    console.log(`[QuizPage] handleAnswerSubmitAdapter 被调用 - isCorrect=${isCorrect}`);
    
    // 使用集中的访问权限检查
    const hasFullAccess = checkFullAccessFromAllSources();
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
              if (!checkFullAccessFromAllSources()) {
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
    questionSetId, 
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
    if (!questionSet?.isPaid || quizStatus.hasAccessToFullQuiz || quizStatus.hasRedeemed) {
      // 对于已购买或已兑换的题库，显示有效期信息而不是购买栏
      if (questionSet?.isPaid && (quizStatus.hasAccessToFullQuiz || quizStatus.hasRedeemed)) {
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
        
        if (!questionSet.isPaid) {
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
              {questionSet?.isPaid && !quizStatus.hasAccessToFullQuiz && !quizStatus.hasRedeemed && (
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
            questionSetId={questionSetId || ''}
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
    if (!questionSet.isPaid) {
      if (quizStatus.showPurchasePage) setQuizStatus({ ...quizStatus, showPurchasePage: false });
      if (quizStatus.trialEnded) setQuizStatus({ ...quizStatus, trialEnded: false });
      return;
    }
    
    // 如果用户有完整访问权限，不显示购买页面
    if (quizStatus.hasAccessToFullQuiz || quizStatus.hasRedeemed || checkFullAccessFromAllSources()) {
      if (quizStatus.showPurchasePage) setQuizStatus({ ...quizStatus, showPurchasePage: false });
      if (quizStatus.trialEnded) setQuizStatus({ ...quizStatus, trialEnded: false });
      return;
    }
    
    // 如果已达到试用限制，显示试用结束状态
    if (isTrialLimitReached()) {
      if (!quizStatus.trialEnded) setQuizStatus({ ...quizStatus, trialEnded: true });
      
      // 仅当试用已结束且还未显示购买页面时，显示购买页面
      if (quizStatus.trialEnded && !quizStatus.showPurchasePage) {
        console.log('[QuizPage] 试用已结束，显示购买页面');
        setQuizStatus({ ...quizStatus, showPurchasePage: true });
      }
    } else {
      // 未达到限制时，确保状态正确
      if (quizStatus.trialEnded) setQuizStatus({ ...quizStatus, trialEnded: false });
      if (quizStatus.showPurchasePage) setQuizStatus({ ...quizStatus, showPurchasePage: false });
    }
  }, [
    questionSet, 
    answeredQuestions.length, 
    quizStatus.hasAccessToFullQuiz, 
    quizStatus.hasRedeemed,
    checkFullAccessFromAllSources,
    isTrialLimitReached,
    quizStatus.trialEnded,
    quizStatus.showPurchasePage
  ]);
  
  // 修改渲染函数，确保PurchasePage优先显示
  return (
    <div className="min-h-screen bg-gray-50 py-8 pb-20">
      {/* 添加StyleInjector组件 */}
      <StyleInjector />
      
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
            setQuizStatus(prev => ({
              ...prev,
              showPurchasePage: false,
              trialEnded: false
            }));
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
            {quizStatus.isInTrialMode && questionSet?.isPaid && !quizStatus.hasAccessToFullQuiz && !quizStatus.hasRedeemed && (
              <div className="bg-yellow-50 border-l-4 border-yellow-400 p-4 mb-6 rounded shadow-sm">
                <div className="flex items-center">
                  <div className="flex-shrink-0">
                    <svg className="h-5 w-5 text-yellow-400" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20" fill="currentColor">
                      <path fillRule="evenodd" d="M18 10a8 8 0 11-16 0 8 8 0 0116 0zm-7-4a1 1 0 11-2 0 1 1 0 012 0zM9 9a1 1 0 000 2v3a1 1 0 001 1h1a1 1 0 100-2v-3a1 1 0 00-1-1H9z" clipRule="evenodd" />
                    </svg>
                  </div>
                  <div className="ml-3">
                    <p className="text-sm text-yellow-700">
                      <span className="font-medium">试用模式</span> - 您可以免费回答 {questionSet?.trialQuestions} 道题目（已回答 {answeredQuestions.length} 题）
                    </p>
                  </div>
                  <div className="ml-auto flex space-x-2">
                    <button
                      onClick={(e) => {
                        e.stopPropagation();
                        console.log('[QuizPage] 顶部指示器点击购买按钮 - 当前时间:', new Date().toISOString());
                        if (quizStatus.isProcessingPayment || quizStatus.showPaymentModal) {
                          console.log('[QuizPage] 顶部指示器忽略点击 - isProcessingPayment:', quizStatus.isProcessingPayment, 'showPaymentModal:', quizStatus.showPaymentModal);
                          return;
                        }
                        const button = e.currentTarget;
                        button.classList.add('scale-95');
                        setTimeout(() => button.classList.remove('scale-95'), 150);
                        toast.info('正在准备支付...', { autoClose: 1500 });
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
                        e.stopPropagation();
                        console.log('[QuizPage] 顶部指示器点击兑换按钮 - 当前时间:', new Date().toISOString());
                        if (quizStatus.isProcessingRedeem || quizStatus.showRedeemCodeModal) {
                          console.log('[QuizPage] 顶部指示器忽略点击 - isProcessingRedeem:', quizStatus.isProcessingRedeem, 'showRedeemCodeModal:', quizStatus.showRedeemCodeModal);
                          return;
                        }
                        const button = e.currentTarget;
                        button.classList.add('scale-95');
                        setTimeout(() => button.classList.remove('scale-95'), 150);
                        toast.info('正在准备兑换...', { autoClose: 1500 });
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
                </div>
              </div>
            )}
            
            {renderContent()}
            
            {/* 支付模态窗口 */}
            {quizStatus.showPaymentModal && questionSet && (
              <div
                className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4"
                onClick={(e) => {
                  if (e.target === e.currentTarget && !quizStatus.isProcessingPayment) {
                    console.log('[QuizPage] 支付模态窗口背景点击关闭');
                    setQuizStatus(prev => ({
                      ...prev,
                      showPaymentModal: false
                    }));
                  }
                }}
              >
                <div className="bg-white rounded-lg shadow-xl w-full max-w-md p-6 transform transition-all">
                  <div className="flex justify-between items-center mb-4">
                    <h3 className="text-xl font-bold text-gray-900">支付购买</h3>
                    {!quizStatus.isProcessingPayment && (
                      <button
                        onClick={(e) => {
                          e.stopPropagation();
                          console.log('[QuizPage] 关闭支付模态窗口');
                          setQuizStatus(prev => ({
                            ...prev,
                            showPaymentModal: false
                          }));
                        }}
                        type="button"
                        className="text-gray-400 hover:text-gray-500 focus:outline-none"
                      >
                        <svg className="h-6 w-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M6 18L18 6M6 6l12 12" />
                        </svg>
                      </button>
                    )}
                  </div>
                  
                  <div className="mb-4">
                    <p className="text-sm text-gray-500 mb-2">您正在购买:</p>
                    <div className="border rounded-lg p-3 bg-blue-50">
                      <p className="font-medium text-gray-900">{questionSet.title}</p>
                      <p className="text-sm text-gray-600">{questionSet.questionCount} 道题目</p>
                      <div className="flex justify-between items-center mt-2">
                        <span className="text-blue-600 font-bold">¥{questionSet.price || 0}</span>
                        <span className="text-xs text-green-600 bg-green-100 px-2 py-1 rounded-full">一次付费永久使用</span>
                      </div>
                    </div>
                  </div>
                  
                  {/* Stripe支付按钮 */}
                  <button
                    onClick={(e) => {
                      e.stopPropagation();
                      console.log('[QuizPage] 点击Stripe支付按钮');
                      setQuizStatus(prev => ({
                        ...prev,
                        isProcessingPayment: true
                      }));
                      toast.info('正在处理支付请求...', { autoClose: 1500 });
                      setTimeout(() => {
                        console.log('[QuizPage] 支付处理完成');
                        toast.success('支付成功！已解锁完整试题', { autoClose: 3000 });
                        setQuizStatus(prev => ({
                          ...prev,
                          hasAccessToFullQuiz: true,
                          showPaymentModal: false,
                          isProcessingPayment: false
                        }));
                      }, 2000);
                    }}
                    type="button"
                    disabled={quizStatus.isProcessingPayment}
                    className={`w-full py-3 ${quizStatus.isProcessingPayment ? 'bg-blue-300' : 'bg-blue-600 hover:bg-blue-700'} text-white rounded-lg font-medium transition-all duration-200 flex items-center justify-center shadow-md disabled:opacity-70 disabled:cursor-not-allowed focus:outline-none focus:ring-2 focus:ring-blue-400 focus:ring-offset-2`}
                  >
                    {quizStatus.isProcessingPayment ? (
                      <>
                        <svg className="animate-spin -ml-1 mr-3 h-5 w-5 text-white" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                          <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                          <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                        </svg>
                        处理中...
                      </>
                    ) : (
                      <>
                        <svg className="w-6 h-6 mr-2" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
                          <path d="M4 4h16c1.1 0 2 .9 2 2v12c0 1.1-.9 2-2 2H4c-1.1 0-2-.9-2-2V6c0-1.1.9-2 2-2z" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
                          <path d="M22 10H2" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
                        </svg>
                        确认支付 ¥{questionSet.price || 0}
                      </>
                    )}
                  </button>
                </div>
              </div>
            )}
            
            {/* 兑换码模态窗口 */}
            {quizStatus.showRedeemCodeModal && questionSet && (
              <div
                className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4"
                onClick={(e) => {
                  if (e.target === e.currentTarget && !quizStatus.isProcessingRedeem) {
                    console.log('[QuizPage] 兑换模态窗口背景点击关闭');
                    setQuizStatus(prev => ({
                      ...prev,
                      showRedeemCodeModal: false
                    }));
                  }
                }}
              >
                <div className="bg-white rounded-lg shadow-xl w-full max-w-md p-6 transform transition-all">
                  <div className="flex justify-between items-center mb-4">
                    <h2 className="text-xl font-semibold">题库兑换码</h2>
                    <button
                      onClick={(e) => {
                        e.stopPropagation();
                        console.log('[QuizPage] 关闭兑换模态窗口');
                        setQuizStatus(prev => ({
                          ...prev,
                          showRedeemCodeModal: false
                        }));
                      }}
                      className="text-gray-500 hover:text-gray-700"
                    >
                      <svg className="h-6 w-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M6 18L18 6M6 6l12 12" />
                      </svg>
                    </button>
                  </div>
                  <RedeemCodeForm 
                    questionSetId={questionSetId || ''}
                    onRedeemSuccess={(redeemedQuestionSetId) => {
                      console.log(`[QuizPage] 兑换码成功回调，题库ID: ${redeemedQuestionSetId}`);
                      setQuizStatus(prevStatus => ({
                        ...prevStatus,
                        showRedeemCodeModal: false,
                        isProcessingRedeem: false,
                        hasAccessToFullQuiz: true,
                        hasRedeemed: true,
                        trialEnded: false
                      }));
                      const redeemedSets = JSON.parse(localStorage.getItem('redeemedQuestionSets') || '[]');
                      if (!redeemedSets.includes(redeemedQuestionSetId)) {
                        redeemedSets.push(redeemedQuestionSetId);
                        localStorage.setItem('redeemedQuestionSets', JSON.stringify(redeemedSets));
                      }
                      localStorage.setItem(`quiz_access_${redeemedQuestionSetId}`, JSON.stringify({
                        hasAccess: true,
                        timestamp: Date.now()
                      }));
                      toast.success('兑换成功！您现在可以访问完整题库');
                    }} 
                  />
                </div>
              </div>
            )}
          </div>
        </>
      )}
    </div>
  );
}

export default QuizPage; 
