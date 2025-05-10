// HomeContent data format interfaces and utilities
// 这些应该与HomePage和Admin页面中的类型一致

/**
 * 前端使用的首页内容数据格式（驼峰命名）
 */
export interface HomeContentData {
  welcomeTitle: string;
  welcomeDescription: string;
  featuredCategories: string[];
  announcements: string;
  footerText: string;
  bannerImage?: string;
  theme?: 'light' | 'dark' | 'auto';
  _lastUpdated?: number;
  _savedByAdmin?: boolean;
}

/**
 * 数据库使用的首页内容数据格式（下划线命名）
 */
export interface HomeContentDataDB {
  welcome_title: string;
  welcome_description: string;
  featured_categories: string | string[];
  announcements: string;
  footer_text: string;
  banner_image?: string;
  theme?: 'light' | 'dark' | 'auto';
  created_at?: string;
  updated_at?: string;
  id?: number;
  _lastUpdated?: number;
  _savedByAdmin?: boolean;
}

/**
 * 默认首页内容
 */
export const defaultHomeContent: HomeContentData = {
  welcomeTitle: "Exam7 模拟练习",
  welcomeDescription: "选择以下任一题库开始练习，测试您的知识水平",
  featuredCategories: ["Aws", "sap", "oracle"],
  announcements: "欢迎使用在线题库系统，新增题库将定期更新，请持续关注！",
  footerText: "© 2023 Exam7 在线题库系统 保留所有权利",
  bannerImage: "https://via.placeholder.com/1500x500/4F46E5/FFFFFF?text=考试练习系统",
  theme: 'light'
};

/**
 * 将数据库格式转换为前端格式
 */
export const convertDbToFrontend = (dbData: HomeContentDataDB): HomeContentData => {
  // 确保featured_categories是数组
  let featuredCategories: string[] = [];
  if (typeof dbData.featured_categories === 'string') {
    try {
      featuredCategories = JSON.parse(dbData.featured_categories);
    } catch (e) {
      console.error('[HomeContentUtils] 解析featuredCategories失败:', e);
      featuredCategories = [];
    }
  } else if (Array.isArray(dbData.featured_categories)) {
    featuredCategories = dbData.featured_categories;
  }

  return {
    welcomeTitle: dbData.welcome_title || defaultHomeContent.welcomeTitle,
    welcomeDescription: dbData.welcome_description || defaultHomeContent.welcomeDescription,
    featuredCategories,
    announcements: dbData.announcements || defaultHomeContent.announcements,
    footerText: dbData.footer_text || defaultHomeContent.footerText,
    bannerImage: dbData.banner_image || defaultHomeContent.bannerImage,
    theme: dbData.theme || defaultHomeContent.theme,
    _lastUpdated: dbData._lastUpdated,
    _savedByAdmin: dbData._savedByAdmin
  };
};

/**
 * 将前端格式转换为数据库格式
 */
export const convertFrontendToDb = (frontendData: HomeContentData): HomeContentDataDB => {
  return {
    welcome_title: frontendData.welcomeTitle,
    welcome_description: frontendData.welcomeDescription,
    featured_categories: JSON.stringify(frontendData.featuredCategories),
    announcements: frontendData.announcements,
    footer_text: frontendData.footerText,
    banner_image: frontendData.bannerImage,
    theme: frontendData.theme,
    _lastUpdated: frontendData._lastUpdated,
    _savedByAdmin: frontendData._savedByAdmin
  };
};

/**
 * 保存首页内容到localStorage
 * @param content 可以是前端格式或数据库格式
 * @param isAdminSave 是否是管理员保存的内容
 */
export const saveHomeContentToLocalStorage = (
  content: HomeContentData | HomeContentDataDB, 
  isAdminSave = false
): void => {
  try {
    // 标准化为数据库格式
    const dbFormat = 'welcome_title' in content 
      ? { ...content } 
      : convertFrontendToDb(content);
    
    // 添加元数据
    dbFormat._lastUpdated = Date.now();
    if (isAdminSave) {
      dbFormat._savedByAdmin = true;
    }
    
    // 保存到localStorage
    localStorage.setItem('home_content_data', JSON.stringify(dbFormat));
    localStorage.setItem('home_content_updated', String(Date.now()));
    
    // 设置会话标记，便于其他页面检测更改
    sessionStorage.setItem('adminSavedContentTimestamp', String(Date.now()));
    
    console.log('[HomeContentUtils] 内容已保存到localStorage:', dbFormat);
  } catch (e) {
    console.error('[HomeContentUtils] 保存内容到localStorage失败:', e);
  }
};

/**
 * 从localStorage获取首页内容
 * @param format 返回的格式，默认为前端格式
 */
export const getHomeContentFromLocalStorage = (
  format: 'frontend' | 'db' = 'frontend'
): HomeContentData | HomeContentDataDB | null => {
  try {
    const storedContent = localStorage.getItem('home_content_data');
    if (!storedContent) return null;
    
    const parsedContent = JSON.parse(storedContent);
    
    // 检查是数据库格式还是前端格式
    const isDbFormat = 'welcome_title' in parsedContent;
    
    if (format === 'frontend') {
      return isDbFormat 
        ? convertDbToFrontend(parsedContent) 
        : parsedContent;
    } else {
      return isDbFormat 
        ? parsedContent 
        : convertFrontendToDb(parsedContent);
    }
  } catch (e) {
    console.error('[HomeContentUtils] 从localStorage获取内容失败:', e);
    return null;
  }
};

/**
 * 触发首页内容更新事件
 * @param content 更新的内容，可选
 * @param source 更新来源
 */
export const triggerHomeContentUpdateEvent = (
  content?: HomeContentData | HomeContentDataDB,
  source: string = 'custom'
): void => {
  try {
    // 如果提供了内容，确保使用前端格式
    const processedContent = content 
      ? ('welcome_title' in content ? convertDbToFrontend(content) : content)
      : undefined;
    
    // 创建并派发事件
    const event = new CustomEvent('homeContent:updated', {
      detail: {
        source,
        fullContent: processedContent,
        timestamp: Date.now()
      }
    });
    
    window.dispatchEvent(event);
    console.log(`[HomeContentUtils] 已触发homeContent:updated事件 (source: ${source})`);
  } catch (e) {
    console.error('[HomeContentUtils] 触发更新事件失败:', e);
  }
}; 