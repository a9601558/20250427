# Node.js 和 npm 安装指南

## 问题
```
zsh: command not found: npm
```

这表示你的 macOS 系统上还没有安装 Node.js 和 npm。

## 解决方案

### 方法 1: 使用 Homebrew 安装（推荐）

#### 步骤 1: 安装 Homebrew（如果还没有安装）
在终端中运行：
```bash
/bin/bash -c "$(curl -fsSL https://raw.githubusercontent.com/Homebrew/install/HEAD/install.sh)"
```

#### 步骤 2: 使用 Homebrew 安装 Node.js
```bash
brew install node
```

#### 步骤 3: 验证安装
```bash
node --version
npm --version
```

---

### 方法 2: 从官网下载安装包

#### 步骤 1: 下载 Node.js
访问官网下载 macOS 安装包：
- **LTS 版本（推荐）**: https://nodejs.org/en/download/
- 选择 macOS Installer (.pkg)

#### 步骤 2: 安装
- 双击下载的 .pkg 文件
- 按照安装向导完成安装

#### 步骤 3: 验证安装
打开新的终端窗口：
```bash
node --version
npm --version
```

---

### 方法 3: 使用 nvm（Node Version Manager）

#### 优点
- 可以轻松切换不同版本的 Node.js
- 适合开发者

#### 步骤 1: 安装 nvm
```bash
curl -o- https://raw.githubusercontent.com/nvm-sh/nvm/v0.39.0/install.sh | bash
```

#### 步骤 2: 重启终端或运行
```bash
source ~/.zshrc
```

#### 步骤 3: 安装 Node.js
```bash
# 安装 LTS 版本
nvm install --lts

# 或安装特定版本
nvm install 18
```

#### 步骤 4: 设置默认版本
```bash
nvm alias default 18
```

#### 步骤 5: 验证安装
```bash
node --version
npm --version
```

---

## 推荐版本

对于这个项目，建议安装：
- **Node.js**: v18.x LTS 或更高版本
- **npm**: v9.x 或更高版本（随 Node.js 一起安装）

---

## 安装完成后

### 1. 安装项目依赖

#### 前端依赖
```bash
cd /Users/wilson/Desktop/montopi/20250427
npm install
```

#### 后端依赖
```bash
cd /Users/wilson/Desktop/montopi/20250427/server
npm install
```

### 2. 构建项目

#### 构建前端
```bash
cd /Users/wilson/Desktop/montopi/20250427
npm run build
```

#### 构建后端
```bash
cd /Users/wilson/Desktop/montopi/20250427/server
npm run build
```

#### 构建全部
```bash
cd /Users/wilson/Desktop/montopi/20250427
npm run build:all
```

### 3. 运行项目

#### 开发模式（前端）
```bash
cd /Users/wilson/Desktop/montopi/20250427
npm run dev
```

#### 启动后端服务器
```bash
cd /Users/wilson/Desktop/montopi/20250427/server
npm start
```

---

## 常见问题

### Q1: 安装完成后仍然显示 "command not found"？
**解决方案**: 
1. 关闭并重新打开终端
2. 或运行 `source ~/.zshrc`
3. 检查 PATH 环境变量：`echo $PATH`

### Q2: npm 安装依赖很慢？
**解决方案**: 使用国内镜像源
```bash
# 使用淘宝镜像
npm config set registry https://registry.npmmirror.com

# 恢复官方源
npm config set registry https://registry.npmjs.org
```

### Q3: 权限错误？
**解决方案**: 
```bash
# 不要使用 sudo npm install
# 如果遇到权限问题，修改 npm 全局目录的所有者
sudo chown -R $(whoami) ~/.npm
sudo chown -R $(whoami) /usr/local/lib/node_modules
```

---

## 项目特定说明

这个 MonTopi 项目包含：
- **前端**: React + Vite + TypeScript
- **后端**: Node.js + Express + TypeScript + Sequelize

### 所需的全局工具（可选）
```bash
# TypeScript 编译器
npm install -g typescript

# Sequelize CLI（数据库迁移）
npm install -g sequelize-cli
```

---

## 验证清单

安装完成后，请验证以下内容：

```bash
# ✅ Node.js 版本
node --version
# 应该显示 v18.x.x 或更高

# ✅ npm 版本
npm --version
# 应该显示 9.x.x 或更高

# ✅ 项目依赖
cd /Users/wilson/Desktop/montopi/20250427
npm list --depth=0
# 应该显示所有依赖包

# ✅ 构建是否成功
npm run build
# 应该成功完成，没有错误
```

---

## 快速开始（安装完成后）

```bash
# 1. 进入项目目录
cd /Users/wilson/Desktop/montopi/20250427

# 2. 安装所有依赖
npm install
cd server && npm install && cd ..

# 3. 构建项目
npm run build:all

# 4. 启动开发服务器（在两个终端中）
# 终端 1: 前端
npm run dev

# 终端 2: 后端
cd server && npm start
```

---

## 下一步

安装 Node.js 和 npm 后：
1. ✅ 安装项目依赖
2. ✅ 构建项目
3. ✅ 测试 JSON 题库导入功能
4. ✅ 上传你的 AWS-SAP 题库

---

## 需要帮助？

如果遇到安装问题，请提供：
- macOS 版本
- 错误信息截图
- 执行的命令

祝安装顺利！🚀
