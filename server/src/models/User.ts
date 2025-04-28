import { Model, DataTypes, Optional } from 'sequelize';
import bcrypt from 'bcryptjs';
import { sequelize } from '../config/db';

// User progress interface
interface IUserProgress {
  completedQuestions: number;
  totalQuestions: number;
  correctAnswers: number;
  lastAccessed: Date;
}

// Purchase interface
interface IPurchase {
  quizId: string;
  purchaseDate: Date;
  expiryDate: Date;
  transactionId: string;
  amount: number;
}

// Redeem code interface
interface IRedeemCode {
  code: string;
  questionSetId: string;
  validityDays: number;
  createdAt: Date;
  usedBy?: string;
  usedAt?: Date;
}

// User interface extending Document
export interface UserAttributes {
  id: string;
  username: string;
  email: string;
  password: string;
  isAdmin: boolean;
  progress: Record<string, IUserProgress>;
  purchases: IPurchase[];
  redeemCodes: IRedeemCode[];
  createdAt?: Date;
  updatedAt?: Date;
}

// 创建时可选的属性
interface UserCreationAttributes extends Optional<UserAttributes, 'id'> {}

// User model type
class User extends Model<UserAttributes, UserCreationAttributes> implements UserAttributes {
  public id!: string;
  public username!: string;
  public email!: string;
  public password!: string;
  public isAdmin!: boolean;
  public progress!: Record<string, IUserProgress>;
  public purchases!: IPurchase[];
  public redeemCodes!: IRedeemCode[];
  
  // Time stamps
  public readonly createdAt!: Date;
  public readonly updatedAt!: Date;
  
  // Password comparison method
  async comparePassword(candidatePassword: string): Promise<boolean> {
    try {
      // 防御性检查，确保两个参数都存在且有效
      if (!this.password || !candidatePassword) {
        console.error(`密码比较错误: ${!this.password ? '存储密码' : '候选密码'}为空`);
        return false;
      }
      
      // 防止密码为空字符串
      if (this.password.trim() === '' || candidatePassword.trim() === '') {
        console.error('密码比较错误: 存储密码或候选密码为空字符串');
        return false;
      }
      
      // 检查密码是否已经被加密（以$2a$开头）
      if (!this.password.startsWith('$2a$')) {
        console.error('密码比较错误: 存储的密码未被加密');
        return false;
      }
      
      // 使用bcrypt比较密码，并确保处理异常
      const isMatch = await bcrypt.compare(candidatePassword, this.password);
      return isMatch;
    } catch (error) {
      console.error('密码比较错误:', error);
      return false;
    }
  }
}

// Initialize model
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
        notEmpty: true
      }
    },
    email: {
      type: DataTypes.STRING(100),
      allowNull: false,
      unique: true,
      validate: {
        isEmail: true
      }
    },
    password: {
      type: DataTypes.STRING(100),
      allowNull: false,
      validate: {
        len: [6, 100]
      }
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
    tableName: 'users',
    indexes: [
      { unique: true, fields: ['email'] },
      { unique: true, fields: ['username'] }
    ],
    hooks: {
      // 统一的密码加密方法
      beforeValidate: async (user: User) => {
        // 确保密码字段存在且有效
        if (!user.password || user.password.trim() === '') {
          throw new Error('密码不能为空');
        }
      },

      // 在保存前处理密码加密
      beforeSave: async (user: User) => {
        try {
          // 检查密码是否已经被加密（以$2a$开头）
          if (user.password && !user.password.startsWith('$2a$')) {
            console.log(`对用户 ${user.username} 进行密码加密...`);

            // 记录原始密码长度（仅显示前几个字符）
            console.log(`密码加密前 (${user.username}): ${user.password.substring(0, 3)}*** (长度: ${user.password.length})`);
            
            // 进行密码加密
            const salt = await bcrypt.genSalt(10);
            const hashedPassword = await bcrypt.hash(user.password, salt);
            user.password = hashedPassword;
            
            console.log(`密码加密后 (${user.username}): ${user.password.substring(0, 10)}... (长度: ${user.password.length})`);
          } else if (user.password && user.password.startsWith('$2a$')) {
            console.log(`用户 ${user.username} 的密码已经加密，无需再次处理`);
          }
        } catch (error) {
          console.error('密码加密失败:', error);
          throw new Error('密码处理失败，请再次尝试');
        }
      },
      
      // 在创建用户之前进行额外检查
      beforeCreate: async (user: User) => {
        // 初始化必要的字段
        if (!user.progress) user.progress = {};
        if (!user.purchases) user.purchases = [];
        if (!user.redeemCodes) user.redeemCodes = [];
        
        // 确保密码字段有效
        if (!user.password || user.password.trim() === '') {
          throw new Error('新用户必须设置有效的密码');
        }
        
        // 确保密码被加密（即使这个逻辑已经在beforeSave中实现）
        if (!user.password.startsWith('$2a$')) {
          console.log(`创建用户前确认密码加密 (${user.username})...`);
          const salt = await bcrypt.genSalt(10);
          user.password = await bcrypt.hash(user.password, salt);
          console.log(`创建用户前密码已加密: ${user.password.substring(0, 10)}...`);
        }
      },
      
      // 在查询后检查密码字段
      afterFind: async (result) => {
        // 处理查询结果为数组或单个对象的情况
        const users = Array.isArray(result) ? result : result ? [result] : [];
        
        // 检查每个用户的密码字段
        for (const user of users) {
          if (user && (!user.password || user.password.trim() === '')) {
            console.warn(`发现无效密码: 用户 ${user.username || user.email}`);
          } else if (user && user.password && !user.password.startsWith('$2a$')) {
            console.warn(`警告: 用户 ${user.username || user.email} 的密码未加密`);
          }
        }
      }
    }
  }
);

export default User; 