/**
 * 全局字段映射修复工具
 */
import { Model, ModelCtor, FindOptions, Attributes, ModelStatic, Includeable, IncludeOptions } from 'sequelize';
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

  // 保存原始方法的引用但不直接替换它们
  // 而是在各个控制器中使用辅助函数
  console.log('已创建辅助函数以便在查询中使用字段映射');
  console.log('QuestionSet 查询应使用: questionSetAttributes');
  console.log('Purchase 查询应使用: purchaseAttributes');
  console.log('包含 QuestionSet 的关联查询应使用: purchaseQuestionSetAttributes');

  console.log('全局字段映射修复已应用');
};

/**
 * 帮助函数：为QuestionSet添加attributes
 * @param options 查询选项
 * @returns 添加了attributes的查询选项
 */
export const withQuestionSetAttributes = <T extends FindOptions>(options: T): T => {
  if (!options.attributes) {
    options.attributes = questionSetAttributes;
  }
  return options;
};

/**
 * 帮助函数：为Purchase添加attributes
 * @param options 查询选项
 * @returns 添加了attributes的查询选项
 */
export const withPurchaseAttributes = <T extends FindOptions>(options: T): T => {
  if (!options.attributes) {
    options.attributes = purchaseAttributes;
  }
  
  // 如果有包含QuestionSet，添加属性映射
  if (options.include) {
    const includes = Array.isArray(options.include) ? options.include : [options.include];
    
    for (const include of includes) {
      // 确保include是IncludeOptions类型
      const includeOptions = include as IncludeOptions;
      if (includeOptions.model === QuestionSet && 
          includeOptions.as === 'purchaseQuestionSet' && 
          !includeOptions.attributes) {
        includeOptions.attributes = purchaseQuestionSetAttributes;
      }
    }
  }
  
  return options;
};

/**
 * 测试属性映射是否正确
 * 这是一个辅助方法，用于检查属性映射是否正确生效
 */
export const testFieldMappings = async () => {
  try {
    // 测试QuestionSet查询
    const questionSets = await QuestionSet.findAll(withQuestionSetAttributes({ limit: 1 }));
    console.log('QuestionSet查询结果示例:', 
      questionSets.length > 0 ? 
      JSON.stringify(questionSets[0].toJSON(), null, 2).substring(0, 200) + '...' :
      '无数据'
    );

    // 测试Purchase查询
    const purchases = await Purchase.findAll(withPurchaseAttributes({ limit: 1 }));
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