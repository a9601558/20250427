-- 修复homepage_settings表中的featured_categories字段
-- 当前值是 '["4312"]' 但这不是一个有效的分类名称
-- 我们需要将其更新为有效的分类名称

-- 查看当前的分类
SELECT DISTINCT category FROM question_sets WHERE category IS NOT NULL AND category != '';

-- 更新featured_categories为有效的分类名称
-- 使用实际存在的分类，比如 'Sap' 和 '计算机基础'
UPDATE homepage_settings 
SET featured_categories = '["Sap", "计算机基础"]'
WHERE id = 1;

-- 验证更新
SELECT * FROM homepage_settings WHERE id = 1;