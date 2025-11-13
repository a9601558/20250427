# 🔒 付费题库试用模式安全修复

## 问题描述

**安全漏洞**：试用模式下，前端虽然限制了用户只能答题 `trialQuestions` 数量的题目，但后端API (`/api/v1/question-sets/:id`) 返回了完整题库的所有题目。攻击者可以通过浏览器DevTools查看Network响应，直接获取付费题库的完整内容。

**风险等级**：高 🚨
- 付费内容完全暴露
- 绕过购买机制
- 商业价值损失

## 修复方案

### 多层防御架构

```
用户请求 → 后端权限检查 → 题目数量限制 → 前端二重验证 → 用户接收
         ↓                ↓              ↓
    Purchase/RedeemCode  只返回允许数量   前端截断验证
    + 过期时间检查       + 4个API端点防护
```

### 1️⃣ 后端API权限检查

#### A. 题库API (`getQuestionSetById`)

**文件**: `server/src/controllers/questionSetController.ts`

**关键修复**:
1. ✅ **购买状态检查** - 查询 `Purchase` 表
2. ✅ **兑换码检查** - 查询 `RedeemCode` 表
3. ✅ **过期时间验证** - 检查 `expiryDate` 是否过期
4. ✅ **题目截断** - 未购买用户只返回 `trialQuestions` 数量
5. ✅ **权限标识** - 返回 `hasFullAccess` 和 `allowedQuestionCount`

**修改内容**:
```typescript
// 在 getQuestionSetById 函数中添加
let hasFullAccess = true;
let allowedQuestionCount = questionSetData.questionSetQuestions?.length || 0;

if (questionSetData.isPaid) {
  const userId = (req as any).user?.id;
  
  if (userId) {
    const now = new Date();
    
    // 检查购买记录（含过期时间）
    const validPurchase = await Purchase.findOne({
      where: {
        userId,
        questionSetId: req.params.id,
        status: 'completed'
      }
    });
    
    const hasPurchaseAccess = validPurchase && new Date(validPurchase.expiryDate) > now;
    
    // 检查兑换码（含过期时间）
    const validRedeemCode = await RedeemCode.findOne({
      where: {
        questionSetId: req.params.id,
        usedBy: userId,
        isUsed: true
      }
    });
    
    const hasRedeemAccess = validRedeemCode && new Date(validRedeemCode.expiryDate) > now;
    
    if (hasPurchaseAccess || hasRedeemAccess) {
      hasFullAccess = true;
    } else {
      hasFullAccess = false;
      allowedQuestionCount = questionSetData.trialQuestions || 0;
    }
  } else {
    // 未登录用户只能试用
    hasFullAccess = false;
    allowedQuestionCount = questionSetData.trialQuestions || 0;
  }
  
  // 🔒 关键：只返回试用题目
  if (!hasFullAccess && questionSetData.questionSetQuestions) {
    questionSetData.questionSetQuestions = questionSetData.questionSetQuestions.slice(0, allowedQuestionCount);
  }
}

// 添加权限信息到返回数据
const responseData = {
  ...questionSetData,
  hasFullAccess,
  allowedQuestionCount
};
```

#### B. 题目列表API (`getQuestions`)

**文件**: `server/src/controllers/questionController.ts`

**新增安全检查**:
```typescript
// 在 /api/v1/questions?questionSetId=xxx 中添加
if (questionSetId) {
  const questionSet = await QuestionSet.findByPk(String(questionSetId));
  
  if (questionSet?.isPaid) {
    const userId = (req as any).user?.id;
    if (!userId) {
      return res.status(403).json({
        success: false,
        message: '访问付费题库需要登录'
      });
    }
    
    // 检查购买记录和兑换码（含过期验证）
    // ...同上
    
    if (!hasPurchaseAccess && !hasRedeemAccess) {
      return res.status(403).json({
        success: false,
        message: '您没有访问此付费题库的权限'
      });
    }
  }
}
```

#### C. 随机题目API (`getRandomQuestion`)

**路由**: `GET /api/v1/questions/random/:questionSetId`

**修复**: 添加与题目列表API相同的权限检查逻辑

#### D. 单题目API (`getQuestionById`)

**路由**: `GET /api/v1/questions/:id`

**修复**: 
1. 先查询题目所属的 `questionSetId`
2. 检查该题库是否付费
3. 验证用户权限（购买/兑换码 + 过期时间）

**关键日志**:
```
🔍 付费题库访问检查 - 题库ID: xxx, 用户ID: xxx (或'未登录')
⏰ 购买记录已过期 - 购买日期: xxx, 过期日期: xxx
⏰ 兑换码已过期 - 兑换时间: xxx, 过期日期: xxx
✅ 用户已购买，允许完整访问（有效期至: xxx）
✅ 用户已兑换码，允许完整访问（有效期至: xxx）
⚠️ 用户未购买或访问已过期，仅允许试用 N 道题目
🔒 题目已截断：原 100 题 → 返回 3 题
🔒 [Questions API] 拒绝访问付费题库 xxx - 用户 xxx 无权限
```

### 2️⃣ TypeScript类型定义

**文件**: `src/types.ts`

```typescript
export interface QuestionSet {
  // ...existing fields
  
  // 🔒 Security properties (从后端API返回)
  hasFullAccess?: boolean; // 用户是否有完整访问权限
  allowedQuestionCount?: number; // 允许访问的题目数量
}
```

### 3️⃣ 前端二重验证

**文件**: `src/components/QuizPage.tsx`

```typescript
// 在处理API返回数据时添加
const questionsData = getQuestions(response.data);
if (questionsData.length > 0) {
  
  // 🔒 前端安全检查：二重验证题目数量
  const hasFullAccess = response.data.hasFullAccess ?? true;
  const allowedQuestionCount = response.data.allowedQuestionCount ?? questionsData.length;
  
  console.log(`🔍 前端安全检查 - hasFullAccess: ${hasFullAccess}, allowedCount: ${allowedQuestionCount}, actualCount: ${questionsData.length}`);
  
  // 如果没有完整权限且题目数超过允许数量，前端也进行截断
  let finalQuestionsData = questionsData;
  if (!hasFullAccess && questionsData.length > allowedQuestionCount) {
    console.warn(`⚠️ 前端检测到题目数量异常`);
    finalQuestionsData = questionsData.slice(0, allowedQuestionCount);
    console.log(`🔒 前端已截断题目：${questionsData.length} → ${finalQuestionsData.length}`);
  }
  
  // 使用截断后的题目数据
  const processedQuestions = finalQuestionsData.map((q: any) => { /*...*/ });
}
```

## 测试场景

### 场景1：未登录用户访问付费题库（试用模式）

**测试步骤**:
1. 退出登录
2. 访问付费题库试用链接：`/quiz/:id?mode=trial&trialLimit=3`
3. 打开DevTools → Network → 查找 `/api/v1/question-sets/:id` 请求
4. 查看响应的 `questionSetQuestions` 数组长度

**预期结果**:
```json
{
  "success": true,
  "data": {
    "id": "xxx",
    "title": "AWS SAP认证题库",
    "isPaid": true,
    "trialQuestions": 3,
    "hasFullAccess": false,        // ← 没有完整权限
    "allowedQuestionCount": 3,     // ← 只允许3题
    "questionSetQuestions": [      // ← 只返回3题
      { "id": 1, "text": "..." },
      { "id": 2, "text": "..." },
      { "id": 3, "text": "..." }
    ]
  }
}
```

**控制台日志**:
```
🔍 付费题库访问检查 - 题库ID: xxx, 用户ID: 未登录
⚠️ 未登录用户，仅允许试用 3 道题目
🔒 题目已截断：原 100 题 → 返回 3 题
🔍 前端安全检查 - hasFullAccess: false, allowedCount: 3, actualCount: 3
```

### 场景2：已登录但未购买用户

**测试步骤**:
1. 登录账号（未购买该题库）
2. 访问付费题库：`/quiz/:id`
3. DevTools检查API响应

**预期结果**:
```json
{
  "hasFullAccess": false,
  "allowedQuestionCount": 1,  // 默认隐式试用1题
  "questionSetQuestions": [
    { "id": 1, "text": "..." }  // 只返回1题
  ]
}
```

**控制台日志**:
```
🔍 付费题库访问检查 - 题库ID: xxx, 用户ID: user-123
⚠️ 用户未购买，仅允许试用 1 道题目
🔒 题目已截断：原 100 题 → 返回 1 题
```

### 场景3：已购买用户（完整访问）

**测试步骤**:
1. 登录已购买账号
2. 访问付费题库：`/quiz/:id`
3. DevTools检查API响应

**预期结果**:
```json
{
  "hasFullAccess": true,           // ← 完整权限
  "allowedQuestionCount": 100,     // ← 全部题目
  "questionSetQuestions": [        // ← 返回100题
    { "id": 1, "text": "..." },
    // ...100题
  ]
}
```

**控制台日志**:
```
🔍 付费题库访问检查 - 题库ID: xxx, 用户ID: user-456
✅ 用户已购买或使用兑换码，允许完整访问
题库获取成功，ID: xxx，包含 100 个題目 (完整访问: true)
```

### 场景4：免费题库访问

**测试步骤**:
1. 任何用户访问免费题库：`/quiz/:id`
2. DevTools检查API响应

**预期结果**:
```json
{
  "isPaid": false,
  "hasFullAccess": true,
  "allowedQuestionCount": 50,
  "questionSetQuestions": [
    // 全部50题
  ]
}
```

**控制台日志**:
```
✅ 免费题库，允许完整访问
```

### 场景5：兑换码用户

**测试步骤**:
1. 登录账号，使用有效兑换码
2. 访问付费题库：`/quiz/:id`
3. DevTools检查API响应

**预期结果**:
```json
{
  "hasFullAccess": true,
  "allowedQuestionCount": 100,
  "questionSetQuestions": [
    // 全部题目
  ]
}
```

**控制台日志**:
```
🔍 付费题库访问检查 - 题库ID: xxx, 用户ID: user-789
✅ 用户已购买或使用兑换码，允许完整访问
```

## 安全验证清单

### ✅ 后端防护
- [x] Purchase表查询验证
- [x] RedeemCode表查询验证
- [x] **过期时间检查** (Purchase.expiryDate & RedeemCode.expiryDate)
- [x] 未购买用户题目截断
- [x] hasFullAccess标识返回
- [x] allowedQuestionCount返回
- [x] 详细安全日志记录
- [x] **4个API端点全面防护**:
  - [x] `/api/v1/question-sets/:id` - 题库详情API
  - [x] `/api/v1/questions?questionSetId=xxx` - 题目列表API
  - [x] `/api/v1/questions/random/:questionSetId` - 随机题目API
  - [x] `/api/v1/questions/:id` - 单题目API

### ✅ 前端防护
- [x] API响应hasFullAccess检查
- [x] 题目数量异常检测
- [x] 前端二次截断
- [x] 类型安全定义
- [x] 控制台警告日志

### ✅ 测试覆盖
- [ ] 未登录用户测试
- [ ] 已登录未购买用户测试
- [ ] 已购买用户测试
- [ ] 免费题库测试
- [ ] 兑换码用户测试
- [ ] Edge Case（过期购买、无效兑换码等）

## 部署注意事项

### 数据库迁移
无需数据库迁移，使用现有的 `purchases` 和 `redeem_codes` 表。

### 后端配置
确保 `Purchase` 和 `RedeemCode` 模型正确关联到 `User` 和 `QuestionSet`。

### 前端兼容性
- `hasFullAccess` 默认值为 `true`（向后兼容）
- `allowedQuestionCount` 默认值为总题数（向后兼容）

### 性能影响
- 每次题库请求增加2次数据库查询（Purchase、RedeemCode）
- 可考虑添加缓存机制优化（例如Redis缓存用户权限）

## 后续改进

1. **缓存优化**: 使用Redis缓存用户购买状态，减少数据库查询
2. **审计日志**: 记录所有题库访问行为到日志表
3. **速率限制**: 对试用模式添加访问频率限制（防止恶意刷题）
4. **水印系统**: 在题目中添加用户水印（追踪泄露源头）
5. **异常监控**: 监控 `hasFullAccess=false` 但访问异常频繁的IP

## Git 提交信息

```
🔒 security: 修复付费题库API题目泄露问题

- 后端API权限检查：
  * questionSetController.ts添加Purchase/RedeemCode验证
  * 未购买用户只返回trialQuestions数量的题目
  * 添加hasFullAccess和allowedQuestionCount字段

- 前端二重验证：
  * QuizPage.tsx检查API返回的hasFullAccess标识
  * 如果题目数超过允许数量，前端也进行截断
  * 类型定义添加安全相关字段

- 多层防御：
  * 后端：数据库查询时只返回允许数量的题目
  * 前端：接收数据后再次验证并截断
  * 双重保护防止付费内容通过DevTools泄露

防止试用模式下通过浏览器DevTools查看完整题库内容
```

## 相关文件

- `server/src/controllers/questionSetController.ts` - 题库API权限检查（含过期验证）
- `server/src/controllers/questionController.ts` - 题目API权限检查（4个端点）
- `src/components/QuizPage.tsx` - 前端二重验证
- `src/types.ts` - TypeScript类型定义
- `server/src/models/Purchase.ts` - 购买记录模型（expiryDate字段）
- `server/src/models/RedeemCode.ts` - 兑换码模型（expiryDate字段）

---

**修复日期**: 2025-04-27  
**影响版本**: ver8  
**安全等级**: Critical 🔴  
**修复范围**: 5个API端点 + 前端验证 + 过期时间检查
