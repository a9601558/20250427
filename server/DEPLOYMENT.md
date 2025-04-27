# 系统部署指南

## 前提条件

在部署系统前，请确保您的服务器上已安装以下软件：

- Node.js (v16.0.0 或更高版本)
- MySQL (v5.7 或更高版本)
- NPM (通常随Node.js一起安装)

## 部署步骤

### 1. 获取代码

```bash
# 克隆代码仓库
git clone [你的仓库地址]
cd exam-practice-app/server
```

### 2. 配置环境变量

```bash
# 复制示例配置文件
cp .env.example .env

# 使用文本编辑器修改.env文件
# 必须设置: DB_HOST, DB_PORT, DB_USER, DB_PASSWORD, DB_NAME, JWT_SECRET
```

### 3. 自动化部署

使用我们的自动部署脚本：

```bash
node deploy.js
```

这个脚本会自动：
- 安装依赖包
- 编译TypeScript代码
- 创建必要的目录
- 初始化数据库
- 复制默认图片

### 4. 启动应用

```bash
# 开发环境
npm run dev

# 生产环境
npm start
```

## 手动部署步骤

如果您希望手动部署，可以按照以下步骤操作：

### 1. 安装依赖

```bash
npm install
```

### 2. 初始化数据库

```bash
# 创建数据库和表
npm run db:create
```

### 3. 编译TypeScript（生产环境）

```bash
npm run build
```

### 4. 启动服务器

```bash
# 开发环境
npm run dev

# 生产环境
npm start
```

## 数据库自动创建说明

本系统采用了多重保障确保数据库表能够自动创建：

1. **使用Sequelize Migration**：通过迁移文件定义表结构，在启动时执行
2. **使用Sequelize Model Sync**：通过模型定义同步数据库表结构
3. **数据库初始化脚本**：检查并创建必要的数据库和表

在每次启动时，系统会：
1. 检查数据库是否存在，不存在则创建
2. 执行迁移文件，创建或更新表结构
3. 同步模型定义到数据库

## 故障排除

如果遇到数据库连接问题：

1. 检查MySQL服务是否运行
2. 确认`.env`文件中的数据库配置是否正确
3. 确保数据库用户具有创建数据库和表的权限
4. 查看日志中的具体错误信息

如果遇到表创建失败：

1. 尝试手动执行：`npm run db:create`
2. 查看MySQL错误日志
3. 确保MySQL用户具有足够的权限 