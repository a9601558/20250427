"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.User = void 0;
const sequelize_1 = require("sequelize");
const database_1 = __importDefault(require("../config/database"));
const bcryptjs_1 = __importDefault(require("bcryptjs"));
const jsonwebtoken_1 = __importDefault(require("jsonwebtoken"));
const crypto_1 = require("crypto");
class User extends sequelize_1.Model {
    /**
     * Compare candidate password with stored hashed password
     * @param candidatePassword - The plain text password to compare
     * @returns A promise that resolves to a boolean indicating if passwords match
     */
    async comparePassword(candidatePassword) {
        try {
            if (!this.password) {
                console.error('Cannot compare password: User password is empty or undefined');
                return false;
            }
            if (!candidatePassword) {
                console.error('Cannot compare password: Candidate password is empty or undefined');
                return false;
            }
            if (process.env.NODE_ENV === 'development') {
                console.log('Comparing passwords, user password exists:', !!this.password, 'length:', this.password.length);
            }
            const isMatch = await bcryptjs_1.default.compare(candidatePassword, this.password);
            return isMatch;
        }
        catch (error) {
            console.error('Password comparison error:', error);
            return false;
        }
    }
    // Return user data without sensitive information
    toSafeObject() {
        const { password, ...safeUser } = this.toJSON();
        return safeUser;
    }
    // Generate JWT token
    generateAuthToken() {
        const secret = process.env.JWT_SECRET || 'default_secret';
        return jsonwebtoken_1.default.sign({ id: this.id, isAdmin: this.isAdmin }, secret, { expiresIn: '30d' });
    }
    // Generate verification token
    generateVerificationToken() {
        const token = (0, crypto_1.randomBytes)(32).toString('hex');
        this.resetPasswordToken = token;
        // Set expiration to 24 hours from now
        const expiration = new Date();
        expiration.setHours(expiration.getHours() + 24);
        this.resetPasswordExpires = expiration;
        return token;
    }
    // Generate password reset token
    generatePasswordResetToken() {
        const token = (0, crypto_1.randomBytes)(32).toString('hex');
        this.resetPasswordToken = token;
        // Set expiration to 1 hour from now
        const expiration = new Date();
        expiration.setHours(expiration.getHours() + 1);
        this.resetPasswordExpires = expiration;
        return token;
    }
    // Record failed login attempt
    async recordFailedLoginAttempt() {
        // Increment failed login attempts
        this.failedLoginAttempts = (this.failedLoginAttempts || 0) + 1;
        // Lock account after 5 failed attempts
        if (this.failedLoginAttempts >= 5) {
            this.accountLocked = true;
            // Lock for 30 minutes
            const lockUntil = new Date();
            lockUntil.setMinutes(lockUntil.getMinutes() + 30);
            this.lockUntil = lockUntil;
        }
        await this.save();
    }
    // Reset failed login attempts after successful login
    async resetFailedLoginAttempts() {
        this.failedLoginAttempts = 0;
        this.accountLocked = false;
        this.lockUntil = undefined;
        this.lastLoginAt = new Date();
        await this.save();
    }
}
exports.User = User;
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
            notEmpty: { msg: '用户名不能为空' },
            len: {
                args: [3, 30],
                msg: '用户名长度必须在3-30个字符之间'
            }
        }
    },
    email: {
        type: sequelize_1.DataTypes.STRING(100),
        allowNull: false,
        unique: true,
        validate: {
            isEmail: { msg: '请输入有效的邮箱地址' },
            notEmpty: { msg: '邮箱不能为空' }
        }
    },
    password: {
        type: sequelize_1.DataTypes.STRING(255),
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
        allowNull: false,
        defaultValue: false
    },
    socket_id: {
        type: sequelize_1.DataTypes.STRING(255),
        allowNull: true,
        defaultValue: null,
        comment: '用户Socket连接ID',
    },
    purchases: {
        type: sequelize_1.DataTypes.JSON,
        allowNull: false,
        defaultValue: [],
    },
    redeemCodes: {
        type: sequelize_1.DataTypes.JSON,
        allowNull: true,
        defaultValue: [],
    },
    progress: {
        type: sequelize_1.DataTypes.JSON,
        allowNull: true,
        defaultValue: {},
    },
    examCountdowns: {
        type: sequelize_1.DataTypes.JSON,
        allowNull: true,
        defaultValue: '[]',
        comment: '用户保存的考试倒计时数据',
        get() {
            const value = this.getDataValue('examCountdowns');
            if (typeof value === 'string') {
                try {
                    return JSON.parse(value);
                }
                catch (e) {
                    console.error('Error parsing examCountdowns:', e);
                    return [];
                }
            }
            return value;
        },
        set(value) {
            if (typeof value === 'object') {
                this.setDataValue('examCountdowns', JSON.stringify(value));
            }
            else {
                this.setDataValue('examCountdowns', value);
            }
        }
    },
    role: {
        type: sequelize_1.DataTypes.ENUM('user', 'admin'),
        defaultValue: 'user'
    },
    verified: {
        type: sequelize_1.DataTypes.BOOLEAN,
        defaultValue: false
    },
    failedLoginAttempts: {
        type: sequelize_1.DataTypes.INTEGER,
        defaultValue: 0
    },
    accountLocked: {
        type: sequelize_1.DataTypes.BOOLEAN,
        defaultValue: false
    },
    lockUntil: {
        type: sequelize_1.DataTypes.DATE,
        allowNull: true
    },
    preferredLanguage: {
        type: sequelize_1.DataTypes.STRING,
        allowNull: true,
        defaultValue: 'zh-CN'
    },
    profilePicture: {
        type: sequelize_1.DataTypes.STRING,
        allowNull: true
    },
    lastLoginAt: {
        type: sequelize_1.DataTypes.DATE,
        allowNull: true
    },
    resetPasswordToken: {
        type: sequelize_1.DataTypes.STRING,
        allowNull: true
    },
    resetPasswordExpires: {
        type: sequelize_1.DataTypes.DATE,
        allowNull: true
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
        { unique: true, fields: ['username'] },
        { unique: true, fields: ['email'] }
    ],
    defaultScope: {
        attributes: { exclude: ['password', 'resetPasswordToken', 'resetPasswordExpires'] }
    },
    scopes: {
        withPassword: {
            attributes: { include: ['password'] }
        },
        withSensitiveInfo: {
            attributes: { include: ['password', 'resetPasswordToken', 'resetPasswordExpires'] }
        }
    },
    hooks: {
        beforeCreate: async (user, options) => {
            // Always hash password on creation
            if (user.password) {
                const salt = await bcryptjs_1.default.genSalt(10);
                user.password = await bcryptjs_1.default.hash(user.password, salt);
            }
            else {
                throw new Error('Password is required');
            }
            // Process examCountdowns if it's an object
            const examCountdowns = user.getDataValue('examCountdowns');
            if (typeof examCountdowns === 'object' && examCountdowns !== null) {
                user.setDataValue('examCountdowns', JSON.stringify(examCountdowns));
            }
        },
        beforeUpdate: async (user, options) => {
            // Only hash password if it has been modified
            if (user.changed('password') && user.password) {
                const salt = await bcryptjs_1.default.genSalt(10);
                user.password = await bcryptjs_1.default.hash(user.password, salt);
            }
            // Process examCountdowns if it's an object
            const examCountdowns = user.getDataValue('examCountdowns');
            if (typeof examCountdowns === 'object' && examCountdowns !== null) {
                user.setDataValue('examCountdowns', JSON.stringify(examCountdowns));
            }
        }
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
    if (!user.purchases)
        user.purchases = [];
    if (!user.redeemCodes)
        user.redeemCodes = [];
    console.log('用户初始化默认值完成');
});
exports.default = User;
