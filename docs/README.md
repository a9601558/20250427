# 📚 项目文档索引

本项目文档已重新组织，以便更好地维护和查找。

---

## 📖 核心文档

- **[GIT_COMMIT_GUIDE.md](./GIT_COMMIT_GUIDE.md)** - Git提交规范
- **[PROJECT_COMPLETION_SUMMARY.md](./PROJECT_COMPLETION_SUMMARY.md)** - 项目完成总结
- **[model-associations.md](./model-associations.md)** - 数据模型关联说明
- **[JSON_IMPORT_FEATURE.md](./JSON_IMPORT_FEATURE.md)** - JSON题库导入功能
- **[PURCHASE_MANAGEMENT.md](./PURCHASE_MANAGEMENT.md)** - 购买记录管理

---

## 🎯 功能文档 (features/)

- **[API_SPEC.md](./features/API_SPEC.md)** - API规范说明
- **[COGNITO_POPUP_LOGIN.md](./features/COGNITO_POPUP_LOGIN.md)** - Cognito弹窗登录
- **[ProfileDeleteProgress.md](./features/ProfileDeleteProgress.md)** - 个人资料页删除进度功能
- **[JSON题库导入说明.md](./features/JSON题库导入说明.md)** - JSON题库导入详细说明
- **[JSON题库导入-数据库字段映射详解.md](./features/JSON题库导入-数据库字段映射详解.md)** - 数据库映射详解

---

## 🚀 部署文档 (deployment/)

### 部署指南
- **[PRODUCTION_DEPLOYMENT_GUIDE.md](./deployment/PRODUCTION_DEPLOYMENT_GUIDE.md)** - 生产环境部署指南
- **[AWS_COGNITO_PRODUCTION_DEPLOYMENT.md](./deployment/AWS_COGNITO_PRODUCTION_DEPLOYMENT.md)** - AWS Cognito部署
- **[MIGRATION_GUIDE.md](./deployment/MIGRATION_GUIDE.md)** - 数据迁移指南
- **[baota-deploy-guide.md](./deployment/baota-deploy-guide.md)** - 宝塔面板部署指南

### Nginx配置 (deployment/nginx/)
- `nginx.conf` - 主配置文件
- `nginx-headers-only.conf` - 仅headers配置
- `api-path-mapping.conf` - API路径映射
- `api-proxy-settings.conf` - API代理设置

### 生产环境 (production/)
- **[PRODUCTION_DEPLOYMENT_GUIDE_JP.md](./production/PRODUCTION_DEPLOYMENT_GUIDE_JP.md)** - 生产环境部署指南（日文）
- **[PRODUCTION_ENV_SETUP.md](./production/PRODUCTION_ENV_SETUP.md)** - 生产环境配置
- **[PRODUCTION_READY_REPORT.md](./production/PRODUCTION_READY_REPORT.md)** - 生产就绪报告

---

## 🔒 安全文档 (security/)

- **[SECURITY_INCIDENT_RESPONSE.md](./security/SECURITY_INCIDENT_RESPONSE.md)** - 安全事件响应指南

---

## 📦 归档文档 (archive/)

历史文档和修复记录（仅供参考）：

### 历史Bug修复记录 (archive/fix-records/)
- `JSON题库显示问题修复总结.md`
- `JSON题库顺序问题完整修复记录.md`
- `选项标签重复问题修复.md`
- `选项编号顺序修复.md`
- `题目顺序显示问题修复.md`
- `题目顺序问题最终修复.md`
- `关闭全部toast通知.md`

### 其他归档
- **[CLEANUP_REPORT.md](./CLEANUP_REPORT.md)** - 历史清理报告

---

## 🔍 快速查找

### 我想...

- **部署到生产环境** → [PRODUCTION_DEPLOYMENT_GUIDE.md](./deployment/PRODUCTION_DEPLOYMENT_GUIDE.md)
- **配置Nginx** → [deployment/nginx/](./deployment/nginx/)
- **了解API接口** → [API_SPEC.md](./features/API_SPEC.md)
- **导入题库数据** → [JSON题库导入说明.md](./features/JSON题库导入说明.md)
- **设置AWS Cognito** → [AWS_COGNITO_PRODUCTION_DEPLOYMENT.md](./deployment/AWS_COGNITO_PRODUCTION_DEPLOYMENT.md)
- **查看数据库结构** → [model-associations.md](./model-associations.md)
- **了解安全策略** → [SECURITY_INCIDENT_RESPONSE.md](./security/SECURITY_INCIDENT_RESPONSE.md)

---

## 📂 项目结构

```
docs/
├── README.md                      # 本文档
├── features/                      # 功能文档
├── deployment/                    # 部署文档
│   └── nginx/                    # Nginx配置
├── production/                    # 生产环境文档
├── security/                      # 安全文档
└── archive/                       # 归档文档
    └── fix-records/              # 历史修复记录
```

---

最后更新：2025年11月9日
