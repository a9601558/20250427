"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.defaultHomepageSettings = void 0;
/**
 * Default homepage settings - Single source of truth for server-side defaults
 * This eliminates duplication and inconsistencies across different files
 */
exports.defaultHomepageSettings = {
    welcome_title: 'ExamTopics 模拟练习',
    welcome_description: '选择以下任一题库开始练习，测试您的知识水平',
    featured_categories: ['网络协议', '编程语言', '计算机基础'],
    announcements: '欢迎使用在线题库系统，新增题库将定期更新，请持续关注！',
    footer_text: '© 2023 ExamTopics 在线题库系统 保留所有权利',
    banner_image: '/images/banner.jpg',
    theme: 'light'
};
