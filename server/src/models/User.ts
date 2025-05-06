import { Model, DataTypes, Optional } from 'sequelize';
import sequelize from '../config/database';
import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';
import { randomBytes } from 'crypto';
import { IUser, IPurchase, IRedeemCode, IProgressSummary } from '../types';
import Purchase from './Purchase';
import QuestionSet from './QuestionSet';

export type UserCreationAttributes = Optional<IUser, 'id' | 'createdAt' | 'updatedAt' | 'purchases' | 'redeemCodes' | 'progress' | 'socket_id' | 'examCountdowns' | 'role' | 'verified' | 'failedLoginAttempts' | 'accountLocked' | 'lockUntil' | 'preferredLanguage' | 'profilePicture' | 'lastLoginAt' | 'resetPasswordToken' | 'resetPasswordExpires'>;

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
  declare role: string;
  declare verified: boolean;
  declare failedLoginAttempts?: number;
  declare accountLocked?: boolean;
  declare lockUntil?: Date;
  declare preferredLanguage?: string;
  declare profilePicture?: string;
  declare lastLoginAt?: Date;
  declare resetPasswordToken?: string;
  declare resetPasswordExpires?: Date;
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

  // Generate JWT token
  generateAuthToken(): string {
    // 简化实现，暂时返回固定令牌
    return `token_${this.id}_${Date.now()}`;
  }

  // Generate verification token
  generateVerificationToken(): string {
    const token = randomBytes(32).toString('hex');
    this.resetPasswordToken = token;
    
    // Set expiration to 24 hours from now
    const expiration = new Date();
    expiration.setHours(expiration.getHours() + 24);
    this.resetPasswordExpires = expiration;
    
    return token;
  }

  // Generate password reset token
  generatePasswordResetToken(): string {
    const token = randomBytes(32).toString('hex');
    this.resetPasswordToken = token;
    
    // Set expiration to 1 hour from now
    const expiration = new Date();
    expiration.setHours(expiration.getHours() + 1);
    this.resetPasswordExpires = expiration;
    
    return token;
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
      type: DataTypes.STRING(50),
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
      type: DataTypes.STRING(100),
      allowNull: false,
      unique: true,
      validate: {
        isEmail: { msg: '请输入有效的邮箱地址' },
        notEmpty: { msg: '邮箱不能为空' }
      }
    },
    password: {
      type: DataTypes.STRING(255),
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
      allowNull: false,
      defaultValue: false
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
    role: {
      type: DataTypes.ENUM('user', 'admin'),
      defaultValue: 'user'
    },
    verified: {
      type: DataTypes.BOOLEAN,
      defaultValue: false
    },
    failedLoginAttempts: {
      type: DataTypes.INTEGER,
      defaultValue: 0
    },
    accountLocked: {
      type: DataTypes.BOOLEAN,
      defaultValue: false
    },
    lockUntil: {
      type: DataTypes.DATE,
      allowNull: true
    },
    preferredLanguage: {
      type: DataTypes.STRING,
      allowNull: true,
      defaultValue: 'zh-CN'
    },
    profilePicture: {
      type: DataTypes.STRING,
      allowNull: true
    },
    lastLoginAt: {
      type: DataTypes.DATE,
      allowNull: true
    },
    resetPasswordToken: {
      type: DataTypes.STRING,
      allowNull: true
    },
    resetPasswordExpires: {
      type: DataTypes.DATE,
      allowNull: true
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
      { unique: true, fields: ['username'] },
      { unique: true, fields: ['email'] }
    ],
    defaultScope: {
      attributes: { exclude: ['password'] }
    },
    scopes: {
      withPassword: {
        attributes: { include: ['password'] }
      }
    },
    hooks: {
      beforeSave: async (user: User) => {
        // Only hash password if it has been modified
        if (user.changed('password')) {
          const salt = await bcrypt.genSalt(10);
          user.password = await bcrypt.hash(user.password, salt);
        }
      }
    }
  }
);

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
  console.log('用户初始化默认值完成');
});

/* 
 * 关联关系已移至associations.ts中集中定义，避免重复定义导致别名冲突
 * 
// 定义关联关系
User.hasMany(Purchase, {
  foreignKey: 'user_id',
  sourceKey: 'id',
  as: 'userPurchases'
});

// 添加关联到QuestionSet
User.belongsToMany(QuestionSet, {
  through: Purchase,
  foreignKey: 'user_id',
  otherKey: 'question_set_id',
  as: 'questionSets'
});
*/

export default User; 