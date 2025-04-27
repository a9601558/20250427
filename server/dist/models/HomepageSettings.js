"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const sequelize_1 = require("sequelize");
const db_1 = require("../config/db");
class HomepageSettings extends sequelize_1.Model {
}
HomepageSettings.init({
    id: {
        type: sequelize_1.DataTypes.INTEGER,
        primaryKey: true,
        defaultValue: 1
    },
    welcome_title: {
        type: sequelize_1.DataTypes.STRING(255),
        allowNull: false
    },
    welcome_description: {
        type: sequelize_1.DataTypes.TEXT,
        allowNull: false
    },
    featured_categories: {
        type: sequelize_1.DataTypes.TEXT,
        allowNull: true,
        get() {
            const rawValue = this.getDataValue('featured_categories');
            return rawValue ? JSON.parse(rawValue) : [];
        },
        set(value) {
            this.setDataValue('featured_categories', JSON.stringify(value));
        }
    },
    announcements: {
        type: sequelize_1.DataTypes.TEXT,
        allowNull: true
    },
    footer_text: {
        type: sequelize_1.DataTypes.TEXT,
        allowNull: true
    },
    banner_image: {
        type: sequelize_1.DataTypes.STRING(255),
        allowNull: true
    },
    theme: {
        type: sequelize_1.DataTypes.STRING(50),
        allowNull: true,
        defaultValue: 'light'
    }
}, {
    sequelize: db_1.sequelize,
    modelName: 'HomepageSettings',
    tableName: 'homepage_settings',
    underscored: true,
    timestamps: true,
    createdAt: 'created_at',
    updatedAt: 'updated_at'
});
exports.default = HomepageSettings;
