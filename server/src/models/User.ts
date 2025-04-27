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
    return bcrypt.compare(candidatePassword, this.password);
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
    }
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
        if (user.changed('password')) {
          const salt = await bcrypt.genSalt(10);
          user.password = await bcrypt.hash(user.password, salt);
        }
      }
    }
  }
);

export default User; 