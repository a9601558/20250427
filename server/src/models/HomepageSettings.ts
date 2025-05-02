import { Model, DataTypes } from 'sequelize';
import sequelize from '../config/database';

interface HomepageSettingsAttributes {
  id?: number;
  featuredCategories: string[];
  siteTitle: string;
  welcomeMessage: string;
  footerText: string;
  createdAt?: Date;
  updatedAt?: Date;
}

export class HomepageSettings extends Model<HomepageSettingsAttributes> implements HomepageSettingsAttributes {
  public id!: number;
  public featuredCategories!: string[];
  public siteTitle!: string;
  public welcomeMessage!: string;
  public footerText!: string;
  public readonly createdAt!: Date;
  public readonly updatedAt!: Date;
}

HomepageSettings.init(
  {
    id: {
      type: DataTypes.INTEGER,
      autoIncrement: true,
      primaryKey: true,
    },
    featuredCategories: {
      type: DataTypes.JSON,
      allowNull: false,
      defaultValue: [],
    },
    siteTitle: {
      type: DataTypes.STRING,
      allowNull: false,
      defaultValue: '考试平台',
    },
    welcomeMessage: {
      type: DataTypes.TEXT,
      allowNull: false,
      defaultValue: '欢迎使用我们的考试平台！',
    },
    footerText: {
      type: DataTypes.STRING,
      allowNull: false,
      defaultValue: '© 2024 考试平台 版权所有',
    },
  },
  {
    sequelize,
    tableName: 'homepage_settings',
    modelName: 'HomepageSettings',
  }
);

export default HomepageSettings; 
