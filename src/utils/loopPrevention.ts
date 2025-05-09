/**
 * Utility functions to prevent infinite loops in the application
 */

/**
 * Throttles content fetch requests to prevent infinite loops
 * @param key Unique identifier for the throttle instance
 * @param minInterval Minimum time (ms) between requests
 * @returns true if the request should proceed, false if it should be throttled
 */
export const throttleContentFetch = (key: string = 'default', minInterval: number = 5000): boolean => {
  const now = Date.now();
  const lastFetchKey = `content_throttle_${key}`;
  const lastFetch = parseInt(localStorage.getItem(lastFetchKey) || '0');
  
  // Track call counts for diagnostic purposes
  const countKey = `content_throttle_count_${key}`;
  const count = parseInt(sessionStorage.getItem(countKey) || '0') + 1;
  sessionStorage.setItem(countKey, count.toString());
  
  // Only allow one fetch every N seconds for the same key
  if (now - lastFetch < minInterval) {
    console.error(`[THROTTLE] Content fetch for key '${key}' throttled. Last fetch was ${now - lastFetch}ms ago. Count: ${count}`);
    
    // If this is being called repeatedly, log more detailed diagnostic info
    if (count > 5) {
      console.error(`[THROTTLE] Multiple throttles detected for '${key}'. This may indicate a loop in the application.`);
      // Capture stack trace for debugging
      console.error(new Error('[THROTTLE] Call stack').stack);
    }
    
    return false;
  }
  
  // Reset the counter if we're allowing the fetch
  if (count > 1) {
    sessionStorage.setItem(countKey, '1');
  }
  
  // Update the timestamp
  localStorage.setItem(lastFetchKey, now.toString());
  return true;
};

/**
 * Detects potential infinite loops and breaks them
 * @param key Unique identifier for the loop detection
 * @param maxRequests Maximum number of requests allowed in the time window
 * @param timeWindow Time window in milliseconds
 * @returns true if a loop is detected, false otherwise
 */
export const detectLoop = (key: string = 'default', maxRequests: number = 3, timeWindow: number = 10000): boolean => {
  const now = Date.now();
  const requestsKey = `loop_requests_${key}`;
  const requestsTimeKey = `loop_time_${key}`;
  
  const requestCount = parseInt(sessionStorage.getItem(requestsKey) || '0');
  const requestsTime = parseInt(sessionStorage.getItem(requestsTimeKey) || '0');
  
  // Reset counter if it's been more than the time window since last reset
  if (now - requestsTime > timeWindow) {
    sessionStorage.setItem(requestsKey, '1');
    sessionStorage.setItem(requestsTimeKey, now.toString());
    return false;
  }
  
  // Increment counter within the time window
  const newCount = requestCount + 1;
  sessionStorage.setItem(requestsKey, newCount.toString());
  
  // If more than maxRequests in the time window, likely in a loop
  if (newCount > maxRequests) {
    console.error(`[LOOP DETECTION] Detected potential infinite loop for key '${key}'. ${newCount} requests in ${timeWindow}ms.`);
    
    // Reset counter to break the loop
    sessionStorage.setItem(requestsKey, '0');
    
    // Block future requests for a cooldown period
    const blockUntil = now + timeWindow;
    sessionStorage.setItem(`loop_blocked_${key}`, blockUntil.toString());
    
    return true;
  }
  
  return false;
};

/**
 * Checks if requests should be blocked based on previous loop detection
 * @param key Unique identifier for the loop detection
 * @returns true if requests should be blocked, false otherwise
 */
export const isBlocked = (key: string = 'default'): boolean => {
  const now = Date.now();
  const blockUntil = parseInt(sessionStorage.getItem(`loop_blocked_${key}`) || '0');
  
  if (blockUntil > now) {
    console.log(`[LOOP DETECTION] Requests for key '${key}' blocked for ${(blockUntil - now)/1000} more seconds`);
    return true;
  }
  
  return false;
}; 