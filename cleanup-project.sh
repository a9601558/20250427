#!/bin/bash
# 项目清理脚本 - 移除临时文件和冗余文档
# 使用方法: bash cleanup-project.sh

set -e

echo "=========================================="
echo "  项目清理工具"
echo "=========================================="
echo ""

# 创建备份目录
BACKUP_DIR="./archived-docs-$(date +%Y%m%d_%H%M%S)"
mkdir -p "$BACKUP_DIR"
echo "✅ 创建备份目录: $BACKUP_DIR"
echo ""

# 临时调试文件（可删除）
TEMP_FILES=(
    "debug-homepage.js"
    "代码错误检查报告.md"
)

# 临时脚本文件（已集成到项目中的脚本）
TEMP_SCRIPTS=(
    "fix-on-server.sh"
    "server-fix.sh"
    "diagnose-server.sh"
    "ultimate-fix.sh"
    "quick-fix.sh"
    "deploy-to-production.sh"
    "修复代码片段.js"
)

# 已完成任务的文档（可归档）
COMPLETED_DOCS=(
    "JSON文件上传问题修复.md"
    "最终修复方案.md"
    "JSON题库导入功能-完成报告.md"
    "JSON题库导入功能更新说明.md"
    "紧急修复指南.md"
    "服务器修复完整步骤.md"
    "JSON题库导入-生产部署指南.md"
)

echo "🗑️  清理临时调试文件..."
for file in "${TEMP_FILES[@]}"; do
    if [ -f "$file" ]; then
        echo "  删除: $file"
        rm "$file"
    fi
done
echo ""

echo "🗑️  清理临时脚本..."
for file in "${TEMP_SCRIPTS[@]}"; do
    if [ -f "$file" ]; then
        echo "  删除: $file"
        rm "$file"
    fi
done
echo ""

echo "📦 归档已完成任务的文档..."
for file in "${COMPLETED_DOCS[@]}"; do
    if [ -f "$file" ]; then
        echo "  归档: $file"
        mv "$file" "$BACKUP_DIR/"
    fi
done
echo ""

# 整理文档到 docs 目录
echo "📚 整理文档结构..."

# 创建 docs 子目录
mkdir -p docs/deployment
mkdir -p docs/features
mkdir -p docs/examples

# 移动部署相关文档
DEPLOY_DOCS=(
    "AWS_COGNITO_PRODUCTION_DEPLOYMENT.md"
    "PRODUCTION_DEPLOYMENT_GUIDE.md"
    "baota-deploy-guide.md"
    "nginx-setup.md"
    "MIGRATION_GUIDE.md"
)

for file in "${DEPLOY_DOCS[@]}"; do
    if [ -f "$file" ]; then
        echo "  移动 $file → docs/deployment/"
        mv "$file" docs/deployment/
    fi
done

# 移动功能文档
FEATURE_DOCS=(
    "JSON题库导入说明.md"
    "JSON题库导入-数据库字段映射详解.md"
    "COGNITO_POPUP_LOGIN.md"
    "API_SPEC.md"
    "Node.js安装指南.md"
)

for file in "${FEATURE_DOCS[@]}"; do
    if [ -f "$file" ]; then
        echo "  移动 $file → docs/features/"
        mv "$file" docs/features/
    fi
done

# 移动示例文件
EXAMPLE_FILES=(
    "题库JSON格式示例.json"
)

for file in "${EXAMPLE_FILES[@]}"; do
    if [ -f "$file" ]; then
        echo "  移动 $file → docs/examples/"
        mv "$file" docs/examples/
    fi
done

echo ""

# 清理 node_modules 中的缓存（可选）
echo "🧹 清理构建缓存..."
if [ -d "dist" ]; then
    echo "  保留 dist/ 目录（生产构建）"
fi

# 清理 server 目录
if [ -d "server" ]; then
    cd server
    if [ -d "uploads" ]; then
        echo "  清理 server/uploads/ 临时上传文件..."
        find uploads/ -type f -name "*.json" -mtime +7 -delete 2>/dev/null || true
        find uploads/ -type f -name "*.csv" -mtime +7 -delete 2>/dev/null || true
        find uploads/ -type f -name "*.txt" -mtime +7 -delete 2>/dev/null || true
    fi
    cd ..
fi

echo ""
echo "=========================================="
echo "  ✨ 清理完成！"
echo "=========================================="
echo ""
echo "清理摘要:"
echo "  ✅ 删除临时调试文件"
echo "  ✅ 删除临时脚本"
echo "  ✅ 归档已完成任务文档到: $BACKUP_DIR"
echo "  ✅ 整理文档到 docs/ 目录"
echo "  ✅ 清理7天前的上传临时文件"
echo ""
echo "文档结构:"
echo "  docs/"
echo "  ├── deployment/     (部署相关文档)"
echo "  ├── features/       (功能说明文档)"
echo "  ├── examples/       (示例文件)"
echo "  └── model-associations.md"
echo ""
echo "备份位置: $BACKUP_DIR"
echo ""
