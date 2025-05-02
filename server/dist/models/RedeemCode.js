"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.setupAssociations = void 0;
const sequelize_1 = require("sequelize");
const database_1 = __importDefault(require("../config/database"));
const QuestionSet_1 = __importDefault(require("./QuestionSet"));
const User_1 = __importDefault(require("./User"));
// 兑换码模型类
class RedeemCode extends sequelize_1.Model {
    id;
    code;
    questionSetId;
    validityDays;
    expiryDate;
    isUsed;
    usedBy;
    usedAt;
    createdBy;
    // 时间戳
    createdAt;
    updatedAt;
    // 关联
    redeemQuestionSet;
    redeemUser;
    redeemCreator;
    // 静态方法：生成唯一兑换码
    static async generateUniqueCode(length = 8) {
        const characters = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789';
        let code;
        let isUnique = false;
        while (!isUnique) {
            // 生成随机码
            code = Array.from({ length }, () => characters.charAt(Math.floor(Math.random() * characters.length))).join('');
            // 检查是否唯一
            const existingCode = await RedeemCode.findOne({ where: { code } });
            if (!existingCode) {
                isUnique = true;
            }
        }
        return code;
    }
}
// 初始化模型
RedeemCode.init({
    id: {
        type: sequelize_1.DataTypes.UUID,
        defaultValue: sequelize_1.DataTypes.UUIDV4,
        primaryKey: true,
    },
    code: {
        type: sequelize_1.DataTypes.STRING(20),
        allowNull: false,
        unique: true
    },
    questionSetId: {
        type: sequelize_1.DataTypes.UUID,
        allowNull: false,
        references: {
            model: 'question_sets',
            key: 'id'
        }
    },
    validityDays: {
        type: sequelize_1.DataTypes.INTEGER,
        allowNull: false,
        validate: {
            min: 1
        }
    },
    expiryDate: {
        type: sequelize_1.DataTypes.DATE,
        allowNull: false
    },
    isUsed: {
        type: sequelize_1.DataTypes.BOOLEAN,
        allowNull: false,
        defaultValue: false
    },
    usedBy: {
        type: sequelize_1.DataTypes.UUID,
        allowNull: true,
        references: {
            model: 'users',
            key: 'id'
        }
    },
    usedAt: {
        type: sequelize_1.DataTypes.DATE,
        allowNull: true
    },
    createdBy: {
        type: sequelize_1.DataTypes.UUID,
        allowNull: false,
        references: {
            model: 'users',
            key: 'id'
        }
    }
}, {
    sequelize: database_1.default,
    tableName: 'redeem_codes',
    indexes: [
        { unique: true, fields: ['code'] },
        { fields: ['questionSetId'] },
        { fields: ['isUsed'] },
        { fields: ['usedBy'] },
        { fields: ['createdBy'] }
    ],
    hooks: {
        beforeValidate: async (redeemCode) => {
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
});
// 添加模型关联
const setupAssociations = () => {
    // RedeemCode与QuestionSet的关联
    RedeemCode.belongsTo(QuestionSet_1.default, {
        foreignKey: 'questionSetId',
        as: 'redeemQuestionSet',
        onDelete: 'CASCADE'
    });
    // RedeemCode与使用者User的关联
    RedeemCode.belongsTo(User_1.default, {
        foreignKey: 'usedBy',
        as: 'redeemUser',
        onDelete: 'CASCADE'
    });
    // RedeemCode与创建者User的关联
    RedeemCode.belongsTo(User_1.default, {
        foreignKey: 'createdBy',
        as: 'redeemCreator',
        onDelete: 'SET NULL'
    });
};
exports.setupAssociations = setupAssociations;
exports.default = RedeemCode;
