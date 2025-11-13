# 📚 文档索引 / Documentation Index

**最終更新**: 2025年11月13日

## 📖 目录 / Table of Contents

### 🚀 快速开始 / Quick Start
- [项目主README](../README.md) - 项目概览和快速开始指南
- [部署指南](deployment/PRODUCTION_DEPLOYMENT_GUIDE.md) - 生产环境部署完整指南

---

## 📁 文档分类 / Documentation Categories

### 1️⃣ 部署文档 / Deployment Documentation
**位置**: `docs/deployment/`

| 文档 | 说明 | 状态 |
|------|------|------|
| [生产部署指南](deployment/PRODUCTION_DEPLOYMENT_GUIDE.md) | 完整的生产环境部署流程 | ✅ 最新 |
| [宝塔部署指南](deployment/baota-deploy-guide.md) | 使用宝塔面板部署 | ✅ 最新 |
| [Nginx配置指南](deployment/nginx-setup.md) | Nginx反向代理配置 | ✅ 最新 |
| [迁移指南](deployment/MIGRATION_GUIDE.md) | 数据库迁移和升级 | ✅ 最新 |
| [AWS Cognito部署](deployment/AWS_COGNITO_PRODUCTION_DEPLOYMENT.md) | Cognito认证配置 | ✅ 最新 |

---

### 2️⃣ 功能文档 / Feature Documentation
**位置**: `docs/features/`

| 文档 | 说明 | 状态 |
|------|------|------|
| [API规范](features/API_SPEC.md) | API接口文档 | ✅ 最新 |
| [JSON题库导入](features/JSON题库导入说明.md) | JSON格式题库导入功能 | ✅ 最新 |
| [Cognito弹窗登录](features/COGNITO_POPUP_LOGIN.md) | 弹窗式登录实现 | ✅ 最新 |
| [SEO实现报告](features/SEO_IMPLEMENTATION_REPORT.md) | SEO优化实现 | ✅ 最新 |
| [进度删除功能](features/ProfileDeleteProgress.md) | 用户进度删除功能 | ✅ 最新 |

---

### 3️⃣ 生产环境文档 / Production Documentation
**位置**: `docs/production/`

| 文档 | 说明 | 状态 |
|------|------|------|
| [生产准备报告](production/PRODUCTION_READY_REPORT.md) | 生产环境准备清单 | ✅ 完成 |
| [生产环境配置](production/PRODUCTION_ENV_SETUP.md) | 环境变量和配置 | ✅ 最新 |
| [生产部署指南(日文)](production/PRODUCTION_DEPLOYMENT_GUIDE_JP.md) | 日文部署文档 | ✅ 最新 |

---

### 4️⃣ 服务器文档 / Server Documentation
**位置**: `server/`

| 文档 | 说明 | 状态 |
|------|------|------|
| [服务器README](../server/README.md) | 后端服务器说明 | ✅ 最新 |
| [数据库说明](../server/DATABASE.md) | 数据库结构和配置 | ✅ 最新 |
| [部署说明](../server/DEPLOYMENT.md) | 后端部署流程 | ✅ 最新 |
| [Cognito环境配置](../server/COGNITO_ENV_SETUP.md) | Cognito环境变量 | ✅ 最新 |

---

### 5️⃣ 开发指南 / Development Guide
**位置**: `docs/`

| 文档 | 说明 | 状态 |
|------|------|------|
| [Git提交规范](GIT_COMMIT_GUIDE.md) | Git commit message规范 | ✅ 最新 |
| [数据模型关系](model-associations.md) | 数据库模型关联说明 | ✅ 最新 |
| [购买管理](PURCHASE_MANAGEMENT.md) | 购买流程和权限管理 | ✅ 最新 |

---

### 6️⃣ 归档文档 / Archived Documentation
**位置**: `docs/archive/`

#### 已完成的功能实现记录
- [错题解决方案](../WRONGANSWER_COMPLETE_SOLUTION.md)
- [智能刷新保护](../SMART_REFRESH_PROTECTION.md)
- [Token自动刷新](../TOKEN_AUTO_REFRESH.md)
- [答题流程改进](../ANSWER_FLOW_IMPROVEMENT.md)

#### 历史修复记录
**位置**: `docs/archive/fix-records/`
- JSON题库相关修复
- 题目顺序问题修复
- 选项标签问题修复
- Toast通知关闭

---

## 🔍 文档查找指南 / Quick Reference

### 我想...

#### 部署应用
→ 查看 [生产部署指南](deployment/PRODUCTION_DEPLOYMENT_GUIDE.md)

#### 配置Nginx
→ 查看 [Nginx配置指南](deployment/nginx-setup.md)

#### 导入题库
→ 查看 [JSON题库导入说明](features/JSON题库导入说明.md)

#### 配置认证
→ 查看 [AWS Cognito部署](deployment/AWS_COGNITO_PRODUCTION_DEPLOYMENT.md)

#### 了解API
→ 查看 [API规范](features/API_SPEC.md)

#### 查看数据库
→ 查看 [数据库说明](../server/DATABASE.md)

---

## 📝 文档维护规范

### 文档命名规范
- 英文文档：大写加下划线 (例: `PRODUCTION_DEPLOYMENT_GUIDE.md`)
- 中文文档：中文加横线 (例: `JSON题库导入说明.md`)
- 日文文档：后缀 `_JP` (例: `PRODUCTION_DEPLOYMENT_GUIDE_JP.md`)

### 文档更新流程
1. 更新文档内容
2. 更新文档顶部的"最后更新"日期
3. 如果是重大变更，在此索引中标注
4. 提交时使用 `docs:` 前缀

### 归档规则
- 已完成且不再更新的功能 → `docs/archive/completed-features/`
- 临时开发文档 → `docs/archive/development/`
- 历史修复记录 → `docs/archive/fix-records/`

---

## 🆘 需要帮助?

- 项目问题：查看 [主README](../README.md)
- 部署问题：查看 [部署指南](deployment/PRODUCTION_DEPLOYMENT_GUIDE.md)
- 功能问题：查看对应的功能文档

---

**维护者**: Development Team  
**创建日期**: 2025年11月13日  
**版本**: 1.0.0
