import { useState, useEffect, useCallback } from 'react';
import { IQuestionSet } from '../types/index';
import { useSocket } from '../contexts/SocketContext';
import { useUser } from '../contexts/UserContext';
import { STORAGE_KEYS, SOCKET_EVENTS } from '../constants/quiz';
import { toast } from 'react-toastify';

export interface AccessState {
  hasAccess: boolean;
  isLoading: boolean;
  trialEnded: boolean;
  hasRedeemed: boolean;
  remainingDays: number | null;
  isPaid: boolean;
  trialQuestions: number | null;
  answeredCount?: number;
  error: string | null;
}

/**
 * Hook to manage quiz access permissions - handles checking, storing and retrieving
 * access rights across local storage and server.
 */
export const useQuizAccess = (questionSetId: string | undefined, questionSet: IQuestionSet | null) => {
  const { socket } = useSocket();
  const { user, hasAccessToQuestionSet } = useUser();
  
  // Initialize access state
  const [accessState, setAccessState] = useState<AccessState>({
    hasAccess: false,
    isLoading: true,
    trialEnded: false,
    hasRedeemed: false,
    remainingDays: null,
    isPaid: false,
    trialQuestions: null,
    error: null
  });

  // Normalize questionSetId for consistent comparison
  const normalizeId = useCallback((id: string | undefined): string => {
    return id ? String(id).trim() : '';
  }, []);
  
  /**
   * Save access rights to localStorage with error handling
   */
  const saveAccessToLocalStorage = useCallback((questionSetId: string, hasAccess: boolean, remainingDays?: number) => {
    if (!questionSetId) return;
    
    try {
      const normalizedId = normalizeId(questionSetId);
      console.log(`[useQuizAccess] Saving access rights for ${normalizedId}: ${hasAccess}`);
      
      // Get current access rights
      const accessRightsStr = localStorage.getItem(STORAGE_KEYS.ACCESS_RIGHTS);
      let accessRights: Record<string, any> = {};
      
      if (accessRightsStr) {
        try {
          accessRights = JSON.parse(accessRightsStr);
        } catch (e) {
          console.error('[useQuizAccess] Failed to parse access rights', e);
          // Try to recover by resetting access rights
          accessRights = {};
        }
      }
      
      // Update access rights
      accessRights[normalizedId] = hasAccess;
      
      // Save back to localStorage
      localStorage.setItem(STORAGE_KEYS.ACCESS_RIGHTS, JSON.stringify(accessRights));
      
      if (remainingDays) {
        localStorage.setItem(STORAGE_KEYS.REMAINING_DAYS(normalizedId), JSON.stringify({ remainingDays }));
      }
    } catch (e) {
      const errorMsg = 'Failed to save access rights to local storage';
      console.error(`[useQuizAccess] ${errorMsg}`, e);
      setAccessState(prev => ({ ...prev, error: errorMsg }));
      // Display error to user
      toast.error('Unable to save access information. Some features may not work correctly.');
    }
  }, [normalizeId]);
  
  /**
   * Get access rights from localStorage with error handling
   */
  const getAccessFromLocalStorage = useCallback((questionSetId: string): boolean => {
    if (!questionSetId) return false;
    
    try {
      const normalizedId = normalizeId(questionSetId);
      
      const accessRightsStr = localStorage.getItem(STORAGE_KEYS.ACCESS_RIGHTS);
      if (!accessRightsStr) return false;
      
      const accessRights = JSON.parse(accessRightsStr);
      return !!accessRights[normalizedId];
    } catch (e) {
      const errorMsg = 'Failed to get access rights from local storage';
      console.error(`[useQuizAccess] ${errorMsg}`, e);
      setAccessState(prev => ({ ...prev, error: errorMsg }));
      return false;
    }
  }, [normalizeId]);
  
  /**
   * Save redeemed question set ID to localStorage
   */
  const saveRedeemedQuestionSetId = useCallback((questionSetId: string) => {
    try {
      const normalizedId = normalizeId(questionSetId);
      
      // Get existing redeemed IDs
      const redeemedStr = localStorage.getItem(STORAGE_KEYS.REDEEMED_SETS);
      let redeemedIds: string[] = [];
      
      if (redeemedStr) {
        redeemedIds = JSON.parse(redeemedStr);
      }
      
      // Ensure it's an array
      if (!Array.isArray(redeemedIds)) {
        redeemedIds = [];
      }
      
      // Add ID if not already in the list
      if (!redeemedIds.includes(normalizedId)) {
        redeemedIds.push(normalizedId);
        localStorage.setItem(STORAGE_KEYS.REDEEMED_SETS, JSON.stringify(redeemedIds));
        console.log(`[useQuizAccess] Added question set ID to redeemed list: ${normalizedId}`);
      }
    } catch (e) {
      const errorMsg = 'Failed to save redeemed record';
      console.error(`[useQuizAccess] ${errorMsg}`, e);
      setAccessState(prev => ({ ...prev, error: errorMsg }));
    }
  }, [normalizeId]);
  
  /**
   * Check if a question set has been redeemed in localStorage
   */
  const checkLocalRedeemedStatus = useCallback((questionSetId: string): boolean => {
    try {
      if (!questionSetId) return false;
      
      const normalizedId = normalizeId(questionSetId);
      
      // Check redeemedQuestionSetIds
      const redeemedStr = localStorage.getItem(STORAGE_KEYS.REDEEMED_SETS);
      if (redeemedStr) {
        const redeemedIds = JSON.parse(redeemedStr);
        if (Array.isArray(redeemedIds)) {
          return redeemedIds.some(id => normalizeId(id) === normalizedId);
        }
      }
      
      // Check quizAccessRights
      const accessRightsStr = localStorage.getItem(STORAGE_KEYS.ACCESS_RIGHTS);
      if (accessRightsStr) {
        const accessRights = JSON.parse(accessRightsStr);
        if (accessRights[normalizedId] && accessRights[normalizedId].hasAccess) {
          return true;
        }
      }
      
      // Check questionSetAccessCache
      if (user?.id) {
        const accessCacheStr = localStorage.getItem(STORAGE_KEYS.ACCESS_CACHE);
        if (accessCacheStr) {
          const accessCache = JSON.parse(accessCacheStr);
          if (accessCache[user.id] && 
              accessCache[user.id][normalizedId] && 
              accessCache[user.id][normalizedId].hasAccess) {
            return true;
          }
        }
      }
      
      return false;
    } catch (e) {
      const errorMsg = 'Failed to check local redeemed status';
      console.error(`[useQuizAccess] ${errorMsg}`, e);
      setAccessState(prev => ({ ...prev, error: errorMsg }));
      return false;
    }
  }, [normalizeId, user?.id]);
  
  /**
   * Comprehensive access check from all sources
   */
  const checkFullAccessFromAllSources = useCallback((): boolean => {
    if (!questionSet) return false;
    
    const normalizedId = normalizeId(questionSet.id);
    console.log(`[useQuizAccess] Comprehensive access check for ${normalizedId}`);
    
    // Create result object to track different access sources
    const accessResults = {
      localStorage: false,
      redemptionStatus: false,
      userPurchases: false,
      questionSetProperty: false,
      componentState: false,
      isFree: false
    };
    
    // 1. Check localStorage access records
    try {
      // Check general access rights
      const accessRightsStr = localStorage.getItem(STORAGE_KEYS.ACCESS_RIGHTS);
      if (accessRightsStr) {
        const accessRights = JSON.parse(accessRightsStr);
        accessResults.localStorage = !!accessRights[normalizedId];
      }
      
      // Check redeemed records
      const redeemedStr = localStorage.getItem(STORAGE_KEYS.REDEEMED_SETS);
      if (redeemedStr) {
        const redeemedIds = JSON.parse(redeemedStr);
        
        if (Array.isArray(redeemedIds)) {
          accessResults.redemptionStatus = redeemedIds.some(id => {
            const redeemedId = normalizeId(id);
            return redeemedId === normalizedId;
          });
        }
      }
    } catch (e) {
      console.error('[useQuizAccess] Failed to check localStorage permissions', e);
    }
    
    // 2. Check user purchase records
    if (user?.purchases && Array.isArray(user.purchases)) {
      const purchase = user.purchases.find(p => {
        return normalizeId(p.questionSetId) === normalizedId;
      });
      
      if (purchase) {
        const now = new Date();
        const expiryDate = purchase.expiryDate ? new Date(purchase.expiryDate) : null;
        const isExpired = expiryDate && expiryDate <= now;
        const isActive = purchase.status === 'active' || purchase.status === 'completed' || !purchase.status;
        
        accessResults.userPurchases = !isExpired && isActive;
      }
    }
    
    // 3. Check questionSet's hasAccess property
    accessResults.questionSetProperty = !!questionSet.hasAccess;
    
    // 4. Check current component state
    // By using accessState directly from the current render, it's consistent within the render cycle
    accessResults.componentState = accessState.hasAccess || accessState.hasRedeemed;
    
    // 5. Check if it's a free question set
    accessResults.isFree = !questionSet.isPaid;
    
    // Combine all access results
    const hasAccess = Object.values(accessResults).some(Boolean);
    
    console.log('[useQuizAccess] Access check results:', accessResults);
    console.log(`[useQuizAccess] Final access result: ${hasAccess}`);
    
    return hasAccess;
  }, [questionSet, user?.purchases, normalizeId, accessState]);

  /**
   * Perform comprehensive access check and update state
   */
  const checkAccess = useCallback(async () => {
    if (!questionSet) return;
    
    console.log(`[useQuizAccess] Checking access for question set ${questionSet.id}`);
    
    // Initialize new state - we'll build this up and set it once at the end
    const newState = {
      hasAccess: false,
      trialEnded: accessState.trialEnded,
      isLoading: false,
      isPaid: questionSet.isPaid || false,
      trialQuestions: questionSet.trialQuestions || null,
      remainingDays: accessState.remainingDays,
      hasRedeemed: accessState.hasRedeemed,
      error: null,
      answeredCount: accessState.answeredCount
    };
    
    // First check all possible access sources
    const hasFullAccess = checkFullAccessFromAllSources();
    if (hasFullAccess) {
      console.log(`[useQuizAccess] Comprehensive check found access`);
      newState.hasAccess = true;
      newState.trialEnded = false;
      saveAccessToLocalStorage(questionSet.id, true);
      setAccessState(prev => ({ ...prev, ...newState }));
      
      // Still check with server for synchronization purposes
      if (socket && user?.id) {
        socket.emit(SOCKET_EVENTS.CHECK_ACCESS, {
          userId: user.id,
          questionSetId: normalizeId(questionSet.id),
          deviceId: localStorage.getItem('deviceId') || navigator.userAgent,
          requestSource: 'comprehensive_check'
        });
      }
      return;
    }
    
    // If user has redeemed code, grant access
    if (accessState.hasRedeemed) {
      console.log(`[useQuizAccess] User has redeemed code, granting access`);
      newState.hasAccess = true;
      newState.trialEnded = false;
      saveAccessToLocalStorage(questionSet.id, true);
      setAccessState(prev => ({ ...prev, ...newState }));
      return;
    }
    
    // Check localStorage for access rights
    const localStorageAccess = getAccessFromLocalStorage(questionSet.id);
    if (localStorageAccess) {
      console.log(`[useQuizAccess] localStorage shows access, granting access`);
      newState.hasAccess = true;
      newState.trialEnded = false;
      setAccessState(prev => ({ ...prev, ...newState }));
      return;
    }
    
    // If it's a free question set, grant access
    if (!questionSet.isPaid) {
      console.log(`[useQuizAccess] Free question set, granting access`);
      newState.hasAccess = true;
      newState.isPaid = false;
      newState.trialEnded = false;
      saveAccessToLocalStorage(questionSet.id, true);
      setAccessState(prev => ({ ...prev, ...newState }));
      return;
    }
    
    // For non-logged in users, don't check server permissions
    if (!user) {
      console.log(`[useQuizAccess] User not logged in, denying access`);
      
      // Check trial ended status
      if (questionSet.trialQuestions && newState.answeredCount !== undefined && 
          newState.answeredCount >= questionSet.trialQuestions) {
        newState.trialEnded = true;
      }
      
      saveAccessToLocalStorage(questionSet.id, false);
      setAccessState(prev => ({ ...prev, ...newState }));
      return;
    }
    
    // Check user permissions from various sources
    let hasAccess = false;
    
    // Check purchase records
    if (user.purchases && user.purchases.length > 0) {
      const targetId = normalizeId(questionSet.id);
      
      const purchase = user.purchases.find(p => {
        const purchaseSetId = normalizeId(p.questionSetId);
        return purchaseSetId === targetId;
      });
      
      if (purchase) {
        const expiryDate = new Date(purchase.expiryDate);
        const now = new Date();
        const isExpired = expiryDate <= now;
        const isActive = purchase.status === 'active' || purchase.status === 'completed' || !purchase.status;
        
        hasAccess = !isExpired && isActive;
        
        if (hasAccess) {
          const remainingDays = Math.ceil((expiryDate.getTime() - now.getTime()) / (1000 * 60 * 60 * 24));
          saveAccessToLocalStorage(questionSet.id, true, remainingDays);
          newState.remainingDays = remainingDays;
        }
      }
    }
    
    // Check if questionSet itself has access
    if (questionSet.hasAccess) {
      hasAccess = true;
      saveAccessToLocalStorage(questionSet.id, true);
    }
    
    // Check with UserContext
    if (hasAccessToQuestionSet) {
      const directAccess = hasAccessToQuestionSet(questionSet.id);
      hasAccess = hasAccess || directAccess;
      
      if (directAccess) {
        saveAccessToLocalStorage(questionSet.id, true);
      }
    }
    
    console.log(`[useQuizAccess] Local permission check result: ${hasAccess}`);
    
    // Update access state with final results
    newState.hasAccess = hasAccess;
    
    // Update trial ended status
    if (hasAccess) {
      newState.trialEnded = false;
    } else if (questionSet.trialQuestions && newState.answeredCount !== undefined && 
              newState.answeredCount >= questionSet.trialQuestions) {
      newState.trialEnded = true;
    }
    
    // Set the final state
    setAccessState(prev => ({ ...prev, ...newState }));
    
    // Verify access with server - do this even if we found access locally
    // to ensure cross-device synchronization
    if (socket && user) {
      console.log(`[useQuizAccess] Sending server access check request`);
      socket.emit(SOCKET_EVENTS.CHECK_ACCESS, {
        userId: user.id,
        questionSetId: normalizeId(questionSet.id),
        deviceId: localStorage.getItem('deviceId') || navigator.userAgent,
        requestSource: 'quiz_access_check'
      });
    }
  }, [
    questionSet, 
    user, 
    socket, 
    accessState,
    checkFullAccessFromAllSources, 
    getAccessFromLocalStorage, 
    hasAccessToQuestionSet, 
    normalizeId, 
    saveAccessToLocalStorage
  ]);

  // Update trial ended status when answeredCount changes
  useEffect(() => {
    if (!questionSet || !accessState.isPaid) return;
    
    // Only update if we need to change the trialEnded status
    const shouldBeTrialEnded = !!(
      questionSet.trialQuestions && 
      accessState.hasAccess === false && 
      accessState.hasRedeemed === false &&
      accessState.answeredCount !== undefined && 
      accessState.answeredCount >= questionSet.trialQuestions
    );
    
    if (shouldBeTrialEnded !== accessState.trialEnded) {
      setAccessState(prev => ({
        ...prev,
        trialEnded: shouldBeTrialEnded
      }));
    }
  }, [questionSet, accessState.answeredCount, accessState.hasAccess, accessState.hasRedeemed, accessState.isPaid, accessState.trialEnded]);

  // Check redeemed status in localStorage
  useEffect(() => {
    if (!questionSet?.id) return;
    
    const normalizedId = normalizeId(questionSet.id);
    const isRedeemed = checkLocalRedeemedStatus(normalizedId);
    
    if (isRedeemed && !accessState.hasRedeemed) {
      console.log(`[useQuizAccess] Question set ${normalizedId} is redeemed, granting access`);
      setAccessState(prev => ({
        ...prev,
        hasRedeemed: true,
        hasAccess: true,
        trialEnded: false
      }));
    }
  }, [questionSet?.id, normalizeId, checkLocalRedeemedStatus, accessState.hasRedeemed]);

  // Listen for socket events
  useEffect(() => {
    if (!socket || !questionSet) return;

    // Handle access update events
    const handleAccessUpdate = (data: {
      questionSetId: string;
      hasAccess: boolean;
      remainingDays?: number;
      source?: string;
    }) => {
      const normalizedEventId = normalizeId(data.questionSetId);
      const normalizedSetId = normalizeId(questionSet.id);
      
      if (normalizedEventId !== normalizedSetId) return;
      
      console.log(`[useQuizAccess] Received access update: ${data.hasAccess}, source: ${data.source || 'server'}`);
      
      // Update state
      setAccessState(prev => ({
        ...prev,
        hasAccess: data.hasAccess,
        trialEnded: data.hasAccess ? false : prev.trialEnded,
        remainingDays: data.remainingDays || prev.remainingDays
      }));
      
      // Save to localStorage
      saveAccessToLocalStorage(questionSet.id, data.hasAccess, data.remainingDays);
      
      if (data.hasAccess) {
        // Also save as redeemed for cross-device compatibility
        saveRedeemedQuestionSetId(questionSet.id);
      }
    };

    // Handle purchase success events
    const handlePurchaseSuccess = (data: {
      questionSetId: string;
      purchaseId: string;
      expiryDate: string;
    }) => {
      const normalizedEventId = normalizeId(data.questionSetId);
      const normalizedSetId = normalizeId(questionSet.id);
      
      if (normalizedEventId !== normalizedSetId) return;
      
      console.log(`[useQuizAccess] Received purchase success event for ${data.questionSetId}`);
      
      // Update state
      setAccessState(prev => ({
        ...prev,
        hasAccess: true,
        trialEnded: false
      }));
      
      // Trigger an access check
      setTimeout(() => {
        checkAccess();
      }, 300);
    };

    // Register event listeners
    socket.on(SOCKET_EVENTS.ACCESS_UPDATE, handleAccessUpdate);
    socket.on(SOCKET_EVENTS.PURCHASE_SUCCESS, handlePurchaseSuccess);

    return () => {
      socket.off(SOCKET_EVENTS.ACCESS_UPDATE, handleAccessUpdate);
      socket.off(SOCKET_EVENTS.PURCHASE_SUCCESS, handlePurchaseSuccess);
    };
  }, [socket, questionSet, normalizeId, saveAccessToLocalStorage, saveRedeemedQuestionSetId, checkAccess]);

  // Listen for global events (redemption)
  useEffect(() => {
    const handleRedeemSuccess = (e: Event) => {
      const customEvent = e as CustomEvent;
      const eventDetail = customEvent.detail || {};
      
      // Get question set ID from event
      const eventQuestionSetId = normalizeId(eventDetail.questionSetId || eventDetail.quizId || '');
      
      if (!eventQuestionSetId) return;
      
      console.log(`[useQuizAccess] Received redemption success event for ${eventQuestionSetId}`);
      
      // Update state
      setAccessState(prev => ({
        ...prev,
        hasRedeemed: true,
        hasAccess: true,
        trialEnded: false
      }));
      
      // Save to localStorage
      saveAccessToLocalStorage(eventQuestionSetId, true);
      saveRedeemedQuestionSetId(eventQuestionSetId);
      
      // If this is for the current question set, also save it specifically
      if (questionSet && eventQuestionSetId !== normalizeId(questionSet.id)) {
        saveAccessToLocalStorage(questionSet.id, true);
        saveRedeemedQuestionSetId(questionSet.id);
      }
      
      // Trigger an access check
      setTimeout(() => {
        checkAccess();
      }, 200);
    };
    
    window.addEventListener('redeem:success', handleRedeemSuccess);
    
    return () => {
      window.removeEventListener('redeem:success', handleRedeemSuccess);
    };
  }, [questionSet, normalizeId, saveAccessToLocalStorage, saveRedeemedQuestionSetId, checkAccess]);

  // Check access when question set or user changes
  useEffect(() => {
    if (questionSet?.id && !accessState.isLoading) {
      checkAccess();
    } else if (!questionSet?.id && !accessState.isLoading) {
      // Reset state when question set is not available
      setAccessState(prev => ({
        ...prev,
        hasAccess: false,
        trialEnded: false,
        isPaid: false,
        trialQuestions: null,
        isLoading: false,
        error: null
      }));
    }
  }, [questionSet?.id, user?.id, checkAccess, accessState.isLoading]);

  /**
   * Update answeredCount - called from parent component
   * This function is memoized to maintain a stable reference
   */
  const updateAnsweredCount = useCallback((count: number) => {
    // Only update if the count has changed to prevent unnecessary renders
    setAccessState(prev => {
      if (prev.answeredCount === count) return prev;
      return { ...prev, answeredCount: count };
    });
  }, []);
  
  /**
   * Clear any errors in the state
   */
  const clearError = useCallback(() => {
    setAccessState(prev => ({ ...prev, error: null }));
  }, []);
  
  return {
    ...accessState,
    checkAccess,
    saveAccessToLocalStorage,
    saveRedeemedQuestionSetId,
    updateAnsweredCount,
    checkFullAccessFromAllSources,
    clearError
  };
}; 