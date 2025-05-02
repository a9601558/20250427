
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
            key: 'id',
        },
    },
    text: {
        type: sequelize_1.DataTypes.TEXT,
        allowNull: false,
        validate: {
            notNull: {
                msg: 'text字段不能为null',
            },
            notEmpty: {
                msg: 'text字段不能为空',
            },
        },
        set(value) {
            // 确保值不为null或空字符串
            if (value === null || value === undefined || value === '') {
                this.setDataValue('text', '未命名问题');
            }
            else {
                this.setDataValue('text', String(value).trim());
            }
        },
    },
    questionType: {
        type: sequelize_1.DataTypes.ENUM('single', 'multiple'),
        allowNull: false,
        defaultValue: 'single',
    },
    explanation: {
        type: sequelize_1.DataTypes.TEXT,
        allowNull: false,
    },
    orderIndex: {
        type: sequelize_1.DataTypes.INTEGER,
        allowNull: false,
        defaultValue: 0,
    },
}, {
    sequelize: database_1.default,
    tableName: 'questions',
    indexes: [
        { fields: ['questionSetId'] },
        { fields: ['questionSetId', 'orderIndex'] },
    ],
});
exports.default = Question;
