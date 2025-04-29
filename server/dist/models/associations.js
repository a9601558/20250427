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
const setupAssociations = () => {
    // QuestionSet 和 Question 的关联
    QuestionSet_1.default.hasMany(Question_1.default, {
        foreignKey: 'questionSetId',
        as: 'questions',
        onDelete: 'CASCADE'
    });
    Question_1.default.belongsTo(QuestionSet_1.default, {
        foreignKey: 'questionSetId',
        as: 'questionSet'
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
    // User 和 UserProgress 的关联
    User_1.default.hasMany(UserProgress_1.default, {
        foreignKey: 'userId',
        as: 'userProgresses',
        onDelete: 'CASCADE'
    });
    UserProgress_1.default.belongsTo(User_1.default, {
        foreignKey: 'userId',
        as: 'user'
    });
    // QuestionSet 和 UserProgress 的关联
    QuestionSet_1.default.hasMany(UserProgress_1.default, {
        foreignKey: 'questionSetId',
        as: 'questionSetUserProgresses',
        onDelete: 'CASCADE'
    });
    UserProgress_1.default.belongsTo(QuestionSet_1.default, {
        foreignKey: 'questionSetId',
        as: 'progressQuestionSet'
    });
    // Question 和 UserProgress 的关联
    Question_1.default.hasMany(UserProgress_1.default, {
        foreignKey: 'questionId',
        as: 'questionUserProgresses',
        onDelete: 'CASCADE'
    });
    UserProgress_1.default.belongsTo(Question_1.default, {
        foreignKey: 'questionId',
        as: 'progressQuestion'
    });
    // User 和 Purchase 的关联
    User_1.default.hasMany(Purchase_1.default, {
        foreignKey: 'userId',
        as: 'userPurchases',
        onDelete: 'CASCADE'
    });
    Purchase_1.default.belongsTo(User_1.default, {
        foreignKey: 'userId',
        as: 'purchaseUser'
    });
    // QuestionSet 和 Purchase 的关联
    QuestionSet_1.default.hasMany(Purchase_1.default, {
        foreignKey: 'questionSetId',
        as: 'questionSetPurchases',
        onDelete: 'CASCADE'
    });
    Purchase_1.default.belongsTo(QuestionSet_1.default, {
        foreignKey: 'questionSetId',
        as: 'purchaseQuestionSet'
    });
    // QuestionSet-RedeemCode关联
    QuestionSet_1.default.hasMany(RedeemCode_1.default, {
        foreignKey: 'questionSetId',
        as: 'questionSetRedeemCodes',
        onDelete: 'CASCADE'
    });
    RedeemCode_1.default.belongsTo(QuestionSet_1.default, {
        foreignKey: 'questionSetId',
        as: 'redeemQuestionSet'
    });
    // User-RedeemCode关联（已使用）
    User_1.default.hasMany(RedeemCode_1.default, {
        foreignKey: 'usedBy',
        as: 'userRedeemedCodes',
        onDelete: 'SET NULL'
    });
    RedeemCode_1.default.belongsTo(User_1.default, {
        foreignKey: 'usedBy',
        as: 'redeemUser'
    });
    // User-RedeemCode关联（创建者）
    User_1.default.hasMany(RedeemCode_1.default, {
        foreignKey: 'createdBy',
        as: 'userCreatedCodes',
        onDelete: 'CASCADE'
    });
    RedeemCode_1.default.belongsTo(User_1.default, {
        foreignKey: 'createdBy',
        as: 'redeemCreator'
    });
};
exports.setupAssociations = setupAssociations;
