import { Model, DataTypes, Optional } from 'sequelize';
import { sequelize } from '../config/db';

// 问题接口
export interface QuestionAttributes {
  id: string;
  questionSetId: string;
  text: string;
  questionType: 'single' | 'multiple';
  explanation: string;
  orderIndex: number;
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
  public questionType!: 'single' | 'multiple';
  public explanation!: string;
  public orderIndex!: number;
  
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
    },
    questionSetId: {
      type: DataTypes.UUID,
      allowNull: false,
      references: {
        model: 'question_sets',
        key: 'id'
      }
    },
    text: {
      type: DataTypes.TEXT,
      allowNull: false
    },
    questionType: {
      type: DataTypes.ENUM('single', 'multiple'),
      allowNull: false,
      defaultValue: 'single'
    },
    explanation: {
      type: DataTypes.TEXT,
      allowNull: false
    },
    orderIndex: {
      type: DataTypes.INTEGER,
      allowNull: false,
      defaultValue: 0
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