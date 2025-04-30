#!/bin/bash

# 设置工作目录
WORK_DIR="/www/wwwroot/root/git/dist"
cd $WORK_DIR

# 安装根目录依赖
echo "安装根目录依赖..."
npm install

# 安装并构建服务器
echo "安装并构建服务器..."
cd $WORK_DIR/server
npm install
npm run build

# 运行数据库迁移
echo "运行数据库迁移..."
cd $WORK_DIR/server
node run-migrations.js

# 使用PM2启动
echo "启动服务..."
cd $WORK_DIR
pm2 start ecosystem.config.js --env production

# 保存PM2配置，以便服务器重启后自动启动
echo "保存PM2配置..."
pm2 save

echo "✅ 服务已成功启动" 