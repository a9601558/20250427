import React, { useState, useEffect, useCallback } from 'react';
import { Link } from 'react-router-dom';
import SocketStatus from './SocketStatus';
import AuthModal from './AuthModal';
import UserMenu from './UserMenu';
import { useUser } from '../contexts/UserContext';
import { homepageService } from '../services/api';
import { getHomeContentFromLocalStorage, getUserStoragePrefix } from '../utils/homeContentUtils';
import montopiLogo from '../assets/montopi-new-logo.svg';

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
  
  .footer-wave {
    position: absolute;
    top: -70px;
    left: 0;
    width: 100%;
    height: 70px;
    background-image: url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 1200 120' preserveAspectRatio='none'%3E%3Cpath d='M321.39,56.44c58-10.79,114.16-30.13,172-41.86,82.39-16.72,168.19-17.73,250.45-.39C823.78,31,906.67,72,985.66,92.83c70.05,18.48,146.53,26.09,214.34,3V0H0V27.35A600.21,600.21,0,0,0,321.39,56.44Z' fill='%23ffffff'/%3E%3C/svg%3E");
    background-size: cover;
  }
  
  @keyframes shimmer {
    0% { background-position: -200% 0; }
    100% { background-position: 200% 0; }
  }
  
  @keyframes textGlow {
    0%, 100% { text-shadow: 0 0 8px rgba(59, 130, 246, 0.3); }
    50% { text-shadow: 0 0 20px rgba(59, 130, 246, 0.6), 0 0 30px rgba(139, 92, 246, 0.3); }
  }
  
  .montopi-logo {
    filter: drop-shadow(0 2px 8px rgba(255, 140, 66, 0.2));
    transition: all 0.3s ease;
  }
  
  .montopi-logo:hover {
    filter: drop-shadow(0 4px 12px rgba(255, 140, 66, 0.3));
  }
  
  .montopi-text {
    font-family: 'Inter', -apple-system, BlinkMacSystemFont, 'Segoe UI', system-ui, sans-serif;
    font-weight: 700;
    letter-spacing: -0.02em;
    position: relative;
    background: linear-gradient(
      90deg,
      #FF6B47 0%,
      #FF8C42 25%,
      #FFB366 50%,
      #FF6B47 75%,
      #E53E3E 100%
    );
    background-size: 200% auto;
    -webkit-background-clip: text;
    -webkit-text-fill-color: transparent;
    background-clip: text;
    animation: shimmer 3s linear infinite;
  }
  
  .montopi-text:hover {
    animation: shimmer 1.5s linear infinite, textGlow 2s ease-in-out infinite;
  }
  
  .montopi-text::after {
    content: '';
    position: absolute;
    top: 0;
    left: 0;
    right: 0;
    bottom: 0;
    background: inherit;
    -webkit-background-clip: text;
    -webkit-text-fill-color: transparent;
    background-clip: text;
    opacity: 0;
    transition: opacity 0.3s ease;
  }
`;

const Layout: React.FC<LayoutProps> = ({ children }) => {
  const [isLoginModalOpen, setIsLoginModalOpen] = useState(false);
  const { user } = useUser();
  const [footerText, setFooterText] = useState<string>("");
  const [scrolled, setScrolled] = useState(false);
  
  // Handle scroll events for header effects
  useEffect(() => {
    const handleScroll = () => {
      setScrolled(window.scrollY > 10);
    };
    
    window.addEventListener('scroll', handleScroll);
    return () => window.removeEventListener('scroll', handleScroll);
  }, []);
  
  // Dark mode is now handled by ThemeContext
  
  // Simplified footer text fetching that checks if HomePage has already fetched content
  const fetchFooterText = useCallback(async (forceRefresh = false) => {
    try {
      // Get user-specific prefix
      const userPrefix = getUserStoragePrefix();
      
      // First check if HomePage has already fetched the content
      const homePageContentTimestamp = localStorage.getItem('global_home_content_last_update');
      // Use user-specific cache or fallback to global cache
      const cachedContent = getHomeContentFromLocalStorage('frontend');
      
      // If we have recent cache and it contains footer text, use it
      if (!forceRefresh && homePageContentTimestamp && cachedContent) {
        try {
          if (cachedContent && 'footerText' in cachedContent) {
            console.log('[Layout] Using footer text from user-specific HomePage cache');
            if (cachedContent.footerText !== footerText) {
              setFooterText(cachedContent.footerText);
            }
            return;
          }
        } catch (e) {
          console.error('[Layout] Error parsing cached content:', e);
        }
      }
      
      // Prevent too frequent direct API requests
      if (!forceRefresh) {
        const lastFetchKey = `${userPrefix}lastLayoutContentFetch`;
        const lastFetchTime = parseInt(sessionStorage.getItem(lastFetchKey) || '0');
        const now = Date.now();
        
        // If HomePage has fetched within last 10 seconds or Layout has fetched within last 3 seconds, debounce
        const homePageFetchTime = parseInt(homePageContentTimestamp || '0');
        if ((now - homePageFetchTime < 10000) || (now - lastFetchTime < 3000)) {
          console.log(`[Layout] Recent fetch detected. Using cached data or waiting.`);
          return;
        }
      }
      
      // Track this request with user-specific key
      sessionStorage.setItem(`${userPrefix}lastLayoutContentFetch`, Date.now().toString());
      
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
      setFooterText(`© ${new Date().getFullYear()} MonTopi Online Quiz System. All Rights Reserved.`);
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
      {/* Inject custom styles */}
      <style dangerouslySetInnerHTML={{ __html: layoutStyles }} />
      
      <header className={`sticky top-0 z-30 transition-all duration-300 ${scrolled ? 'shadow-md glass-header' : 'bg-white/90'}`}>
        <div className="container mx-auto px-4 py-3 flex justify-between items-center">
          <Link to="/" className="flex items-center group">
            <img 
              src={montopiLogo} 
              alt="MonTopi" 
              className="h-14 sm:h-16 md:h-18 lg:h-20 w-auto montopi-logo group-hover:scale-105 transition-all duration-300 max-w-none"
            />
            <span className="ml-4 text-2xl md:text-3xl lg:text-4xl montopi-text select-none tracking-wide animate-float">
              MonTopi
            </span>
          </Link>
          
          <div className="flex items-center space-x-4">
            {/* Quick navigation */}
            <nav className="hidden md:flex items-center mr-6 space-x-6">
              <Link to="/" className="text-gray-700 hover:text-blue-600 transition-colors">
                ホーム
              </Link>
              <Link to="/question-sets" className="text-gray-700 hover:text-blue-600 transition-colors">
                問題集
              </Link>
              {user && (
                <Link to="/profile" className="text-gray-700 hover:text-blue-600 transition-colors">
                  マイページ
                </Link>
              )}
            </nav>
            

            {user ? (
              <UserMenu />
            ) : (
              <button
                onClick={() => setIsLoginModalOpen(true)}
                className="inline-flex items-center px-4 py-2 border border-transparent text-sm font-medium rounded-full text-white bg-blue-600 hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500 shadow-md hover:shadow-lg transition-all"
              >
                ログイン/登録
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

      <footer className="relative bg-white py-8 border-t border-gray-200 mt-12">
        <div className="footer-wave"></div>
        <div className="container mx-auto px-4">
          <div className="flex flex-col items-center">
            <div className="flex items-center mb-4">
              <div className="text-xl font-bold text-gradient">MonTopi</div>
              <div className="ml-2 bg-blue-500 w-1.5 h-1.5 rounded-full animate-pulse"></div>
            </div>
            
            <div className="text-center text-gray-500 text-sm" 
                 dangerouslySetInnerHTML={{ __html: footerText }} />
                 
            <div className="mt-4 flex space-x-5">
              <a href="#" className="text-gray-400 hover:text-gray-500">
                <span className="sr-only">Facebook</span>
                <svg className="h-6 w-6" fill="currentColor" viewBox="0 0 24 24">
                  <path fillRule="evenodd" d="M22 12c0-5.523-4.477-10-10-10S2 6.477 2 12c0 4.991 3.657 9.128 8.438 9.878v-6.987h-2.54V12h2.54V9.797c0-2.506 1.492-3.89 3.777-3.89 1.094 0 2.238.195 2.238.195v2.46h-1.26c-1.243 0-1.63.771-1.63 1.562V12h2.773l-.443 2.89h-2.33v6.988C18.343 21.128 22 16.991 22 12z" clipRule="evenodd" />
                </svg>
              </a>
              <a href="#" className="text-gray-400 hover:text-gray-500">
                <span className="sr-only">Twitter</span>
                <svg className="h-6 w-6" fill="currentColor" viewBox="0 0 24 24">
                  <path d="M8.29 20.251c7.547 0 11.675-6.253 11.675-11.675 0-.178 0-.355-.012-.53A8.348 8.348 0 0022 5.92a8.19 8.19 0 01-2.357.646 4.118 4.118 0 001.804-2.27 8.224 8.224 0 01-2.605.996 4.107 4.107 0 00-6.993 3.743 11.65 11.65 0 01-8.457-4.287 4.106 4.106 0 001.27 5.477A4.072 4.072 0 012.8 9.713v.052a4.105 4.105 0 003.292 4.022 4.095 4.095 0 01-1.853.07 4.108 4.108 0 003.834 2.85A8.233 8.233 0 012 18.407a11.616 11.616 0 006.29 1.84" />
                </svg>
              </a>
              <a href="#" className="text-gray-400 hover:text-gray-500">
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
      <AuthModal 
        isOpen={isLoginModalOpen} 
        onClose={() => setIsLoginModalOpen(false)}
        useCognito={true}
      />
    </div>
  );
};

export default Layout; 