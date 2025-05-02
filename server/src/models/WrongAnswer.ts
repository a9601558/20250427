import { Model, DataTypes, Optional } from 'sequelize';
import sequelize from '../config/database';

export interface WrongAnswerAttributes {
  id: string;
  userId: string;
  questionId: string;
  questionSetId: string;
  question: string;
  questionType: string;
  options: any[];
  selectedOption?: string;
  selectedOptions?: string[];
  correctOption?: string;
  correctOptions?: string[];
  explanation?: string;
  memo?: string;
  createdAt?: Date;
  updatedAt?: Date;
}

interface WrongAnswerCreationAttributes extends Optional<WrongAnswerAttributes, 'id' | 'createdAt' | 'updatedAt'> {}

class WrongAnswer extends Model<WrongAnswerAttributes, WrongAnswerCreationAttributes> implements WrongAnswerAttributes {
  public id!: string;
  public userId!: string;
  public questionId!: string;
  public questionSetId!: string;
  public question!: string;
  public questionType!: string;
  public options!: any[];
  public selectedOption?: string;
  public selectedOptions?: string[];
  public correctOption?: string;
  public correctOptions?: string[];
  public explanation?: string;
  public memo?: string;

  // 时间戳
  public readonly createdAt!: Date;
  public readonly updatedAt!: Date;
}

WrongAnswer.init(
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
    questionId: {
      type: DataTypes.UUID,
      allowNull: false,
    },
    questionSetId: {
      type: DataTypes.UUID,
      allowNull: false,
    },
    question: {
      type: DataTypes.TEXT,
      allowNull: false,
    },
    questionType: {
      type: DataTypes.STRING,
      allowNull: false,
    },
    options: {
      type: DataTypes.JSON,
      allowNull: false,
    },
    selectedOption: {
      type: DataTypes.STRING,
      allowNull: true,
    },
    selectedOptions: {
      type: DataTypes.JSON,
      allowNull: true,
    },
    correctOption: {
      type: DataTypes.STRING,
      allowNull: true,
    },
    correctOptions: {
      type: DataTypes.JSON,
      allowNull: true,
    },
    explanation: {
      type: DataTypes.TEXT,
      allowNull: true,
    },
    memo: {
      type: DataTypes.TEXT,
      allowNull: true,
    },
  },
  {
    sequelize,
    modelName: 'WrongAnswer',
    tableName: 'WrongAnswers',
  }
);

export default WrongAnswer; 
