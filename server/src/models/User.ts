import { Model, DataTypes, Optional, Sequelize } from 'sequelize';
import path from 'path';
import fs from 'fs';
import dotenv from 'dotenv';
import bcrypt from 'bcrypt';
import { IUser, IPurchase, IRedeemCode, IProgressSummary } from '../types';
import { logger } from '../utils/logger';

// 尝试导入数据库配置，但提供可靠的回退机制
let sequelize: Sequelize;
try {
  // 尝试标准导入
  const db = require('../config/database');
  sequelize = db.default || db;
  
  // 验证sequelize实例是否有效
  if (!sequelize || typeof sequelize.define !== 'function') {
    throw new Error('导入的sequelize实例无效');
  }
  
  logger.info('成功从配置文件导入Sequelize实例');
} catch (error) {
  logger.warn('无法从配置文件导入Sequelize实例，创建内置实例:', error);
  
  // 加载环境变量
  const envPath = path.join(process.cwd(), '.env');
  if (fs.existsSync(envPath)) {
    logger.info(`加载环境变量文件: ${envPath}`);
    dotenv.config({ path: envPath });
  }
  
  // 手动创建Sequelize实例
  sequelize = new Sequelize(
    process.env.DB_NAME || 'quiz_app',
    process.env.DB_USER || 'root',
    process.env.DB_PASSWORD || '',
    {
      host: process.env.DB_HOST || 'localhost',
      port: parseInt(process.env.DB_PORT || '3306', 10),
      dialect: 'mysql',
      logging: (msg: string) => logger.debug(msg),
      pool: {
        max: 5,
        min: 0,
        acquire: 30000,
        idle: 10000
      },
      dialectOptions: {
        connectTimeout: 10000
      }
    }
  );
  
  // 为了安全起见，添加到global对象，确保其他模型能找到
  (global as any).sequelize = sequelize;
}

// 确保sequelize实例确实存在，即使上面的代码失败也提供兜底方案
if (!sequelize) {
  logger.error('严重错误: 无法创建Sequelize实例，使用应急方案');
  sequelize = new Sequelize('sqlite::memory:');
  (global as any).sequelize = sequelize;
}

export type UserCreationAttributes = Optional<IUser, 'id' | 'createdAt' | 'updatedAt' | 'purchases' | 'redeemCodes' | 'progress' | 'socket_id' | 'examCountdowns'>;

export class User extends Model<IUser, UserCreationAttributes> implements IUser {
  declare id: string;
  declare username: string;
  declare email: string;
  declare password: string;
  declare isAdmin: boolean;
  declare purchases: IPurchase[];
  declare socket_id: string | null;
  declare redeemCodes?: IRedeemCode[];
  declare progress?: {
    [questionSetId: string]: IProgressSummary;
  };
  declare examCountdowns?: string | any[];
  declare readonly createdAt: Date;
  declare readonly updatedAt: Date;

  async comparePassword(candidatePassword: string): Promise<boolean> {
    try {
      if (!this.password) {
        logger.error('Cannot compare password: User password is empty or undefined');
        return false;
      }
      
      if (!candidatePassword) {
        logger.error('Cannot compare password: Candidate password is empty or undefined');
        return false;
      }
      
      logger.debug('Comparing passwords, user password exists:', !!this.password, 'length:', this.password.length);
      
      const isMatch = await bcrypt.compare(candidatePassword, this.password);
      logger.debug('Password comparison result:', isMatch);
      return isMatch;
    } catch (error) {
      logger.error('Password comparison error:', error);
      return false;
    }
  }

  // 用于安全地返回用户数据（不包含敏感信息）
  toSafeObject(): Omit<IUser, 'password'> {
    const { password, ...safeUser } = this.toJSON();
    return safeUser;
  }
}

// 添加明确的sequelize实例检查
const initUserModel = () => {
  try {
    // 确保我们使用的sequelize实例有效
    if (!sequelize || typeof sequelize.define !== 'function') {
      logger.error('初始化User模型失败: 无效的Sequelize实例');
      
      // 紧急恢复: 重新创建Sequelize实例
      sequelize = new Sequelize(
        process.env.DB_NAME || 'quiz_app',
        process.env.DB_USER || 'root',
        process.env.DB_PASSWORD || '',
        {
          host: process.env.DB_HOST || 'localhost',
          port: parseInt(process.env.DB_PORT || '3306', 10),
          dialect: 'mysql',
          logging: (msg: string) => logger.debug(msg)
        }
      );
    }
    
    // 初始化User模型
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
            notEmpty: { msg: '用户名不能为空' },
            len: {
              args: [3, 30],
              msg: '用户名长度必须在3-30个字符之间',
            },
          },
        },
        email: {
          type: DataTypes.STRING(100),
          allowNull: false,
          unique: true,
          validate: {
            isEmail: { msg: '请输入有效的邮箱地址' },
            notEmpty: { msg: '邮箱不能为空' },
          },
        },
        password: {
          type: DataTypes.STRING(255),
          allowNull: false,
          validate: {
            notEmpty: { msg: '密码不能为空' },
            len: {
              args: [6, 100],
              msg: '密码长度必须在6-100个字符之间',
            },
          },
        },
        isAdmin: {
          type: DataTypes.BOOLEAN,
          allowNull: false,
          defaultValue: false,
        },
        socket_id: {
          type: DataTypes.STRING(255),
          allowNull: true,
          defaultValue: null,
          comment: '用户Socket连接ID',
        },
        purchases: {
          type: DataTypes.JSON,
          allowNull: false,
          defaultValue: [],
        },
        redeemCodes: {
          type: DataTypes.JSON,
          allowNull: true,
          defaultValue: [],
        },
        progress: {
          type: DataTypes.JSON,
          allowNull: true,
          defaultValue: {},
        },
        examCountdowns: {
          type: DataTypes.JSON,
          allowNull: true,
          defaultValue: '[]',
          comment: '用户保存的考试倒计时数据',
        },
        createdAt: {
          type: DataTypes.DATE,
          allowNull: false,
          defaultValue: DataTypes.NOW,
        },
        updatedAt: {
          type: DataTypes.DATE,
          allowNull: false,
          defaultValue: DataTypes.NOW,
        },
      },
      {
        sequelize,
        modelName: 'User',
        tableName: 'users',
        timestamps: true,
        defaultScope: {
          attributes: { exclude: ['password'] },
        },
        scopes: {
          withPassword: {
            attributes: { include: ['password'] },
          },
        },
      }
    );
    
    logger.info('User模型初始化成功');
    return true;
  } catch (error) {
    logger.error('User模型初始化失败:', error);
    return false;
  }
};

// 初始化User模型并处理可能的错误
if (!initUserModel()) {
  logger.error('警告: User模型初始化失败，应用可能无法正常工作');
}

// 密码加密钩子
User.beforeSave(async (user: User) => {
  try {
    // 记录当前状态以便调试
    logger.debug('beforeSave hook called, password changed:', user.changed('password'));
    
    if (user.changed('password')) {
      // 确保密码不为空或undefined
      if (!user.password) {
        logger.warn('Password is empty in beforeSave hook');
        throw new Error('密码不能为空');
      }
      
      logger.debug('Password exists and will be hashed');
      
      // 确保密码是字符串类型
      if (typeof user.password !== 'string') {
        logger.warn('Password is not a string, converting from type:', typeof user.password);
        user.password = String(user.password);
      }
      
      const salt = await bcrypt.genSalt(10);
      user.password = await bcrypt.hash(user.password, salt);
      logger.debug('Password successfully hashed');
    }
  } catch (error: any) {
    logger.error('Password hashing error:', error.message, error.stack);
    // 提供更具体的错误信息
    if (error.message?.includes('illegal arguments')) {
      throw new Error('密码格式不正确，无法加密');
    } else if (error.message?.includes('密码不能为空')) {
      throw new Error('密码不能为空');
    } else {
      throw new Error(`密码加密失败: ${error.message}`);
    }
  }
});

// 数据验证钩子
User.beforeValidate((user: User) => {
  // 清理用户输入
  if (user.username) {
    user.username = user.username.trim();
  }
  if (user.email) {
    user.email = user.email.trim().toLowerCase();
  }
});

// 创建用户时的初始化钩子
User.beforeCreate((user: User) => {
  // 初始化默认值
  if (!user.purchases) user.purchases = [];
  if (!user.redeemCodes) user.redeemCodes = [];
  logger.debug('用户初始化默认值完成');
});

export default User; 
