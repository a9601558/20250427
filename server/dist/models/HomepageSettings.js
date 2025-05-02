"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.HomepageSettings = void 0;
const sequelize_1 = require("sequelize");
const database_1 = __importDefault(require("../config/database"));
class HomepageSettings extends sequelize_1.Model {
    id;
    featuredCategories;
    siteTitle;
    welcomeMessage;
    footerText;
    createdAt;
    updatedAt;
}
exports.HomepageSettings = HomepageSettings;
HomepageSettings.init({
    id: {
        type: sequelize_1.DataTypes.INTEGER,
        autoIncrement: true,
        primaryKey: true,
    },
    featuredCategories: {
        type: sequelize_1.DataTypes.JSON,
        allowNull: false,
        defaultValue: [],
    },
    siteTitle: {
        type: sequelize_1.DataTypes.STRING,
        allowNull: false,
        defaultValue: '考试平台',
    },
    welcomeMessage: {
        type: sequelize_1.DataTypes.TEXT,
        allowNull: false,
        defaultValue: '欢迎使用我们的考试平台！',
    },
    footerText: {
        type: sequelize_1.DataTypes.STRING,
        allowNull: false,
        defaultValue: '© 2024 考试平台 版权所有',
    },
}, {
    sequelize: database_1.default,
    tableName: 'homepage_settings',
    modelName: 'HomepageSettings',
});
exports.default = HomepageSettings;
