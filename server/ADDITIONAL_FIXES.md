# 修复设置付费题库问题和字段映射

## 问题摘要

1. **问题1：管理页面添加题库时设置付费题库的选项不起作用**
   - 原因：控制器中的createQuestionSet和updateQuestionSet方法没有处理isPaid、price和trialQuestions字段

2. **问题2：数据库列名与Sequelize模型字段名不匹配**
   - 原因：数据库使用蛇形命名法（如is_paid），而代码使用驼峰命名法（如isPaid）

## 修复内容

### 1. 修复创建和更新题库的控制器方法

- 在`questionSetController.ts`中更新了`createQuestionSet`和`updateQuestionSet`方法
- 添加了对`isPaid`、`price`和`trialQuestions`字段的处理
- 添加了验证逻辑，确保付费题库设置有效价格

```typescript
// 创建题库时
const questionSet = await QuestionSet.create({
  // ...其他字段
  isPaid: isPaid || false,
  price: isPaid ? price : null,
  trialQuestions: isPaid ? trialQuestions : null,
  // ...其他字段
});

// 更新题库时
if (isPaid !== undefined) {
  questionSet.isPaid = isPaid;
  if (isPaid) {
    questionSet.price = price !== undefined ? price : questionSet.price;
    questionSet.trialQuestions = trialQuestions !== undefined ? trialQuestions : questionSet.trialQuestions;
  } else {
    questionSet.price = undefined;
    questionSet.trialQuestions = undefined;
  }
}
```

### 2. 创建通用的字段映射辅助函数

为了解决字段映射问题，创建了以下辅助文件和函数：

- **sequelizeHelpers.ts**：提供了通用的字段映射函数和预定义的映射
  ```typescript
  export const questionSetAttributes = mapAttributes({
    'id': 'id',
    'title': 'title',
    // ...
    'is_paid': 'isPaid',
    'price': 'price',
    'trial_questions': 'trialQuestions',
    // ...
  });
  ```

- **在控制器中使用辅助函数**：更新了查询方法以使用预定义的属性映射
  ```typescript
  const questionSets = await QuestionSet.findAll({
    // ...其他选项
    attributes: questionSetAttributes
  });
  ```

## 部署注意事项

1. 确认数据库中是否已存在所需的字段（如`is_paid`, `price`, `trial_questions`等）
2. 如果不存在，运行之前的数据库迁移脚本
3. 部署新代码后，测试管理页面的付费题库设置功能

## 未来优化建议

1. 考虑在应用启动时应用全局字段映射，以避免在每个查询中手动设置
2. 在所有涉及数据库查询的地方使用统一的字段映射
3. 添加更完善的验证逻辑，确保付费题库的其他相关设置也正确 