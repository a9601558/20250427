import { Model, DataTypes } from 'sequelize';
import sequelize from '../config/database';
import { IPurchase } from '../types';
import QuestionSet from './QuestionSet';

interface PurchaseAttributes extends IPurchase {
  id: string;
  userId: string;
  questionSetId: string;
  amount: number;
  status: string;
  paymentMethod?: string;
  transactionId?: string;
  purchaseDate: Date;
  expiryDate: Date;
  createdAt: Date;
  updatedAt: Date;
}

class Purchase extends Model<PurchaseAttributes> implements PurchaseAttributes {
  public id!: string;
  public userId!: string;
  public questionSetId!: string;
  public amount!: number;
  public status!: string;
  public paymentMethod?: string;
  public transactionId?: string;
  public purchaseDate!: Date;
  public expiryDate!: Date;
  public readonly createdAt!: Date;
  public readonly updatedAt!: Date;

  // 关联
  public readonly questionSet?: QuestionSet;
}

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
    },
    questionSetId: {
      type: DataTypes.UUID,
      allowNull: false,
    },
    amount: {
      type: DataTypes.DECIMAL(10, 2),
      allowNull: false,
    },
    status: {
      type: DataTypes.STRING,
      allowNull: false,
      defaultValue: 'pending',
    },
    paymentMethod: {
      type: DataTypes.STRING,
      allowNull: true,
    },
    transactionId: {
      type: DataTypes.STRING,
      allowNull: true,
    },
    purchaseDate: {
      type: DataTypes.DATE,
      allowNull: false,
      defaultValue: DataTypes.NOW,
    },
    expiryDate: {
      type: DataTypes.DATE,
      allowNull: false,
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
    modelName: 'Purchase',
    tableName: 'purchases',
    timestamps: true,
  }
);

export default Purchase; 