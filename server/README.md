# 考试练习应用后端

本目录包含考试练习应用的后端服务代码。

## 技术栈

- Node.js
- Express
- TypeScript
- Sequelize ORM
- MySQL

## 开发环境设置

1. 安装依赖:

```bash
npm install
```

2. 配置环境变量:

```bash
cp .env.example .env
```

编辑 `.env` 文件，设置数据库连接信息和其他必要配置。

3. 启动开发服务器:

```bash
npm run dev
```

## 数据库同步机制

本项目实现了全自动的数据库同步机制，确保代码与数据库结构一致:

1. **启动时自动同步**: 服务器启动时自动检查并同步数据库结构
2. **迁移系统**: 使用Sequelize迁移系统管理数据库结构变更
3. **模型同步**: 使用模型定义进行数据库表结构同步

### 数据库同步流程

1. 服务器启动时，首先尝试连接数据库
2. 执行所有未执行的迁移文件
3. 根据模型定义同步数据库表结构
4. 如果发现不一致，自动调整表结构

### 添加新迁移

当需要对数据库结构进行更改时:

```bash
npx sequelize-cli migration:generate --name migration-name
```

然后编辑生成的迁移文件添加必要的更改。

## 部署

### 标准部署

```bash
npm run deploy
```

### 宝塔面板部署

专门为宝塔面板优化的部署脚本:

```bash
npm run baota-deploy
```

这个脚本会:
1. 检查环境变量
2. 安装依赖
3. 编译TypeScript代码
4. 自动同步数据库结构
5. 设置必要的文件权限

## API路由

所有API路由已标准化，遵循RESTful设计原则:

- `GET /api/question-sets`: 获取所有题库
- `GET /api/question-sets/:id`: 获取特定题库
- `POST /api/question-sets`: 创建新题库
- `PUT /api/question-sets/:id`: 更新题库
- `DELETE /api/question-sets/:id`: 删除题库

- `GET /api/questions`: 获取所有题目
- `GET /api/questions/:id`: 获取特定题目
- `POST /api/questions`: 创建新题目
- `PUT /api/questions/:id`: 更新题目
- `DELETE /api/questions/:id`: 删除题目

- `POST /api/users/register`: 用户注册
- `POST /api/users/login`: 用户登录
- `GET /api/users/profile`: 获取用户资料
- `PUT /api/users/profile`: 更新用户资料

- `GET /api/homepage`: 获取首页设置
- `PUT /api/homepage`: 更新首页设置

- `POST /api/redeem-codes/create`: 创建兑换码
- `POST /api/redeem-codes/redeem`: 使用兑换码

- `POST /api/purchases`: 创建购买记录
- `GET /api/purchases/user`: 获取用户购买记录

## 数据模型

### 用户模型 (User)
- id: UUID (主键)
- username: 用户名
- email: 电子邮件
- password: 密码 (加密存储)
- role: 用户角色 (admin/user)

### 题库模型 (QuestionSet)
- id: UUID (主键)
- title: 题库标题
- description: 题库描述
- category: 题库分类
- isPaid: 是否付费
- price: 价格
- trialQuestions: 免费试用题目数

### 题目模型 (Question)
- id: UUID (主键)
- questionSetId: 所属题库ID
- text: 题目内容
- questionType: 题目类型 (single/multiple)
- explanation: 解析

### 选项模型 (Option)
- id: UUID (主键)
- questionId: 所属题目ID
- text: 选项内容
- isCorrect: 是否正确答案

### 购买记录模型 (Purchase)
- id: UUID (主键)
- userId: 用户ID
- quizId: 题库ID
- purchaseDate: 购买日期
- expiryDate: 到期日期

### 兑换码模型 (RedeemCode)
- id: UUID (主键)
- code: 兑换码
- questionSetId: 题库ID
- isUsed: 是否已使用
- usedBy: 使用用户ID
- expiryDate: 到期日期

### 首页设置模型 (HomepageSettings)
- id: 主键
- welcome_title: 欢迎标题
- welcome_description: 欢迎描述
- featured_categories: 推荐分类
- announcements: 公告内容
- footer_text: 页脚文本
- banner_image: 横幅图片

## 部署指南 (BaoTa Panel)

本文档提供在宝塔面板(BaoTa Panel)上部署该应用的步骤。

### 环境要求

- Node.js 16+ 
- MySQL 5.7+
- 宝塔面板 7.7.0+

### 部署步骤

1. **准备代码**

   上传代码到服务器或通过Git拉取代码:
   ```
   git clone <repository-url>
   cd <project-folder>/server
   npm install
   ```

2. **创建并配置环境变量**

   在server目录下创建.env文件:
   ```
   NODE_ENV=production
   PORT=5000
   DB_HOST=localhost
   DB_PORT=3306
   DB_USER=quizuser
   DB_PASSWORD=yourpassword
   DB_NAME=quizdb
   JWT_SECRET=your_jwt_secret_key
   JWT_EXPIRES_IN=30d
   ALLOW_PUBLIC_PROGRESS=true
   DB_MIGRATE=true
   ```

3. **数据库设置**

   在宝塔面板的数据库管理中:
   - 创建数据库 `quizdb`
   - 创建用户 `quizuser` 并设置密码 
   - 将 `quizuser` 用户授权给 `quizdb` 数据库

4. **执行自动迁移**

   系统会在启动时自动执行数据库迁移，也可以手动执行：
   ```
   cd <project-folder>/server
   npm run migrations
   ```

5. **构建应用**

   ```
   cd <project-folder>/server
   npm run build
   ```

6. **配置宝塔面板PM2管理器**

   在宝塔面板中:
   - 进入"软件商店" -> "PM2管理器" -> "添加项目"
   - 项目名称: `quiz-server`
   - 启动目录: `/www/wwwroot/<your-path>/server`
   - 启动命令: `npm run start`
   - 环境变量: 保持默认，已通过.env配置

7. **配置反向代理**

   在宝塔面板站点管理中:
   - 选择对应站点，点击"设置" -> "反向代理"
   - 添加新的反向代理，将 `/api` 和 `/socket.io` 路径代理到 `http://127.0.0.1:5000`

### 故障排除

1. **Table 'quizdb.homepage_settings' doesn't exist 错误**

   如果部署后出现此错误，请手动执行迁移脚本:
   ```
   cd <project-folder>/server
   node src/scripts/run-migrations.js
   ```

   如果遇到某个迁移失败，可以使用强制继续的模式执行迁移:
   ```
   npm run migrations:continue
   ```

2. **NPM权限问题**

   如果在宝塔面板上遇到npm权限问题，可以运行我们的权限修复工具:
   ```
   node src/scripts/fix-permissions.js
   ```

   如果权限问题无法自动修复，可以尝试:
   ```
   npm cache clean --force
   npm config set cache ~/.npm-cache
   ```

3. **数据库连接错误**

   检查以下几点:
   - 确认.env文件中的数据库信息正确
   - 确认MySQL数据库正在运行
   - 确认用户名和密码正确
   - 确认数据库名称存在
   - 检查数据库用户是否有足够权限

4. **检查迁移状态**

   要检查哪些迁移已应用、哪些迁移待执行，可以运行:
   ```
   node src/scripts/check-migrations.js
   ```
   或
   ```
   npm run migrations:check
   ```

5. **Socket.IO 连接问题**

   确保反向代理正确配置了Socket.IO路径:
   - 代理 `/socket.io` 路径到后端服务
   - 确保WebSocket支持已启用

### 升级步骤

1. 先备份数据库
2. 拉取最新代码
3. 重新构建应用: `npm run build`
4. 执行数据库迁移: `npm run migrations`
5. 重启应用: `pm2 restart quiz-server`

### 监控与日志

- 通过PM2查看应用日志: `pm2 logs quiz-server`
- 检查错误日志: `pm2 logs quiz-server --err`

## 部署后表格缺失问题

如果在部署后发现数据库中缺少一些表格，可以通过以下方法解决：

### 方法1：直接使用SQL创建所有表格

我们提供了一个SQL脚本和辅助工具，可以一次性创建所有必要的数据库表格：

```bash
# 使用自动化工具创建表格（推荐）
npm run setup:tables

# 或者手动执行SQL文件
mysql -u root -p < src/scripts/db-setup.sql
```

这个过程将：
1. 创建数据库（如果不存在）
2. 创建所有必要的表格（如果不存在）
3. 设置正确的表格关系和外键
4. 插入默认的主页设置数据
5. 将所有迁移标记为已完成

### 方法2：使用强制部署脚本

如果您无法直接访问MySQL命令行，可以使用我们的自动化部署脚本：

```bash
npm run deploy:db
```

这个脚本将使用Sequelize直接从模型定义创建表格，绕过迁移系统。

### 方法3：使用宝塔一键部署

在宝塔面板环境中，我们提供了专门的一键部署命令：

```bash
npm run baota:deploy
```

这个命令会：
1. 修复npm权限问题
2. 使用模型定义直接创建表格
3. 构建TypeScript代码
4. 启动服务器

如果遇到任何数据库相关问题，请检查您的`.env`文件，确保数据库连接信息正确：

```
DB_HOST=localhost
DB_PORT=3306
DB_USER=quizuser
DB_PASSWORD=quizpassword
DB_NAME=quizdb
```

## 常见问题解决方案

### 缺少数据库列问题

如果您遇到以下错误消息之一：
```
"Unknown column 'QuestionSet.icon' in 'field list'"
"Unknown column 'socket_id' in 'field list'"
```

这是由于数据库中的表结构缺少应用程序代码中引用的列。我们提供了多种解决方案：

#### 方法1：使用迁移系统添加缺失列（Linux/Mac环境）

```bash
# 确保您有权限访问数据库
cd <project-folder>/server
npm run migrations
```

#### 方法2：使用SQL文件直接添加（适用于所有环境）

将以下SQL命令复制并在MySQL客户端中执行：

```sql
USE quizdb;

-- 添加question_sets表缺失的列
ALTER TABLE question_sets ADD COLUMN IF NOT EXISTS icon VARCHAR(255) NULL COMMENT 'Icon URL or identifier for the question set';
ALTER TABLE question_sets ADD COLUMN IF NOT EXISTS is_paid BOOLEAN NOT NULL DEFAULT false;
ALTER TABLE question_sets ADD COLUMN IF NOT EXISTS trial_questions INT NULL DEFAULT 0;
ALTER TABLE question_sets ADD COLUMN IF NOT EXISTS is_featured BOOLEAN NOT NULL DEFAULT false;
ALTER TABLE question_sets ADD COLUMN IF NOT EXISTS featured_category VARCHAR(100) NULL;

-- 添加users表缺失的列
ALTER TABLE users ADD COLUMN IF NOT EXISTS socket_id VARCHAR(255) NULL COMMENT 'Socket.io connection ID';
ALTER TABLE users ADD COLUMN IF NOT EXISTS purchases TEXT NULL DEFAULT '[]';
ALTER TABLE users ADD COLUMN IF NOT EXISTS redeemCodes TEXT NULL DEFAULT '[]';
ALTER TABLE users ADD COLUMN IF NOT EXISTS progress TEXT NULL DEFAULT '{}';
ALTER TABLE users ADD COLUMN IF NOT EXISTS examCountdowns TEXT NULL DEFAULT '[]';
ALTER TABLE users ADD COLUMN IF NOT EXISTS verified BOOLEAN NOT NULL DEFAULT false;
ALTER TABLE users ADD COLUMN IF NOT EXISTS failedLoginAttempts INT NOT NULL DEFAULT 0;
ALTER TABLE users ADD COLUMN IF NOT EXISTS accountLocked BOOLEAN NOT NULL DEFAULT false;
ALTER TABLE users ADD COLUMN IF NOT EXISTS lockUntil DATETIME NULL;
ALTER TABLE users ADD COLUMN IF NOT EXISTS preferredLanguage VARCHAR(10) NULL DEFAULT 'zh-CN';
ALTER TABLE users ADD COLUMN IF NOT EXISTS profilePicture VARCHAR(255) NULL;
ALTER TABLE users ADD COLUMN IF NOT EXISTS lastLoginAt DATETIME NULL;

-- 将迁移标记为已完成
INSERT IGNORE INTO SequelizeMeta (name) VALUES ('20250511-add-missing-columns.js');
```

#### 方法3：使用自动部署脚本

最简单的方法是使用我们的全自动部署脚本，它会自动检测和解决所有数据库结构问题：

```bash
# 在宝塔面板环境中执行
npm run baota:deploy
```

### isAdmin列缺失问题

如果您遇到以下错误消息：
```
"Unknown column 'isAdmin' in 'field list'"
```

这是由于数据库中的`users`表结构缺少`isAdmin`字段所导致的。解决此问题有几种方法：

#### 方法1：使用SQL文件直接添加（推荐）

我们提供了一个SQL文件，可以直接添加缺失的字段：

```bash
# 用MySQL客户端执行以下命令
mysql -u root -p quizdb < add-isAdmin-column.sql
```

#### 方法2：使用自动化脚本

如果您已经配置好了环境，可以使用我们提供的自动化脚本：

```bash
npm run fix:isAdmin:direct
```

#### 方法3：手动SQL命令

直接在MySQL客户端中执行以下SQL命令：

```sql
USE quizdb;
ALTER TABLE users ADD COLUMN IF NOT EXISTS isAdmin BOOLEAN NOT NULL DEFAULT false;
UPDATE users SET isAdmin = (role = 'admin') WHERE true;
INSERT IGNORE INTO SequelizeMeta (name) VALUES ('20250509-add-isAdmin-to-users.js');
```

#### 方法4：完整部署

如果您需要重新部署或更新整个应用程序，可以使用：

```bash
npm run baota:deploy
```

这将修复权限问题，添加缺失的`isAdmin`列，确保所有表格都存在，编译TypeScript代码并启动服务器。 