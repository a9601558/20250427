# 用户注册功能实现指南

本指南详细说明如何设置、运行和测试用户注册功能，确保用户数据正确保存到MySQL数据库。

## 环境准备

1. 确保MySQL服务已启动并可访问
2. 检查`.env`文件中的数据库配置正确:

```
DB_HOST=localhost
DB_PORT=3306
DB_NAME=exam_practice_app
DB_USER=root
DB_PASSWORD=您的密码
JWT_SECRET=您的秘钥
```

## 初始化数据库

1. 首先创建数据库:

```bash
npm run db:create
```

2. 运行数据库初始化脚本:

```bash
npm run db:init
```

此脚本会:
- 测试数据库连接
- 同步模型结构到数据库
- 创建测试用户(如果不存在)

## 测试注册功能

有两种方式测试注册功能:

### 方法1: 使用测试脚本

```bash
npm run test:register
```

此脚本会:
- 生成随机用户信息
- 发送注册请求到后端API
- 验证注册响应
- 检查用户是否已保存到数据库

### 方法2: 通过前端界面测试

1. 启动后端服务:

```bash
npm run dev
```

2. 打开前端应用，填写注册表单并提交

3. 登录成功后，可以通过MySQL客户端检查用户是否已存储:

```sql
USE exam_practice_app;
SELECT * FROM users ORDER BY createdAt DESC LIMIT 5;
```

## 注册功能代码说明

1. **用户模型定义** (`models/User.js`)
   - 定义了用户表结构
   - 包含密码哈希和验证逻辑

2. **用户控制器** (`controllers/userController.js`)
   - 处理注册请求 (`registerUser`)
   - 验证输入数据
   - 加密用户密码
   - 保存用户到数据库
   - 生成JWT令牌

3. **用户路由** (`routes/userRoutes.js`)
   - 定义API端点
   - 连接控制器和路由

## 常见问题排查

1. **数据库连接失败**
   - 检查MySQL服务是否运行
   - 验证数据库用户名和密码是否正确
   - 确认防火墙未阻止数据库连接

2. **注册请求失败**
   - 检查API路径是否正确
   - 验证请求数据格式是否符合预期
   - 查看服务器日志获取详细错误信息

3. **密码加密问题**
   - 确保bcryptjs依赖项正确安装
   - 验证加密过程没有被跳过

4. **JWT令牌生成失败**
   - 检查JWT_SECRET环境变量是否设置
   - 确认jsonwebtoken依赖项已安装

## 结论

按照以上步骤，您应该能够成功实现用户注册功能，并将用户数据保存到MySQL数据库中。如果遇到任何问题，请查看服务器日志以获取更详细的错误信息。 