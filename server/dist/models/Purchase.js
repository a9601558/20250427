"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const sequelize_1 = require("sequelize");
const database_1 = __importDefault(require("../config/database"));
// 购买记录模型类
class Purchase extends sequelize_1.Model {
    id;
    userId;
    questionSetId;
    purchaseDate;
    expiryDate;
    transactionId;
    amount;
    paymentMethod;
    status;
    // 时间戳
    createdAt;
    updatedAt;
}
// 初始化模型
Purchase.init({
    id: {
        type: sequelize_1.DataTypes.UUID,
        defaultValue: sequelize_1.DataTypes.UUIDV4,
        primaryKey: true,
    },
    userId: {
        type: sequelize_1.DataTypes.UUID,
        allowNull: false,
        references: {
            model: 'users',
            key: 'id'
        }
    },
    questionSetId: {
        type: sequelize_1.DataTypes.UUID,
        allowNull: false,
        references: {
            model: 'question_sets',
            key: 'id'
        }
    },
    purchaseDate: {
        type: sequelize_1.DataTypes.DATE,
        allowNull: false,
        defaultValue: sequelize_1.DataTypes.NOW
    },
    expiryDate: {
        type: sequelize_1.DataTypes.DATE,
        allowNull: false
    },
    transactionId: {
        type: sequelize_1.DataTypes.STRING(100),
        allowNull: false,
        unique: true
    },
    amount: {
        type: sequelize_1.DataTypes.DECIMAL(10, 2),
        allowNull: false,
        validate: {
            min: 0
        }
    },
    paymentMethod: {
        type: sequelize_1.DataTypes.STRING(20),
        allowNull: false,
        defaultValue: 'card'
    },
    status: {
        type: sequelize_1.DataTypes.ENUM('pending', 'completed', 'failed', 'refunded'),
        allowNull: false,
        defaultValue: 'pending'
    }
}, {
    sequelize: database_1.default,
    tableName: 'purchases',
    indexes: [
        { fields: ['userId'] },
        { fields: ['questionSetId'] },
        { unique: true, fields: ['transactionId'] },
        { fields: ['status'] }
    ]
});
exports.default = Purchase;
