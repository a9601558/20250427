# 数据库字段映射修复指南

## 问题描述

部署时出现以下错误:

```
sqlMessage: "Unknown column 'isPaid' in 'field list'"
sql: 'SELECT `id`, `title`, `description`, `category`, `icon`, `isPaid`, `price`, `trialQuestions`, `isFeatured`, `featuredCategory`, `createdAt`, `updatedAt` FROM `question_sets` AS `QuestionSet` ORDER BY `QuestionSet`.`createdAt` DESC LIMIT 0, 10;'
```

```
sqlMessage: "Unknown column 'Purchase.userId' in 'field list'"
sql: "SELECT `Purchase`.`id`, `Purchase`.`userId`, `Purchase`.`questionSetId`, `Purchase`.`amount`, `Purchase`.`status`, `Purchase`.`paymentMethod`, `Purchase`.`transactionId`, `Purchase`.`purchaseDate`, `Purchase`.`expiryDate`, `Purchase`.`createdAt`, `Purchase`.`updatedAt`, `purchaseQuestionSet`.`id` AS `purchaseQuestionSet.id`..."
```

## 问题原因

这是由于Sequelize模型中的字段命名（驼峰式命名法）与数据库中的列命名（蛇形命名法）不匹配造成的:

1. 模型中使用 `isPaid`，但数据库中应该是 `is_paid`
2. 模型中使用 `userId`，但数据库中应该是 `user_id`

虽然在模型定义中设置了 `underscored: true`，但似乎部分字段没有正确映射，或者数据库中缺少这些列。

## 解决方案

### 1. 运行迁移脚本

执行以下命令来运行迁移脚本，该脚本将检查并添加所有缺失的列:

```bash
cd server
npm run migrations
```

### 2. 手动添加列（如果迁移脚本失败）

如果迁移脚本失败，您可以通过宝塔面板手动添加以下列:

对于 `question_sets` 表，添加：
- `is_paid` (BOOLEAN, 默认值: false)
- `is_featured` (BOOLEAN, 默认值: false)
- `featured_category` (VARCHAR, 可为空)
- `trial_questions` (INTEGER, 可为空)

对于 `purchases` 表，添加：
- `user_id` (UUID, 外键关联 users 表)
- `question_set_id` (UUID, 外键关联 question_sets 表)

### 3. 确保模型定义正确

确保模型定义中包含正确的字段映射，例如:

```typescript
isPaid: {
  type: DataTypes.BOOLEAN,
  allowNull: false,
  defaultValue: false,
  field: 'is_paid', // 映射到数据库中的列名
},
```

## 预防未来问题

1. 确保所有模型定义都包含 `underscored: true` 和明确的字段映射
2. 在部署前进行完整的数据库迁移测试
3. 使用迁移脚本来管理数据库架构变更 