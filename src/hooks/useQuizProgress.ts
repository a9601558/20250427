import { useState, useCallback, useRef, useEffect } from 'react';
import { useSocket } from '../contexts/SocketContext';
import { AnsweredQuestion } from './useQuizReducer';
import { toast } from 'react-toastify';
import { STORAGE_KEYS, SOCKET_EVENTS, TIME, MESSAGES } from '../constants/quiz';

interface ProgressData {
  lastQuestionIndex: number;
  answeredQuestions: AnsweredQuestion[];
  lastUpdated: string;
  pendingSync?: boolean;
  timeSpent?: number;
}

interface UseQuizProgressProps {
  questionSetId: string | undefined;
  userId: string | undefined;
}

interface ProgressError {
  message: string;
  code: string;
  timestamp: number;
}

/**
 * Custom hook to manage quiz progress - handles saving, loading, and synchronizing
 * progress between localStorage and server
 */
export const useQuizProgress = ({ questionSetId, userId }: UseQuizProgressProps) => {
  const { socket } = useSocket();
  const [isSyncing, setIsSyncing] = useState(false);
  const [lastSyncTime, setLastSyncTime] = useState(0);
  const [pendingSync, setPendingSync] = useState(false);
  const [error, setError] = useState<ProgressError | null>(null);
  
  // Use refs to track sync state across renders
  const unsyncedChangesRef = useRef(false);
  const syncTimeoutRef = useRef<NodeJS.Timeout | null>(null);
  const pendingBeaconDataRef = useRef<Record<string, any> | null>(null);
  
  /**
   * Clear error state
   */
  const clearError = useCallback(() => {
    setError(null);
  }, []);
  
  /**
   * Handle errors consistently across the hook
   */
  const handleError = useCallback((message: string, code: string = 'PROGRESS_ERROR', showToast: boolean = true) => {
    console.error(`[useQuizProgress] ${message}`);
    
    const progressError: ProgressError = {
      message,
      code,
      timestamp: Date.now()
    };
    
    setError(progressError);
    
    if (showToast) {
      toast.error(message);
    }
    
    return progressError;
  }, []);
  
  /**
   * Save progress to localStorage with error handling
   */
  const saveProgressToLocalStorage = useCallback((
    currentQuestionIndex: number, 
    answeredQuestions: AnsweredQuestion[],
    timeSpent?: number
  ) => {
    if (!questionSetId) return false;
    
    try {
      const progressData: ProgressData = {
        lastQuestionIndex: currentQuestionIndex,
        answeredQuestions,
        lastUpdated: new Date().toISOString(),
        timeSpent
      };
      
      localStorage.setItem(STORAGE_KEYS.PROGRESS(questionSetId), JSON.stringify(progressData));
      console.log(`[useQuizProgress] Saved progress to localStorage: ${answeredQuestions.length} answers`);
      
      // Mark that we have unsynced changes
      unsyncedChangesRef.current = true;
      return true;
    } catch (error) {
      handleError('Error saving progress to localStorage', 'STORAGE_ERROR');
      return false;
    }
  }, [questionSetId, handleError]);
  
  /**
   * Load progress from localStorage with validation
   */
  const loadProgressFromLocalStorage = useCallback((): ProgressData | null => {
    if (!questionSetId) return null;
    
    try {
      const progressKey = STORAGE_KEYS.PROGRESS(questionSetId);
      const progressStr = localStorage.getItem(progressKey);
      
      if (!progressStr) return null;
      
      const progress = JSON.parse(progressStr) as ProgressData;
      
      // Validate data
      const lastUpdated = new Date(progress.lastUpdated || 0);
      const isRecent = Date.now() - lastUpdated.getTime() < 24 * 60 * 60 * 1000; // 24 hours
      
      if (!isRecent) {
        console.log('[useQuizProgress] Progress data is too old, ignoring');
        return null;
      }
      
      if (!progress.answeredQuestions || !Array.isArray(progress.answeredQuestions)) {
        console.log('[useQuizProgress] Invalid progress data (no answered questions)');
        return null;
      }
      
      return progress;
    } catch (error) {
      handleError('Error loading progress from localStorage', 'STORAGE_ERROR', false);
      return null;
    }
  }, [questionSetId, handleError]);
  
  /**
   * Sync progress to server with confirmation handling
   */
  const syncProgressToServer = useCallback(async (
    currentQuestionIndex: number,
    answeredQuestions: AnsweredQuestion[],
    timeSpent: number,
    force: boolean = false
  ) => {
    if (!userId || !questionSetId || !socket) {
      unsyncedChangesRef.current = true; // Mark as unsynced since we couldn't sync
      return false;
    }
    
    // If no unsynced changes and not forced, skip
    if (!force && !unsyncedChangesRef.current) {
      console.log('[useQuizProgress] No unsynced changes to sync');
      return true;
    }
    
    // Prevent frequent syncing (throttle)
    const now = Date.now();
    if (!force && (now - lastSyncTime < TIME.SYNC_THROTTLE)) {
      console.log('[useQuizProgress] Last sync was less than 10 seconds ago, skipping');
      setPendingSync(true);
      return false;
    }
    
    try {
      console.log('[useQuizProgress] Syncing progress to server');
      setIsSyncing(true);
      setPendingSync(false);
      
      // Clear any existing timeout
      if (syncTimeoutRef.current) {
        clearTimeout(syncTimeoutRef.current);
        syncTimeoutRef.current = null;
      }
      
      // Prepare the progress data bundle
      const progressBundle = {
        userId,
        questionSetId,
        lastQuestionIndex: currentQuestionIndex,
        answeredQuestions,
        timeSpent,
        timestamp: new Date().toISOString()
      };
      
      // Set up a callback and timeout for confirmation
      const syncPromise = new Promise<boolean>((resolve) => {
        // Set timeout to handle case when server doesn't respond
        syncTimeoutRef.current = setTimeout(() => {
          console.log('[useQuizProgress] Sync confirmation timeout');
          setIsSyncing(false);
          unsyncedChangesRef.current = true; // Keep marked as unsynced
          resolve(false);
        }, TIME.SYNC_TIMEOUT);
        
        // Emit with callback for confirmation
        socket.emit(SOCKET_EVENTS.PROGRESS_UPDATE, progressBundle, (response: { success: boolean, error?: string }) => {
          // Clear timeout since we got a response
          if (syncTimeoutRef.current) {
            clearTimeout(syncTimeoutRef.current);
            syncTimeoutRef.current = null;
          }
          
          if (response && response.success) {
            console.log('[useQuizProgress] Progress sync confirmed by server');
            setLastSyncTime(now);
            unsyncedChangesRef.current = false;
            
            // Save to localStorage with pendingSync: false
            const progressData = loadProgressFromLocalStorage();
            if (progressData) {
              progressData.pendingSync = false;
              try {
                localStorage.setItem(STORAGE_KEYS.PROGRESS(questionSetId), JSON.stringify(progressData));
              } catch (e) {
                // Non-critical error, just log it
                console.error('[useQuizProgress] Error updating pendingSync flag:', e);
              }
            }
            
            setIsSyncing(false);
            resolve(true);
          } else {
            const errorMsg = response?.error || 'Unknown error';
            handleError(`Sync error: ${errorMsg}`, 'SYNC_ERROR');
            setIsSyncing(false);
            unsyncedChangesRef.current = true; // Keep marked as unsynced
            resolve(false);
          }
        });
      });
      
      // Also prepare data for navigator.sendBeacon
      // This will be used if the page is unloaded before sync completes
      pendingBeaconDataRef.current = progressBundle;
      
      return await syncPromise;
    } catch (error) {
      handleError('Error syncing progress to server', 'SYNC_ERROR');
      setIsSyncing(false);
      unsyncedChangesRef.current = true; // Mark as unsynced
      return false;
    }
  }, [userId, questionSetId, socket, lastSyncTime, handleError, loadProgressFromLocalStorage]);
  
  /**
   * Load progress from server
   */
  const loadProgressFromServer = useCallback(async (): Promise<ProgressData | null> => {
    if (!userId || !questionSetId || !socket) {
      return null;
    }
    
    return new Promise((resolve) => {
      console.log('[useQuizProgress] Requesting progress from server');
      
      // Set up timeout to avoid hanging
      const timeout = setTimeout(() => {
        console.log('[useQuizProgress] Progress request timed out');
        resolve(null);
      }, TIME.SYNC_TIMEOUT);
      
      // Define one-time handler
      const handleProgressData = (progressData: any) => {
        clearTimeout(timeout);
        
        if (!progressData) {
          console.log('[useQuizProgress] Server returned empty progress data');
          resolve(null);
          return;
        }
        
        console.log('[useQuizProgress] Received progress data from server');
        
        try {
          // Transform server data to our format
          const transformedData: ProgressData = {
            lastQuestionIndex: progressData.lastQuestionIndex,
            answeredQuestions: progressData.answeredQuestions || [],
            lastUpdated: new Date().toISOString(),
            timeSpent: progressData.timeSpent
          };
          
          // Save to localStorage for offline access
          localStorage.setItem(
            STORAGE_KEYS.PROGRESS(questionSetId), 
            JSON.stringify(transformedData)
          );
          
          resolve(transformedData);
        } catch (error) {
          handleError('Error processing server progress data', 'DATA_ERROR', false);
          resolve(null);
        }
      };
      
      // Register one-time listener
      socket.once(SOCKET_EVENTS.PROGRESS_DATA, handleProgressData);
      
      // Request progress data
      socket.emit(SOCKET_EVENTS.PROGRESS_GET, {
        userId,
        questionSetId
      });
    });
  }, [userId, questionSetId, socket, handleError]);
  
  /**
   * Reset progress
   */
  const resetProgress = useCallback(async () => {
    if (!questionSetId) return false;
    
    try {
      // Clear localStorage
      localStorage.removeItem(STORAGE_KEYS.PROGRESS(questionSetId));
      
      // Reset sync state
      unsyncedChangesRef.current = false;
      
      // If connected to server, request reset
      if (socket && userId) {
        return new Promise<boolean>((resolve) => {
          // Set timeout
          const timeout = setTimeout(() => {
            console.log('[useQuizProgress] Reset request timed out');
            resolve(false);
          }, TIME.RESET_TIMEOUT);
          
          // Define one-time handler
          const handleResetResult = (result: { success: boolean }) => {
            clearTimeout(timeout);
            console.log(`[useQuizProgress] Server reset result: ${result.success}`);
            
            if (result.success) {
              unsyncedChangesRef.current = false;
              toast.success(MESSAGES.RESET_SUCCESS);
            }
            
            resolve(result.success);
          };
          
          // Register one-time listener
          socket.once(SOCKET_EVENTS.PROGRESS_RESET_RESULT, handleResetResult);
          
          // Send reset request
          socket.emit(SOCKET_EVENTS.PROGRESS_RESET, {
            userId,
            questionSetId
          });
          
          console.log('[useQuizProgress] Sent progress reset request');
        });
      }
      
      return true;
    } catch (error) {
      handleError('Error resetting progress', 'RESET_ERROR');
      return false;
    }
  }, [questionSetId, userId, socket, handleError]);
  
  /**
   * Find best progress source (local or server)
   */
  const loadBestProgressSource = useCallback(async () => {
    // Set a loading lock to prevent race conditions with sync operations
    const loadingLock = `progress_loading_${questionSetId}`;
    
    try {
      // Check if we're already loading
      if (sessionStorage.getItem(loadingLock)) {
        console.log('[useQuizProgress] Progress loading already in progress, waiting...');
        
        // Wait for ongoing loading to complete (max 3 seconds)
        const waitStart = Date.now();
        while (sessionStorage.getItem(loadingLock) && Date.now() - waitStart < 3000) {
          await new Promise(r => setTimeout(r, 100));
        }
        
        // If still locked after timeout, force remove the lock
        if (sessionStorage.getItem(loadingLock)) {
          console.log('[useQuizProgress] Forcing removal of stale loading lock');
          sessionStorage.removeItem(loadingLock);
        }
      }
      
      // Set loading lock
      sessionStorage.setItem(loadingLock, Date.now().toString());
      
      // First try localStorage for faster initial loading
      const localProgress = loadProgressFromLocalStorage();
      
      if (localProgress && localProgress.answeredQuestions.length > 0) {
        console.log('[useQuizProgress] Using local progress data');
        
        // Request server data in background but don't wait for it
        if (userId && socket) {
          console.log('[useQuizProgress] Requesting server data in background');
          loadProgressFromServer().catch(e => {
            console.error('[useQuizProgress] Background server data fetch failed:', e);
          });
        }
        
        // Release lock
        sessionStorage.removeItem(loadingLock);
        return localProgress;
      }
      
      // If no local data or user is logged in, try server
      if (userId && socket) {
        console.log('[useQuizProgress] Requesting progress from server');
        const serverProgress = await loadProgressFromServer();
        
        if (serverProgress) {
          // Release lock
          sessionStorage.removeItem(loadingLock);
          return serverProgress;
        }
      }
      
      // No progress found
      // Release lock
      sessionStorage.removeItem(loadingLock);
      return null;
    } catch (error) {
      // Make sure to release lock on error
      sessionStorage.removeItem(loadingLock);
      handleError('Error loading progress', 'LOAD_ERROR', false);
      return null;
    }
  }, [loadProgressFromLocalStorage, loadProgressFromServer, userId, socket, questionSetId, handleError]);
  
  /**
   * Forcefully sync progress using navigator.sendBeacon
   * This is more reliable during page unload events
   */
  const forceSyncWithBeacon = useCallback(() => {
    if (!userId || !questionSetId || !pendingBeaconDataRef.current) {
      return false;
    }
    
    try {
      if ('sendBeacon' in navigator) {
        // Create endpoint URL - this should match your server endpoint for progress updates
        const endpoint = `/api/progress/sync`;
        
        // Send data via beacon
        const result = navigator.sendBeacon(
          endpoint,
          JSON.stringify(pendingBeaconDataRef.current)
        );
        
        console.log(`[useQuizProgress] sendBeacon result: ${result}`);
        return result;
      }
    } catch (e) {
      console.error('[useQuizProgress] sendBeacon failed:', e);
    }
    
    return false;
  }, [userId, questionSetId]);
  
  // Handle pending syncs
  useEffect(() => {
    if (pendingSync && unsyncedChangesRef.current) {
      // Load the latest data from localStorage
      const progress = loadProgressFromLocalStorage();
      
      if (progress && userId && questionSetId && socket) {
        const syncTimer = setTimeout(() => {
          syncProgressToServer(
            progress.lastQuestionIndex,
            progress.answeredQuestions,
            progress.timeSpent || 0
          );
        }, TIME.SYNC_THROTTLE); // Wait for sync throttle to expire
        
        return () => clearTimeout(syncTimer);
      }
    }
  }, [pendingSync, loadProgressFromLocalStorage, syncProgressToServer, userId, questionSetId, socket]);
  
  // Set up periodic sync
  useEffect(() => {
    if (!userId || !questionSetId || !socket) return;
    
    const syncInterval = setInterval(() => {
      if (unsyncedChangesRef.current) {
        // Load the latest data from localStorage
        const progress = loadProgressFromLocalStorage();
        
        if (progress) {
          console.log('[useQuizProgress] Running periodic sync');
          syncProgressToServer(
            progress.lastQuestionIndex,
            progress.answeredQuestions,
            progress.timeSpent || 0
          );
        }
      }
    }, TIME.SYNC_INTERVAL); // Every 5 minutes
    
    return () => clearInterval(syncInterval);
  }, [userId, questionSetId, socket, loadProgressFromLocalStorage, syncProgressToServer]);
  
  // Set up beforeunload handler with improved beacon support
  useEffect(() => {
    if (!questionSetId) return;
    
    const handleBeforeUnload = (event: BeforeUnloadEvent) => {
      if (unsyncedChangesRef.current) {
        // Try to sync with beacon API first (more reliable)
        const beaconSent = forceSyncWithBeacon();
        
        if (!beaconSent) {
          // Mark progress for sync on next load as fallback
          const progressStr = localStorage.getItem(STORAGE_KEYS.PROGRESS(questionSetId));
          
          if (progressStr) {
            try {
              const progress = JSON.parse(progressStr);
              progress.pendingSync = true;
              localStorage.setItem(STORAGE_KEYS.PROGRESS(questionSetId), JSON.stringify(progress));
            } catch (e) {
              console.error('[useQuizProgress] Error updating pendingSync flag:', e);
            }
          }
        }
        
        // Show confirmation dialog
        const message = MESSAGES.UNSAVED_PROGRESS;
        event.preventDefault();
        event.returnValue = message;
        return message;
      }
    };
    
    // Add event listener
    window.addEventListener('beforeunload', handleBeforeUnload);
    
    return () => {
      window.removeEventListener('beforeunload', handleBeforeUnload);
      
      // On unmount, try to sync one last time
      if (unsyncedChangesRef.current) {
        const progress = loadProgressFromLocalStorage();
        
        if (progress && userId && socket) {
          // Try both methods: beacon (most reliable) and socket (as backup)
          forceSyncWithBeacon();
          
          socket.emit(SOCKET_EVENTS.PROGRESS_UPDATE, {
            userId,
            questionSetId,
            lastQuestionIndex: progress.lastQuestionIndex,
            answeredQuestions: progress.answeredQuestions,
            timeSpent: progress.timeSpent || 0,
            timestamp: new Date().toISOString()
          });
        }
      }
    };
  }, [questionSetId, userId, socket, loadProgressFromLocalStorage, forceSyncWithBeacon]);
  
  // Check for pending syncs on initial load
  useEffect(() => {
    if (!userId || !questionSetId || !socket) return;
    
    const checkPendingSync = async () => {
      const progressKey = STORAGE_KEYS.PROGRESS(questionSetId);
      const progressStr = localStorage.getItem(progressKey);
      
      if (progressStr) {
        try {
          const progress = JSON.parse(progressStr);
          
          if (progress.pendingSync === true) {
            console.log('[useQuizProgress] Found pending sync from previous session');
            
            // Prepare data for beacon (in case we need it later)
            pendingBeaconDataRef.current = {
              userId,
              questionSetId,
              lastQuestionIndex: progress.lastQuestionIndex,
              answeredQuestions: progress.answeredQuestions,
              timeSpent: progress.timeSpent || 0,
              timestamp: new Date().toISOString()
            };
            
            // Emit sync request with callback
            socket.emit(SOCKET_EVENTS.PROGRESS_UPDATE, pendingBeaconDataRef.current, (response: { success: boolean }) => {
              if (response && response.success) {
                console.log('[useQuizProgress] Pending sync completed successfully');
                
                // Clear pending flag
                progress.pendingSync = false;
                localStorage.setItem(progressKey, JSON.stringify(progress));
              } else {
                console.error('[useQuizProgress] Pending sync failed');
              }
            });
          }
        } catch (e) {
          handleError('Error checking for pending sync', 'SYNC_ERROR', false);
        }
      }
    };
    
    checkPendingSync();
  }, [userId, questionSetId, socket, handleError]);
  
  return {
    saveProgressToLocalStorage,
    loadProgressFromLocalStorage,
    syncProgressToServer,
    loadProgressFromServer,
    resetProgress,
    loadBestProgressSource,
    forceSyncWithBeacon,
    isSyncing,
    hasUnsyncedChanges: unsyncedChangesRef.current,
    error,
    clearError
  };
}; 