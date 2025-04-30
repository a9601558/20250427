# Sequelize字段映射问题解决方案

## 问题描述

部署到宝塔面板后，出现以下错误：

```
sqlMessage: "Unknown column 'isPaid' in 'field list'"
sqlMessage: "Unknown column 'Purchase.userId' in 'field list'"
```

## 原因分析

虽然在数据库表中已经存在正确的蛇形命名法列（如`is_paid`和`user_id`），但Sequelize在生成SQL查询时仍然使用了驼峰命名法（如`isPaid`和`userId`）。

这是因为尽管在模型定义中设置了`underscored: true`和使用了`field`属性来映射字段名称，但在某些查询中Sequelize可能没有正确应用这些映射。

## 解决方案

我们采用了以下方法解决这个问题：

1. **明确指定字段映射**：在所有查询中使用`attributes`选项明确地将数据库列名映射到模型属性名。

例如：
```typescript
attributes: [
  'id',
  ['is_paid', 'isPaid'],
  ['user_id', 'userId'],
  // ...其他字段
]
```

2. **修改了以下文件**：
   - `controllers/questionSetController.ts`：修改了`getAllQuestionSets`和`getFeaturedQuestionSets`方法
   - `controllers/purchaseController.ts`：修改了`getUserPurchases`方法

3. **添加类型注解**：将catch块中的`error`变量显式标注为`any`类型以避免TypeScript错误。

## 代码示例

### QuestionSet控制器修改示例：

```typescript
const questionSets = await QuestionSet.findAll({
  // ...其他选项
  attributes: [
    'id',
    'title',
    'description',
    'category',
    'icon',
    ['is_paid', 'isPaid'],
    'price',
    ['trial_questions', 'trialQuestions'],
    ['is_featured', 'isFeatured'],
    ['featured_category', 'featuredCategory'],
    ['created_at', 'createdAt'],
    ['updated_at', 'updatedAt']
  ]
});
```

### Purchase控制器修改示例：

```typescript
const purchases = await Purchase.findAll({
  // ...其他选项
  attributes: [
    'id',
    ['user_id', 'userId'],
    ['question_set_id', 'questionSetId'],
    'amount',
    'status',
    ['payment_method', 'paymentMethod'],
    ['transaction_id', 'transactionId'],
    ['purchase_date', 'purchaseDate'],
    ['expiry_date', 'expiryDate'],
    ['created_at', 'createdAt'],
    ['updated_at', 'updatedAt']
  ],
  include: [
    {
      model: QuestionSet,
      as: 'purchaseQuestionSet',
      attributes: [
        'id',
        'title',
        'category',
        'icon',
        ['is_paid', 'isPaid'],
        'price'
      ],
    },
  ],
});
```

## 后续措施

为避免将来出现类似问题：

1. 在所有涉及数据库查询的地方使用明确的字段映射
2. 考虑创建一个公共的字段映射辅助函数，以便在整个应用程序中使用
3. 在部署前进行完整的测试，确保数据库查询能够正确执行 