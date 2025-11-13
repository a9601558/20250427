# 题库管理系统 - JSON导入功能

## 🎉 新功能：JSON题库批量导入

管理员现在可以通过 JSON 格式批量导入题库和题目，支持单选题和多选题。

### ✨ 功能特点

- 📤 **拖拽上传** - 支持拖放 JSON 文件或点击选择
- 👁️ **实时预览** - 上传前可预览题库元数据和前3道题目
- 📊 **进度跟踪** - 实时显示上传进度和处理状态
- ✅ **批量导入** - 一次导入整个题库（支持数百道题目）
- 🔄 **事务保证** - 确保数据一致性，失败自动回滚
- 📝 **详细报告** - 显示成功/失败数量和具体错误信息

### 📂 JSON 格式要求

```json
{
  "version": "1.0",
  "meta": {
    "subject": "AWS SAP",
    "source": "官方题库",
    "totalQuestions": 217
  },
  "questions": [
    {
      "id": "Q-0001",
      "type": "single",
      "stem": "题干内容...",
      "options": [
        "选项 A",
        "选项 B",
        "选项 C",
        "选项 D"
      ],
      "answer": [0],
      "analysis": "答案解析..."
    }
  ]
}
```

**字段说明：**
- `type`: `"single"` (单选) 或 `"multiple"` (多选)
- `answer`: 答案索引数组，0=A, 1=B, 2=C, 3=D
- `analysis`: 答案解析（可选，默认为"无解析"）

### 🚀 使用方法

1. **登录管理员账号**
2. **进入管理页面**
3. **点击 "JSON题库导入" 标签**
4. **填写题库信息：**
   - 题库标题
   - 题库描述
   - 分类
   - 是否付费
   - 价格（如果付费）
   - 试用题目数量
5. **上传 JSON 文件**
6. **预览并确认**
7. **点击 "开始导入"**
8. **等待导入完成**

### 📊 导入结果

导入完成后会显示：
- ✅ 成功导入的题目数量
- ❌ 失败的题目数量
- 📋 详细错误列表（如果有失败）

### 🔒 权限要求

- 需要管理员权限
- 自动记录导入操作日志
- 支持事务回滚保护数据一致性

### 📚 示例文件

参考示例文件：`docs/examples/题库JSON格式示例.json`

### 🛠️ 技术实现

**前端：**
- React + TypeScript
- 文件拖拽上传
- XMLHttpRequest 进度跟踪
- React Toastify 消息提示

**后端：**
- Node.js + Express + TypeScript
- Sequelize ORM 数据库事务
- Multer 文件上传处理
- JWT 认证和权限验证

**数据库：**
- 使用事务确保数据一致性
- 自动生成 UUID
- 支持单选和多选题型
- 关联 question_sets、questions、options 表

### 📖 相关文档

- [JSON题库导入详细说明](docs/features/JSON题库导入说明.md)
- [数据库字段映射说明](docs/features/JSON题库导入-数据库字段映射详解.md)
- [JSON格式示例](docs/examples/题库JSON格式示例.json)

### 🐛 问题反馈

如遇到问题，请查看：
1. 浏览器控制台错误信息
2. 服务器日志：`pm2 logs exam-server`
3. 检查 JSON 格式是否正确
4. 确认文件大小不超过 10MB

---

## 项目结构

```
montopi/
├── src/                          # 前端源代码
│   ├── components/
│   │   ├── admin/
│   │   │   └── AdminJSONUpload.tsx   # JSON上传组件
│   │   ├── AdminPage.tsx             # 管理页面
│   │   └── ...
│   ├── api/
│   ├── config/
│   └── ...
├── server/                       # 后端源代码
│   ├── src/
│   │   ├── controllers/
│   │   │   └── questionController.ts  # JSON导入API
│   │   ├── routes/
│   │   │   └── questionRoutes.ts      # 路由配置
│   │   ├── middleware/
│   │   │   └── fileUploadMiddleware.ts # 文件上传
│   │   └── models/
│   └── ...
├── docs/                         # 项目文档
│   ├── deployment/              # 部署文档
│   ├── features/                # 功能说明
│   └── examples/                # 示例文件
└── README.md
```

## 快速开始

### 开发环境

```bash
# 安装依赖
npm install
cd server && npm install

# 启动开发服务器
npm run dev           # 前端（端口 5173）
cd server && npm run dev  # 后端（端口 3000）
```

### 生产部署

```bash
# 编译
npm run build
cd server && npm run build

# 启动
pm2 start ecosystem.config.js
```

详细部署文档：[生产环境部署指南](docs/deployment/PRODUCTION_DEPLOYMENT_GUIDE.md)

## 许可证

[MIT License](LICENSE)
