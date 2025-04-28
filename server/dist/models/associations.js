"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.Option = exports.Question = exports.QuestionSet = void 0;
const QuestionSet_1 = __importDefault(require("./QuestionSet"));
exports.QuestionSet = QuestionSet_1.default;
const Question_1 = __importDefault(require("./Question"));
exports.Question = Question_1.default;
const Option_1 = __importDefault(require("./Option"));
exports.Option = Option_1.default;
// 设置问题集和问题之间的关联
QuestionSet_1.default.hasMany(Question_1.default, {
    foreignKey: 'questionSetId',
    as: 'questions'
});
Question_1.default.belongsTo(QuestionSet_1.default, {
    foreignKey: 'questionSetId',
    as: 'questionSet'
});
// 设置问题和选项之间的关联
Question_1.default.hasMany(Option_1.default, {
    foreignKey: 'questionId',
    as: 'options'
});
Option_1.default.belongsTo(Question_1.default, {
    foreignKey: 'questionId',
    as: 'question'
});
