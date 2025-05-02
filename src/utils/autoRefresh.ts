export const initAutoRefresh = (intervalMs: number) => {
  setInterval(() => {
    window.location.reload();
  }, intervalMs);
}; 
