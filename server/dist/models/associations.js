"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.setupAssociations = void 0;
const Question_1 = __importDefault(require("./Question"));
const Option_1 = __importDefault(require("./Option"));
const QuestionSet_1 = __importDefault(require("./QuestionSet"));
const User_1 = __importDefault(require("./User"));
const UserProgress_1 = __importDefault(require("./UserProgress"));
const Purchase_1 = __importDefault(require("./Purchase"));
const RedeemCode_1 = __importDefault(require("./RedeemCode"));
const WrongAnswer_1 = __importDefault(require("./WrongAnswer"));
const setupAssociations = () => {
    // QuestionSet 和 Question 的关联
    QuestionSet_1.default.hasMany(Question_1.default, {
        foreignKey: 'questionSetId',
        as: 'questionSetQuestions',
        onDelete: 'CASCADE'
    });
    Question_1.default.belongsTo(QuestionSet_1.default, {
        foreignKey: 'questionSetId',
        as: 'questionSetInfo'
    });
    // Question 和 Option 的关联
    Question_1.default.hasMany(Option_1.default, {
        foreignKey: 'questionId',
        as: 'options',
        onDelete: 'CASCADE'
    });
    Option_1.default.belongsTo(Question_1.default, {
        foreignKey: 'questionId',
        as: 'question'
    });
    // User 和 UserProgress 的关联 - 修改关联名称以避免冲突
    User_1.default.hasMany(UserProgress_1.default, {
        foreignKey: 'userId',
        as: 'userProgress',
        onDelete: 'CASCADE'
    });
    UserProgress_1.default.belongsTo(User_1.default, {
        foreignKey: 'userId',
        as: 'user'
    });
    // UserProgress 和 Question 的关联
    UserProgress_1.default.belongsTo(Question_1.default, {
        foreignKey: 'questionId',
        as: 'question'
    });
    // UserProgress 和 QuestionSet 的关联
    UserProgress_1.default.belongsTo(QuestionSet_1.default, {
        foreignKey: 'questionSetId',
        as: 'progressQuestionSet'
    });
    // User 和 Purchase 的关联 - 明确设置onDelete为CASCADE
    User_1.default.hasMany(Purchase_1.default, {
        foreignKey: 'user_id', // 确保使用正确的列名
        sourceKey: 'id',
        as: 'userPurchases', // 使用一致的关联名
        onDelete: 'CASCADE', // 明确指定CASCADE删除
        hooks: true // 启用钩子以确保CASCADE正常工作
    });
    Purchase_1.default.belongsTo(User_1.default, {
        foreignKey: 'user_id', // 确保使用正确的列名
        targetKey: 'id',
        as: 'user',
        onDelete: 'CASCADE' // 确保双向关联都是CASCADE
    });
    // Purchase 和 QuestionSet 的关联
    Purchase_1.default.belongsTo(QuestionSet_1.default, {
        foreignKey: 'questionSetId',
        as: 'purchaseQuestionSet'
    });
    // 兑换码关联
    RedeemCode_1.default.belongsTo(QuestionSet_1.default, {
        foreignKey: 'questionSetId',
        as: 'redeemQuestionSet'
    });
    QuestionSet_1.default.hasMany(RedeemCode_1.default, {
        foreignKey: 'questionSetId',
        as: 'redeemCodes',
        onDelete: 'CASCADE'
    });
    User_1.default.hasMany(RedeemCode_1.default, {
        foreignKey: 'usedBy',
        as: 'userRedeemCodes',
        onDelete: 'SET NULL'
    });
    // WrongAnswer 关联
    User_1.default.hasMany(WrongAnswer_1.default, {
        foreignKey: 'userId',
        as: 'wrongAnswers',
        onDelete: 'CASCADE'
    });
    WrongAnswer_1.default.belongsTo(User_1.default, {
        foreignKey: 'userId',
        as: 'user'
    });
    Question_1.default.hasMany(WrongAnswer_1.default, {
        foreignKey: 'questionId',
        as: 'wrongAnswers',
        onDelete: 'CASCADE'
    });
    WrongAnswer_1.default.belongsTo(Question_1.default, {
        foreignKey: 'questionId',
        as: 'wrongAnswerQuestion'
    });
    QuestionSet_1.default.hasMany(WrongAnswer_1.default, {
        foreignKey: 'questionSetId',
        as: 'wrongAnswers',
        onDelete: 'CASCADE'
    });
    WrongAnswer_1.default.belongsTo(QuestionSet_1.default, {
        foreignKey: 'questionSetId',
        as: 'wrongAnswerQuestionSet'
    });
};
exports.setupAssociations = setupAssociations;
