"use strict";
var __createBinding = (this && this.__createBinding) || (Object.create ? (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    var desc = Object.getOwnPropertyDescriptor(m, k);
    if (!desc || ("get" in desc ? !m.__esModule : desc.writable || desc.configurable)) {
      desc = { enumerable: true, get: function() { return m[k]; } };
    }
    Object.defineProperty(o, k2, desc);
}) : (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    o[k2] = m[k];
}));
var __setModuleDefault = (this && this.__setModuleDefault) || (Object.create ? (function(o, v) {
    Object.defineProperty(o, "default", { enumerable: true, value: v });
}) : function(o, v) {
    o["default"] = v;
});
var __importStar = (this && this.__importStar) || (function () {
    var ownKeys = function(o) {
        ownKeys = Object.getOwnPropertyNames || function (o) {
            var ar = [];
            for (var k in o) if (Object.prototype.hasOwnProperty.call(o, k)) ar[ar.length] = k;
            return ar;
        };
        return ownKeys(o);
    };
    return function (mod) {
        if (mod && mod.__esModule) return mod;
        var result = {};
        if (mod != null) for (var k = ownKeys(mod), i = 0; i < k.length; i++) if (k[i] !== "default") __createBinding(result, mod, k[i]);
        __setModuleDefault(result, mod);
        return result;
    };
})();
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.sequelize = exports.WrongAnswer = exports.UserProgress = exports.RedeemCode = exports.Purchase = exports.HomepageSettings = exports.Option = exports.Question = exports.QuestionSet = exports.User = void 0;
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
const RedeemCode_1 = __importStar(require("./RedeemCode"));
exports.RedeemCode = RedeemCode_1.default;
const Option_1 = __importDefault(require("./Option"));
exports.Option = Option_1.default;
const HomepageSettings_1 = __importDefault(require("./HomepageSettings"));
exports.HomepageSettings = HomepageSettings_1.default;
const UserProgress_1 = __importDefault(require("./UserProgress"));
exports.UserProgress = UserProgress_1.default;
const WrongAnswer_1 = __importDefault(require("./WrongAnswer"));
exports.WrongAnswer = WrongAnswer_1.default;
// 不要在这里初始化模型关联，避免重复
// 关联初始化已经在 index.ts 中进行
console.log('模型已导入，关联将在应用启动时初始化');
// 设置模型关联
// User与Question的关联（用户创建的题目）
User_1.default.hasMany(Question_1.default, { as: 'createdQuestions', foreignKey: 'createdBy' });
Question_1.default.belongsTo(User_1.default, { as: 'creator', foreignKey: 'createdBy' });
// User与QuestionSet的关联（用户创建的题库）
User_1.default.hasMany(QuestionSet_1.default, { as: 'createdQuestionSets', foreignKey: 'createdBy' });
QuestionSet_1.default.belongsTo(User_1.default, { as: 'creator', foreignKey: 'createdBy' });
// Question与QuestionSet的关联
QuestionSet_1.default.hasMany(Question_1.default, { as: 'questions', foreignKey: 'questionSetId' });
Question_1.default.belongsTo(QuestionSet_1.default, { as: 'questionSet', foreignKey: 'questionSetId' });
// Question与Option的关联
Question_1.default.hasMany(Option_1.default, { as: 'options', foreignKey: 'questionId' });
Option_1.default.belongsTo(Question_1.default, { as: 'question', foreignKey: 'questionId' });
// User与UserProgress的关联
User_1.default.hasMany(UserProgress_1.default, { as: 'progressRecords', foreignKey: 'userId' });
UserProgress_1.default.belongsTo(User_1.default, { as: 'user', foreignKey: 'userId' });
// QuestionSet与UserProgress的关联
QuestionSet_1.default.hasMany(UserProgress_1.default, { as: 'progressRecords', foreignKey: 'questionSetId' });
UserProgress_1.default.belongsTo(QuestionSet_1.default, { as: 'questionSet', foreignKey: 'questionSetId' });
// User与Purchase的关联
User_1.default.hasMany(Purchase_1.default, { as: 'userPurchases', foreignKey: 'userId' });
Purchase_1.default.belongsTo(User_1.default, { as: 'user', foreignKey: 'userId' });
// QuestionSet与Purchase的关联
QuestionSet_1.default.hasMany(Purchase_1.default, { as: 'purchases', foreignKey: 'questionSetId' });
Purchase_1.default.belongsTo(QuestionSet_1.default, { as: 'questionSet', foreignKey: 'questionSetId' });
// User与WrongAnswer的关联
User_1.default.hasMany(WrongAnswer_1.default, { as: 'wrongAnswers', foreignKey: 'userId' });
WrongAnswer_1.default.belongsTo(User_1.default, { as: 'user', foreignKey: 'userId' });
// QuestionSet与WrongAnswer的关联
QuestionSet_1.default.hasMany(WrongAnswer_1.default, { as: 'wrongAnswers', foreignKey: 'questionSetId' });
WrongAnswer_1.default.belongsTo(QuestionSet_1.default, { as: 'questionSet', foreignKey: 'questionSetId' });
// Question与WrongAnswer的关联
Question_1.default.hasMany(WrongAnswer_1.default, { as: 'wrongAnswers', foreignKey: 'questionId' });
WrongAnswer_1.default.belongsTo(Question_1.default, { as: 'question', foreignKey: 'questionId' });
// 设置RedeemCode的关联
(0, RedeemCode_1.setupAssociations)();
exports.default = {
    sequelize: database_1.default,
    User: User_1.default,
    Question: Question_1.default,
    QuestionSet: QuestionSet_1.default,
    Option: Option_1.default,
    HomepageSettings: HomepageSettings_1.default,
    Purchase: Purchase_1.default,
    RedeemCode: RedeemCode_1.default,
    UserProgress: UserProgress_1.default,
    WrongAnswer: WrongAnswer_1.default
};
