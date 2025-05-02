
// Sequelize Instance Recovery - 自动添加于 2025-05-02T10:36:55.662Z
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
const database_1 = __importDefault(require("../config/database"));
const QuestionSet_1 = __importDefault(require("../models/QuestionSet"));
async function debugTables() {
    try {
        // 查询所有表
        console.log('正在查询所有数据库表...');
        const tables = await database_1.default.getQueryInterface().showAllTables();
        console.log('数据库中的表:', tables);
        // 查询 question_sets 表结构
        if (tables.includes('question_sets')) {
            console.log('\n正在查询 question_sets 表结构...');
            const describe = await database_1.default.getQueryInterface().describeTable('question_sets');
            console.log('question_sets 表结构:');
            console.log(JSON.stringify(describe, null, 2));
        }
        else {
            console.log('数据库中不存在 question_sets 表!');
        }
        // 输出 Sequelize 模型信息
        console.log('\nQuestionSet 模型定义:');
        console.log(QuestionSet_1.default.getAttributes());
        process.exit(0);
    }
    catch (error) {
        console.error('调试表结构时出错:', error);
        process.exit(1);
    }
}
debugTables();
