# 📚 MonTopi 项目文档中心

**最后更新**: 2025年11月13日  
**版本**: 1.0.0

> **🚀 快速开始**: 查看 [完整文档索引](./DOCUMENTATION_INDEX.md) 快速找到您需要的文档

---

## 📖 核心文档

| 文档 | 说明 | 状态 |
|------|------|------|
| [**完整文档索引**](./DOCUMENTATION_INDEX.md) | 📚 所有文档的分类索引和快速查找 | ⭐ 推荐 |
| [GIT提交规范](./GIT_COMMIT_GUIDE.md) | Git commit message规范 | ✅ 最新 |
| [项目完成总结](./PROJECT_COMPLETION_SUMMARY.md) | 项目里程碑和完成情况 | ✅ 最新 |
| [数据模型关系](./model-associations.md) | 数据库模型关联说明 | ✅ 最新 |
| [购买管理](./PURCHASE_MANAGEMENT.md) | 购买流程和权限管理 | ✅ 最新 |

---

## 🎯 功能文档 (features/)

| 文档 | 说明 | 状态 |
|------|------|------|
| [API规范](./features/API_SPEC.md) | API接口文档 | ✅ 最新 |
| [JSON题库导入](./features/JSON题库导入说明.md) | JSON格式题库导入功能 | ✅ 最新 |
| [Cognito弹窗登录](./features/COGNITO_POPUP_LOGIN.md) | 弹窗式登录实现 | ✅ 最新 |
| [SEO实现报告](./features/SEO_IMPLEMENTATION_REPORT.md) | SEO优化实现 | ✅ 最新 |
| [进度删除功能](./features/ProfileDeleteProgress.md) | 用户进度删除功能 | ✅ 最新 |
| [数据库字段映射](./features/JSON题库导入-数据库字段映射详解.md) | JSON导入字段映射详解 | ✅ 最新 |
| [Node.js安装指南](./features/Node.js安装指南.md) | Node.js环境配置 | ✅ 最新 |

---

## 🚀 部署文档 (deployment/)

### 部署指南

| 文档 | 说明 | 状态 |
|------|------|------|
| [生产环境部署](./deployment/PRODUCTION_DEPLOYMENT_GUIDE.md) | 完整的生产环境部署流程 | ⭐ 重要 |
| [宝塔部署指南](./deployment/baota-deploy-guide.md) | 使用宝塔面板部署 | ✅ 最新 |
| [Nginx配置](./deployment/nginx-setup.md) | Nginx反向代理配置 | ✅ 最新 |
| [数据迁移指南](./deployment/MIGRATION_GUIDE.md) | 数据库迁移和升级 | ✅ 最新 |
| [AWS Cognito部署](./deployment/AWS_COGNITO_PRODUCTION_DEPLOYMENT.md) | Cognito认证配置 | ✅ 最新 |

### 生产环境 (production/)

| 文档 | 说明 | 语言 |
|------|------|------|
| [生产就绪报告](./production/PRODUCTION_READY_REPORT.md) | 生产环境准备清单 | 中文 |
| [生产环境配置](./production/PRODUCTION_ENV_SETUP.md) | 环境变量和配置 | 中文 |
| [生产部署指南(JP)](./production/PRODUCTION_DEPLOYMENT_GUIDE_JP.md) | 日文部署文档 | 日本語 |

---

## 🔒 安全文档 (security/)

| 文档 | 说明 | 状态 |
|------|------|------|
| [安全事件响应](./security/SECURITY_INCIDENT_RESPONSE.md) | 安全事件处理流程 | ✅ 最新 |

---

## 📦 归档文档 (archive/)

**位置**: [archive/](./archive/)  
**说明**: 已完成功能、历史修复记录和临时开发文档

详细内容请查看 [归档文档README](./archive/README.md)

### 目录结构
```
archive/
├── completed-features/    # 已完成功能的实现文档
│   ├── WRONGANSWER_COMPLETE_SOLUTION.md
│   ├── SMART_REFRESH_PROTECTION.md
│   ├── TOKEN_AUTO_REFRESH.md
│   └── ...
├── development/          # 临时开发文档和过程记录
│   ├── CLEANUP_COMPLETED_REPORT.md
│   ├── QUESTIONCARD_COMPREHENSIVE_CHECK.md
│   └── ...
└── fix-records/         # 历史bug修复记录
    ├── JSON题库显示问题修复总结.md
    ├── 题目顺序问题最终修复.md
    └── ...
```

---

## 🔍 快速查找指南

### 我想...

| 需求 | 查看文档 |
|------|---------|
| 🚀 部署到生产环境 | → [生产部署指南](./deployment/PRODUCTION_DEPLOYMENT_GUIDE.md) |
| ⚙️ 配置Nginx | → [Nginx配置指南](./deployment/nginx-setup.md) |
| 📡 了解API接口 | → [API规范](./features/API_SPEC.md) |
| 📥 导入题库数据 | → [JSON题库导入说明](./features/JSON题库导入说明.md) |
| 🔐 设置AWS Cognito | → [Cognito部署文档](./deployment/AWS_COGNITO_PRODUCTION_DEPLOYMENT.md) |
| 🗄️ 查看数据库结构 | → [数据模型关系](./model-associations.md) |
| 🛡️ 了解安全策略 | → [安全事件响应](./security/SECURITY_INCIDENT_RESPONSE.md) |
| 📚 查找所有文档 | → [**完整文档索引**](./DOCUMENTATION_INDEX.md) |

---

## 📂 项目文档结构

```
docs/
├── README.md                          # 本文档 - 文档中心入口
├── DOCUMENTATION_INDEX.md             # 完整文档索引（推荐）
├── GIT_COMMIT_GUIDE.md               # Git提交规范
├── PROJECT_COMPLETION_SUMMARY.md     # 项目完成总结
├── model-associations.md             # 数据模型关系
├── PURCHASE_MANAGEMENT.md            # 购买管理
│
├── features/                         # 功能文档
│   ├── API_SPEC.md
│   ├── COGNITO_POPUP_LOGIN.md
│   ├── SEO_IMPLEMENTATION_REPORT.md
│   └── ...
│
├── deployment/                       # 部署文档
│   ├── PRODUCTION_DEPLOYMENT_GUIDE.md
│   ├── baota-deploy-guide.md
│   ├── nginx-setup.md
│   └── ...
│
├── production/                       # 生产环境文档
│   ├── PRODUCTION_READY_REPORT.md
│   ├── PRODUCTION_ENV_SETUP.md
│   └── PRODUCTION_DEPLOYMENT_GUIDE_JP.md
│
├── security/                         # 安全文档
│   └── SECURITY_INCIDENT_RESPONSE.md
│
└── archive/                          # 归档文档
    ├── README.md                     # 归档文档说明
    ├── completed-features/           # 已完成功能
    ├── development/                  # 开发过程记录
    └── fix-records/                  # 历史修复记录
```

---

## 📝 文档维护规范

### 文档更新流程
1. 更新文档内容
2. 更新文档顶部的"最后更新"日期
3. 如果是重大变更，在 [DOCUMENTATION_INDEX.md](./DOCUMENTATION_INDEX.md) 中标注
4. Git提交时使用 `docs:` 前缀

### 文档分类原则
- **核心文档**: 项目级别的重要文档
- **功能文档**: 具体功能的实现和使用说明
- **部署文档**: 部署相关的所有文档
- **安全文档**: 安全策略和应急响应
- **归档文档**: 已完成或历史性文档

### 归档规则
- 已完成且稳定的功能 → `archive/completed-features/`
- 临时开发记录 → `archive/development/`
- 历史bug修复 → `archive/fix-records/`

---

## 🆘 需要帮助?

- **找不到文档？** → 查看 [完整文档索引](./DOCUMENTATION_INDEX.md)
- **部署问题？** → 查看 [部署指南](./deployment/PRODUCTION_DEPLOYMENT_GUIDE.md)
- **功能问题？** → 查看对应的功能文档
- **其他问题？** → 返回 [项目主README](../README.md)

---

**维护者**: MonTopi Development Team  
**创建日期**: 2025年11月13日  
**文档版本**: 1.0.0

最后更新：2025年11月9日
