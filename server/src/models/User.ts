import { Model, DataTypes, Optional, ValidationError } from 'sequelize';
import sequelize from '../config/database';
import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';
import { randomBytes } from 'crypto';
import { IUser, IPurchase, IRedeemCode, IProgressSummary } from '../types';

export type UserCreationAttributes = Optional<IUser, 'id' | 'createdAt' | 'updatedAt' | 'purchases' | 'redeemCodes' | 'progress' | 'socket_id' | 'examCountdowns' | 'verified' | 'failedLoginAttempts' | 'accountLocked' | 'lockUntil' | 'preferredLanguage' | 'profilePicture' | 'lastLoginAt' | 'resetPasswordToken' | 'resetPasswordExpires'>;

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

  /**
   * Compare candidate password with stored hashed password
   * @param candidatePassword - The plain text password to compare
   * @returns A promise that resolves to a boolean indicating if passwords match
   */
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
      
      if (process.env.NODE_ENV === 'development') {
        console.log('Comparing passwords, user password exists:', !!this.password, 'length:', this.password.length);
      }
      
      const isMatch = await bcrypt.compare(candidatePassword, this.password);
      return isMatch;
    } catch (error) {
      console.error('Password comparison error:', error);
      return false;
    }
  }

  // Return user data without sensitive information
  toSafeObject(): Omit<IUser, 'password'> {
    const { password, ...safeUser } = this.toJSON();
    return safeUser;
  }

  // Generate JWT token
  generateAuthToken(): string {
    const secret = process.env.JWT_SECRET || 'default_secret';
    return jwt.sign(
      { id: this.id, isAdmin: this.isAdmin }, 
      secret, 
      { expiresIn: '30d' }
    );
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
  
  // Record failed login attempt
  async recordFailedLoginAttempt(): Promise<void> {
    // Increment failed login attempts
    this.failedLoginAttempts = (this.failedLoginAttempts || 0) + 1;
    
    // Lock account after 5 failed attempts
    if (this.failedLoginAttempts >= 5) {
      this.accountLocked = true;
      
      // Lock for 30 minutes
      const lockUntil = new Date();
      lockUntil.setMinutes(lockUntil.getMinutes() + 30);
      this.lockUntil = lockUntil;
    }
    
    await this.save();
  }
  
  // Reset failed login attempts after successful login
  async resetFailedLoginAttempts(): Promise<void> {
    this.failedLoginAttempts = 0;
    this.accountLocked = false;
    this.lockUntil = undefined;
    this.lastLoginAt = new Date();
    
    await this.save();
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
      type: DataTypes.TEXT,
      allowNull: true,
      defaultValue: '[]',
      get() {
        const value = this.getDataValue('purchases');
        if (!value) return [];
        try {
          return JSON.parse(value as unknown as string) as IPurchase[];
        } catch (e) {
          return [] as IPurchase[];
        }
      },
      set(value: IPurchase[] | string) {
        if (typeof value === 'object') {
          this.setDataValue('purchases', JSON.stringify(value) as unknown as IPurchase[]);
        } else {
          this.setDataValue('purchases', JSON.parse(value) as unknown as IPurchase[]);
        }
      }
    },
    redeemCodes: {
      type: DataTypes.TEXT,
      allowNull: true,
      defaultValue: '[]',
      get() {
        const value = this.getDataValue('redeemCodes');
        if (!value) return [];
        try {
          return JSON.parse(value as unknown as string) as IRedeemCode[];
        } catch (e) {
          return [] as IRedeemCode[];
        }
      },
      set(value: IRedeemCode[] | string) {
        if (typeof value === 'object') {
          this.setDataValue('redeemCodes', JSON.stringify(value) as unknown as IRedeemCode[]);
        } else {
          this.setDataValue('redeemCodes', JSON.parse(value) as unknown as IRedeemCode[]);
        }
      }
    },
    progress: {
      type: DataTypes.TEXT,
      allowNull: true,
      defaultValue: '{}',
      get() {
        const value = this.getDataValue('progress');
        if (!value) return {};
        try {
          return JSON.parse(value as unknown as string) as { [questionSetId: string]: IProgressSummary };
        } catch (e) {
          return {} as { [questionSetId: string]: IProgressSummary };
        }
      },
      set(value: { [questionSetId: string]: IProgressSummary } | string) {
        if (typeof value === 'object') {
          this.setDataValue('progress', JSON.stringify(value) as unknown as { [questionSetId: string]: IProgressSummary });
        } else {
          this.setDataValue('progress', JSON.parse(value) as unknown as { [questionSetId: string]: IProgressSummary });
        }
      }
    },
    examCountdowns: {
      type: DataTypes.TEXT,
      allowNull: true,
      defaultValue: '[]',
      get() {
        const value = this.getDataValue('examCountdowns');
        if (!value) return [];
        try {
          return JSON.parse(value as unknown as string);
        } catch (e) {
          return [];
        }
      },
      set(value: any[] | string) {
        if (typeof value === 'object') {
          this.setDataValue('examCountdowns', JSON.stringify(value) as unknown as any[]);
        } else {
          this.setDataValue('examCountdowns', JSON.parse(value) as unknown as any[]);
        }
      }
    },
    verified: {
      type: DataTypes.BOOLEAN,
      allowNull: false,
      defaultValue: false
    },
    failedLoginAttempts: {
      type: DataTypes.INTEGER,
      allowNull: false,
      defaultValue: 0
    },
    accountLocked: {
      type: DataTypes.BOOLEAN,
      allowNull: false,
      defaultValue: false
    },
    lockUntil: {
      type: DataTypes.DATE,
      allowNull: true
    },
    preferredLanguage: {
      type: DataTypes.STRING(10),
      allowNull: true,
      defaultValue: 'zh-CN'
    },
    profilePicture: {
      type: DataTypes.STRING(255),
      allowNull: true
    },
    lastLoginAt: {
      type: DataTypes.DATE,
      allowNull: true
    },
    resetPasswordToken: {
      type: DataTypes.STRING(255),
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
      attributes: { exclude: ['password', 'resetPasswordToken', 'resetPasswordExpires'] }
    },
    scopes: {
      withPassword: {
        attributes: { include: ['password'] }
      },
      withSensitiveInfo: {
        attributes: { include: ['password', 'resetPasswordToken', 'resetPasswordExpires'] }
      }
    },
    hooks: {
      beforeCreate: async (user: User, options) => {
        // Always hash password on creation
        if (user.password) {
          const salt = await bcrypt.genSalt(10);
          user.password = await bcrypt.hash(user.password, salt);
        } else {
          throw new Error('Password is required');
        }
      },
      beforeUpdate: async (user: User, options) => {
        // Only hash password if it has been modified
        if (user.changed('password') && user.password) {
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

export default User; 