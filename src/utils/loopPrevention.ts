/**
 * Utility functions for preventing infinite loops and throttling API calls
 */

interface LoopRecord {
  count: number;
  firstTimestamp: number;
  lastTimestamp: number;
  isBlocked: boolean;
  blockUntil: number;
}

// Store loop detection records
const loopRecords: Record<string, LoopRecord> = {};

/**
 * Detects potential infinite loops by tracking the frequency of calls
 * @param key - Unique identifier for the operation
 * @param maxCount - Maximum number of calls allowed in the time window
 * @param timeWindow - Time window in milliseconds
 * @returns true if a potential loop is detected, false otherwise
 */
export const detectLoop = (key: string, maxCount: number = 3, timeWindow: number = 10000): boolean => {
  const now = Date.now();
  
  // Initialize record if it doesn't exist
  if (!loopRecords[key]) {
    loopRecords[key] = {
      count: 1,
      firstTimestamp: now,
      lastTimestamp: now,
      isBlocked: false,
      blockUntil: 0
    };
    return false;
  }
  
  const record = loopRecords[key];
  
  // If we're already in a blocked state, extend the block time
  if (record.isBlocked) {
    record.blockUntil = now + 30000; // Block for 30 seconds
    console.error(`[LoopPrevention] ${key}: Already blocked, extending block time`);
    return true;
  }
  
  // Update the record
  record.count += 1;
  record.lastTimestamp = now;
  
  // Check if we're within the time window
  const timeSinceFirst = now - record.firstTimestamp;
  
  // If we've exceeded the allowed calls within the time window, block future calls
  if (timeSinceFirst <= timeWindow && record.count >= maxCount) {
    record.isBlocked = true;
    record.blockUntil = now + 30000; // Block for 30 seconds
    console.error(`[LoopPrevention] ${key}: Loop detected! ${record.count} calls in ${timeSinceFirst}ms - blocking for 30 seconds`);
    return true;
  }
  
  // If we're outside the time window, reset the counter
  if (timeSinceFirst > timeWindow) {
    record.count = 1;
    record.firstTimestamp = now;
  }
  
  return false;
};

/**
 * Checks if an operation is currently blocked due to loop detection
 * @param key - Unique identifier for the operation
 * @returns true if blocked, false otherwise
 */
export const isBlocked = (key: string): boolean => {
  const record = loopRecords[key];
  if (!record || !record.isBlocked) {
    return false;
  }
  
  const now = Date.now();
  
  // If the block time has expired, remove the block
  if (now > record.blockUntil) {
    record.isBlocked = false;
    record.count = 0;
    record.firstTimestamp = now;
    return false;
  }
  
  return true;
};

/**
 * Throttles function calls by returning false if called too frequently
 * @param key - Unique identifier for the operation
 * @param minInterval - Minimum time between allowed calls in milliseconds
 * @returns true if the call should proceed, false if it should be throttled
 */
export const throttleContentFetch = (key: string, minInterval: number = 3000): boolean => {
  const now = Date.now();
  const lastCall = parseInt(sessionStorage.getItem(`throttle_${key}`) || '0', 10);
  
  if (now - lastCall < minInterval) {
    console.log(`[LoopPrevention] Throttling ${key}: Too soon (${now - lastCall}ms < ${minInterval}ms)`);
    return false;
  }
  
  sessionStorage.setItem(`throttle_${key}`, now.toString());
  return true;
};

/**
 * Resets all throttling and loop detection for a specific key
 * @param key - Unique identifier for the operation to reset
 */
export const resetPrevention = (key: string): void => {
  if (loopRecords[key]) {
    delete loopRecords[key];
  }
  sessionStorage.removeItem(`throttle_${key}`);
  console.log(`[LoopPrevention] Reset prevention for ${key}`);
}; 