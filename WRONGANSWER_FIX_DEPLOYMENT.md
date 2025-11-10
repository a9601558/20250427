# 🔧 修复错题保存失败问题 - 部署指南

## 问题描述

当答题时，保存错题时出现 500 错误：
```
{success: false, message: "服务器错误，无法保存错题"}
```

根本原因：`WrongAnswers` 表的 `questionId` 字段有外键约束，指向 `questions` 表。如果问题被删除或 ID 不匹配，就会导致外键约束失败。

## 解决方案

移除 `WrongAnswers` 表的外键约束，保留 `questionId` 字段用于记录和查询。

## 部署步骤

### 1. 备份数据库（重要！）

```bash
# 在生产服务器上执行
mysqldump -u root -p quizdb > quizdb_backup_$(date +%Y%m%d_%H%M%S).sql
```

### 2. 上传更新的代码

```bash
# 在本地执行
git pull origin ver8
cd /www/wwwroot/root/git/dist
git pull
```

### 3. 运行数据库迁移脚本

在生产服务器上执行：

```bash
cd /www/wwwroot/root/git/dist/server
node migrations/remove-wronganswer-foreign-keys.js
```

预期输出：
```
连接数据库: quizdb
开始移除 WrongAnswers 表的外键约束...

找到 X 个外键约束:
1. WrongAnswers_ibfk_65: questionId -> questions.id
...

删除外键约束: WrongAnswers_ibfk_65...
✅ 成功删除: WrongAnswers_ibfk_65

🎉 外键约束移除完成！
```

### 4. 重启服务器

```bash
# 使用 PM2
pm2 restart exam-server

# 或使用其他进程管理器
# systemctl restart exam-server
```

### 5. 验证修复

1. 打开答题页面
2. 答错一道题
3. 检查是否成功保存错题
4. 查看服务器日志确认没有错误

## 手动执行 SQL（备选方案）

如果迁移脚本无法运行，可以手动执行以下 SQL：

```sql
-- 连接到数据库
USE quizdb;

-- 查看现有外键约束
SELECT 
  CONSTRAINT_NAME,
  COLUMN_NAME,
  REFERENCED_TABLE_NAME,
  REFERENCED_COLUMN_NAME
FROM INFORMATION_SCHEMA.KEY_COLUMN_USAGE
WHERE TABLE_SCHEMA = 'quizdb' 
  AND TABLE_NAME = 'WrongAnswers'
  AND REFERENCED_TABLE_NAME IS NOT NULL;

-- 删除外键约束（根据上面查询的结果，替换约束名）
ALTER TABLE WrongAnswers DROP FOREIGN KEY WrongAnswers_ibfk_65;
-- 如果有多个外键，继续删除：
-- ALTER TABLE WrongAnswers DROP FOREIGN KEY WrongAnswers_ibfk_66;
-- ALTER TABLE WrongAnswers DROP FOREIGN KEY WrongAnswers_ibfk_67;

-- 验证外键已删除
SHOW CREATE TABLE WrongAnswers;
```

## 代码更改说明

### 1. 改进错误日志（server/src/controllers/wrongAnswerController.ts）

增强错误日志，输出详细的错误信息：
- 错误类型
- SQL 语句
- 参数
- 具体的错误码

### 2. 移除外键引用（server/src/models/WrongAnswer.ts）

在模型定义中添加注释，说明不使用外键约束。

### 3. 创建迁移脚本（server/migrations/remove-wronganswer-foreign-keys.js）

自动化删除外键约束的脚本。

## 影响评估

### 优点
✅ 可以保存已删除问题的错题记录  
✅ 不会因为外键约束而导致保存失败  
✅ 保留了 questionId 用于查询和关联  
✅ 不影响现有功能和数据  

### 缺点
❌ 无法通过数据库层面保证数据完整性  
❌ 可能产生"孤儿"错题记录（questionId 指向不存在的问题）  

### 缓解措施
- 应用层验证 questionId 的有效性
- 定期清理无效的错题记录
- 在删除问题时，同时处理相关的错题记录

## 验证清单

- [ ] 数据库已备份
- [ ] 代码已更新到最新版本
- [ ] 迁移脚本执行成功
- [ ] 服务器已重启
- [ ] 错题保存功能正常
- [ ] 没有新的错误日志
- [ ] Token 自动刷新功能正常

## 回滚方案

如果出现问题，可以回滚：

```bash
# 1. 恢复数据库备份
mysql -u root -p quizdb < quizdb_backup_YYYYMMDD_HHMMSS.sql

# 2. 回滚代码
cd /www/wwwroot/root/git/dist
git checkout <previous-commit-hash>

# 3. 重启服务器
pm2 restart exam-server
```

## 监控建议

部署后监控以下指标：
1. 错题保存成功率
2. 500 错误数量
3. 外键约束错误日志
4. 数据库性能

## 联系方式

如有问题，请查看：
- 服务器日志：`/www/wwwroot/root/git/dist/server/logs/`
- PM2 日志：`pm2 logs exam-server`
- 数据库错误日志：`/var/log/mysql/error.log`

---

**部署时间**：2025年11月11日  
**优先级**：🔥 高（影响核心功能）  
**预计停机时间**：< 5 分钟
