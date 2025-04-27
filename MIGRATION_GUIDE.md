# 数据库字段统一迁移指南

本文档详细说明如何将数据库中的字段命名进行统一，主要是将 `purchases` 表中的 `quizId` 字段重命名为 `questionSetId`。

## 问题背景

当前数据库中存在命名不一致的情况：
- `question_sets` 表：使用 `id` 作为主键
- `questions` 表：使用 `questionSetId` 引用题库
- `options` 表：使用 `questionId` 引用问题
- `purchases` 表：使用 `quizId` 引用题库（而非 `questionSetId`）
- `redeem_codes` 表：使用 `questionSetId` 引用题库

这种不一致会导致API中的混淆，影响系统的可维护性。

## 迁移步骤

### 1. 备份数据库

在进行任何更改之前，请确保备份整个数据库：

```sql
mysqldump -u [用户名] -p [数据库名] > quizdb_backup_[日期].sql
```

### 2. 更新数据库结构

执行以下SQL命令修改表结构：

```sql
-- 删除现有的外键约束
ALTER TABLE purchases DROP FOREIGN KEY purchases_ibfk_2;

-- 重命名quizId字段为questionSetId
ALTER TABLE purchases CHANGE COLUMN quizId questionSetId char(36) CHARACTER SET utf8mb4 COLLATE utf8mb4_bin NOT NULL;

-- 更新索引
ALTER TABLE purchases DROP INDEX purchases_quiz_id;
ALTER TABLE purchases ADD INDEX purchases_question_set_id (questionSetId);

-- 重新添加外键约束
ALTER TABLE purchases 
  ADD CONSTRAINT purchases_ibfk_2 
  FOREIGN KEY (questionSetId) 
  REFERENCES question_sets (id) 
  ON DELETE CASCADE ON UPDATE CASCADE;

-- 更新表注释
ALTER TABLE purchases COMMENT = '用户购买题库记录表';
```

### 3. 迁移现有数据

运行数据迁移脚本，将现有的 `quizId` 值复制到新的 `questionSetId` 字段：

```bash
node migrate-data.js
```

> 注意：迁移脚本中的数据库连接信息需要根据你的环境进行调整。

### 4. 更新服务器代码

以下源代码文件已经更新：

1. `server/src/models/Purchase.ts` - 更新模型定义
2. `server/src/controllers/purchaseController.ts` - 更新控制器代码
3. `server/src/routes/purchaseRoutes.ts` - 更新路由定义
4. `src/types.ts` - 更新前端类型定义
5. `src/utils/api.ts` - 更新API调用

### 5. 测试

1. 确保可以创建新的题库
2. 确保可以查看已有题库
3. 确保可以创建购买记录
4. 确保可以查看购买记录
5. 确保题库访问权限检查正常

### 故障恢复

如果遇到问题，可以使用以下SQL回滚表结构：

```sql
DROP TABLE IF EXISTS purchases;
RENAME TABLE purchases_backup TO purchases;
```

然后，回滚代码更改。

## 技术注意事项

1. 字段名称变更会影响前后端的交互，确保所有API调用都已更新
2. 确保数据迁移过程中不会丢失数据
3. 考虑在低峰期进行迁移，以减少对用户的影响

## 联系支持

如遇到任何问题，请联系技术支持团队。 