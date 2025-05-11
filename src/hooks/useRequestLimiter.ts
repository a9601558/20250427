import { useCallback, useRef } from 'react';
import { httpLimiter } from '../utils/loopPrevention';

interface UseRequestLimiterOptions {
  requestsPerMinute?: number;
  cooldownMs?: number;
}

export function useRequestLimiter(options: UseRequestLimiterOptions = {}) {
  const {
    requestsPerMinute = 20,
    cooldownMs = 5000, // 5 seconds cooldown between frequent requests
  } = options;
  
  // Track request history
  const lastApiRequestTime = useRef<number>(0);
  const recentRequests = useRef<number[]>([]);
  
  // Check if a request can be made based on rate limits
  const canMakeRequest = useCallback(() => {
    // Use the external limiter if available
    if (httpLimiter && typeof httpLimiter.canMakeRequest === 'function') {
      return httpLimiter.canMakeRequest();
    }
    
    const now = Date.now();
    
    // Check cooldown period - simple throttling
    if (now - lastApiRequestTime.current < cooldownMs) {
      console.log(`[useRequestLimiter] Throttled: Last request was ${(now - lastApiRequestTime.current)/1000}s ago (cooldown: ${cooldownMs/1000}s)`);
      return false;
    }
    
    // Update recent requests - remove requests older than 1 minute
    const oneMinuteAgo = now - 60000;
    recentRequests.current = recentRequests.current.filter(time => time > oneMinuteAgo);
    
    // Check if we've hit the rate limit
    if (recentRequests.current.length >= requestsPerMinute) {
      console.log(`[useRequestLimiter] Rate limited: ${recentRequests.current.length} requests in the last minute (limit: ${requestsPerMinute})`);
      return false;
    }
    
    // Update tracking for this approved request
    recentRequests.current.push(now);
    lastApiRequestTime.current = now;
    
    return true;
  }, [cooldownMs, requestsPerMinute]);
  
  // Record a request was made even if not checked through canMakeRequest
  const recordRequest = useCallback(() => {
    const now = Date.now();
    recentRequests.current.push(now);
    lastApiRequestTime.current = now;
    
    // Clean up old requests
    const oneMinuteAgo = now - 60000;
    recentRequests.current = recentRequests.current.filter(time => time > oneMinuteAgo);
  }, []);
  
  // Get current request stats
  const getRequestStats = useCallback(() => {
    const now = Date.now();
    const oneMinuteAgo = now - 60000;
    const activeRequests = recentRequests.current.filter(time => time > oneMinuteAgo);
    
    return {
      recentRequestCount: activeRequests.length,
      timeSinceLastRequest: now - lastApiRequestTime.current,
      isThrottled: now - lastApiRequestTime.current < cooldownMs,
      isRateLimited: activeRequests.length >= requestsPerMinute
    };
  }, [cooldownMs, requestsPerMinute]);
  
  // Reset all limits - use with caution
  const resetLimits = useCallback(() => {
    recentRequests.current = [];
    lastApiRequestTime.current = 0;
  }, []);
  
  return {
    canMakeRequest,
    recordRequest,
    getRequestStats,
    resetLimits
  };
}

export default useRequestLimiter; 