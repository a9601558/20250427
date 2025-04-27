import { Model, DataTypes } from 'sequelize';
import { sequelize } from '../config/db';

class HomepageSettings extends Model {
  public id!: number;
  public welcome_title!: string;
  public welcome_description!: string;
  public featured_categories!: string[] | null;
  public announcements!: string;
  public footer_text!: string;
  public banner_image!: string | null;
  public theme!: 'light' | 'dark' | 'auto';
  public readonly created_at!: Date;
  public readonly updated_at!: Date;
}

HomepageSettings.init(
  {
    id: {
      type: DataTypes.INTEGER,
      primaryKey: true,
      defaultValue: 1
    },
    welcome_title: {
      type: DataTypes.STRING(255),
      allowNull: false
    },
    welcome_description: {
      type: DataTypes.TEXT,
      allowNull: false
    },
    featured_categories: {
      type: DataTypes.TEXT,
      allowNull: true,
      get() {
        const rawValue = this.getDataValue('featured_categories');
        return rawValue ? JSON.parse(rawValue) : [];
      },
      set(value: string[]) {
        this.setDataValue('featured_categories', JSON.stringify(value));
      }
    },
    announcements: {
      type: DataTypes.TEXT,
      allowNull: true
    },
    footer_text: {
      type: DataTypes.TEXT,
      allowNull: true
    },
    banner_image: {
      type: DataTypes.STRING(255),
      allowNull: true
    },
    theme: {
      type: DataTypes.STRING(50),
      allowNull: true,
      defaultValue: 'light' as const
    }
  },
  {
    sequelize,
    modelName: 'HomepageSettings',
    tableName: 'homepage_settings',
    underscored: true,
    timestamps: true,
    createdAt: 'created_at',
    updatedAt: 'updated_at'
  }
);

export default HomepageSettings; 