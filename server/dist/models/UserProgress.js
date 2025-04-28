"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.initUserProgressAssociations = void 0;
const sequelize_1 = require("sequelize");
const database_1 = __importDefault(require("../config/database"));
const User_1 = __importDefault(require("./User"));
const QuestionSet_1 = __importDefault(require("./QuestionSet"));
const Question_1 = __importDefault(require("./Question"));
// 用户进度模型类
class UserProgress extends sequelize_1.Model {
    id;
    userId;
    questionSetId;
    questionId;
    isCorrect;
    timeSpent;
    // 时间戳
    createdAt;
    updatedAt;
}
UserProgress.init({
    id: {
        type: sequelize_1.DataTypes.UUID,
        defaultValue: sequelize_1.DataTypes.UUIDV4,
        primaryKey: true,
    },
    userId: {
        type: sequelize_1.DataTypes.UUID,
        allowNull: false,
        references: {
            model: 'users',
            key: 'id'
        }
    },
    questionSetId: {
        type: sequelize_1.DataTypes.UUID,
        allowNull: false,
        references: {
            model: 'question_sets',
            key: 'id'
        }
    },
    questionId: {
        type: sequelize_1.DataTypes.UUID,
        allowNull: false,
        references: {
            model: 'questions',
            key: 'id'
        }
    },
    isCorrect: {
        type: sequelize_1.DataTypes.BOOLEAN,
        allowNull: false
    },
    timeSpent: {
        type: sequelize_1.DataTypes.INTEGER,
        allowNull: false,
        defaultValue: 0
    },
    createdAt: {
        type: sequelize_1.DataTypes.DATE,
        allowNull: false,
        defaultValue: sequelize_1.DataTypes.NOW,
    },
    updatedAt: {
        type: sequelize_1.DataTypes.DATE,
        allowNull: false,
        defaultValue: sequelize_1.DataTypes.NOW,
    }
}, {
    sequelize: database_1.default,
    modelName: 'UserProgress',
    tableName: 'user_progress',
    timestamps: true,
    indexes: [
        { fields: ['userId'] },
        { fields: ['questionSetId'] },
        { fields: ['questionId'] },
        { fields: ['userId', 'questionSetId'] }
    ]
});
// 声明关联
const initUserProgressAssociations = () => {
    UserProgress.belongsTo(User_1.default, { foreignKey: 'userId' });
    UserProgress.belongsTo(QuestionSet_1.default, { foreignKey: 'questionSetId' });
    UserProgress.belongsTo(Question_1.default, { foreignKey: 'questionId' });
};
exports.initUserProgressAssociations = initUserProgressAssociations;
exports.default = UserProgress;
