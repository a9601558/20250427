# AWS Cognito Token 类型错误修复报告

## 问题描述

生产环境中出现大量 "Token is not an access token" 错误，导致：
- 用户一进页面就自动跳转到 /login
- API 请求返回 401 Unauthorized
- Socket 连接认证失败
- 无限重定向循环

## 根本原因分析

**问题根源：Token 类型不匹配**

1. **前端行为**：`CognitoUserContext.tsx` 中存储的是 **ID Token**
   ```tsx
   // 错误的实现
   if (idToken) {
     localStorage.setItem('token', idToken);  // ❌ 存储 ID token
   }
   ```

2. **后端期望**：`authMiddleware.ts` 严格验证必须是 **Access Token**
   ```typescript
   // 后端验证逻辑
   if (payload.token_use !== 'access') {
     return reject(new Error('Token is not an access token'));  // ❌ 拒绝 ID token
   }
   ```

3. **AWS Cognito Token 类型**：
   - **ID Token** (`token_use: "id"`)：包含用户身份信息，用于客户端显示
   - **Access Token** (`token_use: "access"`)：用于 API 访问控制，包含权限范围

## 解决方案

### 修改文件：`src/contexts/CognitoUserContext.tsx`

**修改前**：
```tsx
// 错误：存储 ID token 作为主要认证 token
if (idToken) {
  localStorage.setItem('token', idToken);
  console.log('[CognitoUserContext] AWS Cognito IDトークンを既存システムに設定しました');
}

if (accessToken) {
  localStorage.setItem('cognitoAccessToken', accessToken);
}
```

**修改后**：
```tsx
// 正确：存储 Access token 作为主要认证 token
if (accessToken) {
  localStorage.setItem('token', accessToken);
  console.log('[CognitoUserContext] AWS Cognito Access Tokenを既存システムに設定しました');
}

if (idToken) {
  localStorage.setItem('cognitoIdToken', idToken);
}
```

**清理逻辑也相应更新**：
```tsx
// 修改前
localStorage.removeItem('cognitoAccessToken');

// 修改后  
localStorage.removeItem('cognitoIdToken');
```

## 修复验证

### ✅ 验证结果
- **前端修改**：✅ 现在存储 access token 到 localStorage
- **ID token 处理**：✅ 正确存储到单独的键
- **清理逻辑**：✅ 更新正确
- **后端验证**：✅ 正确验证 access token
- **Socket 认证**：✅ 使用相同的 access token 验证
- **编译状态**：✅ 前端和后端都已成功编译

### 🔄 系统行为变化

**修复前**：
```
1. 用户登录 AWS Cognito
2. 前端获取 ID token 和 Access token
3. 前端存储 ID token 到 'token' 键
4. API 请求发送 ID token
5. 后端验证失败："Token is not an access token"
6. 返回 401，触发无限重定向
```

**修复后**：
```
1. 用户登录 AWS Cognito
2. 前端获取 ID token 和 Access token
3. 前端存储 Access token 到 'token' 键
4. API 请求发送 Access token
5. 后端验证成功
6. 正常返回用户数据
```

## 部署步骤

### 1. 立即部署
```bash
# 前端已编译
npm run build  # ✅ 完成

# 后端已编译  
cd server && npm run build  # ✅ 完成
```

### 2. 用户 Token 刷新策略
由于 token 类型变更，现有用户需要重新登录：

**选项 A：强制清除（建议）**
```javascript
// 在应用启动时执行一次
if (localStorage.getItem('tokenTypeFixed') !== 'v2') {
  localStorage.clear();
  localStorage.setItem('tokenTypeFixed', 'v2');
}
```

**选项 B：自然过期**
等待现有 token 过期，用户自动重新登录

### 3. 监控指标
部署后监控以下指标：
- `"Token is not an access token"` 错误数量 → 应降至 0
- API 401 错误率 → 应显著下降  
- 用户登录成功率 → 应恢复正常
- Socket 连接成功率 → 应恢复正常

## 技术细节

### AWS Cognito Token 结构对比

**ID Token Payload**：
```json
{
  "sub": "user-uuid",
  "aud": "client-id", 
  "token_use": "id",  // ← 这里是关键
  "email": "user@example.core",
  "username": "username"
}
```

**Access Token Payload**：
```json
{
  "sub": "user-uuid",
  "aud": "client-id",
  "token_use": "access",  // ← 这里是关键
  "scope": "openid email profile",
  "client_id": "client-id"
}
```

### 认证流程图

```
用户登录 → AWS Cognito → 返回两种 Token
                ↓
        ID Token (身份信息)
        Access Token (API 访问)
                ↓
        前端存储 Access Token → API 请求
                ↓
        后端验证 token_use=access → ✅ 通过
```

## 影响范围

### ✅ 修复的功能
- 用户登录后 API 调用
- Socket 实时连接
- 用户状态验证
- 支付功能认证
- 管理员权限验证

### 🔒 不受影响的功能
- AWS Cognito 登录/注册流程
- 密码重置功能
- 用户数据库管理
- 非认证 API 端点

## 风险评估

### 🟢 低风险
- 仅修改 token 存储逻辑
- 不改变 AWS Cognito 配置
- 不影响数据库结构
- 向后兼容（用户重新登录即可）

### ⚠️ 注意事项
- 现有登录用户需要重新认证
- 建议在低峰期部署
- 准备回滚方案（恢复到 ID token）

## 成功标准

### 📊 量化指标
- ❌ "Token is not an access token" 错误：0 次/小时
- ✅ API 成功率：> 99%
- ✅ 用户登录成功率：> 95%
- ✅ 页面无限重定向：0 次

### 🎯 用户体验
- 用户登录后正常访问所有功能
- 不再出现意外的登录页面跳转
- Socket 实时功能正常工作
- 支付流程顺畅

---

**修复完成时间**: 2025-09-28  
**修复状态**: ✅ 已完成，等待部署  
**下次验证**: 部署后 24 小时内监控生产日志