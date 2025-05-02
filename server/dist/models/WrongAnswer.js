
// Sequelize Instance Recovery - 自动添加于 2025-05-02T10:36:55.660Z
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
class WrongAnswer extends sequelize_1.Model {
    id;
    userId;
    questionId;
    questionSetId;
    question;
    questionType;
    options;
    selectedOption;
    selectedOptions;
    correctOption;
    correctOptions;
    explanation;
    memo;
    // 时间戳
    createdAt;
    updatedAt;
}
WrongAnswer.init({
    id: {
        type: sequelize_1.DataTypes.UUID,
        defaultValue: sequelize_1.DataTypes.UUIDV4,
        primaryKey: true,
    },
    userId: {
        type: sequelize_1.DataTypes.UUID,
        allowNull: false,
    },
    questionId: {
        type: sequelize_1.DataTypes.UUID,
        allowNull: false,
    },
    questionSetId: {
        type: sequelize_1.DataTypes.UUID,
        allowNull: false,
    },
    question: {
        type: sequelize_1.DataTypes.TEXT,
        allowNull: false,
    },
    questionType: {
        type: sequelize_1.DataTypes.STRING,
        allowNull: false,
    },
    options: {
        type: sequelize_1.DataTypes.JSON,
        allowNull: false,
    },
    selectedOption: {
        type: sequelize_1.DataTypes.STRING,
        allowNull: true,
    },
    selectedOptions: {
        type: sequelize_1.DataTypes.JSON,
        allowNull: true,
    },
    correctOption: {
        type: sequelize_1.DataTypes.STRING,
        allowNull: true,
    },
    correctOptions: {
        type: sequelize_1.DataTypes.JSON,
        allowNull: true,
    },
    explanation: {
        type: sequelize_1.DataTypes.TEXT,
        allowNull: true,
    },
    memo: {
        type: sequelize_1.DataTypes.TEXT,
        allowNull: true,
    },
}, {
    sequelize: database_1.default,
    modelName: 'WrongAnswer',
    tableName: 'WrongAnswers',
});
exports.default = WrongAnswer;
