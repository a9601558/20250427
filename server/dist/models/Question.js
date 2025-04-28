"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const sequelize_1 = require("sequelize");
const database_1 = __importDefault(require("../config/database"));
const uuid_1 = require("uuid");
// 问题模型类
class Question extends sequelize_1.Model {
    id;
    questionSetId;
    text;
    questionType;
    explanation;
    orderIndex;
    // 时间戳
    createdAt;
    updatedAt;
}
// 初始化模型
Question.init({
    id: {
        type: sequelize_1.DataTypes.UUID,
        defaultValue: () => (0, uuid_1.v4)(),
        primaryKey: true,
    },
    questionSetId: {
        type: sequelize_1.DataTypes.UUID,
        allowNull: false,
        references: {
            model: 'question_sets',
            key: 'id'
        }
    },
    text: {
        type: sequelize_1.DataTypes.TEXT,
        allowNull: false,
        validate: {
            notNull: {
                msg: 'text字段不能为null'
            },
            notEmpty: {
                msg: 'text字段不能为空'
            }
        },
        set(value) {
            // 确保值不为null或空字符串
            if (value === null || value === undefined || value === '') {
                this.setDataValue('text', '未命名问题');
            }
            else {
                this.setDataValue('text', String(value).trim());
            }
        }
    },
    questionType: {
        type: sequelize_1.DataTypes.ENUM('single', 'multiple'),
        allowNull: false,
        defaultValue: 'single'
    },
    explanation: {
        type: sequelize_1.DataTypes.TEXT,
        allowNull: false
    },
    orderIndex: {
        type: sequelize_1.DataTypes.INTEGER,
        allowNull: false,
        defaultValue: 0
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
