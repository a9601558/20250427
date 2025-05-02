#!/bin/bash

# 全面修复脚本 - 修复服务器上的Sequelize实例和数据库表问题
# 用法: ./fix-all.sh [服务器目录]

# 目标目录
TARGET_DIR=${1:-'/www/wwwroot/root/git/dist/dist/server'}
echo "目标目录: $TARGET_DIR"

# 颜色定义
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[0;33m'
NC='\033[0m' # No Color

echo -e "${GREEN}===== 开始全面修复 =====${NC}"

# 检查目标目录
if [ ! -d "$TARGET_DIR" ]; then
    echo -e "${RED}错误: 目标目录不存在: $TARGET_DIR${NC}"
    echo "请提供正确的目录路径，例如: ./fix-all.sh /www/wwwroot/root/git/dist/dist/server"
    exit 1
fi

# 步骤1: 修复Sequelize实例问题
echo -e "${YELLOW}步骤1: 修复Sequelize实例问题${NC}"
node sequelize-instance-fix.js "$TARGET_DIR" || {
    echo -e "${RED}Sequelize实例修复失败${NC}"
    exit 1
}

# 步骤2: 修复Sequelize构造函数问题
echo -e "${YELLOW}步骤2: 修复Sequelize构造函数问题${NC}"
node sequelize-constructor-fix.js "$TARGET_DIR" || {
    echo -e "${RED}Sequelize构造函数修复失败${NC}"
    exit 1
}

# 步骤3: 初始化数据库表
echo -e "${YELLOW}步骤3: 初始化数据库表${NC}"
node db-init.js "$TARGET_DIR" || {
    echo -e "${RED}数据库初始化失败${NC}"
    exit 1
}

echo -e "${GREEN}===== 全面修复完成 =====${NC}"
echo -e "${YELLOW}现在可以重启应用了:${NC}"
echo "  cd $TARGET_DIR"
echo "  npm start"
echo ""
echo -e "${GREEN}如果使用PM2, 运行:${NC}"
echo "  pm2 restart your-app-name" 