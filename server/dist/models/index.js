"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.sequelize = exports.UserProgress = exports.RedeemCode = exports.Purchase = exports.HomepageSettings = exports.Option = exports.Question = exports.QuestionSet = exports.User = void 0;
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
// 定义模型之间的关联关系
// User <-> QuestionSet (通过 Purchase)
Purchase_1.default.belongsTo(User_1.default, { foreignKey: 'userId', as: 'user' });
User_1.default.hasMany(Purchase_1.default, { foreignKey: 'userId', as: 'purchases' });
// Purchase <-> QuestionSet
Purchase_1.default.belongsTo(QuestionSet_1.default, { foreignKey: 'questionSetId', as: 'purchaseQuestionSet' });
QuestionSet_1.default.hasMany(Purchase_1.default, { foreignKey: 'questionSetId', as: 'purchases' });
// QuestionSet <-> Question
QuestionSet_1.default.hasMany(Question_1.default, { foreignKey: 'questionSetId', as: 'questions' });
Question_1.default.belongsTo(QuestionSet_1.default, { foreignKey: 'questionSetId', as: 'questionSet' });
// Question <-> Option
Question_1.default.hasMany(Option_1.default, { foreignKey: 'questionId', as: 'options' });
Option_1.default.belongsTo(Question_1.default, { foreignKey: 'questionId', as: 'question' });
// User <-> RedeemCode
RedeemCode_1.default.belongsTo(User_1.default, { foreignKey: 'createdBy', as: 'creator' });
RedeemCode_1.default.belongsTo(User_1.default, { foreignKey: 'usedBy', as: 'consumer' });
User_1.default.hasMany(RedeemCode_1.default, { foreignKey: 'createdBy', as: 'createdCodes' });
User_1.default.hasMany(RedeemCode_1.default, { foreignKey: 'usedBy', as: 'redeemedCodes' });
// RedeemCode <-> QuestionSet
RedeemCode_1.default.belongsTo(QuestionSet_1.default, { foreignKey: 'questionSetId', as: 'questionSet' });
QuestionSet_1.default.hasMany(RedeemCode_1.default, { foreignKey: 'questionSetId', as: 'redeemCodes' });
// User <-> UserProgress
UserProgress_1.default.belongsTo(User_1.default, { foreignKey: 'userId', as: 'user' });
User_1.default.hasMany(UserProgress_1.default, { foreignKey: 'userId', as: 'progress' });
// UserProgress <-> QuestionSet
UserProgress_1.default.belongsTo(QuestionSet_1.default, { foreignKey: 'questionSetId', as: 'progressQuestionSet' });
QuestionSet_1.default.hasMany(UserProgress_1.default, { foreignKey: 'questionSetId', as: 'userProgress' });
// UserProgress <-> Question
UserProgress_1.default.belongsTo(Question_1.default, { foreignKey: 'questionId', as: 'question' });
Question_1.default.hasMany(UserProgress_1.default, { foreignKey: 'questionId', as: 'progress' });
