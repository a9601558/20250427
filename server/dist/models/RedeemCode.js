
// Sequelize Instance Recovery - 自动添加于 2025-05-02T10:36:55.644Z
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
// 兑换码模型类
class RedeemCode extends sequelize_1.Model {
    id;
    code;
    questionSetId;
    validityDays;
    expiryDate;
    isUsed;
    usedBy;
    usedAt;
    createdBy;
    // 时间戳
    createdAt;
    updatedAt;
    // 关联
    redeemQuestionSet;
    redeemUser;
    redeemCreator;
    // 静态方法：生成唯一兑换码
    static async generateUniqueCode(length = 8) {
        const characters = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789';
        let code;
        let isUnique = false;
        while (!isUnique) {
            // 生成随机码
            code = Array.from({ length }, () => characters.charAt(Math.floor(Math.random() * characters.length))).join('');
            // 检查是否唯一
            const existingCode = await RedeemCode.findOne({ where: { code } });
            if (!existingCode) {
                isUnique = true;
            }
        }
        return code;
    }
}
// 初始化模型
RedeemCode.init({
    id: {
        type: sequelize_1.DataTypes.UUID,
        defaultValue: sequelize_1.DataTypes.UUIDV4,
        primaryKey: true,
    },
    code: {
        type: sequelize_1.DataTypes.STRING(20),
        allowNull: false,
        unique: true,
    },
    questionSetId: {
        type: sequelize_1.DataTypes.UUID,
        allowNull: false,
        references: {
            model: 'question_sets',
            key: 'id',
        },
    },
    validityDays: {
        type: sequelize_1.DataTypes.INTEGER,
        allowNull: false,
        validate: {
            min: 1,
        },
    },
    expiryDate: {
        type: sequelize_1.DataTypes.DATE,
        allowNull: false,
    },
    isUsed: {
        type: sequelize_1.DataTypes.BOOLEAN,
        allowNull: false,
        defaultValue: false,
    },
    usedBy: {
        type: sequelize_1.DataTypes.UUID,
        allowNull: true,
        references: {
            model: 'users',
            key: 'id',
        },
    },
    usedAt: {
        type: sequelize_1.DataTypes.DATE,
        allowNull: true,
    },
    createdBy: {
        type: sequelize_1.DataTypes.UUID,
        allowNull: false,
        references: {
            model: 'users',
            key: 'id',
        },
    },
}, {
    sequelize: database_1.default,
    tableName: 'redeem_codes',
    indexes: [
        { unique: true, fields: ['code'] },
        { fields: ['questionSetId'] },
        { fields: ['isUsed'] },
        { fields: ['usedBy'] },
        { fields: ['createdBy'] },
    ],
    hooks: {
        beforeValidate: async (redeemCode) => {
            // 如果没有提供兑换码，自动生成
            if (!redeemCode.code) {
                redeemCode.code = await RedeemCode.generateUniqueCode();
            }
            // 如果没有提供过期日期，基于有效天数计算
            if (!redeemCode.expiryDate) {
                const expiryDate = new Date();
                expiryDate.setDate(expiryDate.getDate() + redeemCode.validityDays);
                redeemCode.expiryDate = expiryDate;
            }
        },
    },
});
exports.default = RedeemCode;
