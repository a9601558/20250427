"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const sequelize_1 = require("sequelize");
const db_1 = require("../config/db");
// 题集模型类
class QuestionSet extends sequelize_1.Model {
}
// 初始化模型
QuestionSet.init({
    id: {
        type: sequelize_1.DataTypes.UUID,
        defaultValue: sequelize_1.DataTypes.UUIDV4,
        primaryKey: true,
    },
    title: {
        type: sequelize_1.DataTypes.STRING(100),
        allowNull: false,
        validate: {
            notEmpty: true
        }
    },
    description: {
        type: sequelize_1.DataTypes.TEXT,
        allowNull: false
    },
    category: {
        type: sequelize_1.DataTypes.STRING(50),
        allowNull: false
    },
    icon: {
        type: sequelize_1.DataTypes.STRING(50),
        allowNull: false
    },
    isPaid: {
        type: sequelize_1.DataTypes.BOOLEAN,
        allowNull: false,
        defaultValue: false
    },
    price: {
        type: sequelize_1.DataTypes.DECIMAL(10, 2),
        allowNull: true,
        validate: {
            min: 0
        }
    },
    trialQuestions: {
        type: sequelize_1.DataTypes.INTEGER,
        allowNull: true,
        defaultValue: 0,
        validate: {
            min: 0
        }
    }
}, {
    sequelize: db_1.sequelize,
    tableName: 'question_sets',
    indexes: [
        { fields: ['category'] }
    ],
    hooks: {
        beforeValidate: (questionSet) => {
            // 如果是付费题集，价格必须大于0
            if (questionSet.isPaid && (!questionSet.price || questionSet.price <= 0)) {
                throw new Error('Paid question sets must have a price greater than 0');
            }
        }
    }
});
exports.default = QuestionSet;
