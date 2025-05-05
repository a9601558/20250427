import { Model, DataTypes, Optional } from 'sequelize';
import sequelize from '../config/database';
import Question from './Question';

// 题集接口
export interface QuestionSetAttributes {
  id: string;
  title: string;
  description: string;
  category: string;
  icon?: string;
  isPaid: boolean;
  price?: number;
  trialQuestions?: number;
  isFeatured: boolean;
  featuredCategory?: string;
  createdAt: Date;
  updatedAt: Date;
}

// 创建时可选字段
export type QuestionSetCreationAttributes = Optional<QuestionSetAttributes, 'id' | 'createdAt' | 'updatedAt' | 'isPaid' | 'isFeatured' | 'icon' | 'price' | 'trialQuestions' | 'featuredCategory'>;

// 题集模型类
class QuestionSet extends Model<QuestionSetAttributes, QuestionSetCreationAttributes> implements QuestionSetAttributes {
  declare id: string;
  declare title: string;
  declare description: string;
  declare category: string;
  declare icon?: string;
  declare isPaid: boolean;
  declare price?: number;
  declare trialQuestions?: number;
  declare isFeatured: boolean;
  declare featuredCategory?: string;
  declare readonly createdAt: Date;
  declare readonly updatedAt: Date;
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
      allowNull: true,
    },
    isPaid: {
      type: DataTypes.BOOLEAN,
      allowNull: false,
      defaultValue: false,
      field: 'is_paid'
    },
    price: {
      type: DataTypes.DECIMAL(10, 2),
      allowNull: true,
    },
    trialQuestions: {
      type: DataTypes.INTEGER,
      allowNull: true,
      field: 'trial_questions'
    },
    isFeatured: {
      type: DataTypes.BOOLEAN,
      allowNull: false,
      defaultValue: false,
      field: 'is_featured'
    },
    featuredCategory: {
      type: DataTypes.STRING,
      allowNull: true,
      field: 'featured_category'
    },
    createdAt: {
      type: DataTypes.DATE,
      allowNull: false,
      defaultValue: DataTypes.NOW,
      field: 'created_at'
    },
    updatedAt: {
      type: DataTypes.DATE,
      allowNull: false,
      defaultValue: DataTypes.NOW,
      field: 'updated_at'
    },
  },
  {
    sequelize,
    modelName: 'QuestionSet',
    tableName: 'question_sets',
    timestamps: true,
    underscored: true,
  }
);

// Define association with questions
QuestionSet.hasMany(Question, {
  sourceKey: 'id',
  foreignKey: 'questionSetId',
  as: 'questions'
});

export default QuestionSet; 