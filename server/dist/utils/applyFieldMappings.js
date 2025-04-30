"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.testFieldMappings = exports.applyGlobalFieldMappings = void 0;
const QuestionSet_1 = __importDefault(require("../models/QuestionSet"));
const Purchase_1 = __importDefault(require("../models/Purchase"));
const sequelizeHelpers_1 = require("./sequelizeHelpers");
/**
 * 应用字段映射到所有模型的查询方法
 * 这个函数扩展了Sequelize模型的原始方法，确保在每次查询时都应用正确的字段映射
 */
const applyGlobalFieldMappings = () => {
    console.log('正在应用全局字段映射修复...');
    // 扩展QuestionSet.findAll方法
    const originalQuestionSetFindAll = QuestionSet_1.default.findAll;
    QuestionSet_1.default.findAll = function (...args) {
        if (args[0] && !args[0].attributes) {
            args[0].attributes = sequelizeHelpers_1.questionSetAttributes;
        }
        return originalQuestionSetFindAll.apply(this, args);
    };
    // 扩展Purchase.findAll方法
    const originalPurchaseFindAll = Purchase_1.default.findAll;
    Purchase_1.default.findAll = function (...args) {
        if (args[0] && !args[0].attributes) {
            args[0].attributes = sequelizeHelpers_1.purchaseAttributes;
        }
        // 如果有包含QuestionSet，添加属性映射
        if (args[0] && args[0].include) {
            const includes = Array.isArray(args[0].include) ? args[0].include : [args[0].include];
            for (const include of includes) {
                if (include.model === QuestionSet_1.default && include.as === 'purchaseQuestionSet' && !include.attributes) {
                    include.attributes = sequelizeHelpers_1.purchaseQuestionSetAttributes;
                }
            }
        }
        return originalPurchaseFindAll.apply(this, args);
    };
    console.log('全局字段映射修复已应用');
};
exports.applyGlobalFieldMappings = applyGlobalFieldMappings;
/**
 * 测试属性映射是否正确
 * 这是一个辅助方法，用于检查属性映射是否正确生效
 */
const testFieldMappings = async () => {
    try {
        // 测试QuestionSet查询
        const questionSets = await QuestionSet_1.default.findAll({ limit: 1 });
        console.log('QuestionSet查询结果示例:', questionSets.length > 0 ?
            JSON.stringify(questionSets[0].toJSON(), null, 2).substring(0, 200) + '...' :
            '无数据');
        // 测试Purchase查询
        const purchases = await Purchase_1.default.findAll({ limit: 1 });
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
