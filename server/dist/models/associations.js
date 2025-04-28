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
        as: 'progress',
        onDelete: 'CASCADE'
    });
    UserProgress_1.default.belongsTo(User_1.default, {
        foreignKey: 'userId',
        as: 'user'
    });
    // QuestionSet 和 UserProgress 的关联
    QuestionSet_1.default.hasMany(UserProgress_1.default, {
        foreignKey: 'questionSetId',
        as: 'userProgress',
        onDelete: 'CASCADE'
    });
    UserProgress_1.default.belongsTo(QuestionSet_1.default, {
        foreignKey: 'questionSetId',
        as: 'questionSet'
    });
    // Question 和 UserProgress 的关联
    Question_1.default.hasMany(UserProgress_1.default, {
        foreignKey: 'questionId',
        as: 'userProgress',
        onDelete: 'CASCADE'
    });
    UserProgress_1.default.belongsTo(Question_1.default, {
        foreignKey: 'questionId',
        as: 'question'
    });
};
exports.setupAssociations = setupAssociations;
