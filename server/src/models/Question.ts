import { Model, DataTypes, Optional } from 'sequelize';
import sequelize from '../config/database';
import { v4 as uuidv4 } from 'uuid';

// 问题接口
export interface QuestionAttributes {
  id: string;
  questionSetId: string;
  text: string;
  questionType: string;
  explanation?: string;
  orderIndex?: number;
  difficulty?: number;
  points?: number;
  timeLimit?: number;
  metadata?: string;
  createdAt?: Date;
  updatedAt?: Date;
}

// 创建时可选的属性
interface QuestionCreationAttributes extends Optional<QuestionAttributes, 'id'> {}

// 问题模型类
class Question extends Model<QuestionAttributes, QuestionCreationAttributes> implements QuestionAttributes {
  public id!: string;
  public questionSetId!: string;
  public text!: string;
  public questionType!: string;
  public explanation!: string;
  public orderIndex!: number;
  public difficulty?: number;
  public points?: number;
  public timeLimit?: number;
  public metadata?: string;
  
  // 时间戳
  public readonly createdAt!: Date;
  public readonly updatedAt!: Date;
}

// 初始化模型
Question.init(
  {
    id: {
      type: DataTypes.UUID,
      defaultValue: DataTypes.UUIDV4,
      primaryKey: true,
      allowNull: false
    },
    questionSetId: {
      type: DataTypes.UUID,
      allowNull: false,
      references: {
        model: 'QuestionSets',
        key: 'id'
      }
    },
    text: {
      type: DataTypes.TEXT,
      allowNull: false
    },
    questionType: {
      type: DataTypes.STRING,
      allowNull: false
    },
    explanation: {
      type: DataTypes.TEXT,
      allowNull: true,
      defaultValue: ''
    },
    orderIndex: {
      type: DataTypes.INTEGER,
      allowNull: true,
      defaultValue: 0
    },
    difficulty: {
      type: DataTypes.INTEGER,
      allowNull: true
    },
    points: {
      type: DataTypes.INTEGER,
      allowNull: true
    },
    timeLimit: {
      type: DataTypes.INTEGER,
      allowNull: true
    },
    metadata: {
      type: DataTypes.TEXT,
      allowNull: true,
      comment: 'JSON metadata for storing additional question information'
    }
  },
  {
    sequelize,
    tableName: 'questions',
    indexes: [
      { fields: ['questionSetId'] },
      { fields: ['questionSetId', 'orderIndex'] }
    ]
  }
);

export default Question; 