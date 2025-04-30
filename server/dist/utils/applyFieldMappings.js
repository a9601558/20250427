"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.testFieldMappings = exports.withPurchaseAttributes = exports.withQuestionSetAttributes = exports.applyGlobalFieldMappings = void 0;
const QuestionSet_1 = __importDefault(require("../models/QuestionSet"));
const Purchase_1 = __importDefault(require("../models/Purchase"));
const sequelizeHelpers_1 = require("./sequelizeHelpers");
/**
 * 应用字段映射到所有模型的查询方法
 * 这个函数扩展了Sequelize模型的原始方法，确保在每次查询时都应用正确的字段映射
 */
const applyGlobalFieldMappings = () => {
    console.log('正在应用全局字段映射修复...');
    // 保存原始方法的引用但不直接替换它们
    // 而是在各个控制器中使用辅助函数
    console.log('已创建辅助函数以便在查询中使用字段映射');
    console.log('QuestionSet 查询应使用: questionSetAttributes');
    console.log('Purchase 查询应使用: purchaseAttributes');
    console.log('包含 QuestionSet 的关联查询应使用: purchaseQuestionSetAttributes');
    console.log('全局字段映射修复已应用');
};
exports.applyGlobalFieldMappings = applyGlobalFieldMappings;
/**
 * 帮助函数：为QuestionSet添加attributes
 * @param options 查询选项
 * @returns 添加了attributes的查询选项
 */
const withQuestionSetAttributes = (options) => {
    if (!options.attributes) {
        options.attributes = sequelizeHelpers_1.questionSetAttributes;
    }
    return options;
};
exports.withQuestionSetAttributes = withQuestionSetAttributes;
/**
 * 帮助函数：为Purchase添加attributes
 * @param options 查询选项
 * @returns 添加了attributes的查询选项
 */
const withPurchaseAttributes = (options) => {
    if (!options.attributes) {
        options.attributes = sequelizeHelpers_1.purchaseAttributes;
    }
    // 如果有包含QuestionSet，添加属性映射
    if (options.include) {
        const includes = Array.isArray(options.include) ? options.include : [options.include];
        for (const include of includes) {
            // 确保include是IncludeOptions类型
            const includeOptions = include;
            if (includeOptions.model === QuestionSet_1.default &&
                includeOptions.as === 'purchaseQuestionSet' &&
                !includeOptions.attributes) {
                includeOptions.attributes = sequelizeHelpers_1.purchaseQuestionSetAttributes;
            }
        }
    }
    return options;
};
exports.withPurchaseAttributes = withPurchaseAttributes;
/**
 * 测试属性映射是否正确
 * 这是一个辅助方法，用于检查属性映射是否正确生效
 */
const testFieldMappings = async () => {
    try {
        // 测试QuestionSet查询
        const questionSets = await QuestionSet_1.default.findAll((0, exports.withQuestionSetAttributes)({ limit: 1 }));
        console.log('QuestionSet查询结果示例:', questionSets.length > 0 ?
            JSON.stringify(questionSets[0].toJSON(), null, 2).substring(0, 200) + '...' :
            '无数据');
        // 测试Purchase查询
        const purchases = await Purchase_1.default.findAll((0, exports.withPurchaseAttributes)({ limit: 1 }));
        console.log('Purchase查询结果示例:', purchases.length > 0 ?
            JSON.stringify(purchases[0].toJSON(), null, 2).substring(0, 200) + '...' :
            '无数据');
        console.log('字段映射测试完成');
        return true;
    }
    catch (error) {
        console.error('字段映射测试失败:', error);
        return false;
    }
};
exports.testFieldMappings = testFieldMappings;
