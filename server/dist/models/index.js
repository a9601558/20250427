"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.Option = exports.RedeemCode = exports.Purchase = exports.QuestionSet = exports.Question = exports.User = exports.sequelize = void 0;
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
// 设置模型关联
User_1.default.hasMany(Purchase_1.default, {
    foreignKey: 'userId',
    as: 'userPurchases'
});
Purchase_1.default.belongsTo(User_1.default, {
    foreignKey: 'userId',
    as: 'user'
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
User_1.default.hasMany(RedeemCode_1.default, {
    foreignKey: 'usedBy',
    as: 'redeemedCodes'
});
RedeemCode_1.default.belongsTo(User_1.default, {
    foreignKey: 'usedBy',
    as: 'user'
});
User_1.default.hasMany(RedeemCode_1.default, {
    foreignKey: 'createdBy',
    as: 'createdCodes'
});
RedeemCode_1.default.belongsTo(User_1.default, {
    foreignKey: 'createdBy',
    as: 'creator'
});
