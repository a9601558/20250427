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

// Add custom styles for the Layout
const layoutStyles = `
  @keyframes gradientBg {
    0% { background-position: 0% 50%; }
    50% { background-position: 100% 50%; }
    100% { background-position: 0% 50%; }
  }
  
  @keyframes float {
    0% { transform: translateY(0px); }
    50% { transform: translateY(-5px); }
    100% { transform: translateY(0px); }
  }
  
  .gradient-bg {
    background: linear-gradient(-45deg, #3b82f6, #6366f1, #8b5cf6, #ec4899);
    background-size: 400% 400%;
    animation: gradientBg 15s ease infinite;
  }
  
  .animate-float {
    animation: float 3s ease-in-out infinite;
  }
  
  .glass-header {
    backdrop-filter: blur(10px);
    -webkit-backdrop-filter: blur(10px);
    background: rgba(255, 255, 255, 0.8);
    border-bottom: 1px solid rgba(255, 255, 255, 0.1);
  }
  
  .text-gradient {
    background: linear-gradient(to right, #3b82f6, #8b5cf6);
    -webkit-background-clip: text;
    -webkit-text-fill-color: transparent;
    background-clip: text;
    text-fill-color: transparent;
  }
  
  .dark-glass {
    background: rgba(17, 24, 39, 0.8);
    backdrop-filter: blur(10px);
    -webkit-backdrop-filter: blur(10px);
  }
  
  .footer-wave {
    position: absolute;
    top: -70px;
    left: 0;
    width: 100%;
    height: 70px;
    background-image: url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 1200 120' preserveAspectRatio='none'%3E%3Cpath d='M321.39,56.44c58-10.79,114.16-30.13,172-41.86,82.39-16.72,168.19-17.73,250.45-.39C823.78,31,906.67,72,985.66,92.83c70.05,18.48,146.53,26.09,214.34,3V0H0V27.35A600.21,600.21,0,0,0,321.39,56.44Z' fill='%23ffffff'/%3E%3C/svg%3E");
    background-size: cover;
  }
`;

const Layout: React.FC<LayoutProps> = ({ children }) => {
  const [isLoginModalOpen, setIsLoginModalOpen] = useState(false);
  const { user } = useUser();
  const [footerText, setFooterText] = useState<string>("");
  const { socket } = useSocket();
  const [scrolled, setScrolled] = useState(false);
  const [darkMode, setDarkMode] = useState(() => {
    // Check local storage or system preference for dark mode
    const savedMode = localStorage.getItem('darkMode');
    return savedMode ? savedMode === 'true' : window.matchMedia('(prefers-color-scheme: dark)').matches;
  });
  
  // Handle scroll events for header effects
  useEffect(() => {
    const handleScroll = () => {
      setScrolled(window.scrollY > 10);
    };
    
    window.addEventListener('scroll', handleScroll);
    return () => window.removeEventListener('scroll', handleScroll);
  }, []);
  
  // Handle dark mode toggle
  useEffect(() => {
    if (darkMode) {
      document.documentElement.classList.add('dark');
    } else {
      document.documentElement.classList.remove('dark');
    }
    localStorage.setItem('darkMode', String(darkMode));
  }, [darkMode]);
  
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
    <div className={`flex flex-col min-h-screen ${darkMode ? 'dark bg-gray-900 text-white' : 'bg-gray-50 text-gray-900'}`}>
      {/* Inject custom styles */}
      <style dangerouslySetInnerHTML={{ __html: layoutStyles }} />
      
      <header className={`sticky top-0 z-30 transition-all duration-300 ${scrolled ? 'shadow-md glass-header dark:bg-gray-900/80' : 'bg-white/90 dark:bg-gray-900'}`}>
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-4 flex justify-between items-center">
          <Link to="/" className="flex items-center group">
            <div className="text-2xl font-bold text-gradient group-hover:scale-105 transition-transform">
              ExamTopics
            </div>
            <div className="ml-2 bg-blue-500 w-2 h-2 rounded-full animate-pulse"></div>
          </Link>
          
          <div className="flex items-center space-x-4">
            {/* Quick navigation */}
            <nav className="hidden md:flex items-center mr-6 space-x-6">
              <Link to="/" className="text-gray-700 dark:text-gray-200 hover:text-blue-600 dark:hover:text-blue-400 transition-colors">
                首页
              </Link>
              <Link to="/question-sets" className="text-gray-700 dark:text-gray-200 hover:text-blue-600 dark:hover:text-blue-400 transition-colors">
                题库
              </Link>
              {user && (
                <Link to="/profile" className="text-gray-700 dark:text-gray-200 hover:text-blue-600 dark:hover:text-blue-400 transition-colors">
                  个人中心
                </Link>
              )}
            </nav>
            
            {/* Dark mode toggle */}
            <button 
              onClick={() => setDarkMode(!darkMode)}
              className="p-2 rounded-full hover:bg-gray-100 dark:hover:bg-gray-800 transition-colors focus:outline-none"
              aria-label={darkMode ? "Switch to light mode" : "Switch to dark mode"}
            >
              {darkMode ? (
                <svg className="w-5 h-5 text-yellow-400" fill="currentColor" viewBox="0 0 20 20">
                  <path fillRule="evenodd" d="M10 2a1 1 0 011 1v1a1 1 0 11-2 0V3a1 1 0 011-1zm4 8a4 4 0 11-8 0 4 4 0 018 0zm-.464 4.95l.707.707a1 1 0 001.414-1.414l-.707-.707a1 1 0 00-1.414 1.414zm2.12-10.607a1 1 0 010 1.414l-.706.707a1 1 0 11-1.414-1.414l.707-.707a1 1 0 011.414 0zM17 11a1 1 0 100-2h-1a1 1 0 100 2h1zm-7 4a1 1 0 011 1v1a1 1 0 11-2 0v-1a1 1 0 011-1zM5.05 6.464A1 1 0 106.465 5.05l-.708-.707a1 1 0 00-1.414 1.414l.707.707zm1.414 8.486l-.707.707a1 1 0 01-1.414-1.414l.707-.707a1 1 0 011.414 1.414zM4 11a1 1 0 100-2H3a1 1 0 000 2h1z" clipRule="evenodd" />
                </svg>
              ) : (
                <svg className="w-5 h-5 text-gray-700" fill="currentColor" viewBox="0 0 20 20">
                  <path d="M17.293 13.293A8 8 0 016.707 2.707a8.001 8.001 0 1010.586 10.586z" />
                </svg>
              )}
            </button>
            
            {user ? (
              <UserMenu />
            ) : (
              <button
                onClick={() => setIsLoginModalOpen(true)}
                className="inline-flex items-center px-4 py-2 border border-transparent text-sm font-medium rounded-full text-white bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-700 hover:to-indigo-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500 shadow-md hover:shadow-lg transition-all"
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

      <footer className="relative bg-white dark:bg-gray-900 py-8 border-t border-gray-200 dark:border-gray-800 mt-12">
        <div className="footer-wave dark:hidden"></div>
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex flex-col items-center">
            <div className="flex items-center mb-4">
              <div className="text-xl font-bold text-gradient">ExamTopics</div>
              <div className="ml-2 bg-blue-500 w-1.5 h-1.5 rounded-full animate-pulse"></div>
            </div>
            
            <div className="text-center text-gray-500 dark:text-gray-400 text-sm" 
                 dangerouslySetInnerHTML={{ __html: footerText }} />
                 
            <div className="mt-4 flex space-x-5">
              <a href="#" className="text-gray-400 hover:text-gray-500 dark:hover:text-gray-300">
                <span className="sr-only">Facebook</span>
                <svg className="h-6 w-6" fill="currentColor" viewBox="0 0 24 24">
                  <path fillRule="evenodd" d="M22 12c0-5.523-4.477-10-10-10S2 6.477 2 12c0 4.991 3.657 9.128 8.438 9.878v-6.987h-2.54V12h2.54V9.797c0-2.506 1.492-3.89 3.777-3.89 1.094 0 2.238.195 2.238.195v2.46h-1.26c-1.243 0-1.63.771-1.63 1.562V12h2.773l-.443 2.89h-2.33v6.988C18.343 21.128 22 16.991 22 12z" clipRule="evenodd" />
                </svg>
              </a>
              <a href="#" className="text-gray-400 hover:text-gray-500 dark:hover:text-gray-300">
                <span className="sr-only">Twitter</span>
                <svg className="h-6 w-6" fill="currentColor" viewBox="0 0 24 24">
                  <path d="M8.29 20.251c7.547 0 11.675-6.253 11.675-11.675 0-.178 0-.355-.012-.53A8.348 8.348 0 0022 5.92a8.19 8.19 0 01-2.357.646 4.118 4.118 0 001.804-2.27 8.224 8.224 0 01-2.605.996 4.107 4.107 0 00-6.993 3.743 11.65 11.65 0 01-8.457-4.287 4.106 4.106 0 001.27 5.477A4.072 4.072 0 012.8 9.713v.052a4.105 4.105 0 003.292 4.022 4.095 4.095 0 01-1.853.07 4.108 4.108 0 003.834 2.85A8.233 8.233 0 012 18.407a11.616 11.616 0 006.29 1.84" />
                </svg>
              </a>
              <a href="#" className="text-gray-400 hover:text-gray-500 dark:hover:text-gray-300">
                <span className="sr-only">GitHub</span>
                <svg className="h-6 w-6" fill="currentColor" viewBox="0 0 24 24">
                  <path fillRule="evenodd" d="M12 2C6.477 2 2 6.484 2 12.017c0 4.425 2.865 8.18 6.839 9.504.5.092.682-.217.682-.483 0-.237-.008-.868-.013-1.703-2.782.605-3.369-1.343-3.369-1.343-.454-1.158-1.11-1.466-1.11-1.466-.908-.62.069-.608.069-.608 1.003.07 1.531 1.032 1.531 1.032.892 1.53 2.341 1.088 2.91.832.092-.647.35-1.088.636-1.338-2.22-.253-4.555-1.113-4.555-4.951 0-1.093.39-1.988 1.029-2.688-.103-.253-.446-1.272.098-2.65 0 0 .84-.27 2.75 1.026A9.564 9.564 0 0112 6.844c.85.004 1.705.115 2.504.337 1.909-1.296 2.747-1.027 2.747-1.027.546 1.379.202 2.398.1 2.651.64.7 1.028 1.595 1.028 2.688 0 3.848-2.339 4.695-4.566 4.943.359.309.678.92.678 1.855 0 1.338-.012 2.419-.012 2.747 0 .268.18.58.688.482A10.019 10.019 0 0022 12.017C22 6.484 17.522 2 12 2z" clipRule="evenodd" />
                </svg>
              </a>
            </div>
          </div>
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