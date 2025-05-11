import React, { useEffect, useState, useCallback, useRef } from 'react';
import { useUser } from '../contexts/UserContext';
import { useSocket } from '../contexts/SocketContext';
import { toast } from 'react-toastify';
import { userProgressService, questionSetService, purchaseService, wrongAnswerService } from '../services/api';
import { useNavigate } from 'react-router-dom';
import ExamCountdownWidget from './ExamCountdownWidget';
import { CalendarIcon, CreditCardIcon, ClockIcon, CashIcon } from './Icons';

// 原始进度记录类型
interface ProgressRecord {
  id: string;
  questionSetId: string;
  questionId: string;
  isCorrect: boolean;
  timeSpent: number;
  createdAt?: Date;
  progressQuestionSet?: {
    id: string;
    title: string;
  };
}

// 进度统计类型
interface ProgressStats {
  questionSetId: string;
  title: string;
  completedQuestions: number;
  correctAnswers: number;
  totalTimeSpent: number;
  averageTimeSpent: number;
  accuracy: number;
  answeredQuestions?: {
    questionId: string;
    selectedOptionId: string;
    isCorrect: boolean;
  }[];
}

// 题库信息
interface QuestionSet {
    id: string;
    title: string;
}

// 购买记录类型
interface Purchase {
  id: string;
  userId?: string;
  questionSetId: string;
  purchaseDate: string;
  expiryDate: string;
  amount: number;
  status?: string;
  paymentMethod?: string;
  transactionId?: string;
  purchaseQuestionSet?: {
    id: string;
    title: string;
    description?: string;
  };
  // 兼容性字段 - 后端可能返回的字段
  questionSet?: {
    id: string;
    title: string;
    description?: string;
  };
}

// 兑换记录类型
interface RedeemRecord {
  id: string;
  userId?: string;
  code: string;
  questionSetId: string;
  usedAt: string;
  expiryDate: string;
  redeemQuestionSet?: {
    id: string;
    title: string;
    description?: string;
  };
}

// Define WrongAnswer interface locally
interface WrongAnswer {
  id: string;
  questionId: string;
  questionSetId: string;
  question: string;
  questionType: string;
  options: any[];
  selectedOption?: string;
  selectedOptions?: string[];
  correctOption?: string;
  correctOptions?: string[];
  explanation?: string;
  memo?: string;
  createdAt: string;
  questionSet?: {
    id: string;
    title: string;
  };
}

// 错题集分组
interface WrongAnswerGroup {
  questionSetId: string;
  questionSetTitle: string;
  wrongAnswers: WrongAnswer[];
}

// 进度数据类型
interface ProgressData {
  questionSetId: string;
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

// RedeemCode接口定义
interface RedeemCode {
  id: string;
  questionSetId: string;
  code: string;
  isUsed: boolean;
  userId?: string;
  createdAt: Date;
  updatedAt: Date;
}

const formatTime = (seconds: number): string => {
  const mins = Math.floor(seconds / 60);
  const secs = Math.floor(seconds % 60);
  return mins > 0 ? `${mins}m ${secs}s` : `${secs}s`;
};

const formatDate = (dateString: string): string => {
  const date = new Date(dateString);
  return date.toLocaleDateString('zh-CN', {
    year: 'numeric',
    month: 'short',
    day: 'numeric'
  });
};

interface ProgressCardProps {
  stats: ProgressStats;
  onDelete: (questionSetId: string) => Promise<void>;
}

const ProgressCard: React.FC<ProgressCardProps> = ({ stats, onDelete }) => {
  const navigate = useNavigate();
  const [isDeleting, setIsDeleting] = useState(false);
  const [showConfirmDelete, setShowConfirmDelete] = useState(false);

  // 检查是否有保存在localStorage的更新数据
  const checkLocalProgressData = () => {
    try {
      const localProgressKey = `quiz_progress_${stats.questionSetId}`;
      const localProgressStr = localStorage.getItem(localProgressKey);
      
      if (localProgressStr) {
        const localProgress = JSON.parse(localProgressStr);
        const lastUpdated = new Date(localProgress.lastUpdated || 0);
        const isRecent = Date.now() - lastUpdated.getTime() < 24 * 60 * 60 * 1000;
        
        if (isRecent && localProgress.answeredQuestions && localProgress.answeredQuestions.length > 0) {
          console.log(`[ProfilePage] 找到本地题库进度数据: ${stats.questionSetId}`);
          return localProgress;
        }
      }
    } catch (e) {
      console.error('[ProfilePage] 检查本地进度数据失败:', e);
    }
    return null;
  };
  
  // 处理继续学习按钮点击
  const handleContinueLearning = () => {
    // 检查本地数据是否存在更新的进度
    const localProgress = checkLocalProgressData();
    
    if (localProgress) {
      // 如果有本地进度数据，附加lastQuestionIndex参数
      const continueIndex = localProgress.lastQuestionIndex >= 0 ? localProgress.lastQuestionIndex : 0;
      navigate(`/quiz/${stats.questionSetId}?lastQuestion=${continueIndex}`);
    } else {
      // 否则正常导航
      navigate(`/quiz/${stats.questionSetId}`);
    }
  };

  // 处理删除确认
  const handleConfirmDelete = async () => {
    if (isDeleting) return;
    
    setIsDeleting(true);
    try {
      // 删除本地存储的进度数据
      const localProgressKey = `quiz_progress_${stats.questionSetId}`;
      localStorage.removeItem(localProgressKey);
      
      // 调用父组件的删除方法，通过API删除服务器上的进度
      if (onDelete) {
        await onDelete(stats.questionSetId);
      }
    } catch (e) {
      console.error('[ProfilePage] 删除进度数据失败:', e);
      toast.error('删除进度失败，请重试');
    } finally {
      setIsDeleting(false);
      setShowConfirmDelete(false);
    }
  };

  return (
    <div 
      className="bg-white rounded-xl shadow-sm hover:shadow-md transition-all duration-300 overflow-hidden cursor-pointer transform hover:-translate-y-1 border border-gray-100 relative"
    >
      {/* 删除按钮 */}
      <button
        onClick={(e) => {
          e.stopPropagation();
          setShowConfirmDelete(true);
        }}
        className="absolute top-2 right-2 w-8 h-8 bg-red-50 text-red-500 rounded-full flex items-center justify-center opacity-0 group-hover:opacity-100 hover:bg-red-100 transition-all z-10"
        title="删除学习进度"
      >
        <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
        </svg>
      </button>

      {/* 删除确认对话框 */}
      {showConfirmDelete && (
        <div className="absolute inset-0 bg-white bg-opacity-90 z-20 flex items-center justify-center p-4">
          <div className="bg-white rounded-lg shadow-lg p-4 max-w-xs w-full border border-gray-200">
            <div className="text-center mb-4">
              <div className="mx-auto w-12 h-12 bg-red-100 rounded-full flex items-center justify-center mb-3">
                <svg className="w-6 h-6 text-red-600" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
                </svg>
              </div>
              <h3 className="text-lg font-semibold text-gray-800">确认删除</h3>
              <p className="text-sm text-gray-600 mt-1">
                确定要删除 "{stats.title}" 的学习进度吗？此操作无法撤销。
              </p>
            </div>
            <div className="flex justify-end space-x-2">
              <button
                onClick={(e) => {
                  e.stopPropagation();
                  setShowConfirmDelete(false);
                }}
                className="px-3 py-1.5 bg-gray-100 text-gray-700 rounded-md text-sm hover:bg-gray-200 transition-colors"
              >
                取消
              </button>
              <button
                onClick={(e) => {
                  e.stopPropagation();
                  handleConfirmDelete();
                }}
                disabled={isDeleting}
                className={`px-3 py-1.5 bg-red-600 text-white rounded-md text-sm hover:bg-red-700 transition-colors flex items-center ${isDeleting ? 'opacity-70 cursor-not-allowed' : ''}`}
              >
                {isDeleting ? (
                  <>
                    <svg className="w-4 h-4 mr-1 animate-spin" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
                    </svg>
                    处理中...
                  </>
                ) : (
                  <>删除</>
                )}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* 卡片顶部带颜色条 */}
      <div className="h-2 bg-gradient-to-r from-blue-400 to-indigo-500"></div>
      
      <div 
        className="p-5 group"
        onClick={handleContinueLearning}
      >
        <h2 className="text-lg font-semibold mb-4 text-gray-800 truncate flex items-center">
          <svg className="w-5 h-5 mr-2 text-blue-500 flex-shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
          </svg>
          {stats.title}
        </h2>
        
        <div className="grid grid-cols-2 gap-4 mb-6">
          <div className="bg-blue-50 rounded-lg p-3 text-center">
            <div className="text-2xl font-bold text-blue-600">{stats.completedQuestions}</div>
            <div className="text-xs text-blue-600 mt-1">已答题数</div>
          </div>
          <div className="bg-green-50 rounded-lg p-3 text-center">
            <div className="text-2xl font-bold text-green-600">{stats.correctAnswers}</div>
            <div className="text-xs text-green-600 mt-1">答对题数</div>
          </div>
        </div>
        
        <div className="space-y-4">
          <div>
            <div className="flex justify-between items-center mb-1">
              <span className="text-sm text-gray-600">正确率</span>
              <span className="text-sm font-semibold">{stats.accuracy.toFixed(1)}%</span>
            </div>
            <div className="h-2 bg-gray-200 rounded-full overflow-hidden">
              <div 
                className="h-full rounded-full bg-gradient-to-r from-green-400 to-emerald-500 transition-all duration-500" 
                style={{ width: `${stats.accuracy}%` }}
              ></div>
            </div>
          </div>
          
          <div>
            <div className="flex justify-between items-center mb-1">
              <span className="text-sm text-gray-600">平均答题时间</span>
              <span className="text-sm font-semibold">{formatTime(stats.averageTimeSpent)}</span>
            </div>
            <div className="h-2 bg-gray-200 rounded-full overflow-hidden">
              <div 
                className="h-full rounded-full bg-gradient-to-r from-blue-400 to-indigo-500 transition-all duration-500" 
                style={{ width: `${Math.min(100, (stats.averageTimeSpent / 60) * 100)}%` }}
              ></div>
            </div>
          </div>
          
          <div className="flex justify-between items-center text-sm mt-4 pt-4 border-t border-gray-100">
            <span className="text-gray-500">总学习时间</span>
            <span className="font-medium text-indigo-600">{formatTime(stats.totalTimeSpent)}</span>
          </div>
        </div>
        
        <button 
          onClick={(e) => {
            e.stopPropagation();
            handleContinueLearning();
          }}
          className="w-full mt-5 py-2 bg-gradient-to-r from-blue-500 to-indigo-600 text-white rounded-lg text-sm font-medium transition-all duration-300 hover:shadow-md flex items-center justify-center"
        >
          <svg className="w-4 h-4 mr-2" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M14 5l7 7m0 0l-7 7m7-7H3" />
          </svg>
          继续学习
        </button>
      </div>
    </div>
  );
};

// 购买记录卡片组件
interface PurchaseCardProps {
  purchase: Purchase;
}

const PurchaseCard: React.FC<PurchaseCardProps> = ({ purchase }) => {
  const navigate = useNavigate();
  
  // 提取题库数据，确保兼容不同来源的数据
  const questionSet = purchase.purchaseQuestionSet || 
    (purchase as any).questionSet || 
    { id: purchase.questionSetId, title: `题库 (ID: ${purchase.questionSetId.substring(0, 8)}...)` };
  
  // 计算剩余天数
  const calculateRemainingDays = (): number => {
    try {
      if (!purchase.expiryDate) return 0;
      
      const now = new Date();
      const expiryDate = new Date(purchase.expiryDate);
      
      // 检查日期是否有效
      if (isNaN(expiryDate.getTime())) {
        console.error('[PurchaseCard] 无效的过期日期:', purchase.expiryDate);
        return 0;
      }
      
      const diffTime = expiryDate.getTime() - now.getTime();
      return Math.max(0, Math.ceil(diffTime / (1000 * 60 * 60 * 24)));
    } catch (error) {
      console.error('[PurchaseCard] 计算剩余天数出错:', error);
      return 0;
    }
  };
  
  const remainingDays = calculateRemainingDays();
  const hasExpired = remainingDays <= 0;
  
  // 根据有效期状态获取不同的颜色主题
  const getThemeColors = () => {
    if (hasExpired) {
      return {
        gradientFrom: 'from-red-100',
        gradientTo: 'to-red-50',
        textColor: 'text-red-600',
        borderColor: 'border-red-200',
        accentColor: 'bg-red-500',
        statusBg: 'bg-red-100',
        statusText: 'text-red-800',
      };
    }
    
    if (remainingDays < 7) {
      return {
        gradientFrom: 'from-orange-100',
        gradientTo: 'to-orange-50',
        textColor: 'text-orange-600',
        borderColor: 'border-orange-200',
        accentColor: 'bg-orange-500',
        statusBg: 'bg-orange-100',
        statusText: 'text-orange-800',
      };
    }
    
    return {
      gradientFrom: 'from-blue-100',
      gradientTo: 'to-blue-50',
      textColor: 'text-blue-600',
      borderColor: 'border-blue-200',
      accentColor: 'bg-blue-500',
      statusBg: 'bg-blue-100',
      statusText: 'text-blue-800',
    };
  };
  
  const theme = getThemeColors();
  
  const getStatusText = () => {
    if (hasExpired) return '已过期';
    if (purchase.status === 'active') return '有效';
    if (purchase.status === 'pending') return '待处理';
    if (purchase.status === 'cancelled') return '已取消';
    return purchase.status || '未知';
  };
  
  const handleClick = () => {
    if (questionSet && questionSet.id) {
      navigate(`/quiz/${questionSet.id}`);
    } else {
      console.error('[PurchaseCard] 无法导航，题库ID不存在');
      toast.error('无法打开题库，ID不存在');
    }
  };

  // 计算有效期总天数（假设为30天）和剩余百分比
  const totalValidityDays = 30;
  const remainingPercentage = Math.min(100, Math.round((remainingDays / totalValidityDays) * 100));

  return (
    <div className="bg-white rounded-xl shadow-sm hover:shadow-md transition-all duration-300 overflow-hidden transform hover:-translate-y-1 border border-gray-100 cursor-pointer"
      onClick={handleClick}>
      {/* 顶部状态条 */}
      <div className={`h-2 ${hasExpired ? 'bg-red-500' : `bg-gradient-to-r from-blue-400 to-indigo-500`}`}></div>
      
      <div className="p-5">
        <div className="flex justify-between items-start mb-4">
          <h3 className="text-lg font-semibold text-gray-800 mr-3 line-clamp-1">
            {questionSet?.title || `题库 (ID: ${purchase.questionSetId.substring(0, 8)}...)`}
          </h3>
          <span className={`flex-shrink-0 px-2 py-1 rounded-full text-xs font-medium ${theme.statusBg} ${theme.statusText}`}>
            {getStatusText()}
          </span>
        </div>
        
        <div className="text-sm text-gray-500 mb-5 max-h-12 overflow-hidden line-clamp-2">
          {questionSet?.description || '无描述'}
        </div>
        
        <div className="space-y-4 mb-5">
          <div className="flex justify-between items-center mb-1 text-sm">
            <span className="text-gray-600 flex items-center">
              <ClockIcon className="w-4 h-4 mr-1.5 text-gray-400" />
              剩余有效期
            </span>
            <span className={`font-medium ${hasExpired ? 'text-red-500' : 'text-indigo-600'}`}>
              {hasExpired ? '已过期' : `${remainingDays}天`}
            </span>
          </div>
          
          {!hasExpired && (
            <>
              <div className="h-2 bg-gray-200 rounded-full overflow-hidden">
                <div 
                  className={`h-full rounded-full transition-all duration-500 ${
                    remainingDays < 7 ? 'bg-gradient-to-r from-orange-400 to-red-500' : 'bg-gradient-to-r from-blue-400 to-indigo-500'
                  }`}
                  style={{ width: `${remainingPercentage}%` }}
                ></div>
              </div>
              <div className="flex justify-end">
                <span className="text-xs text-gray-500">{remainingPercentage}%</span>
              </div>
            </>
          )}
        </div>
        
        <div className="grid grid-cols-2 gap-3 mb-5">
          <div className="bg-gray-50 rounded-lg p-3">
            <div className="text-xs text-gray-500 mb-1">购买日期</div>
            <div className="text-sm font-medium flex items-center">
              <CalendarIcon className="w-3.5 h-3.5 mr-1 text-gray-400" />
              {new Date(purchase.purchaseDate).toLocaleDateString()}
            </div>
          </div>
          
          <div className="bg-gray-50 rounded-lg p-3">
            <div className="text-xs text-gray-500 mb-1">支付方式</div>
            <div className="text-sm font-medium flex items-center">
              <CreditCardIcon className="w-3.5 h-3.5 mr-1 text-gray-400" />
              {purchase.paymentMethod === 'wechat' ? '微信支付' : 
               purchase.paymentMethod === 'alipay' ? '支付宝' : 
               purchase.paymentMethod === 'direct' ? '直接购买' : 
               purchase.paymentMethod || '未知'}
            </div>
          </div>
        </div>
        
        <div className="flex justify-between items-center">
          <div className="flex items-center">
            <div className="w-9 h-9 rounded-full bg-blue-50 flex items-center justify-center mr-2 border border-blue-100">
              <CashIcon className="w-5 h-5 text-blue-500" />
            </div>
            <div>
              <div className="text-xs text-gray-500">价格</div>
              <div className="font-bold text-blue-600">{purchase.amount ? `¥${purchase.amount.toFixed(2)}` : '免费'}</div>
            </div>
          </div>
          
          <button
            onClick={(e) => {
              e.stopPropagation();
              handleClick();
            }}
            className={`px-4 py-1.5 rounded-lg text-sm font-medium transition-all duration-300 ${
              hasExpired 
                ? 'bg-gray-100 text-gray-400 cursor-not-allowed' 
                : 'bg-gradient-to-r from-blue-500 to-indigo-600 text-white hover:shadow-md'
            }`}
            disabled={hasExpired}
          >
            {hasExpired ? '已过期' : '开始学习'}
          </button>
        </div>
      </div>
    </div>
  );
};

// 兑换记录卡片组件
interface RedeemCardProps {
  redeem: RedeemRecord;
}

const RedeemCard: React.FC<RedeemCardProps> = ({ redeem }) => {
  const navigate = useNavigate();
  const expiryDate = new Date(redeem.expiryDate);
  const now = new Date();
  const isExpired = expiryDate < now;
  
  // 更精确地计算剩余天数
  const remainingDays = Math.max(0, Math.ceil((expiryDate.getTime() - now.getTime()) / (1000 * 60 * 60 * 24)));
  
  // 计算总有效期 - 默认为30天
  const totalValidityDays = 30;
  
  // 获取题库标题
  const title = redeem.redeemQuestionSet?.title || (redeem as any).questionSet?.title || '未知题库';
  
  // 使用剩余天数确定颜色
  const getStatusColorClass = () => {
    if (isExpired) return 'text-red-500 bg-red-50 border-red-100';
    if (remainingDays < 7) return 'text-orange-500 bg-orange-50 border-orange-100';
    return 'text-emerald-500 bg-emerald-50 border-emerald-100';
  };
  
  return (
    <div className="bg-white rounded-xl shadow-sm hover:shadow-md transition-all duration-300 overflow-hidden border border-gray-100 transform hover:-translate-y-1">
      {/* 顶部状态条 */}
      <div className={`h-2 ${isExpired ? 'bg-red-500' : 'bg-gradient-to-r from-purple-400 to-indigo-500'}`}></div>
      
      <div className="p-5">
        <div className="flex justify-between items-start mb-5">
          <h2 className="text-lg font-semibold text-gray-800 truncate flex items-center">
            <svg className="w-5 h-5 mr-2 text-purple-500 flex-shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 5v2m0 4v2m0 4v2M5 5a2 2 0 00-2 2v3a2 2 0 110 4v3a2 2 0 002 2h14a2 2 0 002-2v-3a2 2 0 110-4V7a2 2 0 00-2-2H5z" />
            </svg>
            {title}
          </h2>
          <div className={`px-3 py-1 text-xs font-medium rounded-full ${getStatusColorClass()}`}>
            {isExpired ? '已过期' : remainingDays < 7 ? '即将过期' : '有效'}
          </div>
        </div>
        
        <div className="flex items-center p-3 mb-4 rounded-lg bg-purple-50 border border-purple-100">
          <div className="w-10 h-10 flex items-center justify-center bg-purple-100 rounded-lg mr-3">
            <svg className="w-6 h-6 text-purple-500" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 7a2 2 0 012 2m4 0a6 6 0 01-7.743 5.743L11 17H9v2H7v2H4a1 1 0 01-1-1v-2.586a1 1 0 01.293-.707l5.964-5.964A6 6 0 1121 9z" />
            </svg>
          </div>
          <div>
            <div className="text-xs text-purple-500 font-medium">兑换码</div>
            <div className="text-sm font-bold tracking-wider">{redeem.code.substring(0, 4)}-****-****</div>
          </div>
        </div>
        
        <div className="grid grid-cols-2 gap-3 mb-4">
          <div className="bg-gray-50 rounded-lg p-3">
            <div className="text-xs text-gray-500 mb-1">兑换日期</div>
            <div className="text-sm font-medium">{formatDate(redeem.usedAt)}</div>
          </div>
          <div className="bg-gray-50 rounded-lg p-3">
            <div className="text-xs text-gray-500 mb-1">到期日期</div>
            <div className={`text-sm font-medium ${isExpired ? 'text-red-500' : ''}`}>{formatDate(redeem.expiryDate)}</div>
          </div>
        </div>
        
        {!isExpired && (
          <div className="mt-4">
            <div className="flex justify-between items-center mb-2 text-sm">
              <span className="text-gray-600">剩余有效期</span>
              <div className="font-medium text-indigo-600 flex items-center">
                <svg className="w-4 h-4 mr-1 text-indigo-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
                </svg>
                {remainingDays} 天
              </div>
            </div>
            <div className="h-2.5 bg-gray-200 rounded-full overflow-hidden">
              <div
                className="h-full rounded-full bg-gradient-to-r from-purple-400 to-indigo-500 transition-all duration-500"
                style={{ width: `${Math.min(100, (remainingDays / totalValidityDays) * 100)}%` }}
              ></div>
            </div>
            <div className="flex justify-end mt-1">
              <span className="text-xs text-gray-500">{Math.round((remainingDays / totalValidityDays) * 100)}%</span>
            </div>
          </div>
        )}
        
        <button
          onClick={() => navigate(`/quiz/${redeem.questionSetId}`)}
          className={`w-full mt-5 py-2.5 rounded-lg flex items-center justify-center font-medium text-sm transition-all duration-300 ${
            isExpired 
            ? 'bg-gray-100 text-gray-400 cursor-not-allowed' 
            : 'bg-gradient-to-r from-purple-500 to-indigo-600 text-white hover:shadow-md'
          }`}
          disabled={isExpired}
        >
          {isExpired ? (
            <>
              <svg className="w-4 h-4 mr-2" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z" />
              </svg>
              题库已过期
            </>
          ) : (
            <>
              <svg className="w-4 h-4 mr-2" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M14 5l7 7m0 0l-7 7m7-7H3" />
              </svg>
              开始学习
            </>
          )}
        </button>
      </div>
    </div>
  );
};

// 错题卡片组件
interface WrongAnswerCardProps {
  wrongAnswer: WrongAnswer;
  onDelete: (id: string) => void;
  onUpdateMemo: (id: string, memo: string) => void;
  onPractice: (questionSetId: string) => void;
}

const WrongAnswerCard: React.FC<WrongAnswerCardProps> = ({ 
  wrongAnswer, 
  onDelete, 
  onUpdateMemo,
  onPractice
}) => {
  const [isEditing, setIsEditing] = useState(false);
  const [memo, setMemo] = useState(wrongAnswer.memo || '');
  const [showOptions, setShowOptions] = useState(false);

  // 渲染选项
  const renderOptions = () => {
    return wrongAnswer.options.map((option, index) => {
      // 判断这个选项是否是正确答案
      const isCorrect = wrongAnswer.questionType === 'single' 
        ? option.id === wrongAnswer.correctOption
        : wrongAnswer.correctOptions?.includes(option.id);
      
      // 判断这个选项是否是用户选择的
      const isSelected = wrongAnswer.questionType === 'single'
        ? option.id === wrongAnswer.selectedOption
        : wrongAnswer.selectedOptions?.includes(option.id);
      
      // 基础样式
      let optionClass = "p-3 my-1.5 rounded-lg flex items-start border ";
      
      if (isCorrect) {
        optionClass += "bg-green-50 border-green-200 ";
      } else if (isSelected) {
        optionClass += "bg-red-50 border-red-200 ";
      } else {
        optionClass += "bg-gray-50 border-gray-200 ";
      }
      
      return (
        <div key={option.id} className={optionClass}>
          <div className={`w-6 h-6 mr-3 rounded-full flex-shrink-0 flex items-center justify-center text-sm font-medium ${
            isCorrect ? 'bg-green-100 text-green-700' :
            isSelected ? 'bg-red-100 text-red-700' : 'bg-gray-200 text-gray-700'
          }`}>
            {String.fromCharCode(65 + index)}
          </div>
          <span className="text-sm">{option.text}</span>
        </div>
      );
    });
  };
  
  const handleSaveMemo = () => {
    onUpdateMemo(wrongAnswer.id, memo);
    setIsEditing(false);
  };
  
  const formatDate = (dateString: string) => {
    const date = new Date(dateString);
    return date.toLocaleDateString('zh-CN', {
      month: 'short',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit'
    });
  };
  
  return (
    <div className="bg-white p-4 rounded-lg shadow-sm border border-gray-100 mb-4 hover:shadow-md transition-all duration-200">
      <div className="flex justify-between items-start mb-3">
        <h3 className="font-medium text-gray-800 flex items-start">
          <span className="bg-red-100 text-red-600 text-xs px-2 py-1 rounded-full mr-2 mt-0.5 flex-shrink-0">错题</span>
          {wrongAnswer.question}
        </h3>
        <div className="flex items-center space-x-2">
          <button 
            onClick={() => setShowOptions(!showOptions)}
            className="text-blue-500 text-sm hover:text-blue-700 flex items-center"
          >
            <svg className="w-4 h-4 mr-1" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z" />
            </svg>
            {showOptions ? '隐藏选项' : '查看选项'}
          </button>
          <button 
            onClick={() => onPractice(wrongAnswer.questionSetId)}
            className="text-emerald-500 text-sm hover:text-emerald-700 flex items-center"
          >
            <svg className="w-4 h-4 mr-1" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M14.752 11.168l-3.197-2.132A1 1 0 0010 9.87v4.263a1 1 0 001.555.832l3.197-2.132a1 1 0 000-1.664z" />
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
            </svg>
            练习
          </button>
        </div>
      </div>
      
      <div className="flex items-center text-xs text-gray-500 mb-3 bg-gray-50 px-3 py-1.5 rounded-md">
        <svg className="w-3.5 h-3.5 mr-1.5 text-gray-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
        </svg>
        {formatDate(wrongAnswer.createdAt)}
        
        {wrongAnswer.questionSet && (
          <>
            <span className="mx-1.5">•</span>
            <svg className="w-3.5 h-3.5 mr-1.5 text-gray-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
            </svg>
            {wrongAnswer.questionSet.title}
          </>
        )}
      </div>
      
      {showOptions && (
        <div className="mb-4 border-t border-b border-gray-100 py-3">
          {renderOptions()}
          
          {wrongAnswer.explanation && (
            <div className="mt-3 p-3 bg-blue-50 rounded-lg border border-blue-100">
              <div className="flex items-center mb-1.5 text-blue-700">
                <svg className="w-4 h-4 mr-1" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                </svg>
                <p className="text-sm font-medium">解析</p>
              </div>
              <p className="text-sm text-blue-700">{wrongAnswer.explanation}</p>
            </div>
          )}
        </div>
      )}
      
      {isEditing ? (
        <div className="mt-3">
          <textarea
            value={memo}
            onChange={(e) => setMemo(e.target.value)}
            className="w-full p-3 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-blue-500 focus:border-blue-500 outline-none transition"
            placeholder="添加备注..."
            rows={2}
          />
          <div className="flex justify-end mt-2 space-x-2">
            <button 
              onClick={() => setIsEditing(false)}
              className="px-3 py-1.5 bg-gray-100 text-gray-700 rounded-md text-sm hover:bg-gray-200 transition-colors"
            >
              取消
            </button>
            <button 
              onClick={handleSaveMemo}
              className="px-3 py-1.5 bg-blue-600 text-white rounded-md text-sm hover:bg-blue-700 transition-colors"
            >
              保存
            </button>
          </div>
        </div>
      ) : (
        <div className="flex justify-between items-center mt-2">
          {wrongAnswer.memo ? (
            <div className="flex-1 text-sm text-gray-700 bg-gray-50 p-3 rounded-lg border border-gray-100">
              <div className="flex items-center mb-1 text-xs text-gray-500">
                <svg className="w-3.5 h-3.5 mr-1" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15.232 5.232l3.536 3.536m-2.036-5.036a2.5 2.5 0 113.536 3.536L6.5 21.036H3v-3.572L16.732 3.732z" />
                </svg>
                备注
              </div>
              {wrongAnswer.memo}
            </div>
          ) : (
            <div className="flex-1">
              <button 
                onClick={() => setIsEditing(true)}
                className="text-blue-500 text-sm hover:text-blue-700 flex items-center"
              >
                <svg className="w-4 h-4 mr-1" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" />
                </svg>
                添加备注...
              </button>
            </div>
          )}
          
          <div className="ml-2 flex space-x-2">
            {wrongAnswer.memo && (
              <button 
                onClick={() => setIsEditing(true)}
                className="text-blue-500 text-sm hover:text-blue-700 flex items-center"
              >
                <svg className="w-4 h-4 mr-1" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" />
                </svg>
                编辑
              </button>
            )}
            <button 
              onClick={() => onDelete(wrongAnswer.id)}
              className="text-red-500 text-sm hover:text-red-700 flex items-center"
            >
              <svg className="w-4 h-4 mr-1" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
              </svg>
              删除
            </button>
          </div>
        </div>
      )}
    </div>
  );
};

// 错题集分组组件
interface WrongAnswerGroupProps {
  group: WrongAnswerGroup;
  onDelete: (id: string) => void;
  onUpdateMemo: (id: string, memo: string) => void;
  onPractice: (questionSetId: string) => void;
}

const WrongAnswerGroupComponent: React.FC<WrongAnswerGroupProps> = ({ 
  group, 
  onDelete, 
  onUpdateMemo,
  onPractice
}) => {
  const [isCollapsed, setIsCollapsed] = useState(false);
  
  return (
    <div className="mb-6">
      <div 
        className="flex justify-between items-center bg-white rounded-lg shadow-sm border border-gray-200 p-4 cursor-pointer hover:shadow-md transition-all"
        onClick={() => setIsCollapsed(!isCollapsed)}
      >
        <div className="flex items-center">
          <div className="w-10 h-10 rounded-full bg-red-100 flex items-center justify-center text-red-600 mr-3">
            <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
            </svg>
          </div>
          <div>
            <h2 className="text-lg font-semibold text-gray-800">{group.questionSetTitle}</h2>
            <p className="text-sm text-gray-500">共 {group.wrongAnswers.length} 道错题</p>
          </div>
        </div>
        <div className="flex items-center">
          <button 
            onClick={(e) => {
              e.stopPropagation();
              onPractice(group.questionSetId);
            }}
            className="mr-3 px-3 py-1.5 bg-gradient-to-r from-green-500 to-emerald-600 text-white rounded-md text-sm hover:shadow-md transition-all duration-200 flex items-center"
          >
            <svg className="w-4 h-4 mr-1.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M14.752 11.168l-3.197-2.132A1 1 0 0010 9.87v4.263a1 1 0 001.555.832l3.197-2.132a1 1 0 000-1.664z" />
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
            </svg>
            练习全部
          </button>
          <svg 
            className={`w-5 h-5 text-gray-400 transition-transform duration-300 ${isCollapsed ? 'transform rotate-180' : ''}`} 
            fill="none" 
            stroke="currentColor" 
            viewBox="0 0 24 24" 
            xmlns="http://www.w3.org/2000/svg"
          >
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
          </svg>
        </div>
      </div>
      
      {!isCollapsed && (
        <div className="mt-3 pl-4 border-l-2 border-red-200">
          {group.wrongAnswers.map(wrongAnswer => (
            <WrongAnswerCard 
              key={wrongAnswer.id}
              wrongAnswer={wrongAnswer}
              onDelete={onDelete}
              onUpdateMemo={onUpdateMemo}
              onPractice={onPractice}
            />
          ))}
        </div>
      )}
    </div>
  );
};

const ProfilePage: React.FC = () => {
  const { user } = useUser();
  const { socket } = useSocket();
  const [progressStats, setProgressStats] = useState<ProgressStats[]>([]);
  const [purchases, setPurchases] = useState<Purchase[]>([]);
  const [redeemCodes, setRedeemCodes] = useState<RedeemRecord[]>([]);
  const [wrongAnswers, setWrongAnswers] = useState<WrongAnswer[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [purchasesLoading, setPurchasesLoading] = useState(true);
  const [redeemCodesLoading, setRedeemCodesLoading] = useState(true);
  const [wrongAnswersLoading, setWrongAnswersLoading] = useState(true);
  const [activeTab, setActiveTab] = useState<'progress' | 'purchases' | 'redeemed' | 'wrong-answers'>('progress');
  const navigate = useNavigate();
  
  // 添加一个ref来标记初始数据是否已加载
  const initialDataLoadRef = useRef<boolean>(false);
  // 添加一个ref来存储throttle的时间戳
  const lastProgressUpdateTimeRef = useRef<number>(0);

  // 设置progress数据的状态
  const [progress, setProgress] = useState<Record<string, ProgressData>>({});

  // 错误状态
  const [error, setError] = useState<string | null>(null);

  const [showAccountSwitcher, setShowAccountSwitcher] = useState(false);
  
  // 获取题库数据
  const fetchQuestionSets = useCallback(async () => {
    try {
      console.log('[ProfilePage] 开始获取题库数据');
      const response = await questionSetService.getAllQuestionSets();
      
      if (response.success) {
        console.log('[ProfilePage] 题库数据获取成功，数量:', response.data?.length || 0);
        return response.data || [];
      } else {
        console.error('[ProfilePage] 获取题库数据失败:', response.error);
        return [];
      }
    } catch (error) {
      console.error('[ProfilePage] 获取题库数据异常:', error);
      return [];
    }
  }, []);

  // 在前端计算进度统计
  const calculateProgressStats = (records: ProgressRecord[], questionSets: Map<string, QuestionSet>): ProgressStats[] => {
    console.log('[ProfilePage] 开始计算进度统计，记录数:', records.length, '题库数:', questionSets.size);
    
    if (!Array.isArray(records) || records.length === 0) {
      console.warn('[ProfilePage] 没有进度记录数据，返回空数组');
      return [];
    }
    
    // 验证记录格式
    const validRecords = records.filter(record => {
      const isValid = record && record.questionSetId && record.questionId;
      if (!isValid) {
        console.warn('[ProfilePage] 发现无效记录:', record);
      }
      return isValid;
    });
    
    console.log('[ProfilePage] 有效记录数:', validRecords.length);
    
    // 按题库ID分组
    const progressMap = new Map<string, Map<string, ProgressRecord>>();
    
    // 处理每条记录，按题库和题目分组，保留最后一次作答
    validRecords.forEach(record => {
      // 标准化ID格式
      const qsId = String(record.questionSetId).trim();
      const qId = String(record.questionId).trim();
      
      if (!progressMap.has(qsId)) {
        progressMap.set(qsId, new Map<string, ProgressRecord>());
      }
      
      const questionMap = progressMap.get(qsId)!;
      
      // 如果题目不存在或当前记录更新，则更新记录
      const existingRecord = questionMap.get(qId);
      if (!existingRecord || 
          (record.createdAt && existingRecord.createdAt && 
           new Date(record.createdAt) > new Date(existingRecord.createdAt))) {
        questionMap.set(qId, record);
      }
    });
    
    console.log('[ProfilePage] 按题库分组后的题库数:', progressMap.size);
    
    // 生成最终统计结果
    const stats: ProgressStats[] = [];
    
    progressMap.forEach((questionMap, questionSetId) => {
      // 只处理有作答记录的题库
      if (questionMap.size > 0) {
        console.log(`[ProfilePage] 处理题库 ${questionSetId}，答题数: ${questionMap.size}`);
        
        // 获取该题库的所有最终记录
        const finalRecords = Array.from(questionMap.values());
        
        // 统计数据
        const completedQuestions = finalRecords.length;
        const correctAnswers = finalRecords.filter(r => r.isCorrect).length;
        const totalTimeSpent = finalRecords.reduce((sum, r) => sum + (r.timeSpent || 0), 0);
        const averageTimeSpent = completedQuestions > 0 ? totalTimeSpent / completedQuestions : 0;
        const accuracy = completedQuestions > 0 ? Math.min(100, (correctAnswers / completedQuestions) * 100) : 0;
        
        // 获取题库标题
        let title = '未知题库';
        
        if (questionSets.has(questionSetId)) {
          title = questionSets.get(questionSetId)!.title;
        } else if (finalRecords[0]?.progressQuestionSet?.title) {
          title = finalRecords[0].progressQuestionSet.title;
        } else {
          console.warn(`[ProfilePage] 未找到题库标题，题库ID: ${questionSetId}`);
        }
        
        stats.push({
          questionSetId,
          title,
          completedQuestions,
          correctAnswers,
          totalTimeSpent,
          averageTimeSpent,
          accuracy
        });
      }
    });
    
    // 按完成数量降序排序，显示已完成题目最多的题库在前面
    stats.sort((a, b) => b.completedQuestions - a.completedQuestions);
    
    console.log('[ProfilePage] 最终生成统计数据数量:', stats.length, stats);
    
    return stats;
  };

  // 获取本地存储中的所有进度数据
  const getLocalProgressData = () => {
    try {
      const progressData: Record<string, ProgressData> = {};
      
      // 遍历localStorage中的所有键
      for (let i = 0; i < localStorage.length; i++) {
        const key = localStorage.key(i);
        if (key && key.startsWith('quiz_progress_')) {
          try {
            const questionSetId = key.replace('quiz_progress_', '');
            const progressStr = localStorage.getItem(key);
            if (progressStr) {
              const progress = JSON.parse(progressStr);
              if (progress && progress.answeredQuestions && progress.answeredQuestions.length > 0) {
                progressData[questionSetId] = progress;
              }
            }
          } catch (e) {
            console.error(`[ProfilePage] 解析题库进度数据失败 ${key}:`, e);
          }
        }
      }
      
      return Object.keys(progressData).length > 0 ? progressData : null;
    } catch (e) {
      console.error('[ProfilePage] 获取本地进度数据失败:', e);
      return null;
    }
  };
  
  // 将本地存储的进度数据转换为进度统计并显示
  const displayLocalProgressData = async (localData: Record<string, ProgressData>) => {
    try {
      console.log('[ProfilePage] 开始处理本地进度数据用于显示');
      
      // 获取题库信息
      const questionSets = await fetchQuestionSets();
      const questionSetsMap = new Map<string, QuestionSet>();
      questionSets.forEach(set => {
        questionSetsMap.set(set.id, { id: set.id, title: set.title });
      });
      
      // 从本地数据生成临时的进度记录
      const tempProgressRecords: ProgressRecord[] = [];
      
      Object.entries(localData).forEach(([questionSetId, data]) => {
        if (data.answeredQuestions && data.answeredQuestions.length > 0) {
          data.answeredQuestions.forEach((answer, index) => {
            // 创建一个临时的进度记录
            const record: ProgressRecord = {
              id: `local_${questionSetId}_${index}`,
              questionSetId,
              questionId: `question_${answer.index || index}`, // 使用问题索引作为ID
              isCorrect: answer.isCorrect,
              timeSpent: 60, // 默认时间
              createdAt: new Date(data.lastUpdated || Date.now()),
              progressQuestionSet: questionSetsMap.get(questionSetId)
            };
            tempProgressRecords.push(record);
          });
        }
      });
      
      console.log('[ProfilePage] 从本地数据生成临时进度记录:', tempProgressRecords.length);
      
      if (tempProgressRecords.length > 0) {
        const stats = calculateProgressStats(tempProgressRecords, questionSetsMap);
        console.log('[ProfilePage] 从本地数据计算得到的进度统计:', stats);
        
        if (stats.length > 0) {
          setProgressStats(stats);
          setError(null); // 清除之前的错误
        }
      }
    } catch (e) {
      console.error('[ProfilePage] 处理本地进度数据失败:', e);
    }
  };
  
  // 合并本地存储和服务器的进度数据
  const mergeLocalAndServerProgress = (
    serverRecords: ProgressRecord[],
    localData: Record<string, ProgressData>,
    questionSetsMap: Map<string, QuestionSet>
  ): ProgressRecord[] => {
    try {
      console.log('[ProfilePage] 开始合并本地和服务器进度数据');
      
      // 检查是否在登录后短时间内 - 登录后优先使用本地数据
      const lastLoginTime = parseInt(sessionStorage.getItem('last_login_time') || '0', 10);
      const now = Date.now();
      const isRecentLogin = now - lastLoginTime < 30 * 60 * 1000; // 登录后30分钟内优先使用本地数据，从5分钟延长到30分钟
      
      if (isRecentLogin) {
        console.log('[ProfilePage] 检测到登录状态，在合并时优先使用本地进度数据');
      }
      
      // 创建服务器记录的映射（按题库ID和问题ID）
      const serverRecordMap = new Map<string, ProgressRecord>();
      serverRecords.forEach(record => {
        const key = `${record.questionSetId}_${record.questionId}`;
        serverRecordMap.set(key, record);
      });
      
      // 处理本地数据，将新的或更新的记录添加到结果中
      Object.entries(localData).forEach(([questionSetId, data]) => {
        // 检查此题库的本地数据是否被标记为受保护
        const isProtected = data.protected === true;
        
        if (data.answeredQuestions && data.answeredQuestions.length > 0) {
          data.answeredQuestions.forEach((answer, index) => {
            const questionId = `question_${answer.index || index}`; // 使用问题索引作为ID
            const key = `${questionSetId}_${questionId}`;
            
            // 如果本地记录不存在于服务器记录中，或者比服务器记录更新，或者在登录后短时间内，或者数据受保护，则添加本地记录
            const serverRecord = serverRecordMap.get(key);
            const localUpdatedAt = new Date(data.lastUpdated || 0);
            
            // 使用本地数据的条件：
            // 1. 登录后优先使用本地数据
            // 2. 本地数据比服务器新
            // 3. 服务器没有此记录
            // 4. 本地数据被标记为受保护
            if (!serverRecord || 
                (serverRecord.createdAt && localUpdatedAt > new Date(serverRecord.createdAt)) ||
                isRecentLogin ||
                isProtected) {
              
              // 创建一个新记录替换或添加到结果中
              const newRecord: ProgressRecord = {
                id: serverRecord?.id || `local_${key}`,
                questionSetId,
                questionId,
                isCorrect: answer.isCorrect,
                timeSpent: 60, // 默认时间
                createdAt: localUpdatedAt,
                progressQuestionSet: questionSetsMap.get(questionSetId)
              };
              
              serverRecordMap.set(key, newRecord);
              
              if (isProtected) {
                console.log(`[ProfilePage] 使用受保护的本地数据 ${key}`);
              }
            }
          });
        }
      });
      
      // 将映射转换回数组
      return Array.from(serverRecordMap.values());
    } catch (e) {
      console.error('[ProfilePage] 合并进度数据失败:', e);
      return serverRecords; // 出错时返回原始服务器记录
    }
  };

  // 在fetchProgressData中添加更详细的日志，直接用API获取数据
  const fetchProgressData = async () => {
    if (!user) return;
    
    try {
      setIsLoading(true);
      console.log('[ProfilePage] 开始获取用户进度数据 - 用户ID:', user.id);
      
      // 强化保护机制 - 尝试从备份中恢复任何丢失的进度数据
      try {
        const protectionKey = `protected_progress_${user.id}`;
        const backupKey = `progress_backup_${user.id}`;
        
        const protectionDataStr = localStorage.getItem(protectionKey);
        const backupDataStr = localStorage.getItem(backupKey);
        
        if (protectionDataStr && backupDataStr) {
          const protectionData = JSON.parse(protectionDataStr);
          const backupData = JSON.parse(backupDataStr);
          
          if (protectionData.protectedKeys && Array.isArray(protectionData.protectedKeys)) {
            // 检查哪些进度数据丢失了
            const missingKeys = protectionData.protectedKeys.filter(
              (key: string) => !localStorage.getItem(key) && backupData[key]
            );
            
            if (missingKeys.length > 0) {
              console.log(`[ProfilePage] 发现 ${missingKeys.length} 条丢失的进度数据，正在恢复`);
              let restored = 0;
              
              missingKeys.forEach((key: string) => {
                if (backupData[key]) {
                  localStorage.setItem(key, JSON.stringify(backupData[key]));
                  restored++;
                }
              });
              
              if (restored > 0) {
                console.log(`[ProfilePage] 已恢复 ${restored} 条丢失的进度数据`);
                toast.success(`找回了${restored}条丢失的学习进度`);
              }
            }
          }
        }
      } catch (error) {
        console.error('[ProfilePage] 检查备份进度数据出错:', error);
      }
      
      // 1. 从localStorage读取本地进度数据
      const localProgressData = getLocalProgressData();
      console.log('[ProfilePage] 从本地存储获取到进度数据:', 
        localProgressData ? Object.keys(localProgressData).length + '个题库' : '无');
      
      // 如果有本地数据，立即显示本地数据，不等待API响应
      if (localProgressData && Object.keys(localProgressData).length > 0) {
        console.log('[ProfilePage] 发现本地进度数据，优先显示');
        displayLocalProgressData(localProgressData);
        
        // 确保添加保护标记
        Object.keys(localProgressData).forEach(questionSetId => {
          try {
            const key = `quiz_progress_${questionSetId}`;
            const data = localStorage.getItem(key);
            if (data) {
              const parsed = JSON.parse(data);
              parsed.protected = true;
              parsed.protectedAt = Date.now();
              localStorage.setItem(key, JSON.stringify(parsed));
            }
          } catch (e) {
            console.error(`[ProfilePage] 保护进度数据失败: ${questionSetId}`, e);
          }
        });
        
        // 创建备份
        try {
          const backupData: Record<string, any> = {};
          const protectedKeys: string[] = [];
          
          Object.keys(localProgressData).forEach(questionSetId => {
            const key = `quiz_progress_${questionSetId}`;
            const data = localStorage.getItem(key);
            if (data) {
              try {
                backupData[key] = JSON.parse(data);
                protectedKeys.push(key);
              } catch (e) {}
            }
          });
          
          if (protectedKeys.length > 0) {
            // 保存保护列表
            const protectionKey = `protected_progress_${user.id}`;
            localStorage.setItem(protectionKey, JSON.stringify({
              userId: user.id,
              protectedKeys,
              timestamp: Date.now()
            }));
            
            // 保存备份
            const backupKey = `progress_backup_${user.id}`;
            localStorage.setItem(backupKey, JSON.stringify(backupData));
            
            console.log(`[ProfilePage] 已创建 ${protectedKeys.length} 条进度数据的备份`);
          }
        } catch (e) {
          console.error('[ProfilePage] 创建进度数据备份失败:', e);
        }
      }
      
      // 2. 直接从API获取详细记录数据
      const recordsResponse = await userProgressService.getUserProgressRecords();
      console.log('[ProfilePage] 进度记录API响应:', recordsResponse.success ? '成功' : '失败', 
        recordsResponse.data ? `获取了${Array.isArray(recordsResponse.data) ? recordsResponse.data.length : 0}条记录` : '无数据');
      
      if (recordsResponse.success && recordsResponse.data && Array.isArray(recordsResponse.data)) {
        // 记录实际数据类型和内容
        console.log('[ProfilePage] 进度记录数据类型:', typeof recordsResponse.data);
        console.log('[ProfilePage] 进度记录是否为数组:', Array.isArray(recordsResponse.data));
        console.log('[ProfilePage] 进度记录数量:', recordsResponse.data.length);
        
        if (recordsResponse.data.length > 0) {
          console.log('[ProfilePage] 进度记录示例:', recordsResponse.data[0]);
        } else {
          console.warn('[ProfilePage] 进度记录为空数组 - 用户没有任何进度记录');
          // 如果服务器没有数据但有本地数据，继续使用本地数据
          if (localProgressData && Object.keys(localProgressData).length > 0) {
            console.log('[ProfilePage] 服务器无数据，继续使用本地数据');
            // 已经显示了本地数据，无需再次处理
            setIsLoading(false);
            return;
          }
        }
        
        // 3. 获取题库信息
        const questionSets = await fetchQuestionSets();
        console.log('[ProfilePage] 获取到题库数量:', questionSets.length);
        
        if (questionSets.length > 0) {
          // 创建题库映射
          const questionSetsMap = new Map<string, QuestionSet>();
          questionSets.forEach(set => {
            questionSetsMap.set(set.id, { id: set.id, title: set.title });
          });
          
          // 4. 计算进度统计（结合API数据和本地存储数据）
          let progressRecords = [...recordsResponse.data];
          
          // 5. 合并本地存储中的进度数据（如果存在且比服务器数据更新）
          if (localProgressData && Object.keys(localProgressData).length > 0) {
            progressRecords = mergeLocalAndServerProgress(progressRecords, localProgressData, questionSetsMap);
          }
          
          // 6. 计算最终的进度统计
          const stats = calculateProgressStats(progressRecords, questionSetsMap);
          console.log('[ProfilePage] 计算得到的进度统计:', stats);
          
          // 确保有数据，并设置状态
          if (stats.length > 0) {
            console.log('[ProfilePage] 设置进度统计状态，数量:', stats.length);
            setProgressStats(stats);
          } else {
            console.warn('[ProfilePage] 计算后没有进度统计数据');
            // 如果没有处理出有效的进度统计，但有本地数据，保留本地数据显示
            if (localProgressData && Object.keys(localProgressData).length > 0) {
              console.log('[ProfilePage] 无法生成有效的进度统计，继续显示本地数据');
              // 不设置空数组，保留之前的显示
            } else {
              setProgressStats([]); 
            }
          }
        } else {
          console.error('[ProfilePage] 未找到任何题库信息');
          setError('找不到题库信息');
          
          // 如果没有题库信息但有本地数据，继续显示本地数据
          if (localProgressData && Object.keys(localProgressData).length > 0) {
            console.log('[ProfilePage] 无题库信息，继续显示本地数据');
          }
        }
      } else {
        console.error('[ProfilePage] 获取进度记录失败:', recordsResponse.message);
        setError(recordsResponse.message || '获取进度数据失败');
        
        // 如果API获取失败但有本地数据，继续使用本地数据显示
        if (localProgressData && Object.keys(localProgressData).length > 0) {
          console.log('[ProfilePage] API获取失败，继续使用本地存储数据');
          // 已经显示了本地数据，无需再次处理
        }
      }
    } catch (error) {
      console.error('[ProfilePage] 加载进度数据异常:', error);
      setError('加载进度数据失败，请刷新页面重试');
      
      // 如果出现异常但有本地数据，继续使用本地数据显示
      const localProgressData = getLocalProgressData();
      if (localProgressData && Object.keys(localProgressData).length > 0) {
        console.log('[ProfilePage] 处理异常，继续使用本地存储数据');
        // 如果之前没有显示过本地数据，现在显示
        if (progressStats.length === 0) {
          displayLocalProgressData(localProgressData);
        }
      }
    } finally {
      setIsLoading(false);
    }
  };

  // Directly declare all the data fetching functions at the top

  // 获取购买数据
  const fetchPurchases = useCallback(async () => {
    if (!user) return;
    
    try {
      setPurchasesLoading(true);
      console.log('[ProfilePage] 开始获取用户购买记录');
      
      const response = await purchaseService.getUserPurchases();
      console.log('[ProfilePage] 购买记录响应:', response.success, response.data?.length || 0);
      
      if (response.success && response.data) {
        // 确保返回的数据格式正确，并过滤掉通过兑换码获得的记录
        const validPurchases = response.data
          .filter((p: any) => p && p.questionSetId) // 过滤掉无效记录
          .filter((p: any) => {
            // 只保留直接购买的题库，过滤掉通过兑换码获得的题库和金额为0的记录
            const shouldInclude = p.amount > 0 && p.paymentMethod !== 'redeem' && p.paymentMethod !== 'system';
            if (!shouldInclude) {
              console.log('[ProfilePage] 过滤掉非直接购买记录:', p.questionSetId, p.paymentMethod, p.amount);
            }
            return shouldInclude;
          })
          .map((p: any) => {
            // 确保必需字段
            let questionSetData = null;
            
            // 处理不同的题库数据格式
            if (p.purchaseQuestionSet) {
              questionSetData = p.purchaseQuestionSet;
            } else if (p.questionSet) {
              questionSetData = p.questionSet;
            }
            
            // 如果没有题库数据，创建一个基本对象
            if (!questionSetData && p.questionSetId) {
              questionSetData = {
                id: p.questionSetId,
                title: `题库 ${p.questionSetId.substring(0, 8)}...`,
                description: '无描述'
              };
              console.log('[ProfilePage] 为缺少题库数据的记录创建默认值:', p.questionSetId);
            }
            
            const purchase: Purchase = {
              id: p.id || '', // 确保id为字符串
              questionSetId: p.questionSetId,
              purchaseDate: p.purchaseDate || new Date().toISOString(),
              expiryDate: p.expiryDate || new Date(Date.now() + 30*24*60*60*1000).toISOString(),
              amount: typeof p.amount === 'string' ? parseFloat(p.amount) : (p.amount || 0), // 确保amount是数字
              status: p.status || 'active',
              paymentMethod: p.paymentMethod || 'direct',
              transactionId: p.transactionId || '',
              purchaseQuestionSet: questionSetData
            };
            
            return purchase;
          });
        
        console.log('[ProfilePage] 处理后有效的购买记录数量:', validPurchases.length);
        if (validPurchases.length === 0) {
          console.log('[ProfilePage] 警告: 没有有效的直接购买记录');
        } else {
          console.log('[ProfilePage] 第一条购买记录:', 
            validPurchases[0].questionSetId, 
            validPurchases[0].purchaseQuestionSet?.title || '无标题');
        }
        
        setPurchases(validPurchases);
      } else {
        console.error('[ProfilePage] 获取购买记录失败:', response.message);
        throw new Error(response.message || '获取购买记录失败');
      }
    } catch (error) {
      console.error('[ProfilePage] 获取购买记录异常:', error);
      toast.error('获取购买记录失败，请刷新页面重试');
    } finally {
      setPurchasesLoading(false);
    }
  }, [user]);

  // 定义分页响应接口
  interface PaginatedResponse<T> {
    total: number;
    page: number;
    pageSize: number;
    list: T[];
  }

  // 获取兑换码数据
  const fetchRedeemCodes = useCallback(async () => {
    if (!user) return;
    
    try {
      setRedeemCodesLoading(true);
      setError(null); // 清除之前的错误
      console.log('[ProfilePage] 开始获取兑换码数据');
      
      const response = await purchaseService.getUserRedeemCodes();
      console.log('[ProfilePage] 兑换码API响应:', response.success);
      
      if (response.success && response.data) {
        console.log('[ProfilePage] 兑换码数据获取成功, 原始数据:', response.data);
        
        try {
          // 检查是否是分页结构 (有list属性)
          let validRedeemCodes: any[] = [];
          
          // 判断响应是否为分页格式
          const isPaginatedResponse = (data: any): data is PaginatedResponse<any> => {
            return data && 
              typeof data === 'object' && 
              'list' in data && 
              Array.isArray(data.list) &&
              'total' in data &&
              'page' in data;
          };
          
          if (isPaginatedResponse(response.data)) {
            console.log('[ProfilePage] 检测到分页结构，使用list属性中的数据，总数:', response.data.total);
            validRedeemCodes = response.data.list;
          } else if (Array.isArray(response.data)) {
            console.log('[ProfilePage] 使用直接返回的数组数据');
            validRedeemCodes = response.data;
          } else {
            console.error('[ProfilePage] 兑换码数据格式异常:', response.data);
            throw new Error('兑换码数据不是数组格式');
          }
          
          // 验证并过滤数据，确保所有必需的字段都存在
          const processedCodes = validRedeemCodes
            .filter((r: any) => r && (r.questionSetId || r.redeemQuestionSet?.id))
            .map((r: any) => {
              const questionSetId = r.questionSetId || r.redeemQuestionSet?.id;
              
              // 确保基本数据
              const redeemRecord: RedeemRecord = {
                id: r.id || r.code || '',
                code: r.code || '',
                questionSetId: questionSetId,
                usedAt: r.usedAt || r.createdAt || new Date().toISOString(),
                expiryDate: r.expiryDate || new Date(Date.now() + 180 * 24 * 60 * 60 * 1000).toISOString(),
                redeemQuestionSet: r.redeemQuestionSet || 
                  (r.questionSet ? { 
                    id: r.questionSet.id, 
                    title: r.questionSet.title || '未知题库',
                    description: r.questionSet.description || ''
                  } : {
                    id: questionSetId,
                    title: r.questionSetTitle || '未知题库',
                    description: r.questionSetDescription || ''
                  })
              };
              
              // 确保redeemQuestionSet中的id与questionSetId一致
              if (redeemRecord.redeemQuestionSet && !redeemRecord.redeemQuestionSet.id) {
                redeemRecord.redeemQuestionSet.id = questionSetId;
              }
              
              return redeemRecord;
            });
        
          console.log('[ProfilePage] 处理后的有效兑换码数量:', processedCodes.length);
          
          if (processedCodes.length === 0 && validRedeemCodes.length > 0) {
            console.warn('[ProfilePage] 警告: 所有兑换码数据处理后无有效记录');
          }
          
          setRedeemCodes(processedCodes);
        } catch (dataError) {
          console.error('[ProfilePage] 处理兑换码数据时出错:', dataError);
          toast.error('处理兑换码数据失败，请联系管理员');
          setRedeemCodes([]); // 设置空数组避免UI错误
        }
      } else {
        console.error('[ProfilePage] 获取兑换码数据失败:', response.message);
        setError(response.message || '获取兑换记录失败');
        toast.error(response.message || '获取兑换记录失败');
        setRedeemCodes([]); // 设置空数组避免UI错误
      }
    } catch (error: any) {
      console.error('[ProfilePage] 获取兑换码异常:', error);
      toast.error('获取兑换记录失败，请稍后重试');
      setRedeemCodes([]);
    } finally {
      setRedeemCodesLoading(false);
    }
  }, [user]);

  // 获取错题集
  const fetchWrongAnswers = useCallback(async () => {
    if (!user) return;
    
    try {
      setWrongAnswersLoading(true);
      const response = await wrongAnswerService.getWrongAnswers();
      
      if (response.success && response.data) {
        // 收集所有题库ID
        const questionSetIds = new Set<string>();
        response.data.forEach((answer: WrongAnswer) => {
          if (answer.questionSetId) {
            questionSetIds.add(answer.questionSetId);
          }
        });
        
        // 如果存在题库ID，获取题库信息
        if (questionSetIds.size > 0) {
          try {
            console.log('[ProfilePage] 获取错题关联的题库信息');
            // 直接调用questionSetService而不是fetchQuestionSets
            const questionsResponse = await questionSetService.getAllQuestionSets();
            const questionSets = questionsResponse.success ? questionsResponse.data || [] : [];
            
            // 创建题库ID到题库名称的映射
            const questionSetMap = new Map<string, string>();
            questionSets.forEach(set => {
              questionSetMap.set(set.id, set.title);
            });
            
            // 增强错题数据，添加正确的题库信息
            const enhancedWrongAnswers = response.data.map((answer: WrongAnswer) => {
              // 如果题库信息缺失，从映射中获取
              if (!answer.questionSet?.title && answer.questionSetId && questionSetMap.has(answer.questionSetId)) {
                return {
                  ...answer,
                  questionSet: {
                    ...answer.questionSet,
                    id: answer.questionSetId,
                    title: questionSetMap.get(answer.questionSetId) || '题库未找到'
                  }
                };
              }
              return answer;
            });
            
            setWrongAnswers(enhancedWrongAnswers);
            console.log('[ProfilePage] 错题集增强完成，数量:', enhancedWrongAnswers.length);
          } catch (err) {
            console.error('[ProfilePage] 获取题库信息失败:', err);
            setWrongAnswers(response.data); // 失败时使用原始数据
          }
        } else {
          setWrongAnswers(response.data);
        }
      } else {
        throw new Error(response.message || '获取错题集失败');
      }
    } catch (error) {
      toast.error('获取错题集失败');
      console.error('[ProfilePage] Error fetching wrong answers:', error);
    } finally {
      setWrongAnswersLoading(false);
    }
  }, [user]);
  
  // Now define loadAllData function after all its dependencies are defined
  const loadAllData = useCallback(async () => {
    setIsLoading(true);
    setError(null);
    
    try {
      console.log('[ProfilePage] 开始加载所有数据');
      
      // 首先检查本地存储中是否有进度数据可以立即显示
      const localData = getLocalProgressData();
      if (localData && Object.keys(localData).length > 0) {
        console.log('[ProfilePage] 找到本地进度数据，优先显示');
        displayLocalProgressData(localData);
      }
      
      // 并行获取所有数据
      await Promise.all([
        fetchProgressData(),
        fetchPurchases(),
        fetchRedeemCodes(),
        fetchWrongAnswers()
      ]);
      
      console.log('[ProfilePage] 所有初始数据加载完成');
    } catch (error) {
      console.error('[ProfilePage] 数据加载失败:', error);
      const localData = getLocalProgressData();
      if (!localData) {
        // 仅当没有本地数据可显示时设置错误
        setError('数据加载失败，请刷新页面重试');
      }
      
      // 如果加载失败，允许再次尝试
      initialDataLoadRef.current = false;
    } finally {
      setIsLoading(false);
    }
  }, [fetchProgressData, fetchPurchases, fetchRedeemCodes, fetchWrongAnswers]);

  // 添加函数恢复可能被意外删除的进度数据
  const attemptToRestoreDeletedProgress = useCallback(() => {
    if (!user?.id) return;
    
    try {
      console.log('[ProfilePage] 检查是否有可恢复的进度数据');
      
      // 检查保护列表
      const protectionKey = `protected_progress_${user.id}`;
      const protectionDataStr = localStorage.getItem(protectionKey);
      
      if (!protectionDataStr) {
        console.log('[ProfilePage] 没有找到保护的进度数据记录');
        return;
      }
      
      const protectionData = JSON.parse(protectionDataStr);
      const protectedKeys = protectionData.protectedKeys || [];
      
      if (!protectedKeys.length) {
        console.log('[ProfilePage] 保护列表为空');
        return;
      }
      
      // 检查哪些受保护的键已经丢失
      const missingKeys: string[] = [];
      protectedKeys.forEach((key: string) => {
        if (!localStorage.getItem(key)) {
          missingKeys.push(key);
        }
      });
      
      if (!missingKeys.length) {
        console.log('[ProfilePage] 所有受保护的进度数据都存在，无需恢复');
        return;
      }
      
      console.log(`[ProfilePage] 发现 ${missingKeys.length} 条丢失的进度数据，尝试恢复`);
      
      // 尝试从备份恢复数据
      const backupKey = `progress_backup_${user.id}`;
      const backupDataStr = localStorage.getItem(backupKey);
      
      if (!backupDataStr) {
        console.log('[ProfilePage] 没有找到备份数据，无法恢复');
        return;
      }
      
      try {
        const backupData = JSON.parse(backupDataStr);
        let restoredCount = 0;
        
        // 尝试恢复每个丢失的键
        missingKeys.forEach((key: string) => {
          if (backupData[key]) {
            localStorage.setItem(key, JSON.stringify(backupData[key]));
            restoredCount++;
          }
        });
        
        if (restoredCount > 0) {
          console.log(`[ProfilePage] 已成功恢复 ${restoredCount} 条进度数据`);
          // 显示一条恢复成功的提示
          toast.success(`已恢复${restoredCount}条学习进度`);
          
          // 刷新显示的进度数据
          fetchProgressData();
        } else {
          console.log('[ProfilePage] 未能恢复任何数据');
        }
      } catch (e) {
        console.error('[ProfilePage] 恢复备份数据时出错:', e);
      }
    } catch (e) {
      console.error('[ProfilePage] 检查/恢复进度数据时出错:', e);
    }
  }, [user?.id, fetchProgressData]);

  // 添加一个新函数，确保学习进度数据不会被意外删除
  const protectLearningProgressData = useCallback(() => {
    if (!user?.id) return;
    
    try {
      console.log('[ProfilePage] 检查并保护学习进度数据');
      
      // 获取所有localStorage中的进度数据
      const progressData: Record<string, any> = {};
      const keysToProtect: string[] = [];
      
      // 遍历localStorage中的所有键，找出学习进度数据
      for (let i = 0; i < localStorage.length; i++) {
        const key = localStorage.key(i);
        if (key && key.startsWith('quiz_progress_')) {
          try {
            const data = localStorage.getItem(key);
            if (data) {
              const parsed = JSON.parse(data);
              // 检查数据是否有效
              if (parsed && parsed.answeredQuestions && parsed.answeredQuestions.length > 0) {
                progressData[key] = parsed;
                keysToProtect.push(key);
                
                // 设置或更新保护标记和时间戳
                parsed.protected = true;
                parsed.protectedAt = Date.now();
                // 保存回localStorage
                localStorage.setItem(key, JSON.stringify(parsed));
              }
            }
          } catch (e) {
            console.error(`[ProfilePage] 解析进度数据失败: ${key}`, e);
          }
        }
      }
      
      // 将要保护的键列表存储在单独的存储位置
      if (keysToProtect.length > 0) {
        const protectionKey = `protected_progress_${user.id}`;
        localStorage.setItem(protectionKey, JSON.stringify({
          userId: user.id,
          protectedKeys: keysToProtect,
          timestamp: Date.now()
        }));
        console.log(`[ProfilePage] 已保护 ${keysToProtect.length} 条学习进度数据`);
        
        // 创建备份
        const backupKey = `progress_backup_${user.id}`;
        localStorage.setItem(backupKey, JSON.stringify(progressData));
        console.log(`[ProfilePage] 已备份 ${Object.keys(progressData).length} 条学习进度数据`);
      }
    } catch (error) {
      console.error('[ProfilePage] 保护学习进度数据失败:', error);
    }
  }, [user?.id]);

  // 优化的useEffect - 现在所有依赖都已经定义
  useEffect(() => {
    if (!user || !socket) return;
    
    console.log('[ProfilePage] 用户ID:', user.id, '，Socket已连接:', socket.connected);
    
    // 记录登录时间，用于保护缓存清理
    const now = Date.now();
    sessionStorage.setItem('last_login_time', now.toString());
    console.log('[ProfilePage] 记录登录时间:', new Date(now).toLocaleTimeString());
    
    // 使用ref避免重复加载
    if (initialDataLoadRef.current) {
      console.log('[ProfilePage] 初始数据已加载，跳过');
      return;
    }
    
    console.log('[ProfilePage] 初始化数据加载');
    
    // 标记初始数据已开始加载
    initialDataLoadRef.current = true;
    
    // 执行数据加载
    loadAllData();
    
    // 在数据加载完成后保护本地进度数据
    setTimeout(() => {
      try {
        if (typeof protectLearningProgressData === 'function') {
          protectLearningProgressData();
        }
      } catch (e) {
        console.error('[ProfilePage] 保护进度数据时出错:', e);
      }
    }, 1000);
    
    // 设置Socket重连后的数据重载
    socket.on('connect', () => {
      console.log('[ProfilePage] Socket重新连接，刷新数据');
      fetchProgressData();
    });
    
    // 设置轮询定时器 - 每5分钟刷新一次数据
    const pollInterval = setInterval(() => {
      console.log('[ProfilePage] 定时刷新数据');
      fetchProgressData();
      fetchPurchases();
      fetchRedeemCodes();
    }, 5 * 60 * 1000); // 5分钟
    
    return () => {
      clearInterval(pollInterval);
      socket.off('connect');
    };
  }, [user, socket, loadAllData, fetchProgressData, fetchPurchases, fetchRedeemCodes]);

  // 优化进度数据更新处理函数 - 添加节流机制
  const handleProgressUpdate = useCallback((data: ProgressData) => {
    console.log('[ProfilePage] 收到进度更新:', data);
    
    // 使用节流控制更新频率 - 60秒内不重复触发完整刷新
    const now = Date.now();
    const lastUpdate = lastProgressUpdateTimeRef.current;
    
    if (now - lastUpdate < 60000) { // 60秒内不重复刷新，从10秒延长到60秒
      console.log('[ProfilePage] 进度更新过于频繁，仅更新本地数据');
      // 仅更新当前进度数据，不触发完整数据重新加载
      setProgress(prevProgress => {
        if (!prevProgress) return { [data.questionSetId]: data };
        
        return {
          ...prevProgress,
          [data.questionSetId]: data
        };
      });
      return;
    }
    
    // 更新最后刷新时间
    lastProgressUpdateTimeRef.current = now;
    
    // 记录到会话存储以在页面刷新后保持节流
    sessionStorage.setItem('last_progress_update', now.toString());
    
    console.log('[ProfilePage] 触发完整进度数据重新加载');
    
    // 获取完整的进度数据
    fetchProgressData();
  }, [fetchProgressData]);

  // 优化 purchase 事件处理函数
  const handlePurchase = useCallback((purchaseData: Purchase) => {
    console.log('[ProfilePage] 收到购买更新:', purchaseData);
    fetchPurchases();
  }, [fetchPurchases]);

  // 优化 redeemCode 事件处理函数
  const handleRedeemCode = useCallback((redeemData: RedeemCode) => {
    console.log('[ProfilePage] 收到兑换码更新:', redeemData);
    fetchRedeemCodes();
  }, [fetchRedeemCodes]);

  // 优化Socket.IO事件处理
  useEffect(() => {
    if (!socket || !user) return;
    
    console.log('[ProfilePage] 设置Socket.IO事件监听器');
    
    // 从会话存储中恢复上次更新时间
    const storedLastUpdate = sessionStorage.getItem('last_progress_update');
    if (storedLastUpdate) {
      lastProgressUpdateTimeRef.current = parseInt(storedLastUpdate, 10);
    }
    
    // 绑定事件处理器
    socket.on('progress:update', handleProgressUpdate);
    socket.on('purchase:new', handlePurchase);
    socket.on('redeemCode:new', handleRedeemCode);
    
    return () => {
      console.log('[ProfilePage] 清理Socket.IO事件监听器');
      socket.off('progress:update', handleProgressUpdate);
      socket.off('purchase:new', handlePurchase);
      socket.off('redeemCode:new', handleRedeemCode);
    };
  }, [socket, user, handleProgressUpdate, handlePurchase, handleRedeemCode]);

  // 添加定期检查题库有效期的功能
  useEffect(() => {
    if (!user || !socket || (!purchases.length && !redeemCodes.length)) return;
    
    // 定期检查题库是否已过期（每小时检查一次）
    const checkExpiryTimer = setInterval(() => {
      console.log('[ProfilePage] 定期检查题库有效期');
      
      // 获取所有题库ID
      const allQuestionSetIds = [
        ...purchases.map(p => p.questionSetId),
        ...redeemCodes.map(r => r.questionSetId)
      ];
      
      if (allQuestionSetIds.length > 0) {
        socket.emit('questionSet:checkAccessBatch', {
          userId: user.id,
          questionSetIds: Array.from(new Set(allQuestionSetIds))
        });
      }
    }, 3600000); // 1小时检查一次
    
    return () => clearInterval(checkExpiryTimer);
  }, [user?.id, socket, purchases.length, redeemCodes.length]);

  // 添加函数检查localStorage中的题库访问缓存是否有效，避免显示过期题库
  const checkAndCleanExpiredCache = useCallback(() => {
    if (!user?.id) return;
    
    try {
      const cacheKey = 'questionSetAccessCache';
      const cache = localStorage.getItem(cacheKey);
      if (!cache) return;
      
      const cacheData = JSON.parse(cache);
      if (!cacheData[user.id]) return;
      
      // 检查是否正在登录中 - 添加登录保护机制
      const lastLoginTime = parseInt(sessionStorage.getItem('last_login_time') || '0', 10);
      const now = Date.now();
      const isRecentLogin = now - lastLoginTime < 5 * 60 * 1000; // 登录后5分钟内不清理缓存
      
      if (isRecentLogin) {
        console.log('[ProfilePage] 检测到最近登录，跳过缓存清理以保护学习进度');
        return;
      }
      
      // 重要：不要清理学习进度数据，只清理题库访问权限缓存
      // 学习进度数据使用 quiz_progress_ 前缀的键存储，这些应该保留
      
      let hasUpdates = false;
      const userCache = cacheData[user.id];
      
      // 仅检查题库访问权限缓存
      Object.keys(userCache).forEach(questionSetId => {
        const record = userCache[questionSetId];
        const cacheAge = Date.now() - record.timestamp;
        
        // 修改缓存失效条件，仅针对访问权限缓存：
        // 1. 缓存超过30天(2592000000毫秒)才清除，从7天延长到30天
        // 2. 题库已过期（剩余天数 <= 0）且过期超过7天，从24小时延长到7天
        const isExcessivelyOld = cacheAge > 2592000000; // 30天
        const isExpiredLongAgo = record.remainingDays !== null && 
                               record.remainingDays <= 0 && 
                               cacheAge > 604800000; // 过期且超过7天
        
        if (isExcessivelyOld || isExpiredLongAgo) {
          console.log(`[ProfilePage] 清理过期访问权限缓存 ${questionSetId}`, 
            isExcessivelyOld ? '缓存超时(30天)' : '题库已过期且超过7天');
          delete userCache[questionSetId];
          hasUpdates = true;
        }
      });
      
      // 如果有更新，保存回localStorage
      if (hasUpdates) {
        cacheData[user.id] = userCache;
        localStorage.setItem(cacheKey, JSON.stringify(cacheData));
        console.log('[ProfilePage] 已清理过期访问权限缓存');
      }
    } catch (error) {
      console.error('[ProfilePage] 检查缓存有效期失败:', error);
    }
  }, [user?.id]);
  
  // 在组件挂载和用户ID变化时检查缓存有效期
  useEffect(() => {
    checkAndCleanExpiredCache();
  }, [checkAndCleanExpiredCache]);
  
  // 定期检查缓存有效期（每小时）
  useEffect(() => {
    if (!user?.id) return;
    
    const timer = setInterval(() => {
      checkAndCleanExpiredCache();
    }, 3600000); // 1小时检查一次
    
    return () => clearInterval(timer);
  }, [user?.id, checkAndCleanExpiredCache]);
  
  // 设置定期保护进度数据
  useEffect(() => {
    if (!user?.id) return;
    
    // 每天检查并保护一次进度数据
    const protectionTimer = setInterval(() => {
      try {
        // 查找所有的进度数据并添加保护标记
        const progressDataKeys: string[] = [];
        const progressDataMap: Record<string, any> = {};
        
        // 遍历localStorage中的所有键，找出学习进度数据
        for (let i = 0; i < localStorage.length; i++) {
          const key = localStorage.key(i);
          if (key && key.startsWith('quiz_progress_')) {
            try {
              const data = localStorage.getItem(key);
              if (data) {
                const parsed = JSON.parse(data);
                if (parsed && parsed.answeredQuestions && parsed.answeredQuestions.length > 0) {
                  // 标记为受保护
                  parsed.protected = true;
                  parsed.protectedAt = Date.now();
                  localStorage.setItem(key, JSON.stringify(parsed));
                  
                  progressDataKeys.push(key);
                  progressDataMap[key] = parsed;
                }
              }
            } catch (e) {
              console.error(`[ProfilePage] 保护进度数据失败: ${key}`, e);
            }
          }
        }
        
        // 保存保护列表和备份
        if (progressDataKeys.length > 0) {
          const protectionKey = `protected_progress_${user.id}`;
          localStorage.setItem(protectionKey, JSON.stringify({
            userId: user.id,
            protectedKeys: progressDataKeys,
            timestamp: Date.now()
          }));
          
          // 创建备份
          const backupKey = `progress_backup_${user.id}`;
          localStorage.setItem(backupKey, JSON.stringify(progressDataMap));
          
          console.log(`[ProfilePage] 定期任务：已保护并备份 ${progressDataKeys.length} 条学习进度数据`);
        }
      } catch (error) {
        console.error('[ProfilePage] 定期保护数据任务失败:', error);
      }
    }, 86400000); // 24小时
    
    return () => clearInterval(protectionTimer);
  }, [user?.id]);

  // 切换标签页
  const handleTabChange = (tab: 'progress' | 'purchases' | 'redeemed' | 'wrong-answers') => {
    setActiveTab(tab);
  };

  // 渲染标签页
  const renderTabs = () => {
    return (
      <div className="mb-6 bg-white rounded-xl shadow-sm overflow-hidden">
        <div className="overflow-x-auto">
          <nav className="flex relative">
            {/* 标签页选项 */}
            <button
              onClick={() => handleTabChange('progress')}
              className={`
                py-4 px-6 font-medium text-sm whitespace-nowrap flex items-center transition-all duration-200
                ${activeTab === 'progress'
                  ? 'text-blue-600'
                  : 'text-gray-500 hover:text-gray-700'}
              `}
            >
              <svg className={`w-4 h-4 mr-2 ${activeTab === 'progress' ? 'text-blue-500' : 'text-gray-400'}`} xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M16 8v8m-4-5v5m-4-2v2m-2 4h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z" />
              </svg>
              学习进度
            </button>
            
            <button
              onClick={() => handleTabChange('wrong-answers')}
              className={`
                py-4 px-6 font-medium text-sm whitespace-nowrap flex items-center transition-all duration-200
                ${activeTab === 'wrong-answers'
                  ? 'text-blue-600'
                  : 'text-gray-500 hover:text-gray-700'}
              `}
            >
              <svg className={`w-4 h-4 mr-2 ${activeTab === 'wrong-answers' ? 'text-blue-500' : 'text-gray-400'}`} xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
              </svg>
              错题集
              {wrongAnswers.length > 0 && (
                <span className={`ml-2 text-xs px-2 py-0.5 rounded-full ${activeTab === 'wrong-answers' ? 'bg-blue-100 text-blue-600' : 'bg-gray-100 text-gray-600'}`}>
                  {wrongAnswers.length}
                </span>
              )}
            </button>
            
            <button
              onClick={() => handleTabChange('purchases')}
              className={`
                py-4 px-6 font-medium text-sm whitespace-nowrap flex items-center transition-all duration-200
                ${activeTab === 'purchases'
                  ? 'text-blue-600'
                  : 'text-gray-500 hover:text-gray-700'}
              `}
            >
              <svg className={`w-4 h-4 mr-2 ${activeTab === 'purchases' ? 'text-blue-500' : 'text-gray-400'}`} xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 3h2l.4 2M7 13h10l4-8H5.4M7 13L5.4 5M7 13l-2.293 2.293c-.63.63-.184 1.707.707 1.707H17m0 0a2 2 0 100 4 2 2 0 000-4zm-8 2a2 2 0 11-4 0 2 2 0 014 0z" />
              </svg>
              已购题库
              {purchases.length > 0 && (
                <span className={`ml-2 text-xs px-2 py-0.5 rounded-full ${activeTab === 'purchases' ? 'bg-blue-100 text-blue-600' : 'bg-gray-100 text-gray-600'}`}>
                  {purchases.length}
                </span>
              )}
            </button>
            
            <button
              onClick={() => handleTabChange('redeemed')}
              className={`
                py-4 px-6 font-medium text-sm whitespace-nowrap flex items-center transition-all duration-200
                ${activeTab === 'redeemed'
                  ? 'text-blue-600'
                  : 'text-gray-500 hover:text-gray-700'}
              `}
            >
              <svg className={`w-4 h-4 mr-2 ${activeTab === 'redeemed' ? 'text-blue-500' : 'text-gray-400'}`} xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 5v2m0 4v2m0 4v2M5 5a2 2 0 00-2 2v3a2 2 0 110 4v3a2 2 0 002 2h14a2 2 0 002-2v-3a2 2 0 110-4V7a2 2 0 00-2-2H5z" />
              </svg>
              已兑换的
              {redeemCodes.length > 0 && (
                <span className={`ml-2 text-xs px-2 py-0.5 rounded-full ${activeTab === 'redeemed' ? 'bg-blue-100 text-blue-600' : 'bg-gray-100 text-gray-600'}`}>
                  {redeemCodes.length}
                </span>
              )}
            </button>
            
            {/* 活动标签指示器 */}
            <div 
              className="absolute bottom-0 h-0.5 bg-blue-500 transition-all duration-300 ease-in-out"
              style={{
                left: activeTab === 'progress' ? '0%' : 
                      activeTab === 'wrong-answers' ? '25%' : 
                      activeTab === 'purchases' ? '50%' : '75%',
                width: '25%'
              }}
            />
          </nav>
        </div>
      </div>
    );
  };

  // 添加删除进度函数
  const handleDeleteProgress = async (questionSetId: string): Promise<void> => {
    if (!user?.id) {
      toast.error('请先登录');
      return;
    }
    
    try {
      console.log(`[ProfilePage] 开始删除题库进度 ${questionSetId}`);
      
      // 1. 删除本地存储中的进度
      const localProgressKey = `quiz_progress_${questionSetId}`;
      localStorage.removeItem(localProgressKey);
      
      // 2. 调用API删除服务器上的进度数据
      if (socket) {
        // 使用socket向服务器发送删除请求
        socket.emit('progress:delete', {
          userId: user.id,
          questionSetId: questionSetId
        });
        
        // 3. 从UI中移除进度卡片
        setProgressStats(prevStats => prevStats.filter(stat => stat.questionSetId !== questionSetId));
        toast.success('学习进度已删除');
        console.log(`[ProfilePage] 题库进度删除成功 ${questionSetId}`);
      } else {
        throw new Error('网络连接失败，请刷新页面重试');
      }
    } catch (error) {
      console.error(`[ProfilePage] 删除题库进度失败:`, error);
      toast.error('删除进度失败，请重试');
    }
  };

  // 修改renderProgressContent函数，确保传递onDelete回调
  const renderProgressContent = () => {
    if (isLoading && !progressStats.length) {
      return (
        <div className="flex flex-col justify-center items-center h-64">
          <div className="w-14 h-14 border-t-2 border-b-2 border-blue-500 rounded-full animate-spin mb-4"></div>
          <p className="text-gray-500 text-sm">加载学习进度中...</p>
        </div>
      );
    }

    if (error && !progressStats.length) {
      return (
        <div className="bg-white p-8 rounded-lg text-center flex flex-col items-center">
          <div className="w-20 h-20 bg-red-50 rounded-full flex items-center justify-center mb-4">
            <svg className="w-10 h-10 text-red-500" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
            </svg>
          </div>
          <h3 className="text-xl font-semibold text-gray-800 mb-2">加载失败</h3>
          <p className="text-gray-600 mb-6 max-w-md">{error}</p>
          <button
            onClick={() => {
              setError(null);
              fetchProgressData();
            }}
            className="bg-blue-500 hover:bg-blue-600 text-white font-medium py-2.5 px-5 rounded-lg transition-colors duration-300 flex items-center"
          >
            <svg className="w-5 h-5 mr-2" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
            </svg>
            重试
          </button>
        </div>
      );
    }

    // 检查progressStats是否为空，并记录当前状态
    console.log('[ProfilePage] 渲染进度内容, progressStats:', 
      progressStats ? `长度: ${progressStats.length}` : 'undefined');
    
    if (!progressStats || progressStats.length === 0) {
      // 最后再次尝试从本地存储读取数据
      const localProgressData = getLocalProgressData();
      if (localProgressData && Object.keys(localProgressData).length > 0) {
        console.log('[ProfilePage] 尝试最后从本地存储加载进度数据');
        // 异步加载本地数据，不阻塞渲染
        setTimeout(() => displayLocalProgressData(localProgressData), 0);
      }
      
      return (
        <div className="bg-white p-8 rounded-lg text-center flex flex-col items-center">
          <div className="w-20 h-20 bg-blue-50 rounded-full flex items-center justify-center mb-4">
            <svg className="w-10 h-10 text-blue-500" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9.663 17h4.673M12 3v1m6.364 1.636l-.707.707M21 12h-1M4 12H3m3.343-5.657l-.707-.707m2.828 9.9a5 5 0 117.072 0l-.548.547A3.374 3.374 0 0014 18.469V19a2 2 0 11-4 0v-.531c0-.895-.356-1.754-.988-2.386l-.548-.547z" />
            </svg>
          </div>
          <h3 className="text-xl font-semibold text-gray-800 mb-2">开始你的学习之旅</h3>
          <p className="text-gray-600 mb-6 max-w-md">你还没有开始答题，点击下面的按钮选择题库开始练习！</p>
          <button
            onClick={() => navigate('/')}
            className="bg-gradient-to-r from-blue-500 to-indigo-600 text-white font-medium py-2.5 px-5 rounded-lg hover:shadow-lg transition-all duration-300 flex items-center"
          >
            <svg className="w-5 h-5 mr-2" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
            </svg>
            开始练习
          </button>
        </div>
      );
    }

    return (
      <div className="grid gap-6 sm:grid-cols-1 md:grid-cols-2 lg:grid-cols-3">
        {progressStats.map((stats) => (
          <ProgressCard 
            key={stats.questionSetId} 
            stats={stats} 
            onDelete={handleDeleteProgress}
          />
        ))}
      </div>
    );
  };

  // 渲染购买内容
  const renderPurchasesContent = () => {
    if (purchasesLoading) {
      return (
        <div className="flex flex-col justify-center items-center h-64">
          <div className="w-14 h-14 border-t-2 border-b-2 border-blue-500 rounded-full animate-spin mb-4"></div>
          <p className="text-gray-500 text-sm">加载购买数据中...</p>
        </div>
      );
    }

    if (purchases.length === 0) {
      return (
        <div className="bg-white p-8 rounded-lg text-center flex flex-col items-center">
          <div className="w-20 h-20 bg-blue-50 rounded-full flex items-center justify-center mb-4">
            <svg className="w-10 h-10 text-blue-500" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 3h2l.4 2M7 13h10l4-8H5.4M7 13L5.4 5M7 13l-2.293 2.293c-.63.63-.184 1.707.707 1.707H17m0 0a2 2 0 100 4 2 2 0 000-4zm-8 2a2 2 0 11-4 0 2 2 0 014 0z" />
            </svg>
          </div>
          <h3 className="text-xl font-semibold text-gray-800 mb-2">暂无购买记录</h3>
          <p className="text-gray-600 mb-6 max-w-md">你还没有购买任何题库，浏览题库并选择感兴趣的内容吧！</p>
          <button
            onClick={() => navigate('/')}
            className="bg-gradient-to-r from-blue-500 to-indigo-600 text-white font-medium py-2.5 px-5 rounded-lg hover:shadow-lg transition-all duration-300 flex items-center"
          >
            <svg className="w-5 h-5 mr-2" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 3h2l.4 2M7 13h10l4-8H5.4M7 13L5.4 5M7 13l-2.293 2.293c-.63.63-.184 1.707.707 1.707H17m0 0a2 2 0 100 4 2 2 0 000-4zm-8 2a2 2 0 11-4 0 2 2 0 014 0z" />
            </svg>
            浏览题库
          </button>
        </div>
      );
    }

    return (
      <div>
        <h2 className="text-xl font-semibold mb-6 flex items-center text-gray-800">
          <svg className="w-6 h-6 mr-2 text-blue-500" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 3h2l.4 2M7 13h10l4-8H5.4M7 13L5.4 5M7 13l-2.293 2.293c-.63.63-.184 1.707.707 1.707H17m0 0a2 2 0 100 4 2 2 0 000-4zm-8 2a2 2 0 11-4 0 2 2 0 014 0z" />
          </svg>
          已购买的题库
        </h2>
        <div className="grid gap-6 sm:grid-cols-1 md:grid-cols-2 lg:grid-cols-3">
          {purchases.map((purchase) => (
            <PurchaseCard key={purchase.id} purchase={purchase} />
          ))}
        </div>
      </div>
    );
  };

  // 渲染兑换码内容
  const renderRedeemedContent = () => {
    if (redeemCodesLoading) {
      return (
        <div className="flex flex-col justify-center items-center h-64">
          <div className="w-14 h-14 border-t-2 border-b-2 border-blue-500 rounded-full animate-spin mb-4"></div>
          <p className="text-gray-500 text-sm">加载兑换数据中...</p>
        </div>
      );
    }

    if (error) {
      return (
        <div className="bg-white p-8 rounded-lg text-center flex flex-col items-center">
          <div className="w-20 h-20 bg-red-50 rounded-full flex items-center justify-center mb-4">
            <svg className="w-10 h-10 text-red-500" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
            </svg>
          </div>
          <h3 className="text-xl font-semibold text-gray-800 mb-2">获取兑换码失败</h3>
          <p className="text-gray-600 mb-6 max-w-md">{error}</p>
          <button
            onClick={() => {
              setError(null);
              fetchRedeemCodes();
            }}
            className="bg-blue-500 hover:bg-blue-600 text-white font-medium py-2.5 px-5 rounded-lg transition-colors duration-300 flex items-center"
          >
            <svg className="w-5 h-5 mr-2" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
            </svg>
            重试
          </button>
        </div>
      );
    }

    if (redeemCodes.length === 0) {
      return (
        <div className="bg-white p-8 rounded-lg text-center flex flex-col items-center">
          <div className="w-20 h-20 bg-purple-50 rounded-full flex items-center justify-center mb-4">
            <svg className="w-10 h-10 text-purple-500" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 5v2m0 4v2m0 4v2M5 5a2 2 0 00-2 2v3a2 2 0 110 4v3a2 2 0 002 2h14a2 2 0 002-2v-3a2 2 0 110-4V7a2 2 0 00-2-2H5z" />
            </svg>
          </div>
          <h3 className="text-xl font-semibold text-gray-800 mb-2">暂无兑换记录</h3>
          <p className="text-gray-600 mb-6 max-w-md">使用兑换码可以快速解锁完整题库内容，获取更多学习资源！</p>
          <button
            onClick={() => navigate('/')}
            className="bg-gradient-to-r from-purple-500 to-indigo-600 text-white font-medium py-2.5 px-5 rounded-lg hover:shadow-lg transition-all duration-300 flex items-center"
          >
            <svg className="w-5 h-5 mr-2" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
            </svg>
            浏览题库
          </button>
        </div>
      );
    }

    return (
      <div>
        <h2 className="text-xl font-semibold mb-6 flex items-center text-gray-800">
          <svg className="w-6 h-6 mr-2 text-purple-500" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 5v2m0 4v2m0 4v2M5 5a2 2 0 00-2 2v3a2 2 0 110 4v3a2 2 0 002 2h14a2 2 0 002-2v-3a2 2 0 110-4V7a2 2 0 00-2-2H5z" />
          </svg>
          已兑换的题库
        </h2>
        <div className="grid gap-6 sm:grid-cols-1 md:grid-cols-2 lg:grid-cols-3">
          {redeemCodes.map((redeemCode) => (
            <RedeemCard key={redeemCode.id} redeem={redeemCode} />
          ))}
        </div>
      </div>
    );
  };

  // 渲染错题集内容
  const renderWrongAnswersContent = () => {
    if (wrongAnswersLoading) {
      return (
        <div className="flex flex-col justify-center items-center h-64">
          <div className="w-14 h-14 border-t-2 border-b-2 border-blue-500 rounded-full animate-spin mb-4"></div>
          <p className="text-gray-500 text-sm">加载错题数据中...</p>
        </div>
      );
    }

    if (wrongAnswers.length === 0) {
      return (
        <div className="bg-white p-8 rounded-lg text-center flex flex-col items-center">
          <div className="w-20 h-20 bg-red-50 rounded-full flex items-center justify-center mb-4">
            <svg className="w-10 h-10 text-red-500" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
            </svg>
          </div>
          <h3 className="text-xl font-semibold text-gray-800 mb-2">暂无错题记录</h3>
          <p className="text-gray-600 mb-6 max-w-md">答错的题目会自动添加到错题集，继续答题积累吧！</p>
          <button
            onClick={() => navigate('/')}
            className="bg-gradient-to-r from-red-500 to-orange-500 text-white font-medium py-2.5 px-5 rounded-lg hover:shadow-lg transition-all duration-300 flex items-center"
          >
            <svg className="w-5 h-5 mr-2" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M14.752 11.168l-3.197-2.132A1 1 0 0010 9.87v4.263a1 1 0 001.555.832l3.197-2.132a1 1 0 000-1.664z" />
            </svg>
            开始练习
          </button>
        </div>
      );
    }

    const groups = groupedWrongAnswers();

    return (
      <div>
        <div className="flex justify-between items-center mb-6">
          <h2 className="text-xl font-semibold flex items-center text-gray-800">
            <svg className="w-6 h-6 mr-2 text-red-500" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
            </svg>
            错题集 ({wrongAnswers.length}题)
          </h2>
          <div className="bg-red-50 text-red-600 text-sm px-3 py-1 rounded-full border border-red-100">
            答错的题目会自动添加到错题集
          </div>
        </div>
        
        {groups.map(group => (
          <WrongAnswerGroupComponent
            key={group.questionSetId}
            group={group}
            onDelete={handleDeleteWrongAnswer}
            onUpdateMemo={handleUpdateMemo}
            onPractice={handlePracticeWrongAnswers}
          />
        ))}
      </div>
    );
  };

  // 分组错题集
  const groupedWrongAnswers = useCallback(() => {
    const groups: { [key: string]: WrongAnswerGroup } = {};
    
    wrongAnswers.forEach(answer => {
      const setId = answer.questionSetId;
      // 改进标题获取逻辑
      let setTitle = '未知题库';
      
      // 尝试从不同来源获取题库名称
      if (answer.questionSet?.title) {
        setTitle = answer.questionSet.title;
      } else if (typeof answer.questionSetId === 'string') {
        // 如果没有标题但有ID，使用ID的一部分作为备选
        setTitle = `题库 (ID: ${answer.questionSetId.substring(0, 8)}...)`;
      }
      
      if (!groups[setId]) {
        groups[setId] = {
          questionSetId: setId,
          questionSetTitle: setTitle,
          wrongAnswers: []
        };
      } else if (setTitle !== '未知题库' && groups[setId].questionSetTitle === '未知题库') {
        // 如果已经有分组但使用的是默认标题，且当前答案有更好的标题，则更新分组标题
        groups[setId].questionSetTitle = setTitle;
      }
      
      groups[setId].wrongAnswers.push(answer);
    });
    
    // 按错题数量降序排列
    return Object.values(groups).sort((a, b) => b.wrongAnswers.length - a.wrongAnswers.length);
  }, [wrongAnswers]);

  // 删除错题
  const handleDeleteWrongAnswer = async (id: string) => {
    try {
      const response = await wrongAnswerService.deleteWrongAnswer(id);
      
      if (response.success) {
        setWrongAnswers(prevAnswers => prevAnswers.filter(answer => answer.id !== id));
        toast.success('删除成功');
      } else {
        throw new Error(response.message || '删除失败');
      }
    } catch (error) {
      toast.error('删除错题失败');
      console.error('[ProfilePage] Error deleting wrong answer:', error);
    }
  };

  // 更新错题备注
  const handleUpdateMemo = async (id: string, memo: string) => {
    try {
      const response = await wrongAnswerService.updateMemo(id, memo);
      
      if (response.success) {
        setWrongAnswers(prevAnswers => 
          prevAnswers.map(answer => 
            answer.id === id ? { ...answer, memo } : answer
          )
        );
        toast.success('更新备注成功');
      } else {
        throw new Error(response.message || '更新备注失败');
      }
    } catch (error) {
      toast.error('更新备注失败');
      console.error('[ProfilePage] Error updating memo:', error);
    }
  };

  // 更新错题练习功能
  const handlePracticeWrongAnswers = (questionSetId: string) => {
    // 创建问题ID列表，用于URL参数传递
    const group = groupedWrongAnswers().find(g => g.questionSetId === questionSetId);
    
    if (group && group.wrongAnswers.length > 0) {
      // 收集错题的questionId
      const wrongQuestionIds = group.wrongAnswers.map(answer => answer.questionId).join(',');
      
      // 导航到指定题库，并传递错题ID列表和错题模式参数
      navigate(`/quiz/${questionSetId}?mode=wrong-answers&questions=${wrongQuestionIds}`);
    } else {
      // 如果没有找到错题，使用原有的方式
      navigate(`/quiz/${questionSetId}?mode=wrong-answers`);
    }
  };

  // 在组件挂载时尝试恢复数据
  useEffect(() => {
    if (user?.id) {
      // 先尝试恢复数据
      attemptToRestoreDeletedProgress();
      
      // 然后保护现有数据
      setTimeout(() => {
        protectLearningProgressData();
      }, 1000);
      
      // 每天检查并保护一次进度数据
      const protectionTimer = setInterval(() => {
        protectLearningProgressData();
      }, 86400000); // 24小时
      
      return () => clearInterval(protectionTimer);
    }
  }, [user?.id]); // Remove attemptToRestoreDeletedProgress and protectLearningProgressData from dependencies

  return (
    <div className="min-h-screen bg-gray-50">
      {/* 顶部个人信息卡片 */}
      <div className="bg-gradient-to-r from-blue-500 to-indigo-600 text-white">
        <div className="container mx-auto px-4 py-8">
          <div className="flex flex-col md:flex-row items-center justify-between">
            <div className="flex items-center mb-4 md:mb-0">
              <div className="w-16 h-16 rounded-full bg-white/20 flex items-center justify-center text-white text-2xl font-bold shadow-lg">
                {user?.username ? user.username.charAt(0).toUpperCase() : '?'}
              </div>
              <div className="ml-4">
                <h1 className="text-2xl font-bold">{user?.username || '加载中...'}</h1>
                <p className="text-blue-100">{user?.email || ''}</p>
              </div>
            </div>
            <div className="flex space-x-4">
              <button 
                onClick={() => navigate('/')}
                className="px-4 py-2 bg-white/10 backdrop-blur-sm rounded-md hover:bg-white/20 transition-all flex items-center text-sm"
              >
                <svg className="w-4 h-4 mr-2" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 12l2-2m0 0l7-7 7 7M5 10v10a1 1 0 001 1h3m10-11l2 2m-2-2v10a1 1 0 01-1 1h-3m-6 0a1 1 0 001-1v-4a1 1 0 011-1h2a1 1 0 011 1v4a1 1 0 001 1m-6 0h6" />
                </svg>
                浏览题库
              </button>
              <button 
                onClick={() => window.location.reload()}
                className="px-4 py-2 bg-white/10 backdrop-blur-sm rounded-md hover:bg-white/20 transition-all flex items-center text-sm"
              >
                <svg className="w-4 h-4 mr-2" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
                </svg>
                刷新数据
              </button>
            </div>
          </div>
        </div>
      </div>
      
      {/* 主内容区域 */}
      <div className="container mx-auto px-4 py-6">
        <div className="mb-6">
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-xl font-semibold text-gray-800 flex items-center">
              <svg className="w-5 h-5 mr-2 text-blue-500" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
              </svg>
              考试倒计时
            </h2>
            <span className="text-sm text-gray-500 bg-gray-100 px-2 py-1 rounded-full">与首页同步</span>
          </div>
          <div className="bg-white rounded-xl shadow-sm p-4">
            <ExamCountdownWidget theme="light" />
          </div>
        </div>
        
        {renderTabs()}
        
        <div className="bg-white rounded-xl shadow-sm p-6">
          {activeTab === 'progress' && renderProgressContent()}
          {activeTab === 'purchases' && renderPurchasesContent()}
          {activeTab === 'wrong-answers' && renderWrongAnswersContent()}
          {activeTab === 'redeemed' && renderRedeemedContent()}
        </div>
      </div>
    </div>
  );
};

export default ProfilePage;