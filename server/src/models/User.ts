import { Model, DataTypes, Optional } from 'sequelize';
import sequelize from '../config/database';
import bcrypt from 'bcrypt';
import { IUser } from '../types';

type UserCreationAttributes = Optional<IUser, 'id' | 'createdAt' | 'updatedAt'>;

class User extends Model<IUser, UserCreationAttributes> implements IUser {
  declare id: string;
  declare username: string;
  declare email: string;
  declare password: string;
  declare isAdmin: boolean;
  declare progress: IUser['progress'];
  declare purchases: IUser['purchases'];
  declare redeemCodes: IUser['redeemCodes'];
  declare readonly createdAt: Date;
  declare readonly updatedAt: Date;

  async comparePassword(candidatePassword: string): Promise<boolean> {
    try {
      if (!this.password) {
        console.error('Cannot compare password: User password is empty or undefined');
        return false;
      }
      
      if (!candidatePassword) {
        console.error('Cannot compare password: Candidate password is empty or undefined');
        return false;
      }
      
      console.log('Comparing passwords, user password exists:', !!this.password, 'length:', this.password.length);
      
      const isMatch = await bcrypt.compare(candidatePassword, this.password);
      console.log('Password comparison result:', isMatch);
      return isMatch;
    } catch (error) {
      console.error('Password comparison error:', error);
      return false;
    }
  }

  // 用于安全地返回用户数据（不包含敏感信息）
  toSafeObject(): Omit<IUser, 'password'> {
    const { password, ...safeUser } = this.toJSON();
    return safeUser;
  }
}

User.init(
  {
    id: {
      type: DataTypes.UUID,
      defaultValue: DataTypes.UUIDV4,
      primaryKey: true,
    },
    username: {
      type: DataTypes.STRING,
      allowNull: false,
      unique: true,
      validate: {
        notEmpty: { msg: '用户名不能为空' },
        len: {
          args: [3, 30],
          msg: '用户名长度必须在3-30个字符之间'
        }
      }
    },
    email: {
      type: DataTypes.STRING,
      allowNull: false,
      unique: true,
      validate: {
        isEmail: { msg: '请输入有效的邮箱地址' },
        notEmpty: { msg: '邮箱不能为空' }
      }
    },
    password: {
      type: DataTypes.STRING,
      allowNull: false,
      validate: {
        notEmpty: { msg: '密码不能为空' },
        len: {
          args: [6, 100],
          msg: '密码长度必须在6-100个字符之间'
        }
      }
    },
    isAdmin: {
      type: DataTypes.BOOLEAN,
      defaultValue: false,
    },
    progress: {
      type: DataTypes.JSON,
      defaultValue: {},
    },
    purchases: {
      type: DataTypes.JSON,
      defaultValue: [],
    },
    redeemCodes: {
      type: DataTypes.JSON,
      defaultValue: [],
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
    indexes: [
      { unique: true, fields: ['email'] },
      { unique: true, fields: ['username'] }
    ],
    defaultScope: {
      attributes: { exclude: ['password'] }
    },
    scopes: {
      withPassword: {
        attributes: { include: ['password'] }
      }
    }
  }
);

// 密码加密钩子
User.beforeSave(async (user: User) => {
  try {
    // 记录当前状态以便调试
    console.log('beforeSave hook called, password changed:', user.changed('password'));
    
    if (user.changed('password')) {
      // 确保密码不为空或undefined
      if (!user.password) {
        console.log('Password is empty in beforeSave hook');
        throw new Error('密码不能为空');
      }
      
      console.log('Password exists and will be hashed');
      
      // 确保密码是字符串类型
      if (typeof user.password !== 'string') {
        console.log('Password is not a string, converting from type:', typeof user.password);
        user.password = String(user.password);
      }
      
      const salt = await bcrypt.genSalt(10);
      user.password = await bcrypt.hash(user.password, salt);
      console.log('Password successfully hashed');
    }
  } catch (error: any) {
    console.error('Password hashing error:', error.message, error.stack);
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
  if (!user.progress) user.progress = {};
  if (!user.purchases) user.purchases = [];
  if (!user.redeemCodes) user.redeemCodes = [];
  console.log('用户初始化默认值完成');
});

export default User; 