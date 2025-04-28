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
    // 添加防御性检查，确保密码存在
    if (!this.password || !candidatePassword) {
      console.error('密码比较错误: 密码为空');
      return false;
    }
    
    try {
      return await bcrypt.compare(candidatePassword, this.password);
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
      // Before saving, encrypt password
      beforeSave: async (user: User) => {
        try {
          // 只有当密码被修改且不为undefined/null/空字符串时才进行哈希处理
          if (user.password && user.changed('password')) {
            console.log(`加密用户密码 (用户: ${user.username})`);
            const salt = await bcrypt.genSalt(10);
            user.password = await bcrypt.hash(user.password, salt);
          }
        } catch (error) {
          console.error('密码加密失败:', error);
          throw new Error('密码处理失败，请再次尝试');
        }
      },
      // 确保新创建的用户有必要的初始值
      beforeCreate: async (user: User) => {
        if (!user.progress) user.progress = {};
        if (!user.purchases) user.purchases = [];
        if (!user.redeemCodes) user.redeemCodes = [];
      }
    }
  }
);

export default User; 