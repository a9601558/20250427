"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.updateQuestionSetFeaturedStatus = exports.getFeaturedQuestionSets = exports.updateFeaturedCategories = exports.getFeaturedCategories = exports.updateHomepageContent = exports.getHomepageContent = void 0;
const HomepageSettings_1 = __importDefault(require("../models/HomepageSettings"));
const QuestionSet_1 = __importDefault(require("../models/QuestionSet"));
/**
 * @desc    获取首页配置
 * @route   GET /api/homepage/content
 * @access  Public
 */
const getHomepageContent = async (req, res) => {
    try {
        // 获取存储在数据库中的首页配置
        const settings = await HomepageSettings_1.default.findByPk(1);
        // 如果没有配置，返回默认配置
        if (!settings) {
            const defaultContent = {
                welcomeTitle: "ExamTopics 模拟练习",
                welcomeDescription: "选择以下任一题库开始练习，测试您的知识水平",
                featuredCategories: ["网络协议", "编程语言", "计算机基础"],
                announcements: "欢迎使用在线题库系统，新增题库将定期更新，请持续关注！",
                footerText: "© 2023 ExamTopics 在线题库系统 保留所有权利",
                bannerImage: "/images/banner.jpg",
                theme: 'light'
            };
            return res.status(200).json({
                success: true,
                data: defaultContent
            });
        }
        // 将配置转换为HomeContent格式
        const content = {
            welcomeTitle: settings.welcome_title,
            welcomeDescription: settings.welcome_description,
            featuredCategories: settings.featured_categories || [],
            announcements: settings.announcements,
            footerText: settings.footer_text,
            bannerImage: settings.banner_image,
            theme: settings.theme
        };
        res.status(200).json({
            success: true,
            data: content
        });
    }
    catch (error) {
        console.error('获取首页配置失败:', error);
        res.status(500).json({
            success: false,
            message: '获取首页配置失败',
            error: error.message
        });
    }
};
exports.getHomepageContent = getHomepageContent;
/**
 * @desc    更新首页配置
 * @route   PUT /api/homepage/content
 * @access  Admin
 */
const updateHomepageContent = async (req, res) => {
    try {
        const { welcomeTitle, welcomeDescription, featuredCategories, announcements, footerText, bannerImage, theme } = req.body;
        // 查找是否已存在配置
        let settings = await HomepageSettings_1.default.findByPk(1);
        if (!settings) {
            // 不存在，创建新配置
            settings = await HomepageSettings_1.default.create({
                id: 1,
                welcome_title: welcomeTitle,
                welcome_description: welcomeDescription,
                featured_categories: featuredCategories,
                announcements: announcements,
                footer_text: footerText,
                banner_image: bannerImage || null,
                theme: theme || 'light'
            });
        }
        else {
            // 更新现有配置
            await settings.update({
                welcome_title: welcomeTitle,
                welcome_description: welcomeDescription,
                featured_categories: featuredCategories,
                announcements: announcements,
                footer_text: footerText,
                banner_image: bannerImage || null,
                theme: theme || 'light'
            });
        }
        res.status(200).json({
            success: true,
            message: '首页配置更新成功'
        });
    }
    catch (error) {
        console.error('更新首页配置失败:', error);
        res.status(500).json({
            success: false,
            message: '更新首页配置失败',
            error: error.message
        });
    }
};
exports.updateHomepageContent = updateHomepageContent;
/**
 * @desc    获取精选分类
 * @route   GET /api/homepage/featured-categories
 * @access  Public
 */
const getFeaturedCategories = async (req, res) => {
    try {
        // 从首页配置中获取精选分类
        const settings = await HomepageSettings_1.default.findByPk(1);
        let featuredCategories = [];
        if (settings && settings.featured_categories) {
            featuredCategories = settings.featured_categories || [];
        }
        res.status(200).json({
            success: true,
            data: featuredCategories
        });
    }
    catch (error) {
        console.error('获取精选分类失败:', error);
        res.status(500).json({
            success: false,
            message: '获取精选分类失败',
            error: error.message
        });
    }
};
exports.getFeaturedCategories = getFeaturedCategories;
/**
 * @desc    更新精选分类
 * @route   PUT /api/homepage/featured-categories
 * @access  Admin
 */
const updateFeaturedCategories = async (req, res) => {
    try {
        const { featuredCategories } = req.body;
        if (!Array.isArray(featuredCategories)) {
            return res.status(400).json({
                success: false,
                message: '精选分类必须是一个数组'
            });
        }
        // 查找是否已存在配置
        let settings = await HomepageSettings_1.default.findByPk(1);
        if (!settings) {
            // 不存在，创建新配置
            settings = await HomepageSettings_1.default.create({
                id: 1,
                welcome_title: 'ExamTopics 模拟练习',
                welcome_description: '选择以下任一题库开始练习，测试您的知识水平',
                featured_categories: featuredCategories,
                announcements: '欢迎使用在线题库系统，新增题库将定期更新，请持续关注！',
                footer_text: '© 2023 ExamTopics 在线题库系统 保留所有权利',
                banner_image: '/images/banner.jpg',
                theme: 'light'
            });
        }
        else {
            // 更新现有配置
            await settings.update({
                featured_categories: featuredCategories
            });
        }
        res.status(200).json({
            success: true,
            message: '精选分类更新成功'
        });
    }
    catch (error) {
        console.error('更新精选分类失败:', error);
        res.status(500).json({
            success: false,
            message: '更新精选分类失败',
            error: error.message
        });
    }
};
exports.updateFeaturedCategories = updateFeaturedCategories;
/**
 * @desc    获取精选题库
 * @route   GET /api/homepage/featured-question-sets
 * @access  Public
 */
const getFeaturedQuestionSets = async (req, res) => {
    try {
        // 查询所有标记为精选的题库
        const featuredSets = await QuestionSet_1.default.findAll({
            where: {
                isFeatured: true
            }
        });
        res.status(200).json({
            success: true,
            data: featuredSets
        });
    }
    catch (error) {
        console.error('获取精选题库失败:', error);
        res.status(500).json({
            success: false,
            message: '获取精选题库失败',
            error: error.message
        });
    }
};
exports.getFeaturedQuestionSets = getFeaturedQuestionSets;
/**
 * @desc    更新题库的精选状态
 * @route   PUT /api/homepage/featured-question-sets/:id
 * @access  Admin
 */
const updateQuestionSetFeaturedStatus = async (req, res) => {
    try {
        const { id } = req.params;
        const { isFeatured } = req.body;
        if (typeof isFeatured !== 'boolean') {
            return res.status(400).json({
                success: false,
                message: 'isFeatured必须是一个布尔值'
            });
        }
        // 查找题库
        const questionSet = await QuestionSet_1.default.findByPk(id);
        if (!questionSet) {
            return res.status(404).json({
                success: false,
                message: '题库不存在'
            });
        }
        // 更新精选状态
        await questionSet.update({
            isFeatured
        });
        res.status(200).json({
            success: true,
            message: `题库${isFeatured ? '已添加到' : '已从'}精选列表${isFeatured ? '中' : '移除'}`
        });
    }
    catch (error) {
        console.error('更新题库精选状态失败:', error);
        res.status(500).json({
            success: false,
            message: '更新题库精选状态失败',
            error: error.message
        });
    }
};
exports.updateQuestionSetFeaturedStatus = updateQuestionSetFeaturedStatus;
