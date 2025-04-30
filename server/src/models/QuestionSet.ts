import { Model, DataTypes, Optional } from 'sequelize';
import sequelize from '../config/database';
import Question from './Question';

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
  questions?: Question[];
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

  // 关联
  public readonly questions?: Question[];
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
      type: DataTypes.STRING,
      allowNull: false,
    },
    description: {
      type: DataTypes.TEXT,
      allowNull: false,
    },
    category: {
      type: DataTypes.STRING,
      allowNull: false,
    },
    icon: {
      type: DataTypes.STRING,
      allowNull: false,
      defaultValue: 'default',
    },
    isPaid: {
      type: DataTypes.BOOLEAN,
      allowNull: false,
      defaultValue: false,
      field: 'is_paid',
    },
    price: {
      type: DataTypes.DECIMAL(10, 2),
      allowNull: true,
      field: 'price',
    },
    trialQuestions: {
      type: DataTypes.INTEGER,
      allowNull: true,
      field: 'trial_questions',
    },
    isFeatured: {
      type: DataTypes.BOOLEAN,
      allowNull: false,
      defaultValue: false,
      field: 'is_featured',
    },
    featuredCategory: {
      type: DataTypes.STRING,
      allowNull: true,
      field: 'featured_category',
    },
  },
  {
    sequelize,
    modelName: 'QuestionSet',
    tableName: 'question_sets',
    underscored: true,
    timestamps: true,
    createdAt: 'created_at',
    updatedAt: 'updated_at',
  }
);

export default QuestionSet; 