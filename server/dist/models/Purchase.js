
// Sequelize Instance Recovery - 自动添加于 2025-05-02T10:30:00.527Z
// 这段代码确保Sequelize模型总是有有效的实例，即使在模块导入失败的情况下
(function() {
  try {
    // 修复空的sequelize实例
    if (typeof global.sequelize === 'undefined' && 
        (typeof sequelize === 'undefined' || !sequelize)) {
      const { Sequelize } = require('sequelize');
      const path = require('path');
      const fs = require('fs');
      const dotenv = require('dotenv');
      
      // 加载环境变量
      const envPath = path.join(process.cwd(), '.env');
      if (fs.existsSync(envPath)) {
        console.log('Recovery: 加载环境变量文件', envPath);
        dotenv.config({ path: envPath });
      }
      
      console.log('Recovery: 创建应急Sequelize实例');
      global.sequelize = new Sequelize(
        process.env.DB_NAME || 'quiz_app',
        process.env.DB_USER || 'root',
        process.env.DB_PASSWORD || '',
        {
          host: process.env.DB_HOST || 'localhost',
          port: parseInt(process.env.DB_PORT || '3306'),
          dialect: 'mysql',
          logging: false,
          pool: { max: 5, min: 0, acquire: 30000, idle: 10000 }
        }
      );
      
      // 设置全局变量，避免"未定义"错误
      if (typeof sequelize === 'undefined') {
        global.sequelize = global.sequelize;
      }
    }
  } catch (error) {
    console.error('Recovery: Sequelize恢复机制出错', error);
  }
})();
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
            key: 'id',
        },
    },
    questionSetId: {
        type: sequelize_1.DataTypes.UUID,
        allowNull: false,
        field: 'question_set_id',
        references: {
            model: 'question_sets',
            key: 'id',
        },
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
        { fields: ['user_id', 'question_set_id'] },
    ],
});
exports.default = Purchase;
