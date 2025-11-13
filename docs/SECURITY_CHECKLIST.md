# 🔒 安全检查清单 - 付费题库防护

## 修复概览

**修复时间**: 2025-04-27  
**严重程度**: 🔴 Critical  
**影响范围**: 5个API端点 + 前端验证  
**提交记录**: 
- `edd8103` - 初始修复（题库API + 前端验证）
- `c4c9430` - 完善修复（4个API端点 + 过期验证）

---

## ✅ 已修复的安全漏洞

### 1. 题库详情API泄露 (最严重)
- **API**: `GET /api/v1/question-sets/:id`
- **问题**: 返回完整题库的所有题目，未验证权限
- **修复**: 
  - ✅ 验证 Purchase 购买记录
  - ✅ 验证 RedeemCode 兑换码
  - ✅ 检查 expiryDate 是否过期
  - ✅ 未购买用户只返回 trialQuestions 数量
  - ✅ 返回 hasFullAccess 和 allowedQuestionCount 标识
- **文件**: `server/src/controllers/questionSetController.ts` (行321-430)

### 2. 题目列表API绕过
- **API**: `GET /api/v1/questions?questionSetId=xxx&include=options`
- **问题**: 可通过直接查询题目表绕过题库API限制
- **修复**:
  - ✅ 检查题库是否付费
  - ✅ 验证用户登录状态
  - ✅ 验证购买/兑换码状态（含过期）
  - ✅ 未授权返回 403 Forbidden
- **文件**: `server/src/controllers/questionController.ts` (行14-130)

### 3. 随机题目API绕过
- **API**: `GET /api/v1/questions/random/:questionSetId`
- **问题**: 可通过随机获取题目绕过权限检查
- **修复**:
  - ✅ 同题目列表API的权限验证逻辑
  - ✅ 验证购买/兑换码（含过期）
  - ✅ 未授权返回 403 Forbidden
- **文件**: `server/src/controllers/questionController.ts` (行268-337)

### 4. 单题目API绕过
- **API**: `GET /api/v1/questions/:id`
- **问题**: 通过题目ID直接获取题目详情
- **修复**:
  - ✅ 先查询题目所属的 questionSetId
  - ✅ 验证该题库是否付费
  - ✅ 验证购买/兑换码（含过期）
  - ✅ 未授权返回 403 Forbidden
- **文件**: `server/src/controllers/questionController.ts` (行133-197)

### 5. 前端数据泄露
- **问题**: 即使后端截断，前端收到超量数据仍可能显示
- **修复**:
  - ✅ 检查 API 返回的 hasFullAccess 标识
  - ✅ 如果题目数超过 allowedQuestionCount，前端二次截断
  - ✅ 控制台警告日志
- **文件**: `src/components/QuizPage.tsx` (行2513-2531)

---

## 🛡️ 安全机制详解

### A. 购买验证逻辑

```typescript
const validPurchase = await Purchase.findOne({
  where: {
    userId: userId,
    questionSetId: questionSetId,
    status: 'completed'  // 必须是完成状态
  }
});

// ⚠️ 关键：检查是否过期
const now = new Date();
const hasPurchaseAccess = validPurchase && new Date(validPurchase.expiryDate) > now;
```

**验证要点**:
- ✅ `status = 'completed'` - 只认可完成的购买
- ✅ `expiryDate > now` - 必须在有效期内
- ✅ 过期购买不授予访问权限

### B. 兑换码验证逻辑

```typescript
const validRedeemCode = await RedeemCode.findOne({
  where: {
    questionSetId: questionSetId,
    usedBy: userId,
    isUsed: true  // 必须已使用
  }
});

// ⚠️ 关键：检查是否过期
const hasRedeemAccess = validRedeemCode && new Date(validRedeemCode.expiryDate) > now;
```

**验证要点**:
- ✅ `isUsed = true` - 必须已兑换
- ✅ `usedBy = userId` - 必须是当前用户兑换的
- ✅ `expiryDate > now` - 必须在有效期内

### C. 多层防御策略

```
层级1: 后端题库API (questionSetController)
  ↓ 截断题目数量
层级2: 后端题目API (questionController) 
  ↓ 拒绝未授权访问
层级3: 前端验证 (QuizPage.tsx)
  ↓ 二次截断验证
层级4: 用户接收
```

---

## 📊 测试验证

### 测试场景矩阵

| 场景 | 用户状态 | 题库类型 | 预期行为 | API端点 | 状态 |
|------|---------|---------|---------|---------|------|
| 1 | 未登录 | 付费 | 拒绝访问 (403) | /api/v1/questions?questionSetId=xxx | ✅ |
| 2 | 未登录 | 付费 | 返回试用题目 | /api/v1/question-sets/:id?mode=trial | ✅ |
| 3 | 已登录未购买 | 付费 | 拒绝访问 (403) | /api/v1/questions?questionSetId=xxx | ✅ |
| 4 | 已登录未购买 | 付费 | 返回试用题目 | /api/v1/question-sets/:id | ✅ |
| 5 | 已购买（有效期内） | 付费 | 返回完整题库 | /api/v1/question-sets/:id | ✅ |
| 6 | 已购买（已过期） | 付费 | 拒绝访问 (403) | /api/v1/questions?questionSetId=xxx | ✅ |
| 7 | 已兑换码（有效期内） | 付费 | 返回完整题库 | /api/v1/question-sets/:id | ✅ |
| 8 | 已兑换码（已过期） | 付费 | 拒绝访问 (403) | /api/v1/questions?questionSetId=xxx | ✅ |
| 9 | 任何用户 | 免费 | 返回完整题库 | /api/v1/question-sets/:id | ✅ |

### DevTools验证命令

#### 1. 检查题库API响应
```javascript
// 在浏览器控制台执行
fetch('/api/v1/question-sets/YOUR_QUESTION_SET_ID', {
  headers: {
    'Authorization': `Bearer ${localStorage.getItem('token')}`
  }
})
.then(r => r.json())
.then(data => {
  console.log('hasFullAccess:', data.data.hasFullAccess);
  console.log('allowedQuestionCount:', data.data.allowedQuestionCount);
  console.log('实际返回题目数:', data.data.questionSetQuestions?.length);
  
  if (!data.data.hasFullAccess && data.data.questionSetQuestions.length > data.data.allowedQuestionCount) {
    console.error('❌ 安全漏洞：返回题目超过允许数量！');
  } else {
    console.log('✅ 安全检查通过');
  }
});
```

#### 2. 尝试绕过题目列表API
```javascript
// 未购买用户尝试访问
fetch('/api/v1/questions?questionSetId=YOUR_QUESTION_SET_ID&include=options', {
  headers: {
    'Authorization': `Bearer ${localStorage.getItem('token')}`
  }
})
.then(r => r.json())
.then(data => {
  if (data.success === false && data.message.includes('权限')) {
    console.log('✅ 权限检查生效，拒绝访问');
  } else {
    console.error('❌ 安全漏洞：未授权用户可访问题目！');
  }
});
```

---

## 🚨 潜在风险点

### 已解决 ✅
- [x] 题库API返回完整题目
- [x] 题目列表API绕过权限
- [x] 随机题目API绕过权限
- [x] 单题目API绕过权限
- [x] 前端显示超量题目
- [x] 购买过期仍可访问
- [x] 兑换码过期仍可访问

### 需要后续监控 ⚠️
- [ ] **性能影响**: 每次请求增加2次数据库查询
  - 建议: 添加 Redis 缓存用户权限
  - 缓存key: `user:${userId}:access:${questionSetId}`
  - TTL: 5分钟
  
- [ ] **并发购买**: 用户在试用期间购买，权限可能不同步
  - 建议: WebSocket 实时推送权限变更
  
- [ ] **数据库索引**: Purchase 和 RedeemCode 表的查询性能
  - 已有索引: `user_id + question_set_id`
  - 建议: 添加 `expiry_date` 索引

---

## 📝 后续改进建议

### 1. 缓存优化 (高优先级)
```typescript
// 伪代码
const cacheKey = `access:${userId}:${questionSetId}`;
const cachedAccess = await redis.get(cacheKey);

if (cachedAccess) {
  return JSON.parse(cachedAccess);
}

// 查询数据库...
const accessInfo = { hasFullAccess, expiryDate };
await redis.setex(cacheKey, 300, JSON.stringify(accessInfo)); // 5分钟缓存
```

### 2. 审计日志 (中优先级)
创建 `access_logs` 表记录所有题库访问：
```sql
CREATE TABLE access_logs (
  id VARCHAR(36) PRIMARY KEY,
  user_id VARCHAR(36),
  question_set_id VARCHAR(36),
  access_granted BOOLEAN,
  access_type ENUM('purchase', 'redeem', 'trial', 'denied'),
  ip_address VARCHAR(45),
  user_agent TEXT,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);
```

### 3. 速率限制 (中优先级)
试用模式添加访问频率限制：
- 每IP每小时最多访问10个不同的试用题库
- 每用户每天最多试用20个题库

### 4. 水印系统 (低优先级)
在题目中嵌入用户水印，追踪泄露源头：
```typescript
// 在题目文本中添加不可见字符
const watermark = generateWatermark(userId, timestamp);
question.text = embedWatermark(question.text, watermark);
```

---

## 🔧 故障排查

### 场景1: 用户购买后仍无法访问

**可能原因**:
1. Purchase 记录 `status` 不是 'completed'
2. `expiryDate` 已过期
3. 缓存未清除（如果实现了缓存）

**排查命令**:
```sql
SELECT * FROM purchases 
WHERE user_id = 'USER_ID' 
  AND question_set_id = 'QUESTION_SET_ID';
```

**检查要点**:
- `status = 'completed'` ✅
- `expiry_date > NOW()` ✅

### 场景2: 兑换码无效

**可能原因**:
1. `isUsed = false` (未兑换)
2. `expiryDate` 已过期
3. `usedBy` 不是当前用户

**排查命令**:
```sql
SELECT * FROM redeem_codes 
WHERE question_set_id = 'QUESTION_SET_ID' 
  AND used_by = 'USER_ID';
```

### 场景3: 免费题库也被限制

**可能原因**:
- QuestionSet 的 `isPaid` 字段错误设置为 `true`

**修复命令**:
```sql
UPDATE question_sets 
SET is_paid = FALSE 
WHERE id = 'QUESTION_SET_ID';
```

---

## 📞 紧急响应流程

如发现新的安全漏洞：

1. **立即响应** (0-30分钟)
   - 确认漏洞范围
   - 临时禁用受影响的API端点
   - 通知开发团队

2. **修复实施** (30分钟-2小时)
   - 开发补丁
   - 本地测试验证
   - 代码审查

3. **部署上线** (2-4小时)
   - 生产环境部署
   - 监控日志
   - 验证修复效果

4. **事后分析** (4小时后)
   - 分析漏洞根因
   - 更新安全检查清单
   - 改进开发流程

---

**文档维护者**: AI Assistant  
**最后更新**: 2025-04-27  
**版本**: 1.0
