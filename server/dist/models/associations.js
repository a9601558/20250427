"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.setupAssociations = void 0;
const Question_1 = __importDefault(require("./Question"));
const Option_1 = __importDefault(require("./Option"));
const setupAssociations = () => {
    // Question 和 Option 的关联
    Question_1.default.hasMany(Option_1.default, {
        foreignKey: 'questionId',
        as: 'options'
    });
    Option_1.default.belongsTo(Question_1.default, {
        foreignKey: 'questionId',
        as: 'question'
    });
};
exports.setupAssociations = setupAssociations;
