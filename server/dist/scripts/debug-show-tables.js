"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const db_1 = require("../config/db");
const QuestionSet_1 = __importDefault(require("../models/QuestionSet"));
async function debugTables() {
    try {
        // 查询所有表
        console.log('正在查询所有数据库表...');
        const tables = await db_1.sequelize.getQueryInterface().showAllTables();
        console.log('数据库中的表:', tables);
        // 查询 question_sets 表结构
        if (tables.includes('question_sets')) {
            console.log('\n正在查询 question_sets 表结构...');
            const describe = await db_1.sequelize.getQueryInterface().describeTable('question_sets');
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
