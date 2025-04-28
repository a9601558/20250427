"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const sequelize_1 = require("sequelize");
const bcryptjs_1 = __importDefault(require("bcryptjs"));
const db_1 = require("../config/db");
// User model type
class User extends sequelize_1.Model {
    id;
    username;
    email;
    password;
    isAdmin;
    progress;
    purchases;
    redeemCodes;
    // Time stamps
    createdAt;
    updatedAt;
    // Password comparison method
    async comparePassword(candidatePassword) {
        // 添加防御性检查，确保密码存在
        if (!this.password || !candidatePassword) {
            console.error('密码比较错误: 密码为空');
            return false;
        }
        try {
            return await bcryptjs_1.default.compare(candidatePassword, this.password);
        }
        catch (error) {
            console.error('密码比较错误:', error);
            return false;
        }
    }
}
// Initialize model
User.init({
    id: {
        type: sequelize_1.DataTypes.UUID,
        defaultValue: sequelize_1.DataTypes.UUIDV4,
        primaryKey: true,
    },
    username: {
        type: sequelize_1.DataTypes.STRING(50),
        allowNull: false,
        unique: true,
        validate: {
            len: [3, 50],
            notEmpty: true
        }
    },
    email: {
        type: sequelize_1.DataTypes.STRING(100),
        allowNull: false,
        unique: true,
        validate: {
            isEmail: true
        }
    },
    password: {
        type: sequelize_1.DataTypes.STRING(100),
        allowNull: false,
        validate: {
            len: [6, 100]
        }
    },
    isAdmin: {
        type: sequelize_1.DataTypes.BOOLEAN,
        allowNull: false,
        defaultValue: false
    },
    progress: {
        type: sequelize_1.DataTypes.JSON,
        allowNull: false,
        defaultValue: {}
    },
    purchases: {
        type: sequelize_1.DataTypes.JSON,
        allowNull: false,
        defaultValue: []
    },
    redeemCodes: {
        type: sequelize_1.DataTypes.JSON,
        allowNull: false,
        defaultValue: []
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
    },
}, {
    sequelize: db_1.sequelize,
    tableName: 'users',
    indexes: [
        { unique: true, fields: ['email'] },
        { unique: true, fields: ['username'] }
    ],
    hooks: {
        // Before saving, encrypt password
        beforeSave: async (user) => {
            try {
                // 只有当密码被修改且不为undefined/null/空字符串时才进行哈希处理
                if (user.password && user.changed('password')) {
                    console.log(`加密用户密码 (用户: ${user.username})`);
                    const salt = await bcryptjs_1.default.genSalt(10);
                    user.password = await bcryptjs_1.default.hash(user.password, salt);
                }
            }
            catch (error) {
                console.error('密码加密失败:', error);
                throw new Error('密码处理失败，请再次尝试');
            }
        },
        // 确保新创建的用户有必要的初始值
        beforeCreate: async (user) => {
            if (!user.progress)
                user.progress = {};
            if (!user.purchases)
                user.purchases = [];
            if (!user.redeemCodes)
                user.redeemCodes = [];
        }
    }
});
exports.default = User;
