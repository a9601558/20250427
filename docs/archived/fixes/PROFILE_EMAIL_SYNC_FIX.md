# Profile 邮箱显示修复

## 🔍 问题描述

用户Profile页面显示的邮箱是本地数据库中存储的邮箱，而不是Amazon Cognito用户池中的实际邮箱。这导致当用户在Cognito中更改邮箱后，Profile页面仍显示旧的邮箱地址。

## 🔄 数据流程分析

### 问题根源

1. **前端显示**: ProfilePage 显示 `user?.email`，来源于 UserContext
2. **UserContext**: 通过 `userApi.getCurrentUser()` 从后端获取用户信息
3. **后端API**: `/api/users/me` 调用 `getUserProfile` 函数
4. **数据库查询**: `getUserProfile` 只从本地数据库获取邮箱，未同步Cognito邮箱

### 认证流程

1. **Cognito认证**: 用户通过AWS Cognito登录，获得access token
2. **认证中间件**: `authMiddleware.ts` 验证Cognito token，提取用户信息
3. **数据传递**: 当前实现未将Cognito邮箱信息传递给profile API

## 🛠️ 实施的修复

### 修复1: 认证中间件邮箱同步
**文件**: `server/src/middleware/authMiddleware.ts`

**功能增强**:
1. **自动同步邮箱**: 当用户登录时，检查Cognito邮箱与数据库邮箱是否一致
2. **自动更新数据库**: 如果Cognito邮箱不同，自动更新数据库中的邮箱
3. **传递Cognito信息**: 将Cognito用户信息添加到请求对象中

**核心代码**:
```typescript
// 同步Cognito邮箱到数据库
const cognitoEmail = payload.email;
if (cognitoEmail && user.email !== cognitoEmail) {
  console.log(`[认证中间件] 同步Cognito邮箱: ${user.email} -> ${cognitoEmail}`);
  await user.update({ 
    email: cognitoEmail,
    lastLoginAt: new Date()
  });
}

// 将Cognito信息附加到请求对象
req.cognitoUser = payload;
req.user = user;
```

### 修复2: Profile API 邮箱优先级
**文件**: `server/src/controllers/userController.ts`

**功能增强**:
1. **优先使用Cognito邮箱**: 在返回用户信息时，优先使用Cognito token中的邮箱
2. **向后兼容**: 如果Cognito邮箱不可用，回退到数据库邮箱
3. **调试日志**: 记录邮箱来源以便调试

**核心代码**:
```typescript
// 从Cognito token中获取最新的邮箱信息
if (req.cognitoUser && req.cognitoUser.email) {
  console.log(`[用户资料] 使用Cognito邮箱: ${req.cognitoUser.email} (数据库邮箱: ${userData.email})`);
  userData.email = req.cognitoUser.email; // 优先使用Cognito中的邮箱
}
```

## 📋 修复效果

### 预期行为

1. **实时同步**: 用户在Cognito中更改邮箱后，立即在Profile页面看到更新
2. **数据库同步**: 本地数据库邮箱自动与Cognito保持同步
3. **一致性保证**: 所有显示邮箱的地方都显示Cognito中的最新邮箱

### 修复验证

1. **登录检查**: 用户登录时检查控制台日志，确认邮箱同步
2. **Profile检查**: 访问Profile页面，确认显示的是Cognito邮箱
3. **数据库检查**: 验证数据库中的邮箱已更新

## 🔧 技术细节

### TypeScript接口更新
```typescript
declare global {
  namespace Express {
    interface Request {
      user?: any;
      cognitoUser?: any; // 新增Cognito用户信息
    }
  }
}
```

### 邮箱同步策略
1. **登录时同步**: 每次认证时检查并同步邮箱
2. **优先级设置**: Cognito邮箱 > 数据库邮箱
3. **最小化数据库更新**: 只在邮箱不同时才更新数据库

### 错误处理
1. **Token验证失败**: 正常的认证失败处理
2. **数据库更新失败**: 记录错误但不阻止认证
3. **邮箱格式验证**: 基于Cognito验证结果

## 🚀 测试步骤

### 1. 验证邮箱同步
```bash
# 启动后端服务器
cd server
npm run dev
```

### 2. 登录测试
1. 使用已有Cognito账户登录
2. 检查服务器控制台是否显示邮箱同步日志
3. 访问Profile页面确认邮箱显示

### 3. 邮箱更新测试
1. 在AWS Cognito控制台中更改用户邮箱
2. 用户重新登录应用
3. 确认Profile页面显示新邮箱

## 📝 相关文件

### 修改的文件
- ✅ `server/src/middleware/authMiddleware.ts` - 认证中间件增强
- ✅ `server/src/controllers/userController.ts` - Profile API修复

### 依赖文件
- `src/components/ProfilePage.tsx` - 前端显示（无需修改）
- `src/contexts/UserContext.tsx` - 用户上下文（无需修改）
- `src/services/api.ts` - API服务（无需修改）

## 🔄 向后兼容性

1. **现有用户**: 邮箱将在下次登录时自动同步
2. **API接口**: 保持完全向后兼容
3. **数据结构**: 无破坏性变更

## 🛡️ 安全考虑

1. **Token验证**: 继续使用AWS Cognito的严格token验证
2. **邮箱验证**: 信任Cognito的邮箱验证结果
3. **数据同步**: 只在认证成功后进行邮箱同步

这个修复确保用户Profile始终显示Amazon Cognito中的最新邮箱地址，同时保持系统的安全性和向后兼容性。