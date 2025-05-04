/**
 * Formats a time in seconds into a readable string format
 * @param seconds Time in seconds to format
 * @returns Formatted time string (e.g. "5m 30s" or "1h 5m 30s")
 */
export const formatTime = (seconds: number): string => {
  const hours = Math.floor(seconds / 3600);
  const minutes = Math.floor((seconds % 3600) / 60);
  const secs = Math.floor(seconds % 60);
  
  if (hours > 0) {
    return `${hours}h ${minutes}m ${secs}s`;
  }
  return `${minutes}m ${secs}s`;
}; 