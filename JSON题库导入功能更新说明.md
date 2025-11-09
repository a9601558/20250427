# JSON题库导入功能 - 更新说明

## 更新时间
2025年11月9日

## 功能概述
为MonTopi题库管理系统添加了JSON格式题库导入功能，管理员现在可以直接上传标准JSON格式的题库文件，系统会自动创建题库并导入所有题目。

## 新增文件

### 前端文件
1. **src/components/admin/AdminJSONUpload.tsx**
   - 新的管理页面组件
   - 支持JSON文件上传和预览
   - 自动解析JSON文件并提取题库信息
   - 实时显示上传进度
   - 提供详细的错误反馈

### 后端文件
修改了以下文件：

1. **server/src/controllers/questionController.ts**
   - 新增 `jsonUploadQuestions` 函数
   - 处理JSON文件解析
   - 自动创建题库和导入题目
   - 使用事务确保数据一致性

2. **server/src/routes/questionRoutes.ts**
   - 新增路由: `POST /api/questions/json-upload`
   - 添加文件上传中间件和权限验证

3. **src/components/AdminPage.tsx**
   - 新增 `JSON_QUESTION_UPLOAD` tab
   - 集成 AdminJSONUpload 组件

### 文档文件
1. **JSON题库导入说明.md** - 详细的使用说明和格式文档
2. **题库JSON格式示例.json** - 标准格式的示例文件

## 主要特性

### 1. 完整的题库导入
- 一次性创建题库并导入所有题目
- 支持题库元数据（名称、来源、创建日期等）
- 自动设置题库配置（付费/免费、价格、试用题目数等）

### 2. 灵活的题目格式
- 支持单选题和多选题
- 支持2-26个选项（A-Z）
- 包含题目解析、难度、标签等可选信息

### 3. 自动信息提取
- 从JSON元数据自动填充题库信息
- 智能提取分类信息
- 显示题目预览

### 4. 完善的错误处理
- JSON格式验证
- 题目数据完整性检查
- 事务回滚机制（导入失败时不创建不完整的题库）
- 详细的错误报告

### 5. 用户友好的界面
- 文件拖放上传
- 实时文件预览
- 上传进度显示
- 成功/失败统计

## JSON格式要点

### 基本结构
```json
{
  "version": 1,
  "meta": { ... },
  "questions": [ ... ]
}
```

### 答案格式（重要！）
- 答案使用索引数组：`[0, 1, 2, 3]` 对应 `[A, B, C, D]`
- 单选题：`"answer": [0]` 表示正确答案是A
- 多选题：`"answer": [0, 2]` 表示正确答案是A和C

### 题目类型
- `"type": "single"` - 单选题
- `"type": "multiple"` - 多选题
- 如果不指定，系统会根据答案数量自动判断

## 与现有CSV格式的对比

| 特性 | CSV/TXT | JSON |
|------|---------|------|
| 结构化 | ❌ | ✅ |
| 元数据支持 | ❌ | ✅ |
| 题库自动创建 | ❌ | ✅ |
| 难度和标签 | ❌ | ✅ |
| 可维护性 | 一般 | 好 |
| 适用场景 | 快速添加题目 | 导入完整题库 |

## API端点

### POST /api/questions/json-upload

**权限**: 管理员

**请求格式**: multipart/form-data

**请求参数**:
- `file`: JSON文件（必填）
- `title`: 题库标题（必填）
- `description`: 题库描述（必填）
- `category`: 题库分类（必填）
- `isPaid`: 是否付费（可选，默认false）
- `price`: 价格（可选，默认0）
- `trialQuestions`: 试用题目数（可选，默认0）

**响应示例**:
```json
{
  "success": true,
  "data": {
    "questionSetId": "uuid",
    "success": 100,
    "failed": 0,
    "errors": []
  },
  "message": "题库创建成功，导入 100 道题目"
}
```

## 使用流程

1. 准备符合格式的JSON文件
2. 登录管理后台
3. 进入「JSON题库导入」页面
4. 填写题库基本信息
5. 上传JSON文件
6. 确认导入结果
7. 在「题库信息管理」中进行后续配置

## 注意事项

1. JSON文件必须是有效的JSON格式
2. 文件大小限制为10MB
3. 建议使用UTF-8编码
4. 导入失败会自动回滚，不会创建不完整的题库
5. 答案索引从0开始（0=A, 1=B, 2=C, 3=D）

## 测试建议

1. 使用提供的示例文件测试基本功能
2. 测试单选题和多选题
3. 测试错误处理（无效JSON、缺失字段等）
4. 验证事务回滚功能
5. 检查大文件上传（接近10MB）

## 未来改进建议

1. 支持更多题目类型（判断题、填空题等）
2. 支持题目图片上传
3. 支持批量编辑导入的题目
4. 导出现有题库为JSON格式
5. 提供JSON格式验证工具

## 技术细节

### 前端技术栈
- React + TypeScript
- FormData API for file upload
- XMLHttpRequest for progress tracking

### 后端技术栈
- Express.js
- Sequelize ORM
- UUID for ID generation
- Transaction support for data consistency

### 安全措施
- 管理员权限验证
- 文件类型检查
- 文件大小限制
- JSON格式验证
- SQL注入防护（使用参数化查询）

## 相关文件

- 示例文件: `题库JSON格式示例.json`
- 使用说明: `JSON题库导入说明.md`
- 前端组件: `src/components/admin/AdminJSONUpload.tsx`
- 后端控制器: `server/src/controllers/questionController.ts`
- 路由配置: `server/src/routes/questionRoutes.ts`

## 联系方式

如有问题或建议，请联系开发团队。
