import { useState, useEffect, useCallback, useRef } from 'react';

interface UseQuizTimerProps {
  isActive?: boolean;
  startTime?: number;
  initialElapsedTime?: number;
}

export const useQuizTimer = ({
  isActive = false,
  startTime = 0,
  initialElapsedTime = 0
}: UseQuizTimerProps = {}) => {
  const [isTimerActive, setIsTimerActive] = useState(isActive);
  const [quizStartTime, setQuizStartTime] = useState(startTime || Date.now());
  const [elapsedTime, setElapsedTime] = useState(initialElapsedTime);
  const timerIntervalRef = useRef<NodeJS.Timeout | null>(null);
  
  // Start the timer
  const startTimer = useCallback((resetTimer = false) => {
    if (resetTimer) {
      setQuizStartTime(Date.now());
      setElapsedTime(0);
    } else if (!quizStartTime) {
      setQuizStartTime(Date.now());
    }
    
    setIsTimerActive(true);
  }, [quizStartTime]);
  
  // Stop the timer
  const stopTimer = useCallback(() => {
    setIsTimerActive(false);
  }, []);
  
  // Reset the timer
  const resetTimer = useCallback(() => {
    setQuizStartTime(Date.now());
    setElapsedTime(0);
  }, []);
  
  // Resume timer from current elapsed time
  const resumeTimer = useCallback(() => {
    // Start from current elapsed time
    setQuizStartTime(Date.now() - elapsedTime * 1000);
    setIsTimerActive(true);
  }, [elapsedTime]);
  
  // Format time as MM:SS or HH:MM:SS
  const formatTime = useCallback((seconds: number): string => {
    const hours = Math.floor(seconds / 3600);
    const minutes = Math.floor((seconds % 3600) / 60);
    const secs = Math.floor(seconds % 60);
    
    if (hours > 0) {
      return `${hours}:${minutes.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
    }
    return `${minutes}:${secs.toString().padStart(2, '0')}`;
  }, []);
  
  // Update the timer at regular intervals
  useEffect(() => {
    if (isTimerActive) {
      // Clear any existing interval
      if (timerIntervalRef.current) {
        clearInterval(timerIntervalRef.current);
      }
      
      // Set up the interval to update elapsed time every second
      timerIntervalRef.current = setInterval(() => {
        const now = Date.now();
        const elapsed = Math.floor((now - quizStartTime) / 1000);
        setElapsedTime(elapsed);
      }, 1000);
    } else if (timerIntervalRef.current) {
      // Clear interval when timer is inactive
      clearInterval(timerIntervalRef.current);
      timerIntervalRef.current = null;
    }
    
    // Clean up on unmount
    return () => {
      if (timerIntervalRef.current) {
        clearInterval(timerIntervalRef.current);
        timerIntervalRef.current = null;
      }
    };
  }, [isTimerActive, quizStartTime]);
  
  return {
    isTimerActive,
    elapsedTime,
    quizStartTime,
    startTimer,
    stopTimer,
    resetTimer,
    resumeTimer,
    formatTime
  };
}; 