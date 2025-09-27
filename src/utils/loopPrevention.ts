const requestCounts: {[key: string]: number[]} = {};
const blockedUntil: {[key: string]: number} = {};

export function detectLoop(key: string, maxCount: number = 5, timeWindow: number = 5000): boolean {
  const now = Date.now();
  if (!requestCounts[key]) {
    requestCounts[key] = [];
  }
  requestCounts[key] = requestCounts[key].filter(time => now - time < timeWindow);
  requestCounts[key].push(now);
  if (requestCounts[key].length > maxCount) {
    console.warn(`[LoopPrevention] Possible loop detected: ${key}`);
    const blockDuration = 30000;
    blockedUntil[key] = now + blockDuration;
    requestCounts[key] = [];
    return true;
  }
  return false;
}

export function isBlocked(key: string): boolean {
  const now = Date.now();
  if (blockedUntil[key] && blockedUntil[key] > now) {
    console.log(`[LoopPrevention] Request blocked: ${key}`);
    return true;
  }
  return false;
}

export function throttleContentFetch(key: string, cooldownPeriod: number = 3000): boolean {
  if (isBlocked(key)) {
    return false;
  }
  const now = Date.now();
  const lastRequestTime = requestCounts[`${key}_last`] ? requestCounts[`${key}_last`][0] : 0;
  if (now - lastRequestTime < cooldownPeriod) {
    console.log(`[LoopPrevention] Request throttled: ${key}`);
    return false;
  }
  requestCounts[`${key}_last`] = [now];
  return true;
}

const httpRateLimiter = {
  requests: [] as number[],
  maxRequests: 1600,
  timeWindow: 60000,
  canMakeRequest() {
    const now = Date.now();
    this.requests = this.requests.filter(time => now - time < this.timeWindow);
    if (this.requests.length >= this.maxRequests) {
      console.warn(`[HTTP限流] 请求频率过高: ${this.requests.length}/${this.maxRequests} 在${this.timeWindow/1000}秒内`);
      return false;
    }
    this.requests.push(now);
    return true;
  },
  reset() {
    this.requests = [];
  }
};

export { httpRateLimiter };
export default httpRateLimiter;
