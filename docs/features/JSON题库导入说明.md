# JSON题库导入功能说明

## 功能概述

管理员现在可以通过JSON格式直接上传整套题库，包括题目、选项、答案和解析等完整信息。

## 使用方法

1. 登录管理后台
2. 点击左侧菜单的「JSON题库导入」
3. 填写题库基本信息（标题、分类、描述等）
4. 上传符合格式的JSON文件
5. 系统会自动创建题库并导入所有题目

## JSON文件格式说明

### 文件结构

```json
{
  "version": 1,
  "meta": {
    "subject": "题库名称",
    "source": "题库来源",
    "createdAt": "创建日期",
    "totalQuestions": 题目总数
  },
  "questions": [
    {
      "id": "题目编号",
      "type": "single或multiple",
      "stem": "题目内容",
      "options": ["选项A", "选项B", "选项C", "选项D"],
      "answer": [正确答案索引],
      "analysis": "解析内容",
      "difficulty": 难度等级,
      "tags": ["标签1", "标签2"],
      "chapter": "章节"
    }
  ]
}
```

### 字段说明

#### 根级别字段

- **version** (number): 格式版本号（可选，会被忽略）
- **meta** (object): 元数据对象（可选，仅用于自动填充题库信息）
- **questions** (array): 题目数组，必须包含至少一道题目

#### 题目字段说明

**必填字段（将被导入到数据库）：**
- **stem** (string): 题目内容/题干 → 存入 `questions.text`
- **options** (array): 选项数组，至少需要2个选项 → 存入 `options.text`
- **answer** (array): 正确答案的索引数组 → 存入 `options.isCorrect`
  - 索引从0开始：0=A, 1=B, 2=C, 3=D
  - 单选题：`[0]` 表示正确答案是A
  - 多选题：`[0, 2]` 表示正确答案是A和C

**可选字段（将被导入到数据库）：**
- **type** (string): 题目类型 → 存入 `questions.questionType`
  - "single": 单选题
  - "multiple": 多选题
  - 如不指定，系统会根据answer数组长度自动判断
- **analysis** 或 **explanation** (string): 题目解析 → 存入 `questions.explanation`
  - 如果没有提供，将使用默认值"无解析"

**会被忽略的字段（数据库表中不存在）：**
- **id** (string): 题目编号（系统会自动生成UUID）
- **difficulty** (number): 难度等级（数据库表中未定义此字段）
- **tags** (array): 题目标签（数据库表中未定义此字段）
- **chapter** (string): 所属章节（数据库表中未定义此字段）

> **注意**: JSON文件中包含上述被忽略的字段不会导致错误，系统会自动跳过这些字段。这样可以保持JSON文件的完整性，便于在其他系统中使用。

### 示例

#### 单选题示例
```json
{
  "id": "Q-0001",
  "type": "single",
  "stem": "Python使用什么符号进行注释？",
  "options": ["#", "//", "/* */", "--"],
  "answer": [0],
  "analysis": "Python使用#作为单行注释符号"
}
```

#### 多选题示例
```json
{
  "id": "Q-0002",
  "type": "multiple",
  "stem": "以下哪些是Python的数据类型？",
  "options": ["int", "string", "boolean", "char"],
  "answer": [0, 1, 2],
  "analysis": "Python有int、string、boolean等数据类型"
}
```

## 与现有CSV格式的区别

| 特性 | CSV/TXT格式 | JSON格式 |
|------|-------------|----------|
| 文件结构 | 简单，一行一题 | 结构化，包含元数据 |
| 题目类型 | 根据答案自动判断 | 明确指定 |
| 元数据 | 无 | 支持题库元数据、标签、难度等 |
| 可读性 | 较差 | 好，易于编辑和维护 |
| 适用场景 | 快速导入简单题目 | 导入完整题库 |
| 题库创建 | 需要先创建题库 | 自动创建题库 |

## 数据库字段映射

系统将JSON数据映射到以下数据库表：

### QuestionSets表（题库）
| JSON字段 | 数据库字段 | 说明 |
|---------|-----------|------|
| （表单输入）title | title | 题库标题 |
| （表单输入）description | description | 题库描述 |
| （表单输入）category | category | 题库分类 |
| （表单输入）isPaid | is_paid | 是否付费 |
| （表单输入）price | price | 价格 |
| （表单输入）trialQuestions | trial_questions | 试用题目数 |
| - | icon | 图标（默认值："default"） |
| - | is_featured | 是否精选（默认值：false） |

### Questions表（题目）
| JSON字段 | 数据库字段 | 说明 |
|---------|-----------|------|
| stem | text | 题目内容/题干 |
| type | questionType | 题目类型（single/multiple） |
| analysis 或 explanation | explanation | 题目解析 |
| （自动生成） | orderIndex | 题目排序（按导入顺序） |
| ~~id~~ | ~~（忽略）~~ | ~~系统自动生成UUID~~ |
| ~~difficulty~~ | ~~（忽略）~~ | ~~数据库无此字段~~ |
| ~~tags~~ | ~~（忽略）~~ | ~~数据库无此字段~~ |
| ~~chapter~~ | ~~（忽略）~~ | ~~数据库无此字段~~ |

### Options表（选项）
| JSON字段 | 数据库字段 | 说明 |
|---------|-----------|------|
| options[n] | text | 选项文本内容 |
| answer（索引） | isCorrect | 是否为正确答案 |
| （自动生成） | optionIndex | 选项标识（A/B/C/D...） |

## 注意事项

1. JSON文件必须是有效的JSON格式，可使用在线工具验证
2. 文件编码建议使用UTF-8
3. **答案索引从0开始计数**（0=A, 1=B, 2=C, 3=D）这是最重要的！
4. 单选题的answer数组只能包含1个元素，例如：`[0]`
5. 多选题的answer数组包含多个元素，例如：`[0, 2, 3]`
6. 最多支持10MB的文件大小
7. **JSON中的额外字段（如difficulty、tags、chapter）不会导致错误，会被自动忽略**
8. 题目ID会由系统自动生成UUID，JSON中的id字段会被忽略

## 错误处理

如果导入过程中出现错误，系统会：
- 回滚整个导入操作，不会创建不完整的题库
- 显示前10条错误信息
- 记录成功和失败的题目数量

## 推荐工作流程

1. 准备题库JSON文件（可参考示例文件）
2. 使用JSON验证工具检查格式
3. 在管理后台上传文件
4. 确认导入结果
5. 在「题库信息管理」中调整题库设置（如是否付费、试用题目数等）

## 技术支持

如有问题，请联系技术支持团队。

---

**示例文件位置**: `/题库JSON格式示例.json`
