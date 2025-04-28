"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const sequelize_1 = require("sequelize");
const database_1 = __importDefault(require("../config/database"));
const Question_1 = __importDefault(require("./Question"));
// 题集模型类
class QuestionSet extends sequelize_1.Model {
    id;
    title;
    description;
    category;
    icon;
    isPaid;
    price;
    trialQuestions;
    isFeatured;
    featuredCategory;
    // 时间戳
    createdAt;
    updatedAt;
    // 关联
    questions;
}
// 初始化模型
QuestionSet.init({
    id: {
        type: sequelize_1.DataTypes.UUID,
        defaultValue: sequelize_1.DataTypes.UUIDV4,
        primaryKey: true,
    },
    title: {
        type: sequelize_1.DataTypes.STRING,
        allowNull: false,
    },
    description: {
        type: sequelize_1.DataTypes.TEXT,
        allowNull: false,
    },
    category: {
        type: sequelize_1.DataTypes.STRING,
        allowNull: false,
    },
    icon: {
        type: sequelize_1.DataTypes.STRING,
        allowNull: false,
        defaultValue: 'default',
    },
    isPaid: {
        type: sequelize_1.DataTypes.BOOLEAN,
        allowNull: false,
        defaultValue: false,
    },
    price: {
        type: sequelize_1.DataTypes.DECIMAL(10, 2),
        allowNull: true,
    },
    trialQuestions: {
        type: sequelize_1.DataTypes.INTEGER,
        allowNull: true,
    },
    isFeatured: {
        type: sequelize_1.DataTypes.BOOLEAN,
        allowNull: false,
        defaultValue: false,
    },
    featuredCategory: {
        type: sequelize_1.DataTypes.STRING,
        allowNull: true,
    },
}, {
    sequelize: database_1.default,
    modelName: 'QuestionSet',
    tableName: 'question_sets',
});
// 设置关联
QuestionSet.hasMany(Question_1.default, {
    foreignKey: 'questionSetId',
    as: 'questions',
});
exports.default = QuestionSet;
