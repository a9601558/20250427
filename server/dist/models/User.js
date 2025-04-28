"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const sequelize_1 = require("sequelize");
const database_1 = __importDefault(require("../config/database"));
const bcrypt_1 = __importDefault(require("bcrypt"));
class User extends sequelize_1.Model {
    id;
    username;
    email;
    password;
    isAdmin;
    progress;
    purchases;
    redeemCodes;
    createdAt;
    updatedAt;
    async comparePassword(candidatePassword) {
        try {
            if (!this.password || !candidatePassword) {
                return false;
            }
            return bcrypt_1.default.compare(candidatePassword, this.password);
        }
        catch (error) {
            console.error('Password comparison error:', error);
            return false;
        }
    }
    // 用于安全地返回用户数据（不包含敏感信息）
    toSafeObject() {
        const { password, ...safeUser } = this.toJSON();
        return safeUser;
    }
}
User.init({
    id: {
        type: sequelize_1.DataTypes.UUID,
        defaultValue: sequelize_1.DataTypes.UUIDV4,
        primaryKey: true,
    },
    username: {
        type: sequelize_1.DataTypes.STRING,
        allowNull: false,
        unique: true,
        validate: {
            notEmpty: { msg: '用户名不能为空' },
            len: {
                args: [3, 30],
                msg: '用户名长度必须在3-30个字符之间'
            }
        }
    },
    email: {
        type: sequelize_1.DataTypes.STRING,
        allowNull: false,
        unique: true,
        validate: {
            isEmail: { msg: '请输入有效的邮箱地址' },
            notEmpty: { msg: '邮箱不能为空' }
        }
    },
    password: {
        type: sequelize_1.DataTypes.STRING,
        allowNull: false,
        validate: {
            notEmpty: { msg: '密码不能为空' },
            len: {
                args: [6, 100],
                msg: '密码长度必须在6-100个字符之间'
            }
        }
    },
    isAdmin: {
        type: sequelize_1.DataTypes.BOOLEAN,
        defaultValue: false,
    },
    progress: {
        type: sequelize_1.DataTypes.JSONB,
        defaultValue: {},
        validate: {
            isValidProgress(value) {
                if (typeof value !== 'object' || value === null) {
                    throw new Error('进度数据必须是一个对象');
                }
            }
        }
    },
    purchases: {
        type: sequelize_1.DataTypes.JSONB,
        defaultValue: [],
        validate: {
            isValidPurchases(value) {
                if (!Array.isArray(value)) {
                    throw new Error('购买记录必须是一个数组');
                }
            }
        }
    },
    redeemCodes: {
        type: sequelize_1.DataTypes.JSONB,
        defaultValue: [],
        validate: {
            isValidRedeemCodes(value) {
                if (!Array.isArray(value)) {
                    throw new Error('兑换码记录必须是一个数组');
                }
            }
        }
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
    sequelize: database_1.default,
    modelName: 'User',
    tableName: 'users',
    timestamps: true,
    indexes: [
        { unique: true, fields: ['email'] },
        { unique: true, fields: ['username'] }
    ],
    defaultScope: {
        attributes: { exclude: ['password'] }
    },
    scopes: {
        withPassword: {
            attributes: { include: ['password'] }
        }
    }
});
// 密码加密钩子
User.beforeSave(async (user) => {
    try {
        if (user.changed('password')) {
            const salt = await bcrypt_1.default.genSalt(10);
            user.password = await bcrypt_1.default.hash(user.password, salt);
        }
    }
    catch (error) {
        console.error('Password hashing error:', error);
        throw new Error('密码加密失败');
    }
});
// 数据验证钩子
User.beforeValidate((user) => {
    // 清理用户输入
    if (user.username) {
        user.username = user.username.trim();
    }
    if (user.email) {
        user.email = user.email.trim().toLowerCase();
    }
});
// 创建用户时的初始化钩子
User.beforeCreate((user) => {
    // 初始化默认值
    if (!user.progress)
        user.progress = {};
    if (!user.purchases)
        user.purchases = [];
    if (!user.redeemCodes)
        user.redeemCodes = [];
});
exports.default = User;
