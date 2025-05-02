'use strict';

/**
 * 数据库连接测试脚本
 * 此脚本测试数据库连接并验证模型是否可以正确初始化
 * 
 * 用法: node test-db.js
 */

console.log('开始测试数据库连接和模型初始化...');

try {
  // 创建最小化的数据库连接
  const { Sequelize } = require('sequelize');
  const path = require('path');
  const fs = require('fs');
  const dotenv = require('dotenv');
  
  // 加载环境变量
  const envPath = path.join(process.cwd(), '.env');
  if (fs.existsSync(envPath)) {
    console.log(`加载环境变量文件: ${envPath}`);
    dotenv.config({ path: envPath });
  }
  
  // 创建 Sequelize 实例
  const sequelize = new Sequelize(
    process.env.DB_NAME || 'quiz_app',
    process.env.DB_USER || 'root',
    process.env.DB_PASSWORD || '',
    {
      host: process.env.DB_HOST || 'localhost',
      port: parseInt(process.env.DB_PORT || '3306'),
      dialect: 'mysql',
      logging: console.log,
      dialectOptions: {
        connectTimeout: 10000,
      },
    }
  );
  
  // 测试连接
  sequelize.authenticate()
    .then(() => {
      console.log('数据库连接成功!');
      
      // 验证模型初始化
      console.log('测试模型初始化...');
      
      // 创建最小化的用户模型
      const { DataTypes, Model } = require('sequelize');
      
      class TestUser extends Model {}
      
      TestUser.init(
        {
          id: {
            type: DataTypes.UUID,
            defaultValue: DataTypes.UUIDV4,
            primaryKey: true,
          },
          username: {
            type: DataTypes.STRING,
            allowNull: false,
          },
        },
        {
          sequelize,
          modelName: 'TestUser',
          tableName: 'test_users',
          timestamps: false,
        }
      );
      
      console.log('模型初始化成功!');
      console.log('所有测试通过! 数据库连接和模型初始化正常工作。\n');
      
      // 创建全局的 Sequelize 配置文件
      const dbJsContent = `'use strict';

/**
 * 全局数据库配置文件 - 测试验证版本
 * 自动生成于 ${new Date().toISOString()}
 */
const { Sequelize } = require('sequelize');

// 使用环境变量创建 Sequelize 实例
const sequelize = new Sequelize(
  process.env.DB_NAME || 'quiz_app',
  process.env.DB_USER || 'root',
  process.env.DB_PASSWORD || '',
  {
    host: process.env.DB_HOST || 'localhost',
    port: parseInt(process.env.DB_PORT || '3306'),
    dialect: 'mysql',
    logging: console.log,
    dialectOptions: {
      connectTimeout: 10000
    }
  }
);

module.exports = sequelize;
`;
      
      // 创建 db.js 文件
      try {
        // 确定生成目录
        const distDir = path.join(process.cwd(), 'dist');
        const possibleDirs = [
          path.join(distDir, 'server/src/config'),
          path.join(distDir, 'src/config'),
          path.join(distDir, 'config'),
          path.join(process.cwd(), 'dist/server/src/config'),
        ];
        
        let targetDir = null;
        for (const dir of possibleDirs) {
          if (fs.existsSync(dir)) {
            targetDir = dir;
            break;
          }
        }
        
        if (targetDir) {
          const dbJsPath = path.join(targetDir, 'db.js');
          fs.writeFileSync(dbJsPath, dbJsContent);
          console.log(`已在 ${dbJsPath} 创建通用数据库配置文件`);
        } else {
          console.log('未找到配置目录，无法创建数据库配置文件');
        }
      } catch (error) {
        console.error('创建配置文件时出错:', error);
      }
      
      process.exit(0);
    })
    .catch((error) => {
      console.error('数据库连接测试失败:', error);
      process.exit(1);
    });
} catch (error) {
  console.error('测试脚本执行出错:', error);
  process.exit(1);
} 
