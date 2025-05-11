import { useState, useEffect, useCallback, useRef, useMemo } from 'react';
import { useSocket } from '../contexts/SocketContext';
import { useUser } from '../contexts/UserContext';
import apiClient from '../utils/api-client';
import { toast } from 'react-toastify';
import { PreparedQuestionSet, AccessType } from '../types/questionSet';
import useAccessManagement from './useAccessManagement';
import useRequestLimiter from './useRequestLimiter';

interface UseQuestionSetsProps {
  initialFilter?: string;
}

export function useQuestionSets({ initialFilter = 'all' }: UseQuestionSetsProps = {}) {
  const { user, syncAccessRights } = useUser();
  const { socket } = useSocket();
  const [questionSets, setQuestionSets] = useState<PreparedQuestionSet[]>([]);
  const [filteredSets, setFilteredSets] = useState<PreparedQuestionSet[]>([]);
  const [recommendedSets, setRecommendedSets] = useState<PreparedQuestionSet[]>([]);
  const [activeCategory, setActiveCategory] = useState<string>(initialFilter);
  const [loadingReason, setLoadingReason] = useState<string | null>('initial');
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [recentlyUpdatedSets, setRecentlyUpdatedSets] = useState<{[key: string]: number}>({});
  const [searchTerm, setSearchTerm] = useState<string>('');
  
  // 初始加载标记
  const hasRequestedAccess = useRef<boolean>(false);
  const loadingTimeoutRef = useRef<any>(null);
  const pendingFetchRef = useRef<boolean>(false);
  const lastSocketUpdateTime = useRef<number>(0);
  const socketDataRef = useRef<{[key: string]: {hasAccess: boolean, remainingDays: number | null, accessType?: string}}>({}); 
  const lastToastRef = useRef<number>(0);
  
  // Loading的派生状态，方便向后兼容
  const loading = loadingReason !== null;
  
  // 使用自定义hooks
  const { canMakeRequest } = useRequestLimiter();
  const { 
    saveAccessToLocalStorage,
    getAccessFromLocalCache,
    determineAccessStatus,
    cleanupExpiredCache
  } = useAccessManagement({ userId: user?.id });

  // 检查访问权限是否过期的工具函数
  const isAccessExpired = useCallback((remainingDays: number | null): boolean => {
    return remainingDays !== null && remainingDays <= 0;
  }, []);
  
  // 防止toast滥用的节流函数
  const safeToastError = useCallback((message: string) => {
    const now = Date.now();
    if (now - lastToastRef.current > 3000) {
      toast.error(message);
      lastToastRef.current = now;
    }
  }, []);

  // 结合限流器的API请求函数
  const getWithLimiter = useCallback(async (url: string, params?: any, options?: any) => {
    if (!canMakeRequest()) {
      console.warn('[useQuestionSets] 请求被限制，跳过API请求:', url);
      return null;
    }
    return apiClient.get(url, params, options);
  }, [canMakeRequest]);

  // 请求批量题库权限状态
  const requestAccessStatusForAllQuestionSets = useCallback((options: { forceRefresh?: boolean } = {}) => {
    if (!user?.id || !socket || questionSets.length === 0) {
      console.log('[useQuestionSets] 无法请求权限: 用户未登录或无题库');
      return;
    }
    
    const now = Date.now();
    console.log(`[useQuestionSets] 请求所有题库的权限状态（${questionSets.length}个题库）`);
    
    // Check throttling unless force refresh is requested
    if (!options.forceRefresh) {
      const lastUpdateRequest = parseInt(sessionStorage.getItem('last_question_sets_update_request') || '0', 10);
      
      // Skip if last request was recent and not forcing refresh
      if (now - lastUpdateRequest < 15000 && hasRequestedAccess.current) { // 15 seconds cooldown
        console.log('[useQuestionSets] 跳过权限请求: 最近已请求过 (15秒内)');
        return;
      }
      
      // Skip if hitting rate limits and not forcing
      if (!canMakeRequest()) {
        console.log('[useQuestionSets] 请求被限制，跳过权限获取');
        return;
      }
    } else {
      console.log('[useQuestionSets] 强制刷新权限状态，忽略节流限制');
    }
    
    // 设置loading状态，提供明确原因
    setLoadingReason('requestingAccess');
    
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
        source: options.forceRefresh ? 'explicit_user_refresh' : 'explicit_homepage_check'
      });
      
      // 更新最后请求时间
      lastSocketUpdateTime.current = now;
      hasRequestedAccess.current = true;
      sessionStorage.setItem('last_question_sets_update_request', now.toString());
      
      console.log(`[useQuestionSets] 已为${paidQuestionSetIds.length}个付费题库请求权限状态`);
      
      // Save the timestamp of the last full refresh
      if (options.forceRefresh) {
        sessionStorage.setItem('last_full_refresh_time', now.toString());
      }
      
      // 权限请求后，通常很快就会有响应，稍后清除加载状态
      setTimeout(() => {
        if (loadingReason === 'requestingAccess') {
          setLoadingReason(null);
        }
      }, 2000);
    } else {
      console.log('[useQuestionSets] 没有付费题库需要请求权限');
      setLoadingReason(null);
    }
  }, [user?.id, socket, questionSets, canMakeRequest, loadingReason]);

  // 获取过滤后的题库列表，按分类组织 - 使用useMemo优化
  const getFilteredQuestionSets = useCallback(() => {
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
      // 直接按选中的分类筛选
      filtered = filtered.filter(set => 
        set.category === activeCategory || 
        set.featuredCategory === activeCategory
      );
    }
    
    return filtered;
  }, [questionSets, activeCategory, searchTerm]);
  
  // 使用useMemo缓存过滤后的结果，避免重复计算
  const memoizedFilteredSets = useMemo(() => getFilteredQuestionSets(), 
    [getFilteredQuestionSets]);

  // 切换分类
  const handleCategoryChange = useCallback((category: string) => {
    console.log(`[useQuestionSets] Changing category to: ${category}`);
    setActiveCategory(category);
  }, []);

  // 获取分类过的题库列表
  const getCategorizedQuestionSets = useCallback(() => {
    const purchased = memoizedFilteredSets.filter((set: PreparedQuestionSet) => 
      (set.accessType === 'paid' || set.accessType === 'redeemed') && set.hasAccess
    );
    
    const free = memoizedFilteredSets.filter((set: PreparedQuestionSet) => 
      !set.isPaid // 只有真正的免费题库才显示在免费区域
    );
    
    const paid = memoizedFilteredSets.filter((set: PreparedQuestionSet) => 
      set.isPaid && !set.hasAccess && set.accessType !== 'expired'
    );
    
    const expired = memoizedFilteredSets.filter((set: PreparedQuestionSet) => 
      set.accessType === 'expired'
    );
    
    return { purchased, free, paid, expired };
  }, [memoizedFilteredSets]);

  // 刷新问题数量
  const refreshQuestionCounts = useCallback(async (forceAll = false) => {
    console.log(`[useQuestionSets] Refreshing question counts... Force All: ${forceAll}`);
    
    if (questionSets.length === 0) {
      console.log('[useQuestionSets] No question sets to refresh counts for');
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
          const response = await apiClient.get(`/api/questions/count/${set.id}`);
          
          if (response && response.success && response.count) {
            console.log(`[useQuestionSets] Updated count for "${set.title}": ${response.count}`);
            updatedSets[i] = { ...set, questionCount: response.count };
            updatedCount++;
          }
        } catch (e) {
          console.error(`[useQuestionSets] Error refreshing count for ${set.title}:`, e);
        }
      }
      
      if (updatedCount > 0) {
        console.log(`[useQuestionSets] Updated question counts for ${updatedCount} question sets`);
        setQuestionSets(updatedSets);
        toast.update(toastId, { 
          render: `成功更新${updatedCount}个题库的题目数量`, 
          type: toast.TYPE.SUCCESS,
          autoClose: 3000,
          closeButton: true,
          closeOnClick: true
        });
      } else {
        console.log('[useQuestionSets] No question counts needed to be updated');
        toast.update(toastId, { 
          render: '所有题库数量已是最新', 
          type: toast.TYPE.INFO,
          autoClose: 2000,
          closeButton: true,
          closeOnClick: true
        });
      }
    } catch (error) {
      console.error('[useQuestionSets] Error refreshing question counts:', error);
      toast.update(toastId, { 
        render: '刷新题目数量失败', 
        type: toast.TYPE.ERROR,
        autoClose: 3000,
        closeButton: true,
        closeOnClick: true
      });
    }
  }, [questionSets]);

  // 获取题库列表
  const fetchQuestionSets = useCallback(async (options: { forceFresh?: boolean } = {}) => {
    const now = Date.now();
    
    // 请求限制检查 - 非强制刷新时检查
    if (!options.forceFresh && !canMakeRequest()) {
      console.log('[useQuestionSets] 请求被限制，跳过题库获取');
      return questionSets;
    }
    
    // 防止频繁请求 - 仅在上次请求超过5秒或强制刷新时执行
    const lastFetchTime = parseInt(sessionStorage.getItem('last_question_sets_fetch_time') || '0', 10);
    if (!options.forceFresh && now - lastFetchTime < 5000) {
      console.log(`[useQuestionSets] 上次请求在 ${(now - lastFetchTime)/1000}秒前，跳过请求`);
      return questionSets;
    }
    
    // 防止并发请求 - 增强日志
    if (pendingFetchRef.current) {
      console.log(`[useQuestionSets] 有请求正在进行中，跳过重复请求 (loadingReason: ${loadingReason})`);
      return questionSets;
    }
    
    // 正式开始获取题库列表 - 加锁
    pendingFetchRef.current = true;
    
    // Ensure loading is set with descriptive reason
    setLoadingReason(options.forceFresh ? 'forceFetchQuestionSets' : 'fetchQuestionSets');
    
    // Set a safety timeout to prevent infinite loading state
    if (loadingTimeoutRef.current) {
      clearTimeout(loadingTimeoutRef.current);
    }
    
    loadingTimeoutRef.current = setTimeout(() => {
      console.log('[useQuestionSets] Loading timeout triggered - forcing loading state to null');
      setLoadingReason(null);
    }, 10000); // 10 seconds timeout
    
    try {
      console.log(`[useQuestionSets] 开始获取题库列表, 强制刷新: ${options.forceFresh}`);
      
      // 添加请求防缓存参数
      const timestamp = now;
      
      // 使用带限流的API请求
      const response = await getWithLimiter('/api/question-sets', 
        user?.id ? { 
          userId: user.id, 
          _t: timestamp 
        } : { _t: timestamp }
      );
      
      // 如果请求被限流器拒绝
      if (response === null) {
        pendingFetchRef.current = false;
        setLoadingReason(null);
        clearTimeout(loadingTimeoutRef.current);
        return questionSets;
      }
      
      if (response && response.success && response.data) {
        console.log(`[useQuestionSets] 成功获取${response.data.length}个题库`);
        
        // 预处理用户购买记录，创建一个Map方便快速查找
        const userPurchasesMap = new Map();
        if (user?.purchases && user.purchases.length > 0) {
          const nowDate = new Date();
          
          console.log(`[useQuestionSets] 处理${user.purchases.length}条用户购买记录供题库映射使用`);
          
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
          });
        }
        
        // 预处理用户兑换码记录，添加到快速查找Map
        if (user?.redeemCodes && user.redeemCodes.length > 0) {
          console.log(`[useQuestionSets] 处理${user.redeemCodes.length}条用户兑换码记录供题库映射使用`);
          
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
            }
          });
        }
        
        // 处理题库数据，确保包含必要字段
        const preparedSets: PreparedQuestionSet[] = response.data.map((set: any) => {
          const setId = String(set.id).trim();
          const isPaid = set.isPaid === true;
          
          // 默认为试用状态
          let accessType: AccessType = 'trial';
          let hasAccess = !isPaid; // 免费题库自动有访问权限
          let remainingDays: number | null = null;
          let paymentMethod: string | undefined = undefined;
          
          // 1. 首先优先使用用户的购买记录（这是最高优先级，特别是刚登录时）
          const userPurchase = userPurchasesMap.get(setId);
          if (userPurchase) {
            if (!userPurchase.isExpired) {
              hasAccess = userPurchase.hasAccess;
              accessType = userPurchase.accessType as AccessType;
              remainingDays = userPurchase.remainingDays;
              paymentMethod = userPurchase.paymentMethod;
              
              // 立即保存到本地缓存以确保状态一致性
              if (user?.id) {
                saveAccessToLocalStorage(setId, hasAccess, remainingDays, paymentMethod, accessType);
              }
            } else {
              // 处理过期购买记录 - 使用isAccessExpired函数更清晰
              accessType = 'expired';
              hasAccess = false;
              remainingDays = 0;
              
              // 同样更新本地缓存
              if (user?.id) {
                saveAccessToLocalStorage(setId, false, 0, userPurchase.paymentMethod, 'expired');
              }
            }
          }
          
          // 2. 其次检查Socket数据（如果尚未确定访问权限）
          const socketData = !hasAccess && socketDataRef.current[setId];
          if (socketData) {
            hasAccess = socketData.hasAccess;
            remainingDays = socketData.remainingDays;
            
            if (socketData.accessType) {
              accessType = socketData.accessType as AccessType;
            } else if (hasAccess) {
              accessType = 'paid';
              // 检查剩余天数是否为0或负数，如果是则标记为过期 - 使用isAccessExpired函数
              if (isAccessExpired(remainingDays)) {
                accessType = 'expired';
                hasAccess = false;
              }
            }
          }
          
          // 3. 然后检查本地缓存（如果仍未确定访问权限）
          const cachedData = !hasAccess && getAccessFromLocalCache(setId, user?.id);
          if (cachedData && cachedData.hasAccess) {
            hasAccess = true;
            remainingDays = cachedData.remainingDays;
            
            // 根据支付方式和剩余天数确定访问类型
            if (cachedData.paymentMethod === 'redeem' || cachedData.accessType === 'redeemed') {
              accessType = 'redeemed';
            } else {
              accessType = 'paid';
              
              // 检查是否过期 - 使用isAccessExpired函数
              if (isAccessExpired(remainingDays)) {
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
          
          // 确保validityPeriod字段存在，默认为180天
          const validityPeriod = set.validityPeriod || 180;
          
          return {
            ...set,
            hasAccess,
            accessType,
            remainingDays,
            validityPeriod
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
          console.log(`[useQuestionSets] 题库数据或权限有变化，更新UI`);
          setQuestionSets(preparedSets);
        } else {
          console.log(`[useQuestionSets] 题库数据及权限无变化，跳过更新`);
        }
        
        // 更新最后获取时间
        sessionStorage.setItem('last_question_sets_fetch_time', now.toString());
        
        // Always set loading to null after successful fetch
        setLoadingReason(null);
        clearTimeout(loadingTimeoutRef.current);
        
        // 同步完成后触发一个全局事件，通知其他组件刷新
        window.dispatchEvent(new CustomEvent('questionSets:loaded', {
          detail: { 
            timestamp: now,
            count: preparedSets.length
          }
        }));
        
        return preparedSets;
      } else {
        console.error('[useQuestionSets] 获取题库失败:', response?.message);
        // Set loading to null even if the request failed
        setLoadingReason(null);
        clearTimeout(loadingTimeoutRef.current);
        
        // Show error message to user - 使用节流toast函数
        setErrorMessage('获取题库数据失败，请稍后重试');
        safeToastError('获取题库数据失败，请稍后重试');
        return questionSets;
      }
    } catch (error) {
      console.error('[useQuestionSets] 获取题库异常:', error);
      // Set loading to null even if an error occurred
      setLoadingReason(null);
      clearTimeout(loadingTimeoutRef.current);
      
      // Show error message to user - 使用节流toast函数
      setErrorMessage('获取题库时发生错误，请刷新页面重试');
      safeToastError('获取题库时发生错误，请刷新页面重试');
      return questionSets;
    } finally {
      pendingFetchRef.current = false;
    }
  }, [
    questionSets, 
    user?.id, 
    user?.purchases, 
    user?.redeemCodes, 
    getAccessFromLocalCache, 
    saveAccessToLocalStorage, 
    canMakeRequest,
    getWithLimiter,
    isAccessExpired,
    loadingReason,
    safeToastError
  ]);

  // 初始化时获取题库列表
  useEffect(() => {
    // 如果已经有题库列表，则不重新加载
    if (questionSets.length === 0) {
      console.log(`[useQuestionSets] 初始化获取题库列表`);
      fetchQuestionSets();
    } else {
      // If we already have question sets, ensure loading is null
      setLoadingReason(null);
    }
  }, [fetchQuestionSets, questionSets.length]);

  // 自动刷新检查 - 每15分钟自动刷新一次
  useEffect(() => {
    // Only run if we have question sets and a user is logged in
    if (questionSets.length > 0 && user?.id && socket) {
      console.log('[useQuestionSets] 设置定时刷新检查');
      
      // Initialize last refresh time if not set
      if (!sessionStorage.getItem('last_full_refresh_time')) {
        sessionStorage.setItem('last_full_refresh_time', Date.now().toString());
      }
      
      // Set up an interval to check for refresh needs
      const refreshCheckInterval = setInterval(() => {
        const currentTime = Date.now();
        const lastRefresh = parseInt(sessionStorage.getItem('last_full_refresh_time') || '0', 10);
        const fifteenMinutes = 15 * 60 * 1000; // 15 minutes in milliseconds
        
        // Only refresh if it's been more than 15 minutes and we're not currently loading
        if (currentTime - lastRefresh > fifteenMinutes && !loading && !pendingFetchRef.current) {
          console.log('[useQuestionSets] 定时检查: 超过15分钟未刷新，触发自动刷新');
          requestAccessStatusForAllQuestionSets({ forceRefresh: true });
          fetchQuestionSets({ forceFresh: true });
        }
      }, 60000); // Check every minute
      
      return () => {
        clearInterval(refreshCheckInterval);
      };
    }
  }, [questionSets.length, user?.id, socket, requestAccessStatusForAllQuestionSets, fetchQuestionSets, loading]);
  
  // 监听Socket事件 - 权限更新
  useEffect(() => {
    if (!socket || !user?.id) return;
    
    console.log('[useQuestionSets] 设置Socket事件监听');
    
    // 处理批量权限更新结果
    const handleBatchAccessResult = (data: any) => {
      if (data.userId !== user?.id || !Array.isArray(data.results)) return;
      
      
      // 收集所有需要更新的题库ID及其状态
      const updatesById = new Map();
      
      // 更新Socket数据引用和本地缓存
      data.results.forEach((result: any) => {
        const questionSetId = String(result.questionSetId).trim();
        
        // 确保数据有效且包含必要字段
        if (!questionSetId || result.hasAccess === undefined) {
          return;
        }
        
        // 确保转换为正确的类型
        const hasAccess = Boolean(result.hasAccess);
        const remainingDays = result.remainingDays !== undefined ? Number(result.remainingDays) : null;
        const paymentMethod = result.paymentMethod || 'unknown';
        const accessType = paymentMethod === 'redeem' ? 'redeemed' : (hasAccess ? 'paid' : 'trial');
        
        console.log(`[useQuestionSets] 题库 ${questionSetId} 权限检查结果: 可访问=${hasAccess}, 剩余天数=${remainingDays}, 支付方式=${paymentMethod}`);
        
        // 保存到socketDataRef引用
        socketDataRef.current[questionSetId] = {
          hasAccess,
          remainingDays,
          accessType
        };
        
        // 更新本地缓存
        saveAccessToLocalStorage(
          questionSetId,
          hasAccess,
          remainingDays,
          paymentMethod,
          accessType
        );
        
        // 添加到批量更新映射
        updatesById.set(questionSetId, {
          hasAccess,
          remainingDays,
          accessType,
          paymentMethod
        });
      });
      
      // 更新题库状态
      if (updatesById.size > 0) {
        console.log(`[useQuestionSets] 应用批量权限更新到 ${updatesById.size} 个题库`);
        
        setQuestionSets(prevSets => {
          let hasChanged = false;
          let updatedCount = 0;
          
          const updatedSets = prevSets.map(set => {
            const setId = String(set.id).trim();
            const updateData = updatesById.get(setId);
            
            if (!updateData) return set;
            
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
          console.log(`[useQuestionSets] 批量更新完成: ${updatedCount}/${updatesById.size}个题库状态有变化`);
          
          // 清空Socket数据引用
          socketDataRef.current = {};
          
          // 只有在实际有变化时才返回新数组，避免不必要的重渲染
          return hasChanged ? updatedSets : prevSets;
        });
      }
    };
    
    // 处理单个题库权限更新
    const handleAccessUpdate = (data: any) => {
      // 过滤不是当前用户的事件
      if (data.userId !== user.id) return;
      
      // 添加防御性检查
      if (!data.questionSetId) {
        console.error('[useQuestionSets] 收到无效的权限更新数据');
        return;
      }
      
      // 更新本地缓存
      saveAccessToLocalStorage(
        data.questionSetId, 
        data.hasAccess, 
        data.remainingDays,
        data.paymentMethod || 'unknown',
        data.accessType || (data.hasAccess ? (data.paymentMethod === 'redeem' ? 'redeemed' : 'paid') : 'trial')
      );
      
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
    
    // 注册Socket权限事件监听
    socket.on('questionSet:accessUpdate', handleAccessUpdate);
    socket.on('questionSet:batchAccessResult', handleBatchAccessResult);
    
    return () => {
      socket.off('questionSet:accessUpdate', handleAccessUpdate);
      socket.off('questionSet:batchAccessResult', handleBatchAccessResult);
    };
  }, [socket, user?.id, saveAccessToLocalStorage, determineAccessStatus]);

  // 登录状态变化后重新获取题库数据
  useEffect(() => {
    if (!user?.id) {
      // Reset the flag when user logs out
      hasRequestedAccess.current = false;
      // Make sure loading is false when logged out
      setLoadingReason(null);
      return;
    }
    
    // 使用session storage跟踪登录处理，防止重复请求
    const loginHandled = sessionStorage.getItem(`login_handled_${user.id}`);
    const loginTime = parseInt(sessionStorage.getItem(`login_time_${user.id}`) || '0', 10);
    const now = Date.now();
    
    // 如果最近10分钟内已处理过登录，且不是页面刷新，跳过
    const isPageRefresh = !sessionStorage.getItem('page_session_id');
    if (loginHandled === 'true' && now - loginTime < 600000 && !isPageRefresh) {
      console.log('[useQuestionSets] 最近已处理过登录流程，跳过重复处理');
      return;
    }
    
    // 防止多次触发 - 使用ref标记代替sessionStorage
    if (hasRequestedAccess.current) {
      console.log('[useQuestionSets] 已在处理登录流程，跳过重复请求');
      return;
    }
    
    // 标记为已处理
    hasRequestedAccess.current = true;
    sessionStorage.setItem(`login_handled_${user.id}`, 'true');
    sessionStorage.setItem(`login_time_${user.id}`, now.toString());
    
    // Set loading true explicitly when starting login flow
    setLoadingReason('logging in');
    
    // Set a safety timeout to prevent infinite loading state
    if (loadingTimeoutRef.current) {
      clearTimeout(loadingTimeoutRef.current);
    }
    
    loadingTimeoutRef.current = setTimeout(() => {
      console.log('[useQuestionSets] Login flow timeout triggered - forcing loading state to false');
      setLoadingReason(null);
    }, 15000); // 15 seconds timeout for the entire login flow
    
    // 登录流程，按顺序执行，避免竞态条件
    (async () => {
      try {
        // 第1步：通过syncAccessRights同步最新权限数据
        console.log('[useQuestionSets] 1. 开始同步访问权限数据');
        await syncAccessRights();
        console.log('[useQuestionSets] 同步访问权限完成，此时用户数据和访问权限已是最新');
        
        // 等待短暂时间，避免请求过于密集
        await new Promise(resolve => setTimeout(resolve, 500));
        
        // 第2步：使用最新的权限信息，获取并处理题库列表
        console.log('[useQuestionSets] 2. 获取题库列表，强制使用最新数据');
        await fetchQuestionSets({ forceFresh: true });
        console.log('[useQuestionSets] 题库列表获取并处理完成，UI应显示正确的权限状态');
        
        // 第3步：通过socket请求批量权限检查，确保数据一致性
        if (socket && socket.connected) {
          console.log('[useQuestionSets] 3. 请求Socket批量权限检查，确保数据一致性');
          
          socket.emit('user:syncAccessRights', {
            userId: user.id,
            forceRefresh: true,
            timestamp: Date.now()
          });
        }
        
        // 设置loading状态为false，表示登录流程完成
        setLoadingReason(null);
        clearTimeout(loadingTimeoutRef.current);
      } catch (error) {
        console.error('[useQuestionSets] 登录流程处理出错:', error);
        setLoadingReason(null);
        setErrorMessage('请求失败，请稍后重试');
      }
    })();
  }, [user?.id, socket, syncAccessRights, fetchQuestionSets]);

  // 更新推荐题库和过滤题库
  useEffect(() => {
    // Update recommended sets from featured items
    const featuredSets = questionSets.filter(set => set.isFeatured);
    setRecommendedSets(featuredSets.slice(0, 3));
    
    // Also update filtered sets based on search and category
    setFilteredSets(memoizedFilteredSets);
  }, [questionSets, memoizedFilteredSets]);

  // 清理过期的缓存数据
  useEffect(() => {
    if (user?.id) {
      cleanupExpiredCache();
    }
  }, [user?.id, cleanupExpiredCache]);

  return {
    questionSets,
    filteredSets,
    recommendedSets,
    recentlyUpdatedSets,
    searchTerm,
    activeCategory,
    loading,
    loadingReason,
    errorMessage,
    
    // 操作方法
    setSearchTerm,
    handleCategoryChange,
    getCategorizedQuestionSets,
    refreshQuestionCounts,
    fetchQuestionSets,
    requestAccessStatusForAllQuestionSets
  };
}

export default useQuestionSets; 