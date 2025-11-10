#!/bin/bash

# 🔍 错题保存问题诊断脚本
# 
# 使用方法：
# chmod +x check-wronganswer-issue.sh
# ./check-wronganswer-issue.sh

echo "🔍 开始诊断错题保存问题..."
echo ""

# 颜色定义
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

# 1. 检查数据库连接
echo "1️⃣ 检查数据库连接..."
if mysql -u root -pzqw20011216 -e "SELECT 1" quizdb >/dev/null 2>&1; then
    echo -e "${GREEN}✅ 数据库连接成功${NC}"
else
    echo -e "${RED}❌ 数据库连接失败${NC}"
    exit 1
fi
echo ""

# 2. 检查 WrongAnswers 表外键约束
echo "2️⃣ 检查 WrongAnswers 表外键约束..."
FOREIGN_KEYS=$(mysql -u root -pzqw20011216 -N -e "
SELECT COUNT(*) 
FROM INFORMATION_SCHEMA.KEY_COLUMN_USAGE
WHERE TABLE_SCHEMA = 'quizdb' 
  AND TABLE_NAME = 'WrongAnswers'
  AND REFERENCED_TABLE_NAME IS NOT NULL
" quizdb)

if [ "$FOREIGN_KEYS" -gt 0 ]; then
    echo -e "${YELLOW}⚠️  发现 $FOREIGN_KEYS 个外键约束${NC}"
    echo "详细信息："
    mysql -u root -pzqw20011216 -e "
    SELECT 
      CONSTRAINT_NAME as '约束名',
      COLUMN_NAME as '列名',
      REFERENCED_TABLE_NAME as '引用表',
      REFERENCED_COLUMN_NAME as '引用列'
    FROM INFORMATION_SCHEMA.KEY_COLUMN_USAGE
    WHERE TABLE_SCHEMA = 'quizdb' 
      AND TABLE_NAME = 'WrongAnswers'
      AND REFERENCED_TABLE_NAME IS NOT NULL
    " quizdb
    echo ""
    echo -e "${YELLOW}建议：运行迁移脚本删除外键约束${NC}"
else
    echo -e "${GREEN}✅ 未发现外键约束（已修复）${NC}"
fi
echo ""

# 3. 检查最近的错题保存错误
echo "3️⃣ 检查最近的错题数量..."
WRONG_ANSWER_COUNT=$(mysql -u root -pzqw20011216 -N -e "
SELECT COUNT(*) FROM WrongAnswers
" quizdb)
echo "当前错题记录数：$WRONG_ANSWER_COUNT"

RECENT_WRONG_ANSWERS=$(mysql -u root -pzqw20011216 -N -e "
SELECT COUNT(*) FROM WrongAnswers 
WHERE createdAt >= DATE_SUB(NOW(), INTERVAL 1 DAY)
" quizdb)
echo "最近24小时新增：$RECENT_WRONG_ANSWERS"
echo ""

# 4. 检查是否有无效的 questionId（孤儿记录）
echo "4️⃣ 检查孤儿记录（questionId 不存在）..."
ORPHAN_COUNT=$(mysql -u root -pzqw20011216 -N -e "
SELECT COUNT(*)
FROM WrongAnswers wa
LEFT JOIN questions q ON wa.questionId = q.id
WHERE q.id IS NULL
" quizdb)

if [ "$ORPHAN_COUNT" -gt 0 ]; then
    echo -e "${YELLOW}⚠️  发现 $ORPHAN_COUNT 条孤儿记录${NC}"
    echo "详细信息（前5条）："
    mysql -u root -pzqw20011216 -e "
    SELECT 
      wa.id,
      wa.questionId as '不存在的问题ID',
      wa.question as '问题文本',
      wa.createdAt as '创建时间'
    FROM WrongAnswers wa
    LEFT JOIN questions q ON wa.questionId = q.id
    WHERE q.id IS NULL
    LIMIT 5
    " quizdb
else
    echo -e "${GREEN}✅ 未发现孤儿记录${NC}"
fi
echo ""

# 5. 测试保存错题（模拟）
echo "5️⃣ 检查表结构..."
mysql -u root -pzqw20011216 -e "
DESCRIBE WrongAnswers
" quizdb
echo ""

# 6. 总结
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo "📊 诊断总结"
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo "外键约束数：$FOREIGN_KEYS"
echo "错题总数：$WRONG_ANSWER_COUNT"
echo "24h新增：$RECENT_WRONG_ANSWERS"
echo "孤儿记录：$ORPHAN_COUNT"
echo ""

if [ "$FOREIGN_KEYS" -gt 0 ]; then
    echo -e "${RED}🔧 需要修复：运行以下命令删除外键约束${NC}"
    echo "   cd /www/wwwroot/root/git/dist/server"
    echo "   node migrations/remove-wronganswer-foreign-keys.js"
else
    echo -e "${GREEN}✅ 系统状态正常${NC}"
fi
echo ""
