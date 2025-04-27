-- 向question_sets表添加isFeatured和featuredCategory字段
ALTER TABLE question_sets 
ADD COLUMN is_featured BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN featured_category VARCHAR(50) NULL; 