-- 删除现有的外键约束
ALTER TABLE purchases DROP FOREIGN KEY purchases_ibfk_2;

-- 重命名quizId字段为questionSetId
ALTER TABLE purchases CHANGE COLUMN quizId questionSetId char(36) CHARACTER SET utf8mb4 COLLATE utf8mb4_bin NOT NULL;

-- 更新索引
ALTER TABLE purchases DROP INDEX purchases_quiz_id;
ALTER TABLE purchases ADD INDEX purchases_question_set_id (questionSetId);

-- 重新添加外键约束
ALTER TABLE purchases 
  ADD CONSTRAINT purchases_ibfk_2 
  FOREIGN KEY (questionSetId) 
  REFERENCES question_sets (id) 
  ON DELETE CASCADE ON UPDATE CASCADE;

-- 更新表注释
ALTER TABLE purchases COMMENT = '用户购买题库记录表'; 