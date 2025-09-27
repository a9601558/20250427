import React, { createContext, useContext, useState, useEffect, ReactNode } from 'react';

type Theme = 'light' | 'dark' | 'auto';

interface ThemeContextType {
  theme: Theme;
  isDarkMode: boolean;
  setTheme: (theme: Theme) => void;
  toggleDarkMode: () => void;
}

const ThemeContext = createContext<ThemeContextType | undefined>(undefined);

export const ThemeProvider: React.FC<{ children: ReactNode }> = ({ children }) => {
  const [theme, setTheme] = useState<Theme>(() => {
    // 优先读取localStorage中的主题设置
    const savedTheme = localStorage.getItem('theme') as Theme;
    if (savedTheme && ['light', 'dark', 'auto'].includes(savedTheme)) {
      return savedTheme;
    }
    
    // 兼容旧的darkMode设置
    const savedDarkMode = localStorage.getItem('darkMode');
    if (savedDarkMode === 'true') return 'dark';
    if (savedDarkMode === 'false') return 'light';
    
    return 'auto';
  });

  const [isDarkMode, setIsDarkMode] = useState(false);

  // 计算当前是否应该使用深色模式
  useEffect(() => {
    const updateDarkMode = () => {
      let shouldBeDark = false;
      
      switch (theme) {
        case 'dark':
          shouldBeDark = true;
          break;
        case 'light':
          shouldBeDark = false;
          break;
        case 'auto':
          shouldBeDark = window.matchMedia('(prefers-color-scheme: dark)').matches;
          break;
      }
      
      setIsDarkMode(shouldBeDark);
      
      // 应用到HTML元素
      if (shouldBeDark) {
        document.documentElement.classList.add('dark');
      } else {
        document.documentElement.classList.remove('dark');
      }
    };

    updateDarkMode();

    // 监听系统主题变化（当theme为auto时）
    if (theme === 'auto') {
      const mediaQuery = window.matchMedia('(prefers-color-scheme: dark)');
      const handleChange = () => updateDarkMode();
      
      mediaQuery.addEventListener('change', handleChange);
      return () => mediaQuery.removeEventListener('change', handleChange);
    }
  }, [theme]);

  // 保存主题设置到localStorage
  useEffect(() => {
    localStorage.setItem('theme', theme);
    // 清理旧的darkMode设置
    localStorage.removeItem('darkMode');
  }, [theme]);

  const toggleDarkMode = () => {
    setTheme(isDarkMode ? 'light' : 'dark');
  };

  return (
    <ThemeContext.Provider value={{
      theme,
      isDarkMode,
      setTheme,
      toggleDarkMode
    }}>
      {children}
    </ThemeContext.Provider>
  );
};

export const useTheme = () => {
  const context = useContext(ThemeContext);
  if (context === undefined) {
    throw new Error('useTheme must be used within a ThemeProvider');
  }
  return context;
};