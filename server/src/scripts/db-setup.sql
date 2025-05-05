-- Database setup script
-- Run this script as root user in MySQL client with: 
-- mysql -u root -p < db-setup.sql

-- Create database if not exists
CREATE DATABASE IF NOT EXISTS quizdb CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- Create or update user with proper privileges
CREATE USER IF NOT EXISTS 'quizuser'@'localhost' IDENTIFIED BY 'quizpassword';
GRANT ALL PRIVILEGES ON quizdb.* TO 'quizuser'@'localhost';
FLUSH PRIVILEGES;

USE quizdb;

-- Create SequelizeMeta table
CREATE TABLE IF NOT EXISTS `SequelizeMeta` (
  `name` VARCHAR(255) NOT NULL,
  PRIMARY KEY (`name`),
  UNIQUE INDEX `name_UNIQUE` (`name` ASC)
);

-- Create users table
CREATE TABLE IF NOT EXISTS `users` (
  `id` CHAR(36) NOT NULL,
  `username` VARCHAR(100) NOT NULL,
  `password` VARCHAR(255) NOT NULL,
  `email` VARCHAR(255) NULL,
  `isAdmin` BOOLEAN NOT NULL DEFAULT false,
  `last_login` DATETIME NULL,
  `is_active` TINYINT(1) NOT NULL DEFAULT 1,
  `created_at` DATETIME NOT NULL,
  `updated_at` DATETIME NOT NULL,
  PRIMARY KEY (`id`),
  UNIQUE INDEX `username_UNIQUE` (`username` ASC),
  UNIQUE INDEX `email_UNIQUE` (`email` ASC)
);

-- Create question_sets table
CREATE TABLE IF NOT EXISTS `question_sets` (
  `id` CHAR(36) NOT NULL,
  `title` VARCHAR(255) NOT NULL,
  `description` TEXT NULL,
  `category` VARCHAR(100) NULL,
  `difficulty` INT NULL,
  `price` DECIMAL(10,2) NULL DEFAULT 0,
  `is_public` TINYINT(1) NOT NULL DEFAULT 0,
  `is_active` TINYINT(1) NOT NULL DEFAULT 1,
  `created_at` DATETIME NOT NULL,
  `updated_at` DATETIME NOT NULL,
  PRIMARY KEY (`id`)
);

-- Create questions table
CREATE TABLE IF NOT EXISTS `questions` (
  `id` CHAR(36) NOT NULL,
  `question_set_id` CHAR(36) NOT NULL,
  `text` TEXT NOT NULL,
  `question_type` VARCHAR(50) NOT NULL,
  `explanation` TEXT NULL,
  `order_index` INT NULL DEFAULT 0,
  `difficulty` INT NULL,
  `points` INT NULL,
  `time_limit` INT NULL,
  `metadata` TEXT NULL COMMENT 'JSON metadata for storing additional question information',
  `created_at` DATETIME NOT NULL,
  `updated_at` DATETIME NOT NULL,
  PRIMARY KEY (`id`),
  INDEX `fk_questions_question_sets_idx` (`question_set_id` ASC),
  CONSTRAINT `fk_questions_question_sets`
    FOREIGN KEY (`question_set_id`)
    REFERENCES `question_sets` (`id`)
    ON DELETE CASCADE
    ON UPDATE CASCADE
);

-- Create options table
CREATE TABLE IF NOT EXISTS `options` (
  `id` CHAR(36) NOT NULL,
  `question_id` CHAR(36) NOT NULL,
  `text` TEXT NOT NULL,
  `is_correct` TINYINT(1) NOT NULL DEFAULT 0,
  `explanation` TEXT NULL,
  `order_index` INT NULL,
  `created_at` DATETIME NOT NULL,
  `updated_at` DATETIME NOT NULL,
  PRIMARY KEY (`id`),
  INDEX `fk_options_questions_idx` (`question_id` ASC),
  CONSTRAINT `fk_options_questions`
    FOREIGN KEY (`question_id`)
    REFERENCES `questions` (`id`)
    ON DELETE CASCADE
    ON UPDATE CASCADE
);

-- Create user_progress table
CREATE TABLE IF NOT EXISTS `user_progress` (
  `id` CHAR(36) NOT NULL,
  `user_id` CHAR(36) NOT NULL,
  `question_set_id` CHAR(36) NOT NULL,
  `question_id` CHAR(36) NULL,
  `is_correct` TINYINT(1) NULL,
  `time_spent` INT NULL DEFAULT 0,
  `completed_questions` INT NULL DEFAULT 0,
  `total_questions` INT NULL DEFAULT 0,
  `correct_answers` INT NULL DEFAULT 0,
  `last_question_index` INT NULL,
  `metadata` TEXT NULL,
  `last_accessed` DATETIME NULL,
  `created_at` DATETIME NOT NULL,
  `updated_at` DATETIME NOT NULL,
  PRIMARY KEY (`id`),
  INDEX `fk_user_progress_users_idx` (`user_id` ASC),
  INDEX `fk_user_progress_question_sets_idx` (`question_set_id` ASC),
  INDEX `fk_user_progress_questions_idx` (`question_id` ASC),
  CONSTRAINT `fk_user_progress_users`
    FOREIGN KEY (`user_id`)
    REFERENCES `users` (`id`)
    ON DELETE CASCADE
    ON UPDATE CASCADE,
  CONSTRAINT `fk_user_progress_question_sets`
    FOREIGN KEY (`question_set_id`)
    REFERENCES `question_sets` (`id`)
    ON DELETE CASCADE
    ON UPDATE CASCADE,
  CONSTRAINT `fk_user_progress_questions`
    FOREIGN KEY (`question_id`)
    REFERENCES `questions` (`id`)
    ON DELETE SET NULL
    ON UPDATE CASCADE
);

-- Create purchases table
CREATE TABLE IF NOT EXISTS `purchases` (
  `id` CHAR(36) NOT NULL,
  `user_id` CHAR(36) NOT NULL,
  `question_set_id` CHAR(36) NOT NULL,
  `purchase_date` DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  `expiry_date` DATETIME NULL,
  `amount` DECIMAL(10,2) NOT NULL,
  `payment_method` VARCHAR(50) NULL,
  `transaction_id` VARCHAR(255) NULL,
  `is_active` TINYINT(1) NOT NULL DEFAULT 1,
  `created_at` DATETIME NOT NULL,
  `updated_at` DATETIME NOT NULL,
  PRIMARY KEY (`id`),
  INDEX `fk_purchases_users_idx` (`user_id` ASC),
  INDEX `fk_purchases_question_sets_idx` (`question_set_id` ASC),
  CONSTRAINT `fk_purchases_users`
    FOREIGN KEY (`user_id`)
    REFERENCES `users` (`id`)
    ON DELETE CASCADE
    ON UPDATE CASCADE,
  CONSTRAINT `fk_purchases_question_sets`
    FOREIGN KEY (`question_set_id`)
    REFERENCES `question_sets` (`id`)
    ON DELETE CASCADE
    ON UPDATE CASCADE
);

-- Create redeem_codes table
CREATE TABLE IF NOT EXISTS `redeem_codes` (
  `id` CHAR(36) NOT NULL,
  `code` VARCHAR(50) NOT NULL,
  `question_set_id` CHAR(36) NOT NULL,
  `user_id` CHAR(36) NULL,
  `expiry_date` DATETIME NULL,
  `is_used` TINYINT(1) NOT NULL DEFAULT 0,
  `redeemed_at` DATETIME NULL,
  `created_at` DATETIME NOT NULL,
  `updated_at` DATETIME NOT NULL,
  PRIMARY KEY (`id`),
  UNIQUE INDEX `code_UNIQUE` (`code` ASC),
  INDEX `fk_redeem_codes_question_sets_idx` (`question_set_id` ASC),
  INDEX `fk_redeem_codes_users_idx` (`user_id` ASC),
  CONSTRAINT `fk_redeem_codes_question_sets`
    FOREIGN KEY (`question_set_id`)
    REFERENCES `question_sets` (`id`)
    ON DELETE CASCADE
    ON UPDATE CASCADE,
  CONSTRAINT `fk_redeem_codes_users`
    FOREIGN KEY (`user_id`)
    REFERENCES `users` (`id`)
    ON DELETE SET NULL
    ON UPDATE CASCADE
);

-- Create wrong_answers table
CREATE TABLE IF NOT EXISTS `wrong_answers` (
  `id` CHAR(36) NOT NULL,
  `user_id` CHAR(36) NOT NULL,
  `question_id` CHAR(36) NOT NULL,
  `selected_option_id` CHAR(36) NULL,
  `attempt_count` INT NOT NULL DEFAULT 1,
  `last_attempt_date` DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  `created_at` DATETIME NOT NULL,
  `updated_at` DATETIME NOT NULL,
  PRIMARY KEY (`id`),
  INDEX `fk_wrong_answers_users_idx` (`user_id` ASC),
  INDEX `fk_wrong_answers_questions_idx` (`question_id` ASC),
  INDEX `fk_wrong_answers_options_idx` (`selected_option_id` ASC),
  CONSTRAINT `fk_wrong_answers_users`
    FOREIGN KEY (`user_id`)
    REFERENCES `users` (`id`)
    ON DELETE CASCADE
    ON UPDATE CASCADE,
  CONSTRAINT `fk_wrong_answers_questions`
    FOREIGN KEY (`question_id`)
    REFERENCES `questions` (`id`)
    ON DELETE CASCADE
    ON UPDATE CASCADE,
  CONSTRAINT `fk_wrong_answers_options`
    FOREIGN KEY (`selected_option_id`)
    REFERENCES `options` (`id`)
    ON DELETE SET NULL
    ON UPDATE CASCADE
);

-- Create homepage_settings table
CREATE TABLE IF NOT EXISTS `homepage_settings` (
  `id` INT NOT NULL AUTO_INCREMENT,
  `welcome_title` VARCHAR(255) NOT NULL DEFAULT 'ExamTopics Practice',
  `welcome_description` TEXT NOT NULL DEFAULT 'Choose any of the following question sets to practice and test your knowledge',
  `featured_categories` TEXT NULL DEFAULT '[\"Network Protocols\", \"Programming Languages\", \"Computer Basics\"]',
  `announcements` TEXT NULL DEFAULT 'Welcome to the online quiz system. New question sets will be updated regularly!',
  `footer_text` VARCHAR(255) NULL DEFAULT '© 2023 ExamTopics Online Quiz System. All rights reserved.',
  `banner_image` VARCHAR(255) NULL DEFAULT '/images/banner.jpg',
  `theme` VARCHAR(50) NULL DEFAULT 'light',
  `created_at` DATETIME NOT NULL,
  `updated_at` DATETIME NOT NULL,
  PRIMARY KEY (`id`)
);

-- Insert default homepage settings if not exists
INSERT INTO `homepage_settings` (`id`, `welcome_title`, `welcome_description`, `featured_categories`, `announcements`, `footer_text`, `banner_image`, `theme`, `created_at`, `updated_at`)
SELECT 1, 'ExamTopics 模拟练习', '选择以下任一题库开始练习，测试您的知识水平', '[\"网络协议\", \"编程语言\", \"计算机基础\"]', '欢迎使用在线题库系统，新增题库将定期更新，请持续关注！', '© 2023 ExamTopics 在线题库系统 保留所有权利', '/images/banner.jpg', 'light', NOW(), NOW()
FROM dual
WHERE NOT EXISTS (SELECT 1 FROM `homepage_settings` WHERE `id` = 1);

-- Mark all migrations as complete
INSERT INTO `SequelizeMeta` (`name`) VALUES
('20240326000000-create-users.js'),
('20240326000001-create-question-sets.js'),
('20240326000002-create-questions.js'),
('20240326000003-create-options.js'),
('20240326000004-create-user-progress.js'),
('20240326000005-create-purchases.js'),
('20240326000006-create-redeem-codes.js'),
('20240326000007-create-wrong-answers.js'),
('20240326000008-create-homepage-settings.js'),
('20240427000000-remove-deprecated-progress-fields.js'),
('20240505-add-metadata-to-questions.js'),
('20250509-add-isAdmin-to-users.js'),
('20250510-remove-role-from-users.js')
ON DUPLICATE KEY UPDATE `name`=VALUES(`name`);

-- Display completed tables
SELECT CONCAT('Table "', TABLE_NAME, '" successfully created') as 'Setup Complete'
FROM INFORMATION_SCHEMA.TABLES
WHERE TABLE_SCHEMA = 'quizdb'
ORDER BY TABLE_NAME; 