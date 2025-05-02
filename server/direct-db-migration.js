#!/usr/bin/env node

/**
 * 直接数据库迁移脚本
 * 
 * 此脚本直接创建必要的数据库表，
 * 绕过npm缓存权限问题
 */

const fs = require('fs');
const path = require('path');
const dotenv = require('dotenv');

// 加载环境变量
const envPath = path.join(process.cwd(), '.env');
if (fs.existsSync(envPath)) {
  console.log(`加载环境变量文件: ${envPath}`);
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

console.log(`数据库连接配置: ${dbConfig.username}@${dbConfig.host}:${dbConfig.port}/${dbConfig.database}`);

// 尝试使用全局Sequelize实例
let sequelize = global.sequelize;

if (!sequelize) {
  console.log('创建新的Sequelize实例...');
  // 如果没有全局实例，创建一个新的
  const { Sequelize } = require('sequelize');
  sequelize = new Sequelize(
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
}

// 测试数据库连接
async function testConnection() {
  try {
    await sequelize.authenticate();
    console.log('数据库连接成功！');
    return true;
  } catch (error) {
    console.error('无法连接到数据库:', error);
    return false;
  }
}

// 创建HomepageSettings表
async function createHomepageSettingsTable() {
  try {
    const { DataTypes } = require('sequelize');
    
    console.log('检查homepage_settings表是否存在...');
    
    // 检查表是否存在
    try {
      await sequelize.query('SELECT 1 FROM homepage_settings LIMIT 1');
      console.log('homepage_settings表已存在，跳过创建');
      return true;
    } catch (error) {
      if (error.name === 'SequelizeDatabaseError' && error.parent && error.parent.code === 'ER_NO_SUCH_TABLE') {
        console.log('homepage_settings表不存在，准备创建...');
      } else {
        console.error('检查表时出错:', error);
        throw error;
      }
    }
    
    // 创建HomepageSettings表
    console.log('正在创建homepage_settings表...');
    await sequelize.getQueryInterface().createTable('homepage_settings', {
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
      featuredCategories: {
        type: DataTypes.JSON,
        allowNull: true
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
    
    // 插入默认记录
    console.log('插入默认记录...');
    await sequelize.query(`
      INSERT INTO homepage_settings 
      (id, siteTitle, welcomeMessage, featuredCategories, footerText, createdAt, updatedAt) 
      VALUES 
      (1, '考试平台', '欢迎使用我们的考试平台！', '[]', '© 2024 考试平台 版权所有', NOW(), NOW())
    `);
    
    console.log('homepage_settings表创建成功！');
    return true;
  } catch (error) {
    console.error('创建homepage_settings表失败:', error);
    return false;
  }
}

// 检查其他必要的表
async function checkRequiredTables() {
  const requiredTables = [
    'users',
    'question_sets',
    'questions',
    'options'
  ];
  
  const missingTables = [];
  
  for (const table of requiredTables) {
    try {
      await sequelize.query(`SELECT 1 FROM ${table} LIMIT 1`);
      console.log(`✅ ${table}表已存在`);
    } catch (error) {
      if (error.name === 'SequelizeDatabaseError' && error.parent && error.parent.code === 'ER_NO_SUCH_TABLE') {
        console.log(`❌ ${table}表不存在`);
        missingTables.push(table);
      } else {
        console.error(`检查${table}表时出错:`, error);
      }
    }
  }
  
  return missingTables;
}

// 创建其他必要的表
async function createRequiredTables(missingTables) {
  const { DataTypes } = require('sequelize');
  
  for (const table of missingTables) {
    try {
      console.log(`正在创建${table}表...`);
      
      switch (table) {
        case 'users':
          await sequelize.getQueryInterface().createTable('users', {
            id: {
              type: DataTypes.UUID,
              defaultValue: DataTypes.UUIDV4,
              primaryKey: true
            },
            username: {
              type: DataTypes.STRING(50),
              allowNull: false,
              unique: true
            },
            email: {
              type: DataTypes.STRING(100),
              allowNull: false,
              unique: true
            },
            password: {
              type: DataTypes.STRING(100),
              allowNull: false
            },
            isAdmin: {
              type: DataTypes.BOOLEAN,
              allowNull: false,
              defaultValue: false
            },
            progress: {
              type: DataTypes.JSON,
              allowNull: false,
              defaultValue: {}
            },
            purchases: {
              type: DataTypes.JSON,
              allowNull: false,
              defaultValue: []
            },
            redeemCodes: {
              type: DataTypes.JSON,
              allowNull: false,
              defaultValue: []
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
          
          // 创建默认管理员用户
          const bcrypt = require('bcryptjs');
          const salt = await bcrypt.genSalt(10);
          const hashedPassword = await bcrypt.hash('admin123', salt);
          
          await sequelize.query(`
            INSERT INTO users 
            (id, username, email, password, isAdmin, progress, purchases, redeemCodes, createdAt, updatedAt) 
            VALUES 
            (UUID(), 'admin', 'admin@example.com', '${hashedPassword}', 1, '{}', '[]', '[]', NOW(), NOW())
          `);
          
          console.log('已创建默认管理员用户 (用户名: admin, 密码: admin123)');
          break;
          
        case 'question_sets':
          await sequelize.getQueryInterface().createTable('question_sets', {
            id: {
              type: DataTypes.UUID,
              defaultValue: DataTypes.UUIDV4,
              primaryKey: true
            },
            title: {
              type: DataTypes.STRING(100),
              allowNull: false
            },
            description: {
              type: DataTypes.TEXT,
              allowNull: false
            },
            category: {
              type: DataTypes.STRING(50),
              allowNull: false
            },
            icon: {
              type: DataTypes.STRING(50),
              allowNull: true
            },
            isPaid: {
              type: DataTypes.BOOLEAN,
              allowNull: false,
              defaultValue: false
            },
            price: {
              type: DataTypes.FLOAT,
              allowNull: true
            },
            trialQuestions: {
              type: DataTypes.INTEGER,
              allowNull: true
            },
            isFeatured: {
              type: DataTypes.BOOLEAN,
              allowNull: false,
              defaultValue: false
            },
            featuredCategory: {
              type: DataTypes.STRING(50),
              allowNull: true
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
          break;
          
        case 'questions':
          await sequelize.getQueryInterface().createTable('questions', {
            id: {
              type: DataTypes.UUID,
              defaultValue: DataTypes.UUIDV4,
              primaryKey: true
            },
            text: {
              type: DataTypes.TEXT,
              allowNull: false
            },
            explanation: {
              type: DataTypes.TEXT,
              allowNull: true
            },
            questionType: {
              type: DataTypes.STRING(20),
              allowNull: false,
              defaultValue: 'single'
            },
            orderIndex: {
              type: DataTypes.INTEGER,
              allowNull: false,
              defaultValue: 0
            },
            questionSetId: {
              type: DataTypes.UUID,
              allowNull: false,
              references: {
                model: 'question_sets',
                key: 'id'
              },
              onUpdate: 'CASCADE',
              onDelete: 'CASCADE'
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
          break;
          
        case 'options':
          await sequelize.getQueryInterface().createTable('options', {
            id: {
              type: DataTypes.UUID,
              defaultValue: DataTypes.UUIDV4,
              primaryKey: true
            },
            text: {
              type: DataTypes.TEXT,
              allowNull: false
            },
            isCorrect: {
              type: DataTypes.BOOLEAN,
              allowNull: false,
              defaultValue: false
            },
            optionIndex: {
              type: DataTypes.STRING(10),
              allowNull: true
            },
            questionId: {
              type: DataTypes.UUID,
              allowNull: false,
              references: {
                model: 'questions',
                key: 'id'
              },
              onUpdate: 'CASCADE',
              onDelete: 'CASCADE'
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
          break;
          
        default:
          console.log(`未知表: ${table}, 跳过创建`);
      }
      
      console.log(`${table}表创建成功！`);
    } catch (error) {
      console.error(`创建${table}表失败:`, error);
    }
  }
}

// 主函数
async function main() {
  try {
    // 测试数据库连接
    const connected = await testConnection();
    if (!connected) {
      console.error('数据库连接失败，退出');
      process.exit(1);
    }
    
    // 创建 HomepageSettings 表
    await createHomepageSettingsTable();
    
    // 检查并创建其他必要的表
    const missingTables = await checkRequiredTables();
    if (missingTables.length > 0) {
      console.log(`需要创建的表: ${missingTables.join(', ')}`);
      await createRequiredTables(missingTables);
    } else {
      console.log('所有必要的表已存在');
    }
    
    console.log('\n数据库迁移完成！');
    process.exit(0);
  } catch (error) {
    console.error('数据库迁移失败:', error);
    process.exit(1);
  }
}

// 执行主函数
main(); 