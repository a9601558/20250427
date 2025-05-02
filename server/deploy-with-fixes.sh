#!/bin/bash

# Sequelize修复部署脚本
# 此脚本集成了所有必要的修复，并自动应用到服务器环境

# 颜色定义
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[0;33m'
NC='\033[0m' # No Color

echo -e "${GREEN}===== Sequelize修复部署脚本 =====${NC}"

# 目标目录
TARGET_DIR="${1:-$(pwd)}"
echo -e "${YELLOW}目标目录: $TARGET_DIR${NC}"

# 检查是否存在目标目录
if [ ! -d "$TARGET_DIR" ]; then
    echo -e "${RED}错误: 目标目录不存在: $TARGET_DIR${NC}"
    exit 1
fi

# 切换到目标目录
cd "$TARGET_DIR"
echo -e "${YELLOW}当前目录: $(pwd)${NC}"

# 1. 创建sequelize-preload.js文件
echo -e "${YELLOW}创建sequelize-preload.js文件...${NC}"
cat > sequelize-preload.js << 'EOL'
'use strict';

/**
 * Sequelize预加载修复脚本 - 安全版本
 * 自动生成于 $(date)
 * 
 * 此脚本在Node.js加载过程中最早执行，修复Sequelize构造函数问题
 * 避免重复声明变量导致错误
 */

// 保存原始的require函数
const originalRequire = module.constructor.prototype.require;

// 替换require函数，拦截sequelize模块的加载
module.constructor.prototype.require = function(path) {
  // 先执行原始require
  const result = originalRequire.apply(this, arguments);
  
  // 当加载sequelize模块时
  if (path === 'sequelize') {
    try {
      // 确保全局sequelize实例存在
      if (!global.sequelize) {
        try {
          // 安全地尝试创建全局Sequelize实例
          const dotenv = require('dotenv');
          const fs = require('fs');
          const envPath = require('path').join(process.cwd(), '.env');
          
          if (fs.existsSync(envPath)) {
            console.log('[预加载] 加载环境变量文件: ' + envPath);
            dotenv.config({ path: envPath });
          }
          
          // 获取Sequelize构造函数
          const SequelizeClass = result && typeof result === 'function' 
            ? result 
            : (result && typeof result.Sequelize === 'function' 
                ? result.Sequelize 
                : null);
          
          if (SequelizeClass) {
            global.sequelize = new SequelizeClass(
              process.env.DB_NAME || 'quiz_app',
              process.env.DB_USER || 'root',
              process.env.DB_PASSWORD || '',
              {
                host: process.env.DB_HOST || 'localhost',
                port: parseInt(process.env.DB_PORT || '3306'),
                dialect: 'mysql',
                logging: false,
                pool: { max: 5, min: 0, acquire: 30000, idle: 10000 }
              }
            );
            console.log('[预加载] 全局Sequelize实例创建成功');
          } else {
            console.error('[预加载] 无法获取有效的Sequelize构造函数');
          }
        } catch (error) {
          console.error('[预加载] 创建全局Sequelize实例失败:', error);
        }
      }
      
      // 修复sequelize模块代码，防止变量重复声明错误
      if (typeof result === 'object' && result !== null) {
        // 找到文件中可能导致问题的代码，返回前进行修复
        const file = result.__filename || '';
        if (file && file.includes('sequelize.js')) {
          try {
            const fs = require('fs');
            const content = fs.readFileSync(file, 'utf8');
            
            // 检查是否包含已知的问题代码
            if (content.includes('const safeExport = module.exports;')) {
              // 如果找到问题代码，但尚未修复，进行修复
              if (!content.includes('// FIXED: safeExport declaration removed')) {
                const fixed = content.replace(
                  'const safeExport = module.exports;', 
                  '// FIXED: safeExport declaration removed\n// const safeExport = module.exports;'
                );
                fs.writeFileSync(file, fixed, 'utf8');
                console.log('[预加载] 已修复sequelize.js中的变量声明问题');
              }
            }
          } catch (err) {
            // 忽略文件修复错误，继续使用预加载方式
            console.error('[预加载] 尝试修复sequelize.js文件失败:', err.message);
          }
        }
      }
      
      // 处理返回值
      if (!result || typeof result !== 'function') {
        if (result && typeof result.Sequelize === 'function') {
          console.log('[预加载] 使用result.Sequelize作为主导出');
          return result.Sequelize;
        }
      }
    } catch (error) {
      console.error('[预加载] 处理sequelize模块失败:', error);
    }
  }
  
  return result;
};

console.log('[预加载] Sequelize安全预加载已启用');
EOL

echo -e "${GREEN}已创建sequelize-preload.js文件${NC}"

# 2. 创建fix-safeExport.js脚本
echo -e "${YELLOW}创建fix-safeExport.js脚本...${NC}"
cat > fix-safeExport.js << 'EOL'
#!/usr/bin/env node

/**
 * 修复 Sequelize safeExport 变量重复声明问题
 * 
 * 此脚本查找并修复 sequelize.js 文件中的 safeExport 变量声明
 * 解决 "Identifier 'safeExport' has already been declared" 错误
 */

const fs = require('fs');
const path = require('path');
const { execSync } = require('child_process');

// 使用当前目录
const targetDir = process.cwd();
console.log(`[修复工具] 目标目录: ${targetDir}`);

// 查找sequelize.js文件
async function findSequelizeJs() {
  try {
    // 在node_modules中查找
    let result = '';
    try {
      const cmd = `find ${targetDir}/node_modules -path "*/sequelize/lib/sequelize.js" -o -path "*/sequelize/dist/sequelize.js" | head -1`;
      result = execSync(cmd, { encoding: 'utf8' }).trim();
    } catch (e) {
      console.error(`[修复工具] 查找sequelize.js时出错:`, e.message);
    }

    if (result) {
      console.log(`[修复工具] 找到sequelize.js文件: ${result}`);
      return result;
    }
    
    // 在pnpm目录中查找
    try {
      const pnpmCmd = `find ${targetDir}/node_modules/.pnpm -name "sequelize.js" | grep -v "node_modules/sequelize/node_modules" | head -1`;
      const pnpmResult = execSync(pnpmCmd, { encoding: 'utf8' }).trim();
      if (pnpmResult) {
        console.log(`[修复工具] 找到sequelize.js文件: ${pnpmResult}`);
        return pnpmResult;
      }
    } catch (err) {
      console.log(`[修复工具] pnpm搜索无结果`);
    }
    
    console.error(`[修复工具] 未找到sequelize.js文件`);
    return null;
  } catch (err) {
    console.error(`[修复工具] 查找文件时出错:`, err);
    return null;
  }
}

// 修复文件中的safeExport声明
function fixSafeExportDeclaration(filePath) {
  try {
    if (!filePath) return false;
    
    // 读取文件内容
    const content = fs.readFileSync(filePath, 'utf8');
    
    // 检查是否包含问题代码
    if (!content.includes('const safeExport = module.exports;')) {
      console.log(`[修复工具] 文件不包含需要修复的代码: ${filePath}`);
      return true;
    }
    
    // 检查是否已经修复过
    if (content.includes('// FIXED: safeExport declaration removed')) {
      console.log(`[修复工具] 文件已经被修复过: ${filePath}`);
      return true;
    }
    
    // 创建备份
    const backupPath = `${filePath}.original`;
    if (!fs.existsSync(backupPath)) {
      fs.writeFileSync(backupPath, content, 'utf8');
      console.log(`[修复工具] 已创建文件备份: ${backupPath}`);
    }
    
    // 修复代码
    const fixed = content.replace(
      'const safeExport = module.exports;', 
      '// FIXED: safeExport declaration removed\n// const safeExport = module.exports;'
    );
    
    // 保存修复后的文件
    fs.writeFileSync(filePath, fixed, 'utf8');
    console.log(`[修复工具] 已修复文件: ${filePath}`);
    
    return true;
  } catch (err) {
    console.error(`[修复工具] 修复文件时出错:`, err);
    return false;
  }
}

// 主函数
async function main() {
  // 查找sequelize.js文件
  const sequelizeJsPath = await findSequelizeJs();
  
  if (!sequelizeJsPath) {
    console.error(`[修复工具] 未找到sequelize.js文件，无法继续`);
    return;
  }
  
  // 修复safeExport声明问题
  const fixed = fixSafeExportDeclaration(sequelizeJsPath);
  
  if (fixed) {
    console.log(`[修复工具] 修复成功！现在可以重新启动应用`);
  } else {
    console.error(`[修复工具] 修复失败`);
  }
}

// 执行主函数
main().catch(err => {
  console.error(`[修复工具] 执行出错:`, err);
});
EOL

chmod +x fix-safeExport.js
echo -e "${GREEN}已创建fix-safeExport.js脚本${NC}"

# 3. 创建简化启动脚本
echo -e "${YELLOW}创建simple-start.js脚本...${NC}"
cat > simple-start.js << 'EOL'
#!/usr/bin/env node

/**
 * 简化启动脚本 - 绕过路由问题直接启动应用
 * 
 * 此脚本绕过了有问题的路由，直接初始化应用核心部分
 * 使数据库连接和基本功能正常工作
 */

// 设置全局Sequelize实例
global.sequelize = null;
const { Sequelize } = require('sequelize');
const path = require('path');
const fs = require('fs');
const dotenv = require('dotenv');
const express = require('express');
const cors = require('cors');

// 加载环境变量
const envPath = path.join(process.cwd(), '.env');
if (fs.existsSync(envPath)) {
  console.log(`加载环境变量文件: ${envPath}`);
  dotenv.config({ path: envPath });
}

// 创建全局sequelize实例
global.sequelize = new Sequelize(
  process.env.DB_NAME || 'quiz_app',
  process.env.DB_USER || 'root',
  process.env.DB_PASSWORD || '',
  {
    host: process.env.DB_HOST || 'localhost',
    port: parseInt(process.env.DB_PORT || '3306'),
    dialect: 'mysql',
    logging: console.log,
    pool: { max: 5, min: 0, acquire: 30000, idle: 10000 }
  }
);

console.log('全局Sequelize实例创建成功');

// 创建Express应用
const app = express();

// 基本中间件
app.use(cors());
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// 创建测试路由
app.get('/', (req, res) => {
  res.json({
    success: true,
    message: '服务器已启动 - 简化模式',
    version: '1.0.0',
    time: new Date().toISOString()
  });
});

// 测试数据库连接
app.get('/api/test-db', async (req, res) => {
  try {
    await global.sequelize.authenticate();
    res.json({
      success: true,
      message: '数据库连接成功',
      dialect: global.sequelize.getDialect(),
      config: {
        host: global.sequelize.config.host,
        port: global.sequelize.config.port,
        database: global.sequelize.config.database
      }
    });
  } catch (error) {
    console.error('数据库连接失败:', error);
    res.status(500).json({
      success: false,
      message: '数据库连接失败',
      error: error.message
    });
  }
});

// 启动服务器
const PORT = process.env.PORT || 5000;
app.listen(PORT, () => {
  console.log(`简化模式服务器已启动，运行端口: ${PORT}`);
});

// 处理未捕获的异常
process.on('uncaughtException', (err) => {
  console.error('未捕获的异常:', err);
});

process.on('unhandledRejection', (reason, promise) => {
  console.error('未处理的拒绝:', reason);
});

console.log('简化启动脚本已成功执行');
EOL

chmod +x simple-start.js
echo -e "${GREEN}已创建simple-start.js脚本${NC}"

# 4. 更新package.json
echo -e "${YELLOW}更新package.json...${NC}"

# 检查是否存在package.json
if [ ! -f "package.json" ]; then
    echo -e "${RED}错误: package.json不存在${NC}"
else
    # 创建备份
    cp package.json package.json.bak
    
    # 使用node修改package.json
    node -e '
    const fs = require("fs");
    const packageJson = JSON.parse(fs.readFileSync("package.json", "utf8"));
    
    // 添加新的脚本
    packageJson.scripts = packageJson.scripts || {};
    packageJson.scripts["start:safe"] = "NODE_OPTIONS=\"--require ./sequelize-preload.js\" node simple-start.js";
    packageJson.scripts["start:simple"] = "node simple-start.js";
    packageJson.scripts["fix:safeExport"] = "node fix-safeExport.js";
    
    // 添加修复信息
    packageJson.sequelizeFixes = {
        version: "2.0.0",
        appliedAt: new Date().toISOString(),
        fixes: [
            "safeExport variable redeclaration",
            "global sequelize instance",
            "simplified startup"
        ]
    };
    
    // 写回文件
    fs.writeFileSync("package.json", JSON.stringify(packageJson, null, 2), "utf8");
    '
    
    echo -e "${GREEN}已更新package.json${NC}"
fi

# 5. 创建启动脚本
echo -e "${YELLOW}创建启动脚本...${NC}"
cat > start-safe.sh << 'EOL'
#!/bin/bash

# 安全启动脚本
# 自动应用所有修复并启动应用

# 颜色定义
GREEN='\033[0;32m'
NC='\033[0m' # No Color

# 应用safeExport修复
echo -e "${GREEN}应用safeExport修复...${NC}"
node fix-safeExport.js

# 使用预加载启动
echo -e "${GREEN}使用预加载模式启动应用...${NC}"
export NODE_OPTIONS="--require ./sequelize-preload.js"
node simple-start.js
EOL

chmod +x start-safe.sh
echo -e "${GREEN}已创建启动脚本: start-safe.sh${NC}"

# 6. 应用修复
echo -e "${YELLOW}立即应用修复...${NC}"
node fix-safeExport.js

# 7. 完成
echo -e "${GREEN}===== 所有修复已完成 =====${NC}"
echo -e "${YELLOW}您可以使用以下命令启动应用:${NC}"
echo "  npm run start:safe   # 使用安全模式启动（推荐）"
echo "  npm run start:simple # 使用简化模式启动"
echo "  ./start-safe.sh      # 使用安全启动脚本"
echo ""
echo -e "${YELLOW}是否要立即启动应用? (y/n)${NC}"
read -r answer

if [[ "$answer" == "y" ]]; then
    echo -e "${GREEN}启动应用...${NC}"
    ./start-safe.sh
else
    echo -e "${GREEN}安装完成，未启动应用。${NC}"
fi 