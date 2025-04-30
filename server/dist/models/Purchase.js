"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const sequelize_1 = require("sequelize");
const database_1 = __importDefault(require("../config/database"));
class Purchase extends sequelize_1.Model {
    id;
    userId;
    questionSetId;
    amount;
    status;
    paymentMethod;
    transactionId;
    purchaseDate;
    expiryDate;
    createdAt;
    updatedAt;
    // 关联
    user;
    purchaseQuestionSet;
}
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
    amount: {
        type: sequelize_1.DataTypes.DECIMAL(10, 2),
        allowNull: false,
    },
    status: {
        type: sequelize_1.DataTypes.STRING,
        allowNull: false,
        defaultValue: 'pending',
    },
    paymentMethod: {
        type: sequelize_1.DataTypes.STRING,
        allowNull: true,
    },
    transactionId: {
        type: sequelize_1.DataTypes.STRING,
        allowNull: true,
    },
    purchaseDate: {
        type: sequelize_1.DataTypes.DATE,
        allowNull: false,
        defaultValue: sequelize_1.DataTypes.NOW,
    },
    expiryDate: {
        type: sequelize_1.DataTypes.DATE,
        allowNull: false,
    },
    createdAt: {
        type: sequelize_1.DataTypes.DATE,
        allowNull: false,
        defaultValue: sequelize_1.DataTypes.NOW,
    },
    updatedAt: {
        type: sequelize_1.DataTypes.DATE,
        allowNull: false,
        defaultValue: sequelize_1.DataTypes.NOW,
    },
}, {
    sequelize: database_1.default,
    modelName: 'Purchase',
    tableName: 'purchases',
    underscored: true,
    timestamps: true,
    indexes: [
        { fields: ['userId'] },
        { fields: ['questionSetId'] },
        { fields: ['userId', 'questionSetId'] }
    ]
});
exports.default = Purchase;
