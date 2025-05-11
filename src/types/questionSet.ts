// 题库访问类型
export type AccessType = 'trial' | 'paid' | 'expired' | 'redeemed';

// 基础题库类型
export interface BaseQuestionSet {
  id: string;
  title: string;
  description: string;
  category: string;
  icon: string;
  isPaid: boolean;
  price: number | null;
  trialQuestions: number | null;
  questionCount?: number;
  isFeatured: boolean;
  featuredCategory?: string; // 添加精选分类属性
  createdAt: Date;
  updatedAt: Date;
  hasAccess?: boolean;
  remainingDays?: number | null;
  paymentMethod?: string;
  questions?: { id: string }[];
  questionSetQuestions?: { id: string }[];
  validityPeriod?: number; // 题库有效期，以天为单位
  cardImage?: string; // 添加题库卡片图片字段
}

// 扩展题库类型，添加访问类型
export interface PreparedQuestionSet extends BaseQuestionSet {
  accessType: AccessType;
  remainingDays: number | null;
  validityPeriod: number;
  featuredCategory?: string; // 添加精选分类字段
  cardImage?: string; // 添加题库卡片图片字段
}

// Home Content related types
export interface HomeContentDataDB {
  welcome_title: string;
  welcome_description: string;
  announcements: string | null;
  featured_categories: string[] | string;
  footer_text: string | null;
}

export interface HomeContentData {
  welcomeTitle: string;
  welcomeDescription: string;
  announcements: string | null;
  featuredCategories: string[];
  footerText: string | null;
}

export const defaultHomeContent: HomeContentData = {
  welcomeTitle: "欢迎来到在线考试中心",
  welcomeDescription: "选择下面的题库开始练习，提升你的专业技能",
  announcements: null,
  featuredCategories: [],
  footerText: null
}; 