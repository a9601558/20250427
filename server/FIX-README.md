# 服务器问题修复说明

本文档详细记录了在服务器部署过程中遇到的问题及其解决方案。

## 1. Sequelize实例问题修复

### 问题描述
启动服务器时遇到"No Sequelize instance passed"错误，这是因为Sequelize实例没有被正确传递给模型。

### 解决方案
- 创建了全局Sequelize实例预加载脚本 `sequelize-preload.js`
- 通过Node的`--require`选项注入全局Sequelize实例

## 2. Sequelize safeExport重复声明问题

### 问题描述
启动服务器时出现"SyntaxError: Identifier 'safeExport' has already been declared"错误。

### 解决方案
- 创建`baota-fix.js`脚本修复Sequelize核心文件
- 注释掉sequelize.js文件中的`const safeExport = module.exports;`行
- 创建安全版预加载脚本`sequelize-preload-safe.js`

## 3. 数据库表缺失问题

### 问题描述
服务器启动后报错"Table 'quizdb.homepage_settings' doesn't exist"

### 解决方案
- 创建`direct-db-migration.js`脚本直接创建缺失的表
- 绕过npm权限问题，直接使用Sequelize API创建表结构

## 4. Express路由回调缺失问题

### 问题描述
服务器启动时出现"Error: Route.put() requires a callback function but got a [object Undefined]"错误，这是因为路由配置中引用了不存在的控制器函数。

### 解决方案
- 在`questionSetRoutes.ts`文件中，将路由从引用`homepageController`中的`updateQuestionSetFeaturedStatus`
- 改为使用`questionSetController`中已经存在的`setFeaturedQuestionSet`函数
- 修复了导入语句，确保正确引用控制器函数

## 启动指南

### 标准启动
```bash
npm start
```

### 使用完全修复的启动脚本
```bash
./start-complete.sh
```

### 初始化数据库
```bash
node db-init-simple.js
``` 