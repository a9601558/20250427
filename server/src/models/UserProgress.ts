import { Model, DataTypes, Optional } from 'sequelize';
import sequelize from '../config/database';
import User from './User';
import QuestionSet from './QuestionSet';
import Question from './Question';

// 定义接口
export interface UserProgressAttributes {
  id: string;
  userId: string;
  questionSetId: string;
  questionId: string;
  isCorrect: boolean;
  timeSpent: number;
  lastAccessed: Date;
  completedQuestions?: number;
  totalQuestions?: number;
  correctAnswers?: number;
  lastQuestionIndex?: number;
  metadata?: string;
  recordType?: string;
  createdAt?: Date;
  updatedAt?: Date;
}

// 创建时可选的属性
interface UserProgressCreationAttributes extends Optional<UserProgressAttributes, 'id'> {}

// 用户进度模型类
class UserProgress extends Model<UserProgressAttributes, UserProgressCreationAttributes> implements UserProgressAttributes {
  public id!: string;
  public userId!: string;
  public questionSetId!: string;
  public questionId!: string;
  public isCorrect!: boolean;
  public timeSpent!: number;
  public lastAccessed!: Date;
  public completedQuestions?: number;
  public totalQuestions?: number;
  public correctAnswers?: number;
  public lastQuestionIndex?: number;
  public metadata?: string;
  public recordType?: string;
  
  // 时间戳
  public readonly createdAt!: Date;
  public readonly updatedAt!: Date;

  public readonly progressQuestionSet?: QuestionSet;
  public readonly progressQuestion?: Question;
}

UserProgress.init(
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
    questionId: {
      type: DataTypes.UUID,
      allowNull: true,
      references: {
        model: 'questions',
        key: 'id'
      }
    },
    isCorrect: {
      type: DataTypes.BOOLEAN,
      allowNull: false
    },
    timeSpent: {
      type: DataTypes.INTEGER,
      allowNull: false,
      defaultValue: 0
    },
    completedQuestions: {
      type: DataTypes.INTEGER,
      allowNull: true,
    },
    totalQuestions: {
      type: DataTypes.INTEGER,
      allowNull: true,
    },
    correctAnswers: {
      type: DataTypes.INTEGER,
      allowNull: true,
    },
    lastQuestionIndex: {
      type: DataTypes.INTEGER,
      allowNull: true,
    },
    lastAccessed: {
      type: DataTypes.DATE,
      allowNull: false,
      defaultValue: DataTypes.NOW
    },
    metadata: {
      type: DataTypes.TEXT,
      allowNull: true,
      comment: '存储任意额外数据，例如已回答问题列表等JSON格式'
    },
    recordType: {
      type: DataTypes.TEXT,
      allowNull: true,
      comment: '存储记录类型'
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
    }
  },
  {
    sequelize,
    modelName: 'UserProgress',
    tableName: 'user_progress',
    timestamps: true,
    indexes: [
      { fields: ['userId'] },
      { fields: ['questionSetId'] },
      { fields: ['questionId'] },
      { fields: ['userId', 'questionSetId'] }
    ]
  }
);

export default UserProgress; 