#!/bin/bash

# 独立启动脚本 - 不依赖npm scripts
# 适用于宝塔面板环境

echo "===== 独立启动脚本 ====="

# 当前目录
CURRENT_DIR=$(pwd)
echo "当前目录: $CURRENT_DIR"

# 确保修复文件存在
if [ ! -f "baota-fix.js" ]; then
  echo "未找到baota-fix.js，尝试从备份恢复..."
  # 如果有备份，从备份恢复
  if [ -f "baota-fixes.tar.gz" ]; then
    tar -xzf baota-fixes.tar.gz
    echo "从备份恢复完成"
  else
    echo "错误: 找不到修复文件，请确保baota-fix.js在当前目录"
    exit 1
  fi
fi

# 添加执行权限
chmod +x baota-fix.js
chmod +x direct-db-migration.js 2>/dev/null || echo "注意: 数据库迁移脚本不存在"

# 运行修复脚本
echo "运行Sequelize修复..."
node baota-fix.js

# 检查sequelize-preload-safe.js是否创建成功
if [ ! -f "sequelize-preload-safe.js" ]; then
  echo "创建安全预加载文件..."
  cat > sequelize-preload-safe.js << 'EOL'
/**
 * Sequelize安全预加载脚本 (Baota面板兼容版)
 * 
 * 此脚本在不修改module.exports的情况下注入全局Sequelize实例
 */

console.log('[预加载-安全版] Sequelize安全预加载修复已启用');

const originalRequire = module.constructor.prototype.require;

// 创建全局Sequelize实例
if (!global.sequelize) {
  try {
    // 加载配置
    const path = require('path');
    const fs = require('fs');
    const dotenv = require('dotenv');
    
    // 加载环境变量
    const envPath = path.join(process.cwd(), '.env');
    if (fs.existsSync(envPath)) {
      dotenv.config({ path: envPath });
    }
    
    // 获取数据库连接信息
    const dbConfig = {
      database: process.env.DB_NAME || 'quizdb',
      username: process.env.DB_USER || 'root',
      password: process.env.DB_PASSWORD || '',
      host: process.env.DB_HOST || 'localhost',
      port: parseInt(process.env.DB_PORT || '3306'),
      dialect: 'mysql'
    };
    
    // 直接使用原始require加载Sequelize
    const { Sequelize } = originalRequire('sequelize');
    
    // 创建Sequelize实例
    global.sequelize = new Sequelize(
      dbConfig.database,
      dbConfig.username,
      dbConfig.password,
      {
        host: dbConfig.host,
        port: dbConfig.port,
        dialect: dbConfig.dialect,
        logging: false
      }
    );
    
    console.log('[预加载-安全版] 成功创建全局Sequelize实例');
  } catch (error) {
    console.error('[预加载-安全版] 创建全局Sequelize实例失败:', error);
  }
}
EOL
  echo "安全预加载文件创建完成"
fi

# 检查并运行数据库迁移
if [ -f "direct-db-migration.js" ]; then
  echo "运行数据库迁移..."
  node direct-db-migration.js
else
  echo "跳过数据库迁移 (direct-db-migration.js不存在)"
fi

# 确定主程序入口
if [ -f "src/index.ts" ]; then
  # TypeScript项目
  echo "检测到TypeScript项目，使用ts-node启动..."
  export NODE_OPTIONS="--require ./sequelize-preload-safe.js"
  ts-node src/index.ts
elif [ -f "dist/index.js" ]; then
  # 编译后的JavaScript项目
  echo "使用编译后的JavaScript启动..."
  export NODE_OPTIONS="--require ./sequelize-preload-safe.js"
  node dist/index.js
else
  echo "错误: 找不到入口文件 (src/index.ts 或 dist/index.js)"
  echo "请指定正确的入口文件路径"
  exit 1
fi 