
// Sequelize Instance Recovery - 自动添加于 2025-05-02T10:36:55.666Z
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
/**
 * Sequelize辅助函数
 */
Object.defineProperty(exports, "__esModule", { value: true });
exports.purchaseQuestionSetAttributes = exports.purchaseAttributes = exports.questionSetAttributes = exports.mapAttributes = void 0;
/**
 * 生成明确的字段映射属性，将蛇形命名法映射到驼峰命名法
 * @param fieldsMap 字段映射对象，键为蛇形命名法字段名，值为驼峰命名法属性名
 * @returns 用于Sequelize查询的attributes数组
 */
const mapAttributes = (fieldsMap) => {
    return Object.entries(fieldsMap).map(([dbField, modelField]) => {
        // 如果字段名相同，直接返回字符串
        if (dbField === modelField) {
            return dbField;
        }
        // 否则返回映射数组 [数据库字段名, 模型属性名]
        return [dbField, modelField];
    });
};
exports.mapAttributes = mapAttributes;
/**
 * QuestionSet模型的属性映射
 */
exports.questionSetAttributes = (0, exports.mapAttributes)({
    'id': 'id',
    'title': 'title',
    'description': 'description',
    'category': 'category',
    'icon': 'icon',
    'is_paid': 'isPaid',
    'price': 'price',
    'trial_questions': 'trialQuestions',
    'is_featured': 'isFeatured',
    'featured_category': 'featuredCategory',
    'created_at': 'createdAt',
    'updated_at': 'updatedAt',
});
/**
 * Purchase模型的属性映射
 */
exports.purchaseAttributes = (0, exports.mapAttributes)({
    'id': 'id',
    'user_id': 'userId',
    'question_set_id': 'questionSetId',
    'amount': 'amount',
    'status': 'status',
    'payment_method': 'paymentMethod',
    'transaction_id': 'transactionId',
    'purchase_date': 'purchaseDate',
    'expiry_date': 'expiryDate',
    'created_at': 'createdAt',
    'updated_at': 'updatedAt',
});
/**
 * 购买记录中QuestionSet包含属性的映射
 */
exports.purchaseQuestionSetAttributes = (0, exports.mapAttributes)({
    'id': 'id',
    'title': 'title',
    'category': 'category',
    'icon': 'icon',
    'is_paid': 'isPaid',
    'price': 'price',
});
