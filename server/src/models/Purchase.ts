import { Model, DataTypes, Optional } from 'sequelize';
import sequelize from '../config/database';
import { IPurchase } from '../types';
import QuestionSet from './QuestionSet';
import User from './User';

interface PurchaseCreationAttributes extends Optional<IPurchase, 'id' | 'createdAt' | 'updatedAt' | 'paymentMethod' | 'transactionId'> {}

class Purchase extends Model<IPurchase, PurchaseCreationAttributes> implements IPurchase {
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
  public readonly user?: User;
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
      references: {
        model: 'users',
        key: 'id'
      }
    },
    questionSetId: {
      type: DataTypes.UUID,
      allowNull: false,
      references: {
        model: 'question_sets',
        key: 'id'
      }
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
    indexes: [
      { fields: ['userId'] },
      { fields: ['questionSetId'] },
      { fields: ['userId', 'questionSetId'] }
    ]
  }
);

export default Purchase; 