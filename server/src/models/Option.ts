import { Model, DataTypes, Optional } from 'sequelize';
import { sequelize } from '../config/db';

// 选项接口
export interface OptionAttributes {
  id: string;
  questionId: string;
  text: string;
  isCorrect: boolean;
  optionIndex: string; // 例如 "A", "B", "C", "D"
  createdAt?: Date;
  updatedAt?: Date;
}

// 创建时可选的属性
interface OptionCreationAttributes extends Optional<OptionAttributes, 'id'> {}

// 选项模型类
class Option extends Model<OptionAttributes, OptionCreationAttributes> implements OptionAttributes {
  public id!: string;
  public questionId!: string;
  public text!: string;
  public isCorrect!: boolean;
  public optionIndex!: string;
  
  // 时间戳
  public readonly createdAt!: Date;
  public readonly updatedAt!: Date;
}

// 初始化模型
Option.init(
  {
    id: {
      type: DataTypes.UUID,
      defaultValue: DataTypes.UUIDV4,
      primaryKey: true,
    },
    questionId: {
      type: DataTypes.UUID,
      allowNull: false,
      references: {
        model: 'questions',
        key: 'id'
      }
    },
    text: {
      type: DataTypes.TEXT,
      allowNull: false
    },
    isCorrect: {
      type: DataTypes.BOOLEAN,
      allowNull: false,
      defaultValue: false
    },
    optionIndex: {
      type: DataTypes.STRING(5),
      allowNull: false
    }
  },
  {
    sequelize,
    tableName: 'options',
    indexes: [
      { fields: ['questionId'] }
    ]
  }
);

export default Option; 