# JSON题库导入 - 数据库字段映射详解

## 更新日期
2025年11月9日

## 概述
本文档详细说明JSON题库文件中的字段如何映射到数据库表中，以及哪些字段会被使用或忽略。

## 数据库表结构

### 1. QuestionSets表（题库）

**表名**: `question_sets`

**使用的字段**:
```typescript
{
  id: UUID (自动生成)
  title: STRING (必填) - 从表单输入
  description: TEXT (必填) - 从表单输入
  category: STRING (必填) - 从表单输入
  icon: STRING (默认: "default")
  isPaid: BOOLEAN (默认: false) - 从表单输入
  price: DECIMAL(10,2) (可选) - 从表单输入
  trialQuestions: INTEGER (可选) - 从表单输入
  isFeatured: BOOLEAN (默认: false)
  featuredCategory: STRING (可选)
  createdAt: DATETIME (自动)
  updatedAt: DATETIME (自动)
}
```

**来源**: 前端表单输入，可以从JSON的meta字段自动填充

---

### 2. Questions表（题目）

**表名**: `questions`

**使用的字段**:
```typescript
{
  id: UUID (自动生成)
  questionSetId: UUID (自动关联)
  text: TEXT (必填) ← JSON: stem
  questionType: ENUM('single', 'multiple') ← JSON: type 或 根据answer长度判断
  explanation: TEXT (必填) ← JSON: analysis 或 explanation
  orderIndex: INTEGER ← 按导入顺序自动分配
  createdAt: DATETIME (自动)
  updatedAt: DATETIME (自动)
}
```

**字段映射**:
- `text` ← JSON的 `stem` 字段
- `questionType` ← JSON的 `type` 字段（'single' 或 'multiple'）
  - 如果未指定，根据 `answer` 数组长度判断：
    - `answer.length === 1` → 'single'
    - `answer.length > 1` → 'multiple'
- `explanation` ← JSON的 `analysis` 或 `explanation` 字段
  - 如果都没有，使用默认值："无解析"
- `orderIndex` ← 自动分配（0, 1, 2, 3...）

**忽略的JSON字段**:
- `id` - 系统使用UUID自动生成
- `difficulty` - 数据库表中无此字段
- `tags` - 数据库表中无此字段  
- `chapter` - 数据库表中无此字段

---

### 3. Options表（选项）

**表名**: `options`

**使用的字段**:
```typescript
{
  id: UUID (自动生成)
  questionId: UUID (自动关联)
  text: TEXT (必填) ← JSON: options[n]
  isCorrect: BOOLEAN ← JSON: answer数组中是否包含该索引
  optionIndex: STRING(5) ← 自动生成 (A, B, C, D...)
  createdAt: DATETIME (自动)
  updatedAt: DATETIME (自动)
}
```

**字段映射**:
- `text` ← JSON的 `options` 数组中的每个元素
- `isCorrect` ← 根据JSON的 `answer` 数组判断
  - 例如: `answer: [0, 2]` 表示索引0和2的选项为正确答案
- `optionIndex` ← 自动生成字母标识
  - 0 → 'A', 1 → 'B', 2 → 'C', 3 → 'D', 等等

---

## 完整示例

### JSON输入
```json
{
  "id": "Q-0001",
  "type": "single",
  "stem": "Python使用什么符号进行注释？",
  "options": ["#", "//", "/* */", "--"],
  "answer": [0],
  "analysis": "Python使用#作为单行注释符号",
  "difficulty": 1,
  "tags": ["Python", "基础"],
  "chapter": "第一章"
}
```

### 数据库插入

**Questions表**:
```sql
INSERT INTO questions (
  id,                    -- 自动生成UUID
  questionSetId,         -- 从题库ID获取
  text,                  -- "Python使用什么符号进行注释？"
  questionType,          -- "single"
  explanation,           -- "Python使用#作为单行注释符号"
  orderIndex            -- 0 (第一题)
) VALUES (...)
```

**Options表** (4条记录):
```sql
-- 选项A (正确答案)
INSERT INTO options (
  id,                    -- 自动生成UUID
  questionId,           -- 关联到上面创建的题目
  text,                 -- "#"
  isCorrect,            -- true (因为answer包含0)
  optionIndex          -- "A"
) VALUES (...)

-- 选项B
INSERT INTO options (
  id,                    -- 自动生成UUID
  questionId,           -- 关联到上面创建的题目
  text,                 -- "//"
  isCorrect,            -- false
  optionIndex          -- "B"
) VALUES (...)

-- 选项C
INSERT INTO options (
  id,                    -- 自动生成UUID
  questionId,           -- 关联到上面创建的题目
  text,                 -- "/* */"
  isCorrect,            -- false
  optionIndex          -- "C"
) VALUES (...)

-- 选项D
INSERT INTO options (
  id,                    -- 自动生成UUID
  questionId,           -- 关联到上面创建的题目
  text,                 -- "--"
  isCorrect,            -- false
  optionIndex          -- "D"
) VALUES (...)
```

**被忽略的字段**:
- `"id": "Q-0001"` - 不使用
- `"difficulty": 1` - 不保存
- `"tags": ["Python", "基础"]` - 不保存
- `"chapter": "第一章"` - 不保存

---

## 重要说明

### 答案索引映射
答案使用**从0开始的索引**，映射关系：

| 索引 | 选项标识 | 示例 |
|-----|---------|-----|
| 0 | A | `"answer": [0]` 表示A是正确答案 |
| 1 | B | `"answer": [1]` 表示B是正确答案 |
| 2 | C | `"answer": [0, 2]` 表示A和C是正确答案 |
| 3 | D | `"answer": [1, 3]` 表示B和D是正确答案 |

### 单选题 vs 多选题

**判断逻辑**:
1. 优先使用JSON中的 `type` 字段
2. 如果没有 `type` 字段，根据 `answer` 数组长度判断：
   - `answer.length === 1` → 单选题
   - `answer.length > 1` → 多选题

**示例**:
```json
// 单选题
{
  "stem": "1+1等于几？",
  "options": ["1", "2", "3", "4"],
  "answer": [1]  // 只有一个答案 → 单选题
}

// 多选题
{
  "stem": "哪些是编程语言？",
  "options": ["Java", "篮球", "Python", "足球"],
  "answer": [0, 2]  // 多个答案 → 多选题
}
```

### 解析字段兼容性

系统支持两种字段名：
- `analysis` (优先)
- `explanation`

导入时会优先使用 `analysis`，如果没有则使用 `explanation`，如果都没有则使用 "无解析"。

---

## 错误处理

### 验证规则

导入时会验证以下内容：

1. **题干不能为空**: `stem` 字段必须存在且不为空
2. **至少2个选项**: `options` 数组至少需要2个元素
3. **必须有答案**: `answer` 数组不能为空
4. **答案索引有效**: `answer` 中的索引必须在 `options` 范围内
   - 例如: 4个选项，答案索引只能是 0-3

### 错误示例

❌ **错误**: 答案索引超出范围
```json
{
  "stem": "题目",
  "options": ["A", "B"],  // 只有2个选项 (索引0-1)
  "answer": [2]           // 错误！索引2不存在
}
```

✅ **正确**:
```json
{
  "stem": "题目",
  "options": ["A", "B"],
  "answer": [0]  // 正确！索引0存在
}
```

---

## 事务处理

导入过程使用数据库事务，确保数据一致性：

1. **开始事务**
2. **创建题库记录** (QuestionSets表)
3. **逐个导入题目**:
   - 创建题目记录 (Questions表)
   - 创建所有选项记录 (Options表)
4. **更新题库的题目数量**
5. **提交事务**

如果任何步骤失败，整个事务会回滚，不会创建不完整的数据。

---

## 扩展性考虑

虽然当前数据库表不支持以下字段，但保留在JSON中有以下好处：

1. **向后兼容**: 未来如果数据库增加这些字段，无需修改JSON文件
2. **多系统共享**: JSON可以在其他支持这些字段的系统中使用
3. **数据完整性**: 保留原始数据，便于数据分析和迁移

**建议保留的字段**:
- `difficulty` - 题目难度
- `tags` - 题目标签
- `chapter` - 所属章节
- `id` - 原始题目编号（便于追踪）

---

## 常见问题

**Q: 为什么我的difficulty字段没有被保存？**
A: 因为数据库的Questions表中没有difficulty字段。这个字段会被忽略，但不影响导入。

**Q: 可以添加difficulty等字段到数据库吗？**
A: 可以。需要：
1. 修改数据库表结构（添加字段）
2. 更新Question模型定义
3. 修改导入逻辑，包含这些字段

**Q: JSON中的id字段有什么用？**
A: 虽然导入时会被忽略（系统生成新的UUID），但保留原始ID有助于：
- 在JSON文件中引用题目
- 与原始数据源保持对应关系
- 便于错误定位

**Q: 答案索引为什么从0开始而不是从1开始？**
A: 这是编程语言的约定，数组索引从0开始。与大多数系统保持一致。

---

## 总结

**会被导入的字段**:
- ✅ stem → questions.text
- ✅ type → questions.questionType
- ✅ analysis/explanation → questions.explanation
- ✅ options[] → options.text
- ✅ answer[] → options.isCorrect

**会被忽略的字段**:
- ⚠️ id (使用UUID)
- ⚠️ difficulty (表中不存在)
- ⚠️ tags (表中不存在)
- ⚠️ chapter (表中不存在)

**自动生成的字段**:
- 🔄 questions.id (UUID)
- 🔄 questions.orderIndex (0, 1, 2...)
- 🔄 options.id (UUID)
- 🔄 options.optionIndex (A, B, C, D...)

这样的设计既保证了数据的正确导入，又保持了JSON文件的完整性和可扩展性。
