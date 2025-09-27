# 购买记录过期时间检查修复

## 问题描述

用户报告的错误日志显示：
```
[QuizPage] 找到购买记录匹配: ID=329f7b1e-72ce-4573-a4be-4d5c8bad6624, 状态=active
[QuizPage] 购买记录检查: 已过期=true, 状态有效=true, 最终结果=false
[QuizPage] 所有权限检查均未通过，返回false
```

问题分析：
- 购买记录存在且状态为 `active`
- 但系统判定为"已过期=true"
- 导致最终访问权限检查失败

## 根本原因

1. **时间格式解析问题**：过期时间可能存在格式不一致或时区问题
2. **无效日期处理**：没有对解析失败的日期进行合适的处理
3. **调试信息不足**：无法准确定位时间比较的具体问题

## 修复方案

### 1. 改进过期时间解析逻辑

```typescript
// 修复前
const expiryDate = purchase.expiryDate ? new Date(purchase.expiryDate) : null;
const isExpired = expiryDate && expiryDate <= now;

// 修复后  
let expiryDate: Date | null = null;
if (purchase.expiryDate) {
  try {
    expiryDate = new Date(purchase.expiryDate);
    
    // 检查日期是否有效
    if (isNaN(expiryDate.getTime())) {
      console.error('[QuizPage] 无效的过期日期格式:', purchase.expiryDate);
      expiryDate = null;
    }
  } catch (error) {
    console.error('[QuizPage] 解析过期日期时出错:', error, purchase.expiryDate);
    expiryDate = null;
  }
}

// 更宽松的过期检查：如果没有有效的过期时间，视为永久有效
const isExpired = expiryDate ? expiryDate <= now : false;
```

### 2. 增强调试信息

```typescript
console.log(`[QuizPage] 购买记录详细检查:`, {
  purchaseId: purchase.id,
  purchaseStatus: purchase.status,
  expiryDateRaw: purchase.expiryDate,
  expiryDateParsed: expiryDate,
  currentTime: now,
  isExpired,
  isActive,
  finalResult: purchaseHasAccess,
  timeDiff: expiryDate ? (expiryDate.getTime() - now.getTime()) : null,
  remainingDays: expiryDate ? Math.ceil((expiryDate.getTime() - now.getTime()) / (1000 * 60 * 60 * 24)) : null
});
```

## 修复内容

### A. 错误处理改进
- 添加了 try-catch 来处理日期解析异常
- 使用 `isNaN()` 检查解析后的日期是否有效
- 对无效日期给出明确的错误日志

### B. 逻辑优化
- **更宽松的过期检查**：如果没有有效的过期时间，视为永久有效
- 这避免了因日期解析失败导致的误判

### C. 调试信息增强
- 添加详细的购买记录检查日志
- 包含原始过期时间、解析后时间、时间差、剩余天数等信息
- 便于快速定位时间计算问题

## 预期效果

修复后，用户应该看到详细的调试信息，例如：
```
[QuizPage] 购买记录详细检查: {
  purchaseId: "329f7b1e-72ce-4573-a4be-4d5c8bad6624",
  purchaseStatus: "active",
  expiryDateRaw: "2025-03-27T10:30:00.000Z",
  expiryDateParsed: Date对象,
  currentTime: Date对象,
  isExpired: false,
  isActive: true,
  finalResult: true,
  timeDiff: 剩余毫秒数,
  remainingDays: 剩余天数
}
```

## 测试建议

1. **检查控制台日志**：查看详细的购买记录检查信息
2. **验证访问权限**：确认有效购买记录能正确授予访问权限
3. **边界情况测试**：
   - 刚刚过期的记录
   - 没有过期时间的记录
   - 无效日期格式的记录

## 后续改진

如果问题仍然存在，可能需要：
1. 检查服务器端购买记录的过期时间设置
2. 统一前后端的时间格式和时区处理
3. 考虑添加购买记录续期功能