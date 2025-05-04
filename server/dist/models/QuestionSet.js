"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.setupQuestionSetAssociations = void 0;
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
    questionSetQuestions;
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
        field: 'is_paid',
    },
    price: {
        type: sequelize_1.DataTypes.DECIMAL(10, 2),
        allowNull: true,
        field: 'price',
    },
    trialQuestions: {
        type: sequelize_1.DataTypes.INTEGER,
        allowNull: true,
        field: 'trial_questions',
    },
    isFeatured: {
        type: sequelize_1.DataTypes.BOOLEAN,
        allowNull: false,
        defaultValue: false,
        field: 'is_featured',
    },
    featuredCategory: {
        type: sequelize_1.DataTypes.STRING,
        allowNull: true,
        field: 'featured_category',
    },
}, {
    sequelize: database_1.default,
    modelName: 'QuestionSet',
    tableName: 'question_sets',
    underscored: true,
    timestamps: true,
    createdAt: 'created_at',
    updatedAt: 'updated_at',
});
// After the QuestionSet init, add model associations
const setupQuestionSetAssociations = () => {
    // Add the hasMany relationship from QuestionSet to Question
    QuestionSet.hasMany(Question_1.default, {
        foreignKey: 'questionSetId',
        as: 'questions',
        onDelete: 'CASCADE',
        onUpdate: 'CASCADE'
    });
};
exports.setupQuestionSetAssociations = setupQuestionSetAssociations;
exports.default = QuestionSet;
