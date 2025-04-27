# 考试练习应用

一个帮助用户准备考试的应用程序，允许用户浏览题库、练习题目、购买题集，并跟踪学习进度。

## 项目结构

```
.
├── .git/                 # Git 仓库元数据
├── .github/              # (可能存在) GitHub 相关配置 (Actions, templates)
├── dist/                 # 构建后的前端静态资源
├── node_modules/         # Node.js 依赖
├── public/               # 静态资源目录 (会被直接复制到 dist)
├── server/               # 后端 Node.js 服务代码
│   ├── controllers/      # 控制器 (处理请求逻辑)
│   ├── models/           # 数据模型 (数据库交互)
│   ├── routes/           # API 路由定义
│   ├── middleware/       # 中间件
│   ├── config/           # 配置文件
│   ├── migrations/       # 数据库迁移文件
│   ├── seeders/          # 数据种子文件
│   ├── utils/            # 工具函数
│   └── ...               # 其他后端相关文件
├── src/                  # 前端源代码 (React + TypeScript)
│   ├── assets/           # 静态资源 (图片, 字体等)
│   ├── components/       # 可复用 UI 组件
│   ├── contexts/         # React Context (状态管理)
│   ├── utils/            # 工具函数
│   ├── services/         # API 请求服务
│   ├── App.tsx           # 应用根组件
│   └── main.tsx          # 应用入口文件
├── .gitattributes        # 定义 Git 如何处理特定文件
├── .gitignore            # 指定 Git 忽略的文件/目录
├── api-path-mapping.conf # (推测) Nginx/代理的 API 路径映射配置
├── api-path-test.sh      # API 路径测试脚本
├── api-proxy-settings.conf # (推测) API 代理配置
├── backend-route-diagnosis.js # 后端路由诊断脚本
├── cleanup-files.txt     # (推测) 需要清理的文件列表
├── code-cleanup-report.md # 代码清理报告
├── eslint.config.js      # ESLint 配置文件 (代码风格检查)
├── index.html            # SPA 的 HTML 入口文件
├── nginx-headers-only.conf # (推测) Nginx 仅含头信息的配置
├── nginx-setup.md        # Nginx 设置指南
├── nginx.conf            # Nginx 配置文件
├── package-lock.json     # 锁定依赖版本
├── package.json          # 项目元数据和依赖管理
├── postcss.config.js     # PostCSS 配置文件 (CSS 预处理)
├── README.md             # 项目说明文件 (就是你正在看的这个)
├── restart-server.cjs    # 重启服务器脚本 (CommonJS)
├── restart-server.js     # 重启服务器脚本 (ES Module)
├── route-fix-guide.md    # 路由修复指南
├── tailwind.config.js    # Tailwind CSS 配置文件
├── test-api-routes.sh    # API 路由测试脚本
├── test-register.js      # (推测) 测试注册相关脚本
├── tsconfig.json         # TypeScript 配置
└── vite.config.ts        # Vite 配置文件 (前端构建工具)
```

**结构分析:**

*   这是一个典型的全栈 Web 应用项目结构，前端使用 Vite + TypeScript (可能配合 React/Vue)，后端使用 Node.js + TypeScript。
*   前端代码位于 `src/`，后端代码位于 `server/`。
*   构建产物输出到 `dist/`。
*   包含丰富的配置文件，涵盖了构建、类型检查、代码风格、CSS 处理、Nginx 代理等。
*   存在多个脚本文件，用于测试、诊断、服务重启等辅助开发和运维任务。
*   文档比较齐全，包括 README、Nginx 设置指南和路由修复指南。
*   需要注意区分 `.js` 和 `.cjs` 文件，以及不同的 `tsconfig.*.json` 文件，它们可能用于不同的环境 (前端/后端/脚本)。
*   `public/` 目录下的文件会直接复制到构建目录，适合存放无需构建处理的静态资源。
*   建议进一步查看 `src/` 和 `server/` 目录下的具体结构，以了解更详细的模块划分。

## 快速开始

### 后端服务

1. 进入server目录
```bash
cd server
```

2. 安装依赖
```bash
npm install
```

3. 配置环境变量
```bash
cp .env.example .env
# 编辑.env文件，填写必要的配置项
```

4. 启动服务
```bash
npm run dev
```

### 前端应用

1. 安装依赖
```bash
npm install
```

2. 启动开发服务器
```bash
npm run dev
```

## 部署到宝塔面板

本项目支持一键部署到宝塔面板，并会自动同步数据库结构。

### 部署步骤

1. 将代码上传到服务器
2. 进入server目录
```bash
cd server
```

3. 确保环境变量配置正确
```bash
cp .env.example .env
# 编辑.env文件，填写必要的数据库配置
```

4. 运行部署脚本
```bash
npm run baota-deploy
```

5. 启动服务器
```bash
npm start
```

6. 配置Nginx反向代理
使用项目根目录中的`nginx.conf`作为参考配置Nginx反向代理。

## 优化说明

本项目已经进行了全面优化：

1. **API路由一致性**：所有API路由路径已标准化，遵循RESTful设计原则
2. **数据库同步机制**：服务启动时自动检查并同步数据库结构
3. **宝塔面板部署**：提供专门的宝塔面板部署脚本，确保无缝部署
4. **代码结构优化**：清晰分离前后端代码，使用TypeScript提供类型安全
5. **自动化迁移**：使用Sequelize迁移系统确保数据库结构版本控制

## 主要功能

- 题库浏览与购买
- 题目练习与答题
- 学习进度追踪
- 会员权限管理
- 兑换码系统

## 技术栈

- **前端**: React, TypeScript, Tailwind CSS
- **后端**: Node.js, Express, TypeScript
- **数据库**: MySQL, Sequelize ORM
- **认证**: JWT

## 数据库同步机制

本项目实现了全自动的数据库同步机制：

1. **启动时检查**：服务器启动时会自动检查数据库结构是否与代码定义一致
2. **自动迁移**：如果检测到不一致，系统会自动运行迁移脚本同步数据库结构
3. **兼容性保障**：迁移设计确保向前兼容，不会丢失或破坏现有数据
4. **部署集成**：宝塔面板部署脚本集成了数据库同步功能

## 贡献指南

1. Fork 该项目
2. 创建新的功能分支 (`git checkout -b feature/amazing-feature`)
3. 提交更改 (`git commit -m 'Add some amazing feature'`)
4. 推送到分支 (`git push origin feature/amazing-feature`)
5. 创建Pull Request

## 许可证

MIT

## 功能特点

### 用户系统
- 用户注册和登录
- 个人资料管理
- 普通用户和管理员角色

### 题库系统
- 多种分类的题库
- 单选题和多选题支持
- 题目随机顺序
- 答题记录和进度保存
- 正确率统计

### 付费系统
- 免费题库和付费题库
- 付费题库支持试用部分题目
- Stripe集成进行支付处理
- 购买记录管理
- 有效期为6个月的访问权限

### 兑换码系统
- 管理员可生成兑换码
- 支持自定义有效期的兑换码
- 兑换码可用于获取付费题库访问权限
- 兑换记录管理

### 管理功能
- 用户管理：查看、添加、编辑、删除用户
- 题库管理：创建、编辑、删除题库
- 首页内容管理：编辑网站显示内容
- 兑换码管理：生成和跟踪兑换码使用情况

## 用户指南

### 作为普通用户

1. **浏览题库**
   - 在首页可以查看所有可用题库
   - 免费题库可直接访问
   - 付费题库显示价格和试用题目数量

2. **答题功能**
   - 选择题库开始答题
   - 查看答题进度和正确率
   - 复习错题和已答题目

3. **付费内容访问**
   - 在付费题库中，可以免费试用部分题目
   - 通过支付购买完整题库（有效期6个月）
   - 使用兑换码获取题库访问权限

4. **个人中心**
   - 查看学习进度
   - 管理购买记录
   - 查看兑换码使用记录
   - 账户设置（开发中）

### 作为管理员

1. **用户管理**
   - 查看所有用户
   - 添加、编辑、删除用户

2. **题库管理**
   - 创建新题库和题目
   - 设置免费/付费状态
   - 编辑现有题库

3. **兑换码管理**
   - 为特定题库生成兑换码
   - 设置兑换码有效期
   - 批量生成兑换码
   - 跟踪兑换码使用情况

4. **内容管理**
   - 编辑首页内容
   - 管理网站设置

## 技术栈

- 前端：React、TypeScript、Tailwind CSS
- 状态管理：React Context API
- 路由：React Router
- 支付处理：Stripe
- 样式：Tailwind CSS

## 开发与运行

1. 安装依赖:
```
npm install
```

2. 启动开发服务器:
```
npm run dev
```

3. 构建生产版本:
```
npm run build
```

## 兑换码和支付流程

### 兑换码流程
1. 管理员在管理后台为特定题库生成兑换码
2. 用户在题库页面点击"使用兑换码"
3. 输入有效兑换码后，获取该题库的完整访问权限
4. 系统记录兑换情况和有效期

### 支付流程
1. 用户在题库页面点击"购买完整题库"
2. 弹出支付窗口，用户输入支付信息
3. 支付成功后，用户获得该题库6个月的访问权限
4. 系统记录购买记录和到期时间
