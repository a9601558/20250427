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
  public readonly purchaseQuestionSet?: QuestionSet;
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
      field: 'user_id',
      references: {
        model: 'users',
        key: 'id'
      },
      onDelete: 'CASCADE'
    },
    questionSetId: {
      type: DataTypes.UUID,
      allowNull: false,
      field: 'question_set_id',
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
      field: 'payment_method',
    },
    transactionId: {
      type: DataTypes.STRING,
      allowNull: true,
      field: 'transaction_id',
    },
    purchaseDate: {
      type: DataTypes.DATE,
      allowNull: false,
      defaultValue: DataTypes.NOW,
      field: 'purchase_date',
    },
    expiryDate: {
      type: DataTypes.DATE,
      allowNull: false,
      field: 'expiry_date',
    },
    createdAt: {
      type: DataTypes.DATE,
      allowNull: false,
      defaultValue: DataTypes.NOW,
      field: 'created_at',
    },
    updatedAt: {
      type: DataTypes.DATE,
      allowNull: false,
      defaultValue: DataTypes.NOW,
      field: 'updated_at',
    },
  },
  {
    sequelize,
    modelName: 'Purchase',
    tableName: 'purchases',
    underscored: true,
    timestamps: true,
    createdAt: 'created_at',
    updatedAt: 'updated_at',
    indexes: [
      { fields: ['user_id'] },
      { fields: ['question_set_id'] },
      { fields: ['user_id', 'question_set_id'] }
    ]
  }
);

export default Purchase; 