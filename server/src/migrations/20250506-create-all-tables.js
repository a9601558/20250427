'use strict';

/**
 * Master migration script to ensure all tables exist in the database
 */
module.exports = {
  async up(queryInterface, Sequelize) {
    try {
      console.log('Starting full database migration process...');
      
      // Get list of existing tables
      const existingTables = await queryInterface.showAllTables();
      console.log('Existing tables:', existingTables);
      
      // Create users table if it doesn't exist
      if (!existingTables.includes('users')) {
        console.log('Creating users table...');
        await queryInterface.createTable('users', {
          id: {
            type: Sequelize.UUID,
            primaryKey: true,
            defaultValue: Sequelize.UUIDV4,
            allowNull: false
          },
          username: {
            type: Sequelize.STRING(100),
            allowNull: false,
            unique: true
          },
          password: {
            type: Sequelize.STRING(255),
            allowNull: false
          },
          email: {
            type: Sequelize.STRING(255),
            allowNull: true,
            unique: true
          },
          role: {
            type: Sequelize.ENUM('user', 'admin'),
            defaultValue: 'user',
            allowNull: false
          },
          last_login: {
            type: Sequelize.DATE,
            allowNull: true
          },
          is_active: {
            type: Sequelize.BOOLEAN,
            defaultValue: true,
            allowNull: false
          },
          created_at: {
            type: Sequelize.DATE,
            allowNull: false,
            defaultValue: Sequelize.literal('CURRENT_TIMESTAMP')
          },
          updated_at: {
            type: Sequelize.DATE,
            allowNull: false,
            defaultValue: Sequelize.literal('CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP')
          }
        });
        console.log('Users table created successfully');
      }
      
      // Create question_sets table if it doesn't exist
      if (!existingTables.includes('question_sets')) {
        console.log('Creating question_sets table...');
        await queryInterface.createTable('question_sets', {
          id: {
            type: Sequelize.UUID,
            primaryKey: true,
            defaultValue: Sequelize.UUIDV4,
            allowNull: false
          },
          title: {
            type: Sequelize.STRING(255),
            allowNull: false
          },
          description: {
            type: Sequelize.TEXT,
            allowNull: true
          },
          category: {
            type: Sequelize.STRING(100),
            allowNull: true
          },
          difficulty: {
            type: Sequelize.INTEGER,
            allowNull: true
          },
          price: {
            type: Sequelize.DECIMAL(10, 2),
            allowNull: true,
            defaultValue: 0
          },
          is_public: {
            type: Sequelize.BOOLEAN,
            defaultValue: false,
            allowNull: false
          },
          is_active: {
            type: Sequelize.BOOLEAN,
            defaultValue: true,
            allowNull: false
          },
          created_at: {
            type: Sequelize.DATE,
            allowNull: false,
            defaultValue: Sequelize.literal('CURRENT_TIMESTAMP')
          },
          updated_at: {
            type: Sequelize.DATE,
            allowNull: false,
            defaultValue: Sequelize.literal('CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP')
          }
        });
        console.log('Question_sets table created successfully');
      }
      
      // Create questions table if it doesn't exist
      if (!existingTables.includes('questions')) {
        console.log('Creating questions table...');
        await queryInterface.createTable('questions', {
          id: {
            type: Sequelize.UUID,
            primaryKey: true,
            defaultValue: Sequelize.UUIDV4,
            allowNull: false
          },
          question_set_id: {
            type: Sequelize.UUID,
            allowNull: false,
            references: {
              model: 'question_sets',
              key: 'id'
            },
            onUpdate: 'CASCADE',
            onDelete: 'CASCADE'
          },
          text: {
            type: Sequelize.TEXT,
            allowNull: false
          },
          question_type: {
            type: Sequelize.STRING(50),
            allowNull: false
          },
          explanation: {
            type: Sequelize.TEXT,
            allowNull: true
          },
          order_index: {
            type: Sequelize.INTEGER,
            allowNull: true,
            defaultValue: 0
          },
          difficulty: {
            type: Sequelize.INTEGER,
            allowNull: true
          },
          points: {
            type: Sequelize.INTEGER,
            allowNull: true
          },
          time_limit: {
            type: Sequelize.INTEGER,
            allowNull: true
          },
          metadata: {
            type: Sequelize.TEXT,
            allowNull: true,
            comment: 'JSON metadata for storing additional question information'
          },
          created_at: {
            type: Sequelize.DATE,
            allowNull: false,
            defaultValue: Sequelize.literal('CURRENT_TIMESTAMP')
          },
          updated_at: {
            type: Sequelize.DATE,
            allowNull: false,
            defaultValue: Sequelize.literal('CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP')
          }
        });
        console.log('Questions table created successfully');
      }
      
      // Create options table if it doesn't exist
      if (!existingTables.includes('options')) {
        console.log('Creating options table...');
        await queryInterface.createTable('options', {
          id: {
            type: Sequelize.UUID,
            primaryKey: true,
            defaultValue: Sequelize.UUIDV4,
            allowNull: false
          },
          question_id: {
            type: Sequelize.UUID,
            allowNull: false,
            references: {
              model: 'questions',
              key: 'id'
            },
            onUpdate: 'CASCADE',
            onDelete: 'CASCADE'
          },
          text: {
            type: Sequelize.TEXT,
            allowNull: false
          },
          is_correct: {
            type: Sequelize.BOOLEAN,
            allowNull: false,
            defaultValue: false
          },
          explanation: {
            type: Sequelize.TEXT,
            allowNull: true
          },
          order_index: {
            type: Sequelize.INTEGER,
            allowNull: true
          },
          created_at: {
            type: Sequelize.DATE,
            allowNull: false,
            defaultValue: Sequelize.literal('CURRENT_TIMESTAMP')
          },
          updated_at: {
            type: Sequelize.DATE,
            allowNull: false,
            defaultValue: Sequelize.literal('CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP')
          }
        });
        console.log('Options table created successfully');
      }
      
      // Create user_progress table if it doesn't exist
      if (!existingTables.includes('user_progress')) {
        console.log('Creating user_progress table...');
        await queryInterface.createTable('user_progress', {
          id: {
            type: Sequelize.UUID,
            primaryKey: true,
            defaultValue: Sequelize.UUIDV4,
            allowNull: false
          },
          user_id: {
            type: Sequelize.UUID,
            allowNull: false,
            references: {
              model: 'users',
              key: 'id'
            },
            onUpdate: 'CASCADE',
            onDelete: 'CASCADE'
          },
          question_set_id: {
            type: Sequelize.UUID,
            allowNull: false,
            references: {
              model: 'question_sets',
              key: 'id'
            },
            onUpdate: 'CASCADE',
            onDelete: 'CASCADE'
          },
          question_id: {
            type: Sequelize.UUID,
            allowNull: true,
            references: {
              model: 'questions',
              key: 'id'
            },
            onUpdate: 'CASCADE',
            onDelete: 'SET NULL'
          },
          is_correct: {
            type: Sequelize.BOOLEAN,
            allowNull: true
          },
          time_spent: {
            type: Sequelize.INTEGER,
            allowNull: true,
            defaultValue: 0
          },
          completed_questions: {
            type: Sequelize.INTEGER,
            allowNull: true,
            defaultValue: 0
          },
          total_questions: {
            type: Sequelize.INTEGER,
            allowNull: true,
            defaultValue: 0
          },
          correct_answers: {
            type: Sequelize.INTEGER,
            allowNull: true,
            defaultValue: 0
          },
          last_question_index: {
            type: Sequelize.INTEGER,
            allowNull: true
          },
          metadata: {
            type: Sequelize.TEXT,
            allowNull: true
          },
          last_accessed: {
            type: Sequelize.DATE,
            allowNull: true
          },
          created_at: {
            type: Sequelize.DATE,
            allowNull: false,
            defaultValue: Sequelize.literal('CURRENT_TIMESTAMP')
          },
          updated_at: {
            type: Sequelize.DATE,
            allowNull: false,
            defaultValue: Sequelize.literal('CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP')
          }
        });
        console.log('User_progress table created successfully');
      }
      
      // Create purchases table if it doesn't exist
      if (!existingTables.includes('purchases')) {
        console.log('Creating purchases table...');
        await queryInterface.createTable('purchases', {
          id: {
            type: Sequelize.UUID,
            primaryKey: true,
            defaultValue: Sequelize.UUIDV4,
            allowNull: false
          },
          user_id: {
            type: Sequelize.UUID,
            allowNull: false,
            references: {
              model: 'users',
              key: 'id'
            },
            onUpdate: 'CASCADE',
            onDelete: 'CASCADE'
          },
          question_set_id: {
            type: Sequelize.UUID,
            allowNull: false,
            references: {
              model: 'question_sets',
              key: 'id'
            },
            onUpdate: 'CASCADE',
            onDelete: 'CASCADE'
          },
          purchase_date: {
            type: Sequelize.DATE,
            allowNull: false,
            defaultValue: Sequelize.literal('CURRENT_TIMESTAMP')
          },
          expiry_date: {
            type: Sequelize.DATE,
            allowNull: true
          },
          amount: {
            type: Sequelize.DECIMAL(10, 2),
            allowNull: false
          },
          payment_method: {
            type: Sequelize.STRING(50),
            allowNull: true
          },
          transaction_id: {
            type: Sequelize.STRING(255),
            allowNull: true
          },
          is_active: {
            type: Sequelize.BOOLEAN,
            defaultValue: true,
            allowNull: false
          },
          created_at: {
            type: Sequelize.DATE,
            allowNull: false,
            defaultValue: Sequelize.literal('CURRENT_TIMESTAMP')
          },
          updated_at: {
            type: Sequelize.DATE,
            allowNull: false,
            defaultValue: Sequelize.literal('CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP')
          }
        });
        console.log('Purchases table created successfully');
      }
      
      // Create redeem_codes table if it doesn't exist
      if (!existingTables.includes('redeem_codes')) {
        console.log('Creating redeem_codes table...');
        await queryInterface.createTable('redeem_codes', {
          id: {
            type: Sequelize.UUID,
            primaryKey: true,
            defaultValue: Sequelize.UUIDV4,
            allowNull: false
          },
          code: {
            type: Sequelize.STRING(50),
            allowNull: false,
            unique: true
          },
          question_set_id: {
            type: Sequelize.UUID,
            allowNull: false,
            references: {
              model: 'question_sets',
              key: 'id'
            },
            onUpdate: 'CASCADE',
            onDelete: 'CASCADE'
          },
          user_id: {
            type: Sequelize.UUID,
            allowNull: true,
            references: {
              model: 'users',
              key: 'id'
            },
            onUpdate: 'CASCADE',
            onDelete: 'SET NULL'
          },
          expiry_date: {
            type: Sequelize.DATE,
            allowNull: true
          },
          is_used: {
            type: Sequelize.BOOLEAN,
            defaultValue: false,
            allowNull: false
          },
          redeemed_at: {
            type: Sequelize.DATE,
            allowNull: true
          },
          created_at: {
            type: Sequelize.DATE,
            allowNull: false,
            defaultValue: Sequelize.literal('CURRENT_TIMESTAMP')
          },
          updated_at: {
            type: Sequelize.DATE,
            allowNull: false,
            defaultValue: Sequelize.literal('CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP')
          }
        });
        console.log('Redeem_codes table created successfully');
      }
      
      // Create wrong_answers table if it doesn't exist
      if (!existingTables.includes('wrong_answers')) {
        console.log('Creating wrong_answers table...');
        await queryInterface.createTable('wrong_answers', {
          id: {
            type: Sequelize.UUID,
            primaryKey: true,
            defaultValue: Sequelize.UUIDV4,
            allowNull: false
          },
          user_id: {
            type: Sequelize.UUID,
            allowNull: false,
            references: {
              model: 'users',
              key: 'id'
            },
            onUpdate: 'CASCADE',
            onDelete: 'CASCADE'
          },
          question_id: {
            type: Sequelize.UUID,
            allowNull: false,
            references: {
              model: 'questions',
              key: 'id'
            },
            onUpdate: 'CASCADE',
            onDelete: 'CASCADE'
          },
          selected_option_id: {
            type: Sequelize.UUID,
            allowNull: true,
            references: {
              model: 'options',
              key: 'id'
            },
            onUpdate: 'CASCADE',
            onDelete: 'SET NULL'
          },
          attempt_count: {
            type: Sequelize.INTEGER,
            allowNull: false,
            defaultValue: 1
          },
          last_attempt_date: {
            type: Sequelize.DATE,
            allowNull: false,
            defaultValue: Sequelize.literal('CURRENT_TIMESTAMP')
          },
          created_at: {
            type: Sequelize.DATE,
            allowNull: false,
            defaultValue: Sequelize.literal('CURRENT_TIMESTAMP')
          },
          updated_at: {
            type: Sequelize.DATE,
            allowNull: false,
            defaultValue: Sequelize.literal('CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP')
          }
        });
        console.log('Wrong_answers table created successfully');
      }
      
      // Create homepage_settings table if it doesn't exist
      if (!existingTables.includes('homepage_settings')) {
        console.log('Creating homepage_settings table...');
        await queryInterface.createTable('homepage_settings', {
          id: {
            type: Sequelize.INTEGER,
            primaryKey: true,
            autoIncrement: true,
            allowNull: false
          },
          welcome_title: {
            type: Sequelize.STRING(255),
            allowNull: false,
            defaultValue: 'ExamTopics Practice'
          },
          welcome_description: {
            type: Sequelize.TEXT,
            allowNull: false,
            defaultValue: 'Choose any of the following question sets to practice and test your knowledge'
          },
          featured_categories: {
            type: Sequelize.TEXT,
            allowNull: true,
            defaultValue: JSON.stringify(['Network Protocols', 'Programming Languages', 'Computer Basics'])
          },
          announcements: {
            type: Sequelize.TEXT,
            allowNull: true,
            defaultValue: 'Welcome to the online quiz system. New question sets will be updated regularly!'
          },
          footer_text: {
            type: Sequelize.STRING(255),
            allowNull: true,
            defaultValue: '© 2023 ExamTopics Online Quiz System. All rights reserved.'
          },
          banner_image: {
            type: Sequelize.STRING(255),
            allowNull: true,
            defaultValue: '/images/banner.jpg'
          },
          theme: {
            type: Sequelize.STRING(50),
            allowNull: true,
            defaultValue: 'light'
          },
          created_at: {
            type: Sequelize.DATE,
            allowNull: false,
            defaultValue: Sequelize.literal('CURRENT_TIMESTAMP')
          },
          updated_at: {
            type: Sequelize.DATE,
            allowNull: false,
            defaultValue: Sequelize.literal('CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP')
          }
        });
        
        // Insert initial homepage settings record
        await queryInterface.bulkInsert('homepage_settings', [{
          id: 1,
          welcome_title: "ExamTopics 模拟练习",
          welcome_description: "选择以下任一题库开始练习，测试您的知识水平",
          featured_categories: JSON.stringify(["网络协议", "编程语言", "计算机基础"]),
          announcements: "欢迎使用在线题库系统，新增题库将定期更新，请持续关注！",
          footer_text: "© 2023 ExamTopics 在线题库系统 保留所有权利",
          banner_image: "/images/banner.jpg",
          theme: 'light',
          created_at: new Date(),
          updated_at: new Date()
        }]);
        
        console.log('Homepage_settings table created and initialized successfully');
      }
      
      console.log('All tables created successfully');
      
    } catch (error) {
      console.error('Error in master migration script:', error);
      throw error;
    }
  },

  async down(queryInterface, Sequelize) {
    try {
      // This would drop all tables - use with caution!
      console.log('Reverting all tables is not implemented for safety reasons');
    } catch (error) {
      console.error('Error in down migration:', error);
      throw error;
    }
  }
}; 