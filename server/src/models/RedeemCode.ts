import { Model, DataTypes, Optional } from 'sequelize';
import sequelize from '../config/database';
import crypto from 'crypto';
import QuestionSet from './QuestionSet';
import User from './User';

// 兑换码接口
export interface RedeemCodeAttributes {
  id: string;
  code: string;
  questionSetId: string;
  validityDays: number;
  expiryDate: Date;
  isUsed: boolean;
  usedBy?: string;
  usedAt?: Date;
  createdBy: string;
  createdAt?: Date;
  updatedAt?: Date;
}

// 创建时可选的属性
interface RedeemCodeCreationAttributes extends Optional<RedeemCodeAttributes, 'id' | 'isUsed' | 'code' | 'expiryDate'> {}

// 兑换码模型类
class RedeemCode extends Model<RedeemCodeAttributes, RedeemCodeCreationAttributes> implements RedeemCodeAttributes {
  public id!: string;
  public code!: string;
  public questionSetId!: string;
  public validityDays!: number;
  public expiryDate!: Date;
  public isUsed!: boolean;
  public usedBy?: string;
  public usedAt?: Date;
  public createdBy!: string;
  
  // 时间戳
  public readonly createdAt!: Date;
  public readonly updatedAt!: Date;
  
  // 关联
  public readonly redeemQuestionSet?: QuestionSet;
  public readonly redeemUser?: User;
  public readonly redeemCreator?: User;
  
  // 静态方法：生成唯一兑换码
  static async generateUniqueCode(length = 8): Promise<string> {
    const characters = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789';
    let code;
    let isUnique = false;
    
    while (!isUnique) {
      // 生成随机码
      code = Array.from(
        { length }, 
        () => characters.charAt(Math.floor(Math.random() * characters.length))
      ).join('');
      
      // 检查是否唯一
      const existingCode = await RedeemCode.findOne({ where: { code } });
      if (!existingCode) {
        isUnique = true;
      }
    }
    
    return code as string;
  }
}

// 初始化模型
RedeemCode.init(
  {
    id: {
      type: DataTypes.UUID,
      defaultValue: DataTypes.UUIDV4,
      primaryKey: true,
    },
    code: {
      type: DataTypes.STRING(20),
      allowNull: false,
      unique: true
    },
    questionSetId: {
      type: DataTypes.UUID,
      allowNull: false,
      references: {
        model: 'question_sets',
        key: 'id'
      }
    },
    validityDays: {
      type: DataTypes.INTEGER,
      allowNull: false,
      validate: {
        min: 1
      }
    },
    expiryDate: {
      type: DataTypes.DATE,
      allowNull: false
    },
    isUsed: {
      type: DataTypes.BOOLEAN,
      allowNull: false,
      defaultValue: false
    },
    usedBy: {
      type: DataTypes.UUID,
      allowNull: true,
      references: {
        model: 'users',
        key: 'id'
      }
    },
    usedAt: {
      type: DataTypes.DATE,
      allowNull: true
    },
    createdBy: {
      type: DataTypes.UUID,
      allowNull: false,
      references: {
        model: 'users',
        key: 'id'
      }
    }
  },
  {
    sequelize,
    tableName: 'redeem_codes',
    indexes: [
      { unique: true, fields: ['code'] },
      { fields: ['questionSetId'] },
      { fields: ['isUsed'] },
      { fields: ['usedBy'] },
      { fields: ['createdBy'] }
    ],
    hooks: {
      beforeValidate: async (redeemCode: RedeemCode) => {
        // 如果没有提供兑换码，自动生成
        if (!redeemCode.code) {
          redeemCode.code = await RedeemCode.generateUniqueCode();
        }
        
        // 如果没有提供过期日期，基于有效天数计算
        if (!redeemCode.expiryDate) {
          const expiryDate = new Date();
          expiryDate.setDate(expiryDate.getDate() + redeemCode.validityDays);
          redeemCode.expiryDate = expiryDate;
        }
      }
    }
  }
);

// 添加模型关联
export const setupAssociations = () => {
  // RedeemCode与QuestionSet的关联
  RedeemCode.belongsTo(QuestionSet, {
    foreignKey: 'questionSetId',
    as: 'redeemQuestionSet',
    onDelete: 'CASCADE'
  });
  
  // RedeemCode与使用者User的关联
  RedeemCode.belongsTo(User, {
    foreignKey: 'usedBy',
    as: 'redeemUser',
    onDelete: 'CASCADE'
  });
  
  // RedeemCode与创建者User的关联
  RedeemCode.belongsTo(User, {
    foreignKey: 'createdBy',
    as: 'redeemCreator',
    onDelete: 'SET NULL'
  });
};

export default RedeemCode; 