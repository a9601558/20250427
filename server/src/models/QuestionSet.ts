import { Model, DataTypes, Optional } from 'sequelize';
import db from '../config/db';
import { sequelize } from '../config/db';

// 题集接口
export interface QuestionSetAttributes {
  id: string;
  title: string;
  description: string;
  category: string;
  icon: string;
  isPaid: boolean;
  price?: number;
  trialQuestions?: number;
  isFeatured?: boolean;
  featuredCategory?: string;
  createdAt?: Date;
  updatedAt?: Date;
}

// 创建时可选的属性
interface QuestionSetCreationAttributes extends Optional<QuestionSetAttributes, 'id'> {}

// 题集模型类
class QuestionSet extends Model<QuestionSetAttributes, QuestionSetCreationAttributes> implements QuestionSetAttributes {
  public id!: string;
  public title!: string;
  public description!: string;
  public category!: string;
  public icon!: string;
  public isPaid!: boolean;
  public price?: number;
  public trialQuestions?: number;
  public isFeatured?: boolean;
  public featuredCategory?: string;
  
  // 时间戳
  public readonly createdAt!: Date;
  public readonly updatedAt!: Date;
}

// 初始化模型
QuestionSet.init(
  {
    id: {
      type: DataTypes.UUID,
      defaultValue: DataTypes.UUIDV4,
      primaryKey: true,
    },
    title: {
      type: DataTypes.STRING(100),
      allowNull: false,
      validate: {
        notEmpty: true
      }
    },
    description: {
      type: DataTypes.TEXT,
      allowNull: false
    },
    category: {
      type: DataTypes.STRING(50),
      allowNull: false
    },
    icon: {
      type: DataTypes.STRING(50),
      allowNull: false
    },
    isPaid: {
      type: DataTypes.BOOLEAN,
      allowNull: false,
      defaultValue: false
    },
    price: {
      type: DataTypes.DECIMAL(10, 2),
      allowNull: true,
      validate: {
        min: 0
      }
    },
    trialQuestions: {
      type: DataTypes.INTEGER,
      allowNull: true,
      defaultValue: 0,
      validate: {
        min: 0
      }
    },
    isFeatured: {
      type: DataTypes.BOOLEAN,
      allowNull: false,
      defaultValue: false
    },
    featuredCategory: {
      type: DataTypes.STRING(50),
      allowNull: true
    }
  },
  {
    sequelize,
    tableName: 'question_sets',
    indexes: [
      { fields: ['category'] },
      { fields: ['isFeatured'] }
    ],
    hooks: {
      beforeValidate: (questionSet: QuestionSet) => {
        // 如果是付费题集，价格必须大于0
        if (questionSet.isPaid && (!questionSet.price || questionSet.price <= 0)) {
          throw new Error('Paid question sets must have a price greater than 0');
        }
      }
    }
  }
);

export default QuestionSet; 