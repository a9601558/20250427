"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const sequelize_1 = require("sequelize");
const db_1 = require("../config/db");
// 问题模型类
class Question extends sequelize_1.Model {
}
// 初始化模型
Question.init({
    id: {
        type: sequelize_1.DataTypes.UUID,
        defaultValue: sequelize_1.DataTypes.UUIDV4,
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
        allowNull: false
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
    sequelize: db_1.sequelize,
    tableName: 'questions',
    indexes: [
        { fields: ['questionSetId'] },
        { fields: ['questionSetId', 'orderIndex'] }
    ]
});
exports.default = Question;
