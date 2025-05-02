#!/bin/bash

# Sequelize修复部署脚本
# 用于在部署时自动应用Sequelize修复

# 参数处理
TARGET_DIR=${1:-'/www/wwwroot/root/git/dist/dist/server'}
SOURCE_DIR=${2:-$(dirname "$(readlink -f "$0")")}

# 颜色定义
RED="\033[0;31m"
GREEN="\033[0;32m"
YELLOW="\033[0;33m"
NC="\033[0m" # No Color

echo -e "${GREEN}===== Sequelize修复部署脚本 =====${NC}"
echo -e "目标目录: ${TARGET_DIR}"
echo -e "源目录: ${SOURCE_DIR}"

# 检查目标目录
if [ ! -d "$TARGET_DIR" ]; then
  echo -e "${RED}错误: 目标目录不存在${NC}"
  exit 1
fi

# 检查package.json
PACKAGE_JSON="${TARGET_DIR}/package.json"
if [ ! -f "$PACKAGE_JSON" ]; then
  echo -e "${RED}错误: package.json不存在: ${PACKAGE_JSON}${NC}"
  exit 1
fi

# 复制修复脚本到目标目录
echo -e "${YELLOW}步骤1: 复制修复脚本到目标目录${NC}"
cp "${SOURCE_DIR}/direct-sequelize-patch.js" "${TARGET_DIR}/"
cp "${SOURCE_DIR}/sequelize-instance-fix.js" "${TARGET_DIR}/"
cp "${SOURCE_DIR}/sequelize-constructor-fix.js" "${TARGET_DIR}/"
cp "${SOURCE_DIR}/db-init.js" "${TARGET_DIR}/"
cp "${SOURCE_DIR}/fix-all.sh" "${TARGET_DIR}/"

# 添加执行权限
chmod +x "${TARGET_DIR}/direct-sequelize-patch.js"
chmod +x "${TARGET_DIR}/sequelize-instance-fix.js"
chmod +x "${TARGET_DIR}/sequelize-constructor-fix.js"
chmod +x "${TARGET_DIR}/db-init.js"
chmod +x "${TARGET_DIR}/fix-all.sh"

# 更新package.json
echo -e "${YELLOW}步骤2: 更新package.json${NC}"

# 备份原始package.json
cp "${PACKAGE_JSON}" "${PACKAGE_JSON}.bak-$(date +%s)"

# 创建临时文件用于更新package.json
TMP_FILE=$(mktemp)

# 合并脚本部分 
cat <<EOL > "${TMP_FILE}"
const fs = require('fs');
const packageJson = require('${PACKAGE_JSON}');
const fixScripts = {
  "postinstall": "node direct-sequelize-patch.js",
  "originalStart": packageJson.scripts.start || "ts-node src/index.ts",
  "start": "NODE_OPTIONS=\\"--require ./sequelize-preload.js\\" " + (packageJson.scripts.start || "ts-node src/index.ts"),
  "start:safe": "./start-with-fix.sh",
  "fix": "node direct-sequelize-patch.js && node sequelize-instance-fix.js && node sequelize-constructor-fix.js",
  "fixdb": "node db-init.js",
  "fixall": "./fix-all.sh"
};

// 更新scripts部分
packageJson.scripts = { ...packageJson.scripts, ...fixScripts };

// 添加sequelizeFixes元数据
packageJson.sequelizeFixes = {
  "version": "1.0.0",
  "description": "Sequelize修复工具集",
  "applied": new Date().toISOString()
};

// 写入更新后的package.json
fs.writeFileSync('${PACKAGE_JSON}', JSON.stringify(packageJson, null, 2));
console.log('已更新package.json');
EOL

# 执行脚本更新package.json
node "${TMP_FILE}"
rm "${TMP_FILE}"

# 运行修复脚本
echo -e "${YELLOW}步骤3: 运行修复脚本${NC}"
cd "${TARGET_DIR}" && ./fix-all.sh "${TARGET_DIR}"

echo -e "${GREEN}===== 部署完成 =====${NC}"
echo -e "${YELLOW}您现在可以使用以下命令启动应用:${NC}"
echo -e "cd ${TARGET_DIR} && npm run start:safe"
echo
echo -e "${GREEN}或使用PM2:${NC}"
echo -e "cd ${TARGET_DIR}"
echo -e "NODE_OPTIONS=\"--require ./sequelize-preload.js\" pm2 start npm -- start" 