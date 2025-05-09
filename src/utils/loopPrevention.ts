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
  const counterKey = `loop_counter_${key}`; // Track total occurrences for debugging
  
  const requestCount = parseInt(sessionStorage.getItem(requestsKey) || '0');
  const requestsTime = parseInt(sessionStorage.getItem(requestsTimeKey) || '0');
  const totalCount = parseInt(sessionStorage.getItem(counterKey) || '0');
  
  // Update total counter for debugging purposes
  sessionStorage.setItem(counterKey, (totalCount + 1).toString());
  
  // Check if already blocked - double check for safety
  const blockUntil = parseInt(sessionStorage.getItem(`loop_blocked_${key}`) || '0');
  if (blockUntil > now) {
    console.error(`[LOOP DETECTION] Requests for key '${key}' already blocked for ${(blockUntil - now)/1000} more seconds`);
    return true;
  }
  
  // Reset counter if it's been more than the time window since last reset
  if (now - requestsTime > timeWindow) {
    sessionStorage.setItem(requestsKey, '1');
    sessionStorage.setItem(requestsTimeKey, now.toString());
    return false;
  }
  
  // Increment counter within the time window
  const newCount = requestCount + 1;
  sessionStorage.setItem(requestsKey, newCount.toString());
  
  // Log warning when approaching threshold
  if (newCount === maxRequests) {
    console.warn(`[LOOP DETECTION] Warning: approaching loop threshold for key '${key}'. ${newCount}/${maxRequests} requests in ${now - requestsTime}ms.`);
  }
  
  // If more than maxRequests in the time window, likely in a loop
  if (newCount > maxRequests) {
    console.error(`[LOOP DETECTION] Detected potential infinite loop for key '${key}'. ${newCount} requests in ${now - requestsTime}ms. Total occurrences: ${totalCount+1}`);
    
    // Capture stack trace for debugging
    console.error(new Error('[LOOP DETECTION] Call stack').stack);
    
    // Reset counter to break the loop
    sessionStorage.setItem(requestsKey, '0');
    
    // Block future requests for a longer cooldown period (60 seconds)
    const blockUntil = now + 60000; // Increased from default timeWindow to 60 seconds
    sessionStorage.setItem(`loop_blocked_${key}`, blockUntil.toString());
    
    // Store loop detection event for analytics
    try {
      const loopEvents = JSON.parse(localStorage.getItem('loop_detection_events') || '[]');
      loopEvents.push({
        key,
        timestamp: now,
        count: newCount,
        timeWindow: now - requestsTime,
        totalCount: totalCount + 1
      });
      // Keep only last 10 events
      if (loopEvents.length > 10) {
        loopEvents.shift();
      }
      localStorage.setItem('loop_detection_events', JSON.stringify(loopEvents));
    } catch (error) {
      console.error('[LOOP DETECTION] Error storing loop event:', error);
    }
    
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