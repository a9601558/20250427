# 后端路由修复指南

## 问题概述

您的前端发送注册请求到 `http://exam7.jp/api/users/register`，但收到了 `404 Not Found` 错误。根据错误信息 `"找不到路径 - /users/register"`，我们可以确定问题在于路由匹配。

## 诊断工具

我们提供了两个诊断工具来帮助您分析问题：

1. **路由诊断工具** (`backend-route-diagnosis.js`)：分析您的项目结构和路由配置
2. **注册接口测试工具** (`test-register.js`)：测试不同的API路径

请在您的后端项目根目录运行这些工具：

```bash
node backend-route-diagnosis.js
node test-register.js
```

## 潜在问题与解决方案

基于之前的分析，以下是可能导致404错误的问题及其解决方案：

### 问题1：Nginx配置与后端路由不匹配

**已修复** - 您的Nginx配置已更新为：
```nginx
location /api/ {
  proxy_pass http://127.0.0.1:5000/api/;  # 保留/api前缀
}
```

### 问题2：后端路由定义可能不正确

根据您的后端项目实际情况，选择以下其中一种修复方案：

#### 修复方案A：入口文件中统一添加前缀 (推荐)

在`server/src/index.js`或主入口文件中：

```javascript
// 原代码
app.use('/users', userRoutes);

// 修改为
app.use('/api/users', userRoutes);
```

然后在`routes/userRoutes.js`中保持简洁的路由定义：

```javascript
// 无需修改，保持简洁
router.post('/register', userController.registerUser);
```

#### 修复方案B：直接在路由文件中添加完整路径

如果您的项目结构不允许修改入口文件，可以在`routes/userRoutes.js`中：

```javascript
// 原代码
router.post('/register', userController.registerUser);

// 修改为
router.post('/api/users/register', userController.registerUser);
```

### 问题3：路由可能完全未定义

如果注册路由未定义，请添加相应的路由和控制器：

1. 确保`controllers/userController.js`中有注册函数：
```javascript
exports.registerUser = async (req, res) => {
  try {
    // 注册逻辑
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};
```

2. 在`routes/userRoutes.js`中添加路由：
```javascript
router.post('/register', userController.registerUser);
```

## 检查与验证

修复后，使用以下命令验证您的更改：

```bash
# 重启您的Node.js服务器
pm2 restart your-app-name  # 如果使用PM2
# 或
node src/index.js  # 直接启动

# 使用curl测试
curl -X POST -H "Content-Type: application/json" \
  -d '{"username":"test","password":"test123","email":"test@example.com"}' \
  http://localhost:5000/api/users/register -v
```

## 前后端路径对照表

| 前端请求 | Nginx代理 | 后端应接收 | 后端定义方式 |
|---------|----------|-----------|------------|
| `/api/users/register` | → `/api/users/register` | `/api/users/register` | `app.use('/api/users', ...)`<br>+`router.post('/register', ...)` |

## 常见问题

1. **确保重启服务器** - 修改路由后需要重启您的Node.js服务器才能生效
2. **检查日志** - 查看服务器日志以获取更多错误信息
3. **路径大小写** - 确保路径大小写一致，如`/users`和`/Users`是不同的路径
4. **路由顺序** - 路由定义的顺序很重要，确保没有其他路由拦截了您的请求

## 需要更多帮助？

如果以上解决方案都不能解决您的问题，请提供以下信息以获取更多帮助：

1. 后端服务器日志
2. 诊断工具的输出
3. 您的项目结构 (`tree` 命令的输出)
4. 相关代码文件的内容 