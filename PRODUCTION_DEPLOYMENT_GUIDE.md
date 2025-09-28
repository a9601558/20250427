# 🚀 生产环境JWT修复部署指南

## 📋 问题分析
根据生产日志分析，JWT认证错误 `JsonWebTokenError: invalid algorithm` 出现在以下位置：
- `/dist/server/dist/middleware/authMiddleware.js:19:52`
- `/dist/server/dist/config/socket.js:31:52`

## ✅ 修复内容
已对以下关键文件进行修复并重新构建：

### 1. Express认证中间件 (`middleware/authMiddleware.ts`)
```typescript
// 明确指定HS256算法
decoded = jwt.verify(token, jwtSecret, { algorithms: ['HS256'] }) as JwtPayload;
```

### 2. Socket.IO认证 (`config/socket.ts`)
```typescript
// 明确指定HS256算法
decoded = jwt.verify(token, jwtSecret, { algorithms: ['HS256'] }) as any;
```

## 🎯 修复验证
✅ 构建文件验证通过：
- `dist/middleware/authMiddleware.js` - JWT HS256算法已指定
- `dist/config/socket.js` - JWT HS256算法已指定

## 📦 部署步骤

### 第一步：更新服务器代码
```bash
# 1. 备份当前生产代码
cp -r /www/wwwroot/root/git/dist/server /www/wwwroot/root/git/dist/server.backup.$(date +%Y%m%d_%H%M%S)

# 2. 上传新的构建文件
# 将本地 dist/ 目录完整替换服务器上的对应目录
```

### 第二步：重启服务
```bash
# 重启Node.js进程（根据您的进程管理器）
pm2 restart all
# 或
systemctl restart your-node-app
# 或
kill -9 <node-process-id> && node dist/index.js
```

### 第三步：验证修复
监控服务器日志，确认以下错误不再出现：
- `JsonWebTokenError: invalid algorithm`
- `Socket认证失败: JsonWebTokenError: invalid algorithm`

## 🔍 验证命令
在服务器上运行以下命令验证修复：
```bash
# 检查关键文件中的算法指定
grep -n "algorithms: \['HS256'\]" /www/wwwroot/root/git/dist/server/dist/middleware/authMiddleware.js
grep -n "algorithms: \['HS256'\]" /www/wwwroot/root/git/dist/server/dist/config/socket.js
```

预期输出应包含明确的算法指定行。

## 🎉 预期结果
- ✅ JWT被授权错误完全消除
- ✅ Socket连接正常工作
- ✅ 用户认证流程恢复正常
- ✅ 页面不再出现无限刷新

## 📞 回滚方案
如果出现问题，可以快速回滚：
```bash
# 恢复备份
rm -rf /www/wwwroot/root/git/dist/server
mv /www/wwwroot/root/git/dist/server.backup.* /www/wwwroot/root/git/dist/server
pm2 restart all
```

---
**修复完成时间**: ${new Date().toLocaleString('zh-CN')}
**状态**: 🎯 准备部署
**优先级**: 🔴 高优先级（影响用户认证）