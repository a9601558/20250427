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
        try {
            // 防御性检查，确保两个参数都存在且有效
            if (!this.password || !candidatePassword) {
                console.error(`密码比较错误: ${!this.password ? '存储密码' : '候选密码'}为空`);
                return false;
            }
            // 防止密码为空字符串
            if (this.password.trim() === '' || candidatePassword.trim() === '') {
                console.error('密码比较错误: 存储密码或候选密码为空字符串');
                return false;
            }
            // 使用bcrypt比较密码，并确保处理异常
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
                    // 检查密码是否为空字符串
                    if (user.password.trim() === '') {
                        throw new Error('密码不能为空字符串');
                    }
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
            // 确保密码字段有效
            if (!user.password || user.password.trim() === '') {
                throw new Error('新用户必须设置有效的密码');
            }
        },
        // 在数据加载后验证密码字段
        afterFind: async (result) => {
            // 处理查询结果为数组或单个对象的情况
            const users = Array.isArray(result) ? result : [result];
            // 检查每个用户的密码字段
            for (const user of users) {
                if (user && (!user.password || user.password.trim() === '')) {
                    console.warn(`发现无效密码: 用户 ${user.username || user.email}`);
                }
            }
        }
    }
});
exports.default = User;
