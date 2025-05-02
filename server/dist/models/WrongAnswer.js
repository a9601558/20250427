"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const sequelize_1 = require("sequelize");
const database_1 = __importDefault(require("../config/database"));
class WrongAnswer extends sequelize_1.Model {
    id;
    userId;
    questionId;
    questionSetId;
    question;
    questionType;
    options;
    selectedOption;
    selectedOptions;
    correctOption;
    correctOptions;
    explanation;
    memo;
    // 时间戳
    createdAt;
    updatedAt;
}
WrongAnswer.init({
    id: {
        type: sequelize_1.DataTypes.UUID,
        defaultValue: sequelize_1.DataTypes.UUIDV4,
        primaryKey: true,
    },
    userId: {
        type: sequelize_1.DataTypes.UUID,
        allowNull: false,
    },
    questionId: {
        type: sequelize_1.DataTypes.UUID,
        allowNull: false,
    },
    questionSetId: {
        type: sequelize_1.DataTypes.UUID,
        allowNull: false,
    },
    question: {
        type: sequelize_1.DataTypes.TEXT,
        allowNull: false,
    },
    questionType: {
        type: sequelize_1.DataTypes.STRING,
        allowNull: false,
    },
    options: {
        type: sequelize_1.DataTypes.JSON,
        allowNull: false,
    },
    selectedOption: {
        type: sequelize_1.DataTypes.STRING,
        allowNull: true,
    },
    selectedOptions: {
        type: sequelize_1.DataTypes.JSON,
        allowNull: true,
    },
    correctOption: {
        type: sequelize_1.DataTypes.STRING,
        allowNull: true,
    },
    correctOptions: {
        type: sequelize_1.DataTypes.JSON,
        allowNull: true,
    },
    explanation: {
        type: sequelize_1.DataTypes.TEXT,
        allowNull: true,
    },
    memo: {
        type: sequelize_1.DataTypes.TEXT,
        allowNull: true,
    },
}, {
    sequelize: database_1.default,
    modelName: 'WrongAnswer',
    tableName: 'WrongAnswers',
});
exports.default = WrongAnswer;
