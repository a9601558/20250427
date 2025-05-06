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
        field: 'user_id',
        references: {
            model: 'users',
            key: 'id'
        },
        onDelete: 'CASCADE'
    },
    questionSetId: {
        type: sequelize_1.DataTypes.UUID,
        allowNull: false,
        field: 'question_set_id',
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
        field: 'payment_method',
    },
    transactionId: {
        type: sequelize_1.DataTypes.STRING,
        allowNull: true,
        field: 'transaction_id',
    },
    purchaseDate: {
        type: sequelize_1.DataTypes.DATE,
        allowNull: false,
        defaultValue: sequelize_1.DataTypes.NOW,
        field: 'purchase_date',
    },
    expiryDate: {
        type: sequelize_1.DataTypes.DATE,
        allowNull: false,
        field: 'expiry_date',
    },
    createdAt: {
        type: sequelize_1.DataTypes.DATE,
        allowNull: false,
        defaultValue: sequelize_1.DataTypes.NOW,
        field: 'created_at',
    },
    updatedAt: {
        type: sequelize_1.DataTypes.DATE,
        allowNull: false,
        defaultValue: sequelize_1.DataTypes.NOW,
        field: 'updated_at',
    },
}, {
    sequelize: database_1.default,
    modelName: 'Purchase',
    tableName: 'purchases',
    underscored: true,
    timestamps: true,
    createdAt: 'created_at',
    updatedAt: 'updated_at',
    indexes: [
        { fields: ['user_id'] },
        { fields: ['question_set_id'] },
        { fields: ['user_id', 'question_set_id'] }
    ]
});
exports.default = Purchase;
