
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
// 题集模型类
class QuestionSet extends sequelize_1.Model {
    id;
    title;
    description;
    category;
    icon;
    isPaid;
    price;
    trialQuestions;
    isFeatured;
    featuredCategory;
    // 时间戳
    createdAt;
    updatedAt;
    // 关联
    questionSetQuestions;
}
// 初始化模型
QuestionSet.init({
    id: {
        type: sequelize_1.DataTypes.UUID,
        defaultValue: sequelize_1.DataTypes.UUIDV4,
        primaryKey: true,
    },
    title: {
        type: sequelize_1.DataTypes.STRING,
        allowNull: false,
    },
    description: {
        type: sequelize_1.DataTypes.TEXT,
        allowNull: false,
    },
    category: {
        type: sequelize_1.DataTypes.STRING,
        allowNull: false,
    },
    icon: {
        type: sequelize_1.DataTypes.STRING,
        allowNull: false,
        defaultValue: 'default',
    },
    isPaid: {
        type: sequelize_1.DataTypes.BOOLEAN,
        allowNull: false,
        defaultValue: false,
        field: 'is_paid',
    },
    price: {
        type: sequelize_1.DataTypes.DECIMAL(10, 2),
        allowNull: true,
        field: 'price',
    },
    trialQuestions: {
        type: sequelize_1.DataTypes.INTEGER,
        allowNull: true,
        field: 'trial_questions',
    },
    isFeatured: {
        type: sequelize_1.DataTypes.BOOLEAN,
        allowNull: false,
        defaultValue: false,
        field: 'is_featured',
    },
    featuredCategory: {
        type: sequelize_1.DataTypes.STRING,
        allowNull: true,
        field: 'featured_category',
    },
}, {
    sequelize: database_1.default,
    modelName: 'QuestionSet',
    tableName: 'question_sets',
    underscored: true,
    timestamps: true,
    createdAt: 'created_at',
    updatedAt: 'updated_at',
});
exports.default = QuestionSet;
