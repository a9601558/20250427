"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.sequelize = exports.WrongAnswer = exports.RedeemCode = exports.Purchase = exports.UserProgress = exports.Option = exports.QuestionSet = exports.Question = exports.User = exports.initializeAssociations = void 0;
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
const UserProgress_1 = __importDefault(require("./UserProgress"));
exports.UserProgress = UserProgress_1.default;
const WrongAnswer_1 = __importDefault(require("./WrongAnswer"));
exports.WrongAnswer = WrongAnswer_1.default;
// 不要在这里初始化模型关联，避免重复
// 关联初始化已经在 associations.ts 中进行
console.log('模型已导入，关联将在应用启动时初始化');
// Define associations
const initializeAssociations = () => {
    console.log('正在初始化模型关联...');
    // Question <-> QuestionSet
    Question_1.default.belongsTo(QuestionSet_1.default, {
        foreignKey: 'questionSetId',
        onDelete: 'CASCADE'
    });
    QuestionSet_1.default.hasMany(Question_1.default, {
        foreignKey: 'questionSetId',
        as: 'questions'
    });
    // Question <-> Option
    Question_1.default.hasMany(Option_1.default, {
        foreignKey: 'questionId',
        as: 'options',
        onDelete: 'CASCADE'
    });
    Option_1.default.belongsTo(Question_1.default, {
        foreignKey: 'questionId'
    });
    // UserProgress associations
    UserProgress_1.default.belongsTo(User_1.default, {
        foreignKey: 'userId'
    });
    UserProgress_1.default.belongsTo(QuestionSet_1.default, {
        foreignKey: 'questionSetId',
        as: 'progressQuestionSet'
    });
    UserProgress_1.default.belongsTo(Question_1.default, {
        foreignKey: 'questionId',
        as: 'question'
    });
    User_1.default.hasMany(UserProgress_1.default, {
        foreignKey: 'userId',
        as: 'progress'
    });
    QuestionSet_1.default.hasMany(UserProgress_1.default, {
        foreignKey: 'questionSetId',
        as: 'userProgress'
    });
    Question_1.default.hasMany(UserProgress_1.default, {
        foreignKey: 'questionId',
        as: 'userAnswers'
    });
    // Purchase associations
    Purchase_1.default.belongsTo(User_1.default, {
        foreignKey: 'userId'
    });
    Purchase_1.default.belongsTo(QuestionSet_1.default, {
        foreignKey: 'questionSetId',
        as: 'purchaseQuestionSet'
    });
    User_1.default.hasMany(Purchase_1.default, {
        foreignKey: 'userId',
        as: 'purchases'
    });
    QuestionSet_1.default.hasMany(Purchase_1.default, {
        foreignKey: 'questionSetId',
        as: 'purchases'
    });
    // Redeemed Code associations
    RedeemCode_1.default.belongsTo(User_1.default, {
        foreignKey: 'userId'
    });
    RedeemCode_1.default.belongsTo(QuestionSet_1.default, {
        foreignKey: 'questionSetId',
        as: 'codeQuestionSet'
    });
    User_1.default.hasMany(RedeemCode_1.default, {
        foreignKey: 'userId',
        as: 'redeemedCodes'
    });
    QuestionSet_1.default.hasMany(RedeemCode_1.default, {
        foreignKey: 'questionSetId',
        as: 'redeemedCodes'
    });
    console.log('模型关联初始化完成');
};
exports.initializeAssociations = initializeAssociations;
exports.default = {
    User: User_1.default,
    Question: Question_1.default,
    QuestionSet: QuestionSet_1.default,
    Option: Option_1.default,
    UserProgress: UserProgress_1.default,
    Purchase: Purchase_1.default,
    RedeemCode: RedeemCode_1.default,
    WrongAnswer: WrongAnswer_1.default,
    sequelize: database_1.default,
    initializeAssociations: exports.initializeAssociations
};
