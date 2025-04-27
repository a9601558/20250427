# 考试练习应用后端

本目录包含考试练习应用的后端服务代码。

## 技术栈

- Node.js
- Express
- TypeScript
- Sequelize ORM
- MySQL

## 开发环境设置

1. 安装依赖:

```bash
npm install
```

2. 配置环境变量:

```bash
cp .env.example .env
```

编辑 `.env` 文件，设置数据库连接信息和其他必要配置。

3. 启动开发服务器:

```bash
npm run dev
```

## 数据库同步机制

本项目实现了全自动的数据库同步机制，确保代码与数据库结构一致:

1. **启动时自动同步**: 服务器启动时自动检查并同步数据库结构
2. **迁移系统**: 使用Sequelize迁移系统管理数据库结构变更
3. **模型同步**: 使用模型定义进行数据库表结构同步

### 数据库同步流程

1. 服务器启动时，首先尝试连接数据库
2. 执行所有未执行的迁移文件
3. 根据模型定义同步数据库表结构
4. 如果发现不一致，自动调整表结构

### 添加新迁移

当需要对数据库结构进行更改时:

```bash
npx sequelize-cli migration:generate --name migration-name
```

然后编辑生成的迁移文件添加必要的更改。

## 部署

### 标准部署

```bash
npm run deploy
```

### 宝塔面板部署

专门为宝塔面板优化的部署脚本:

```bash
npm run baota-deploy
```

这个脚本会:
1. 检查环境变量
2. 安装依赖
3. 编译TypeScript代码
4. 自动同步数据库结构
5. 设置必要的文件权限

## API路由

所有API路由已标准化，遵循RESTful设计原则:

- `GET /api/question-sets`: 获取所有题库
- `GET /api/question-sets/:id`: 获取特定题库
- `POST /api/question-sets`: 创建新题库
- `PUT /api/question-sets/:id`: 更新题库
- `DELETE /api/question-sets/:id`: 删除题库

- `GET /api/questions`: 获取所有题目
- `GET /api/questions/:id`: 获取特定题目
- `POST /api/questions`: 创建新题目
- `PUT /api/questions/:id`: 更新题目
- `DELETE /api/questions/:id`: 删除题目

- `POST /api/users/register`: 用户注册
- `POST /api/users/login`: 用户登录
- `GET /api/users/profile`: 获取用户资料
- `PUT /api/users/profile`: 更新用户资料

- `GET /api/homepage`: 获取首页设置
- `PUT /api/homepage`: 更新首页设置

- `POST /api/redeem-codes/create`: 创建兑换码
- `POST /api/redeem-codes/redeem`: 使用兑换码

- `POST /api/purchases`: 创建购买记录
- `GET /api/purchases/user`: 获取用户购买记录

## 数据模型

### 用户模型 (User)
- id: UUID (主键)
- username: 用户名
- email: 电子邮件
- password: 密码 (加密存储)
- role: 用户角色 (admin/user)

### 题库模型 (QuestionSet)
- id: UUID (主键)
- title: 题库标题
- description: 题库描述
- category: 题库分类
- isPaid: 是否付费
- price: 价格
- trialQuestions: 免费试用题目数

### 题目模型 (Question)
- id: UUID (主键)
- questionSetId: 所属题库ID
- text: 题目内容
- questionType: 题目类型 (single/multiple)
- explanation: 解析

### 选项模型 (Option)
- id: UUID (主键)
- questionId: 所属题目ID
- text: 选项内容
- isCorrect: 是否正确答案

### 购买记录模型 (Purchase)
- id: UUID (主键)
- userId: 用户ID
- quizId: 题库ID
- purchaseDate: 购买日期
- expiryDate: 到期日期

### 兑换码模型 (RedeemCode)
- id: UUID (主键)
- code: 兑换码
- questionSetId: 题库ID
- isUsed: 是否已使用
- usedBy: 使用用户ID
- expiryDate: 到期日期

### 首页设置模型 (HomepageSettings)
- id: 主键
- welcome_title: 欢迎标题
- welcome_description: 欢迎描述
- featured_categories: 推荐分类
- announcements: 公告内容
- footer_text: 页脚文本
- banner_image: 横幅图片 