import { Model, DataTypes, Optional } from 'sequelize';
import sequelize from '../config/database';
import Option from './Option';
import QuestionSet from './QuestionSet';

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
  metadata?: string | object;
  createdAt: Date;
  updatedAt: Date;
}

// 创建时可选的属性
export type QuestionCreationAttributes = Optional<QuestionAttributes, 'id' | 'createdAt' | 'updatedAt' | 'metadata'>;

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
  public metadata?: string | object;
  
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
      },
      onDelete: 'CASCADE',
      onUpdate: 'CASCADE'
    },
    text: {
      type: DataTypes.TEXT,
      allowNull: false,
    },
    questionType: {
      type: DataTypes.STRING,
      allowNull: false,
      defaultValue: 'single',
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
      get() {
        const raw = this.getDataValue('metadata');
        if (raw) {
          try {
            return JSON.parse(raw as string);
          } catch (e) {
            return raw;
          }
        }
        return null;
      },
      set(value: any) {
        if (value && typeof value === 'object') {
          this.setDataValue('metadata', JSON.stringify(value));
        } else {
          this.setDataValue('metadata', value);
        }
      }
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
    modelName: 'Question',
    tableName: 'questions',
    timestamps: true,
    indexes: [
      { fields: ['questionSetId'] },
      { fields: ['questionSetId', 'orderIndex'] }
    ]
  }
);

// Define associations
Question.belongsTo(QuestionSet, {
  foreignKey: 'questionSetId',
  as: 'questionSet'
});

Question.hasMany(Option, {
  foreignKey: 'questionId',
  as: 'options'
});

export default Question; 