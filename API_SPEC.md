# API 规范文档

## 1. 基础规范

### 1.1 API 路径规范
- 所有 API 路径以 `/api` 开头
- 使用小写字母和连字符（-）分隔单词
- 资源使用复数形式
- 版本控制：目前使用 v1，路径格式为 `/api/v1/...`

### 1.2 请求方法规范
- GET: 获取资源
- POST: 创建资源
- PUT: 更新资源
- DELETE: 删除资源
- PATCH: 部分更新资源

### 1.3 响应格式规范
```typescript
interface ApiResponse<T> {
  success: boolean;    // 请求是否成功
  data?: T;           // 响应数据
  message?: string;   // 成功/错误消息
  error?: string;     // 错误详情
}
```

### 1.4 状态码规范
- 200: 成功
- 201: 创建成功
- 400: 请求错误
- 401: 未授权
- 403: 禁止访问
- 404: 资源不存在
- 500: 服务器错误

## 2. 认证与授权

### 2.1 JWT 认证
- 所有需要认证的请求需要在 Header 中添加 `Authorization: Bearer <token>`
- Token 格式：`Bearer <jwt_token>`
- Token 过期时间：30天

## 3. 错误处理

### 3.1 错误响应格式
```typescript
{
  success: false,
  message: "错误描述",
  error?: "详细错误信息"
}
```

### 3.2 常见错误类型
- 参数验证错误
- 认证错误
- 权限错误
- 资源不存在
- 服务器错误

## 4. API 端点规范

### 4.1 用户相关
```
POST   /api/v1/users/register     - 用户注册
POST   /api/v1/users/login       - 用户登录
GET    /api/v1/users/profile     - 获取当前用户信息
PUT    /api/v1/users/profile     - 更新当前用户信息
GET    /api/v1/users             - 获取所有用户（管理员）
GET    /api/v1/users/:id         - 获取指定用户（管理员）
PUT    /api/v1/users/:id         - 更新指定用户（管理员）
DELETE /api/v1/users/:id         - 删除指定用户（管理员）
```

### 4.2 题库相关
```
GET    /api/v1/question-sets              - 获取所有题库
GET    /api/v1/question-sets/:id          - 获取指定题库
POST   /api/v1/question-sets              - 创建题库（管理员）
PUT    /api/v1/question-sets/:id          - 更新题库（管理员）
DELETE /api/v1/question-sets/:id          - 删除题库（管理员）
GET    /api/v1/question-sets/categories   - 获取所有分类
GET    /api/v1/question-sets/by-category/:category - 按分类获取题库
```

### 4.3 题目相关
```
GET    /api/v1/questions                  - 获取题目列表
GET    /api/v1/questions/:id              - 获取指定题目
POST   /api/v1/questions                  - 创建题目（管理员）
PUT    /api/v1/questions/:id              - 更新题目（管理员）
DELETE /api/v1/questions/:id              - 删除题目（管理员）
```

### 4.4 用户进度相关
```
GET    /api/v1/user-progress              - 获取用户进度
GET    /api/v1/user-progress/:questionSetId - 获取指定题库进度
POST   /api/v1/user-progress              - 更新用户进度
```

### 4.5 购买相关
```
POST   /api/v1/purchases                  - 创建购买
GET    /api/v1/purchases                  - 获取用户购买记录
GET    /api/v1/purchases/check/:questionSetId - 检查题库访问权限
```

### 4.6 兑换码相关
```
POST   /api/v1/redeem-codes/redeem        - 兑换代码
POST   /api/v1/redeem-codes/generate      - 生成兑换码（管理员）
GET    /api/v1/redeem-codes               - 获取所有兑换码（管理员）
DELETE /api/v1/redeem-codes/:id           - 删除兑换码（管理员）
```

## 5. 数据格式规范

### 5.1 用户数据格式
```typescript
interface User {
  id: string;
  username: string;
  email: string;
  isAdmin: boolean;
  progress: Record<string, UserProgress>;
  purchases: Purchase[];
  redeemCodes: RedeemCode[];
  createdAt: string;
  updatedAt: string;
}
```

### 5.2 题库数据格式
```typescript
interface QuestionSet {
  id: string;
  title: string;
  description: string;
  category: string;
  isFeatured: boolean;
  featuredCategory?: string;
  questions: Question[];
  createdAt: string;
  updatedAt: string;
}
```

### 5.3 题目数据格式
```typescript
interface Question {
  id: string;
  questionSetId: string;
  content: string;
  options: Option[];
  correctAnswer: string;
  explanation: string;
  createdAt: string;
  updatedAt: string;
}
```

## 6. 分页规范

### 6.1 请求参数
```
GET /api/v1/resource?page=1&limit=10
```

### 6.2 响应格式
```typescript
interface PaginatedResponse<T> {
  success: boolean;
  data: {
    items: T[];
    total: number;
    page: number;
    limit: number;
    totalPages: number;
  };
}
``` 