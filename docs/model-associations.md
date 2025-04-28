# 模型关联关系文档

## 1. 用户相关关联

### User (用户) 模型
- 一对多关系：
  - `User.hasMany(Purchase, { as: 'purchases' })` - 一个用户可以有多笔购买记录
  - `User.hasMany(UserProgress, { as: 'userProgresses' })` - 一个用户可以有多条学习进度记录
  - `User.hasMany(RedeemCode, { as: 'redeemCodes' })` - 一个用户可以有多条兑换码记录

### UserProgress (用户进度) 模型
- 多对一关系：
  - `UserProgress.belongsTo(User, { as: 'user' })` - 每条进度记录属于一个用户
  - `UserProgress.belongsTo(QuestionSet, { as: 'questionSet' })` - 每条进度记录关联一个题库
  - `UserProgress.belongsTo(Question, { as: 'question' })` - 每条进度记录关联一个题目

## 2. 题库相关关联

### QuestionSet (题库) 模型
- 一对多关系：
  - `QuestionSet.hasMany(Question, { as: 'questions' })` - 一个题库包含多个题目
  - `QuestionSet.hasMany(Purchase, { as: 'questionSetPurchases' })` - 一个题库可以被多次购买
  - `QuestionSet.hasMany(RedeemCode, { as: 'redeemCodes' })` - 一个题库可以生成多个兑换码
  - `QuestionSet.hasMany(UserProgress, { as: 'userProgresses' })` - 一个题库可以有多条用户进度记录

### Question (题目) 模型
- 多对一关系：
  - `Question.belongsTo(QuestionSet, { as: 'questionSet' })` - 每个题目属于一个题库
- 一对多关系：
  - `Question.hasMany(Option, { as: 'options' })` - 每个题目有多个选项
  - `Question.hasMany(UserProgress, { as: 'userProgresses' })` - 每个题目可以有多条用户进度记录

### Option (选项) 模型
- 多对一关系：
  - `Option.belongsTo(Question, { as: 'question' })` - 每个选项属于一个题目

## 3. 购买相关关联

### Purchase (购买) 模型
- 多对一关系：
  - `Purchase.belongsTo(User, { as: 'user' })` - 每笔购买记录属于一个用户
  - `Purchase.belongsTo(QuestionSet, { as: 'questionSet' })` - 每笔购买记录关联一个题库

## 4. 兑换码相关关联

### RedeemCode (兑换码) 模型
- 多对一关系：
  - `RedeemCode.belongsTo(User, { as: 'user' })` - 每个兑换码属于一个用户
  - `RedeemCode.belongsTo(QuestionSet, { as: 'questionSet' })` - 每个兑换码关联一个题库

## 5. 首页设置相关

### HomepageSettings (首页设置) 模型
- 独立模型，没有关联关系

## 关联设置机制

1. **统一定义位置**：
   - 所有关联都在 `models/index.ts` 的 `setupAssociations` 函数中统一定义
   - 不再有分散在各个模型文件中的关联定义

2. **避免重复初始化**：
   - 使用 `AppState` 单例模式跟踪关联初始化状态
   - `setupAssociations` 函数内部检查关联是否已初始化，避免重复执行

3. **一次性初始化**：
   - 在应用启动时调用一次 `setupAssociations`
   - 控制器中不再显式调用 `setupAssociations`

4. **别名优化**：
   - 修改 `QuestionSet.hasMany(Purchase)` 使用 `questionSetPurchases` 作为别名，避免与 `User.hasMany(Purchase)` 使用的 `purchases` 别名冲突
   - 规范所有类似的多对多关系别名

## 级联特性

1. **级联删除**：
   - 当删除题库时，会自动删除其下的所有题目（`onDelete: 'CASCADE'`）
   - 当删除题目时，会自动删除其下的所有选项（`onDelete: 'CASCADE'`）

2. **外键设置**：
   - 所有关联都明确指定了外键字段
   - 外键命名遵循 `[模型名]Id` 的格式，如 `userId`、`questionSetId` 等

3. **数据完整性**：
   - 所有关联都设置了 `allowNull: false`，确保数据完整性
   - 使用 `references` 确保外键引用正确

这个关联关系设计支持了完整的题库系统功能，包括用户管理、题库管理、题目管理、购买系统、进度跟踪等功能。通过单例管理和统一初始化，避免了关联重复定义导致的别名冲突问题。 