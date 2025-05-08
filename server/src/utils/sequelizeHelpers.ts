/**
 * Sequelize辅助函数
 */

/**
 * 生成明确的字段映射属性，将蛇形命名法映射到驼峰命名法
 * @param fieldsMap 字段映射对象，键为蛇形命名法字段名，值为驼峰命名法属性名
 * @returns 用于Sequelize查询的attributes数组
 */
export const mapAttributes = (fieldsMap: Record<string, string>): Array<string | [string, string]> => {
  return Object.entries(fieldsMap).map(([dbField, modelField]) => {
    // 如果字段名相同，直接返回字符串
    if (dbField === modelField) {
      return dbField;
    }
    // 否则返回映射数组 [数据库字段名, 模型属性名]
    return [dbField, modelField];
  });
};

/**
 * QuestionSet模型的属性映射
 */
export const questionSetAttributes = mapAttributes({
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
  'updated_at': 'updatedAt'
});

/**
 * Purchase模型的属性映射
 */
export const purchaseAttributes = mapAttributes({
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
  'updated_at': 'updatedAt'
});

/**
 * 购买记录中QuestionSet包含属性的映射
 */
export const purchaseQuestionSetAttributes = mapAttributes({
  'id': 'id',
  'title': 'title',
  'description': 'description',
  'category': 'category',
  'icon': 'icon',
  'is_paid': 'isPaid',
  'price': 'price'
}); 