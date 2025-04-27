# Exam Practice App Server

这是在线考试练习应用的后端API服务器。它提供用户管理、题库、购买和兑换码功能的接口。

## 技术栈

- Node.js
- Express
- TypeScript
- MySQL 与 Sequelize ORM
- JWT 身份验证
- Stripe 支付集成

## 安装指南

### 前提条件

- Node.js (v16 或更高版本)
- MySQL 数据库
- Stripe 账户 (用于处理支付)

### 安装步骤

1. 克隆仓库
2. 进入服务器目录
3. 安装依赖:

```bash
npm install
```

4. 基于 `.env.example` 创建 `.env` 文件并更新配置:

```bash
cp .env.example .env
```

5. 创建 MySQL 数据库:

```bash
npm run db:create
```

6. 编译 TypeScript 代码:

```bash
npm run build
```

7. 启动服务器:

```bash
npm start
```

开发模式(自动重启):

```bash
npm run dev
```

## API 接口

### 身份验证

- `POST /api/users/login` - 用户登录
- `POST /api/users` - 注册新用户
- `GET /api/users/profile` - 获取用户个人资料
- `PUT /api/users/profile` - 更新用户个人资料

### 题库

- `GET /api/question-sets` - 获取所有题库
- `GET /api/question-sets/:id` - 根据ID获取题库
- `POST /api/question-sets` - 创建新题库(仅限管理员)
- `PUT /api/question-sets/:id` - 更新题库(仅限管理员)
- `DELETE /api/question-sets/:id` - 删除题库(仅限管理员)
- `POST /api/question-sets/:id/progress` - 保存用户在题库上的进度

### 购买

- `POST /api/purchases` - 创建购买(支付意向)
- `POST /api/purchases/complete` - 支付后完成购买
- `GET /api/purchases` - 获取用户的购买记录
- `GET /api/purchases/check/:quizId` - 检查用户是否有权访问题库

### 兑换码

- `POST /api/redeem-codes/redeem` - 兑换码
- `GET /api/redeem-codes` - 获取所有兑换码(仅限管理员)
- `POST /api/redeem-codes/generate` - 生成兑换码(仅限管理员)
- `DELETE /api/redeem-codes/:id` - 删除兑换码(仅限管理员)

## 环境变量

以下环境变量是必需的:

- `PORT` - 服务器端口(默认: 5000)
- `DB_HOST` - MySQL 服务器地址
- `DB_PORT` - MySQL 端口
- `DB_NAME` - MySQL 数据库名称
- `DB_USER` - MySQL 用户名
- `DB_PASSWORD` - MySQL 密码
- `JWT_SECRET` - JWT 令牌生成密钥
- `STRIPE_SECRET_KEY` - Stripe 密钥
- `STRIPE_WEBHOOK_SECRET` - Stripe webhook 密钥
- `FRONTEND_URL` - 前端应用URL(用于CORS) 