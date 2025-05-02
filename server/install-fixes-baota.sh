#!/bin/bash

# Baota面板环境修复安装脚本
# 用于快速安装所有修复

echo "===== Baota面板环境修复安装脚本 ====="

# 当前目录
CURRENT_DIR=$(pwd)
echo "当前目录: $CURRENT_DIR"

# 复制文件
echo "正在复制修复文件..."

# 确保文件存在
if [ ! -f "baota-fix.js" ] || [ ! -f "direct-db-migration.js" ]; then
  echo "错误: 修复文件不存在，请确保baota-fix.js和direct-db-migration.js在当前目录"
  exit 1
fi

# 添加执行权限
chmod +x baota-fix.js
chmod +x direct-db-migration.js

# 运行Baota修复
echo "运行Baota修复..."
node baota-fix.js

# 运行数据库迁移
echo "运行数据库迁移..."
node direct-db-migration.js

echo "===== 修复安装完成 ====="
echo "您现在可以使用以下命令启动应用:"
echo "  npm run startsafe   # 使用安全脚本启动"
echo "  npm start           # 使用修改后的package.json启动" 