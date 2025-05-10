import React, { useState, useEffect, useCallback } from 'react';
import { Link } from 'react-router-dom';
import SocketStatus from './SocketStatus';
import LoginModal from './LoginModal';
import UserMenu from './UserMenu';
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
  
  // Simplified footer text fetching that checks if HomePage has already fetched content
  const fetchFooterText = useCallback(async (forceRefresh = false) => {
    try {
      // First check if HomePage has already fetched the content
      const homePageContentTimestamp = localStorage.getItem('global_home_content_last_update');
      const cachedContent = localStorage.getItem('home_content_data');
      
      // If we have recent cache and it contains footer text, use it
      if (!forceRefresh && homePageContentTimestamp && cachedContent) {
        try {
          const parsedContent = JSON.parse(cachedContent);
          if (parsedContent && parsedContent.footerText) {
            console.log('[Layout] Using footer text from HomePage cache');
            if (parsedContent.footerText !== footerText) {
              setFooterText(parsedContent.footerText);
            }
            return;
          }
        } catch (e) {
          console.error('[Layout] Error parsing cached content:', e);
        }
      }
      
      // Prevent too frequent direct API requests
      if (!forceRefresh) {
        const lastFetchTime = parseInt(sessionStorage.getItem('lastLayoutContentFetch') || '0');
        const now = Date.now();
        
        // If HomePage has fetched within last 10 seconds or Layout has fetched within last 3 seconds, debounce
        const homePageFetchTime = parseInt(homePageContentTimestamp || '0');
        if ((now - homePageFetchTime < 10000) || (now - lastFetchTime < 3000)) {
          console.log(`[Layout] Recent fetch detected. Using cached data or waiting.`);
          return;
        }
      }
      
      // Track this request
      sessionStorage.setItem('lastLayoutContentFetch', Date.now().toString());
      
      console.log('[Layout] Fetching footer text' + (forceRefresh ? ' (forced refresh)' : ''));
      
      // Add cache-busting params when force refreshing
      const params: Record<string, any> = forceRefresh ? 
        { _timestamp: Date.now(), _nocache: true, _footerOnly: true } : 
        { _footerOnly: true };  // Signal we only need footer data
        
      const response = await homepageService.getHomeContent(params);
      
      if (response.success && response.data) {
        console.log('[Layout] Footer text fetched successfully');
        
        // Only update if changed to avoid unnecessary renders
        if (response.data.footerText !== footerText) {
          setFooterText(response.data.footerText);
        }
        
        // Don't trigger events from Layout to avoid creating loops
        // HomePage is the primary handler of content updates
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
  
  // Listen for HomeContent updates from HomePage
  useEffect(() => {
    // Listen for custom events (for updates triggered by HomePage)
    const handleCustomUpdate = (event: Event) => {
      const customEvent = event as CustomEvent;
      console.log('[Layout] Received homeContent:updated event');
      
      // Check if event has footer text data directly
      if (customEvent.detail?.footerText) {
        console.log('[Layout] Using footer text directly from event');
        setFooterText(customEvent.detail.footerText);
      } else {
        // Otherwise just refresh from cache
        setTimeout(() => fetchFooterText(false), 100);
      }
    };
    
    window.addEventListener('homeContent:updated', handleCustomUpdate);
    
    // Cleanup function
    return () => {
      window.removeEventListener('homeContent:updated', handleCustomUpdate);
    };
  }, [fetchFooterText]);

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