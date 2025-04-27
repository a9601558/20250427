# 数据库设计与修复指南

## 表结构概览

### 1. 题库表 (question_sets)
- **id**: UUID (主键)
- **title**: VARCHAR(100) (题库标题)
- **description**: TEXT (题库描述)
- **category**: VARCHAR(50) (题库分类)
- **icon**: VARCHAR(50) (题库图标)
- **isPaid**: BOOLEAN (是否付费)
- **price**: DECIMAL(10,2) (价格，如果isPaid=true)
- **trialQuestions**: INTEGER (免费试用题目数量)
- **isFeatured**: BOOLEAN (是否推荐)
- **featuredCategory**: VARCHAR(50) (推荐分类)
- **createdAt**: DATETIME
- **updatedAt**: DATETIME

### 2. 题目表 (questions)
- **id**: UUID (主键)
- **questionSetId**: UUID (外键，关联题库表)
- **text**: TEXT (题目内容)
- **questionType**: ENUM('single', 'multiple') (题目类型：单选或多选)
- **explanation**: TEXT (解析)
- **orderIndex**: INTEGER (排序索引)
- **createdAt**: DATETIME
- **updatedAt**: DATETIME

### 3. 选项表 (options)
- **id**: UUID (主键)
- **questionId**: UUID (外键，关联题目表)
- **text**: TEXT (选项内容)
- **isCorrect**: BOOLEAN (是否正确答案)
- **optionIndex**: VARCHAR(5) (选项索引，如A、B、C、D)
- **createdAt**: DATETIME
- **updatedAt**: DATETIME

### 4. 首页设置表 (homepage_settings)
- **id**: INTEGER (主键)
- **welcome_title**: VARCHAR(255) (欢迎标题)
- **welcome_description**: TEXT (欢迎描述)
- **featured_categories**: TEXT (推荐分类，JSON格式存储)
- **announcements**: TEXT (公告内容)
- **footer_text**: TEXT (页脚文本)
- **banner_image**: VARCHAR(255) (横幅图片URL)
- **theme**: VARCHAR(50) (主题：light、dark或auto)
- **created_at**: DATETIME
- **updated_at**: DATETIME

## 常见数据问题修复指南

### 1. ID格式问题

**问题描述**: 前端与后端交互时的ID类型不一致导致新建题目无法保存到数据库。

**解决方案**:
1. 前端在调用API时，确保将ID正确转换为字符串格式发送给后端
2. 从API接收数据时，正确解析UUID格式为前端所需的格式

### 2. API路径冲突

**问题描述**: 相同的API路径在不同路由中被重复定义导致请求无法正确路由。

**解决方案**:
1. 移除重复的路由定义
2. 确保每个API路径只在一个路由文件中定义

### 3. 缺少数据库表

**问题描述**: 数据库表未正确同步，导致某些表不存在。

**解决方案**:
1. 检查数据库连接配置是否正确
2. 使用以下命令重新同步所有数据库表:

```sql
-- 手动创建homepage_settings表
CREATE TABLE IF NOT EXISTS homepage_settings (
  id INTEGER PRIMARY KEY DEFAULT 1,
  welcome_title VARCHAR(255) NOT NULL,
  welcome_description TEXT NOT NULL,
  featured_categories TEXT,
  announcements TEXT,
  footer_text TEXT,
  banner_image VARCHAR(255),
  theme VARCHAR(50) DEFAULT 'light',
  created_at DATETIME,
  updated_at DATETIME
);

-- 插入默认记录
INSERT INTO homepage_settings (id, welcome_title, welcome_description, featured_categories, announcements, footer_text, theme, created_at, updated_at)
VALUES (
  1, 
  'ExamTopics 模拟练习', 
  '选择以下任一题库开始练习，测试您的知识水平', 
  '["网络协议", "编程语言", "计算机基础"]', 
  '欢迎使用在线题库系统，新增题库将定期更新，请持续关注！', 
  '© 2023 ExamTopics 在线题库系统 保留所有权利', 
  'light',
  NOW(),
  NOW()
);
```

### 4. 题目保存失败的调试方法

1. 在创建题目时，检查console输出的请求和响应
2. 验证题目的ID是否符合UUID格式
3. 确认创建题目的API端点 `/api/question-sets` 正常工作
4. 检查问题选项的格式是否正确 