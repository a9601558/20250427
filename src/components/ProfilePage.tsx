import React, { useEffect, useState, useCallback } from 'react';
import { useUser } from '../contexts/UserContext';
import { useSocket } from '../contexts/SocketContext';
import { toast } from 'react-toastify';
import { userProgressService, questionSetService, purchaseService, wrongAnswerService } from '../services/api';
import { useNavigate } from 'react-router-dom';
import ExamCountdownWidget from './ExamCountdownWidget';

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

// 错题记录类型
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
    day: 'numeric',
  });
};

interface ProgressCardProps {
  stats: ProgressStats;
}

const ProgressCard: React.FC<ProgressCardProps> = ({ stats }) => {
  const navigate = useNavigate();

  return (
    <div 
      className="bg-white rounded-xl shadow-sm hover:shadow-md transition-all duration-300 overflow-hidden cursor-pointer transform hover:-translate-y-1 border border-gray-100"
      onClick={() => navigate(`/quiz/${stats.questionSetId}`)}
    >
      {/* 卡片顶部带颜色条 */}
      <div className="h-2 bg-gradient-to-r from-blue-400 to-indigo-500"></div>
      
      <div className="p-5">
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
  const expiryDate = new Date(purchase.expiryDate);
  const now = new Date();
  const isExpired = expiryDate < now;
  
  // 计算剩余天数
  const remainingDays = Math.max(0, Math.ceil((expiryDate.getTime() - now.getTime()) / (1000 * 60 * 60 * 24)));
  
  // 计算总有效期 - 直接使用180天作为标准有效期，而不是根据购买日期和过期日期计算
  const purchaseDate = new Date(purchase.purchaseDate);
  
  // 标准有效期180天 - 与知识付费的标准时长一致
  const totalValidityDays = 180;
  
  // 获取题库标题
  const title = purchase.purchaseQuestionSet?.title || purchase.questionSet?.title || '未知题库';
  
  // 使用剩余天数确定颜色
  const getStatusColorClass = () => {
    if (isExpired) return 'text-red-500 bg-red-50 border-red-100';
    if (remainingDays < 30) return 'text-orange-500 bg-orange-50 border-orange-100';
    return 'text-emerald-500 bg-emerald-50 border-emerald-100';
  };
  
  return (
    <div className="bg-white rounded-xl shadow-sm hover:shadow-md transition-all duration-300 overflow-hidden border border-gray-100 transform hover:-translate-y-1">
      {/* 顶部状态条 */}
      <div className={`h-2 ${isExpired ? 'bg-red-500' : 'bg-gradient-to-r from-blue-400 to-indigo-500'}`}></div>
      
      <div className="p-5">
      <div className="flex justify-between items-start mb-4">
          <h2 className="text-lg font-semibold text-gray-800 truncate flex items-center">
            <svg className="w-5 h-5 mr-2 text-blue-500 flex-shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 6.253v13m0-13C10.832 5.477 9.246 5 7.5 5S4.168 5.477 3 6.253v13C4.168 18.477 5.754 18 7.5 18s3.332.477 4.5 1.253m0-13C13.168 5.477 14.754 5 16.5 5c1.747 0 3.332.477 4.5 1.253v13C19.832 18.477 18.247 18 16.5 18c-1.746 0-3.332.477-4.5 1.253" />
            </svg>
            {title}
          </h2>
          <div className={`px-3 py-1 text-xs font-medium rounded-full ${getStatusColorClass()}`}>
            {isExpired ? '已过期' : remainingDays < 30 ? '即将过期' : '有效'}
          </div>
      </div>
      
        <div className="space-y-1 mt-5 mb-6">
          <div className="flex items-center px-3 py-2 rounded-lg bg-gray-50">
            <svg className="w-5 h-5 text-gray-400 mr-3" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" />
            </svg>
            <div className="flex-1">
              <div className="text-xs text-gray-500">购买日期</div>
              <div className="text-sm font-medium">{formatDate(purchase.purchaseDate)}</div>
        </div>
        </div>
          
          <div className="flex items-center px-3 py-2 rounded-lg bg-gray-50">
            <svg className="w-5 h-5 text-gray-400 mr-3" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
            </svg>
            <div className="flex-1">
              <div className="text-xs text-gray-500">到期日期</div>
              <div className={`text-sm font-medium ${isExpired ? 'text-red-500' : ''}`}>{formatDate(purchase.expiryDate)}</div>
        </div>
        </div>
        
          <div className="flex items-center px-3 py-2 rounded-lg bg-gray-50">
            <svg className="w-5 h-5 text-gray-400 mr-3" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 9V7a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2m2 4h10a2 2 0 002-2v-6a2 2 0 00-2-2H9a2 2 0 00-2 2v6a2 2 0 002 2z" />
            </svg>
            <div className="flex-1">
              <div className="text-xs text-gray-500">支付金额</div>
              <div className="text-sm font-medium">¥{purchase.amount.toFixed(2)}</div>
          </div>
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
          onClick={() => navigate(`/quiz/${purchase.questionSetId}`)}
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
  onPractice,
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
      let optionClass = 'p-3 my-1.5 rounded-lg flex items-start border ';
      
      if (isCorrect) {
        optionClass += 'bg-green-50 border-green-200 ';
      } else if (isSelected) {
        optionClass += 'bg-red-50 border-red-200 ';
      } else {
        optionClass += 'bg-gray-50 border-gray-200 ';
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
      minute: '2-digit',
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
  onPractice,
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
          {group.wrongAnswers.map((wrongAnswer) => (
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

  // 在前端计算进度统计
  const calculateProgressStats = useCallback((records: ProgressRecord[], questionSets: Map<string, QuestionSet>) => {
    // 按题库ID分组
    const progressMap = new Map<string, Map<string, ProgressRecord>>();
    
    // 处理每条记录，按题库和题目分组，保留最后一次作答
    records.forEach((record) => {
      const qsId = record.questionSetId;
      const qId = record.questionId;
      
      if (!progressMap.has(qsId)) {
        progressMap.set(qsId, new Map<string, ProgressRecord>());
      }
      
      const questionMap = progressMap.get(qsId)!;
      
      // 如果题目不存在或当前记录更新，则更新记录
      if (!questionMap.has(qId) || 
          (record.createdAt && questionMap.get(qId)!.createdAt && 
           new Date(record.createdAt) > new Date(questionMap.get(qId)!.createdAt!))) {
        questionMap.set(qId, record);
      }
    });
    
    // 生成最终统计结果
    const stats: ProgressStats[] = [];
    
    progressMap.forEach((questionMap, questionSetId) => {
      // 只处理有作答记录的题库
      if (questionMap.size > 0) {
        // 获取该题库的所有最终记录
        const finalRecords = Array.from(questionMap.values());
        
        // 统计数据
        const completedQuestions = finalRecords.length;
        const correctAnswers = finalRecords.filter((r) => r.isCorrect).length;
        const totalTimeSpent = finalRecords.reduce((sum, r) => sum + r.timeSpent, 0);
        const averageTimeSpent = completedQuestions > 0 ? totalTimeSpent / completedQuestions : 0;
        const accuracy = Math.min(100, (correctAnswers / completedQuestions) * 100);
        
        // 获取题库标题
        const title = questionSets.get(questionSetId)?.title || 
                     finalRecords[0]?.progressQuestionSet?.title || 
                     'Unknown Set';
        
        stats.push({
          questionSetId,
          title,
          completedQuestions,
          correctAnswers,
          totalTimeSpent,
          averageTimeSpent,
          accuracy,
        });
      }
    });
    
    return stats;
  }, []);

  // 处理实时进度更新
  const handleProgressUpdate = useCallback(async () => {
    try {
      setIsLoading(true);
      
      const questionSetsResponse = await questionSetService.getAllQuestionSets();
      const questionSetsMap = new Map<string, QuestionSet>();
      
      if (questionSetsResponse.success && questionSetsResponse.data) {
        questionSetsResponse.data.forEach((qs) => {
          questionSetsMap.set(qs.id, { id: qs.id, title: qs.title });
        });
      }
      
      const progressResponse = await userProgressService.getUserProgressRecords();
      
      if (progressResponse.success && progressResponse.data) {
        const stats = calculateProgressStats(progressResponse.data, questionSetsMap);
        setProgressStats(stats);
      } else {
        throw new Error(progressResponse.message || 'Failed to fetch progress');
      }
    } catch (error) {
      toast.error('获取学习进度失败');
      console.error('[ProfilePage] Error fetching progress:', error);
    } finally {
      setIsLoading(false);
    }
  }, [calculateProgressStats]);

  // 获取购买数据
  const fetchPurchases = useCallback(async () => {
    if (!user) return;
    
    try {
      setPurchasesLoading(true);
      const response = await purchaseService.getUserPurchases();
      
      if (response.success && response.data) {
        // 确保返回的数据格式正确，并过滤掉通过兑换码获得的记录
        const validPurchases = response.data
          .filter((p: any) => p && p.questionSetId) // 过滤掉无效记录
          .filter((p: any) => p.amount > 0 && p.paymentMethod !== 'redeem') // 过滤掉通过兑换码获得的题库
          .map((p: any) => {
            // 确保必需字段
            const purchase: Purchase = {
              id: p.id || '', // 确保id为字符串
              questionSetId: p.questionSetId,
              purchaseDate: p.purchaseDate,
              expiryDate: p.expiryDate,
              amount: typeof p.amount === 'string' ? parseFloat(p.amount) : (p.amount || 0), // 确保amount是数字
              status: p.status,
              paymentMethod: p.paymentMethod,
              transactionId: p.transactionId,
              // 处理关联数据兼容性问题
              purchaseQuestionSet: p.purchaseQuestionSet || 
                (p.questionSet ? { 
                  id: p.questionSet.id, 
                  title: p.questionSet.title,
                  description: p.questionSet.description,
                } : undefined),
            };
            return purchase;
          });
        
        setPurchases(validPurchases);
      } else {
        throw new Error(response.message || '获取购买记录失败');
      }
    } catch (error) {
      toast.error('获取购买记录失败');
      console.error('[ProfilePage] Error fetching purchases:', error);
    } finally {
      setPurchasesLoading(false);
    }
  }, [user]);

  // 获取兑换码数据
  const fetchRedeemCodes = useCallback(async () => {
    if (!user) return;
    
    try {
      setRedeemCodesLoading(true);
      const response = await purchaseService.getUserRedeemCodes();
      
      if (response.success && response.data) {
        const validRedeemCodes = response.data
          .filter((r: any) => r && r.questionSetId)
          .map((r: any) => {
            const redeemRecord: RedeemRecord = {
              id: r.id || '',
              code: r.code,
              questionSetId: r.questionSetId,
              usedAt: r.usedAt || r.createdAt,
              expiryDate: r.expiryDate,
              redeemQuestionSet: r.redeemQuestionSet || 
                (r.questionSet ? { 
                  id: r.questionSet.id, 
                  title: r.questionSet.title,
                  description: r.questionSet.description,
                } : undefined),
            };
            return redeemRecord;
          });
        
        setRedeemCodes(validRedeemCodes);
      } else {
        throw new Error(response.message || '获取兑换记录失败');
      }
    } catch (error) {
      toast.error('获取兑换记录失败');
      console.error('[ProfilePage] Error fetching redeem codes:', error);
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
        setWrongAnswers(response.data);
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

  useEffect(() => {
    if (!socket || !user) return;

    // 初始加载数据
    handleProgressUpdate();
    fetchPurchases();
    fetchRedeemCodes();
    fetchWrongAnswers();

    // 发送验证请求，检查所有题库的访问状态
    const checkAccessForAllSets = () => {
      // 组合购买和兑换的所有题库ID
      const allQuestionSetIds = new Set([
        ...purchases.map((p) => p.questionSetId), 
        ...redeemCodes.map((r) => r.questionSetId),
      ]);
      
      // 为每个题库发送访问权限验证请求
      allQuestionSetIds.forEach((questionSetId) => {
        if (questionSetId) {
          socket.emit('questionSet:checkAccess', {
            userId: user.id,
            questionSetId,
          });
        }
      });
    };

    // 监听实时更新
    socket.on('progress:update', handleProgressUpdate);
    socket.on('purchase:success', fetchPurchases);
    socket.on('redeem:success', fetchRedeemCodes);
    
    // 监听连接状态变化，重连时重新检查权限
    socket.on('connect', () => {
      fetchPurchases();
      fetchRedeemCodes();
      // 延迟执行检查，确保数据已加载
      setTimeout(() => {
        checkAccessForAllSets();
      }, 1000);
    });

    // 单独设置一个useEffect来监听数据变化并检查访问权限
    const accessCheckTimer = setTimeout(checkAccessForAllSets, 500);

    // 监听错题保存事件
    socket.on('wrongAnswer:save', fetchWrongAnswers);

    return () => {
      socket.off('progress:update', handleProgressUpdate);
      socket.off('purchase:success', fetchPurchases);
      socket.off('redeem:success', fetchRedeemCodes);
      socket.off('connect');
      clearTimeout(accessCheckTimer);
      socket.off('wrongAnswer:save', fetchWrongAnswers);
    };
  }, [socket, user, handleProgressUpdate, fetchPurchases, fetchRedeemCodes, fetchWrongAnswers]);

  // 单独监听题库数据变化，更新访问权限检查
  useEffect(() => {
    if (!socket || !user || (!purchases.length && !redeemCodes.length)) return;
    
    // 只有当数据加载完成后才检查访问权限
    const checkAccess = () => {
      const allQuestionSetIds = new Set([
        ...purchases.map((p) => p.questionSetId), 
        ...redeemCodes.map((r) => r.questionSetId),
      ]);
      
      allQuestionSetIds.forEach((questionSetId) => {
        if (questionSetId) {
          socket.emit('questionSet:checkAccess', {
            userId: user.id,
            questionSetId,
          });
        }
      });
    };
    
    // 使用延迟执行，避免频繁触发
    const timer = setTimeout(checkAccess, 800);
    
    return () => clearTimeout(timer);
  }, [socket, user, purchases.length, redeemCodes.length]);

  // 在现有的用户数据和socket监听部分添加
  useEffect(() => {
    // 用户ID变化时（登出或切换账号）清除localStorage缓存
    return () => {
      // 清除的是旧用户的缓存，所以应该在effect清理函数中执行
      if (user?.id) {
        try {
          const cache = localStorage.getItem('questionSetAccessCache');
          if (cache) {
            const cacheData = JSON.parse(cache);
            // 只删除当前用户的缓存，保留其他用户
            if (cacheData[user.id]) {
              delete cacheData[user.id];
              localStorage.setItem('questionSetAccessCache', JSON.stringify(cacheData));
              console.log('[ProfilePage] 用户切换，已清除缓存', user.id);
            }
          }
        } catch (error) {
          console.error('[ProfilePage] 清除缓存失败:', error);
        }
      }
    };
  }, [user?.id]);

  // 在purchase:success和redeem:success事件处理函数中添加以下代码，在已购买题库的useEffect中
  useEffect(() => {
    // socket为空时不执行
    if (!socket || !user) return;
    
    // 添加购买成功后的首页刷新通知
    const notifyHomePageRefresh = () => {
      // 通过自定义事件通知其他页面（尤其是首页）刷新题库状态
      window.dispatchEvent(new CustomEvent('questionSets:refreshAccess'));
      
      // 如果有socket，直接触发检查
      const allQuestionSetIds = [...purchases.map((p) => p.questionSetId), ...redeemCodes.map((r) => r.questionSetId)];
      
      if (allQuestionSetIds.length > 0) {
        console.log('[ProfilePage] 通知首页刷新题库状态');
        socket.emit('questionSet:checkAccessBatch', {
          userId: user.id,
          questionSetIds: Array.from(new Set(allQuestionSetIds)),
        });
      }
    };
    
    // 监听购买和兑换码成功事件
    socket.on('purchase:success', notifyHomePageRefresh);
    socket.on('redeem:success', notifyHomePageRefresh);
    
    return () => {
      socket.off('purchase:success', notifyHomePageRefresh);
      socket.off('redeem:success', notifyHomePageRefresh);
    };
  }, [socket, user, purchases, redeemCodes]);

  // 添加定期检查题库有效期的功能
  useEffect(() => {
    if (!user || !socket || (!purchases.length && !redeemCodes.length)) return;
    
    // 定期检查题库是否已过期（每小时检查一次）
    const checkExpiryTimer = setInterval(() => {
      console.log('[ProfilePage] 定期检查题库有效期');
      
      // 获取所有题库ID
      const allQuestionSetIds = [
        ...purchases.map((p) => p.questionSetId),
        ...redeemCodes.map((r) => r.questionSetId),
      ];
      
      if (allQuestionSetIds.length > 0) {
        socket.emit('questionSet:checkAccessBatch', {
          userId: user.id,
          questionSetIds: Array.from(new Set(allQuestionSetIds)),
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
      
      let hasUpdates = false;
      const userCache = cacheData[user.id];
      
      // 检查每个题库的缓存是否过期
      Object.keys(userCache).forEach((questionSetId) => {
        const record = userCache[questionSetId];
        const cacheAge = Date.now() - record.timestamp;
        
        // 缓存失效条件：
        // 1. 缓存超过24小时
        // 2. 题库已过期（剩余天数 <= 0）
        if (cacheAge > 86400000 || (record.remainingDays !== null && record.remainingDays <= 0)) {
          console.log(`[ProfilePage] 清理过期缓存 ${questionSetId}`, 
            cacheAge > 86400000 ? '缓存超时' : '题库已过期');
          delete userCache[questionSetId];
          hasUpdates = true;
        }
      });
      
      // 如果有更新，保存回localStorage
      if (hasUpdates) {
        cacheData[user.id] = userCache;
        localStorage.setItem(cacheKey, JSON.stringify(cacheData));
        console.log('[ProfilePage] 已清理过期缓存');
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
                width: '25%',
              }}
            />
        </nav>
        </div>
      </div>
    );
  };

  // 渲染进度内容
  const renderProgressContent = () => {
  if (isLoading) {
      return (
        <div className="flex flex-col justify-center items-center h-64">
          <div className="w-14 h-14 border-t-2 border-b-2 border-blue-500 rounded-full animate-spin mb-4"></div>
          <p className="text-gray-500 text-sm">加载学习数据中...</p>
        </div>
      );
  }

    if (progressStats.length === 0) {
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
            <ProgressCard key={stats.questionSetId} stats={stats} />
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
        
        {groups.map((group) => (
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
    
    wrongAnswers.forEach((answer) => {
      const setId = answer.questionSetId;
      const setTitle = answer.questionSet?.title || '未知题库';
      
      if (!groups[setId]) {
        groups[setId] = {
          questionSetId: setId,
          questionSetTitle: setTitle,
          wrongAnswers: [],
        };
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
        setWrongAnswers((prevAnswers) => prevAnswers.filter((answer) => answer.id !== id));
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
        setWrongAnswers((prevAnswers) => 
          prevAnswers.map((answer) => 
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
    const group = groupedWrongAnswers().find((g) => g.questionSetId === questionSetId);
    
    if (group && group.wrongAnswers.length > 0) {
      // 收集错题的questionId
      const wrongQuestionIds = group.wrongAnswers.map((answer) => answer.questionId).join(',');
      
      // 导航到指定题库，并传递错题ID列表和错题模式参数
      navigate(`/quiz/${questionSetId}?mode=wrong-answers&questions=${wrongQuestionIds}`);
    } else {
      // 如果没有找到错题，使用原有的方式
      navigate(`/quiz/${questionSetId}?mode=wrong-answers`);
    }
  };

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
      {activeTab === 'progress' ? renderProgressContent() : 
       activeTab === 'purchases' ? renderPurchasesContent() : 
           activeTab === 'wrong-answers' ? renderWrongAnswersContent() :
       renderRedeemedContent()}
        </div>
      </div>
    </div>
  );
};

export default ProfilePage;
