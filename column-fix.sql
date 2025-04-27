-- 修复数据库列名问题

-- 删除现有的外键约束 (如果存在)
ALTER TABLE purchases DROP FOREIGN KEY IF EXISTS purchases_ibfk_2;

-- 检查是否需要修改列名
-- 你需要根据当前的表结构选择执行其中一个命令

-- 如果当前表有quizId而没有questionSetId，执行这个:
-- ALTER TABLE purchases CHANGE COLUMN quizId questionSetId char(36) CHARACTER SET utf8mb4 COLLATE utf8mb4_bin NOT NULL;

-- 如果两个列都存在，删除quizId保留questionSetId，执行这个:
-- ALTER TABLE purchases DROP COLUMN quizId;

-- 如果只有questionSetId存在，不需要做任何操作

-- 更新索引 (如果需要)
-- ALTER TABLE purchases DROP INDEX IF EXISTS purchases_quiz_id;
-- ALTER TABLE purchases ADD INDEX purchases_question_set_id (questionSetId);

-- 重新添加外键约束 (如果需要)
-- ALTER TABLE purchases ADD CONSTRAINT purchases_ibfk_2 
--   FOREIGN KEY (questionSetId) 
--   REFERENCES question_sets (id) 
--   ON DELETE CASCADE ON UPDATE CASCADE;

-- 更新表注释
-- ALTER TABLE purchases COMMENT = '用户购买题库记录表'; 