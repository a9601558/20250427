"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.initPurchaseAssociations = void 0;
const sequelize_1 = require("sequelize");
const db_1 = require("../config/db");
const QuestionSet_1 = __importDefault(require("./QuestionSet"));
const User_1 = __importDefault(require("./User"));
// 购买记录模型类
class Purchase extends sequelize_1.Model {
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
    sequelize: db_1.sequelize,
    tableName: 'purchases',
    indexes: [
        { fields: ['userId'] },
        { fields: ['questionSetId'] },
        { unique: true, fields: ['transactionId'] },
        { fields: ['status'] }
    ]
});
// 声明关联
const initPurchaseAssociations = () => {
    Purchase.belongsTo(User_1.default, { foreignKey: 'userId' });
    Purchase.belongsTo(QuestionSet_1.default, { foreignKey: 'questionSetId' });
};
exports.initPurchaseAssociations = initPurchaseAssociations;
exports.default = Purchase;
