'use strict';

/**
 * Script to forcefully create all required database tables
 * 
 * This script bypasses migrations and directly creates all tables
 * from model definitions. Use this when migrations are failing.
 * 
 * Usage: node src/scripts/deploy-database.js
 */

const path = require('path');
const fs = require('fs');
const { Sequelize, DataTypes } = require('sequelize');
const dotenv = require('dotenv');

// Log formatting
const colors = {
  reset: '\x1b[0m',
  red: '\x1b[31m',
  green: '\x1b[32m',
  yellow: '\x1b[33m',
  blue: '\x1b[34m',
  magenta: '\x1b[35m',
  cyan: '\x1b[36m'
};

console.log(`${colors.blue}==== Database Deployment Tool ====${colors.reset}\n`);

// Load environment variables
const envPath = path.resolve(__dirname, '../../.env');
if (fs.existsSync(envPath)) {
  console.log(`Loading environment variables from: ${colors.cyan}${envPath}${colors.reset}`);
  dotenv.config({ path: envPath });
} else {
  console.log(`${colors.yellow}No .env file found, using default environment variables${colors.reset}`);
  dotenv.config();
}

// Database configuration
const dbConfig = {
  host: process.env.DB_HOST || 'localhost',
  port: parseInt(process.env.DB_PORT || '3306', 10),
  username: process.env.DB_USER || 'root',
  password: process.env.DB_PASSWORD || '',
  database: process.env.DB_NAME || 'quiz_app',
  dialect: 'mysql',
};

console.log(`\nDatabase connection information:`);
console.log(`- Host: ${colors.cyan}${dbConfig.host}:${dbConfig.port}${colors.reset}`);
console.log(`- Database: ${colors.cyan}${dbConfig.database}${colors.reset}`);
console.log(`- User: ${colors.cyan}${dbConfig.username}${colors.reset}`);

// Initialize sequelize
const sequelize = new Sequelize(
  dbConfig.database,
  dbConfig.username,
  dbConfig.password,
  {
    host: dbConfig.host,
    port: dbConfig.port,
    dialect: 'mysql',
    logging: msg => console.log(`${colors.yellow}[SQL] ${colors.reset}${msg}`),
  }
);

// Define all models

// User model
const User = sequelize.define('User', {
  id: {
    type: DataTypes.UUID,
    primaryKey: true,
    defaultValue: DataTypes.UUIDV4,
    allowNull: false
  },
  username: {
    type: DataTypes.STRING(100),
    allowNull: false,
    unique: true
  },
  password: {
    type: DataTypes.STRING(255),
    allowNull: false
  },
  email: {
    type: DataTypes.STRING(255),
    allowNull: true,
    unique: true
  },
  isAdmin: {
    type: DataTypes.BOOLEAN,
    defaultValue: false,
    allowNull: false
  },
  last_login: {
    type: DataTypes.DATE,
    allowNull: true
  },
  is_active: {
    type: DataTypes.BOOLEAN,
    defaultValue: true,
    allowNull: false
  }
}, {
  tableName: 'users',
  timestamps: true,
  underscored: true
});

// QuestionSet model
const QuestionSet = sequelize.define('QuestionSet', {
  id: {
    type: DataTypes.UUID,
    primaryKey: true,
    defaultValue: DataTypes.UUIDV4,
    allowNull: false
  },
  title: {
    type: DataTypes.STRING(255),
    allowNull: false
  },
  description: {
    type: DataTypes.TEXT,
    allowNull: true
  },
  category: {
    type: DataTypes.STRING(100),
    allowNull: true
  },
  difficulty: {
    type: DataTypes.INTEGER,
    allowNull: true
  },
  price: {
    type: DataTypes.DECIMAL(10, 2),
    allowNull: true,
    defaultValue: 0
  },
  is_public: {
    type: DataTypes.BOOLEAN,
    defaultValue: false,
    allowNull: false
  },
  is_active: {
    type: DataTypes.BOOLEAN,
    defaultValue: true,
    allowNull: false
  }
}, {
  tableName: 'question_sets',
  timestamps: true,
  underscored: true
});

// Question model
const Question = sequelize.define('Question', {
  id: {
    type: DataTypes.UUID,
    primaryKey: true,
    defaultValue: DataTypes.UUIDV4,
    allowNull: false
  },
  question_set_id: {
    type: DataTypes.UUID,
    allowNull: false,
    references: {
      model: 'question_sets',
      key: 'id'
    },
    onUpdate: 'CASCADE',
    onDelete: 'CASCADE'
  },
  text: {
    type: DataTypes.TEXT,
    allowNull: false
  },
  question_type: {
    type: DataTypes.STRING(50),
    allowNull: false
  },
  explanation: {
    type: DataTypes.TEXT,
    allowNull: true
  },
  order_index: {
    type: DataTypes.INTEGER,
    allowNull: true,
    defaultValue: 0
  },
  difficulty: {
    type: DataTypes.INTEGER,
    allowNull: true
  },
  points: {
    type: DataTypes.INTEGER,
    allowNull: true
  },
  time_limit: {
    type: DataTypes.INTEGER,
    allowNull: true
  },
  metadata: {
    type: DataTypes.TEXT,
    allowNull: true,
    comment: 'JSON metadata for storing additional question information'
  }
}, {
  tableName: 'questions',
  timestamps: true,
  underscored: true
});

// Option model
const Option = sequelize.define('Option', {
  id: {
    type: DataTypes.UUID,
    primaryKey: true,
    defaultValue: DataTypes.UUIDV4,
    allowNull: false
  },
  question_id: {
    type: DataTypes.UUID,
    allowNull: false,
    references: {
      model: 'questions',
      key: 'id'
    },
    onUpdate: 'CASCADE',
    onDelete: 'CASCADE'
  },
  text: {
    type: DataTypes.TEXT,
    allowNull: false
  },
  is_correct: {
    type: DataTypes.BOOLEAN,
    allowNull: false,
    defaultValue: false
  },
  explanation: {
    type: DataTypes.TEXT,
    allowNull: true
  },
  order_index: {
    type: DataTypes.INTEGER,
    allowNull: true
  }
}, {
  tableName: 'options',
  timestamps: true,
  underscored: true
});

// UserProgress model
const UserProgress = sequelize.define('UserProgress', {
  id: {
    type: DataTypes.UUID,
    primaryKey: true,
    defaultValue: DataTypes.UUIDV4,
    allowNull: false
  },
  user_id: {
    type: DataTypes.UUID,
    allowNull: false,
    references: {
      model: 'users',
      key: 'id'
    },
    onUpdate: 'CASCADE',
    onDelete: 'CASCADE'
  },
  question_set_id: {
    type: DataTypes.UUID,
    allowNull: false,
    references: {
      model: 'question_sets',
      key: 'id'
    },
    onUpdate: 'CASCADE',
    onDelete: 'CASCADE'
  },
  question_id: {
    type: DataTypes.UUID,
    allowNull: true,
    references: {
      model: 'questions',
      key: 'id'
    },
    onUpdate: 'CASCADE',
    onDelete: 'SET NULL'
  },
  is_correct: {
    type: DataTypes.BOOLEAN,
    allowNull: true
  },
  time_spent: {
    type: DataTypes.INTEGER,
    allowNull: true,
    defaultValue: 0
  },
  completed_questions: {
    type: DataTypes.INTEGER,
    allowNull: true,
    defaultValue: 0
  },
  total_questions: {
    type: DataTypes.INTEGER,
    allowNull: true,
    defaultValue: 0
  },
  correct_answers: {
    type: DataTypes.INTEGER,
    allowNull: true,
    defaultValue: 0
  },
  last_question_index: {
    type: DataTypes.INTEGER,
    allowNull: true
  },
  metadata: {
    type: DataTypes.TEXT,
    allowNull: true
  },
  last_accessed: {
    type: DataTypes.DATE,
    allowNull: true
  }
}, {
  tableName: 'user_progress',
  timestamps: true,
  underscored: true
});

// Purchase model
const Purchase = sequelize.define('Purchase', {
  id: {
    type: DataTypes.UUID,
    primaryKey: true,
    defaultValue: DataTypes.UUIDV4,
    allowNull: false
  },
  user_id: {
    type: DataTypes.UUID,
    allowNull: false,
    references: {
      model: 'users',
      key: 'id'
    },
    onUpdate: 'CASCADE',
    onDelete: 'CASCADE'
  },
  question_set_id: {
    type: DataTypes.UUID,
    allowNull: false,
    references: {
      model: 'question_sets',
      key: 'id'
    },
    onUpdate: 'CASCADE',
    onDelete: 'CASCADE'
  },
  purchase_date: {
    type: DataTypes.DATE,
    allowNull: false,
    defaultValue: DataTypes.NOW
  },
  expiry_date: {
    type: DataTypes.DATE,
    allowNull: true
  },
  amount: {
    type: DataTypes.DECIMAL(10, 2),
    allowNull: false
  },
  payment_method: {
    type: DataTypes.STRING(50),
    allowNull: true
  },
  transaction_id: {
    type: DataTypes.STRING(255),
    allowNull: true
  },
  is_active: {
    type: DataTypes.BOOLEAN,
    defaultValue: true,
    allowNull: false
  }
}, {
  tableName: 'purchases',
  timestamps: true,
  underscored: true
});

// RedeemCode model
const RedeemCode = sequelize.define('RedeemCode', {
  id: {
    type: DataTypes.UUID,
    primaryKey: true,
    defaultValue: DataTypes.UUIDV4,
    allowNull: false
  },
  code: {
    type: DataTypes.STRING(50),
    allowNull: false,
    unique: true
  },
  question_set_id: {
    type: DataTypes.UUID,
    allowNull: false,
    references: {
      model: 'question_sets',
      key: 'id'
    },
    onUpdate: 'CASCADE',
    onDelete: 'CASCADE'
  },
  user_id: {
    type: DataTypes.UUID,
    allowNull: true,
    references: {
      model: 'users',
      key: 'id'
    },
    onUpdate: 'CASCADE',
    onDelete: 'SET NULL'
  },
  expiry_date: {
    type: DataTypes.DATE,
    allowNull: true
  },
  is_used: {
    type: DataTypes.BOOLEAN,
    defaultValue: false,
    allowNull: false
  },
  redeemed_at: {
    type: DataTypes.DATE,
    allowNull: true
  }
}, {
  tableName: 'redeem_codes',
  timestamps: true,
  underscored: true
});

// WrongAnswer model
const WrongAnswer = sequelize.define('WrongAnswer', {
  id: {
    type: DataTypes.UUID,
    primaryKey: true,
    defaultValue: DataTypes.UUIDV4,
    allowNull: false
  },
  user_id: {
    type: DataTypes.UUID,
    allowNull: false,
    references: {
      model: 'users',
      key: 'id'
    },
    onUpdate: 'CASCADE',
    onDelete: 'CASCADE'
  },
  question_id: {
    type: DataTypes.UUID,
    allowNull: false,
    references: {
      model: 'questions',
      key: 'id'
    },
    onUpdate: 'CASCADE',
    onDelete: 'CASCADE'
  },
  selected_option_id: {
    type: DataTypes.UUID,
    allowNull: true,
    references: {
      model: 'options',
      key: 'id'
    },
    onUpdate: 'CASCADE',
    onDelete: 'SET NULL'
  },
  attempt_count: {
    type: DataTypes.INTEGER,
    allowNull: false,
    defaultValue: 1
  },
  last_attempt_date: {
    type: DataTypes.DATE,
    allowNull: false,
    defaultValue: DataTypes.NOW
  }
}, {
  tableName: 'wrong_answers',
  timestamps: true,
  underscored: true
});

// HomepageSettings model
const HomepageSettings = sequelize.define('HomepageSettings', {
  id: {
    type: DataTypes.INTEGER,
    primaryKey: true,
    autoIncrement: true,
    allowNull: false
  },
  welcome_title: {
    type: DataTypes.STRING(255),
    allowNull: false,
    defaultValue: 'ExamTopics Practice'
  },
  welcome_description: {
    type: DataTypes.TEXT,
    allowNull: false,
    defaultValue: 'Choose any of the following question sets to practice and test your knowledge'
  },
  featured_categories: {
    type: DataTypes.TEXT,
    allowNull: true,
    defaultValue: JSON.stringify(['Network Protocols', 'Programming Languages', 'Computer Basics'])
  },
  announcements: {
    type: DataTypes.TEXT,
    allowNull: true,
    defaultValue: 'Welcome to the online quiz system. New question sets will be updated regularly!'
  },
  footer_text: {
    type: DataTypes.STRING(255),
    allowNull: true,
    defaultValue: '© 2023 ExamTopics Online Quiz System. All rights reserved.'
  },
  banner_image: {
    type: DataTypes.STRING(255),
    allowNull: true,
    defaultValue: '/images/banner.jpg'
  },
  theme: {
    type: DataTypes.STRING(50),
    allowNull: true,
    defaultValue: 'light'
  }
}, {
  tableName: 'homepage_settings',
  timestamps: true,
  underscored: true
});

// Define associations
Question.belongsTo(QuestionSet, { foreignKey: 'question_set_id', onDelete: 'CASCADE' });
QuestionSet.hasMany(Question, { foreignKey: 'question_set_id', as: 'questions' });

Option.belongsTo(Question, { foreignKey: 'question_id', onDelete: 'CASCADE' });
Question.hasMany(Option, { foreignKey: 'question_id', as: 'options' });

UserProgress.belongsTo(User, { foreignKey: 'user_id' });
UserProgress.belongsTo(QuestionSet, { foreignKey: 'question_set_id', as: 'progressQuestionSet' });
UserProgress.belongsTo(Question, { foreignKey: 'question_id', as: 'question' });

User.hasMany(UserProgress, { foreignKey: 'user_id', as: 'progress' });
QuestionSet.hasMany(UserProgress, { foreignKey: 'question_set_id', as: 'userProgress' });
Question.hasMany(UserProgress, { foreignKey: 'question_id', as: 'userAnswers' });

Purchase.belongsTo(User, { foreignKey: 'user_id' });
Purchase.belongsTo(QuestionSet, { foreignKey: 'question_set_id', as: 'purchaseQuestionSet' });

User.hasMany(Purchase, { foreignKey: 'user_id', as: 'purchases' });
QuestionSet.hasMany(Purchase, { foreignKey: 'question_set_id', as: 'purchases' });

RedeemCode.belongsTo(User, { foreignKey: 'user_id' });
RedeemCode.belongsTo(QuestionSet, { foreignKey: 'question_set_id', as: 'codeQuestionSet' });

User.hasMany(RedeemCode, { foreignKey: 'user_id', as: 'redeemedCodes' });
QuestionSet.hasMany(RedeemCode, { foreignKey: 'question_set_id', as: 'redeemedCodes' });

WrongAnswer.belongsTo(User, { foreignKey: 'user_id' });
WrongAnswer.belongsTo(Question, { foreignKey: 'question_id' });
WrongAnswer.belongsTo(Option, { foreignKey: 'selected_option_id', as: 'selectedOption' });

// Create SequelizeMeta table
const SequelizeMeta = sequelize.define('SequelizeMeta', {
  name: {
    type: DataTypes.STRING,
    allowNull: false,
    unique: true,
    primaryKey: true
  }
}, {
  tableName: 'SequelizeMeta',
  timestamps: false
});

// Main function
async function deployDatabase() {
  try {
    // Test database connection
    await sequelize.authenticate();
    console.log(`${colors.green}✓ Database connection successful!${colors.reset}`);
    
    // Get existing tables
    const existingTables = await sequelize.getQueryInterface().showAllTables();
    console.log(`\nExisting tables: ${colors.cyan}${existingTables.join(', ')}${colors.reset}`);
    
    // Force sync all models
    console.log(`\n${colors.yellow}Starting database sync...${colors.reset}`);
    
    // Create tables one by one in the correct order to handle dependencies
    const tables = [
      { model: User, name: 'users' },
      { model: QuestionSet, name: 'question_sets' },
      { model: Question, name: 'questions' },
      { model: Option, name: 'options' },
      { model: UserProgress, name: 'user_progress' },
      { model: Purchase, name: 'purchases' },
      { model: RedeemCode, name: 'redeem_codes' },
      { model: WrongAnswer, name: 'wrong_answers' },
      { model: HomepageSettings, name: 'homepage_settings' },
      { model: SequelizeMeta, name: 'SequelizeMeta' }
    ];
    
    for (const table of tables) {
      if (existingTables.includes(table.name)) {
        console.log(`${colors.blue}Table ${table.name} already exists, skipping${colors.reset}`);
      } else {
        console.log(`${colors.yellow}Creating table ${table.name}...${colors.reset}`);
        await table.model.sync();
        console.log(`${colors.green}✓ Table ${table.name} created${colors.reset}`);
      }
    }
    
    // Check if homepage_settings has data
    const homepageSettingsCount = await HomepageSettings.count();
    if (homepageSettingsCount === 0) {
      console.log(`${colors.yellow}No homepage settings found, creating default...${colors.reset}`);
      await HomepageSettings.create({
        id: 1,
        welcome_title: "ExamTopics 模拟练习",
        welcome_description: "选择以下任一题库开始练习，测试您的知识水平",
        featured_categories: JSON.stringify(["网络协议", "编程语言", "计算机基础"]),
        announcements: "欢迎使用在线题库系统，新增题库将定期更新，请持续关注！",
        footer_text: "© 2023 ExamTopics 在线题库系统 保留所有权利",
        banner_image: "/images/banner.jpg",
        theme: 'light'
      });
      console.log(`${colors.green}✓ Default homepage settings created${colors.reset}`);
    }
    
    // Record all migrations as completed in SequelizeMeta
    if (existingTables.includes('SequelizeMeta')) {
      console.log(`\n${colors.yellow}Checking migration records...${colors.reset}`);
      
      // Get all migration files
      const migrationsDir = path.resolve(__dirname, '../migrations');
      if (fs.existsSync(migrationsDir)) {
        const migrationFiles = fs.readdirSync(migrationsDir)
          .filter(file => file.endsWith('.js'))
          .sort();
        
        console.log(`Found ${colors.cyan}${migrationFiles.length}${colors.reset} migration files`);
        
        // Get existing migration records
        const existingMigrations = await SequelizeMeta.findAll({
          attributes: ['name']
        });
        const existingMigrationNames = existingMigrations.map(m => m.name);
        
        // Record missing migrations
        for (const file of migrationFiles) {
          if (!existingMigrationNames.includes(file)) {
            console.log(`${colors.yellow}Recording migration ${file}...${colors.reset}`);
            await SequelizeMeta.create({ name: file });
            console.log(`${colors.green}✓ Migration ${file} recorded${colors.reset}`);
          }
        }
      }
    }
    
    console.log(`\n${colors.green}✓ Database deployment completed successfully${colors.reset}`);
    process.exit(0);
  } catch (error) {
    console.error(`\n${colors.red}Database deployment failed:${colors.reset}`, error);
    process.exit(1);
  }
}

// Run the deployment
deployDatabase(); 