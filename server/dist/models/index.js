"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.sequelize = exports.UserProgress = exports.RedeemCode = exports.Purchase = exports.HomepageSettings = exports.Option = exports.Question = exports.QuestionSet = exports.User = exports.syncModels = exports.setupAssociations = void 0;
const database_1 = __importDefault(require("../config/database"));
exports.sequelize = database_1.default;
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
const UserProgress_1 = __importDefault(require("./UserProgress"));
exports.UserProgress = UserProgress_1.default;
const UserProgress_2 = require("./UserProgress");
// 设置模型关联
const setupAssociations = () => {
    console.log('设置模型关联...');
    // User与Purchase的关联
    User_1.default.hasMany(Purchase_1.default, {
        foreignKey: 'userId',
        as: 'userPurchases'
    });
    Purchase_1.default.belongsTo(User_1.default, {
        foreignKey: 'userId',
        as: 'user'
    });
    // QuestionSet与Question的关联
    QuestionSet_1.default.hasMany(Question_1.default, {
        foreignKey: 'questionSetId',
        as: 'questions',
        onDelete: 'CASCADE'
    });
    Question_1.default.belongsTo(QuestionSet_1.default, {
        foreignKey: 'questionSetId',
        as: 'questionSet'
    });
    // Question与Option的关联
    Question_1.default.hasMany(Option_1.default, {
        foreignKey: 'questionId',
        as: 'options',
        onDelete: 'CASCADE'
    });
    Option_1.default.belongsTo(Question_1.default, {
        foreignKey: 'questionId',
        as: 'question'
    });
    // QuestionSet与Purchase的关联
    QuestionSet_1.default.hasMany(Purchase_1.default, {
        foreignKey: 'quizId',
        as: 'purchases'
    });
    Purchase_1.default.belongsTo(QuestionSet_1.default, {
        foreignKey: 'quizId',
        as: 'questionSet'
    });
    // QuestionSet与RedeemCode的关联
    QuestionSet_1.default.hasMany(RedeemCode_1.default, {
        foreignKey: 'questionSetId',
        as: 'redeemCodes'
    });
    RedeemCode_1.default.belongsTo(QuestionSet_1.default, {
        foreignKey: 'questionSetId',
        as: 'questionSet'
    });
    // UserProgress 关联
    (0, UserProgress_2.initUserProgressAssociations)();
    console.log('模型关联设置完成');
};
exports.setupAssociations = setupAssociations;
// Sync models with database
const syncModels = async () => {
    try {
        // 首先设置模型关联
        (0, exports.setupAssociations)();
        // 在同步前确保所有模型已经正确加载
        console.log('准备同步数据库模型...');
        // 记录User模型是否已加载
        if (User_1.default) {
            console.log('User 模型已加载，含hooks:', Object.keys(User_1.default.options.hooks || {}).join(', '));
        }
        else {
            console.warn('警告: User模型可能未正确加载!');
        }
        // 同步模型到数据库，但不强制重新创建表
        // alter: true 允许添加新列但不删除现有数据
        await database_1.default.sync({ alter: true });
        console.log('数据库同步完成');
        // 确保 HomepageSettings 表有初始数据
        const homepageSettings = await HomepageSettings_1.default.findByPk(1);
        if (!homepageSettings) {
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
        }
        return true;
    }
    catch (error) {
        console.error('数据库同步失败:', error);
        throw error;
    }
};
exports.syncModels = syncModels;
