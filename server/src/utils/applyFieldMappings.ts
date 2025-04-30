/**
 * 全局字段映射修复工具
 */
import { Model, ModelCtor } from 'sequelize';
import QuestionSet from '../models/QuestionSet';
import Purchase from '../models/Purchase';
import Question from '../models/Question';
import { questionSetAttributes, purchaseAttributes, purchaseQuestionSetAttributes } from './sequelizeHelpers';

/**
 * 应用字段映射到所有模型的查询方法
 * 这个函数扩展了Sequelize模型的原始方法，确保在每次查询时都应用正确的字段映射
 */
export const applyGlobalFieldMappings = () => {
  console.log('正在应用全局字段映射修复...');

  // 扩展QuestionSet.findAll方法
  const originalQuestionSetFindAll = QuestionSet.findAll;
  QuestionSet.findAll = function(...args: any[]) {
    if (args[0] && !args[0].attributes) {
      args[0].attributes = questionSetAttributes;
    }
    return originalQuestionSetFindAll.apply(this, args);
  };

  // 扩展Purchase.findAll方法
  const originalPurchaseFindAll = Purchase.findAll;
  Purchase.findAll = function(...args: any[]) {
    if (args[0] && !args[0].attributes) {
      args[0].attributes = purchaseAttributes;
    }
    
    // 如果有包含QuestionSet，添加属性映射
    if (args[0] && args[0].include) {
      const includes = Array.isArray(args[0].include) ? args[0].include : [args[0].include];
      
      for (const include of includes) {
        if (include.model === QuestionSet && include.as === 'purchaseQuestionSet' && !include.attributes) {
          include.attributes = purchaseQuestionSetAttributes;
        }
      }
    }
    
    return originalPurchaseFindAll.apply(this, args);
  };

  console.log('全局字段映射修复已应用');
};

/**
 * 测试属性映射是否正确
 * 这是一个辅助方法，用于检查属性映射是否正确生效
 */
export const testFieldMappings = async () => {
  try {
    // 测试QuestionSet查询
    const questionSets = await QuestionSet.findAll({ limit: 1 });
    console.log('QuestionSet查询结果示例:', 
      questionSets.length > 0 ? 
      JSON.stringify(questionSets[0].toJSON(), null, 2).substring(0, 200) + '...' :
      '无数据'
    );

    // 测试Purchase查询
    const purchases = await Purchase.findAll({ limit: 1 });
    console.log('Purchase查询结果示例:', 
      purchases.length > 0 ? 
      JSON.stringify(purchases[0].toJSON(), null, 2).substring(0, 200) + '...' :
      '无数据'
    );

    console.log('字段映射测试完成');
    return true;
  } catch (error) {
    console.error('字段映射测试失败:', error);
    return false;
  }
}; 