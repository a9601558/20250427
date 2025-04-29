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
  
  // 时间戳
  public readonly createdAt!: Date;
  public readonly updatedAt!: Date;

  public readonly questionSet?: QuestionSet;
  public readonly question?: Question;
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
      allowNull: false,
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
    lastAccessed: {
      type: DataTypes.DATE,
      allowNull: false,
      defaultValue: DataTypes.NOW
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

UserProgress.belongsTo(QuestionSet, {
  foreignKey: 'questionSetId',
  as: 'questionSet',
});

UserProgress.belongsTo(Question, {
  foreignKey: 'questionId',
  as: 'question',
});

export default UserProgress; 