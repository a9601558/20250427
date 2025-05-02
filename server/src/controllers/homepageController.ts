import { Request, Response } from 'express';
import HomepageSettings from '../models/HomepageSettings';
import QuestionSet from '../models/QuestionSet';

interface HomeContent {
  welcomeTitle: string;
  welcomeDescription: string;
  featuredCategories: string[];
  announcements: string;
  footerText: string;
  bannerImage?: string | null;
  theme?: 'light' | 'dark' | 'auto';
}

/**
 * @desc    获取首页配置
 * @route   GET /api/homepage/content
 * @access  Public
 */
export const getHomepageContent = async (req: Request, res: Response) => {
  try {
    // 获取存储在数据库中的首页配置
    const settings = await HomepageSettings.findByPk(1);

    // 如果没有配置，返回默认配置
    if (!settings) {
      const defaultContent: HomeContent = {
        welcomeTitle: 'ExamTopics 模拟练习',
        welcomeDescription: '选择以下任一题库开始练习，测试您的知识水平',
        featuredCategories: ['网络协议', '编程语言', '计算机基础'],
        announcements: '欢迎使用在线题库系统，新增题库将定期更新，请持续关注！',
        footerText: '© 2023 ExamTopics 在线题库系统 保留所有权利',
        bannerImage: '/images/banner.jpg',
        theme: 'light',
      };
      
      return res.status(200).json({
        success: true,
        data: defaultContent,
      });
    }

    // 将配置转换为HomeContent格式
    const content: HomeContent = {
      welcomeTitle: settings.welcome_title,
      welcomeDescription: settings.welcome_description,
      featuredCategories: settings.featured_categories || [],
      announcements: settings.announcements,
      footerText: settings.footer_text,
      bannerImage: settings.banner_image,
      theme: settings.theme,
    };

    res.status(200).json({
      success: true,
      data: content,
    });
  } catch (error: any) {
    console.error('获取首页配置失败:', error);
    res.status(500).json({
      success: false,
      message: '获取首页配置失败',
      error: error.message,
    });
  }
};

/**
 * @desc    更新首页配置
 * @route   PUT /api/homepage/content
 * @access  Admin
 */
export const updateHomepageContent = async (req: Request, res: Response) => {
  try {
    const {
      welcomeTitle,
      welcomeDescription,
      featuredCategories,
      announcements,
      footerText,
      bannerImage,
      theme,
    } = req.body;

    // 查找是否已存在配置
    let settings = await HomepageSettings.findByPk(1);

    if (!settings) {
      // 不存在，创建新配置
      settings = await HomepageSettings.create({
        id: 1,
        welcome_title: welcomeTitle,
        welcome_description: welcomeDescription,
        featured_categories: featuredCategories,
        announcements: announcements,
        footer_text: footerText,
        banner_image: bannerImage || null,
        theme: theme || 'light',
      });
    } else {
      // 更新现有配置
      await settings.update({
        welcome_title: welcomeTitle,
        welcome_description: welcomeDescription,
        featured_categories: featuredCategories,
        announcements: announcements,
        footer_text: footerText,
        banner_image: bannerImage || null,
        theme: theme || 'light',
      });
    }

    res.status(200).json({
      success: true,
      message: '首页配置更新成功',
    });
  } catch (error: any) {
    console.error('更新首页配置失败:', error);
    res.status(500).json({
      success: false,
      message: '更新首页配置失败',
      error: error.message,
    });
  }
};

/**
 * @desc    获取精选分类
 * @route   GET /api/homepage/featured-categories
 * @access  Public
 */
export const getFeaturedCategories = async (req: Request, res: Response) => {
  try {
    // 从首页配置中获取精选分类
    const settings = await HomepageSettings.findByPk(1);

    let featuredCategories: string[] = [];
    if (settings && settings.featured_categories) {
      featuredCategories = settings.featured_categories || [];
    }

    res.status(200).json({
      success: true,
      data: featuredCategories,
    });
  } catch (error: any) {
    console.error('获取精选分类失败:', error);
    res.status(500).json({
      success: false,
      message: '获取精选分类失败',
      error: error.message,
    });
  }
};

/**
 * @desc    更新精选分类
 * @route   PUT /api/homepage/featured-categories
 * @access  Admin
 */
export const updateFeaturedCategories = async (req: Request, res: Response) => {
  try {
    const { featuredCategories } = req.body;

    if (!Array.isArray(featuredCategories)) {
      return res.status(400).json({
        success: false,
        message: '精选分类必须是一个数组',
      });
    }

    // 查找是否已存在配置
    let settings = await HomepageSettings.findByPk(1);

    if (!settings) {
      // 不存在，创建新配置
      settings = await HomepageSettings.create({
        id: 1,
        welcome_title: 'ExamTopics 模拟练习',
        welcome_description: '选择以下任一题库开始练习，测试您的知识水平',
        featured_categories: featuredCategories,
        announcements: '欢迎使用在线题库系统，新增题库将定期更新，请持续关注！',
        footer_text: '© 2023 ExamTopics 在线题库系统 保留所有权利',
        banner_image: '/images/banner.jpg',
        theme: 'light',
      });
    } else {
      // 更新现有配置
      await settings.update({
        featured_categories: featuredCategories,
      });
    }

    res.status(200).json({
      success: true,
      message: '精选分类更新成功',
    });
  } catch (error: any) {
    console.error('更新精选分类失败:', error);
    res.status(500).json({
      success: false,
      message: '更新精选分类失败',
      error: error.message,
    });
  }
};

/**
 * @desc    获取精选题库
 * @route   GET /api/homepage/featured-question-sets
 * @access  Public
 */
export const getFeaturedQuestionSets = async (req: Request, res: Response) => {
  try {
    // 查询所有标记为精选的题库
    const featuredSets = await QuestionSet.findAll({
      where: {
        isFeatured: true,
      },
    });

    res.status(200).json({
      success: true,
      data: featuredSets,
    });
  } catch (error: any) {
    console.error('获取精选题库失败:', error);
    res.status(500).json({
      success: false,
      message: '获取精选题库失败',
      error: error.message,
    });
  }
};

/**
 * @desc    更新题库的精选状态
 * @route   PUT /api/homepage/featured-question-sets/:id
 * @access  Admin
 */
export const updateQuestionSetFeaturedStatus = async (req: Request, res: Response) => {
  try {
    const { id } = req.params;
    const { isFeatured, featuredCategory } = req.body;

    // 查找题库
    const questionSet = await QuestionSet.findByPk(id);

    if (!questionSet) {
      return res.status(404).json({
        success: false,
        message: '题库不存在',
      });
    }

    // 准备更新数据对象
    const updateData: { isFeatured?: boolean, featuredCategory?: string | undefined } = {};
    
    // 如果提供了 isFeatured 参数
    if (typeof isFeatured === 'boolean') {
      updateData.isFeatured = isFeatured;
      
      // 如果取消精选，同时清除精选分类
      if (isFeatured === false) {
        updateData.featuredCategory = undefined;
      }
    }
    
    // 如果提供了 featuredCategory 参数
    if (featuredCategory !== undefined) {
      updateData.featuredCategory = featuredCategory || undefined;
    }
    
    // 没有任何参数时返回错误
    if (Object.keys(updateData).length === 0) {
      return res.status(400).json({
        success: false,
        message: '需要提供 isFeatured 或 featuredCategory 参数',
      });
    }

    // 更新题库
    await questionSet.update(updateData);

    // 准备响应消息
    let message = '';
    if ('isFeatured' in updateData) {
      message = `题库${updateData.isFeatured ? '已添加到' : '已从'}精选列表${updateData.isFeatured ? '中' : '移除'}`;
    } else if ('featuredCategory' in updateData) {
      message = '题库精选分类已更新';
    }

    res.status(200).json({
      success: true,
      message,
    });
  } catch (error: any) {
    console.error('更新题库精选状态失败:', error);
    res.status(500).json({
      success: false,
      message: '更新题库精选状态失败',
      error: error.message,
    });
  }
}; 
