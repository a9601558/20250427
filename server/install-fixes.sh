#!/bin/bash

# 自动安装Sequelize修复工具
# 自动生成于 2025-05-02T12:08:30.838Z

# 目标目录
TARGET_DIR=${1:-"$(pwd)"}
echo "目标目录: $TARGET_DIR"

# 颜色定义
RED='[0;31m'
GREEN='[0;32m'
YELLOW='[0;33m'
NC='[0m' # No Color

echo -e "${GREEN}===== 开始安装Sequelize修复工具 =====${NC}"

# 下载修复脚本
echo -e "${YELLOW}下载修复脚本...${NC}"

# 创建目录
mkdir -p "$TARGET_DIR/scripts"

# 下载脚本
curl -s -o "$TARGET_DIR/direct-sequelize-patch.js" "https://raw.githubusercontent.com/用户名/项目名/main/direct-sequelize-patch.js"
curl -s -o "$TARGET_DIR/sequelize-instance-fix.js" "https://raw.githubusercontent.com/用户名/项目名/main/sequelize-instance-fix.js"
curl -s -o "$TARGET_DIR/sequelize-constructor-fix.js" "https://raw.githubusercontent.com/用户名/项目名/main/sequelize-constructor-fix.js"
curl -s -o "$TARGET_DIR/db-init.js" "https://raw.githubusercontent.com/用户名/项目名/main/db-init.js"
curl -s -o "$TARGET_DIR/fix-all.sh" "https://raw.githubusercontent.com/用户名/项目名/main/fix-all.sh"

# 添加执行权限
chmod +x "$TARGET_DIR/direct-sequelize-patch.js"
chmod +x "$TARGET_DIR/sequelize-instance-fix.js"
chmod +x "$TARGET_DIR/sequelize-constructor-fix.js"
chmod +x "$TARGET_DIR/db-init.js"
chmod +x "$TARGET_DIR/fix-all.sh"

echo -e "${GREEN}修复脚本已下载并安装${NC}"

# 更新package.json
node "$TARGET_DIR/direct-sequelize-patch.js" "$TARGET_DIR"

echo -e "${GREEN}===== 安装完成 =====${NC}"
echo -e "${YELLOW}现在您可以使用以下命令:${NC}"
echo "  npm start     # 启动应用(自动应用修复)"
echo "  npm run fix   # 手动运行Sequelize修复"
echo "  npm run fixdb # 修复数据库表"
echo "  npm run fixall # 运行所有修复"
  