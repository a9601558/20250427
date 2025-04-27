import { Model, DataTypes, Optional } from 'sequelize';
import { sequelize } from '../config/db';

// 购买记录接口
export interface PurchaseAttributes {
  id: string;
  userId: string;
  quizId: string;
  purchaseDate: Date;
  expiryDate: Date;
  transactionId: string;
  amount: number;
  paymentMethod: string;
  status: 'pending' | 'completed' | 'failed' | 'refunded';
  createdAt?: Date;
  updatedAt?: Date;
}

// 创建时可选的属性
interface PurchaseCreationAttributes extends Optional<PurchaseAttributes, 'id' | 'purchaseDate' | 'paymentMethod' | 'status'> {}

// 购买记录模型类
class Purchase extends Model<PurchaseAttributes, PurchaseCreationAttributes> implements PurchaseAttributes {
  public id!: string;
  public userId!: string;
  public quizId!: string;
  public purchaseDate!: Date;
  public expiryDate!: Date;
  public transactionId!: string;
  public amount!: number;
  public paymentMethod!: string;
  public status!: 'pending' | 'completed' | 'failed' | 'refunded';
  
  // 时间戳
  public readonly createdAt!: Date;
  public readonly updatedAt!: Date;
}

// 初始化模型
Purchase.init(
  {
    id: {
      type: DataTypes.UUID,
      defaultValue: DataTypes.UUIDV4,
      primaryKey: true,
    },
    userId: {
      type: DataTypes.UUID,
      allowNull: false,
      references: {
        model: 'users',
        key: 'id'
      }
    },
    quizId: {
      type: DataTypes.UUID,
      allowNull: false,
      references: {
        model: 'question_sets',
        key: 'id'
      }
    },
    purchaseDate: {
      type: DataTypes.DATE,
      allowNull: false,
      defaultValue: DataTypes.NOW
    },
    expiryDate: {
      type: DataTypes.DATE,
      allowNull: false
    },
    transactionId: {
      type: DataTypes.STRING(100),
      allowNull: false,
      unique: true
    },
    amount: {
      type: DataTypes.DECIMAL(10, 2),
      allowNull: false,
      validate: {
        min: 0
      }
    },
    paymentMethod: {
      type: DataTypes.STRING(20),
      allowNull: false,
      defaultValue: 'card'
    },
    status: {
      type: DataTypes.ENUM('pending', 'completed', 'failed', 'refunded'),
      allowNull: false,
      defaultValue: 'pending'
    }
  },
  {
    sequelize,
    tableName: 'purchases',
    indexes: [
      { fields: ['userId'] },
      { fields: ['quizId'] },
      { unique: true, fields: ['transactionId'] },
      { fields: ['status'] }
    ]
  }
);

export default Purchase; 