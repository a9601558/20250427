const fs = require('fs').promises;
const path = require('path');
const logger = require('../utils/logger');

// 数据文件路径
const homeContentFilePath = path.join(__dirname, '../data/homeContent.json');
const featuredCategoriesFilePath = path.join(__dirname, '../data/featuredCategories.json');

// 默认数据
const defaultHomeContent = {
  welcomeTitle: 'ExamTopics 模拟练习',
  welcomeDescription: '选择以下任一题库开始练习，测试您的知识水平',
  featuredCategories: ['网络协议', '编程语言', '计算机基础'],
  announcements: '欢迎使用在线题库系统，新增题库将定期更新，请持续关注！',
  footerText: '© 2023 ExamTopics 在线题库系统 保留所有权利',
  bannerImage: '/images/banner.jpg',
  theme: 'light',
};

const defaultFeaturedCategories = ['网络协议', '编程语言', '计算机基础'];

// 确保数据文件存在
async function ensureDataFilesExist() {
  try {
    await fs.access(path.dirname(homeContentFilePath));
  } catch (error) {
    // 如果目录不存在，创建它
    await fs.mkdir(path.dirname(homeContentFilePath), { recursive: true });
  }

  try {
    await fs.access(homeContentFilePath);
  } catch (error) {
    // 如果文件不存在，创建默认内容
    await fs.writeFile(homeContentFilePath, JSON.stringify(defaultHomeContent, null, 2), 'utf8');
    logger.info('Created default home content file');
  }

  try {
    await fs.access(featuredCategoriesFilePath);
  } catch (error) {
    // 如果文件不存在，创建默认内容
    await fs.writeFile(featuredCategoriesFilePath, JSON.stringify(defaultFeaturedCategories, null, 2), 'utf8');
    logger.info('Created default featured categories file');
  }
}

// 初始化数据文件
ensureDataFilesExist().catch((error) => {
  logger.error('Failed to ensure data files exist:', error);
});

// 控制器方法
const homepageController = {
  // 获取首页内容
  getHomeContent: async (req, res) => {
    try {
      await ensureDataFilesExist();
      
      const data = await fs.readFile(homeContentFilePath, 'utf8');
      const homeContent = JSON.parse(data);
      
      return res.status(200).json({
        success: true,
        data: homeContent,
      });
    } catch (error) {
      logger.error('Error getting home content:', error);
      
      // 如果文件读取失败，返回默认内容
      return res.status(200).json({
        success: true,
        data: defaultHomeContent,
        message: '使用默认首页内容',
      });
    }
  },
  
  // 更新首页内容
  updateHomeContent: async (req, res) => {
    try {
      // 验证请求体
      if (!req.body) {
        return res.status(400).json({
          success: false,
          message: '请求体为空',
        });
      }
      
      // 确保数据目录和文件存在
      await ensureDataFilesExist();
      
      // 获取现有数据
      let homeContent;
      try {
        const data = await fs.readFile(homeContentFilePath, 'utf8');
        homeContent = JSON.parse(data);
      } catch (error) {
        homeContent = defaultHomeContent;
      }
      
      // 更新数据
      const updatedContent = {
        ...homeContent,
        ...req.body,
      };
      
      // 保存数据
      await fs.writeFile(homeContentFilePath, JSON.stringify(updatedContent, null, 2), 'utf8');
      
      // 更新精选分类文件，确保两边保持一致
      if (req.body.featuredCategories) {
        await fs.writeFile(featuredCategoriesFilePath, JSON.stringify(req.body.featuredCategories, null, 2), 'utf8');
      }
      
      logger.info('Home content updated successfully');
      
      return res.status(200).json({
        success: true,
        data: updatedContent,
        message: '首页内容更新成功',
      });
    } catch (error) {
      logger.error('Error updating home content:', error);
      
      return res.status(500).json({
        success: false,
        message: '更新首页内容失败',
        error: error.message,
      });
    }
  },
  
  // 获取精选分类
  getFeaturedCategories: async (req, res) => {
    try {
      await ensureDataFilesExist();
      
      const data = await fs.readFile(featuredCategoriesFilePath, 'utf8');
      const featuredCategories = JSON.parse(data);
      
      return res.status(200).json({
        success: true,
        data: featuredCategories,
      });
    } catch (error) {
      logger.error('Error getting featured categories:', error);
      
      // 如果文件读取失败，返回默认分类
      return res.status(200).json({
        success: true,
        data: defaultFeaturedCategories,
        message: '使用默认分类',
      });
    }
  },
  
  // 更新精选分类
  updateFeaturedCategories: async (req, res) => {
    try {
      // 验证请求体
      if (!req.body || !req.body.featuredCategories || !Array.isArray(req.body.featuredCategories)) {
        return res.status(400).json({
          success: false,
          message: '无效的请求体，需要包含featuredCategories数组',
        });
      }
      
      // 确保数据目录和文件存在
      await ensureDataFilesExist();
      
      const featuredCategories = req.body.featuredCategories;
      
      // 保存数据
      await fs.writeFile(featuredCategoriesFilePath, JSON.stringify(featuredCategories, null, 2), 'utf8');
      
      // 同时更新首页内容中的精选分类
      try {
        const homeContentData = await fs.readFile(homeContentFilePath, 'utf8');
        const homeContent = JSON.parse(homeContentData);
        
        const updatedHomeContent = {
          ...homeContent,
          featuredCategories: featuredCategories,
        };
        
        await fs.writeFile(homeContentFilePath, JSON.stringify(updatedHomeContent, null, 2), 'utf8');
      } catch (error) {
        logger.warn('Error updating featured categories in home content:', error);
        // 继续执行，不影响主要功能
      }
      
      logger.info('Featured categories updated successfully');
      
      return res.status(200).json({
        success: true,
        data: featuredCategories,
        message: '精选分类更新成功',
      });
    } catch (error) {
      logger.error('Error updating featured categories:', error);
      
      return res.status(500).json({
        success: false,
        message: '更新精选分类失败',
        error: error.message,
      });
    }
  },
};

module.exports = homepageController; 
