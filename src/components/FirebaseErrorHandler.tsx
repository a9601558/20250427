import React, { useState, useEffect } from 'react';
import { disableFirebase } from '../config/firebase';

/**
 * Firebase 错误处理组件，检测并提供恢复选项
 */
const FirebaseErrorHandler: React.FC = () => {
  const [hasFirebaseError, setHasFirebaseError] = useState(false);
  const [errorCount, setErrorCount] = useState(0);
  const [showBanner, setShowBanner] = useState(false);

  // 检查控制台错误
  useEffect(() => {
    // 拦截 console.error 以检测 Firebase 错误
    const originalError = console.error;
    
    console.error = (...args) => {
      // 检查是否是 Firebase 错误
      const errorText = args.map(arg => String(arg)).join(' ');
      if (
        errorText.includes('firebase') || 
        errorText.includes('firestore') || 
        errorText.includes('examtopics-app') ||
        errorText.includes('googleapis.com')
      ) {
        setErrorCount(prev => prev + 1);
        
        // 如果短时间内有多个错误，显示横幅
        if (errorCount > 2) {
          setHasFirebaseError(true);
          
          // 如果错误超过阈值，自动禁用 Firebase
          if (errorCount > 10) {
            handleDisableFirebase();
          }
        }
      }
      
      // 调用原始的 console.error
      originalError.apply(console, args);
    };
    
    // 检查网络请求错误
    const errorListener = (event: ErrorEvent) => {
      if (
        event.message.includes('firebase') || 
        event.filename?.includes('firestore') || 
        event.message.includes('examtopics-app')
      ) {
        setErrorCount(prev => prev + 1);
        if (errorCount > 2) {
          setHasFirebaseError(true);
        }
      }
    };
    
    window.addEventListener('error', errorListener);
    
    // 如果已经在本地存储中有 Firebase 错误记录，直接显示横幅
    try {
      const storedError = localStorage.getItem('app_firebase_error');
      if (storedError) {
        const errorData = JSON.parse(storedError);
        // 只显示最近24小时的错误
        if (Date.now() - errorData.timestamp < 24 * 60 * 60 * 1000) {
          setHasFirebaseError(true);
        }
      }
    } catch (e) {
      // 忽略存储错误
    }
    
    // 清理函数
    return () => {
      console.error = originalError;
      window.removeEventListener('error', errorListener);
    };
  }, [errorCount]);
  
  // 显示错误横幅的延迟效果
  useEffect(() => {
    if (hasFirebaseError) {
      const timer = setTimeout(() => {
        setShowBanner(true);
      }, 2000);
      
      return () => clearTimeout(timer);
    }
  }, [hasFirebaseError]);
  
  // 处理禁用 Firebase 的操作
  const handleDisableFirebase = () => {
    if (disableFirebase()) {
      // 显示成功消息
      alert('Firebase 服务已被禁用。请刷新页面以应用更改。');
      // 3秒后刷新页面
      setTimeout(() => {
        window.location.reload();
      }, 3000);
    } else {
      alert('无法禁用 Firebase 服务。请尝试清除浏览器缓存并重试。');
    }
  };
  
  if (!showBanner) return null;
  
  return (
    <div className="fixed bottom-4 right-4 z-50 max-w-sm bg-white dark:bg-gray-800 rounded-lg shadow-lg border border-red-200 dark:border-red-900 overflow-hidden">
      <div className="p-4">
        <div className="flex items-start">
          <div className="flex-shrink-0">
            <svg className="h-6 w-6 text-red-500" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
            </svg>
          </div>
          <div className="ml-3 w-0 flex-1 pt-0.5">
            <p className="text-sm font-medium text-gray-900 dark:text-gray-100">Firebase 连接错误</p>
            <p className="mt-1 text-sm text-gray-500 dark:text-gray-400">
              应用程序遇到了与 Firebase 服务的连接问题。这可能会影响某些功能，但不会影响主要使用。
            </p>
            <div className="mt-3 flex space-x-3">
              <button
                onClick={handleDisableFirebase}
                className="rounded-md bg-red-100 dark:bg-red-900 px-3 py-2 text-sm font-medium text-red-800 dark:text-red-200 hover:bg-red-200 dark:hover:bg-red-800 transition-colors"
              >
                禁用 Firebase
              </button>
              <button
                onClick={() => setShowBanner(false)}
                className="rounded-md bg-gray-100 dark:bg-gray-700 px-3 py-2 text-sm font-medium text-gray-800 dark:text-gray-200 hover:bg-gray-200 dark:hover:bg-gray-600 transition-colors"
              >
                忽略
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default FirebaseErrorHandler; 