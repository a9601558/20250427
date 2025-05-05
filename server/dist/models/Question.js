"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const sequelize_1 = require("sequelize");
const database_1 = __importDefault(require("../config/database"));
// 问题模型类
class Question extends sequelize_1.Model {
    id;
    questionSetId;
    text;
    questionType;
    explanation;
    orderIndex;
    difficulty;
    points;
    timeLimit;
    metadata;
    // 时间戳
    createdAt;
    updatedAt;
}
// 初始化模型
Question.init({
    id: {
        type: sequelize_1.DataTypes.UUID,
        defaultValue: sequelize_1.DataTypes.UUIDV4,
        primaryKey: true,
        allowNull: false
    },
    questionSetId: {
        type: sequelize_1.DataTypes.UUID,
        allowNull: false,
        references: {
            model: 'QuestionSets',
            key: 'id'
        }
    },
    text: {
        type: sequelize_1.DataTypes.TEXT,
        allowNull: false
    },
    questionType: {
        type: sequelize_1.DataTypes.STRING,
        allowNull: false
    },
    explanation: {
        type: sequelize_1.DataTypes.TEXT,
        allowNull: true,
        defaultValue: ''
    },
    orderIndex: {
        type: sequelize_1.DataTypes.INTEGER,
        allowNull: true,
        defaultValue: 0
    },
    difficulty: {
        type: sequelize_1.DataTypes.INTEGER,
        allowNull: true
    },
    points: {
        type: sequelize_1.DataTypes.INTEGER,
        allowNull: true
    },
    timeLimit: {
        type: sequelize_1.DataTypes.INTEGER,
        allowNull: true
    },
    metadata: {
        type: sequelize_1.DataTypes.TEXT,
        allowNull: true,
        comment: 'JSON metadata for storing additional question information'
    }
}, {
    sequelize: database_1.default,
    tableName: 'questions',
    indexes: [
        { fields: ['questionSetId'] },
        { fields: ['questionSetId', 'orderIndex'] }
    ]
});
exports.default = Question;
