"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.syncModels = exports.HomepageSettings = exports.Option = exports.RedeemCode = exports.Purchase = exports.QuestionSet = exports.Question = exports.User = exports.sequelize = void 0;
const db_1 = require("../config/db");
Object.defineProperty(exports, "sequelize", { enumerable: true, get: function () { return db_1.sequelize; } });
// 导入模型
const User_1 = __importDefault(require("./User"));
exports.User = User_1.default;
const Question_1 = __importDefault(require("./Question"));
exports.Question = Question_1.default;
const QuestionSet_1 = __importDefault(require("./QuestionSet"));
exports.QuestionSet = QuestionSet_1.default;
const Purchase_1 = __importDefault(require("./Purchase"));
exports.Purchase = Purchase_1.default;
const RedeemCode_1 = __importDefault(require("./RedeemCode"));
exports.RedeemCode = RedeemCode_1.default;
const Option_1 = __importDefault(require("./Option"));
exports.Option = Option_1.default;
const HomepageSettings_1 = __importDefault(require("./HomepageSettings"));
exports.HomepageSettings = HomepageSettings_1.default;
// 设置模型关联
User_1.default.hasMany(Purchase_1.default, {
    foreignKey: 'userId',
    as: 'userPurchases'
});
QuestionSet_1.default.hasMany(Question_1.default, {
    foreignKey: 'questionSetId',
    as: 'questions'
});
Question_1.default.belongsTo(QuestionSet_1.default, {
    foreignKey: 'questionSetId',
    as: 'questionSet'
});
Question_1.default.hasMany(Option_1.default, {
    foreignKey: 'questionId',
    as: 'options'
});
Option_1.default.belongsTo(Question_1.default, {
    foreignKey: 'questionId',
    as: 'question'
});
QuestionSet_1.default.hasMany(Purchase_1.default, {
    foreignKey: 'quizId',
    as: 'purchases'
});
Purchase_1.default.belongsTo(QuestionSet_1.default, {
    foreignKey: 'quizId',
    as: 'questionSet'
});
QuestionSet_1.default.hasMany(RedeemCode_1.default, {
    foreignKey: 'questionSetId',
    as: 'redeemCodes'
});
RedeemCode_1.default.belongsTo(QuestionSet_1.default, {
    foreignKey: 'questionSetId',
    as: 'questionSet'
});
Purchase_1.default.belongsTo(User_1.default, {
    foreignKey: 'userId',
    as: 'user'
});
// 数据库同步函数
const syncModels = async () => {
    try {
        console.log('开始同步数据库模型...');
        console.log('同步 User 模型...');
        await User_1.default.sync({ alter: true });
        console.log('同步 QuestionSet 模型...');
        await QuestionSet_1.default.sync({ alter: true });
        console.log('同步 Question 模型...');
        await Question_1.default.sync({ alter: true });
        console.log('同步 Option 模型...');
        await Option_1.default.sync({ alter: true });
        console.log('同步 Purchase 模型...');
        await Purchase_1.default.sync({ alter: true });
        console.log('同步 RedeemCode 模型...');
        await RedeemCode_1.default.sync({ alter: true });
        console.log('同步 HomepageSettings 模型...');
        await HomepageSettings_1.default.sync({ alter: true });
        console.log('所有模型同步完成');
        // 确保 HomepageSettings 表有初始数据
        const homeSettings = await HomepageSettings_1.default.findByPk(1);
        if (!homeSettings) {
            console.log('创建 HomepageSettings 初始数据...');
            await HomepageSettings_1.default.create({
                id: 1,
                welcome_title: "ExamTopics 模拟练习",
                welcome_description: "选择以下任一题库开始练习，测试您的知识水平",
                featured_categories: ["网络协议", "编程语言", "计算机基础"],
                announcements: "欢迎使用在线题库系统，新增题库将定期更新，请持续关注！",
                footer_text: "© 2023 ExamTopics 在线题库系统 保留所有权利",
                banner_image: "/images/banner.jpg",
                theme: 'light'
            });
            console.log('HomepageSettings 初始数据创建成功');
        }
        return true;
    }
    catch (error) {
        console.error('数据库模型同步错误:', error);
        // 尝试强制同步（谨慎使用，会重建表结构）
        try {
            console.log('尝试使用force模式同步模型...');
            console.log('同步 HomepageSettings 模型...');
            await HomepageSettings_1.default.sync({ force: true });
            console.log('同步 User 模型...');
            await User_1.default.sync({ force: true });
            console.log('同步 QuestionSet 模型...');
            await QuestionSet_1.default.sync({ force: true });
            console.log('同步 Question 模型...');
            await Question_1.default.sync({ force: true });
            console.log('同步 Option 模型...');
            await Option_1.default.sync({ force: true });
            console.log('同步 Purchase 模型...');
            await Purchase_1.default.sync({ force: true });
            console.log('同步 RedeemCode 模型...');
            await RedeemCode_1.default.sync({ force: true });
            console.log('创建 HomepageSettings 初始数据...');
            await HomepageSettings_1.default.create({
                id: 1,
                welcome_title: "ExamTopics 模拟练习",
                welcome_description: "选择以下任一题库开始练习，测试您的知识水平",
                featured_categories: ["网络协议", "编程语言", "计算机基础"],
                announcements: "欢迎使用在线题库系统，新增题库将定期更新，请持续关注！",
                footer_text: "© 2023 ExamTopics 在线题库系统 保留所有权利",
                banner_image: "/images/banner.jpg",
                theme: 'light'
            });
            console.log('强制模式同步完成');
            return true;
        }
        catch (forceError) {
            console.error('强制同步数据库模型失败:', forceError);
            throw forceError;
        }
    }
};
exports.syncModels = syncModels;
