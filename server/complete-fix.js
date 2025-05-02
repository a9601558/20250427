#!/usr/bin/env node

/**
 * 完全自包含的Sequelize修复工具
 * 不依赖任何外部模块，适用于宝塔面板环境
 */

const fs = require('fs');
const path = require('path');
const { execSync } = require('child_process');

console.log('===== 全功能Sequelize修复工具 =====');

// 当前目录
const baseDir = process.cwd();
console.log(`当前目录: ${baseDir}`);

// 1. 直接查找sequelize.js文件 (不使用glob)
function findSequelizeFile() {
  console.log('正在查找sequelize.js文件...');
  
  try {
    // 使用find命令查找文件 (系统命令，无需额外依赖)
    const findCommand = `find ${baseDir}/node_modules -name "sequelize.js" | grep "/lib/sequelize.js" | head -1`;
    const sequelizeFilePath = execSync(findCommand, { encoding: 'utf8' }).trim();
    
    if (sequelizeFilePath && fs.existsSync(sequelizeFilePath)) {
      console.log(`找到sequelize.js: ${sequelizeFilePath}`);
      return sequelizeFilePath;
    }
  } catch (error) {
    console.log('使用find命令搜索失败，尝试手动查找...');
    // 可能find命令不可用或出错，继续手动查找
  }
  
  // 手动查找pnpm目录结构
  try {
    const pnpmDir = path.join(baseDir, 'node_modules', '.pnpm');
    if (fs.existsSync(pnpmDir)) {
      const dirs = fs.readdirSync(pnpmDir);
      for (const dir of dirs) {
        if (dir.startsWith('sequelize@')) {
          const filePath = path.join(pnpmDir, dir, 'node_modules', 'sequelize', 'lib', 'sequelize.js');
          if (fs.existsSync(filePath)) {
            console.log(`找到sequelize.js: ${filePath}`);
            return filePath;
          }
        }
      }
    }
  } catch (error) {
    console.error('手动查找pnpm目录结构失败:', error.message);
  }
  
  // 查找标准路径
  const standardPath = path.join(baseDir, 'node_modules', 'sequelize', 'lib', 'sequelize.js');
  if (fs.existsSync(standardPath)) {
    console.log(`找到sequelize.js: ${standardPath}`);
    return standardPath;
  }
  
  console.log('未找到sequelize.js文件');
  return null;
}

// 2. 修复sequelize.js文件
function fixSequelizeFile(filePath) {
  if (!filePath) {
    console.log('没有sequelize.js文件路径，跳过文件修复');
    return false;
  }
  
  try {
    console.log(`开始修复: ${filePath}`);
    
    // 读取文件内容
    let content = fs.readFileSync(filePath, 'utf8');
    
    // 创建备份
    const backupPath = `${filePath}.bak`;
    if (!fs.existsSync(backupPath)) {
      fs.writeFileSync(backupPath, content, 'utf8');
      console.log(`创建备份: ${backupPath}`);
    }
    
    // 检查是否已经修复
    if (content.includes('// const safeExport = module.exports; // 已修复')) {
      console.log('文件已被修复，跳过');
      return true;
    }
    
    // 修复safeExport声明 - 用正则表达式更精确匹配
    const fixedContent = content.replace(
      /const\s+safeExport\s*=\s*module\.exports\s*;/g,
      '// const safeExport = module.exports; // 已修复'
    );
    
    // 检查是否实际进行了替换
    if (content === fixedContent) {
      console.log('未找到需要修复的代码行，尝试其他方式...');
      
      // 更简单的查找替换
      const simpleFixed = content.replace(
        'const safeExport = module.exports;',
        '// const safeExport = module.exports; // 已修复'
      );
      
      if (content !== simpleFixed) {
        fs.writeFileSync(filePath, simpleFixed, 'utf8');
        console.log('使用简单替换修复成功');
        return true;
      }
      
      console.log('无法找到匹配的代码行，修复失败');
      return false;
    }
    
    // 写入修复后的文件
    fs.writeFileSync(filePath, fixedContent, 'utf8');
    console.log('sequelize.js修复成功');
    
    return true;
  } catch (error) {
    console.error('修复sequelize.js时出错:', error.message);
    return false;
  }
}

// 3. 创建安全的预加载文件
function createSafePreload() {
  const preloadPath = path.join(baseDir, 'sequelize-preload-safe.js');
  
  const preloadContent = `/**
 * Sequelize安全预加载脚本 (全兼容版)
 * 不需要外部依赖，更安全的实现
 */

console.log('[预加载-完全版] Sequelize安全预加载已启用');

// 全局变量初始化
if (typeof global.sequelize === 'undefined') {
  global.sequelize = null;
}

try {
  // 加载环境变量
  const path = require('path');
  const fs = require('fs');
  
  try {
    // 尝试加载dotenv (如果存在)
    const dotenv = require('dotenv');
    const envPath = path.join(process.cwd(), '.env');
    if (fs.existsSync(envPath)) {
      dotenv.config({ path: envPath });
      console.log('[预加载-完全版] 已加载.env环境变量');
    }
  } catch (e) {
    // dotenv不存在，继续执行
    console.log('[预加载-完全版] dotenv不可用，使用默认配置');
  }
  
  // 数据库连接配置
  const dbConfig = {
    database: process.env.DB_NAME || 'quizdb',
    username: process.env.DB_USER || 'root',
    password: process.env.DB_PASSWORD || '',
    host: process.env.DB_HOST || 'localhost',
    port: parseInt(process.env.DB_PORT || '3306'),
    dialect: 'mysql'
  };
  
  // 查找可用的Sequelize - 直接搜索模块路径
  let sequelizePath;
  try {
    // 尝试查找模块
    const baseDir = process.cwd();
    const paths = [
      path.join(baseDir, 'node_modules/sequelize'),
      path.join(baseDir, 'node_modules/.pnpm/sequelize@*/node_modules/sequelize')
    ];
    
    for (const p of paths) {
      try {
        // 使用通配符查找
        const files = fs.readdirSync(path.dirname(p));
        for (const file of files) {
          if (file.startsWith('sequelize@')) {
            const fullPath = path.join(path.dirname(p), file, 'node_modules/sequelize');
            if (fs.existsSync(fullPath)) {
              sequelizePath = fullPath;
              break;
            }
          }
        }
        
        if (!sequelizePath && fs.existsSync(p)) {
          sequelizePath = p;
          break;
        }
      } catch (e) {
        // 忽略错误，继续查找
      }
    }
  } catch (e) {
    console.log('[预加载-完全版] 查找Sequelize模块失败:', e.message);
  }
  
  if (sequelizePath) {
    console.log('[预加载-完全版] 找到Sequelize模块:', sequelizePath);
    
    // 直接使用相对路径加载Sequelize
    try {
      const { Sequelize } = require(sequelizePath);
      
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
      
      console.log('[预加载-完全版] 成功创建全局Sequelize实例');
    } catch (e) {
      console.error('[预加载-完全版] 加载Sequelize模块失败:', e.message);
    }
  } else {
    // 尝试常规加载
    try {
      const { Sequelize } = require('sequelize');
      
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
      
      console.log('[预加载-完全版] 成功创建全局Sequelize实例');
    } catch (e) {
      console.error('[预加载-完全版] 加载Sequelize失败:', e.message);
    }
  }
} catch (e) {
  console.error('[预加载-完全版] 初始化错误:', e.message);
}`;

  try {
    fs.writeFileSync(preloadPath, preloadContent, 'utf8');
    console.log(`创建安全预加载文件: ${preloadPath}`);
    return true;
  } catch (error) {
    console.error('创建安全预加载文件失败:', error.message);
    return false;
  }
}

// 4. 创建完全独立的启动脚本
function createStartScript() {
  const scriptPath = path.join(baseDir, 'start-complete.sh');
  
  const scriptContent = `#!/bin/bash

# 完全独立的启动脚本 - 兼容宝塔面板
echo "===== 完全独立启动脚本 ====="

# 当前目录
CURRENT_DIR=$(pwd)
echo "当前目录: $CURRENT_DIR"

# 直接修复sequelize.js文件
echo "运行完全修复工具..."
node complete-fix.js

# 设置环境变量
export NODE_OPTIONS="--require ./sequelize-preload-safe.js"

# 检查文件位置并启动
if [ -f "src/index.ts" ]; then
  echo "使用ts-node启动..."
  ts-node src/index.ts
elif [ -f "dist/index.js" ]; then
  echo "使用node启动编译后的代码..."
  node dist/index.js
else
  echo "错误: 找不到入口文件"
  exit 1
fi`;

  try {
    fs.writeFileSync(scriptPath, scriptContent, 'utf8');
    fs.chmodSync(scriptPath, '755'); // 添加执行权限
    console.log(`创建完全独立启动脚本: ${scriptPath}`);
    return true;
  } catch (error) {
    console.error('创建启动脚本失败:', error.message);
    return false;
  }
}

// 5. 检测并安装必要依赖
function checkAndInstallDependencies() {
  console.log('检查必要依赖...');
  const dependencies = ['sequelize', 'mysql2', 'dotenv', 'bcryptjs'];
  
  let missingDeps = [];
  for (const dep of dependencies) {
    try {
      require.resolve(dep);
      console.log(`✓ ${dep} 已安装`);
    } catch (e) {
      console.log(`✗ ${dep} 未安装`);
      missingDeps.push(dep);
    }
  }
  
  if (missingDeps.length > 0) {
    console.log(`需要安装的依赖: ${missingDeps.join(', ')}`);
    try {
      console.log('正在安装缺失的依赖...');
      execSync(`npm install --no-save ${missingDeps.join(' ')}`, { stdio: 'inherit' });
      console.log('依赖安装完成');
      return true;
    } catch (error) {
      console.error('安装依赖时出错:', error.message);
      console.log('继续执行，但可能会导致问题...');
      return false;
    }
  }
  
  return true;
}

// 6. 创建简单的数据库初始化脚本
function createDbInit() {
  const dbInitPath = path.join(baseDir, 'db-init-simple.js');
  
  const dbInitContent = `/**
 * 简单数据库初始化脚本
 * 不依赖Sequelize迁移，直接创建所需表
 */

// 立即函数，可以使用async/await
(async () => {
  try {
    // 如果全局sequelize不存在，创建一个新的连接
    const sequelize = global.sequelize || (() => {
      const { Sequelize } = require('sequelize');
      const fs = require('fs');
      const path = require('path');
      
      // 加载环境变量
      try {
        const dotenv = require('dotenv');
        const envPath = path.join(process.cwd(), '.env');
        if (fs.existsSync(envPath)) {
          dotenv.config({ path: envPath });
        }
      } catch (e) {
        console.log('注意: dotenv不可用，使用默认配置');
      }
      
      // 获取数据库配置
      const dbConfig = {
        database: process.env.DB_NAME || 'quizdb',
        username: process.env.DB_USER || 'root',
        password: process.env.DB_PASSWORD || '',
        host: process.env.DB_HOST || 'localhost',
        port: parseInt(process.env.DB_PORT || '3306'),
        dialect: 'mysql'
      };
      
      console.log(\`数据库连接: \${dbConfig.username}@\${dbConfig.host}:\${dbConfig.port}/\${dbConfig.database}\`);
      
      return new Sequelize(
        dbConfig.database,
        dbConfig.username,
        dbConfig.password,
        {
          host: dbConfig.host,
          port: dbConfig.port,
          dialect: dbConfig.dialect,
          logging: console.log
        }
      );
    })();
    
    // 测试连接
    await sequelize.authenticate();
    console.log('数据库连接成功!');
    
    // 获取查询接口
    const queryInterface = sequelize.getQueryInterface();
    const { DataTypes } = require('sequelize');
    
    // 检查homepage_settings表是否存在
    try {
      await sequelize.query('SELECT 1 FROM homepage_settings LIMIT 1');
      console.log('homepage_settings表已存在');
    } catch (err) {
      if (err.name === 'SequelizeDatabaseError') {
        console.log('创建homepage_settings表...');
        
        // 创建homepage_settings表
        await queryInterface.createTable('homepage_settings', {
          id: {
            type: DataTypes.INTEGER,
            primaryKey: true,
            autoIncrement: true
          },
          siteTitle: {
            type: DataTypes.STRING(100),
            allowNull: false,
            defaultValue: '考试平台'
          },
          welcomeMessage: {
            type: DataTypes.TEXT,
            allowNull: false,
            defaultValue: '欢迎使用我们的考试平台！'
          },
          footerText: {
            type: DataTypes.STRING(255),
            allowNull: false,
            defaultValue: '© 2024 考试平台 版权所有'
          },
          createdAt: {
            type: DataTypes.DATE,
            allowNull: false,
            defaultValue: DataTypes.NOW
          },
          updatedAt: {
            type: DataTypes.DATE,
            allowNull: false,
            defaultValue: DataTypes.NOW
          }
        });
        
        // 添加默认记录
        await sequelize.query(\`
          INSERT INTO homepage_settings 
          (siteTitle, welcomeMessage, footerText, createdAt, updatedAt) 
          VALUES 
          ('考试平台', '欢迎使用我们的考试平台！', '© 2024 考试平台 版权所有', NOW(), NOW())
        \`);
        
        console.log('homepage_settings表创建完成');
      } else {
        throw err;
      }
    }
    
    console.log('数据库初始化完成');
    process.exit(0);
  } catch (error) {
    console.error('数据库初始化失败:', error);
    process.exit(1);
  }
})();`;

  try {
    fs.writeFileSync(dbInitPath, dbInitContent, 'utf8');
    console.log(`创建简易数据库初始化脚本: ${dbInitPath}`);
    return true;
  } catch (error) {
    console.error('创建数据库初始化脚本失败:', error.message);
    return false;
  }
}

// 主函数
async function main() {
  try {
    // 1. 检查并安装依赖
    checkAndInstallDependencies();
    
    // 2. 查找并修复sequelize.js
    const sequelizeFilePath = findSequelizeFile();
    fixSequelizeFile(sequelizeFilePath);
    
    // 3. 创建安全的预加载文件
    createSafePreload();
    
    // 4. 创建启动脚本
    createStartScript();
    
    // 5. 创建数据库初始化脚本
    createDbInit();
    
    console.log('\n===== 所有修复完成 =====');
    console.log('您现在可以使用以下命令启动应用:');
    console.log('  ./start-complete.sh  # 完全独立的启动方式');
    console.log('如需初始化数据库，请运行:');
    console.log('  node db-init-simple.js');
  } catch (error) {
    console.error('修复过程中出错:', error);
  }
}

// 执行主函数
main(); 