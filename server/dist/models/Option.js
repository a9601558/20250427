"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const sequelize_1 = require("sequelize");
const database_1 = __importDefault(require("../config/database"));
// 选项模型类
class Option extends sequelize_1.Model {
    id;
    questionId;
    text;
    isCorrect;
    optionIndex;
    // 时间戳
    createdAt;
    updatedAt;
}
// 初始化模型
Option.init({
    id: {
        type: sequelize_1.DataTypes.UUID,
        defaultValue: sequelize_1.DataTypes.UUIDV4,
        primaryKey: true,
    },
    questionId: {
        type: sequelize_1.DataTypes.UUID,
        allowNull: false,
        references: {
            model: 'questions',
            key: 'id'
        }
    },
    text: {
        type: sequelize_1.DataTypes.TEXT,
        allowNull: false
    },
    isCorrect: {
        type: sequelize_1.DataTypes.BOOLEAN,
        allowNull: false,
        defaultValue: false
    },
    optionIndex: {
        type: sequelize_1.DataTypes.STRING(5),
        allowNull: false
    }
}, {
    sequelize: database_1.default,
    tableName: 'options',
    indexes: [
        { fields: ['questionId'] }
    ]
});
exports.default = Option;
