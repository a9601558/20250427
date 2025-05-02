const { Model, DataTypes } = require('sequelize');
const bcrypt = require('bcryptjs');

// 注入全局Sequelize实例
// 确保全局sequelize实例存在
if (!global.sequelize) {
  const { Sequelize } = require('sequelize');
  const path = require('path');
  const fs = require('fs');
  const dotenv = require('dotenv');
  
  // 检查并加载 .env 文件
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
      logging: false,
      pool: { max: 5, min: 0, acquire: 30000, idle: 10000 }
    }
  );
  console.log('全局Sequelize实例创建成功');
}

// 使用全局sequelize实例
const sequelize = global.sequelize;

// 用户模型类
class User extends Model {
  // 密码比较方法
  async comparePassword(candidatePassword) {
    return await bcrypt.compare(candidatePassword, this.password);
  }
}

// 初始化模型
User.init(
  {
    id: {
      type: DataTypes.UUID,
      defaultValue: DataTypes.UUIDV4,
      primaryKey: true,
    },
    username: {
      type: DataTypes.STRING(50),
      allowNull: false,
      unique: true,
      validate: {
        len: [3, 50],
      },
    },
    email: {
      type: DataTypes.STRING(100),
      allowNull: false,
      unique: true,
      validate: {
        isEmail: true,
      },
    },
    password: {
      type: DataTypes.STRING(100),
      allowNull: false,
      validate: {
        len: [6, 100],
      },
    },
    isAdmin: {
      type: DataTypes.BOOLEAN,
      allowNull: false,
      defaultValue: false,
    },
    progress: {
      type: DataTypes.JSON,
      allowNull: false,
      defaultValue: {},
    },
    purchases: {
      type: DataTypes.JSON,
      allowNull: false,
      defaultValue: [],
    },
    redeemCodes: {
      type: DataTypes.JSON,
      allowNull: false,
      defaultValue: [],
    },
  },
  {
    sequelize,
    tableName: 'users',
    indexes: [
      { unique: true, fields: ['username'] },
      { unique: true, fields: ['email'] },
    ],
  }
);

module.exports = User; 
