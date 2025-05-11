import React, { useState, useEffect, useCallback, useRef } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useUser } from '../contexts/UserContext';
import { useSocket } from '../contexts/SocketContext';
import { useUserProgress } from '../contexts/UserProgressContext';
import apiClient from '../utils/api-client';
import ExamCountdownWidget from './ExamCountdownWidget';
import { homepageService } from '../services/api';
import { toast } from 'react-toastify';
import { throttleContentFetch, detectLoop, isBlocked, httpLimiter } from '../utils/loopPrevention';

import { 
  HomeContentData, 
  HomeContentDataDB, 
  defaultHomeContent, 
  convertDbToFrontend, 
  convertFrontendToDb,
  getHomeContentFromLocalStorage,
  saveHomeContentToLocalStorage,
  triggerHomeContentUpdateEvent
} from '../utils/homeContentUtils';

// 添加自定义样式
const customStyles = `
  @keyframes float {
    0% { transform: translateY(0px); }
    50% { transform: translateY(-10px); }
    100% { transform: translateY(0px); }
  }
  
  @keyframes fadeIn {
    from { opacity: 0; transform: translateY(10px); }
    to { opacity: 1; transform: translateY(0); }
  }
  
  @keyframes glow {
    0% { box-shadow: 0 0 5px rgba(59, 130, 246, 0.5); }
    50% { box-shadow: 0 0 20px rgba(59, 130, 246, 0.8); }
    100% { box-shadow: 0 0 5px rgba(59, 130, 246, 0.5); }
  }
  
  @keyframes shimmer {
    0% { background-position: -200% 0; }
    100% { background-position: 200% 0; }
  }

  @keyframes gradientBg {
    0% { background-position: 0% 50%; }
    50% { background-position: 100% 50%; }
    100% { background-position: 0% 50%; }
  }
  
  @keyframes scan {
    from { transform: translateY(-50%); }
    to { transform: translateY(0); }
  }
  
  @keyframes pulse-border {
    0% { border-color: rgba(59, 130, 246, 0.3); }
    50% { border-color: rgba(59, 130, 246, 0.8); }
    100% { border-color: rgba(59, 130, 246, 0.3); }
  }
  
  @keyframes bounce-subtle {
    0%, 100% { transform: translateY(0); }
    50% { transform: translateY(-3px); }
  }
  
  @keyframes shine {
    0% {
      background-position: -100% 0;
    }
    100% {
      background-position: 200% 0;
    }
  }
  
  .shine-effect {
    position: relative;
    overflow: hidden;
  }
  
  .shine-effect::after {
    content: '';
    position: absolute;
    top: 0;
    left: 0;
    width: 100%;
    height: 100%;
    background: linear-gradient(
      to right,
      rgba(255, 255, 255, 0) 0%,
      rgba(255, 255, 255, 0.4) 50%,
      rgba(255, 255, 255, 0) 100%
    );
    background-size: 200% 100%;
    animation: shine 2s infinite linear;
    pointer-events: none;
  }
  
  .free-card {
    border: 2px solid rgba(59, 130, 246, 0.3);
    animation: pulse-border 2s infinite;
    box-shadow: 0 5px 15px rgba(59, 130, 246, 0.15);
    position: relative;
    overflow: hidden;
    transition: all 0.5s cubic-bezier(0.34, 1.56, 0.64, 1);
  }
  
  .free-card:hover {
    transform: translateY(-8px) scale(1.02);
    box-shadow: 0 12px 20px rgba(59, 130, 246, 0.25);
    border-color: rgba(59, 130, 246, 0.8);
  }
  
  .free-card::before {
    content: "";
    position: absolute;
    top: -50%;
    left: -50%;
    width: 200%;
    height: 200%;
    background: linear-gradient(
      to right,
      rgba(59, 130, 246, 0) 0%,
      rgba(59, 130, 246, 0.1) 50%,
      rgba(59, 130, 246, 0) 100%
    );
    transform: rotate(30deg);
    animation: shimmer 3s infinite linear;
    z-index: 1;
  }
  
  .free-card .free-badge {
    animation: bounce-subtle 2s ease-in-out infinite;
  }
  
  .free-star {
    position: absolute;
    top: -8px;
    right: -8px;
    background: linear-gradient(45deg, #3b82f6, #2563eb);
    color: white;
    width: 40px;
    height: 40px;
    border-radius: 50%;
    display: flex;
    align-items: center;
    justify-content: center;
    font-size: 18px;
    box-shadow: 0 2px 10px rgba(37, 99, 235, 0.5);
    z-index: 10;
    transform: rotate(15deg);
  }
  
  .free-ribbon {
    position: absolute;
    top: 10px;
    right: -25px;
    background: #3b82f6;
    color: white;
    padding: 2px 20px;
    transform: rotate(45deg);
    box-shadow: 0 2px 5px rgba(0,0,0,0.2);
    z-index: 10;
    font-size: 10px;
    font-weight: bold;
  }
  
  .animate-float {
    animation: float 6s ease-in-out infinite;
  }
  
  .animate-fadeIn {
    opacity: 0;
    animation: fadeIn 0.5s ease-out forwards;
  }
  
  .animate-glow {
    animation: glow 2s ease-in-out infinite;
  }
  
  .animate-scan {
    animation: scan 5s linear infinite;
  }
  
  .animate-spin-slow {
    animation: spin 15s linear infinite;
  }
  
  .animate-shimmer {
    animation: shimmer 2s ease-in-out infinite;
  }
  
  .shimmer-bg {
    background: linear-gradient(90deg, 
      rgba(255,255,255,0) 0%, 
      rgba(255,255,255,0.2) 50%, 
      rgba(255,255,255,0) 100%);
    background-size: 200% 100%;
    animation: shimmer 2s infinite;
  }
  
  .bg-grid-white {
    background-image: linear-gradient(to right, rgba(255, 255, 255, 0.1) 1px, transparent 1px),
                      linear-gradient(to bottom, rgba(255, 255, 255, 0.1) 1px, transparent 1px);
  }
  
  .scale-102:hover {
    transform: scale(1.02);
  }
  
  .free-label {
    position: relative;
    overflow: hidden;
  }
  
  .free-label::after {
    content: '';
    position: absolute;
    top: -50%;
    left: -50%;
    width: 200%;
    height: 200%;
    background: linear-gradient(60deg, 
      transparent, 
      rgba(255,255,255,0.2), 
      transparent);
    transform: rotate(30deg);
    animation: shimmer 2s infinite linear;
  }

  .gradient-bg {
    background: linear-gradient(-45deg, #3490dc, #6574cd, #9561e2, #f66d9b);
    background-size: 400% 400%;
    animation: gradientBg 15s ease infinite;
  }

  .glass-effect {
    background: rgba(255, 255, 255, 0.1);
    backdrop-filter: blur(10px);
    -webkit-backdrop-filter: blur(10px);
    border: 1px solid rgba(255, 255, 255, 0.18);
    box-shadow: 0 8px 32px 0 rgba(31, 38, 135, 0.37);
  }
  
  .tech-card {
    border-radius: 16px;
    background: linear-gradient(145deg, #ffffff, #f0f0f0);
    box-shadow: 8px 8px 16px #d1d1d1, -8px -8px 16px #ffffff;
    transition: all 0.3s ease;
  }
  
  .tech-card:hover {
    box-shadow: 12px 12px 20px #c1c1c1, -12px -12px 20px #ffffff;
  }

  .dark .tech-card {
    background: linear-gradient(145deg, #2d3748, #1a202c);
    box-shadow: 8px 8px 16px #131720, -8px -8px 16px #354152;
  }
  
  .dark .tech-card:hover {
    box-shadow: 12px 12px 20px #0d1117, -12px -12px 20px #3d485c;
  }
`;

// 题库访问类型
type AccessType = 'trial' | 'paid' | 'expired' | 'redeemed';

// 基础题库类型
interface BaseQuestionSet {
  id: string;
  title: string;
  description: string;
  category: string;
  icon: string;
  isPaid: boolean;
  price: number | null;
  trialQuestions: number | null;
  questionCount?: number;
  isFeatured: boolean;
  featuredCategory?: string; // 添加精选分类属性
  createdAt: Date;
  updatedAt: Date;
  hasAccess?: boolean;
  remainingDays?: number | null;
  paymentMethod?: string;
  questions?: { id: string }[];
  questionSetQuestions?: { id: string }[];
  validityPeriod?: number; // 题库有效期，以天为单位
  cardImage?: string; // 添加题库卡片图片字段
}

// 扩展题库类型，添加访问类型
interface PreparedQuestionSet extends BaseQuestionSet {
  accessType: AccessType;
  remainingDays: number | null;
  validityPeriod: number;
  featuredCategory?: string; // 添加精选分类字段
  cardImage?: string; // 添加题库卡片图片字段
}

// 添加全局请求限制变量
const API_REQUEST_COOLDOWN = 5000; // 5秒冷却时间
const MAX_REQUESTS_PER_MINUTE = 20; // 每分钟最大请求数

// 添加debounce工具函数
function debounce<T extends (...args: any[]) => any>(func: T, wait: number): (...args: Parameters<T>) => void {
  let timeout: ReturnType<typeof setTimeout> | null = null;
  
  return (...args: Parameters<T>) => {
    if (timeout) {
      clearTimeout(timeout);
    }
    
    timeout = setTimeout(() => {
      func(...args);
    }, wait);
  };
}

const HomePage = (): JSX.Element => {
  const { user, isAdmin, syncAccessRights } = useUser();
  const { socket } = useSocket();
  // Remove unused destructured variables
  const { /* progressStats, fetchUserProgress */ } = useUserProgress();
  const [questionSets, setQuestionSets] = useState<PreparedQuestionSet[]>([]);
  const [filteredSets, setFilteredSets] = useState<PreparedQuestionSet[]>([]);
  const [recommendedSets, setRecommendedSets] = useState<PreparedQuestionSet[]>([]);
  const [activeCategory, setActiveCategory] = useState<string>('all');
  const [loading, setLoading] = useState(true);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [homeContent, setHomeContent] = useState<HomeContentData>(defaultHomeContent);
  const navigate = useNavigate();
  const [recentlyUpdatedSets, setRecentlyUpdatedSets] = useState<{[key: string]: number}>({});
  const [searchTerm, setSearchTerm] = useState<string>('');
  // 添加API请求计数和限制状态变量
  const [apiRequestCount, setApiRequestCount] = useState<number>(0);
  const lastApiRequestTime = useRef<number>(0);
  const recentRequests = useRef<number[]>([]);
  
  // 添加题库列表初始加载标记，避免重复请求
  const isInitialLoad = useRef<boolean>(true);
  // Add hasRequestedAccess ref to track if access has been requested
  const hasRequestedAccess = useRef<boolean>(false);
  // Add loading timeout ref to avoid getting stuck in loading state
  const loadingTimeoutRef = useRef<any>(null);
  
  const socketDataRef = useRef<{[key: string]: {hasAccess: boolean, remainingDays: number | null, accessType?: string}}>({}); 
  // 修改bgClass的定义，确保不影响用户菜单的交互
  const bgClass = "bg-gray-50 dark:bg-gray-900 py-0 relative"; // 移除min-h-screen和pt-20, 设置py-0完全移除上下间距
  
  // Add notification state variables
  const [showUpdateNotification, setShowUpdateNotification] = useState<boolean>(false);
  const [notificationMessage, setNotificationMessage] = useState<string>('');
  const notificationTimeoutRef = useRef<any>(null);
  
  // 新增状态 - 控制是否显示倒计时组件
  const [showCountdownWidget, setShowCountdownWidget] = useState<boolean>(false);
  
  // 在这里添加BaseCard组件定义（组件内部）
  const BaseCard: React.FC<{
    key: string;
    set: PreparedQuestionSet;
    onStartQuiz: (set: PreparedQuestionSet) => void;
  }> = ({ set, onStartQuiz }) => {
    // 格式化剩余天数的显示
    const formatRemainingDays = (days: number | null) => {
      if (days === null) return "永久有效";
      if (days <= 0) return "已过期";
      if (days === 1) return "剩余1天";
      if (days < 30) return `剩余${days}天`;
      const months = Math.floor(days / 30);
      return `剩余${months}个月${days % 30 > 0 ? ` ${days % 30}天` : ''}`;
    };

    // 获取题目数量
    const getQuestionCount = () => {
      // Debug original values
      const originalCount = set.questionCount;
      const questionsLength = Array.isArray(set.questions) ? set.questions.length : 0;
      const questionSetQuestionsLength = Array.isArray(set.questionSetQuestions) ? set.questionSetQuestions.length : 0;
      
      console.log(`[HomePage] Question count data for ${set.id} (${set.title}):`, {
        questionCount: originalCount,
        questionsLength: questionsLength,
        questionSetQuestionsLength: questionSetQuestionsLength
      });
      
      // Check for valid questionCount property - most reliable source
      if (typeof originalCount === 'number' && originalCount > 0) {
        return originalCount;
      }
      
      // Fallback to questions array length if available
      if (questionsLength > 0) {
        return questionsLength;
      }
      
      // Last resort: check questionSetQuestions array length
      if (questionSetQuestionsLength > 0) {
        return questionSetQuestionsLength;
      }
      
      // If we have no data, request fresh data for this specific question set
      // This will trigger only once per session to avoid loops
      const cacheKey = `question_count_fetched_${set.id}`;
      const lastFetchTime = parseInt(sessionStorage.getItem(cacheKey) || '0', 10);
      const now = Date.now();
      const shouldRefetch = now - lastFetchTime > 60000; // Refetch after 1 minute
      
      if (shouldRefetch || lastFetchTime === 0) {
        console.log(`[HomePage] No question count available for ${set.title}, fetching from API...`);
        sessionStorage.setItem(cacheKey, now.toString());
        
        // Fetch the question count for this specific set
        apiClient.get(`/api/questions/count/${set.id}`)
          .then(response => {
            if (response && response.success && response.count !== undefined) {
              console.log(`[HomePage] API returned count for ${set.title}: ${response.count}`);
              
              // Update the question count in the state
              // We use a custom event to avoid touching React state directly
              window.dispatchEvent(new CustomEvent('questionSet:countUpdate', {
                detail: {
                  questionSetId: set.id,
                  count: response.count
                }
              }));
            }
          })
          .catch(error => {
            console.error(`[HomePage] Error fetching question count for ${set.title}:`, error);
          });
      }
      
      // Return 0 until we have better data
      return originalCount || 0;
    };

    // 根据剩余时间计算进度条颜色和百分比
    const getRemainingTimeDisplay = () => {
      if (set.remainingDays === null) return { color: 'bg-green-500', percent: 100 };
      if (set.remainingDays <= 0) return { color: 'bg-red-500', percent: 0 };
      if (set.validityPeriod === 0) return { color: 'bg-green-500', percent: 100 };
      
      const percent = Math.min(100, Math.round((set.remainingDays / set.validityPeriod) * 100));
      let color = 'bg-green-500';
      if (percent < 20) color = 'bg-red-500';
      else if (percent < 50) color = 'bg-yellow-500';
      return { color, percent };
    };

    const { color, percent } = getRemainingTimeDisplay();
    const isPaid = set.isPaid && set.accessType !== 'trial';
    const isRedeemed = set.accessType === 'redeemed';
    const isExpired = set.accessType === 'expired';
    const hasAccess = set.hasAccess;
    const isFree = !set.isPaid;
    
    // 确定卡片的访问类型标签
    const getAccessTypeLabel = () => {
      if (!set.isPaid) return '免费';
      if (set.accessType === 'paid') return hasAccess ? '已购买' : '付费';
      if (set.accessType === 'redeemed') return '已兑换';
      if (set.accessType === 'expired') return '已过期';
      return '付费';
    };
    
    // 确定标签的颜色
    const getAccessTypeBadgeClass = () => {
      if (!set.isPaid) return 'bg-blue-100 text-blue-800 border border-blue-200';
      if (set.accessType === 'paid') return hasAccess ? 'bg-green-100 text-green-800 border border-green-200' : 'bg-amber-100 text-amber-800 border border-amber-200';
      if (set.accessType === 'redeemed') return 'bg-purple-100 text-purple-800 border border-purple-200';
      if (set.accessType === 'expired') return 'bg-red-100 text-red-800 border border-red-200';
      return 'bg-amber-100 text-amber-800 border border-amber-200';
    };

    return (
      <div className={`relative group h-[180px] rounded-xl transition-all duration-300 bg-white border border-gray-100 shadow hover:shadow-md hover:border-blue-100 transform hover:-translate-y-1 overflow-hidden ${isFree ? 'free-card' : ''}`}>
        {/* Subtle accent */}
        <div className="absolute top-0 left-0 right-0 h-1 bg-gradient-to-r from-blue-400 to-indigo-400 opacity-80"></div>
        
        {/* Free star indicator for free question sets */}
        {isFree && (
          <div className="free-star">
            <span>⭐</span>
          </div>
        )}
        
        {/* Card Image Background - Add support for card image */}
        {set.cardImage && (
          <div 
            className="absolute inset-0 z-0 opacity-5"
            style={{ 
              backgroundImage: `url(${set.cardImage})`,
              backgroundSize: 'cover',
              backgroundPosition: 'center',
            }}
          />
        )}
        
        {/* Background pattern for free cards */}
        {isFree && !set.cardImage && (
          <div 
            className="absolute inset-0 z-0 opacity-10"
            style={{ 
              backgroundImage: `radial-gradient(circle, rgba(59, 130, 246, 0.2) 1px, transparent 1px)`,
              backgroundSize: '15px 15px'
            }}
          />
        )}
        
        {/* Subtle decorative elements */}
        <div className="absolute -right-4 -top-4 w-16 h-16 bg-blue-400 opacity-5 rounded-full"></div>
        <div className="absolute -left-4 -bottom-4 w-16 h-16 bg-indigo-400 opacity-5 rounded-full"></div>
        
        {/* Free ribbon for free question sets */}
        {isFree && (
          <div className="free-ribbon">免费</div>
        )}
        
        {/* Card content */}
        <div className="relative z-10 h-full p-4 flex flex-col justify-between">
          {/* Header */}
          <div>
            <div className="flex justify-between items-start mb-2">
              {/* Title and icon */}
              <div className="flex items-center">
                <div className={`w-8 h-8 rounded-full bg-blue-50 flex items-center justify-center text-lg mr-2 flex-shrink-0 text-blue-600 overflow-hidden ${isFree ? 'animate-pulse' : ''}`}>
                  {set.icon && (set.icon.startsWith('/') || set.icon.includes('http')) ? (
                    <img src={set.icon} alt={set.title} className="w-full h-full object-cover" />
                  ) : (
                    set.icon || '📚'
                  )}
                </div>
                <h3 className={`text-base font-semibold text-gray-800 group-hover:text-blue-600 transition-colors line-clamp-1 pr-2 ${isFree ? 'text-blue-700' : ''}`}>
                  {set.title}
                </h3>
              </div>
              
              {/* Access type badge */}
              <div className="flex-shrink-0">
                <span className={`inline-flex items-center px-2 py-0.5 rounded-md text-xs font-medium ${
                  isFree 
                    ? 'bg-blue-100 text-blue-800 border border-blue-200 free-badge'
                    : getAccessTypeBadgeClass()
                }`}>
                  {getAccessTypeLabel()}
                  {isFree && <span className="absolute inset-0 rounded-md bg-blue-400 mix-blend-screen opacity-10 animate-pulse"></span>}
                </span>
              </div>
            </div>
            
            {/* Description */}
            <p className="text-xs text-gray-500 mb-3 line-clamp-1">{set.description}</p>
          </div>
          
          {/* Info section */}
          <div className="space-y-3">
            {/* Stats */}
            <div className="flex items-center text-xs text-gray-500 space-x-4">
              <div className="flex items-center">
                <svg className={`w-3.5 h-3.5 mr-1 ${isFree ? 'text-blue-500 animate-pulse' : 'text-blue-500'}`} xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8.228 9c.549-1.165 2.03-2 3.772-2 2.21 0 4 1.343 4 3 0 1.4-1.278 2.575-3.006 2.907-.542.104-.994.54-.994 1.093m0 3h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                </svg>
                {getQuestionCount() > 0 ? (
                  <span>{getQuestionCount()}题</span>
                ) : (
                  <span className="text-red-500 flex items-center">
                    <span>0题</span>
                    <svg className="w-3 h-3 ml-1 animate-pulse text-amber-500" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
                    </svg>
                  </span>
                )}
              </div>
              <div className="flex items-center">
                <svg className={`w-3.5 h-3.5 mr-1 ${isFree ? 'text-indigo-600' : 'text-indigo-500'}`} xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M7 7h.01M7 3h5c.512 0 1.024.195 1.414.586l7 7a2 2 0 010 2.828l-7 7a2 2 0 01-2.828 0l-7-7A1.994 1.994 0 013 12V7a4 4 0 014-4z" />
                </svg>
                <span>{set.category}</span>
              </div>
            </div>
            
            {/* Validity period or price */}
            {(isPaid || isRedeemed) && hasAccess && !isExpired ? (
              <div className="w-full">
                <div className="flex justify-between text-xs mb-1">
                  <span className="text-gray-500">有效期</span>
                  <span className={`font-medium ${
                    percent < 20 ? 'text-red-600' : 
                    percent < 50 ? 'text-amber-600' : 
                    'text-green-600'
                  }`}>
                    {formatRemainingDays(set.remainingDays)}
                  </span>
                </div>
                <div className="w-full h-1.5 bg-gray-100 rounded-full overflow-hidden">
                  <div 
                    className={`h-full ${color} transition-all duration-500`}
                    style={{ width: `${percent}%` }}
                  ></div>
                </div>
              </div>
            ) : set.isPaid && !hasAccess ? (
              <div className="flex items-baseline">
                <span className="text-base font-bold text-blue-600">¥{set.price}</span>
                {set.trialQuestions && (
                  <span className="ml-2 text-xs text-gray-500">
                    可试用{set.trialQuestions}题
                  </span>
                )}
              </div>
            ) : (
              <div className={`w-full h-[2px] rounded-full mt-2 ${isFree ? 'bg-blue-200 animate-pulse' : 'bg-blue-50'}`}></div>
            )}
            
            {/* Action button */}
            <button
              onClick={() => onStartQuiz(set)}
              className={`w-full py-1.5 rounded-lg text-xs font-medium transition-all duration-300 ${
                isFree 
                  ? 'bg-gradient-to-r from-blue-500 to-indigo-500 hover:from-blue-600 hover:to-indigo-600 text-white shine-effect'
                  : hasAccess 
                    ? 'bg-blue-600 hover:bg-blue-700 text-white'
                    : 'bg-indigo-600 hover:bg-indigo-700 text-white'
              } flex items-center justify-center group-hover:shadow transform group-hover:scale-[1.01]`}
            >
              {isFree ? (
                <>
                  <svg className="w-3.5 h-3.5 mr-1 animate-pulse" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 10V3L4 14h7v7l9-11h-7z" />
                  </svg>
                  免费练习
                </>
              ) : hasAccess ? (
                <>
                  <svg className="w-3.5 h-3.5 mr-1" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M14.752 11.168l-3.197-2.132A1 1 0 0010 9.87v4.263a1 1 0 001.555.832l3.197-2.132a1 1 0 000-1.664z" />
                  </svg>
                  开始练习
                </>
              ) : (
                <>
                  <svg className="w-3.5 h-3.5 mr-1" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 15l-2 5L9 9l11 4-5 2zm0 0l5 5M7.188 2.239l.777 2.897M5.136 7.965l-2.898-.777M13.95 4.05l-2.122 2.122m-5.657 5.656l-2.12 2.122" />
                  </svg>
                  试用练习
                </>
              )}
            </button>
          </div>
        </div>
        
        {/* Hover effects */}
        <div className="absolute inset-0 bg-gradient-to-r from-transparent via-blue-100 to-transparent opacity-0 group-hover:opacity-10 transform -translate-x-full group-hover:translate-x-full transition-all duration-1000 ease-in-out"></div>
      </div>
    );
  };
  
  // 修改handleStartQuiz函数，添加试用模式参数
  const handleStartQuiz = useCallback((set: PreparedQuestionSet) => {
    console.log(`[HomePage] 开始答题:`, set);
    
    // 防御性检查：确保题库数据有效
    if (!set || !set.id || !set.title) {
      console.error('[handleStartQuiz] 无效题库数据:', set);
      setErrorMessage('无法访问题库：数据无效');
      return;
    }
    
    // 检查付费题库和访问权限
    const isTrial = set.isPaid && !set.hasAccess;
    console.log(`[HomePage] 题库类型: ${set.isPaid ? '付费' : '免费'}, 访问权限: ${set.hasAccess ? '有' : '无'}, 试用模式: ${isTrial ? '是' : '否'}`);
    
    // 构建URL参数对象
    const params = new URLSearchParams();
    
    // 添加时间戳，避免缓存
    params.append('t', Date.now().toString());
    
    // 如果是付费题库且用户没有访问权限，添加试用模式参数
    if (isTrial) {
      params.append('mode', 'trial');
      
      // 添加试用题目数量限制
      if (set.trialQuestions) {
        params.append('trialLimit', String(set.trialQuestions));
      }
      
      console.log(`[HomePage] 设置试用模式参数: mode=trial, trialLimit=${set.trialQuestions || 'unset'}`);
    }
    
    // 构建完整URL
    const quizUrl = `/quiz/${set.id}?${params.toString()}`;
    
    console.log(`[HomePage] 跳转到URL: ${quizUrl}, 试用模式: ${isTrial ? '是' : '否'}`);
    console.log(`[HomePage] URLSearchParams详情:`, Object.fromEntries(params.entries()));
    
    // 使用navigate进行路由跳转
    navigate(quizUrl);
    
    // 记录题库访问事件
    if (socket && user?.id) {
      socket.emit('user:activity', {
        userId: user.id,
        action: 'start_quiz',
        questionSetId: set.id,
        hasFullAccess: set.hasAccess,
        accessType: set.accessType,
        mode: isTrial ? 'trial' : 'normal',
        timestamp: Date.now()
      });
    }
  }, [navigate, setErrorMessage, socket, user]);

  // Add getLocalAccessCache function before it's used
  const getLocalAccessCache = useCallback(() => {
    try {
      const cachedData = localStorage.getItem('question_set_access');
      if (cachedData) {
        return JSON.parse(cachedData) || {};
      }
    } catch (error) {
      console.error('[HomePage] 读取本地缓存失败', error);
    }
    return {};
  }, []);

  // 将 getCategorizedQuestionSets 函数移到组件内部，这样它可以访问 questionSets 状态
  const getCategorizedQuestionSets = useCallback(() => {
    // 根据状态过滤题库 - 使用filteredSets而不是questionSets
    const purchased = filteredSets.filter((set: PreparedQuestionSet) => 
      (set.accessType === 'paid' || set.accessType === 'redeemed') && set.hasAccess
    );
    
    const free = filteredSets.filter((set: PreparedQuestionSet) => 
      !set.isPaid // 只有真正的免费题库才显示在免费区域
    );
    
    const paid = filteredSets.filter((set: PreparedQuestionSet) => 
      set.isPaid && !set.hasAccess && set.accessType !== 'expired'
    );
    
    const expired = filteredSets.filter((set: PreparedQuestionSet) => 
      set.accessType === 'expired'
    );
    
    return { purchased, free, paid, expired };
  }, [filteredSets]);

  // Save access info to local storage
  const saveAccessToLocalStorage = useCallback((questionSetId: string, hasAccess: boolean, remainingDays: number | null, paymentMethod?: string) => {
    if (!user?.id) return;
    
    try {
      const cache = getLocalAccessCache();
      const userId = user.id;
      
      // 确保用户ID索引存在
      if (!cache[userId]) {
        cache[userId] = {};
      }
      
      // 更新题库的访问信息
      cache[userId][questionSetId] = {
        hasAccess,
        remainingDays,
        paymentMethod,
        timestamp: Date.now()
      };
      
      // 保存回本地存储
      localStorage.setItem('question_set_access', JSON.stringify(cache));
    } catch (error) {
      console.error('[HomePage] 保存本地缓存失败', error);
    }
  }, [user?.id, getLocalAccessCache]);
  
  // 辅助函数：读取本地缓存的访问状态
  const getAccessFromLocalCache = useCallback((questionSetId: string, userId: string | undefined) => {
    if (!questionSetId || !userId) return null;
    
    try {
      const cache = getLocalAccessCache();
      if (cache[userId] && cache[userId][questionSetId]) {
        return cache[userId][questionSetId];
      }
    } catch (e) {
      console.error('[HomePage] 读取本地缓存失败:', e);
    }
    return null;
  }, [getLocalAccessCache]);
  
  // 请求数据库直接检查权限 - 添加更强的验证机制
  const hasAccessInDatabase = useCallback(async (questionSetId: string): Promise<boolean> => {
    if (!user?.id) return false;
    
    try {
      console.log(`[HomePage] 直接向数据库请求题库 ${questionSetId} 的访问权限`);
      
      // 添加时间戳防止缓存，将缓存时间设为0
      const response = await apiClient.get(`/api/purchases/check/${questionSetId}`, {
        userId: user.id,
        _t: Date.now() // 防止缓存
      }, { 
        cacheDuration: 0 // 禁用缓存，确保每次都获取最新数据
      });
      
      const hasAccess = response?.success && response?.data?.hasAccess === true;
      console.log(`[HomePage] 数据库权限检查结果: ${hasAccess ? '有权限' : '无权限'}`);
      
      // 对比Socket数据与数据库结果，检测不一致
      if (socketDataRef.current[questionSetId] && 
          socketDataRef.current[questionSetId].hasAccess !== hasAccess) {
        console.warn(`[HomePage] 权限不一致，执行数据库验证 - Socket=${hasAccess}, 数据库=${socketDataRef.current[questionSetId].hasAccess}`);
      }
      
      return hasAccess;
    } catch (error) {
      console.error('[HomePage] 检查数据库权限失败:', error);
      return false;
    }
  }, [user?.id]);
  
  // 添加请求AccessStatusForAllQuestionSets函数
  const requestAccessStatusForAllQuestionSets = useCallback(() => {
    if (!user?.id || !socket || questionSets.length === 0) {
      console.log('[HomePage] 无法请求权限: 用户未登录或无题库');
      return;
    }
    
    const now = Date.now();
    console.log(`[HomePage] 请求所有题库的权限状态（${questionSets.length}个题库）`);
    
    // 只请求付费题库的权限
    const paidQuestionSetIds = questionSets
      .filter(set => set.isPaid === true)
      .map(set => String(set.id).trim());
    
    if (paidQuestionSetIds.length > 0) {
      // 发送详细的调试数据
      socket.emit('server:debug', {
        userId: user.id,
        action: 'requestBatchAccess',
        questionSetCount: paidQuestionSetIds.length,
        timestamp: now
      });
      
      socket.emit('questionSet:checkAccessBatch', {
        userId: user.id,
        questionSetIds: paidQuestionSetIds,
        timestamp: now,
        source: 'explicit_homepage_check'
      });
      
      // 更新最后请求时间
      lastSocketUpdateTime.current = now;
      hasRequestedAccess.current = true;
      
      console.log(`[HomePage] 已为${paidQuestionSetIds.length}个付费题库请求权限状态`);
    } else {
      console.log('[HomePage] 没有付费题库需要请求权限');
    }
  }, [user?.id, socket, questionSets]);
  
  // 优化 determineAccessStatus 函数逻辑，添加更细致的状态判断和日志
  const determineAccessStatus = useCallback((
    set: BaseQuestionSet,
    hasAccessValue: boolean,
    remainingDays: number | null,
    paymentMethod?: string
  ) => {
    // 如果是免费题库，始终可访问且类型为trial
    if (!set.isPaid) {
      console.log(`[determineAccessStatus] 题库ID=${set.id} 免费题库，自动授予访问权限`);
      return {
        hasAccess: true,
        accessType: 'trial' as AccessType,
        remainingDays: null
      };
    }
    
    // 优化访问类型判断逻辑
    let accessType: AccessType;
    let finalHasAccess = hasAccessValue;
    
    // 根据支付方式优先判断
    if (paymentMethod === 'redeem') {
      accessType = 'redeemed';
    } else if (remainingDays !== null && remainingDays <= 0) {
      accessType = 'expired';
      finalHasAccess = false;
    } else if (hasAccessValue) {
      accessType = 'paid';
    } else {
      // 重要：付费题库未购买时，accessType不应该是'trial'，应该是'paid'但hasAccess为false
      // 这样避免在UI上显示"免费"标签
      accessType = 'paid';
      finalHasAccess = false;
    }
    
    console.log(`[determineAccessStatus] 题库ID=${set.id}, 标题="${set.title}" - 付费=${set.isPaid}, 有权限=${finalHasAccess}, 类型=${accessType}, 支付方式=${paymentMethod || '未知'}, 剩余天数=${remainingDays}`);
    
    return {
      hasAccess: finalHasAccess,
      accessType,
      remainingDays
    };
  }, []);

  // 切换分类
  const handleCategoryChange = useCallback((category: string) => {
    console.log(`[HomePage] Changing category to: ${category}`);
    // Debug available categories
    const availableCategories = [...new Set(questionSets.map(set => set.category))];
    console.log(`[HomePage] Available categories: ${availableCategories.join(', ')}`);
    
    setActiveCategory(category);
    
    // Set a timeout to ensure state updates are processed
    setTimeout(() => {
      // Scroll to question sets section for better user experience
      const questionSetsSection = document.getElementById('question-sets-section');
      if (questionSetsSection) {
        questionSetsSection.scrollIntoView({ behavior: 'smooth' });
      }
    }, 100);
  }, [questionSets]);

  // 获取过滤后的题库列表，按分类组织
  const getFilteredQuestionSets = useCallback(() => {
    console.log(`[getFilteredQuestionSets] Starting filter with activeCategory: ${activeCategory}`);
    
    // 先根据搜索词过滤
    let filtered = searchTerm.trim() ? 
      questionSets.filter(set => 
        set.title.toLowerCase().includes(searchTerm.toLowerCase()) || 
        set.category.toLowerCase().includes(searchTerm.toLowerCase()) ||
        set.description.toLowerCase().includes(searchTerm.toLowerCase())
      ) : 
      questionSets;
    
    // 再根据分类过滤
    if (activeCategory !== 'all') {
      // 分析可用分类
      const availableCategories = [...new Set(questionSets.map(set => set.category))];
      console.log(`[getFilteredQuestionSets] Available categories in data: ${availableCategories.join(', ')}`);
      
      // 直接按选中的分类筛选
      const preFilterCount = filtered.length;
      filtered = filtered.filter(set => 
        set.category === activeCategory || 
        set.featuredCategory === activeCategory
      );
      console.log(`[getFilteredQuestionSets] Filtered by category '${activeCategory}': from ${preFilterCount} to ${filtered.length} sets`);
    } else if (homeContent.featuredCategories && homeContent.featuredCategories.length > 0) {
      // 在全部模式，且有精选分类时，正常显示所有题库
      console.log(`[getFilteredQuestionSets] Showing all sets: ${filtered.length} sets`);
    }
    
    return filtered;
  }, [questionSets, activeCategory, homeContent.featuredCategories, searchTerm]);

  // 推荐题库直接用 questionSets 过滤

  // Replace the above with this effect
  useEffect(() => {
    // Update recommended sets from featured items
    const featuredSets = questionSets.filter(set => set.isFeatured);
    setRecommendedSets(featuredSets.slice(0, 3));
    
    // Also update filtered sets based on search and category
    const filtered = getFilteredQuestionSets();
    setFilteredSets(filtered);
    
    console.log(`[HomePage] Updated sets: ${filtered.length} filtered sets, ${featuredSets.length} featured sets`);
  }, [questionSets, searchTerm, activeCategory, getFilteredQuestionSets]);

  // 添加API缓存和请求防抖
  const [lastFetchTime, setLastFetchTime] = useState<number>(0);
  const pendingFetchRef = useRef<boolean>(false);
  const lastSocketUpdateTime = useRef<number>(0);
  const debounceTimerRef = useRef<any>(null);
  
  // 添加请求限制检查函数
  const canMakeRequest = useCallback(() => {
    // 检查API请求限流
    return httpLimiter.canMakeRequest();
  }, []);

  // 修改fetchQuestionSets，添加请求限制检查
  const fetchQuestionSets = useCallback(async (options: { forceFresh?: boolean } = {}) => {
    const now = Date.now();
    
    // 请求限制检查 - 非强制刷新时检查
    if (!options.forceFresh && !canMakeRequest()) {
      console.log('[HomePage] 请求被限制，跳过题库获取');
      return questionSets;
    }
    
    // Ensure loading is set to true during fetch
    setLoading(true);
    
    // Set a safety timeout to prevent infinite loading state
    if (loadingTimeoutRef.current) {
      clearTimeout(loadingTimeoutRef.current);
    }
    
    loadingTimeoutRef.current = setTimeout(() => {
      console.log('[HomePage] Loading timeout triggered - forcing loading state to false');
      setLoading(false);
    }, 10000); // 10 seconds timeout
    
    // 防止频繁请求 - 仅在上次请求超过5秒或强制刷新时执行
    if (!options.forceFresh && now - lastFetchTime < 5000) {
      console.log(`[HomePage] 上次请求在 ${(now - lastFetchTime)/1000}秒前，跳过请求`);
      setLoading(false); // Make sure to set loading to false when skipping
      clearTimeout(loadingTimeoutRef.current);
      return questionSets;
    }
    
    // 防止并发请求
    if (pendingFetchRef.current) {
      console.log(`[HomePage] 有请求正在进行中，跳过重复请求`);
      // Don't set loading to false here to maintain the loading indicator
      return questionSets;
    }
    
    try {
      pendingFetchRef.current = true;
      console.log(`[HomePage] 开始获取题库列表, 强制刷新: ${options.forceFresh}`);
      
      // 添加请求防缓存参数
      const timestamp = now;
      // 使用apiClient替代未定义的questionSetApi
      const response = await apiClient.get('/api/question-sets', 
        user?.id ? { 
          userId: user.id, 
          _t: timestamp 
        } : { _t: timestamp }
      );
      
      if (response && response.success && response.data) {
        console.log(`[HomePage] 成功获取${response.data.length}个题库`);
        
        // 预处理用户购买记录，创建一个Map方便快速查找
        const userPurchasesMap = new Map();
        if (user?.purchases && user.purchases.length > 0) {
          const nowDate = new Date();
          
          console.log(`[HomePage] 处理${user.purchases.length}条用户购买记录供题库映射使用`);
          
          user.purchases.forEach(purchase => {
            if (!purchase.questionSetId) return;
            
            const qsId = String(purchase.questionSetId).trim();
            
            // 处理过期日期
            const expiryDate = purchase.expiryDate ? new Date(purchase.expiryDate) : null;
            const isExpired = expiryDate && expiryDate <= nowDate;
            const isActive = !isExpired && 
                            (purchase.status === 'active' || 
                            purchase.status === 'completed' || 
                            !purchase.status);
            
            // 计算剩余天数
            let remainingDays = null;
            if (expiryDate && !isExpired) {
              const diffTime = expiryDate.getTime() - nowDate.getTime();
              remainingDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));
            }
            
            userPurchasesMap.set(qsId, {
              hasAccess: isActive,
              accessType: purchase.paymentMethod === 'redeem' ? 'redeemed' : 'paid',
              remainingDays: isActive ? remainingDays : (isExpired ? 0 : null),
              paymentMethod: purchase.paymentMethod || 'paid',
              isExpired
            });
            
            console.log(`[HomePage] 用户购买记录: 题库=${qsId}, 有效=${isActive}, 类型=${purchase.paymentMethod || 'paid'}, 剩余天数=${remainingDays}`);
          });
        }
        
        // 预处理用户兑换码记录，添加到快速查找Map
        if (user?.redeemCodes && user.redeemCodes.length > 0) {
          console.log(`[HomePage] 处理${user.redeemCodes.length}条用户兑换码记录供题库映射使用`);
          
          user.redeemCodes.forEach(code => {
            if (!code.questionSetId) return;
            
            const qsId = String(code.questionSetId).trim();
            
            // 只有在还没有此题库记录或现有记录已过期时，才添加兑换记录
            if (!userPurchasesMap.has(qsId) || userPurchasesMap.get(qsId).isExpired) {
              userPurchasesMap.set(qsId, {
                hasAccess: true,
                accessType: 'redeemed',
                remainingDays: null, // 兑换的题库通常不设置过期时间
                paymentMethod: 'redeem',
                isExpired: false
              });
              
              console.log(`[HomePage] 用户兑换记录: 题库=${qsId}, 已兑换可访问`);
            }
          });
        }
        
        // 获取本地缓存的所有访问记录
        const localCacheMap = new Map();
        try {
          const cache = getLocalAccessCache();
          if (user?.id && cache[user.id]) {
            const userCache = cache[user.id];
            
            // 遍历用户的所有本地缓存记录
            Object.keys(userCache).forEach(qsId => {
              if (userCache[qsId] && userCache[qsId].hasAccess) {
                localCacheMap.set(qsId, {
                  hasAccess: true,
                  accessType: userCache[qsId].paymentMethod === 'redeem' ? 'redeemed' : 'paid',
                  remainingDays: userCache[qsId].remainingDays,
                  paymentMethod: userCache[qsId].paymentMethod,
                  timestamp: userCache[qsId].timestamp
                });
              }
            });
            
            console.log(`[HomePage] 从本地缓存加载了 ${localCacheMap.size} 条访问记录`);
          }
        } catch (error) {
          console.error('[HomePage] 获取本地缓存失败:', error);
        }
        
        // 处理题库数据，确保包含必要字段
        const preparedSets: PreparedQuestionSet[] = response.data.map((set: BaseQuestionSet) => {
          const setId = String(set.id).trim();
          const isPaid = set.isPaid === true;
          
          // 处理问题数量，确保正确填充
          let questionCount = set.questionCount || 0;
          
          // 如果后端没有提供问题数量，尝试从questions数组长度计算
          if (questionCount === 0 && Array.isArray(set.questions) && set.questions.length > 0) {
            questionCount = set.questions.length;
            console.log(`[HomePage] Using questions array length for count: ${set.title} - ${questionCount}`);
          }
          
          // 如果仍然为0，尝试从questionSetQuestions长度计算
          if (questionCount === 0 && Array.isArray((set as any).questionSetQuestions) && (set as any).questionSetQuestions.length > 0) {
            questionCount = (set as any).questionSetQuestions.length;
            console.log(`[HomePage] Using questionSetQuestions array length for count: ${set.title} - ${questionCount}`);
          }
          
          // 默认为试用状态
          let accessType: AccessType = 'trial';
          let hasAccess = !isPaid; // 免费题库自动有访问权限
          let remainingDays: number | null = null;
          let paymentMethod: string | undefined = undefined;
          
          // 优先顺序:
          // 1. 先检查现有状态中的已付费题库 (保留已知的付费状态)
          const existingSet = questionSets.find(s => s.id === setId);
          if (existingSet && existingSet.hasAccess && (existingSet.accessType === 'paid' || existingSet.accessType === 'redeemed')) {
            console.log(`[HomePage] 题库"${set.title}"(${setId})在现有状态中已是付费状态，保留当前状态`);
            hasAccess = true;
            accessType = existingSet.accessType;
            remainingDays = existingSet.remainingDays;
            paymentMethod = existingSet.accessType === 'redeemed' ? 'redeem' : 'paid';
            
            // 立即保存到本地缓存以确保状态一致性
            if (user?.id) {
              saveAccessToLocalStorage(setId, hasAccess, remainingDays, paymentMethod);
            }
          }
          // 2. 然后优先使用用户的购买记录（服务器数据最可靠）
          else if (userPurchasesMap.has(setId)) {
            const userPurchase = userPurchasesMap.get(setId);
            console.log(`[HomePage] 题库"${set.title}"(${setId})找到用户购买/兑换记录, 状态=${userPurchase.hasAccess ? '有效' : '无效'}, 类型=${userPurchase.accessType}`);
            
            if (!userPurchase.isExpired) {
              hasAccess = userPurchase.hasAccess;
              accessType = userPurchase.accessType;
              remainingDays = userPurchase.remainingDays;
              paymentMethod = userPurchase.paymentMethod;
              
              // 立即保存到本地缓存以确保状态一致性
              if (user?.id) {
                saveAccessToLocalStorage(setId, hasAccess, remainingDays, paymentMethod);
              }
            } else {
              // 处理过期购买记录
              accessType = 'expired';
              hasAccess = false;
              remainingDays = 0;
              
              // 同样更新本地缓存
              if (user?.id) {
                saveAccessToLocalStorage(setId, false, 0, userPurchase.paymentMethod);
              }
            }
          }
          // 3. 检查本地缓存里的付费记录（作为服务器数据的补充）
          else if (localCacheMap.has(setId)) {
            const cachedData = localCacheMap.get(setId);
            console.log(`[HomePage] 题库"${set.title}"(${setId})从本地缓存获取付费状态`);
            
            // 如果缓存中标记为已付费，则应用该状态
            if (cachedData.hasAccess) {
              hasAccess = true;
              remainingDays = cachedData.remainingDays;
              
              // 根据支付方式和剩余天数确定访问类型
              if (cachedData.paymentMethod === 'redeem' || cachedData.accessType === 'redeemed') {
                accessType = 'redeemed';
                paymentMethod = 'redeem';
              } else {
                accessType = 'paid';
                paymentMethod = 'paid';
                
                // 检查是否过期
                if (remainingDays !== null && remainingDays <= 0) {
                  accessType = 'expired';
                  hasAccess = false;
                }
              }
            }
          }
          // 4. 最后检查Socket数据（实时更新）
          else if (socketDataRef.current[setId]) {
            console.log(`[HomePage] 题库"${set.title}"(${setId})使用Socket数据更新权限`);
            
            hasAccess = socketDataRef.current[setId].hasAccess;
            remainingDays = socketDataRef.current[setId].remainingDays;
            
            if (socketDataRef.current[setId].accessType) {
              accessType = socketDataRef.current[setId].accessType as AccessType;
            } else if (hasAccess) {
              accessType = 'paid';
              // 检查剩余天数是否为0或负数，如果是则标记为过期
              if (remainingDays !== null && remainingDays <= 0) {
                accessType = 'expired';
                hasAccess = false;
              }
            }
          }
          
          // 确保免费题库始终可访问
          if (!isPaid) {
            hasAccess = true;
            accessType = 'trial';
            remainingDays = null;
          }
          
          // 处理featuredCategory - 如果题库的分类在精选分类中，则添加featuredCategory属性
          let featuredCategory: string | undefined = undefined;
          if (homeContent.featuredCategories && homeContent.featuredCategories.length > 0) {
            if (homeContent.featuredCategories.includes(set.category)) {
              featuredCategory = set.category;
            }
            // 如果题库被标记为精选，但没有指定featuredCategory，使用第一个精选分类
            else if (set.isFeatured && !set.featuredCategory) {
              featuredCategory = homeContent.featuredCategories[0];
            }
            // 保留现有的featuredCategory，如果它存在且在精选分类中
            else if (set.featuredCategory && homeContent.featuredCategories.includes(set.featuredCategory)) {
              featuredCategory = set.featuredCategory;
            }
          }
          
          // 确保validityPeriod字段存在，默认为180天
          const validityPeriod = set.validityPeriod || 180;
          
          return {
            ...set,
            hasAccess,
            accessType,
            remainingDays,
            validityPeriod,
            featuredCategory, // 添加featuredCategory属性
            questionCount // 确保问题数量被正确传递
          };
        });
        
        // 防止无效更新
        let needsUpdate = true;
        if (questionSets.length === preparedSets.length) {
          // 只比较权限相关字段和ID
          needsUpdate = questionSets.some((oldSet, index) => {
            const newSet = preparedSets[index];
            return oldSet.id !== newSet.id || 
                  oldSet.hasAccess !== newSet.hasAccess || 
                  oldSet.accessType !== newSet.accessType || 
                  oldSet.remainingDays !== newSet.remainingDays;
          });
        }
        
        if (needsUpdate) {
          console.log(`[HomePage] 题库数据或权限有变化，更新UI`);
          setQuestionSets(preparedSets);
          
          // 设置推荐题库
          // setRecommendedSets(preparedSets.filter(set => set.isFeatured).slice(0, 3));
        } else {
          console.log(`[HomePage] 题库数据及权限无变化，跳过更新`);
        }
        
        // 更新最后获取时间
        setLastFetchTime(now);
        
        // Always set loading to false after successful fetch
        setLoading(false);
        clearTimeout(loadingTimeoutRef.current);
        
        // 3. 检查已兑换题库的本地存储（作为后备方案）
        try {
          const redeemedStr = localStorage.getItem('redeemedQuestionSetIds');
          if (redeemedStr) {
            const redeemedIds = JSON.parse(redeemedStr);
            if (Array.isArray(redeemedIds) && redeemedIds.length > 0) {
              console.log(`[HomePage] 发现本地存储的${redeemedIds.length}个已兑换题库ID，作为后备检查`);
              
              // 对每个已兑换题库进行处理
              let localUpdatesCount = 0;
              
              redeemedIds.forEach(id => {
                const normalizedId = String(id).trim();
                
                // 查找对应题库
                const matchingSet = preparedSets.find(s => String(s.id).trim() === normalizedId);
                if (matchingSet && matchingSet.isPaid && !matchingSet.hasAccess) {
                  console.log(`[HomePage] 应用本地兑换记录: 题库ID=${normalizedId}, 名称="${matchingSet.title}"`);
                  
                  // 更新为已兑换状态
                  matchingSet.hasAccess = true;
                  matchingSet.accessType = 'redeemed';
                  localUpdatesCount++;
                  
                  // 保存到本地缓存
                  saveAccessToLocalStorage(normalizedId, true, null, 'redeem');
                }
              });
              
              if (localUpdatesCount > 0) {
                console.log(`[HomePage] 通过本地存储更新了${localUpdatesCount}个题库的访问权限`);
                // 有变更时重新更新题库列表状态
                setQuestionSets([...preparedSets]);
              }
            }
          }
        } catch (error) {
          console.error('[HomePage] 检查兑换记录出错:', error);
        }
        
        // 同步完成后触发一个全局事件，通知其他组件刷新
        window.dispatchEvent(new CustomEvent('questionSets:loaded', {
          detail: { 
            timestamp: now,
            count: preparedSets.length
          }
        }));
        
        return preparedSets;
      } else {
        console.error('[HomePage] 获取题库失败:', response?.message);
        // Set loading to false even if the request failed
        setLoading(false);
        clearTimeout(loadingTimeoutRef.current);
        
        // Show error message to user
        setErrorMessage('获取题库数据失败，请稍后重试');
        return questionSets;
      }
    } catch (error) {
      console.error('[HomePage] 获取题库异常:', error);
      // Set loading to false even if an error occurred
      setLoading(false);
      clearTimeout(loadingTimeoutRef.current);
      
      // Show error message to user
      setErrorMessage('获取题库时发生错误，请刷新页面重试');
      return questionSets;
    } finally {
      pendingFetchRef.current = false;
    }
  }, [questionSets, user?.id, user?.purchases, user?.redeemCodes, getAccessFromLocalCache, saveAccessToLocalStorage, homeContent.featuredCategories, canMakeRequest]); // 添加canMakeRequest作为依赖项
  
  // 初始化时获取题库列表 - 修复重复加载问题
  useEffect(() => {
    // 如果已经有题库列表，则不重新加载
    if (questionSets.length === 0) {
      console.log(`[HomePage] 初始化获取题库列表`);
      fetchQuestionSets();
    } else {
      // If we already have question sets, ensure loading is false
      setLoading(false);
    }
  }, [fetchQuestionSets]); // 移除questionSets.length依赖，避免循环

  // 监听来自ProfilePage的刷新通知 - 超简化版本，避免无限循环
  useEffect(() => {
    // 只在组件挂载时处理事件监听，不要每次都刷新题库列表
    // 移除这里的fetchQuestionSets()调用
    
    // 添加一个简单的事件监听器来处理ProfilePage的刷新通知
    const handleRefreshRequest = () => {
      console.log('[HomePage] 收到刷新请求');
      fetchQuestionSets();
    };
    
    // 使用自定义事件而不是socket
    window.addEventListener('questionSets:refresh', handleRefreshRequest);
    
    return () => {
      window.removeEventListener('questionSets:refresh', handleRefreshRequest);
    };
  }, []); // 空依赖数组，只在挂载时执行

  // 用户登录状态改变时重新获取题库列表
  useEffect(() => {
    if (user?.id) {
      console.log('[HomePage] 用户登录状态变化，重新获取题库列表');
      fetchQuestionSets();
    }
  }, [user?.id, fetchQuestionSets]);

  // 添加函数来清除本地存储中过期的缓存数据
  useEffect(() => {
    if (!user?.id) return;
    
    console.log('[HomePage] 用户登录，检查本地缓存');
    
    // 清除过期的访问权限缓存
    try {
      const cacheKey = 'question_set_access';
      const cache = localStorage.getItem(cacheKey);
      
      if (cache) {
        const cacheData = JSON.parse(cache);
        let hasUpdates = false;
        
        // 遍历所有用户的缓存
        Object.keys(cacheData).forEach(userId => {
          // 如果不是当前用户的缓存，跳过
          if (userId !== user.id) return;
          
          const userCache = cacheData[userId];
          
          // 遍历该用户的所有题库缓存
          Object.keys(userCache).forEach(qsId => {
            const record = userCache[qsId];
            const cacheAge = Date.now() - (record.timestamp || 0);
            
            // 只清除非付费状态的过期缓存，保留付费记录
            // 缓存超过24小时视为过期，确保从服务器获取最新状态
            if (cacheAge > 86400000 && !record.hasAccess) { // 24小时 = 86400000ms (之前是2小时)
              console.log(`[HomePage] 清除过期缓存: ${qsId}，缓存时间: ${cacheAge/1000/60}分钟，状态: 未付费`);
              delete userCache[qsId];
              hasUpdates = true;
            }
          });
        });
        
        // 如果有更新，保存回localStorage
        if (hasUpdates) {
          localStorage.setItem(cacheKey, JSON.stringify(cacheData));
          console.log('[HomePage] 已清理过期缓存');
        }
      }
    } catch (error) {
      console.error('[HomePage] 清除缓存失败:', error);
    }
  }, [user?.id]);

  // 监听全局兑换码成功事件
  useEffect(() => {
    const handleRedeemSuccess = (e: Event) => {
      const customEvent = e as CustomEvent;
      
      // 优先使用 questionSetId，兼容旧版本的 quizId
      const questionSetId = customEvent.detail?.questionSetId || customEvent.detail?.quizId;
      
      // 从事件中获取剩余天数，如果不存在则使用默认值
      const remainingDays = customEvent.detail?.remainingDays || customEvent.detail?.validityPeriod || 180;
      
      console.log('[HomePage] 接收到兑换码成功事件:', { questionSetId, remainingDays });
      
      if (questionSetId) {
        setQuestionSets(prevSets => {
          return prevSets.map(set => {
            if (set.id === questionSetId) {
              console.log('[HomePage] 更新题库访问状态:', set.title);
              
              // 保存到localStorage缓存，确保用户已登录
              if (user?.id) {
                saveAccessToLocalStorage(questionSetId, true, remainingDays);
              }
              
              // Add to recently updated sets for animation
              setRecentlyUpdatedSets(prev => ({
                ...prev,
                [questionSetId]: Date.now() 
              }));
              
              return {
                ...set,
                hasAccess: true,
                remainingDays,
                accessType: 'redeemed'
              };
            }
            return set;
          });
        });
      }
    };

    window.addEventListener('redeem:success', handleRedeemSuccess);

    return () => {
      window.removeEventListener('redeem:success', handleRedeemSuccess);
    };
  }, [user?.id, saveAccessToLocalStorage]);

  // 增强监听socket权限更新事件的实现
  useEffect(() => {
    if (!socket || !user?.id) return;
    
    console.log('[HomePage] 设置Socket事件监听');
    
    // 添加连接状态监听
    const handleConnect = () => {
      console.log('[HomePage] Socket重新连接，重新请求权限数据');
      
      // 重置请求标记
      hasRequestedAccess.current = false;
      
      // 防止重复请求
      const lastRequest = parseInt(sessionStorage.getItem('last_socket_reconnect_request') || '0', 10);
      const now = Date.now();
      if (now - lastRequest < 10000) { // 10秒内不重复请求
        console.log('[HomePage] 最近刚重连过，跳过重复请求');
        return;
      }
      sessionStorage.setItem('last_socket_reconnect_request', now.toString());
      
      // 重新请求权限
      if (questionSets.length > 0) {
        requestAccessStatusForAllQuestionSets();
      }
    };
    
    // 添加连接错误监听
    const handleConnectError = (error: any) => {
      console.error('[HomePage] Socket连接错误:', error);
    };
    
    // 监听权限更新事件
    const handleAccessUpdate = (data: any) => {
      // 过滤不是当前用户的事件
      if (data.userId !== user.id) return;
      
      console.log(`[HomePage] 收到题库 ${data.questionSetId} 权限更新:`, data);
      
      // 添加防御性检查
      if (!data.questionSetId) {
        console.error('[HomePage] 收到无效的权限更新数据:', data);
        return;
      }
      
      // 更新本地缓存
      saveAccessToLocalStorage(
        data.questionSetId, 
        data.hasAccess, 
        data.remainingDays,
        data.paymentMethod || 'unknown'
      );
      
      // 检查数据一致性，控制请求频率
      if (data.source !== 'db_check' && data.hasAccess) {
        const lastDbCheck = parseInt(sessionStorage.getItem(`last_db_check_${data.questionSetId}`) || '0', 10);
        const now = Date.now();
        // 每10分钟最多验证一次同一题库的权限
        if (now - lastDbCheck > 600000) {
          sessionStorage.setItem(`last_db_check_${data.questionSetId}`, now.toString());
          
          setTimeout(async () => {
            try {
              const dbAccess = await hasAccessInDatabase(data.questionSetId);
              if (dbAccess !== data.hasAccess) {
                console.warn(`[HomePage] 权限数据不一致，执行数据库验证 - Socket=${data.hasAccess}, 数据库=${dbAccess}`);
              }
            } catch (error) {
              console.error('[HomePage] 验证数据库权限失败:', error);
            }
          }, 2000);
        } else {
          console.log(`[HomePage] 跳过数据库权限验证，上次验证在 ${Math.floor((now - lastDbCheck)/1000/60)} 分钟前`);
        }
      }
      
      // 立即更新题库的UI状态
      setQuestionSets(prevSets => 
        prevSets.map(set => 
          set.id === data.questionSetId 
            ? {
                ...set,
                hasAccess: data.hasAccess,
                accessType: data.accessType || (data.hasAccess ? (data.paymentMethod === 'redeem' ? 'redeemed' : 'paid') : 'trial'),
                remainingDays: data.remainingDays
              }
            : set
        )
      );
      
      // 标记为最近更新
      setRecentlyUpdatedSets(prev => ({
        ...prev,
        [data.questionSetId]: Date.now()
      }));
    };
    
    // 监听设备同步事件
    const handleDeviceSync = (data: any) => {
      if (data.userId !== user.id) return;
      
      console.log("[HomePage] 收到设备同步事件:", data);
      
      // 限制同步频率
      const lastSync = parseInt(sessionStorage.getItem('last_device_sync') || '0', 10);
      const now = Date.now();
      if (now - lastSync < 60000) { // 1分钟内不重复同步
        console.log('[HomePage] 最近刚同步过，跳过重复同步');
        return;
      }
      sessionStorage.setItem('last_device_sync', now.toString());
      
      // 设备同步事件要求完整刷新权限和题库列表
      (async () => {
        try {
          // 同步最新权限
          await syncAccessRights();
          
          // 刷新题库列表，使用最新数据
          await fetchQuestionSets({ forceFresh: true });
        } catch (error) {
          console.error('[HomePage] 处理设备同步事件错误:', error);
        }
      })();
    };
    
    // 使用防抖动处理批量访问检查结果
    const handleBatchAccessResult = debounce((data: any) => {
      if (data.userId !== user?.id || !Array.isArray(data.results)) return;
      
      const now = Date.now();
      console.log(`[HomePage] 收到批量访问检查结果: ${data.results.length} 个题库, 来源: ${data.source || '未知'}, 时间戳: ${data.timestamp || '未知'}`);
      
      // 添加防御性检查
      if (data.results.length === 0) {
        console.log('[HomePage] 收到空结果集，跳过处理');
        return;
      }
      
      // 只在特定情况下应用时间戳检查 - 对于登录后的首次检查，应始终应用结果
      const isLoginCheck = data.source === 'login_explicit_check' || data.source === 'login_sync';
      
      if (!isLoginCheck && data.timestamp && data.timestamp < lastSocketUpdateTime.current) {
        console.log(`[HomePage] 收到的批量检查结果已过期 (${data.timestamp} < ${lastSocketUpdateTime.current})，跳过处理`);
        return;
      }
      
      // 尝试解析和处理兑换码数据
      try {
        const redeemedStr = localStorage.getItem('redeemedQuestionSetIds');
        const redeemedIds = redeemedStr ? JSON.parse(redeemedStr) : [];
        if (Array.isArray(redeemedIds) && redeemedIds.length > 0) {
          console.log(`[HomePage] 本地兑换记录: ${redeemedIds.length}个题库`);
        }
      } catch (error) {
        console.error('[HomePage] 解析兑换记录出错:', error);
      }

      // 读取本地缓存的权限状态，优先使用已知的付费状态
      const localAccessCache = getLocalAccessCache();
      const userCache = user?.id && localAccessCache[user.id] ? localAccessCache[user.id] : {};

      // 收集所有需要更新的题库ID及其状态，用于批量更新
      const updatesById = new Map();
      
      // 更新Socket数据引用和本地缓存
      data.results.forEach((result: any) => {
        const questionSetId = String(result.questionSetId).trim();
        
        // 确保数据有效且包含必要字段
        if (!questionSetId || result.hasAccess === undefined) {
          console.log(`[HomePage] 跳过无效数据: ${JSON.stringify(result)}`);
          return;
        }
        
        // 确保转换为正确的类型
        const hasAccess = Boolean(result.hasAccess);
        const remainingDays = result.remainingDays !== undefined ? Number(result.remainingDays) : null;
        const paymentMethod = result.paymentMethod || 'unknown';
        const accessType = paymentMethod === 'redeem' ? 'redeemed' : (hasAccess ? 'paid' : 'trial');
        
        // 检查本地缓存是否有更优先的记录 (已付费的缓存记录优先于未付费的服务器记录)
        const hasPriorityCacheRecord = userCache[questionSetId] && 
                                     userCache[questionSetId].hasAccess && 
                                     !hasAccess;
        
        if (hasPriorityCacheRecord) {
          console.log(`[HomePage] 题库 ${questionSetId} 在本地缓存中已标记为付费，优先使用缓存数据`);
          // 使用本地缓存数据替代服务器返回的数据
          const cacheEntry = userCache[questionSetId];
          
          // 保存到socketDataRef引用
          socketDataRef.current[questionSetId] = {
            hasAccess: true, // 缓存中为付费状态
            remainingDays: cacheEntry.remainingDays,
            accessType: cacheEntry.paymentMethod === 'redeem' ? 'redeemed' : 'paid'
          };
          
          // 添加到批量更新映射
          updatesById.set(questionSetId, {
            hasAccess: true,
            remainingDays: cacheEntry.remainingDays,
            accessType: cacheEntry.paymentMethod === 'redeem' ? 'redeemed' : 'paid',
            paymentMethod: cacheEntry.paymentMethod
          });
          
          return; // 跳过后续处理
        }
        
        console.log(`[HomePage] 题库 ${questionSetId} 权限检查结果: 可访问=${hasAccess}, 剩余天数=${remainingDays}, 支付方式=${paymentMethod}`);
        
        // 保存到socketDataRef引用
        socketDataRef.current[questionSetId] = {
          hasAccess,
          remainingDays,
          accessType
        };
        
        // 如果是付费状态，更新本地缓存
        if (hasAccess) {
          // 更新本地缓存
          saveAccessToLocalStorage(
            questionSetId,
            hasAccess,
            remainingDays,
            paymentMethod
          );
        }
        
        // 添加到批量更新映射
        updatesById.set(questionSetId, {
          hasAccess,
          remainingDays,
          accessType,
          paymentMethod
        });
      });
      
      // 如果收到的是登录相关的检查结果，优先级更高，立即更新UI
      if (isLoginCheck) {
        console.log(`[HomePage] 这是登录后的首次检查，立即更新题库UI状态`);
        updateQuestionSetsImmediately();
        return;
      }
      
      // 常规更新使用防抖，合并短时间内的多次更新
      if (debounceTimerRef.current) {
        clearTimeout(debounceTimerRef.current);
      }
      
      debounceTimerRef.current = setTimeout(() => {
        updateQuestionSetsImmediately();
      }, 1000); // 1秒防抖时间
      
      // 实际执行更新的函数
      function updateQuestionSetsImmediately() {
        if (updatesById.size === 0) {
          console.log(`[HomePage] 没有需要更新的题库状态`);
          return;
        }
        
        console.log(`[HomePage] 应用批量权限更新到 ${updatesById.size} 个题库`);
        
        // 更新题库状态，增加变化检测逻辑
        setQuestionSets(prevSets => {
          let hasChanged = false;
          let updatedCount = 0;
          
          const updatedSets = prevSets.map(set => {
            const setId = String(set.id).trim();
            const updateData = updatesById.get(setId);
            
            if (!updateData) return set;
            
            // 检查现有付费状态 - 如果题库已经是付费状态，但更新数据显示为未付费，保留付费状态
            if (set.hasAccess && (set.accessType === 'paid' || set.accessType === 'redeemed') && !updateData.hasAccess) {
              console.log(`[HomePage] 题库 "${set.title}" 保留现有付费状态, 忽略服务器的未付费状态更新`);
              return set;
            }
            
            // 使用统一函数确定访问状态
            const newStatus = determineAccessStatus(
              set,
              updateData.hasAccess,
              updateData.remainingDays,
              updateData.paymentMethod
            );
            
            // 只有在状态真正变化时才更新
            if (set.hasAccess !== newStatus.hasAccess || 
                set.accessType !== newStatus.accessType || 
                set.remainingDays !== newStatus.remainingDays) {
              
              console.log(`[HomePage] 题库 "${set.title}" 状态有变化: ${set.accessType} -> ${newStatus.accessType}, hasAccess: ${set.hasAccess} -> ${newStatus.hasAccess}`);
              hasChanged = true;
              updatedCount++;
              
              // 标记为最近更新
              setRecentlyUpdatedSets(prev => ({
                ...prev,
                [set.id]: Date.now()
              }));
              
              // 返回更新后的题库对象
              return {
                ...set,
                ...newStatus
              };
            }
            
            return set;
          });
          
          // 记录更新结果
          console.log(`[HomePage] 批量更新完成: ${updatedCount}/${updatesById.size}个题库状态有变化`);
          
          // 清空Socket数据引用
          socketDataRef.current = {};
          
          // 只有在实际有变化时才返回新数组，避免不必要的重渲染
          return hasChanged ? updatedSets : prevSets;
        });
        
        // 更新时间戳
        lastSocketUpdateTime.current = now;
        
        // 通知页面已更新权限
        window.dispatchEvent(new CustomEvent('accessRights:updated', {
          detail: {
            userId: user?.id, // 使用可选链操作符处理user可能为null的情况
            timestamp: now,
            source: 'socket_batch_update',
            updatedCount: updatesById.size
          }
        }));
      }
    }, 500); // 500ms防抖
    
    // 注册Socket连接状态事件监听
    socket.on('connect', handleConnect);
    socket.on('connect_error', handleConnectError);
    
    // 注册Socket权限事件监听
    socket.on('questionSet:accessUpdate', handleAccessUpdate);
    socket.on('user:deviceSync', handleDeviceSync);
    socket.on('questionSet:batchAccessResult', handleBatchAccessResult);
    
    // 首页内容更新处理 - 在这个useEffect中仅记录事件，实际处理放在专用useEffect中
    const handleHomeContentUpdate = debounce((data) => {
      console.log('[HomePage] Socket event: admin:homeContent:updated forwarding to custom event');
      // 转发为自定义事件，由专门的处理器处理
      window.dispatchEvent(new CustomEvent('homeContent:updated', {
        detail: data
      }));
    }, 1000); // 1秒防抖
    
    socket.on('admin:homeContent:updated', handleHomeContentUpdate);
    
    // 发送状态同步请求，确保服务器知道此连接是谁的
    socket.emit('user:identify', {
      userId: user.id,
      clientId: `homepage_${Date.now()}`,
      timestamp: Date.now()
    });
    
    return () => {
      // 清理所有事件监听
      socket.off('connect', handleConnect);
      socket.off('connect_error', handleConnectError);
      socket.off('questionSet:accessUpdate', handleAccessUpdate);
      socket.off('user:deviceSync', handleDeviceSync);
      socket.off('questionSet:batchAccessResult', handleBatchAccessResult);
      socket.off('admin:homeContent:updated', handleHomeContentUpdate);
      
      // 清理定时器
      if (debounceTimerRef.current) {
        clearTimeout(debounceTimerRef.current);
      }
      
      console.log('[HomePage] 已清理所有Socket事件监听');
    };
  }, [socket, user?.id, syncAccessRights, fetchQuestionSets, saveAccessToLocalStorage, requestAccessStatusForAllQuestionSets, determineAccessStatus, hasAccessInDatabase, questionSets.length]); // 添加了必要的依赖项

  // 登录状态变化后重新获取题库数据
  useEffect(() => {
    if (!user?.id) {
      // Reset the flag when user logs out
      hasRequestedAccess.current = false;
      // Make sure loading is false when logged out
      setLoading(false);
      return;
    }
    
    // 使用session storage跟踪登录处理，防止重复请求
    const loginHandled = sessionStorage.getItem(`login_handled_${user.id}`);
    const loginTime = parseInt(sessionStorage.getItem(`login_time_${user.id}`) || '0', 10);
    const now = Date.now();
    
    // 如果最近10分钟内已处理过登录，且不是页面刷新，跳过
    const isPageRefresh = !sessionStorage.getItem('page_session_id');
    if (loginHandled === 'true' && now - loginTime < 600000 && !isPageRefresh) {
      console.log('[HomePage] 最近已处理过登录流程，跳过重复处理');
      
      // 即使跳过完整流程，也尝试从缓存应用付费状态
      try {
        const localCache = getLocalAccessCache();
        if (localCache[user.id]) {
          console.log('[HomePage] 尝试从本地缓存恢复题库访问状态');
          
          // 更新可能过期的题库状态，但要稍作延迟确保questionSets已加载
          setTimeout(() => {
            // 只有在题库列表已加载的情况下才应用缓存
            if (questionSets.length > 0) {
              let hasUpdated = false;
              
              // 创建题库列表副本
              const updatedSets = [...questionSets];
              
              // 遍历本地缓存应用付费状态
              Object.keys(localCache[user.id]).forEach(qsId => {
                const cacheEntry = localCache[user.id][qsId];
                if (!cacheEntry.hasAccess) return; // 只应用已付费的记录
                
                // 查找对应题库
                const index = updatedSets.findIndex(set => set.id === qsId);
                if (index >= 0 && !updatedSets[index].hasAccess) {
                  // 只更新未付费的题库
                  updatedSets[index] = {
                    ...updatedSets[index],
                    hasAccess: true,
                    accessType: cacheEntry.paymentMethod === 'redeem' ? 'redeemed' : 'paid',
                    remainingDays: cacheEntry.remainingDays
                  };
                  hasUpdated = true;
                  console.log(`[HomePage] 从缓存恢复题库 "${updatedSets[index].title}" 的付费状态`);
                }
              });
              
              // 如果有更新，应用变更
              if (hasUpdated) {
                console.log('[HomePage] 已从缓存恢复题库状态，更新UI');
                setQuestionSets(updatedSets);
              }
            }
          }, 300);
        }
      } catch (error) {
        console.error('[HomePage] 恢复缓存状态失败:', error);
      }
      
      return;
    }
    
    // 标记页面会话
    const pageSessionId = Date.now().toString();
    sessionStorage.setItem('page_session_id', pageSessionId);
    
    console.log('[HomePage] 用户登录事件触发，开始处理登录流程');
    
    // 防止多次触发 - 使用ref标记代替sessionStorage
    if (hasRequestedAccess.current) {
      console.log('[HomePage] 已在处理登录流程，跳过重复请求');
      return;
    }
    
    // 标记为已处理
    hasRequestedAccess.current = true;
    sessionStorage.setItem(`login_handled_${user.id}`, 'true');
    sessionStorage.setItem(`login_time_${user.id}`, now.toString());
    
    // Set loading true explicitly when starting login flow
    setLoading(true);
    
    // Set a safety timeout to prevent infinite loading state
    if (loadingTimeoutRef.current) {
      clearTimeout(loadingTimeoutRef.current);
    }
    
    loadingTimeoutRef.current = setTimeout(() => {
      console.log('[HomePage] Login flow timeout triggered - forcing loading state to false');
      setLoading(false);
    }, 15000); // 15 seconds timeout for the entire login flow
    
    // 添加对同步事件的监听
    const handleSyncComplete = (event: Event) => {
      const syncEvent = event as CustomEvent;
      console.log('[HomePage] 接收到权限同步完成事件:', syncEvent.detail);
      
      // 限制请求频率
      if (!canMakeRequest()) {
        console.log('[HomePage] 请求频率受限，暂缓更新');
        return;
      }
      
      // 强制刷新题库列表，以确保显示最新的权限状态
      fetchQuestionSets({ forceFresh: true }).then(() => {
        console.log('[HomePage] 权限同步后题库列表已更新');
      });
    };
    
    // 添加权限同步完成事件监听
    window.addEventListener('accessRights:updated', handleSyncComplete);
    
    // 登录流程，按顺序执行，避免竞态条件，添加请求限制
    (async () => {
      try {
        // 首先尝试从本地缓存恢复题库状态
        const localCache = getLocalAccessCache();
        const hasCachedAccess = user?.id && localCache[user.id] && Object.keys(localCache[user.id]).length > 0;
        
        if (hasCachedAccess) {
          console.log('[HomePage] 发现本地缓存的访问权限记录');
          
          // 如果已有题库列表，立即应用缓存状态
          if (questionSets.length > 0) {
            let hasUpdated = false;
            const updatedSets = [...questionSets];
            
            Object.keys(localCache[user.id]).forEach(qsId => {
              const cacheEntry = localCache[user.id][qsId];
              if (!cacheEntry.hasAccess) return; // 只应用已付费的记录
              
              // 查找对应题库
              const index = updatedSets.findIndex(set => set.id === qsId);
              if (index >= 0) {
                // 更新付费状态
                updatedSets[index] = {
                  ...updatedSets[index],
                  hasAccess: true,
                  accessType: cacheEntry.paymentMethod === 'redeem' ? 'redeemed' : 'paid',
                  remainingDays: cacheEntry.remainingDays
                };
                hasUpdated = true;
                console.log(`[HomePage] 从缓存恢复题库 "${updatedSets[index].title}" 的付费状态`);
              }
            });
            
            // 如果有更新，应用变更
            if (hasUpdated) {
              console.log('[HomePage] 已从缓存恢复题库状态，更新UI');
              setQuestionSets(updatedSets);
            }
          }
        }
        
        // 第1步：通过syncAccessRights同步最新权限数据
        console.log('[HomePage] 1. 开始同步访问权限数据');
        await syncAccessRights();
        console.log('[HomePage] 同步访问权限完成，此时用户数据和访问权限已是最新');
        
        // 等待短暂时间，避免请求过于密集
        await new Promise(resolve => setTimeout(resolve, 500));
        
        // 第2步：使用最新的权限信息，获取并处理题库列表
        console.log('[HomePage] 2. 获取题库列表，强制使用最新数据');
        const freshSets = await fetchQuestionSets({ forceFresh: true });
        console.log('[HomePage] 题库列表获取并处理完成，UI应显示正确的权限状态');
        
        // 第3步：通过socket请求批量权限检查，确保数据一致性
        // 在socket连接有效时才执行
        if (socket && socket.connected) {
          console.log('[HomePage] 3. 请求Socket批量权限检查，确保数据一致性');
          
          // 使用限制，避免过多的socket事件
          const lastSocketSync = parseInt(sessionStorage.getItem('last_socket_sync') || '0', 10);
          const now = Date.now();
          
          // 确保至少间隔5秒
          if (now - lastSocketSync > 5000) {
            sessionStorage.setItem('last_socket_sync', now.toString());
            
            socket.emit('user:syncAccessRights', {
              userId: user.id,
              forceRefresh: true,
              timestamp: Date.now()
            });
            
            // 等待1秒后再发送设备同步，避免请求密集
            await new Promise(resolve => setTimeout(resolve, 1000));
            
            // 立即触发设备同步事件，确保其他设备也更新
            socket.emit('user:deviceSync', {
              userId: user.id,
              type: 'access_refresh',
              timestamp: Date.now(),
              source: 'login_sync'
            });
            
            // 显式针对每个付费题库检查访问权限
            const paidSets = freshSets.filter(set => set.isPaid === true);
            if (paidSets.length > 0) {
              // 再等待1秒，确保前面的请求已处理
              await new Promise(resolve => setTimeout(resolve, 1000));
              
              console.log(`[HomePage] 4. 主动检查 ${paidSets.length} 个付费题库的访问权限`);
              socket.emit('questionSet:checkAccessBatch', {
                userId: user.id,
                questionSetIds: paidSets.map(set => String(set.id).trim()),
                source: 'login_explicit_check',
                timestamp: Date.now()
              });
            }
          } else {
            console.log(`[HomePage] 跳过socket同步，距离上次同步仅 ${(now - lastSocketSync)/1000} 秒`);
          }
        } else {
          console.log('[HomePage] Socket未连接，跳过socket相关操作');
        }
        
        // 设置loading状态为false，表示登录流程完成
        setLoading(false);
        clearTimeout(loadingTimeoutRef.current);
        
        // 清理事件监听
        window.removeEventListener('accessRights:updated', handleSyncComplete);
      } catch (error) {
        console.error('[HomePage] 登录流程处理出错:', error);
        setLoading(false);
        setErrorMessage('请求失败，请稍后重试');
        
        // 清理事件监听
        window.removeEventListener('accessRights:updated', handleSyncComplete);
      }
    })();
    
    // 清理函数，确保在组件卸载时移除事件监听
    return () => {
      window.removeEventListener('accessRights:updated', handleSyncComplete);
    };
  }, [questionSets.length, user?.id, socket, requestAccessStatusForAllQuestionSets, getLocalAccessCache, fetchQuestionSets, syncAccessRights]);

  // 添加重复请求检测和预防 - 防止组件重渲染引起的重复请求
  useEffect(() => {
    if (!user?.id) return;
    
    const checkForLoops = () => {
      const now = Date.now();
      const requestsKey = 'homepage_requests_count';
      const requestsTimeKey = 'homepage_requests_time';
      
      // 获取请求计数和时间
      const requestsCount = parseInt(sessionStorage.getItem(requestsKey) || '0', 10);
      const requestsTime = parseInt(sessionStorage.getItem(requestsTimeKey) || '0', 10);
      
      // 检查是否有重复请求迹象
      if (now - requestsTime < 5000 && requestsCount > 8) {
        console.warn('[HomePage] 检测到异常重复请求，可能存在循环!');
        
        // 尝试中断可能的循环
        hasRequestedAccess.current = true;
        lastSocketUpdateTime.current = now;
        pendingFetchRef.current = true;
        
        // 5秒后重置阻止状态
        setTimeout(() => {
          pendingFetchRef.current = false;
        }, 5000);
        
        // 重置计数器
        sessionStorage.setItem(requestsKey, '0');
        sessionStorage.setItem(requestsTimeKey, now.toString());
        
        return true;
      }
      
      // 如果间隔超过10秒，重置计数器
      if (now - requestsTime > 10000) {
        sessionStorage.setItem(requestsKey, '1');
        sessionStorage.setItem(requestsTimeKey, now.toString());
      } else {
        // 否则增加计数
        sessionStorage.setItem(requestsKey, (requestsCount + 1).toString());
        sessionStorage.setItem(requestsTimeKey, now.toString());
      }
      
      return false;
    };
    
    // 启动循环检测
    const loopDetected = checkForLoops();
    
    // 如果检测到循环，显示警告并中断操作
    if (loopDetected) {
      console.warn('[HomePage] 已中断可能的无限循环，暂停操作5秒');
    }
  }, [user?.id]);

  // 添加监听题库更新的useEffect - 优化减少请求频率
  useEffect(() => {
    if (!isInitialLoad.current) {
      // Only log if we're not already requesting access
      if (!hasRequestedAccess.current) {
        console.log('[HomePage] 题库列表更新，可能需要请求最新权限状态');
        
        // 添加更严格的请求节流
        const now = Date.now();
        const lastUpdateRequest = parseInt(sessionStorage.getItem('last_question_sets_update_request') || '0', 10);
        
        // 只有距离上次请求超过30秒才允许自动请求
        if (user?.id && socket && questionSets.length > 0 && 
            !hasRequestedAccess.current && 
            now - lastUpdateRequest > 30000 && 
            now - lastSocketUpdateTime.current > 15000 && 
            canMakeRequest()) {
          
          sessionStorage.setItem('last_question_sets_update_request', now.toString());
          requestAccessStatusForAllQuestionSets();
        } else {
          console.log('[HomePage] 跳过权限请求: 最近已请求过或条件不满足');
        }
      } else {
        console.log('[HomePage] 题库列表更新，但已有请求正在进行，跳过');
      }
    } else {
      console.log('[HomePage] 初次加载，跳过权限检查');
      isInitialLoad.current = false;
    }
  }, [questionSets.length, user?.id, socket, requestAccessStatusForAllQuestionSets, canMakeRequest]);

  // Add a cleanup effect to clear timeouts when component unmounts
  useEffect(() => {
    return () => {
      if (loadingTimeoutRef.current) {
        clearTimeout(loadingTimeoutRef.current);
      }
      if (debounceTimerRef.current) {
        clearTimeout(debounceTimerRef.current);
      }
    };
  }, []);

  // 增加事件监听，处理UserContext中的自定义事件
  useEffect(() => {
    // 处理导航事件
    const handleNavigation = (event: CustomEvent<{path: string, reason: string}>) => {
      console.log('[HomePage] 接收到导航事件:', event.detail);
      
      // 如果当前已在首页，则刷新数据
      if (event.detail.reason === 'logout') {
        setQuestionSets([]);
        // 重新加载数据
        fetchQuestionSets({ forceFresh: true });
      }
    };
    
    // 处理刷新事件
    const handleRefresh = (event: CustomEvent<{reason: string}>) => {
      console.log('[HomePage] 接收到刷新事件:', event.detail);
      if (event.detail.reason === 'logout') {
        // 强制刷新页面数据
        setQuestionSets([]);
        // 重新加载数据
        fetchQuestionSets({ forceFresh: true });
      }
    };
    
    // 添加事件监听
    window.addEventListener('app:navigation', handleNavigation as EventListener);
    window.addEventListener('app:refresh', handleRefresh as EventListener);
    
    // 清理事件监听
    return () => {
      window.removeEventListener('app:navigation', handleNavigation as EventListener);
      window.removeEventListener('app:refresh', handleRefresh as EventListener);
    };
  }, [fetchQuestionSets, setQuestionSets]);

  // Restore the setupRenderEffects function and combine with our categories logic
  const setupRenderEffects = useCallback(() => {
    console.log('[HomePage] 设置渲染效果...');
    
    // 确保首次渲染时正确处理精选分类
    if (homeContent.featuredCategories && homeContent.featuredCategories.length > 0) {
      console.log('[HomePage] 首页包含以下精选分类:', homeContent.featuredCategories);
      
      // 将精选分类与题库分类进行比较
      const categoriesInSets = Array.from(new Set(questionSets.map(s => s.category)));
      console.log('[HomePage] 题库中的分类:', categoriesInSets);
      
      // 找出匹配的分类
      const matchingCategories = homeContent.featuredCategories.filter(c => 
        categoriesInSets.includes(c)
      );
      console.log('[HomePage] 匹配的精选分类:', matchingCategories);
      
      // 找出被标记为精选的题库
      const featuredSets = questionSets.filter(s => s.isFeatured);
      console.log('[HomePage] 标记为精选的题库数量:', featuredSets.length);
    }
  }, [questionSets, homeContent.featuredCategories]);

  // Add interface for the home content fetch options
  interface HomeContentFetchOptions {
    showNotification?: boolean;
    source?: string;
    fullContent?: HomeContentData;
    skipRefresh?: boolean; // Add this parameter to prevent auto-refresh cycles
  }
  
  // Clean up the fetchLatestHomeContent implementation
  const fetchLatestHomeContent = useCallback(async (options: HomeContentFetchOptions = {}) => {
    // 强化请求限制检查 - 除初始加载外都检查
    if (options.source !== 'initial_load' && !canMakeRequest()) {
      console.log('[HomePage] 请求被限制，跳过首页内容获取');
      return;
    }
    
    // Add enhanced loop detection at the beginning of the function
    if (detectLoop('homeContent', 3, 8000) || isBlocked('homeContent')) {
      console.error('[HomePage] Detected potential infinite loop in content fetching. Breaking cycle.');
      // Exit early to break the loop completely
      return;
    }

    // Special handling for admin-triggered forced reloads
    const forceFullContentRefresh = sessionStorage.getItem('forceFullContentRefresh') === 'true';
    const forceReloadTimestamp = localStorage.getItem('home_content_force_reload');
    const adminSavedTimestamp = sessionStorage.getItem('adminSavedContentTimestamp');
    
    // STRONG INFINITE LOOP PREVENTION - Global cooldown tracking
    const globalLastUpdate = parseInt(localStorage.getItem('global_home_content_last_update') || '0');
    const now = Date.now();
    
    // Increased cooldown period for better prevention (5 seconds)
    const globalCooldown = 5000; // 5 seconds minimum between any content updates
    
    if (now - globalLastUpdate < globalCooldown && !options.source?.includes('initial')) {
      console.log(`[HomePage] Global cooldown active (${now - globalLastUpdate}ms < ${globalCooldown}ms). Skipping update.`);
      return;
    }
    
    // If the source is admin_direct or we have a forced reload flag, bypass throttling but not loop detection
    const isAdminDirectUpdate = options.source === 'admin_direct' || options.source === 'admin_event' || 
                               forceFullContentRefresh;
    
    if (isAdminDirectUpdate) {
      console.log(`[HomePage] Processing FORCED content refresh from admin`);
      // Clear all force flags to prevent loops
      sessionStorage.removeItem('forceFullContentRefresh');
      sessionStorage.removeItem('adminTriggeredUpdate');
      localStorage.removeItem('home_content_force_reload');
      
      // Still respect global cooldown
      if (now - globalLastUpdate < 1000 && pendingFetchRef.current) {
        console.log(`[HomePage] Preventing duplicate admin update within 1s`);
        return;
          }
        } else {
      // Regular throttling for non-admin updates
      // Prevent concurrent requests
      if (pendingFetchRef.current) {
        console.log(`[HomePage] Already fetching content, skipping update (source: ${options.source || 'unknown'})`);
        return;
      }
      
      // ADD PREVENTION FOR INFINITE LOOPS
      const lastFetchTimestamp = parseInt(sessionStorage.getItem('lastHomeContentFetch') || '0');
      const timeSinceLastFetch = now - lastFetchTimestamp;
      
      // If we've fetched within the last 3 seconds (except initial load), debounce
      if (options.source !== 'initial_load' && timeSinceLastFetch < 3000) {
        console.log(`[HomePage] Too many requests (${timeSinceLastFetch}ms since last). Debouncing.`);
        return;
      }
      
      // Enhanced request count tracking with time window resetting
      const requestCount = parseInt(sessionStorage.getItem('homeContentRequestCount') || '0');
      const requestCountResetTime = parseInt(sessionStorage.getItem('requestCountResetTime') || '0');
      
      // Reset count if it's been more than 10 seconds since last reset
      if (now - requestCountResetTime > 10000) {
        sessionStorage.setItem('homeContentRequestCount', '1');
        sessionStorage.setItem('requestCountResetTime', now.toString());
      } else {
        // Increment count
        const newCount = requestCount + 1;
        sessionStorage.setItem('homeContentRequestCount', newCount.toString());
        
        // If more than 3 requests in 10 seconds, likely in a loop
        if (newCount > 3) {
          console.error('[HomePage] Detected potential infinite loop in content fetching. Breaking cycle.');
          // Reset all potential loop-causing flags
          sessionStorage.setItem('homeContentRequestCount', '0');
          sessionStorage.removeItem('forceFullContentRefresh');
          sessionStorage.removeItem('adminTriggeredUpdate');
          localStorage.removeItem('home_content_force_reload');
          // Force a wait period before allowing more fetches
          const blockUntil = now + 30000; // Block for 30 seconds
          sessionStorage.setItem('contentFetchBlocked', blockUntil.toString());
          
          // Skip refresh and prevent any additional fetches
          options.skipRefresh = true;
          return; // Exit the function early to break the loop
        }
      }
      
      // Check if we're in a blocked period
      const blockUntil = parseInt(sessionStorage.getItem('contentFetchBlocked') || '0');
      if (blockUntil > now) {
        console.log(`[HomePage] Content fetching blocked for ${(blockUntil - now)/1000} more seconds`);
        return;
      }
    }
    
    // Update global cooldown timestamp
    localStorage.setItem('global_home_content_last_update', now.toString());
    
    // Check for direct content from event before making a server request
    if (options.source === 'custom_event' && options.fullContent) {
      console.log('[HomePage] Using direct content from custom event');
      setHomeContent(options.fullContent);
      
      if (options.fullContent.featuredCategories?.length > 0) {
        setActiveCategory('all');
      }
      
      fetchQuestionSets({ forceFresh: true });
      
      if (options.showNotification) {
        toast.success('首页内容已从管理员更新直接加载', { position: 'bottom-center' });
      }
      
      // Dispatch event for Layout.tsx with footer text
      window.dispatchEvent(new CustomEvent('homeContent:updated', {
        detail: { footerText: options.fullContent.footerText }
      }));
      
      // Don't make a server request
        return;
      }
      
    // First check localStorage for admin-saved content
    let localContent: HomeContentData | null = getHomeContentFromLocalStorage('frontend') as HomeContentData | null;
    let useLocalContent = false;
    
    if (localContent) {
      try {
        // Get the raw data to check metadata
        const storedContent = localStorage.getItem('home_content_data');
        if (storedContent) {
          const parsedContent = JSON.parse(storedContent);
          // Check if local content is from admin and newer than our current content
          const currentLastUpdated = (homeContent as any)._lastUpdated || 0;
          const localLastUpdated = parsedContent._lastUpdated || 0;
          
          if (parsedContent._savedByAdmin && localLastUpdated > currentLastUpdated) {
            console.log('[HomePage] Found newer admin-saved content in localStorage');
            useLocalContent = true;
          }
        }
      } catch (e) {
        console.error('[HomePage] Error checking localStorage content metadata:', e);
      }
    }
    
        try {
          pendingFetchRef.current = true;
      console.log(`[HomePage] Fetching latest home content (source: ${options.source || 'unknown'})`);
      
      // Store timestamp of this fetch
      sessionStorage.setItem('lastHomeContentFetch', Date.now().toString());
      
      // If we need to use local content - do that directly
      if (isAdminDirectUpdate && useLocalContent && localContent) {
        console.log('[HomePage] ADMIN UPDATE: Using content from localStorage instead of server');
        
        // Apply the content from localStorage
        setHomeContent(localContent);
        
        // Default to "all" category if featuredCategories are available
        if (localContent.featuredCategories?.length > 0) {
            setActiveCategory('all');
        }
            
        // Refresh question sets to apply new settings
            setTimeout(() => {
          console.log('[HomePage] Refreshing question sets with direct admin settings');
              fetchQuestionSets({ forceFresh: true });
              
          if (options.showNotification) {
            toast.info('首页内容已从本地缓存加载', { position: 'bottom-center' });
          }
          
          // Clear the force reload flag
          if (forceReloadTimestamp) {
            localStorage.removeItem('home_content_force_reload');
          }
          
          // Notify Layout about the update with footer text
          window.dispatchEvent(new CustomEvent('homeContent:updated', {
            detail: { footerText: localContent.footerText }
          }));
        }, 200);
        
        // We're done - don't try to fetch from server
              pendingFetchRef.current = false;
        return;
      }
      
      // Regular server content fetch with cache-busting
      // Create params with cache-busting
      const params: Record<string, any> = { 
        _timestamp: Date.now(),
        _nocache: true
      };
      
      // For admin-triggered updates, add stronger cache-busting
      if (isAdminDirectUpdate) {
        params._forceRefresh = Date.now();
        params._adminUpdate = 'true';
        
        // Avoid multiple parameters that do the same thing
        params._preventCache = params._timestamp; // Use the same timestamp
      }
      
      try {
        // Add timestamp to prevent caching
        const response = await homepageService.getHomeContent(params);
        
        if (response.success && response.data) {
          console.log('[HomePage] Home content loaded successfully from server');
          
          // 处理服务器返回的数据 - 可能是snake_case格式
          let processedData: HomeContentData;
          if ('welcome_title' in response.data) {
            // 数据库格式，需要转换
            processedData = convertDbToFrontend(response.data as HomeContentDataDB);
          } else {
            // 前端格式，直接使用
            processedData = response.data as HomeContentData;
          }
          
          // 如果收到的是空的featuredCategories数组字符串"[]"，确保正确解析
          if (typeof response.data.featured_categories === 'string' && 
              (response.data.featured_categories === '[]' || response.data.featured_categories === '')) {
            processedData.featuredCategories = [];
          }
          
          // Check if server content is actually newer than our local content
          if (localContent) {
            const serverLastUpdated = (response.data as any)._lastUpdated || 0;
            const localLastUpdated = (localContent as any)._lastUpdated || 0;
            
            if (localLastUpdated > serverLastUpdated) {
              console.log('[HomePage] Local content is newer than server content, using local content');
              setHomeContent(localContent);
              
              // Save this to localStorage for Layout.tsx to use
              saveHomeContentToLocalStorage(localContent, false);
            } else {
              // Server content is newer or there is no local content
              console.log('[HomePage] Using server content');
              setHomeContent(processedData);
              
              // Save this to localStorage for Layout.tsx to use
              saveHomeContentToLocalStorage(processedData, false);
            }
          } else {
            // No local content or no timestamp, use server content
            setHomeContent(processedData);
            
            // Save this to localStorage for Layout.tsx to use
            saveHomeContentToLocalStorage(processedData, false);
          }
          
          // If this is an admin update, force the refresh regardless of content change
          if (isAdminDirectUpdate) {
            console.log('[HomePage] Admin update detected - forcing content refresh');
            
            // Default to "all" category when featured categories are available
            if (processedData.featuredCategories && processedData.featuredCategories.length > 0) {
              setActiveCategory('all');
            }
            
            // Refresh question sets to apply new categories
            setTimeout(() => {
              console.log('[HomePage] Refreshing question sets with new admin settings');
              // Only fetch if not in a skip refresh mode to prevent loops
              if (!options.skipRefresh) {
              fetchQuestionSets({ forceFresh: true });
              } else {
                console.log('[HomePage] Skipping question sets refresh as requested by options');
              }
              
              // Show notification if requested
              if (options.showNotification) {
                toast.success('首页内容已从服务器更新', { position: 'bottom-center' });
              }
              
              // Clear the force reload flag after processing
              if (forceReloadTimestamp) {
                localStorage.removeItem('home_content_force_reload');
              }
              // Clear all admin update flags after successful update
              sessionStorage.removeItem('adminTriggeredUpdate');
              sessionStorage.removeItem('forceFullContentRefresh');
              
              // Notify Layout about the update with footer text
              window.dispatchEvent(new CustomEvent('homeContent:updated', {
                detail: { footerText: processedData.footerText }
              }));
            }, 200);
          } else {
            // Regular content changes - check if there's a difference
            const currentContent = JSON.stringify(homeContent);
            const newContent = JSON.stringify(processedData);
            const hasChanged = currentContent !== newContent;
            
            if (hasChanged) {
              console.log('[HomePage] Home content has changed, updating state');
              
              // Default to "all" category when featured categories are available
              if (processedData.featuredCategories && processedData.featuredCategories.length > 0) {
                setActiveCategory('all');
              }
              
              // Refresh question sets to apply new categories
              setTimeout(() => {
                console.log('[HomePage] Refreshing question sets with new category settings');
                // Only fetch if not in a skip refresh mode to prevent loops
                if (!options.skipRefresh) {
                fetchQuestionSets({ forceFresh: true });
                } else {
                  console.log('[HomePage] Skipping question sets refresh as requested by options');
                }
                
                // Show notification if requested
                if (options.showNotification) {
                  toast.success('首页内容已更新', { position: 'bottom-center' });
                }
                
                // Notify Layout about the update with footer text
                window.dispatchEvent(new CustomEvent('homeContent:updated', {
                  detail: { footerText: processedData.footerText }
                }));
              }, 200);
            } else {
              console.log('[HomePage] Home content unchanged, skipping update');
            }
          }
        } else {
          console.error('[HomePage] Failed to get home content from server:', response.message);
          
          // Use localStorage content as fallback if server fails
          if (localContent) {
            console.log('[HomePage] Using localStorage content as fallback');
            setHomeContent(localContent);
            
            if (options.showNotification) {
              toast.warning('服务器连接失败，使用本地缓存的内容', { position: 'bottom-center' });
            }
            
            // Default to "all" category if featuredCategories are available
            if (localContent.featuredCategories?.length > 0) {
              setActiveCategory('all');
            }
            
            // Refresh question sets to apply new settings
            setTimeout(() => {
              // Add check to avoid redundant calls if skipRefresh is set
              if (!options.skipRefresh) {
              fetchQuestionSets({ forceFresh: true });
              } else {
                console.log('[HomePage] Skipping question sets refresh as requested');
              }
              
              // Notify Layout about the update with footer text from fallback content
              window.dispatchEvent(new CustomEvent('homeContent:updated', {
                detail: { footerText: localContent.footerText }
              }));
            }, 200);
          }
          }
        } catch (error) {
        console.error('[HomePage] Error fetching home content:', error);
        
        // Use localStorage content as fallback if server fetch throws an error
        if (localContent) {
          console.log('[HomePage] Server error - using localStorage content as fallback');
          setHomeContent(localContent);
          
          if (options.showNotification) {
            toast.warning('服务器错误，使用本地缓存的内容', { position: 'bottom-center' });
          }
          
          // Default to "all" category if featuredCategories are available
          if (localContent.featuredCategories?.length > 0) {
            setActiveCategory('all');
          }
          
          // Refresh question sets to apply new settings
          setTimeout(() => {
            fetchQuestionSets({ forceFresh: true });
            
            // Notify Layout about the update with footer text from fallback content
            window.dispatchEvent(new CustomEvent('homeContent:updated', {
              detail: { footerText: localContent.footerText }
            }));
          }, 200);
        }
        
        // Clear any admin update flags on error to prevent infinite loops
        sessionStorage.removeItem('adminTriggeredUpdate');
        sessionStorage.removeItem('forceFullContentRefresh');
        localStorage.removeItem('home_content_force_reload');
      } finally {
        // Release lock
          pendingFetchRef.current = false;
        }
    } catch (error) {
      console.error('[HomePage] Error fetching home content:', error);
      
      // Use localStorage content as fallback if server fetch throws an error
      if (localContent) {
        console.log('[HomePage] Server error - using localStorage content as fallback');
        setHomeContent(localContent);
        
        if (options.showNotification) {
          toast.warning('服务器错误，使用本地缓存的内容', { position: 'bottom-center' });
        }
        
        // Default to "all" category if featuredCategories are available
        if (localContent.featuredCategories?.length > 0) {
          setActiveCategory('all');
        }
        
        // Refresh question sets to apply new settings
        setTimeout(() => {
          fetchQuestionSets({ forceFresh: true });
        }, 200);
      }
      
      // Clear any admin update flags on error to prevent infinite loops
      sessionStorage.removeItem('adminTriggeredUpdate');
      sessionStorage.removeItem('forceFullContentRefresh');
      localStorage.removeItem('home_content_force_reload');
      
      // Release lock
      pendingFetchRef.current = false;
    }
  }, [fetchQuestionSets, homeContent, setActiveCategory, toast, canMakeRequest]); // 添加canMakeRequest作为依赖项

  // Replace multiple useEffects with a single consolidated one for initial loading
  useEffect(() => {
    // 添加防止重复加载的检查
    const initialLoadAttempt = parseInt(sessionStorage.getItem('initialLoadAttempt') || '0', 10);
    const now = Date.now();
    
    // 如果10秒内尝试过初始加载，则跳过
    if (initialLoadAttempt && now - initialLoadAttempt < 10000) {
      console.log('[HomePage] 初始加载过于频繁，跳过');
      sessionStorage.setItem('initialLoadAttemptCount', 
        (parseInt(sessionStorage.getItem('initialLoadAttemptCount') || '0', 10) + 1).toString());
      return;
    }
    
    // 记录当前加载尝试时间
    sessionStorage.setItem('initialLoadAttempt', now.toString());
    sessionStorage.setItem('initialLoadAttemptCount', '1');
    
    // Track initial loading to prevent potential loops
    const alreadyLoaded = sessionStorage.getItem('initialHomeContentLoaded');
    if (alreadyLoaded === 'true') {
      console.log('[HomePage] Initial home content already loaded, skipping duplicate load');
      return;
    }
    
    // Initial load of home content - use skipRefresh to prevent cascading updates
    fetchLatestHomeContent({ source: 'initial_load', skipRefresh: true });
    sessionStorage.setItem('initialHomeContentLoaded', 'true');
    
    // Check localStorage for update flags
    const lastUpdate = localStorage.getItem('home_content_updated');
    const lastVisit = localStorage.getItem('home_last_visit');
    
    if (lastUpdate && (!lastVisit || parseInt(lastUpdate) > parseInt(lastVisit))) {
      console.log('[HomePage] Detected home content update flag in localStorage');
      fetchLatestHomeContent({ source: 'local_storage_flag', showNotification: true, skipRefresh: true });
    }
    
    // Update visit timestamp
    localStorage.setItem('home_last_visit', Date.now().toString());
    
    // IMPORTANT: Listen for custom event for home content updates with direct content passing
    const handleCustomContentUpdate = (event: CustomEvent) => {
      // Use throttling to prevent rapid successive events causing loops
      if (!throttleContentFetch('customContentEvent', 3000)) {
        console.log('[HomePage] Throttling custom content event to prevent potential loops');
        return;
      }
      
      // Add stronger protection against rapid successive events
      const now = Date.now();
      const lastEventTime = parseInt(sessionStorage.getItem('lastContentEvent') || '0');
      
      // If another event was handled less than 2 seconds ago, ignore this one
      if (now - lastEventTime < 2000) {
        console.log('[HomePage] Ignoring duplicate/rapid custom event');
        return;
      }
      
      // Record this event time
      sessionStorage.setItem('lastContentEvent', now.toString());
      
      // Check if this was triggered by admin - if so, handle it differently
      const isAdminTriggered = sessionStorage.getItem('adminTriggeredUpdate') === 'true';
      console.log(`[HomePage] Received homeContent:updated custom event${isAdminTriggered ? ' (admin triggered)' : ''}`);
      
      // Extract event details including potential direct content
      const detail = event.detail || {};
      const source = detail.source || 'custom_event';
      const rawFullContent = detail.fullContent;
      
      console.log(`[HomePage] Custom event details: source=${source}, hasFullContent=${!!rawFullContent}`);
      
      // Add skipRefresh parameter to prevent refreshing question sets if we're at risk of looping
      const shouldSkipRefresh = detectLoop('customEventRefresh', 2, 10000) || now - lastEventTime < 5000;
      
      // 如果有内容，确保格式正确
      let fullContent: HomeContentData | undefined = undefined;
      if (rawFullContent) {
        // 检查是否是数据库格式（snake_case）
        if ('welcome_title' in rawFullContent) {
          fullContent = convertDbToFrontend(rawFullContent as HomeContentDataDB);
        } else {
          fullContent = rawFullContent as HomeContentData;
        }
        
        // 如果有完整内容，直接更新状态而不是发起网络请求
        console.log('[HomePage] Directly updating state with event content');
        setHomeContent(fullContent);
        
        // 如果有特色分类，设置活动分类为"all"
        if (fullContent.featuredCategories?.length > 0) {
          setActiveCategory('all');
        }
        
        // 刷新题库列表 - with skipRefresh if needed
        setTimeout(() => {
          fetchQuestionSets({ forceFresh: true });
        }, 200);
        
        return;
      } else if (isAdminTriggered) {
        // If admin triggered but no content, use a longer debounce and clear the trigger indication
        setTimeout(() => {
          console.log('[HomePage] Processing delayed admin-triggered update');
          fetchLatestHomeContent({ 
            source: 'admin_event', 
            showNotification: true,
            skipRefresh: shouldSkipRefresh
          });
          sessionStorage.removeItem('adminTriggeredUpdate');
        }, 2000); // Give time for backend to process changes
      } else {
        // For all other sources, add enhanced debouncing
        const lastFetchTime = parseInt(sessionStorage.getItem('lastHomeContentFetch') || '0');
        if (now - lastFetchTime > 5000) {
          fetchLatestHomeContent({ 
            source: 'custom_event', 
            showNotification: true,
            skipRefresh: shouldSkipRefresh
          });
        } else {
          console.log(`[HomePage] Skipping duplicate content fetch (${now - lastFetchTime}ms since last fetch)`);
        }
      }
    };
    
    // Add event listener with type assertion
    window.addEventListener('homeContent:updated', handleCustomContentUpdate as EventListener);
    
    return () => {
      window.removeEventListener('homeContent:updated', handleCustomContentUpdate as EventListener);
    };
  }, [fetchLatestHomeContent, setHomeContent, fetchQuestionSets, setActiveCategory]);

  // Replace the old socket event handler with a proper implementation
  useEffect(() => {
    if (!socket) return;
    
    console.log('[HomePage] Setting up Socket listener for admin content updates');
    
    const handleAdminHomeContentUpdated = (data: any) => {
      console.log('[HomePage] Received admin home content update event:', data);
      
      // 检查数据格式并标准化
      let contentData: any = data.content || data;
      let contentType = data.type || 'general';
      let action = data.action || 'updated';
      
      // 检查是否有category字段，可能在snake_case或camelCase格式
      const category = data.category || contentData.category || '';
      const oldCategory = data.oldCategory || contentData.old_category || '';
      
      // 处理title字段
      const title = data.title || 
                   contentData.title || 
                   contentData.welcomeTitle || 
                   contentData.welcome_title || '';
      
      // Set notification message based on update type
      let message = '首页内容已更新';
      if (contentType === 'featuredCategories' || contentType === 'featured_categories') {
        if (action === 'added') {
          message = `新增分类: ${category}`;
        } else if (action === 'deleted' || action === 'removed') {
          message = `删除分类: ${category}`;
        } else if (action === 'updated') {
          message = `分类更新: ${oldCategory} → ${category}`;
        }
      } else if (contentType === 'featuredQuestionSet' || contentType === 'featured_question_set') {
        message = `题库 "${title}" 已更新`;
      }
      
      setNotificationMessage(message);
      setShowUpdateNotification(true);
      
      // Clear previous timeout
      if (notificationTimeoutRef.current) {
        clearTimeout(notificationTimeoutRef.current);
      }
      
      // Auto-close after 5 seconds
      notificationTimeoutRef.current = setTimeout(() => {
        setShowUpdateNotification(false);
      }, 5000);
      
      // Check if this is a duplicate event (using timestamp comparison)
      const lastEventTime = parseInt(sessionStorage.getItem('lastAdminContentEvent') || '0', 10);
      const now = Date.now();
      const isTooFrequent = now - lastEventTime < 2000;
      
      if (isTooFrequent) {
        console.log('[HomePage] Ignoring duplicate admin content event (too frequent)');
        return;
      }
      
      // Record this event time
      sessionStorage.setItem('lastAdminContentEvent', now.toString());
      
      // 如果事件包含完整内容数据，尝试直接使用
      if (contentData && (contentData.welcomeTitle || contentData.welcome_title)) {
        let processedContent: HomeContentData;
        
        // 检查是否是数据库格式
        if ('welcome_title' in contentData) {
          processedContent = convertDbToFrontend(contentData as HomeContentDataDB);
        } else {
          processedContent = contentData as HomeContentData;
        }
        
        // Save to localStorage for Layout component to use
        saveHomeContentToLocalStorage(processedContent, false);
        
        // 直接使用内容更新状态，避免触发额外的fetch请求
        console.log('[HomePage] Direct state update with content from socket event');
        setHomeContent(processedContent);
        
        // 如果有特色分类，设置活动分类为"all"
        if (processedContent.featuredCategories?.length > 0) {
          setActiveCategory('all');
        }
        
        // 在内容更新后刷新题库列表，使用延迟确保状态已更新
        setTimeout(() => {
          fetchQuestionSets({ forceFresh: true });
          
          // Notify Layout directly about the update with footer text
          window.dispatchEvent(new CustomEvent('homeContent:updated', {
            detail: { footerText: processedContent.footerText }
          }));
        }, 200);
      } else {
        // 使用更强的防抖动机制避免过多请求
        const lastFetchTimestamp = parseInt(sessionStorage.getItem('lastHomeContentFetch') || '0');
        const timeSinceLastFetch = now - lastFetchTimestamp;
        
        // 只有在上次请求超过5秒后或明确要求时才获取新内容
        if (timeSinceLastFetch > 5000 || data.force === true) {
          // 使用延迟避免并发请求
          setTimeout(() => {
            fetchLatestHomeContent({ 
              source: 'socket_event', 
              showNotification: true
            });
          }, 1000);
        } else {
          console.log(`[HomePage] Skipping content fetch - too recent (${timeSinceLastFetch}ms ago)`);
        }
      }
    };
    
    // Listen for admin content updates
    socket.on('admin:homeContent:updated', handleAdminHomeContentUpdated);
    
    return () => {
      socket.off('admin:homeContent:updated', handleAdminHomeContentUpdated);
      
      // Clear timeout on cleanup
      if (notificationTimeoutRef.current) {
        clearTimeout(notificationTimeoutRef.current);
      }
    };
  }, [socket, fetchLatestHomeContent, fetchQuestionSets, setActiveCategory]);

  // Make sure setupRenderEffects is actually used and has the right dependencies
  useEffect(() => {
    if (questionSets.length > 0 && homeContent.featuredCategories?.length > 0) {
      console.log(`[HomePage] Detected ${homeContent.featuredCategories.length} featured categories:`, homeContent.featuredCategories);
      setupRenderEffects();
    }
  }, [homeContent.featuredCategories, setupRenderEffects, questionSets.length]);

  // Check for admin content updates specifically
  useEffect(() => {
    // Check for force reload flag set by admin content updates
    const checkForAdminUpdates = () => {
      const forceReload = localStorage.getItem('home_content_force_reload');
      const adminTriggered = sessionStorage.getItem('adminTriggeredUpdate') === 'true';
      const forceContentRefresh = sessionStorage.getItem('forceFullContentRefresh') === 'true';
      
      if (forceReload || adminTriggered || forceContentRefresh) {
        console.log('[HomePage] Detected admin force reload flag, fetching latest content');
        
        // 首先尝试从本地存储获取内容
        const localContent = getHomeContentFromLocalStorage('frontend') as HomeContentData | null;
        
        // 如果存在本地内容，立即使用，然后再发起服务器请求
        if (localContent) {
          // 立即应用本地内容
          setHomeContent(localContent);
          
          // 如果有特色分类，设置活动分类为"all"
          if (localContent.featuredCategories?.length > 0) {
            setActiveCategory('all');
          }
          
          // 显示通知
          toast.info('已从本地缓存加载最新内容', { position: 'bottom-center' });
        }
        
        // 无论是否有本地内容，都发起网络请求确保内容最新
        fetchLatestHomeContent({
          source: 'admin_direct',
          showNotification: true
        });
        
        // 清除标记
        if (forceReload) {
          localStorage.removeItem('home_content_force_reload');
        }
        if (adminTriggered) {
          sessionStorage.removeItem('adminTriggeredUpdate');
        }
        if (forceContentRefresh) {
          sessionStorage.removeItem('forceFullContentRefresh');
        }
      }
    };
    
    // Check immediately on component mount
    checkForAdminUpdates();
    
    // Set up interval to periodically check for admin updates (much less frequently than our normal check)
    const intervalId = setInterval(checkForAdminUpdates, 5000);
    
    return () => {
      clearInterval(intervalId);
    };
  }, [fetchLatestHomeContent, setActiveCategory]);

  // 添加一个专门用于刷新问题数量的函数
  const refreshQuestionCounts = useCallback(async (forceAll = false) => {
    console.log(`[HomePage] Refreshing question counts for all question sets... Force All: ${forceAll}`);
    
    if (questionSets.length === 0) {
      console.log('[HomePage] No question sets to refresh counts for');
      toast.info('没有可刷新的题库');
      return;
    }
    
    // 显示加载中通知
    const toastId = toast.info('正在刷新题目数量...', { 
      autoClose: false,
      closeButton: false,
      closeOnClick: false
    });
    
    try {
      // 创建一个新的题库集合的副本
      const updatedSets = [...questionSets];
      let updatedCount = 0;
      
      // 为每个题库获取最新的问题数量
      for (let i = 0; i < updatedSets.length; i++) {
        const set = updatedSets[i];
        
        // 如果不是强制刷新，则跳过已有有效数量的题库
        if (!forceAll && typeof set.questionCount === 'number' && set.questionCount > 0) {
          continue; // 跳过已有有效数量的题库
        }
        
        try {
          // 从API获取最新数量
          const countResponse = await fetch(`/api/questions/count/${set.id}`);
          
          if (countResponse.ok) {
            const countData = await countResponse.json();
            const count = countData.count || (countData.data && countData.data.count) || 0;
            
            if (count > 0) {
              console.log(`[HomePage] Updated count for "${set.title}": ${count}`);
              updatedSets[i] = { ...set, questionCount: count };
              updatedCount++;
            } else {
              // 尝试从questions数组计算
              const questionsCount = Array.isArray(set.questions) ? set.questions.length : 0;
              const questionSetQuestionsCount = Array.isArray(set.questionSetQuestions) ? set.questionSetQuestions.length : 0;
              
              if (questionsCount > 0 || questionSetQuestionsCount > 0) {
                const embeddedCount = Math.max(questionsCount, questionSetQuestionsCount);
                console.log(`[HomePage] Using embedded count for "${set.title}": ${embeddedCount}`);
                updatedSets[i] = { ...set, questionCount: embeddedCount };
                updatedCount++;
              }
            }
          }
        } catch (e) {
          console.error(`[HomePage] Error refreshing count for ${set.title}:`, e);
        }
      }
      
      if (updatedCount > 0) {
        console.log(`[HomePage] Updated question counts for ${updatedCount} question sets`);
        setQuestionSets(updatedSets);
        toast.update(toastId, { 
          render: `成功更新${updatedCount}个题库的题目数量`, 
          type: toast.TYPE.SUCCESS,
          autoClose: 3000,
          closeButton: true,
          closeOnClick: true
        });
      } else {
        console.log('[HomePage] No question counts needed to be updated');
        toast.update(toastId, { 
          render: '所有题库数量已是最新', 
          type: toast.TYPE.INFO,
          autoClose: 2000,
          closeButton: true,
          closeOnClick: true
        });
      }
    } catch (error) {
      console.error('[HomePage] Error refreshing question counts:', error);
      toast.update(toastId, { 
        render: '刷新题目数量失败', 
        type: toast.TYPE.ERROR,
        autoClose: 3000,
        closeButton: true,
        closeOnClick: true
      });
    }
  }, [questionSets]);

  // 在组件挂载和题库列表更新后刷新问题数量
  useEffect(() => {
    if (questionSets.length > 0) {
      const hasZeroCounts = questionSets.some(set => 
        (typeof set.questionCount !== 'number' || set.questionCount === 0) && 
        (!Array.isArray(set.questions) || set.questions.length === 0)
      );
      
      if (hasZeroCounts) {
        console.log('[HomePage] Detected question sets with zero counts, refreshing...');
        // 设置一个短暂的延迟，避免与其他API请求冲突
        const timeoutId = setTimeout(() => {
          refreshQuestionCounts();
        }, 1000);
        
        return () => clearTimeout(timeoutId);
      }
    }
  }, [questionSets.length, refreshQuestionCounts]);

  // 添加监听问题数量更新事件，用于实时更新题库卡片显示的问题数量
  useEffect(() => {
    const handleQuestionCountUpdate = (event: Event) => {
      const customEvent = event as CustomEvent;
      if (customEvent.detail && customEvent.detail.questionSetId && customEvent.detail.count !== undefined) {
        const { questionSetId, count } = customEvent.detail;
        
        console.log(`[HomePage] Received count update for question set ${questionSetId}: ${count}`);
        
        // 使用不可变方式更新questionSets状态，仅更新问题数量
        setQuestionSets(prevSets => 
          prevSets.map(set => 
            set.id === questionSetId 
              ? { ...set, questionCount: count } 
              : set
          )
        );
      }
    };
    
    // 注册事件
    window.addEventListener('questionSet:countUpdate', handleQuestionCountUpdate);
    
    // 清理事件
    return () => {
      window.removeEventListener('questionSet:countUpdate', handleQuestionCountUpdate);
    };
  }, []);

  // 确保所有推荐题库都有正确的问题数量信息
  useEffect(() => {
    if (recommendedSets.length > 0) {
      // 检查是否有推荐题库缺少问题数量信息
      const setsWithoutCount = recommendedSets.filter(
        set => typeof set.questionCount !== 'number' || set.questionCount === 0
      );
      
      if (setsWithoutCount.length > 0) {
        console.log(`[HomePage] Found ${setsWithoutCount.length} recommended sets without question count, requesting updates...`);
        
        // 批量请求问题数量
        setsWithoutCount.forEach(set => {
          apiClient.get(`/api/questions/count/${set.id}`)
            .then(response => {
              if (response && response.success && response.count !== undefined) {
                // 触发更新事件
                window.dispatchEvent(new CustomEvent('questionSet:countUpdate', {
                  detail: {
                    questionSetId: set.id,
                    count: response.count
                  }
                }));
              }
            })
            .catch(error => {
              console.error(`[HomePage] Error fetching question count for ${set.title}:`, error);
            });
        });
      }
    }
  }, [recommendedSets]);

  // 修复加载状态检查
  if (loading) {
    return (
      <div className="flex items-center justify-center pt-32 pb-20">
        <div className="text-xl">正在加载...</div>
      </div>
    );
  }

  // 在页面内容的顶部添加一个条件渲染的通知栏
  return (
    <div className={bgClass}>
      {/* 添加自定义样式 */}
      <style dangerouslySetInnerHTML={{ __html: customStyles }} />
      
      {/* 更新通知 */}
      {showUpdateNotification && (
        <div className="fixed top-16 right-4 z-50 glass-effect rounded-lg shadow-lg p-4 max-w-md border-l-4 border-blue-500 animate-fadeIn">
          <div className="flex items-start">
            <div className="flex-shrink-0 text-blue-500">
              <svg className="w-5 h-5" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20" fill="currentColor">
                <path fillRule="evenodd" d="M18 10a8 8 0 11-16 0 8 8 0 0116 0zm-7-4a1 1 0 11-2 0 1 1 0 012 0zM9 9a1 1 0 000 2v3a1 1 0 001 1h1a1 1 0 100-2v-3a1 1 0 00-1-1H9z" clipRule="evenodd" />
          </svg>
            </div>
            <div className="ml-3">
              <p className="text-sm font-medium text-gray-900 dark:text-white">{notificationMessage}</p>
            </div>
          <button 
              className="ml-auto -mx-1.5 -my-1.5 bg-white dark:bg-gray-800 text-gray-400 hover:text-gray-500 rounded-lg p-1.5"
            onClick={() => setShowUpdateNotification(false)} 
          >
              <svg className="w-4 h-4" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20" fill="currentColor">
                <path fillRule="evenodd" d="M4.293 4.293a1 1 0 011.414 0L10 8.586l4.293-4.293a1 1 0 111.414 1.414L11.414 10l4.293 4.293a1 1 0 01-1.414 1.414L10 11.414l-4.293 4.293a1 1 0 01-1.414-1.414L8.586 10 4.293 5.707a1 1 0 010-1.414z" clipRule="evenodd" />
            </svg>
          </button>
          </div>
        </div>
      )}

      {/* 公告栏 - 美化公告栏UI */}
      {homeContent.announcements && (
        <div className="bg-gradient-to-r from-blue-50 to-indigo-50 dark:from-gray-800 dark:to-gray-900 border-b border-blue-100 dark:border-gray-700 shadow-sm">
          <div className="container mx-auto px-4 py-3">
            <div className="flex overflow-x-auto hide-scrollbar">
              <div className="flex-shrink-0 px-4 py-2 bg-white dark:bg-gray-800 rounded-lg shadow-sm border border-blue-100 dark:border-gray-700">
                <div className="flex items-center">
                  <div className="flex-shrink-0 h-8 w-8 rounded-full bg-blue-100 dark:bg-blue-900 flex items-center justify-center">
                    <svg className="h-5 w-5 text-blue-600 dark:text-blue-300" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11 5.882V19.24a1.76 1.76 0 01-3.417.592l-2.147-6.15M18 13a3 3 0 100-6M5.436 13.683A4.001 4.001 0 017 6h1.832c4.1 0 7.625-1.234 9.168-3v14c-1.543-1.766-5.067-3-9.168-3H7a3.988 3.988 0 01-1.564-.317z" />
            </svg>
        </div>
                  <div className="ml-3">
                    <p className="text-sm font-medium text-gray-900 dark:text-white">{homeContent.announcements}</p>
        </div>
            </div>
                </div>
            </div>
          </div>
        </div>
      )}

      {/* 首页主内容 */}
      <div className="container mx-auto px-4 py-6">
        {/* 自适应英雄区域 */}
        <div className="bg-gradient-to-br from-slate-900 to-indigo-900 rounded-2xl p-6 mb-8 relative overflow-hidden shadow-xl">
          {/* High-tech decorative elements */}
          <div className="absolute inset-0 opacity-20">
            <div className="absolute top-0 right-0 w-full h-full bg-grid-white/[0.2] bg-[length:30px_30px] transform -skew-y-12"></div>
          </div>
          
          {/* Circuit patterns */}
          <div className="absolute top-0 left-0 w-full h-full opacity-10">
            <svg className="absolute left-0 top-0 h-full w-full" viewBox="0 0 100 100" preserveAspectRatio="none">
              <path d="M0,0 L100,0 L100,100 L0,100 Z" fill="none" stroke="white" strokeWidth="0.5"></path>
              <path d="M0,50 L100,50" stroke="white" strokeWidth="0.5"></path>
              <path d="M50,0 L50,100" stroke="white" strokeWidth="0.5"></path>
              <circle cx="50" cy="50" r="40" fill="none" stroke="white" strokeWidth="0.5"></circle>
              <circle cx="50" cy="50" r="20" fill="none" stroke="white" strokeWidth="0.5"></circle>
              <path d="M0,0 L100,100" stroke="white" strokeWidth="0.5"></path>
              <path d="M0,100 L100,0" stroke="white" strokeWidth="0.5"></path>
            </svg>
          </div>

          {/* Floating particles */}
          <div className="absolute h-full w-full">
            <div className="absolute h-2 w-2 rounded-full bg-blue-400 animate-ping" style={{top: '20%', left: '10%', animationDuration: '3s'}}></div>
            <div className="absolute h-2 w-2 rounded-full bg-indigo-400 animate-ping" style={{top: '70%', left: '20%', animationDuration: '4s'}}></div>
            <div className="absolute h-2 w-2 rounded-full bg-cyan-400 animate-ping" style={{top: '30%', left: '80%', animationDuration: '5s'}}></div>
            <div className="absolute h-3 w-3 rounded-full bg-purple-400 animate-ping" style={{top: '60%', left: '75%', animationDuration: '7s'}}></div>
            <div className="absolute h-3 w-3 rounded-full bg-blue-400 animate-ping" style={{top: '40%', left: '30%', animationDuration: '6s'}}></div>
          </div>

          {/* Glowing orbs */}
          <div className="absolute -right-10 -top-10 w-40 h-40 bg-blue-500 opacity-20 rounded-full blur-xl animate-pulse"></div>
          <div className="absolute -left-10 -bottom-10 w-40 h-40 bg-purple-500 opacity-20 rounded-full blur-xl animate-pulse" style={{animationDelay: '1s'}}></div>
          <div className="absolute right-1/3 bottom-0 w-24 h-24 bg-cyan-500 opacity-15 rounded-full blur-lg animate-pulse" style={{animationDelay: '0.5s'}}></div>

          {/* Digital scan line effect */}
          <div className="absolute inset-0 bg-gradient-to-b from-transparent via-blue-900/10 to-transparent h-[200%] animate-scan"></div>
          
          {/* Content with tech-themed graphic */}
          <div className="relative z-10 flex flex-col md:flex-row items-center">
            <div className="w-full md:w-3/5 text-center md:text-left mb-8 md:mb-0">
              <h1 className="text-2xl md:text-3xl font-bold text-white mb-4 tracking-wider">
                {homeContent.welcomeTitle || "欢迎来到在线考试中心"}
              </h1>
              <p className="text-blue-100 text-sm md:text-base mb-6">
                {homeContent.welcomeDescription || "选择下面的题库开始练习，提升你的专业技能"}
              </p>
              <div className="flex flex-wrap justify-center md:justify-start">
                <Link
                  to="/question-sets" 
                  className="relative overflow-hidden bg-white text-blue-600 font-medium px-5 py-2 rounded-lg shadow-md hover:bg-blue-50 transition-all mr-3 mb-2 text-sm group"
                >
                  <span className="relative z-10">浏览题库</span>
                  <div className="absolute inset-0 bg-gradient-to-r from-blue-400/20 via-transparent to-blue-400/20 translate-x-[-100%] group-hover:animate-shimmer"></div>
                </Link>
                <Link
                  to="/profile" 
                  className="relative overflow-hidden bg-blue-700 bg-opacity-30 text-white font-medium px-5 py-2 rounded-lg border border-blue-400 border-opacity-40 hover:bg-opacity-40 transition-all mb-2 text-sm group"
                >
                  <span className="relative z-10">个人中心</span>
                  <div className="absolute inset-0 bg-gradient-to-r from-white/5 via-white/10 to-white/5 translate-x-[-100%] group-hover:animate-shimmer"></div>
                </Link>
              </div>
            </div>
            
            {/* Decorative tech illustration */}
            <div className="w-full md:w-2/5 flex justify-center items-center">
              {showCountdownWidget ? (
                <ExamCountdownWidget />
              ) : (
                <div className="relative w-64 h-64">
                  <div className="absolute inset-0 bg-gradient-to-br from-blue-500 to-indigo-600 rounded-full opacity-20 animate-pulse"></div>
                  <div className="absolute inset-4 border-4 border-blue-400/30 border-dashed rounded-full animate-spin-slow"></div>
                  <div className="absolute inset-8 border-2 border-indigo-400/40 rounded-full"></div>
                  <div className="absolute inset-0 flex items-center justify-center">
                    <svg className="w-32 h-32 text-blue-100/80" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
                      <path d="M12 4.75V6.25" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"></path>
                      <path d="M17.127 6.873L16.073 7.927" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"></path>
                      <path d="M19.25 12L17.75 12" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"></path>
                      <path d="M17.127 17.127L16.073 16.073" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"></path>
                      <path d="M12 19.25V17.75" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"></path>
                      <path d="M7.927 16.073L6.873 17.127" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"></path>
                      <path d="M6.25 12L4.75 12" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"></path>
                      <path d="M7.927 7.927L6.873 6.873" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"></path>
                      <path d="M12 14.25C13.2426 14.25 14.25 13.2426 14.25 12C14.25 10.7574 13.2426 9.75 12 9.75C10.7574 9.75 9.75 10.7574 9.75 12C9.75 13.2426 10.7574 14.25 12 14.25Z" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"></path>
                    </svg>
                  </div>
                  <div className="absolute inset-0 bg-gradient-to-br from-transparent to-blue-900/30 rounded-full animate-pulse" style={{animationDelay: '1s'}}></div>
                </div>
              )}
            </div>
          </div>
        </div>
        
        {/* 推荐题库 */}
        {recommendedSets.length > 0 && (
          <div className="mb-12">
            <h2 className="text-xl font-bold mb-4 text-gray-800 dark:text-white flex items-center">
              <svg className="w-5 h-5 mr-2 text-yellow-500" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20" fill="currentColor">
                <path d="M9.049 2.927c.3-.921 1.603-.921 1.902 0l1.07 3.292a1 1 0 00.95.69h3.462c.969 0 1.371 1.24.588 1.81l-2.8 2.034a1 1 0 00-.364 1.118l1.07 3.292c.3.921-.755 1.688-1.54 1.118l-2.8-2.034a1 1 0 00-1.175 0l-2.8 2.034c-.784.57-1.838-.197-1.539-1.118l1.07-3.292a1 1 0 00-.364-1.118L2.98 8.72c-.783-.57-.38-1.81.588-1.81h3.461a1 1 0 00.951-.69l1.07-3.292z" />
                        </svg>
              推荐题库
            </h2>
            
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
              {recommendedSets.map(set => (
                <BaseCard key={set.id} set={set} onStartQuiz={() => handleStartQuiz(set)} />
              ))}
              </div>
            </div>
        )}
        
        {/* 题库分类和搜索 */}
        <div id="question-sets" className="mb-6">
          <div className="flex items-center justify-between flex-wrap gap-3 mb-6">
            <h2 className="text-xl font-bold text-gray-800 dark:text-white flex items-center">
              <svg className="w-5 h-5 mr-2 text-blue-500" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20" fill="currentColor">
                <path d="M7 3a1 1 0 000 2h6a1 1 0 100-2H7zM4 7a1 1 0 011-1h10a1 1 0 110 2H5a1 1 0 01-1-1zM2 11a2 2 0 012-2h12a2 2 0 012 2v4a2 2 0 01-2 2H4a2 2 0 01-2-2v-4z" />
          </svg>
              题库列表
            </h2>
            
            {/* 搜索框 */}
            <div className="relative">
              <input 
                type="text" 
                placeholder="搜索题库..." 
                value={searchTerm}
                onChange={e => setSearchTerm(e.target.value)}
                className="pl-10 pr-4 py-2 rounded-lg border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-800 text-gray-700 dark:text-gray-200 focus:outline-none focus:ring-2 focus:ring-blue-500 w-full md:w-64"
              />
              <svg className="w-5 h-5 text-gray-400 absolute left-3 top-1/2 transform -translate-y-1/2" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
              </svg>
                </div>
              </div>

          {/* 分类选择器 */}
          <div className="flex flex-wrap gap-2 mb-6 overflow-x-auto pb-2 sticky -top-1 z-10 bg-white/95 dark:bg-gray-900/95 backdrop-blur-sm pt-2 shadow-sm">
          <button 
            onClick={() => handleCategoryChange('all')}
            className={`px-3 py-1.5 rounded-lg text-sm font-medium transition-all duration-300 ${
              activeCategory === 'all' 
                  ? 'bg-gradient-to-r from-blue-600 to-indigo-600 text-white shadow-md transform -translate-y-0.5' 
                  : 'bg-white/80 dark:bg-gray-700/80 text-gray-700 dark:text-gray-200 hover:bg-gray-100 dark:hover:bg-gray-600 border border-gray-200 dark:border-gray-600'
            }`}
          >
              <div className="flex items-center">
                <svg className={`w-3.5 h-3.5 ${activeCategory === 'all' ? 'text-white' : 'text-blue-500 dark:text-blue-400'} mr-1`} xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 6h16M4 12h16M4 18h16" />
                </svg>
                全部
              </div>
          </button>
            
          {/* Add a fallback for missing featuredCategories */}
          {(homeContent.featuredCategories || []).length === 0 && 
            // Use the categories from question sets if featuredCategories is empty
            [...new Set(questionSets.map(set => set.category))]
              .filter(cat => !!cat)  // Filter out empty categories
              .map(category => (
            <button 
              key={category}
              onClick={() => handleCategoryChange(category)}
                  className={`px-3 py-1.5 rounded-lg text-sm font-medium transition-all duration-300 ${
                activeCategory === category 
                    ? 'bg-gradient-to-r from-blue-600 to-indigo-600 text-white shadow-md transform -translate-y-0.5' 
                    : 'bg-white/80 dark:bg-gray-700/80 text-gray-700 dark:text-gray-200 hover:bg-gray-100 dark:hover:bg-gray-600 border border-gray-200 dark:border-gray-600'
              }`}
            >
                <div className="flex items-center">
                  <svg className={`w-3.5 h-3.5 ${activeCategory === category ? 'text-white' : 'text-indigo-500 dark:text-indigo-400'} mr-1`} xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M7 7h.01M7 3h5c.512 0 1.024.195 1.414.586l7 7a2 2 0 010 2.828l-7 7a2 2 0 01-2.828 0l-7-7A1.994 1.994 0 013 12V7a4 4 0 014-4z" />
                  </svg>
              {category}
                </div>
            </button>
              ))
          }
          
          {/* Use featuredCategories if available */}
          {(homeContent.featuredCategories || []).map(category => (
            <button 
              key={category}
              onClick={() => handleCategoryChange(category)}
              className={`px-3 py-1.5 rounded-lg text-sm font-medium transition-all duration-300 ${
                activeCategory === category 
                    ? 'bg-gradient-to-r from-blue-600 to-indigo-600 text-white shadow-md transform -translate-y-0.5' 
                    : 'bg-white/80 dark:bg-gray-700/80 text-gray-700 dark:text-gray-200 hover:bg-gray-100 dark:hover:bg-gray-600 border border-gray-200 dark:border-gray-600'
              }`}
            >
                <div className="flex items-center">
                  <svg className={`w-3.5 h-3.5 ${activeCategory === category ? 'text-white' : 'text-indigo-500 dark:text-indigo-400'} mr-1`} xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M7 7h.01M7 3h5c.512 0 1.024.195 1.414.586l7 7a2 2 0 010 2.828l-7 7a2 2 0 01-2.828 0l-7-7A1.994 1.994 0 013 12V7a4 4 0 014-4z" />
                </svg>
              {category}
              </div>
            </button>
          ))}
            
            {/* 添加刷新题目数量按钮 */}
            <button
              onClick={(e) => {
                e.preventDefault();
                refreshQuestionCounts(true);
              }}
              className="ml-auto px-3 py-1.5 rounded-lg text-xs font-medium transition-all duration-300 bg-white/80 dark:bg-gray-700/80 text-gray-700 dark:text-gray-200 hover:bg-gray-100 dark:hover:bg-gray-600 border border-gray-200 dark:border-gray-600 flex items-center"
              title="刷新题目数量"
            >
              <svg className="w-3.5 h-3.5 text-blue-500 dark:text-blue-400 mr-1" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
                </svg>
              刷新题目数量
            </button>
                </div>

        {/* 题库分类展示区域 */}
        <div id="question-sets-section" className="pt-6">
          {/* 分类展示题库 */}
          {(() => {
            const categorized = getCategorizedQuestionSets();
            const sections = [];
            
            // 我的题库（已购买/兑换的题库）
            if (categorized.purchased.length > 0) {
              sections.push(
                <div key="purchased" className="mb-12">
                  <div className="flex items-center mb-6">
                    <div className="relative">
                      <div className="w-8 h-8 rounded-full bg-gradient-to-r from-green-600 to-emerald-600 flex items-center justify-center shadow-lg mr-3 z-10">
                      <svg className="h-4 w-4 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m5.618-4.016A11.955 11.955 0 0112 2.944a11.955 11.955 0 01-8.618 3.04A12.02 12.02 0 003 9c0 5.591 3.824 10.29 9 11.622 5.176-1.332 9-6.03 9-11.622 0-1.042-.133-2.052-.382-3.016z" />
                      </svg>
                    </div>
                      <div className="absolute top-0 left-0 w-8 h-8 rounded-full bg-green-400 blur-md opacity-50 animate-pulse"></div>
                    </div>
                    <h2 className="text-xl font-bold text-gray-800 dark:text-white">我的题库</h2>
                    <div className="flex items-center ml-3">
                      <span className="px-2 py-0.5 text-xs font-semibold bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-300 rounded-full">
                      {categorized.purchased.length}个已购买/兑换
                    </span>
                      <div className="ml-3 h-px w-12 bg-gradient-to-r from-green-600 to-transparent"></div>
                  </div>
                  </div>
                  <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 gap-4">
                    {categorized.purchased.map((set: PreparedQuestionSet, index) => (
                      <div 
                        key={set.id} 
                        className="animate-fadeIn" 
                        style={{ animationDelay: `${index * 100}ms` }}
                      >
                      <BaseCard
                        key={set.id}
                        set={set}
                        onStartQuiz={handleStartQuiz}
                      />
                      </div>
                    ))}
                  </div>
                </div>
              );
            }
            
            // 免费题库
            if (categorized.free.length > 0) {
              sections.push(
                <div key="free" className="mb-12">
                  <div className="flex items-center mb-6">
                    <div className="relative">
                      <div className="w-8 h-8 rounded-full bg-gradient-to-r from-blue-600 to-cyan-600 flex items-center justify-center shadow-lg mr-3 z-10">
                      <svg className="h-4 w-4 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M7 11.5V14m0-2.5v-6a1.5 1.5 0 113 0m-3 6a1.5 1.5 0 00-3 0v2a7.5 7.5 0 0015 0v-5a1.5 1.5 0 00-3 0m-6-3V11m0-5.5v-1a1.5 1.5 0 013 0v1m0 0V11m0-5.5a1.5 1.5 0 013 0v3m0 0V11" />
                      </svg>
                    </div>
                      <div className="absolute top-0 left-0 w-8 h-8 rounded-full bg-blue-400 blur-md opacity-50 animate-pulse"></div>
                    </div>
                    <h2 className="text-xl font-bold text-gray-800 dark:text-white">免费题库</h2>
                    <div className="flex items-center ml-3">
                      <span className="px-2 py-0.5 text-xs font-semibold bg-blue-100 text-blue-800 dark:bg-blue-900 dark:text-blue-300 rounded-full">
                      {categorized.free.length}个免费题库
                    </span>
                      <div className="ml-3 h-px w-12 bg-gradient-to-r from-blue-600 to-transparent"></div>
                  </div>
                  </div>
                  <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 gap-4">
                    {categorized.free.map((set: PreparedQuestionSet, index) => (
                      <div 
                        key={set.id} 
                        className="animate-fadeIn" 
                        style={{ animationDelay: `${index * 100}ms` }}
                      >
                      <BaseCard
                        key={set.id}
                        set={set}
                        onStartQuiz={handleStartQuiz}
                      />
                      </div>
                    ))}
                  </div>
                </div>
              );
            }
            
            // 付费题库
            if (categorized.paid.length > 0) {
              sections.push(
                <div key="paid" className="mb-12">
                  <div className="flex items-center mb-6">
                    <div className="relative">
                      <div className="w-8 h-8 rounded-full bg-gradient-to-r from-purple-600 to-pink-600 flex items-center justify-center shadow-lg mr-3 z-10">
                      <svg className="h-4 w-4 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8c-1.657 0-3 .895-3 2s1.343 2 3 2 3 .895 3 2-1.343 2-3 2m0-8c1.11 0 2.08.402 2.599 1M12 8V7m0 1v8m0 0v1m0-1c-1.11 0-2.08-.402-2.599-1M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                      </svg>
                    </div>
                      <div className="absolute top-0 left-0 w-8 h-8 rounded-full bg-purple-400 blur-md opacity-50 animate-pulse"></div>
                    </div>
                    <h2 className="text-xl font-bold text-gray-800 dark:text-white">付费题库</h2>
                    <div className="flex items-center ml-3">
                      <span className="px-2 py-0.5 text-xs font-semibold bg-yellow-100 text-yellow-800 dark:bg-yellow-900 dark:text-yellow-300 rounded-full">
                      {categorized.paid.length}个待购买
                    </span>
                      <div className="ml-3 h-px w-12 bg-gradient-to-r from-purple-600 to-transparent"></div>
                  </div>
                  </div>
                  <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 gap-4">
                    {categorized.paid.map((set: PreparedQuestionSet, index) => (
                      <div 
                        key={set.id} 
                        className="animate-fadeIn" 
                        style={{ animationDelay: `${index * 100}ms` }}
                      >
                      <BaseCard
                        key={set.id}
                        set={set}
                        onStartQuiz={handleStartQuiz}
                      />
                      </div>
                    ))}
                  </div>
                </div>
              );
            }
            
            // 已过期题库
            if (categorized.expired.length > 0) {
              sections.push(
                <div key="expired" className="mb-12">
                  <div className="flex items-center mb-6">
                    <div className="relative">
                      <div className="w-8 h-8 rounded-full bg-gradient-to-r from-red-600 to-rose-600 flex items-center justify-center shadow-lg mr-3 z-10">
                      <svg className="h-4 w-4 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
                      </svg>
                    </div>
                      <div className="absolute top-0 left-0 w-8 h-8 rounded-full bg-red-400 blur-md opacity-50 animate-pulse"></div>
                    </div>
                    <h2 className="text-xl font-bold text-gray-800 dark:text-white">已过期题库</h2>
                    <div className="flex items-center ml-3">
                      <span className="px-2 py-0.5 text-xs font-semibold bg-red-100 text-red-800 dark:bg-red-900 dark:text-red-300 rounded-full">
                      {categorized.expired.length}个已过期
                    </span>
                      <div className="ml-3 h-px w-12 bg-gradient-to-r from-red-600 to-transparent"></div>
                    </div>
                    <button 
                      onClick={() => {
                        const refreshEvent = new CustomEvent('questionSets:refresh');
                        window.dispatchEvent(refreshEvent);
                      }}
                      className="ml-auto px-2.5 py-1 text-xs bg-gray-100 hover:bg-gray-200 dark:bg-gray-700 dark:hover:bg-gray-600 text-gray-700 dark:text-gray-200 rounded-lg flex items-center transition-all duration-300 shadow-sm hover:shadow"
                    >
                      <svg className="h-3.5 w-3.5 mr-1" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
                      </svg>
                      更新状态
                    </button>
                  </div>
                  <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 gap-4">
                    {categorized.expired.map((set: PreparedQuestionSet, index) => (
                      <div 
                        key={set.id} 
                        className="animate-fadeIn" 
                        style={{ animationDelay: `${index * 100}ms` }}
                      >
                      <BaseCard
                        key={set.id}
                        set={set}
                        onStartQuiz={handleStartQuiz}
                      />
                      </div>
                    ))}
                  </div>
                </div>
              );
            }
            
            // 如果没有题库，显示提示
            if (sections.length === 0) {
              sections.push(
                <div key="empty" className="flex flex-col items-center justify-center py-12 text-center bg-white dark:bg-gray-800 rounded-2xl shadow-md p-8 relative overflow-hidden">
                  {/* 背景装饰 */}
                  <div className="absolute -top-10 -right-10 w-40 h-40 bg-blue-400/10 rounded-full blur-3xl"></div>
                  <div className="absolute -bottom-10 -left-10 w-40 h-40 bg-purple-400/10 rounded-full blur-3xl"></div>
                  <div className="absolute inset-0 bg-gradient-to-br from-transparent via-blue-50/5 to-transparent shimmer-bg"></div>
                  
                  <div className="relative w-20 h-20 mb-6 bg-slate-100 dark:bg-slate-700 rounded-full flex items-center justify-center">
                    <svg className="h-10 w-10 text-blue-400 dark:text-blue-300" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="1.5" d="M9.663 17h4.673M12 3v1m6.364 1.636l-.707.707M21 12h-1M4 12H3m3.343-5.657l-.707-.707m2.828 9.9a5 5 0 117.072 0l-.548.547A3.374 3.374 0 0014 18.469V19a2 2 0 11-4 0v-.531c0-.895-.356-1.754-.988-2.386l-.548-.547z" />
                  </svg>
                    <div className="absolute inset-0 rounded-full animate-glow"></div>
                  </div>
                  
                  <h3 className="text-xl font-medium text-gray-700 dark:text-gray-200 mb-2">未找到题库</h3>
                  <p className="text-sm text-gray-500 dark:text-gray-400 max-w-md mb-8">
                    没有符合当前筛选条件的题库。请尝试更改筛选条件或搜索关键词。
                  </p>
                  
                  <button
                    onClick={() => {
                      setActiveCategory('all');
                      setSearchTerm('');
                    }}
                    className="px-5 py-2.5 bg-gradient-to-r from-blue-600 to-indigo-600 text-white rounded-lg hover:from-blue-700 hover:to-indigo-700 transition-all duration-300 flex items-center shadow-md hover:shadow-lg transform hover:-translate-y-0.5"
                  >
                    <svg className="h-5 w-5 mr-2" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
                    </svg>
                    重置筛选条件
                  </button>
                  
                  {/* 装饰性技术元素 */}
                  <div className="absolute top-1/4 right-1/4 w-2 h-2 bg-blue-400 rounded-full animate-ping opacity-70"></div>
                  <div className="absolute bottom-1/4 left-1/4 w-2 h-2 bg-purple-400 rounded-full animate-ping opacity-70" style={{animationDelay: '1s'}}></div>
                </div>
              );
            }
            
            return sections;
          })()}
        </div>
          
        </div>
        
        {/* 推荐题库区域 */}
      </div>
    </div>
  );
};

export default HomePage;