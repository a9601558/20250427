import React, { useState, useEffect, useCallback } from 'react';
import { Link } from 'react-router-dom';
import SocketStatus from './SocketStatus';
import LoginModal from './LoginModal';
import UserMenu from './UserMenu';
import FirebaseErrorHandler from './FirebaseErrorHandler';
import { useUser } from '../contexts/UserContext';
import { homepageService } from '../services/api';
import { HomeContent } from '../types';
import { useSocket } from '../contexts/SocketContext';

interface LayoutProps {
  children: React.ReactNode;
}

const Layout: React.FC<LayoutProps> = ({ children }) => {
  const [isLoginModalOpen, setIsLoginModalOpen] = useState(false);
  const { user } = useUser();
  const [footerText, setFooterText] = useState<string>("");
  const { socket } = useSocket();
  
  // Improved footer text fetching with caching control
  const fetchFooterText = useCallback(async (forceRefresh = false) => {
    try {
      // Prevent too frequent requests
      if (forceRefresh) {
        const lastFetchTime = parseInt(sessionStorage.getItem('lastLayoutContentFetch') || '0');
        const now = Date.now();
        
        // If we've fetched within the last 3 seconds, debounce
        if (now - lastFetchTime < 3000) {
          console.log(`[Layout] Too many requests (${now - lastFetchTime}ms since last). Debouncing.`);
          return;
        }
        
        // Track this request
        sessionStorage.setItem('lastLayoutContentFetch', now.toString());
      }
      
      console.log('[Layout] Fetching footer text' + (forceRefresh ? ' (forced refresh)' : ''));
      
      // Add cache-busting params when force refreshing
      const params: Record<string, any> = forceRefresh ? 
        { _timestamp: Date.now(), _nocache: true } : 
        {};
        
      const response = await homepageService.getHomeContent(params);
      
      if (response.success && response.data) {
        console.log('[Layout] Footer text fetched successfully:', response.data.footerText);
        
        // Only update if changed to avoid unnecessary renders
        if (response.data.footerText !== footerText) {
          setFooterText(response.data.footerText);
        }
        
        // Prevent event cycles if this was triggered by an event already
        // Only dispatch when explicitly refreshing and not already in an event cascade
        if (forceRefresh && !sessionStorage.getItem('handlingHomeContentEvent')) {
          // Set flag to prevent cycles
          sessionStorage.setItem('handlingHomeContentEvent', 'true');
          
          // Dispatch event
          window.dispatchEvent(new CustomEvent('homeContent:updated'));
          
          // Clear flag after a short delay
          setTimeout(() => {
            sessionStorage.removeItem('handlingHomeContentEvent');
          }, 1000);
        }
      }
    } catch (error) {
      console.error('[Layout] Failed to fetch footer text:', error);
      // Set default footer text as fallback
      setFooterText(`© ${new Date().getFullYear()} ExamTopics Online Quiz System. All Rights Reserved.`);
    }
  }, [footerText]);
  
  // Initial fetch on mount
  useEffect(() => {
    fetchFooterText();
  }, [fetchFooterText]);
  
  // Listen for Socket events for admin updates
  useEffect(() => {
    if (!socket) return;
    
    console.log('[Layout] Setting up Socket listener for admin content updates');
    
    const handleHomeContentUpdated = (data: any) => {
      console.log('[Layout] Received admin home content update event:', data);
      
      // Force refresh footer text
      fetchFooterText(true);
    };
    
    // Add Socket listener
    socket.on('admin:homeContent:updated', handleHomeContentUpdated);
    
    // Listen for custom events too (for non-Socket updates)
    const handleCustomUpdate = () => {
      console.log('[Layout] Received custom homeContent:updated event');
      fetchFooterText(true);
    };
    
    window.addEventListener('homeContent:updated', handleCustomUpdate);
    
    // Cleanup function
    return () => {
      socket.off('admin:homeContent:updated', handleHomeContentUpdated);
      window.removeEventListener('homeContent:updated', handleCustomUpdate);
    };
  }, [socket, fetchFooterText]);

  return (
    <div className="flex flex-col min-h-screen bg-gray-50">
      <header className="bg-white shadow-sm sticky top-0 z-30">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-4 flex justify-between items-center">
          <Link to="/" className="flex items-center">
            <div className="text-2xl font-bold text-blue-600">ExamTopics</div>
          </Link>
          
          <div className="flex items-center space-x-4">
            {user ? (
              <UserMenu />
            ) : (
              <button
                onClick={() => setIsLoginModalOpen(true)}
                className="inline-flex items-center px-4 py-2 border border-transparent text-sm font-medium rounded-md text-white bg-blue-600 hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500"
              >
                登录/注册
              </button>
            )}
          </div>
        </div>
      </header>

      <main className="flex-grow relative">
        {children}
      </main>

      {/* Socket连接状态指示器 */}
      <SocketStatus />

      {/* Firebase错误处理器 */}
      <FirebaseErrorHandler />

      <footer className="bg-white border-t border-gray-200 py-4">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="text-center text-gray-500 text-sm" 
               dangerouslySetInnerHTML={{ __html: footerText }} />
        </div>
      </footer>

      {/* 登录弹窗 */}
      <LoginModal 
        isOpen={isLoginModalOpen} 
        onClose={() => setIsLoginModalOpen(false)} 
      />
    </div>
  );
};

export default Layout; 