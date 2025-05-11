import { useState, useCallback, useEffect, useRef } from 'react';
import { useSocket } from '../contexts/SocketContext';
import { homepageService } from '../services/api';
import { toast } from 'react-toastify';
import { 
  HomeContentData, 
  HomeContentDataDB, 
  defaultHomeContent
} from '../types/questionSet';
import { throttleContentFetch, detectLoop, isBlocked } from '../utils/loopPrevention';
import useRequestLimiter from './useRequestLimiter';

// Helper for converting database format to frontend format
export const convertDbToFrontend = (dbContent: HomeContentDataDB): HomeContentData => {
  let featuredCategories: string[] = [];
  
  // Handle featured_categories which could be a string or array
  if (typeof dbContent.featured_categories === 'string') {
    try {
      // Try to parse if it's a JSON string
      featuredCategories = JSON.parse(dbContent.featured_categories);
    } catch (e) {
      // If it fails, split by comma if it contains commas
      if (dbContent.featured_categories.includes(',')) {
        featuredCategories = dbContent.featured_categories.split(',').map(c => c.trim());
      } else if (dbContent.featured_categories.trim() !== '') {
        // Single category
        featuredCategories = [dbContent.featured_categories.trim()];
      }
    }
  } else if (Array.isArray(dbContent.featured_categories)) {
    featuredCategories = dbContent.featured_categories;
  }
  
  return {
    welcomeTitle: dbContent.welcome_title,
    welcomeDescription: dbContent.welcome_description,
    announcements: dbContent.announcements,
    featuredCategories: featuredCategories,
    footerText: dbContent.footer_text
  };
};

// Helper for converting frontend format to database format
export const convertFrontendToDb = (frontendContent: HomeContentData): HomeContentDataDB => {
  return {
    welcome_title: frontendContent.welcomeTitle,
    welcome_description: frontendContent.welcomeDescription,
    announcements: frontendContent.announcements,
    featured_categories: frontendContent.featuredCategories,
    footer_text: frontendContent.footerText
  };
};

// Helper for getting content from localStorage
export const getHomeContentFromLocalStorage = (format: 'frontend' | 'db' = 'frontend'): HomeContentData | HomeContentDataDB | null => {
  try {
    const storedContent = localStorage.getItem('home_content_data');
    if (storedContent) {
      const content = JSON.parse(storedContent);
      return format === 'frontend' 
        ? ('welcome_title' in content ? convertDbToFrontend(content) : content)
        : ('welcomeTitle' in content ? convertFrontendToDb(content) : content);
    }
  } catch (error) {
    console.error('[homeContentUtils] Error reading from localStorage:', error);
  }
  return null;
};

// Helper for saving content to localStorage
export const saveHomeContentToLocalStorage = (content: HomeContentData | HomeContentDataDB, isAdminSaved = false): void => {
  try {
    // Standardize to frontend format
    const frontendContent = 'welcome_title' in content ? convertDbToFrontend(content as HomeContentDataDB) : content as HomeContentData;
    
    // Add metadata
    const contentWithMeta = {
      ...frontendContent,
      _lastUpdated: Date.now(),
      _savedByAdmin: isAdminSaved
    };
    
    // Save to localStorage
    localStorage.setItem('home_content_data', JSON.stringify(contentWithMeta));
    localStorage.setItem('home_content_updated', Date.now().toString());
  } catch (error) {
    console.error('[homeContentUtils] Error saving to localStorage:', error);
  }
};

// Helper for triggering an update event
export const triggerHomeContentUpdateEvent = (content: HomeContentData): void => {
  window.dispatchEvent(new CustomEvent('homeContent:updated', {
    detail: {
      source: 'direct_update',
      fullContent: content
    }
  }));
};

interface HomeContentFetchOptions {
  showNotification?: boolean;
  source?: string;
  fullContent?: HomeContentData;
  skipRefresh?: boolean;
}

export function useHomeContent() {
  const [homeContent, setHomeContent] = useState<HomeContentData>(defaultHomeContent);
  const [loading, setLoading] = useState<boolean>(false);
  const [error, setError] = useState<string | null>(null);
  
  const { socket } = useSocket();
  const pendingFetchRef = useRef<boolean>(false);
  const { canMakeRequest } = useRequestLimiter();
  
  // Fetch latest home content from server
  const fetchLatestHomeContent = useCallback(async (options: HomeContentFetchOptions = {}) => {
    // 强化请求限制检查 - 除初始加载外都检查
    if (options.source !== 'initial_load' && !canMakeRequest()) {
      console.log('[useHomeContent] 请求被限制，跳过首页内容获取');
      return;
    }
    
    // Add enhanced loop detection at the beginning of the function
    if (detectLoop('homeContent', 3, 8000) || isBlocked('homeContent')) {
      console.error('[useHomeContent] Detected potential infinite loop in content fetching. Breaking cycle.');
      setError('操作过于频繁，请稍后再试');
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
      console.log(`[useHomeContent] Global cooldown active (${now - globalLastUpdate}ms < ${globalCooldown}ms). Skipping update.`);
      return;
    }
    
    // If the source is admin_direct or we have a forced reload flag, bypass throttling but not loop detection
    const isAdminDirectUpdate = options.source === 'admin_direct' || options.source === 'admin_event' || 
                               forceFullContentRefresh;
    
    if (isAdminDirectUpdate) {
      console.log(`[useHomeContent] Processing FORCED content refresh from admin`);
      // Clear all force flags to prevent loops
      sessionStorage.removeItem('forceFullContentRefresh');
      sessionStorage.removeItem('adminTriggeredUpdate');
      localStorage.removeItem('home_content_force_reload');
      
      // Still respect global cooldown
      if (now - globalLastUpdate < 1000 && pendingFetchRef.current) {
        console.log(`[useHomeContent] Preventing duplicate admin update within 1s`);
        return;
      }
    } else {
      // Regular throttling for non-admin updates
      // Prevent concurrent requests
      if (pendingFetchRef.current) {
        console.log(`[useHomeContent] Already fetching content, skipping update (source: ${options.source || 'unknown'})`);
        return;
      }
      
      // ADD PREVENTION FOR INFINITE LOOPS
      const lastFetchTimestamp = parseInt(sessionStorage.getItem('lastHomeContentFetch') || '0');
      const timeSinceLastFetch = now - lastFetchTimestamp;
      
      // If we've fetched within the last 3 seconds (except initial load), debounce
      if (options.source !== 'initial_load' && timeSinceLastFetch < 3000) {
        console.log(`[useHomeContent] Too many requests (${timeSinceLastFetch}ms since last). Debouncing.`);
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
          console.error('[useHomeContent] Detected potential infinite loop in content fetching. Breaking cycle.');
          // Reset all potential loop-causing flags
          sessionStorage.setItem('homeContentRequestCount', '0');
          sessionStorage.removeItem('forceFullContentRefresh');
          sessionStorage.removeItem('adminTriggeredUpdate');
          localStorage.removeItem('home_content_force_reload');
          // Force a wait period before allowing more fetches
          const blockUntil = now + 30000; // Block for 30 seconds
          sessionStorage.setItem('contentFetchBlocked', blockUntil.toString());
          setError('操作过于频繁，请稍后再试');
          
          // Skip refresh and prevent any additional fetches
          options.skipRefresh = true;
          return; // Exit the function early to break the loop
        }
      }
      
      // Check if we're in a blocked period
      const blockUntil = parseInt(sessionStorage.getItem('contentFetchBlocked') || '0');
      if (blockUntil > now) {
        console.log(`[useHomeContent] Content fetching blocked for ${(blockUntil - now)/1000} more seconds`);
        return;
      }
    }
    
    // Update global cooldown timestamp
    localStorage.setItem('global_home_content_last_update', now.toString());
    
    // Check for direct content from event before making a server request
    if (options.source === 'custom_event' && options.fullContent) {
      console.log('[useHomeContent] Using direct content from custom event');
      setHomeContent(options.fullContent);
      
      // Dispatch event for Layout.tsx with footer text
      window.dispatchEvent(new CustomEvent('homeContent:updated', {
        detail: { footerText: options.fullContent.footerText }
      }));
      
      // Save to localStorage for Layout component to use
      saveHomeContentToLocalStorage(options.fullContent, false);
      
      if (options.showNotification) {
        toast.success('首页内容已从管理员更新直接加载', { position: 'bottom-center' });
      }
      
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
            console.log('[useHomeContent] Found newer admin-saved content in localStorage');
            useLocalContent = true;
          }
        }
      } catch (e) {
        console.error('[useHomeContent] Error checking localStorage content metadata:', e);
      }
    }
    
    setLoading(true);
    setError(null);
    
    try {
      pendingFetchRef.current = true;
      console.log(`[useHomeContent] Fetching latest home content (source: ${options.source || 'unknown'})`);
      
      // Store timestamp of this fetch
      sessionStorage.setItem('lastHomeContentFetch', Date.now().toString());
      
      // If we need to use local content - do that directly
      if (isAdminDirectUpdate && useLocalContent && localContent) {
        console.log('[useHomeContent] ADMIN UPDATE: Using content from localStorage instead of server');
        
        // Apply the content from localStorage
        setHomeContent(localContent);
            
        // Notify Layout about the update with footer text
        window.dispatchEvent(new CustomEvent('homeContent:updated', {
          detail: { footerText: localContent.footerText }
        }));
        
        // Save to localStorage in case it wasn't already there
        saveHomeContentToLocalStorage(localContent, false);
        
        if (options.showNotification) {
          toast.info('首页内容已从本地缓存加载', { position: 'bottom-center' });
        }
        
        // Clear the force reload flag
        if (forceReloadTimestamp) {
          localStorage.removeItem('home_content_force_reload');
        }
        
        setLoading(false);
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
      
      // Add timestamp to prevent caching
      const response = await homepageService.getHomeContent(params);
      
      if (response.success && response.data) {
        console.log('[useHomeContent] Home content loaded successfully from server');
        
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
            console.log('[useHomeContent] Local content is newer than server content, using local content');
            setHomeContent(localContent);
            
            // Save this to localStorage for Layout.tsx to use
            saveHomeContentToLocalStorage(localContent, false);
          } else {
            // Server content is newer or there is no local content
            console.log('[useHomeContent] Using server content');
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
          console.log('[useHomeContent] Admin update detected - forcing content refresh');
          
          // Notify Layout about the update with footer text
          window.dispatchEvent(new CustomEvent('homeContent:updated', {
            detail: { footerText: processedData.footerText }
          }));
          
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
        } else {
          // Regular content changes - check if there's a difference
          const currentContent = JSON.stringify(homeContent);
          const newContent = JSON.stringify(processedData);
          const hasChanged = currentContent !== newContent;
          
          if (hasChanged) {
            console.log('[useHomeContent] Home content has changed, updating state');
            
            // Notify Layout about the update with footer text
            window.dispatchEvent(new CustomEvent('homeContent:updated', {
              detail: { footerText: processedData.footerText }
            }));
            
            // Show notification if requested
            if (options.showNotification) {
              toast.success('首页内容已更新', { position: 'bottom-center' });
            }
          } else {
            console.log('[useHomeContent] Home content unchanged, skipping update');
          }
        }
      } else {
        console.error('[useHomeContent] Failed to get home content from server:', response.message);
        setError('无法从服务器获取首页内容');
        
        // Use localStorage content as fallback if server fails
        if (localContent) {
          console.log('[useHomeContent] Using localStorage content as fallback');
          setHomeContent(localContent);
          
          if (options.showNotification) {
            toast.warning('服务器连接失败，使用本地缓存的内容', { position: 'bottom-center' });
          }
          
          // Notify Layout about the update with footer text from fallback content
          window.dispatchEvent(new CustomEvent('homeContent:updated', {
            detail: { footerText: localContent.footerText }
          }));
        }
      }
    } catch (error) {
      console.error('[useHomeContent] Error fetching home content:', error);
      setError('获取首页内容时发生错误');
      
      // Use localStorage content as fallback if server fetch throws an error
      if (localContent) {
        console.log('[useHomeContent] Server error - using localStorage content as fallback');
        setHomeContent(localContent);
        
        if (options.showNotification) {
          toast.warning('服务器错误，使用本地缓存的内容', { position: 'bottom-center' });
        }
        
        // Notify Layout about the update with footer text from fallback content
        window.dispatchEvent(new CustomEvent('homeContent:updated', {
          detail: { footerText: localContent.footerText }
        }));
      }
      
      // Clear any admin update flags on error to prevent infinite loops
      sessionStorage.removeItem('adminTriggeredUpdate');
      sessionStorage.removeItem('forceFullContentRefresh');
      localStorage.removeItem('home_content_force_reload');
    } finally {
      setLoading(false);
      pendingFetchRef.current = false;
    }
  }, [homeContent, canMakeRequest]);

  // Handle socket events for home content updates
  useEffect(() => {
    if (!socket) return;
    
    console.log('[useHomeContent] Setting up Socket listener for admin content updates');
    
    const handleAdminHomeContentUpdated = (data: any) => {
      console.log('[useHomeContent] Received admin home content update event:', data);
      
      // 检查数据格式并标准化
      let contentData: any = data.content || data;
      let contentType = data.type || 'general';
      let action = data.action || 'updated';
      
      // Check if this is a duplicate event (using timestamp comparison)
      const lastEventTime = parseInt(sessionStorage.getItem('lastAdminContentEvent') || '0', 10);
      const now = Date.now();
      const isTooFrequent = now - lastEventTime < 2000;
      
      if (isTooFrequent) {
        console.log('[useHomeContent] Ignoring duplicate admin content event (too frequent)');
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
        console.log('[useHomeContent] Direct state update with content from socket event');
        setHomeContent(processedContent);
        
        // Notify Layout directly about the update with footer text
        window.dispatchEvent(new CustomEvent('homeContent:updated', {
          detail: { footerText: processedContent.footerText }
        }));
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
          console.log(`[useHomeContent] Skipping content fetch - too recent (${timeSinceLastFetch}ms ago)`);
        }
      }
    };
    
    // Listen for admin content updates
    socket.on('admin:homeContent:updated', handleAdminHomeContentUpdated);
    
    return () => {
      socket.off('admin:homeContent:updated', handleAdminHomeContentUpdated);
    };
  }, [socket, fetchLatestHomeContent]);

  // Set up admin update check
  useEffect(() => {
    // Check for force reload flag set by admin content updates
    const checkForAdminUpdates = () => {
      const forceReload = localStorage.getItem('home_content_force_reload');
      const adminTriggered = sessionStorage.getItem('adminTriggeredUpdate') === 'true';
      const forceContentRefresh = sessionStorage.getItem('forceFullContentRefresh') === 'true';
      
      if (forceReload || adminTriggered || forceContentRefresh) {
        console.log('[useHomeContent] Detected admin force reload flag, fetching latest content');
        
        // 首先尝试从本地存储获取内容
        const localContent = getHomeContentFromLocalStorage('frontend') as HomeContentData | null;
        
        // 如果存在本地内容，立即使用，然后再发起服务器请求
        if (localContent) {
          // 立即应用本地内容
          setHomeContent(localContent);
          
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
    
    // Set up interval to periodically check for admin updates
    const intervalId = setInterval(checkForAdminUpdates, 5000);
    
    return () => {
      clearInterval(intervalId);
    };
  }, [fetchLatestHomeContent]);

  // Initialize home content on mount
  useEffect(() => {
    // 添加防止重复加载的检查
    const initialLoadAttempt = parseInt(sessionStorage.getItem('initialLoadAttempt') || '0', 10);
    const now = Date.now();
    
    // 如果10秒内尝试过初始加载，则跳过
    if (initialLoadAttempt && now - initialLoadAttempt < 10000) {
      console.log('[useHomeContent] 初始加载过于频繁，跳过');
      sessionStorage.setItem('initialLoadAttemptCount', 
        (parseInt(sessionStorage.getItem('initialLoadAttemptCount') || '0', 10) + 1).toString());
      return;
    }
    
    // 记录当前加载尝试时间
    sessionStorage.setItem('initialLoadAttempt', now.toString());
    
    // Track initial loading to prevent potential loops
    const alreadyLoaded = sessionStorage.getItem('initialHomeContentLoaded');
    if (alreadyLoaded === 'true') {
      console.log('[useHomeContent] Initial home content already loaded, skipping duplicate load');
      return;
    }
    
    // Initial load of home content - use skipRefresh to prevent cascading updates
    fetchLatestHomeContent({ source: 'initial_load', skipRefresh: true });
    sessionStorage.setItem('initialHomeContentLoaded', 'true');
    
    // Check localStorage for update flags
    const lastUpdate = localStorage.getItem('home_content_updated');
    const lastVisit = localStorage.getItem('home_last_visit');
    
    if (lastUpdate && (!lastVisit || parseInt(lastUpdate) > parseInt(lastVisit))) {
      console.log('[useHomeContent] Detected home content update flag in localStorage');
      fetchLatestHomeContent({ source: 'local_storage_flag', showNotification: true, skipRefresh: true });
    }
    
    // Update visit timestamp
    localStorage.setItem('home_last_visit', Date.now().toString());
    
    // Set up custom event listener for homeContent:updated events
    const handleCustomContentUpdate = (event: CustomEvent) => {
      // Use throttling to prevent rapid successive events causing loops
      if (!throttleContentFetch('customContentEvent', 3000)) {
        console.log('[useHomeContent] Throttling custom content event to prevent potential loops');
        return;
      }
      
      const now = Date.now();
      const lastEventTime = parseInt(sessionStorage.getItem('lastContentEvent') || '0');
      
      // If another event was handled less than 2 seconds ago, ignore this one
      if (now - lastEventTime < 2000) {
        console.log('[useHomeContent] Ignoring duplicate/rapid custom event');
        return;
      }
      
      // Record this event time
      sessionStorage.setItem('lastContentEvent', now.toString());
      
      console.log('[useHomeContent] Received homeContent:updated custom event');
      
      // Extract event details including potential direct content
      const detail = event.detail || {};
      const source = detail.source || 'custom_event';
      const rawFullContent = detail.fullContent;
      
      console.log(`[useHomeContent] Custom event details: source=${source}, hasFullContent=${!!rawFullContent}`);
      
      // Add skipRefresh parameter to prevent refreshing question sets if we're at risk of looping
      const shouldSkipRefresh = detectLoop('customEventRefresh', 2, 10000) || now - lastEventTime < 5000;
      
      // 如果有内容，确保格式正确
      if (rawFullContent) {
        let fullContent: HomeContentData;
        // 检查是否是数据库格式（snake_case）
        if ('welcome_title' in rawFullContent) {
          fullContent = convertDbToFrontend(rawFullContent as HomeContentDataDB);
        } else {
          fullContent = rawFullContent as HomeContentData;
        }
        
        // 直接更新状态而不是发起网络请求
        console.log('[useHomeContent] Directly updating state with event content');
        setHomeContent(fullContent);
        return;
      }
      
      // If no direct content provided, fetch from server
      const lastFetchTime = parseInt(sessionStorage.getItem('lastHomeContentFetch') || '0');
      if (now - lastFetchTime > 5000) {
        fetchLatestHomeContent({ 
          source: 'custom_event', 
          showNotification: true,
          skipRefresh: shouldSkipRefresh
        });
      } else {
        console.log(`[useHomeContent] Skipping duplicate content fetch (${now - lastFetchTime}ms since last fetch)`);
      }
    };
    
    // Add event listener with type assertion
    window.addEventListener('homeContent:updated', handleCustomContentUpdate as EventListener);
    
    return () => {
      window.removeEventListener('homeContent:updated', handleCustomContentUpdate as EventListener);
    };
  }, [fetchLatestHomeContent]);

  return {
    homeContent,
    setHomeContent,
    loading,
    error,
    fetchLatestHomeContent,
    utils: {
      convertDbToFrontend,
      convertFrontendToDb,
      getHomeContentFromLocalStorage,
      saveHomeContentToLocalStorage,
      triggerHomeContentUpdateEvent
    }
  };
}

export default useHomeContent; 